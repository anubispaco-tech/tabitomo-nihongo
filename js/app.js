import { loadState, saveState, addLogs, allLogs, clearAll, requestPersist } from './store.js';
import { speech, sfx } from './audio.js';
import { companionSVG, STAGE_NAMES } from './companion.js';
import {
  today, newState, applyResult, itemStatus, progressCounts, buildLevel, buildReview, reviewLeftToday,
  makeQuestion, companionLevel, companionStage, SNACKS, LINES, CHEERS, COMFORT, touchStreak, streakAlive,
} from './engine.js';

const app = document.getElementById('app');
let content = null;
let state = null;
let session = null;
const ui = { tab: 'home', overlay: null, sheet: null, bubble: null, mood: 'idle', toast: null };

// ---------- 工具 ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = id => content.items.find(it => it.id === id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const save = () => saveState(state);
const say = (text, opts = {}) => speech.speak(text, { slow: state.settings.slow, ...opts });
const ro = text => (text ? `<span class="ro">${esc(text)}</span>` : '');

function toast(msg) {
  ui.toast = msg;
  render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { ui.toast = null; render(); }, 2200);
}

function companionInfo() {
  const c = companionLevel(state.companion.exp);
  return { ...c, stage: companionStage(c.lv) };
}

function line(l, cls = '') {
  return `<div class="line ${cls}"><span class="jp">${esc(l.jp)}</span>${ro(l.ro)}<span class="zh">${esc(l.zh)}</span></div>`;
}

// ---------- 啟動 ----------
async function boot() {
  try {
    content = await (await fetch('data/prologue.json', { cache: 'no-cache' })).json();
  } catch (e) {
    app.innerHTML = `<div class="fatal">題庫載入失敗。請確認網路後重新整理頁面。</div>`;
    return;
  }
  state = (await loadState()) || newState();
  const base = newState();
  state.settings = { ...base.settings, ...state.settings };
  state.profile = { ...base.profile, ...state.profile };
  state.companion = { ...base.companion, ...state.companion };
  sfx.enabled = state.settings.sound;
  if (!state.onboarded) ui.overlay = 'onboard';
  render();
  requestPersist();
}

// ---------- 畫面 ----------
function render() {
  document.body.classList.toggle('no-romaji', !state?.settings.romaji);
  let html = '';
  if (ui.overlay === 'onboard') html = viewOnboard();
  else if (ui.overlay === 'session') html = viewSession();
  else if (ui.overlay === 'result') html = viewResult();
  else {
    html = `<main class="page page-${ui.tab}">${
      ui.tab === 'home' ? viewHome() : ui.tab === 'book' ? viewBook() : ui.tab === 'buddy' ? viewBuddy() : viewSettings()
    }</main>${viewNav()}${ui.sheet ? viewSheet() : ''}`;
  }
  if (ui.toast) html += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  app.innerHTML = html;
}

function viewNav() {
  const tabs = [['home', '旅程'], ['book', '手帳'], ['buddy', '旅伴'], ['settings', '設定']];
  return `<nav class="tabbar">${tabs.map(([k, n]) =>
    `<button data-action="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}" aria-current="${ui.tab === k}"><i class="ic ic-${k}"></i>${n}</button>`
  ).join('')}</nav>`;
}

function viewOnboard() {
  return `<section class="onboard">
    <div class="buddy-hero bounce">${companionSVG(1, 'happy')}</div>
    <div class="bubble big">${line({ jp: 'はじめまして！ぼくは たびまる。', ro: 'hajimemashite! boku wa tabimaru.', zh: '初次見面！我是旅丸。' })}</div>
    <p class="lead">我會陪你從五十音開始，一路學到能在日本開口說話。每天 5 分鐘，我們先搭上飛往福岡的飛機。</p>
    <p class="hint-text">日文都會附上羅馬拼音，點 <i class="ic ic-sound inline"></i> 可以聽發音。</p>
    <button class="btn primary wide" data-action="onboard-go">出發</button>
  </section>`;
}

function stationState(i) {
  const lv = content.levels[i];
  if (state.levels[lv.id]?.done) return 'done';
  if (i === 0 || state.levels[content.levels[i - 1].id]?.done) return 'open';
  return 'locked';
}

function viewHome() {
  const ci = companionInfo();
  const streak = streakAlive(state);
  const nextIdx = content.levels.findIndex((_, i) => stationState(i) === 'open');
  const dueN = reviewLeftToday(state, content);
  const bubble = ui.bubble || (streak ? { jp: 'きょうも いっしょに！', ro: 'kyou mo issho ni!', zh: '今天也一起加油！' } : LINES[1]);

  const stations = content.levels.map((lv, i) => {
    const st = stationState(i);
    const rec = state.levels[lv.id];
    return `<li class="station ${st}">
      <button class="station-btn" data-action="${st === 'locked' ? 'locked' : 'play'}" data-i="${i}" ${st === 'locked' ? 'aria-disabled="true"' : ''}>
        <span class="stop">${st === 'done' ? `<span class="mini-stamp">${esc(lv.sub.slice(0, 1))}</span>` : i + 1}</span>
        <span class="st-text"><b>${esc(lv.title)}</b><small>${esc(lv.sub)}${rec?.done ? `・最佳 ${rec.best}%` : ''}</small></span>
        <span class="st-go">${st === 'locked' ? '未開放' : st === 'done' ? '再玩' : '出發'}</span>
      </button></li>`;
  }).join('');

  return `
    <header class="top">
      <div class="streak ${streak ? 'on' : ''}"><i class="ic ic-fire"></i><b>${streak}</b> 天連續</div>
      <div class="coins"><i class="ic ic-coin"></i>${state.profile.coins}</div>
    </header>
    <section class="home-buddy" data-action="buddy-talk">
      <div class="bubble">${line(bubble)}</div>
      <div class="buddy-sm bounce">${companionSVG(ci.stage, ui.mood)}</div>
      <div class="buddy-meta"><b>${esc(state.companion.name)}</b> Lv.${ci.lv}
        <div class="bar"><i style="width:${Math.round(ci.pct * 100)}%"></i></div></div>
    </section>
    <section class="cta">
      ${nextIdx >= 0
        ? `<button class="btn primary wide" data-action="play" data-i="${nextIdx}">繼續旅程：${esc(content.levels[nextIdx].title)}<small>${esc(content.levels[nextIdx].sub)}</small></button>`
        : `<div class="done-note">序章全部完成！第 1 章「福岡」製作中。</div>`}
      ${dueN ? `<button class="btn review wide" data-action="review">今日複習 <b>${dueN}</b> 題</button>` : ''}
    </section>
    <section class="route">
      <h2>${esc(content.title)}</h2>
      <ol class="line-map">${stations}
        <li class="station locked future"><span class="station-btn"><span class="stop">→</span>
          <span class="st-text"><b>第 1 章　福岡</b><small>問路、買車票、搭地鐵（製作中）</small></span></span></li>
      </ol>
    </section>`;
}

function stampHTML(it, extra = '') {
  const rec = state.items[it.id];
  const s = itemStatus(rec);
  const tier = s === 'mastered' ? 'gold' : s === 'learning' ? (rec.box >= 3 ? 'mid' : 'low') : 'empty';
  return `<button class="stamp ${tier} ${it.type} ${extra}" data-action="sheet" data-id="${it.id}" aria-label="${esc(it.jp)}">
    <span class="jp">${esc(it.jp)}</span>${it.type === 'kana' ? ro(it.ro) : ''}</button>`;
}

function viewBook() {
  const c = progressCounts(state, content);
  const kana = content.items.filter(it => it.type === 'kana');
  const phrases = content.items.filter(it => it.type === 'phrase');
  return `
    <header class="top"><h1>旅の手帳</h1></header>
    <section class="level-card">
      <div><b>${c.mastered}</b><span>已掌握</span></div>
      <div><b>${c.learning}</b><span>學習中</span></div>
      <div><b>${c.fresh}</b><span>還沒學</span></div>
    </section>
    <p class="hint-text">每學會一個就蓋一個印章。答對越多次，印章顏色越深；連續答對到最後一盒會變成金色。</p>
    <h2>平假名</h2>
    <div class="stamp-grid">${kana.map(it => stampHTML(it)).join('')}</div>
    <h2>旅遊招呼語</h2>
    <div class="phrase-list">${phrases.map(it => {
      const s = itemStatus(state.items[it.id]);
      return `<button class="phrase-row ${s}" data-action="sheet" data-id="${it.id}">
        <span><span class="jp">${esc(it.jp)}</span>${ro(it.ro)}</span><small>${s === 'new' ? '未學' : esc(it.zh)}</small></button>`;
    }).join('')}</div>`;
}

function viewSheet() {
  const it = byId(ui.sheet);
  const rec = state.items[it.id];
  const s = itemStatus(rec);
  const status = s === 'new' ? '還沒學' : s === 'mastered' ? '已掌握' : `學習中・第 ${rec.box} 盒`;
  const next = rec && !rec.mastered ? `・下次複習 ${rec.due.slice(5).replace('-', '/')}` : '';
  return `<div class="scrim" data-action="close-sheet"></div>
    <aside class="sheet" role="dialog" aria-label="${esc(it.jp)}">
      <button class="x" data-action="close-sheet" aria-label="關閉">×</button>
      ${introBody(it, s === 'new')}
      <p class="status">${status}${next}</p>
    </aside>`;
}

function viewBuddy() {
  const ci = companionInfo();
  const nextStage = ci.lv < 3 ? 'Lv.3 解鎖：旅行斗笠' : ci.lv < 5 ? 'Lv.5 解鎖：圍巾和小背包' : '已經整裝完畢，準備好出發了！';
  return `
    <header class="top"><h1>旅伴</h1><div class="coins"><i class="ic ic-coin"></i>${state.profile.coins}</div></header>
    <section class="buddy-big" data-action="buddy-talk">
      ${ui.bubble ? `<div class="bubble">${line(ui.bubble)}</div>` : ''}
      <div class="bounce">${companionSVG(ci.stage, ui.mood)}</div>
    </section>
    <section class="buddy-card">
      <div class="row"><b class="name jp">${esc(state.companion.name)}</b><span>Lv.${ci.lv}・${STAGE_NAMES[ci.stage]}</span></div>
      <div class="bar big"><i style="width:${Math.round(ci.pct * 100)}%"></i></div>
      <p class="hint-text">${ci.next ? `經驗 ${state.companion.exp} / ${ci.next}` : `經驗 ${state.companion.exp}`}　${nextStage}</p>
    </section>
    <h2>買點心給たびまる</h2>
    <p class="hint-text">用學習賺到的旅費買點心，たびまる吃了會長大。</p>
    <div class="snacks">${SNACKS.map(s => `
      <button class="snack" data-action="feed" data-id="${s.id}" ${state.profile.coins < s.price ? 'disabled' : ''}>
        <span class="jp">${esc(s.jp)}</span>${ro(s.ro)}<small>${esc(s.zh)}・經驗 +${s.exp}</small>
        <b><i class="ic ic-coin"></i>${s.price}</b></button>`).join('')}</div>`;
}

function viewSettings() {
  const st = state.settings;
  const toggle = (key, label, desc) => `
    <label class="setting"><span><b>${label}</b><small>${desc}</small></span>
      <input type="checkbox" data-action="toggle" data-key="${key}" ${st[key] ? 'checked' : ''}><i class="sw"></i></label>`;
  const ttsNote = !speech.supported()
    ? '這個瀏覽器不支援語音朗讀。'
    : speech.hasJapanese()
      ? '已找到日文語音。'
      : '還沒找到日文語音。iPhone 可到「設定 › 輔助使用 › 朗讀內容 › 聲音 › 日文」下載語音。';
  return `
    <header class="top"><h1>設定</h1></header>
    <section class="settings">
      ${toggle('romaji', '顯示羅馬拼音', '日文下方顯示拼音。考試題目本身不會先顯示。')}
      ${toggle('slow', '慢速發音', '聽不清楚時打開。')}
      ${toggle('autoplay', '自動播放發音', '出現新的字和答完題時自動唸一次。')}
      ${toggle('sound', '答題音效', '答對、答錯的提示音。')}
      <p class="hint-text">${ttsNote}<button class="link" data-action="test-voice">試聽</button></p>
    </section>
    <h2>進度備份</h2>
    <section class="settings">
      <p class="hint-text">進度存在這支手機的瀏覽器裡。換手機前先匯出，到新手機再匯入。</p>
      <button class="btn ghost wide" data-action="export">匯出進度檔</button>
      <label class="btn ghost wide file">匯入進度檔<input type="file" accept="application/json,.json" data-action="import"></label>
      <button class="btn danger wide" data-action="reset">清除所有進度</button>
    </section>
    <h2>關於</h2>
    <section class="settings about">
      <p>旅伴日語 Tabitomo・序章原型 v0.1</p>
      <p class="hint-text">序章的假名、例字與會話句由 Claude 以日語教師角度編寫並審稿；字源與注音近似音僅供記憶參考，發音以語音為準。第 1 章起單字將改用 JMdict、例句使用 Tatoeba（皆依授權標示出處）。</p>
    </section>`;
}

// ---------- 學習內容卡 ----------
function introBody(it, isNew) {
  if (it.type === 'kana') {
    return `<div class="intro kana">
      ${isNew ? '<p class="tag">新的假名</p>' : ''}
      <button class="giant jp" data-action="say" data-text="${esc(it.jp)}" aria-label="播放 ${esc(it.jp)}">${esc(it.jp)}</button>
      <div class="reading"><span class="ro strong">${esc(it.ro)}</span><span class="zy">注音近似 ${esc(it.zy)}</span></div>
      <p class="origin">字源：從漢字「${esc(it.origin)}」的草書變來</p>
      ${it.tip ? `<p class="tip">${esc(it.tip)}</p>` : ''}
      <button class="example" data-action="say" data-text="${esc(it.ex.jp)}">
        <i class="ic ic-sound"></i><span class="jp">${esc(it.ex.jp)}</span>${ro(it.ex.ro)}<span class="zh">${esc(it.ex.zh)}</span></button>
    </div>`;
  }
  return `<div class="intro phrase">
    ${isNew ? '<p class="tag">新的會話句</p>' : ''}
    <button class="phrase-big jp" data-action="say" data-text="${esc(it.jp)}">${esc(it.jp)}</button>
    <div class="reading"><span class="ro strong">${esc(it.ro)}</span></div>
    <p class="zh-big">${esc(it.zh)}</p>
    ${it.tip ? `<p class="tip">${esc(it.tip)}</p>` : ''}
    <div class="play-row">
      <button class="btn ghost" data-action="say" data-text="${esc(it.jp)}"><i class="ic ic-sound"></i>播放</button>
      <button class="btn ghost" data-action="say-slow" data-text="${esc(it.jp)}">慢速</button>
    </div>
  </div>`;
}

// ---------- 關卡進行 ----------
function startSession(plan) {
  if (!plan.steps.length) { toast('今天沒有需要複習的題目了'); return; }
  session = { ...plan, idx: 0, stats: {}, logs: [], right: 0, total: 0, answered: false, t0: performance.now(), retries: {} };
  ui.overlay = 'session';
  ui.sheet = null;
  render();
  autoSpeakStep();
}

function curStep() { return session.steps[session.idx]; }

function autoSpeakStep() {
  if (!state.settings.autoplay) return;
  const st = curStep();
  if (!st) return;
  if (st.type === 'intro') say(st.item.jp);
  else if (st.type === 'q' && /listen/.test(st.q.kind)) say(st.q.item.jp);
  else if (st.type === 'spell') say(st.s.word.jp);
  else if (st.type === 'story' && st.scene.jp) say(st.scene.jp);
}

function viewSession() {
  const st = curStep();
  const pct = Math.round((session.idx / session.steps.length) * 100);
  let body = '';
  if (st.type === 'banner') body = viewBanner(st);
  else if (st.type === 'intro') body = `${introBody(st.item, true)}<div class="foot"><button class="btn primary wide" data-action="next">記住了</button></div>`;
  else if (st.type === 'q') body = viewQuestion(st);
  else if (st.type === 'spell') body = viewSpell(st);
  else if (st.type === 'story') body = viewStory(st);
  return `<section class="session">
    <header class="session-top">
      <button class="x" data-action="quit" aria-label="離開">×</button>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    </header>
    <div class="step step-${st.type}">${body}</div>
  </section>`;
}

function viewBanner(st) {
  const ci = companionInfo();
  return `<div class="banner">
    <div class="buddy-sm bounce">${companionSVG(ci.stage, 'happy')}</div>
    <h2>${esc(st.text)}</h2><p>${esc(st.sub)}</p>
  </div>
  <div class="foot"><button class="btn primary wide" data-action="next">開始</button></div>`;
}

const PROMPTS = {
  'kana-read': '這個假名怎麼唸？',
  'kana-listen': '聽到的是哪一個？',
  'phrase-listen': '這句話是什麼意思？',
  'phrase-read': '這句話是什麼意思？',
};

function viewQuestion(st) {
  const { q } = st;
  const it = q.item;
  const done = session.answered;
  let prompt = '';
  if (q.kind === 'kana-read') {
    prompt = `<div class="q-kana jp">${esc(it.jp)}</div>`;
  } else if (q.kind === 'kana-listen' || q.kind === 'phrase-listen') {
    prompt = `<button class="listen" data-action="say" data-text="${esc(it.jp)}" aria-label="再聽一次"><i class="ic ic-sound"></i></button>
      <button class="link" data-action="say-slow" data-text="${esc(it.jp)}">慢速再聽</button>
      ${q.kind === 'phrase-listen' && (st.hint || done) ? `<div class="reveal"><span class="jp">${esc(it.jp)}</span>${ro(it.ro)}</div>` : ''}`;
  } else if (q.kind === 'phrase-read') {
    prompt = `<button class="q-phrase jp" data-action="say" data-text="${esc(it.jp)}">${esc(it.jp)}</button>${ro(it.ro)}`;
  }
  const showSub = q.kind === 'kana-listen' && (st.hint || done);
  const opts = q.options.map((o, i) => {
    let cls = '';
    if (done) cls = i === q.answer ? 'right' : i === st.picked ? 'wrong' : 'dim';
    return `<button class="opt ${o.jp ? 'jp' : ''} ${cls}" data-action="opt" data-i="${i}" ${done ? 'disabled' : ''}>
      <span>${esc(o.label)}</span>${showSub && o.sub ? `<small class="ro">${esc(o.sub)}</small>` : ''}</button>`;
  }).join('');
  const canHint = !done && !st.hint && q.kind !== 'phrase-read';
  return `
    ${st.review ? '<p class="tag soft">複習</p>' : st.retry ? '<p class="tag soft">再試一次</p>' : ''}
    <p class="ask">${PROMPTS[q.kind]}</p>
    <div class="prompt">${prompt}</div>
    <div class="opts ${q.options.length === 4 ? 'grid' : ''}">${opts}</div>
    ${canHint ? `<button class="link hint" data-action="hint">給我提示</button>` : ''}
    ${done ? feedback(st.correct, answerDetail(it)) : ''}`;
}

function answerDetail(it) {
  return `<button class="ans" data-action="say" data-text="${esc(it.jp)}"><i class="ic ic-sound"></i>
    <span class="jp">${esc(it.jp)}</span>${ro(it.ro)}<span class="zh">${esc(it.type === 'kana' ? `注音近似 ${it.zy}` : it.zh)}</span></button>`;
}

function feedback(ok, detail, retryNote = true) {
  const ci = companionInfo();
  const l = ok ? pick(CHEERS) : COMFORT;
  return `<div class="feedback ${ok ? 'ok' : 'ng'}">
    <div class="fb-head"><div class="buddy-xs">${companionSVG(ci.stage, ok ? 'happy' : 'think')}</div>
      <div>${line(l)}${ok || !retryNote ? '' : '<p class="zh small">這題等一下會再出現一次。</p>'}</div></div>
    ${detail}
    <button class="btn primary wide" data-action="next">繼續</button>
  </div>`;
}

function viewSpell(st) {
  const { s } = st;
  const filled = st.filled || [];
  const done = session.answered;
  const slots = s.chars.map((_, i) => `<span class="slot ${filled[i] != null ? 'full' : ''}">${filled[i] != null ? esc(s.tiles[filled[i]]) : ''}</span>`).join('');
  const tiles = s.tiles.map((t, i) => `<button class="tile jp" data-action="tile" data-i="${i}" ${filled.includes(i) || done ? 'disabled' : ''}>${esc(t)}</button>`).join('');
  return `
    <p class="ask">聽發音，用假名拼出來</p>
    <div class="prompt">
      <button class="listen" data-action="say" data-text="${esc(s.word.jp)}" aria-label="再聽一次"><i class="ic ic-sound"></i></button>
      <p class="zh-big">${esc(s.word.zh)}</p>
      ${st.hint || done ? ro(s.word.ro) : ''}
    </div>
    <div class="slots jp">${slots}</div>
    <div class="tiles">${tiles}</div>
    ${!done ? `<div class="row-btns">
      ${filled.length ? '<button class="link" data-action="undo">退一格</button>' : ''}
      ${!st.hint ? '<button class="link hint" data-action="hint">給我提示</button>' : ''}</div>` : ''}
    ${done ? feedback(st.correct, `<button class="ans" data-action="say" data-text="${esc(s.word.jp)}"><i class="ic ic-sound"></i>
      <span class="jp">${esc(s.word.jp)}</span>${ro(s.word.ro)}<span class="zh">${esc(s.word.zh)}</span></button>`, false) : ''}`;
}

function viewStory(st) {
  const sc = st.scene;
  const done = session.answered;
  const opts = sc.choices.map((c, i) => {
    let cls = '';
    if (done) cls = i === sc.answer ? 'right' : i === st.picked ? 'wrong' : 'dim';
    return `<button class="opt ${/[ぁ-んァ-ン]/.test(c) ? 'jp' : ''} ${cls}" data-action="opt" data-i="${i}" ${done ? 'disabled' : ''}><span>${esc(c)}</span></button>`;
  }).join('');
  return `
    ${st.first ? '<p class="tag">劇情挑戰</p>' : ''}
    <div class="scene"><p>${esc(sc.scene)}</p>
      ${sc.jp ? `<button class="speech" data-action="say" data-text="${esc(sc.jp)}">
        ${sc.speaker ? `<small>${esc(sc.speaker)}</small>` : ''}<span class="jp">${esc(sc.jp)}</span>${ro(sc.ro)}</button>` : ''}
    </div>
    <p class="ask">${esc(sc.ask)}</p>
    <div class="opts">${opts}</div>
    ${done ? feedback(st.correct, `<p class="explain">${esc(sc.explain)}</p>`, false) : ''}`;
}

function record(itemId, kind, ok, extra = {}) {
  session.logs.push({ item: itemId, kind, ok, ms: Math.round(performance.now() - session.t0), ts: Date.now(), level: session.level.id, ...extra });
}

function answerQuestion(i) {
  const st = curStep();
  if (session.answered) return;
  const { q } = st;
  const ok = i === q.answer;
  st.picked = i;
  st.correct = ok;
  session.answered = true;
  const s = session.stats[q.itemId] || (session.stats[q.itemId] = { wrong: false, hint: false });
  if (!ok) s.wrong = true;
  if (st.hint) s.hint = true;
  if (!st.retry) { session.total++; if (ok && !st.hint) session.right++; }
  record(q.itemId, q.kind, ok, { hint: !!st.hint, retry: !!st.retry });
  if (!ok) queueRetry(st);
  ok ? sfx.correct() : sfx.wrong();
  render();
  if (state.settings.autoplay) say(q.item.jp);
}

function queueRetry(st) {
  const key = st.q.itemId + st.q.kind;
  session.retries[key] = (session.retries[key] || 0) + 1;
  if (session.retries[key] > 2) return;
  const fresh = makeQuestion(st.q.kind, st.q.item, session.pool.length >= 4 ? session.pool : content.items);
  let at = session.steps.findIndex((x, j) => j > session.idx && x.type === 'story');
  if (at < 0) at = session.steps.length;
  session.steps.splice(at, 0, { type: 'q', q: fresh, retry: true });
}

function answerStory(i) {
  const st = curStep();
  if (session.answered) return;
  const ok = i === st.scene.answer;
  st.picked = i;
  st.correct = ok;
  session.answered = true;
  session.total++;
  if (ok) session.right++;
  record('story', 'story', ok);
  ok ? sfx.correct() : sfx.wrong();
  render();
}

function tapTile(i) {
  const st = curStep();
  if (session.answered) return;
  st.filled = st.filled || [];
  if (st.filled.includes(i)) return;
  st.filled.push(i);
  if (st.filled.length === st.s.chars.length) {
    const word = st.filled.map(k => st.s.tiles[k]).join('');
    const ok = word === st.s.word.jp;
    st.correct = ok;
    session.answered = true;
    session.total++;
    if (ok && !st.hint) session.right++;
    record('word:' + st.s.word.jp, 'spell', ok, { hint: !!st.hint });
    ok ? sfx.correct() : sfx.wrong();
    render();
    if (state.settings.autoplay) say(st.s.word.jp);
    return;
  }
  render();
}

function nextStep() {
  session.idx++;
  session.answered = false;
  session.t0 = performance.now();
  if (session.idx >= session.steps.length) { finishSession(); return; }
  render();
  autoSpeakStep();
}

function finishSession() {
  const date = today();
  const before = companionInfo();
  const firstToday = state.profile.lastPlay !== date;
  const newly = [];
  Object.entries(session.stats).forEach(([id, s]) => {
    if (!state.items[id]) newly.push(id);
    applyResult(state, id, s.wrong ? 'wrong' : s.hint ? 'hint' : 'right', date);
  });

  const acc = session.total ? Math.round((session.right / session.total) * 100) : 100;
  let coins = session.right * (session.mode === 'review' ? 3 : 5);
  let exp = 0;
  if (session.mode === 'level') {
    const rec = state.levels[session.level.id] || { done: false, plays: 0, best: 0 };
    const firstClear = !rec.done;
    coins += firstClear ? 20 : 10;
    exp += firstClear ? 30 : 10;
    state.levels[session.level.id] = { done: true, plays: rec.plays + 1, best: Math.max(rec.best, acc) };
  } else {
    exp += 10;
    if (state.profile.reviewDay !== date) { state.profile.reviewDay = date; state.profile.reviewCount = 0; }
    state.profile.reviewCount += Object.keys(session.stats).length;
  }
  if (firstToday) exp += 10;
  const { usedFreeze } = touchStreak(state, date);
  state.profile.coins += coins;
  state.companion.exp += exp;
  const after = companionInfo();

  session.result = { acc, coins, exp, newly, usedFreeze, firstToday, lvUp: after.lv > before.lv, stageUp: after.stage > before.stage, after };
  save();
  addLogs(session.logs);
  ui.overlay = 'result';
  ui.bubble = null;
  render();
  sfx.fanfare();
}

function viewResult() {
  const r = session.result;
  const ci = r.after;
  const isLevel = session.mode === 'level';
  const nextIdx = isLevel ? session.levelIdx + 1 : -1;
  const hasNext = isLevel && nextIdx < content.levels.length;
  const newStamps = r.newly.map(byId).filter(Boolean);
  return `<section class="result">
    <h1>${isLevel ? `「${esc(session.level.title)}」完成！` : '今日複習完成！'}</h1>
    <div class="buddy-hero bounce">${companionSVG(ci.stage, 'happy')}</div>
    ${r.stageUp ? `<div class="levelup">${line({ jp: 'みて！あたらしい すがた！', ro: 'mite! atarashii sugata!', zh: '你看！我換新造型了！' })}<p>たびまる升到 Lv.${ci.lv}，解鎖「${STAGE_NAMES[ci.stage]}」</p></div>`
      : r.lvUp ? `<div class="levelup"><p>たびまる升到 Lv.${ci.lv}！</p></div>` : ''}
    <div class="stats">
      <div><b>${r.acc}%</b><span>答對率</span></div>
      <div><b>+${r.coins}</b><span>旅費</span></div>
      <div><b>+${r.exp}</b><span>旅伴經驗</span></div>
      <div><b>${state.profile.streak}</b><span>天連續</span></div>
    </div>
    ${r.usedFreeze ? '<p class="hint-text">昨天沒玩，自動用掉一張補票，連續天數保住了。</p>' : ''}
    ${newStamps.length ? `<h2>手帳新蓋的章</h2><div class="stamp-grid result-stamps">${newStamps.map((it, i) =>
      `<span class="stamp-in" style="animation-delay:${0.25 + i * 0.18}s">${stampHTML(it)}</span>`).join('')}</div>` : ''}
    <div class="foot col">
      ${hasNext ? `<button class="btn primary wide" data-action="play" data-i="${nextIdx}">下一站：${esc(content.levels[nextIdx].title)}</button>` : ''}
      <button class="btn ${hasNext ? 'ghost' : 'primary'} wide" data-action="home">回到旅程</button>
    </div>
  </section>`;
}

// ---------- 旅伴互動 ----------
function buddyTalk() {
  const l = pick(LINES.filter(x => x !== ui.bubble));
  ui.bubble = l;
  ui.mood = 'happy';
  render();
  say(l.jp);
  clearTimeout(buddyTalk.t);
  buddyTalk.t = setTimeout(() => { ui.mood = 'idle'; render(); }, 1600);
}

function feed(id) {
  const s = SNACKS.find(x => x.id === id);
  if (!s || state.profile.coins < s.price) return;
  const before = companionInfo();
  state.profile.coins -= s.price;
  state.companion.exp += s.exp;
  state.companion.fed += 1;
  const after = companionInfo();
  ui.bubble = { jp: `${s.jp}、おいしい！`, ro: `${s.ro}, oishii!`, zh: `${s.zh}好好吃！` };
  ui.mood = 'happy';
  save();
  sfx.correct();
  say(ui.bubble.jp);
  if (after.stage > before.stage) toast(`たびまる長大了！解鎖「${STAGE_NAMES[after.stage]}」`);
  else if (after.lv > before.lv) toast(`たびまる升到 Lv.${after.lv}！`);
  else render();
}

// ---------- 備份 ----------
async function exportData() {
  const data = { app: 'tabitomo', exportedAt: new Date().toISOString(), state, logs: await allLogs() };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tabitomo-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('已匯出進度檔');
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'tabitomo' || !data.state || data.state.v !== 1) throw new Error('format');
    if (!confirm('匯入會覆蓋目前這支手機上的進度，確定嗎？')) return;
    state = data.state;
    await saveState(state);
    if (Array.isArray(data.logs)) await addLogs(data.logs);
    sfx.enabled = state.settings.sound;
    toast('進度已匯入');
  } catch (e) {
    toast('這個檔案不是旅伴日語的進度檔');
  }
}

// ---------- 事件 ----------
app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'INPUT') return;
  const a = el.dataset.action;
  const i = Number(el.dataset.i);
  switch (a) {
    case 'tab': ui.tab = el.dataset.tab; ui.sheet = null; ui.bubble = null; render(); window.scrollTo(0, 0); break;
    case 'onboard-go': state.onboarded = true; save(); startSession(buildLevel(state, content, 0)); break;
    case 'play': startSession(buildLevel(state, content, i)); break;
    case 'review': startSession(buildReview(state, content)); break;
    case 'locked': toast('先完成前一站才能前往'); break;
    case 'home': session = null; ui.overlay = null; ui.tab = 'home'; render(); window.scrollTo(0, 0); break;
    case 'quit':
      if (confirm('現在離開，這一關的進度不會保存。確定離開嗎？')) { window.speechSynthesis?.cancel(); session = null; ui.overlay = null; render(); }
      break;
    case 'next': nextStep(); break;
    case 'say': say(el.dataset.text); break;
    case 'say-slow': say(el.dataset.text, { slow: true }); break;
    case 'opt': curStep().type === 'story' ? answerStory(i) : answerQuestion(i); break;
    case 'hint': {
      const st = curStep();
      st.hint = true;
      if (st.type === 'q' && st.q.kind === 'kana-read') say(st.q.item.jp);
      render();
      break;
    }
    case 'tile': tapTile(i); break;
    case 'undo': curStep().filled?.pop(); render(); break;
    case 'sheet': ui.sheet = el.dataset.id; render(); if (state.items[ui.sheet] && state.settings.autoplay) say(byId(ui.sheet).jp); break;
    case 'close-sheet': ui.sheet = null; render(); break;
    case 'buddy-talk': buddyTalk(); break;
    case 'feed': feed(el.dataset.id); break;
    case 'test-voice': say('こんにちは。いっしょに がんばろう！'); break;
    case 'export': exportData(); break;
    case 'reset':
      if (confirm('所有進度、旅費和たびまる的成長都會清除，無法復原。確定嗎？')) {
        clearAll().then(() => { state = newState(); session = null; ui.overlay = 'onboard'; ui.tab = 'home'; render(); });
      }
      break;
  }
});

app.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.action === 'toggle') {
    state.settings[el.dataset.key] = el.checked;
    sfx.enabled = state.settings.sound;
    save();
    render();
  } else if (el.dataset.action === 'import' && el.files[0]) {
    importData(el.files[0]);
  }
});

document.addEventListener('keydown', e => {
  if (ui.overlay !== 'session') return;
  if ((e.key === 'Enter' || e.key === ' ') && (session.answered || ['banner', 'intro'].includes(curStep().type)) && !e.target.closest('button')) {
    e.preventDefault();
    nextStep();
  } else if (/^[1-4]$/.test(e.key) && !session.answered && ['q', 'story'].includes(curStep().type)) {
    const k = Number(e.key) - 1;
    const st = curStep();
    const n = st.type === 'story' ? st.scene.choices.length : st.q.options.length;
    if (k < n) st.type === 'story' ? answerStory(k) : answerQuestion(k);
  }
});

boot();
