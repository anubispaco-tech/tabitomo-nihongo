// 用 VOICEVOX Engine 把 App 會唸到的所有日文預先產生成 mp3。
// 由 .github/workflows/voice.yml 在 GitHub Actions 上執行（引擎跑在 Docker service），本機也可以跑：
//   1) 啟動 VOICEVOX（桌面版或 docker run -p 50021:50021 voicevox/voicevox_engine:cpu-latest）
//   2) node tools/gen-audio.mjs            一般模式：產生 audio/n、audio/s 與 audio/manifest.json
//      node tools/gen-audio.mjs --samples  試聽模式：每個候選聲音產生一段試聽檔到 audio/_samples
// 需要 ffmpeg（wav → mp3）。
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
const OUT = join(ROOT, 'audio');
const MANIFEST = join(OUT, 'manifest.json');
const DEFAULT_SPEAKER = '冥鳴ひまり';
const DEFAULT_STYLE = 'ノーマル';

// 語速設定：正常偏慢一點點；慢速另外合成，不靠播放器拉長，聲音才不會變形
const PROFILES = {
  n: { speedScale: 0.92, pauseLengthScale: 1.2, prePhonemeLength: 0.2, postPhonemeLength: 0.3 },
  s: { speedScale: 0.7, pauseLengthScale: 1.8, prePhonemeLength: 0.25, postPhonemeLength: 0.4 },
};
const PARAMS_VERSION = 1; // 改了 PROFILES 就 +1，讓全部重新產生

const SAMPLE_CANDIDATES = ['冥鳴ひまり', '四国めたん', '春日部つむぎ', '九州そら', 'WhiteCUL', 'No.7', '玄野武宏', '青山龍星'];
const SAMPLE_TEXT = 'あ、い、う、え、お。こんにちは。これ、ください。';

const args = process.argv.slice(2);
const samplesMode = args.includes('--samples');

// ---------- 收集要唸的字串 ----------
function collectTexts() {
  const set = new Set();
  const add = t => { if (typeof t === 'string' && t.trim()) set.add(t); };

  // 題庫裡所有 jp 欄位
  const walk = o => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) (k === 'jp' ? add(v) : walk(v));
    }
  };
  for (const f of readdirSync(join(ROOT, 'data')).filter(f => f.endsWith('.json'))) {
    walk(JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8')));
  }

  // 程式裡寫死的 jp: '...'（鼓勵語、植物名、照顧道具）
  const careWords = [];
  for (const f of readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(join(ROOT, 'js', f), 'utf8');
    for (const m of src.matchAll(/jp:\s*(['"])((?:(?!\1).)+)\1/g)) add(m[2]);
    if (f === 'engine.js') {
      for (const m of src.matchAll(/id:\s*'[^']+',\s*jp:\s*'([^']+)'[^}]*price:/g)) careWords.push(m[1]);
    }
  }
  // 動態組出來的句子（app.js：`${c.jp}、ありがとう！`）
  careWords.forEach(w => add(`${w}、ありがとう！`));
  // 設定頁「試聽」
  add('こんにちは。いっしょに がんばろう！');
  return [...set];
}

// ---------- VOICEVOX ----------
async function api(path, init) {
  const res = await fetch(ENGINE + path, init);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${await res.text().catch(() => '')}`);
  return res;
}

async function waitEngine() {
  for (let i = 0; i < 90; i++) {
    try { const v = await (await api('/version')).text(); console.log('VOICEVOX Engine', v); return; }
    catch (e) { await new Promise(r => setTimeout(r, 2000)); }
  }
  throw new Error('連不到 VOICEVOX Engine：' + ENGINE);
}

let speakers = null;
async function styleId(name, style) {
  speakers ??= await (await api('/speakers')).json();
  const sp = speakers.find(s => s.name === name);
  if (!sp) return null;
  const st = sp.styles.find(s => s.name === style) || sp.styles[0];
  return { id: st.id, style: st.name };
}

async function synth(text, id, profile) {
  const q = await (await api(`/audio_query?speaker=${id}&text=${encodeURIComponent(text)}`, { method: 'POST' })).json();
  Object.assign(q, profile, { outputSamplingRate: 24000, outputStereo: false });
  const wav = Buffer.from(await (await api(`/synthesis?speaker=${id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q),
  })).arrayBuffer());
  return wav;
}

function toMp3(wav, file) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + '.wav';
  writeFileSync(tmp, wav);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', file]);
  unlinkSync(tmp);
}

// ---------- 主程式 ----------
async function samples() {
  await waitEngine();
  const dir = join(OUT, '_samples');
  for (const name of SAMPLE_CANDIDATES) {
    const sid = await styleId(name, DEFAULT_STYLE);
    if (!sid) { console.log('略過（引擎裡沒有）：', name); continue; }
    toMp3(await synth(SAMPLE_TEXT, sid.id, PROFILES.n), join(dir, `${name}.mp3`));
    console.log('試聽檔：', name);
  }
  writeFileSync(join(dir, 'README.md'),
    `# 聲音試聽\n\n每個檔案都唸：「${SAMPLE_TEXT}」\n\n選好後到 Actions › 產生發音音檔 › Run workflow，在 speaker 填角色名稱。\n使用前請到各角色的官方頁面確認使用規約，App 內會自動標示「VOICEVOX:角色名」。\n`);
}

async function main() {
  const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;
  const speaker = process.env.SPEAKER || old?.speaker || DEFAULT_SPEAKER;
  const wantStyle = process.env.STYLE || old?.style || DEFAULT_STYLE;

  await waitEngine();
  const sid = await styleId(speaker, wantStyle);
  if (!sid) throw new Error(`引擎裡找不到聲音「${speaker}」。可用：${speakers.map(s => s.name).join('、')}`);

  const texts = collectTexts();
  const files = {};
  let made = 0;
  for (const text of texts) {
    const h = createHash('sha1').update(`${PARAMS_VERSION}|${speaker}|${sid.style}|${text}`).digest('hex').slice(0, 12);
    files[text] = h;
    for (const [dir, profile] of Object.entries(PROFILES)) {
      const file = join(OUT, dir, `${h}.mp3`);
      if (existsSync(file)) continue;
      toMp3(await synth(text, sid.id, profile), file);
      made++;
    }
  }

  // 清掉不再用到的檔案
  const keep = new Set(Object.values(files).map(h => `${h}.mp3`));
  let removed = 0;
  for (const dir of Object.keys(PROFILES)) {
    const d = join(OUT, dir);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (!keep.has(f)) { unlinkSync(join(d, f)); removed++; }
  }

  const manifest = {
    engine: 'VOICEVOX',
    speaker, style: sid.style,
    credit: `VOICEVOX:${speaker}`,
    params: PARAMS_VERSION,
    count: texts.length,
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'ja'))),
  };
  const next = JSON.stringify(manifest, null, 1) + '\n';
  if (!old || JSON.stringify(old, null, 1) + '\n' !== next) writeFileSync(MANIFEST, next);
  console.log(`聲音：${speaker}（${sid.style}）｜字串 ${texts.length} 句｜新產生 ${made} 檔｜刪除 ${removed} 檔`);
}

(samplesMode ? samples() : main()).catch(e => { console.error(e.message || e); process.exit(1); });
