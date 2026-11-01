// 發音：優先播放 VOICEVOX 預錄音檔（audio/manifest.json），沒有才退回瀏覽器內建日文 TTS
// 答題音效：WebAudio 合成，無音檔
let jaVoice = null;

// iOS 預設把 WebAudio 歸在「環境音」，靜音開關一撥就沒聲音；改成「播放」類別
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 不支援就算了 */ }

let clips = null; // { speaker, credit, files: { 日文: hash } }
let clipsSettled = false;
const clipsReady = fetch('audio/manifest.json', { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : null))
  .then(m => { clips = m && m.files ? m : null; })
  .catch(() => {})
  .finally(() => { clipsSettled = true; });

const buffers = new Map();
let current = null;
const scheduled = new Set();
let playToken = 0;

function loadBuffer(c, url) {
  let p = buffers.get(url);
  if (!p) {
    p = fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => new Promise((res, rej) => c.decodeAudioData(b, res, rej)));
    buffers.set(url, p);
    p.catch(() => buffers.delete(url));
  }
  return p;
}

function stopAll() {
  try { current?.stop(); } catch (e) { /* 已經停了 */ }
  scheduled.forEach(src => { try { src.stop(); } catch (e) { /* 已經停了 */ } });
  scheduled.clear();
  current = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function ttsSpeak(text, slow) {
  if (!('speechSynthesis' in window)) return;
  // 單一假名太短，iOS 常吃掉開頭：加停頓唸兩次
  const t = [...text.trim()].length === 1 ? `${text}、${text}` : text;
  const u = new SpeechSynthesisUtterance(t);
  u.lang = 'ja-JP';
  if (jaVoice) u.voice = jaVoice;
  u.rate = slow ? 0.75 : 0.9; // iOS 的語速不是線性的，0.6 會讓聲音變形
  speechSynthesis.speak(u);
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  jaVoice =
    voices.find(v => /^ja[-_]JP/i.test(v.lang) && /Kyoko|O-ren|Otoya|Google/i.test(v.name)) ||
    voices.find(v => /^ja/i.test(v.lang)) ||
    null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export const speech = {
  ready: clipsReady,
  supported: () => !!clips || 'speechSynthesis' in window,
  hasJapanese: () => !!jaVoice,
  hasClips: () => !!clips,
  credit: () => clips?.credit || '',
  speak(text, { slow = false } = {}) {
    if (!text) return;
    const token = ++playToken;
    stopAll();
    // 確定沒有預錄音檔時，同步走 TTS（iOS 要在點擊當下呼叫才會出聲）
    if (clipsSettled && !clips?.files?.[text]) { ttsSpeak(text, slow); return; }
    const c = audioCtx(); // 一定要在點擊當下同步建立／喚醒，iOS 才會出聲
    const run = async () => {
      if (!clips) await clipsReady;
      const h = clips?.files?.[text];
      if (h && c) {
        try {
          const buf = await loadBuffer(c, `audio/${slow ? 's' : 'n'}/${h}.mp3`);
          if (token !== playToken) return; // 期間又按了別的，就不播舊的
          const src = c.createBufferSource();
          src.buffer = buf;
          src.connect(c.destination);
          src.start();
          current = src;
          return;
        } catch (e) { /* 音檔壞掉或離線沒快取 → 退回 TTS */ }
      }
      if (token === playToken) ttsSpeak(text, slow);
    };
    run();
  },
  // 一個字一個字唸（每個假名用單字音檔，中間停一下）；有缺音檔的字就退回整句 TTS
  spell(text, { slow = false } = {}) {
    const chars = [...text].filter(ch => /[\u3040-\u30ff]/.test(ch));
    if (!chars.length) return;
    const token = ++playToken;
    stopAll();
    const c = audioCtx();
    const run = async () => {
      if (!clips) await clipsReady;
      const hashes = chars.map(ch => clips?.files?.[ch]);
      if (!c || hashes.some(h => !h)) { if (token === playToken) ttsSpeak(chars.join('、'), true); return; }
      try {
        const bufs = await Promise.all(hashes.map(h => loadBuffer(c, `audio/${slow ? 's' : 'n'}/${h}.mp3`)));
        if (token !== playToken) return;
        let t = c.currentTime + 0.05;
        bufs.forEach(buf => {
          const src = c.createBufferSource();
          src.buffer = buf;
          src.connect(c.destination);
          src.start(t);
          scheduled.add(src);
          src.onended = () => scheduled.delete(src);
          t += buf.duration + 0.15;
        });
      } catch (e) { if (token === playToken) ttsSpeak(chars.join('、'), true); }
    };
    run();
  },
};

let ctx = null;
function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.12) {
  const c = audioCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  enabled: true,
  correct() { if (!this.enabled) return; tone(784, 0, 0.18, 'triangle'); tone(1175, 0.09, 0.28, 'triangle'); },
  wrong() { if (!this.enabled) return; tone(330, 0, 0.22, 'sine', 0.1); tone(262, 0.12, 0.3, 'sine', 0.1); },
  stamp() { if (!this.enabled) return; tone(196, 0, 0.12, 'square', 0.05); tone(523, 0.05, 0.25, 'triangle'); },
  fanfare() { if (!this.enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle')); },
};
