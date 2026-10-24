// 發音（瀏覽器內建日文 TTS）與答題音效（WebAudio 合成，無音檔）
let jaVoice = null;

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
  supported: () => 'speechSynthesis' in window,
  hasJapanese: () => !!jaVoice,
  speak(text, { slow = false } = {}) {
    if (!('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    u.rate = slow ? 0.6 : 0.9;
    speechSynthesis.speak(u);
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
