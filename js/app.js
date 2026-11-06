import { loadState, saveState, addLogs, allLogs, clearAll, requestPersist } from './store.js';
import { speech, sfx } from './audio.js';
import { plantSVG, PLANTS, plantById } from './plants.js';
import { MASCOTS, mascotById, mascotImg, mascotLine, homeMood } from './mascot.js';
import {
  today, newState, applyResult, itemStatus, progressCounts, buildLevel, buildReview, reviewLeftToday,
  makeQuestion, buildFlash, flashCounts, FLASH_SECONDS, growthLevel, growthStage, STAGE_LV, CARE, LINES, CHEERS, COMFORT, touchStreak, streakAlive,
} from './engine.js';

const app = document.getElementById('app');
let content = null;
let state = null;
let session = null;
let travel = null; // 福岡會話題庫（data/travel.json）
let rp = null;     // 情境模擬進行中的狀態
let words = null;  // 單字快閃題庫（data/words.json）
let flashTimer = 0;
const ui = { tab: 'home', overlay: null, sheet: null, bubble: null, sway: false, toast: null, scene: null, show: null, mood: null, hop: false };

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

// 目前在種的植物
function plantInfo(id = state.garden.active) {
  const exp = state.garden.plants[id]?.exp || 0;
  const g = growthLevel(exp);
  return { id, exp, ...g, stage: growthStage(g.lv), def: plantById(id) };
}
const learnedCount = () => Object.keys(state.items).length;
function drawPlant(info = plantInfo()) {
  return plantSVG(info.id, info.stage, { blooms: learnedCount() });
}

// ---------- 吉祥物 ----------
const mascot = () => mascotById(state.settings.mascot);
function mascotHTML(mood, cls = '') {
  const m = mascot();
  if (!m) return '';
  return `<img class="mascot ${cls}" src="${mascotImg(m.id, mood)}" alt="${esc(m.zh)}${esc(m.name)}" width="120" height="120" decoding="async">`;
}
function mascotSay(l) {
  const m = mascot();
  if (!m || !l) return;
  speech.mascot(m.id, l.jp);
}
function hopOnce() {
  ui.hop = true;
  clearTimeout(hopOnce.t);
  hopOnce.t = setTimeout(() => { ui.hop = false; render(); }, 700);
}
function mascotTap() {
  const m = mascot();
  if (!m) return;
  const base = homeMood(state.profile.lastPlay === today());
  // 還沒學的日子：提醒和閒聊輪流；其他時候照當下心情
  const mood = base === 'alert' ? (ui.mood === 'alert' ? 'idle' : 'alert') : base;
  const l = mascotLine(m.id, mood, ui.bubble);
  ui.mood = mood;
  ui.bubble = l;
  hopOnce();
  render();
  mascotSay(l);
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
  try { travel = await (await fetch('data/travel.json', { cache: 'no-cache' })).json(); } catch (e) { travel = null; }
  try { words = await (await fetch('data/words.json', { cache: 'no-cache' })).json(); } catch (e) { words = null; }
  state = (await loadState()) || newState();
  const base = newState();
  state.settings = { ...base.settings, ...state.settings };
  state.profile = { ...base.profile, ...state.profile };
  state.talk = { done: {}, ...state.talk };
  if (!state.garden) {
    // 舊存檔：吉祥物的經驗轉給櫻花樹
    state.garden = { ...base.garden, plants: { sakura: { exp: state.companion?.exp || 0 } } };
    delete state.companion;
  }
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
  else if (ui.overlay === 'rp') html = viewRoleplay();
  else {
    html = `<main class="page page-${ui.tab}">${
      ui.tab === 'home' ? viewHome() : ui.tab === 'book' ? viewBook() : ui.tab === 'talk' ? viewTalk()
        : ui.tab === 'garden' ? viewGarden() : viewSettings()
    }</main>${viewNav()}${ui.sheet ? viewSheet() : ''}${ui.show ? viewShow() : ''}`;
  }
  if (ui.toast) html += `<div class="toast" role="status">${esc(ui.toast)}</div>`;
  app.innerHTML = html;
}

function viewNav() {
  const tabs = [['home', '旅程'], ['book', '手帳'], ['talk', '會話'], ['garden', '植物'], ['settings', '設定']];
  return `<nav class="tabbar">${tabs.map(([k, n]) =>
    `<button data-action="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}" aria-current="${ui.tab === k}"><i class="ic ic-${k}"></i>${n}</button>`
  ).join('')}</nav>`;
}

function viewOnboard() {
  return `<section class="onboard">
    <div class="plant-hero">${plantSVG('sakura', 1, { blooms: 0 })}</div>
    <div class="bubble big">${line({ jp: 'いっしょに そだてよう！', ro: 'issho ni sodateyou!', zh: '一起把它養大吧！' })}</div>
    <p class="lead">這是你的櫻花樹。每學會一個字，它就長大一點、多開一朵花。每天 5 分鐘，我們先搭上飛往福岡的飛機。</p>
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
  const pi = plantInfo();
  const streak = streakAlive(state);
  const nextIdx = content.levels.findIndex((_, i) => stationState(i) === 'open');
  const dueN = reviewLeftToday(state, content);
  const m = mascot();
  const mood = ui.mood || homeMood(state.profile.lastPlay === today());
  if (m && !ui.bubble) ui.bubble = mascotLine(m.id, mood);
  const bubble = ui.bubble || (streak ? LINES[1] : LINES[0]);

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
    <section class="home-plant ${m ? 'with-mascot' : ''}">
      <div class="bubble">${line(bubble)}</div>
      <div class="home-duo">
        <button class="plant-md plant-btn ${ui.sway ? 'sway' : ''}" data-action="plant-tap" aria-label="${esc(pi.def.zh)}">${drawPlant(pi)}</button>
        ${m ? `<button class="mascot-btn ${ui.hop ? 'hop' : ''}" data-action="mascot-tap" aria-label="和${esc(m.zh)}${esc(m.name)}說話">${mascotHTML(mood)}</button>` : ''}
      </div>
      <div class="plant-meta"><b>${esc(pi.def.zh)}</b>・${esc(pi.def.stages[pi.stage - 1])}　Lv.${pi.lv}
        <div class="bar"><i style="width:${Math.round(pi.pct * 100)}%"></i></div></div>
    </section>
    <section class="cta">
      ${nextIdx >= 0
        ? `<button class="btn primary wide" data-action="play" data-i="${nextIdx}">繼續旅程：${esc(content.levels[nextIdx].title)}<small>${esc(content.levels[nextIdx].sub)}</small></button>`
        : `<div class="done-note">序章全部完成！第 1 章「福岡」製作中。</div>`}
      ${dueN ? `<button class="btn review wide" data-action="review">今日複習 <b>${dueN}</b> 題</button>` : ''}
      ${flashCTA()}
    </section>
    <section class="route">
      <h2>${esc(content.title)}</h2>
      <ol class="line-map">${stations}
        <li class="station locked future"><span class="station-btn"><span class="stop">→</span>
          <span class="st-text"><b>第 1 章　福岡</b><small>問路、買車票、搭地鐵（製作中）</small></span></span></li>
      </ol>
    </section>`;
}

function flashCTA() {
  if (!words) return '';
  const c = flashCounts(state, words);
  const sub = c.due ? `${c.due} 個該複習・${c.fresh} 個新字` : c.fresh ? `還有 ${c.fresh} 個新字` : '全部看過了，再練一輪';
  return `<button class="btn flash-cta wide" data-action="flash"><span class="fc-emoji" aria-hidden="true">🐈</span>
    <span class="fc-text"><b>單字快閃・5 題</b><small>${esc(sub)}</small></span><span class="fc-go">GO</span></button>`;
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

function viewGarden() {
  const pi = plantInfo();
  const nextLv = STAGE_LV[pi.stage + 1];
  const nextNote = nextLv ? `Lv.${nextLv} 進入「${pi.def.stages[pi.stage]}」` : '已經長到最大了！';
  const cards = PLANTS.map(p => {
    const owned = !!state.garden.plants[p.id];
    const info = owned ? plantInfo(p.id) : null;
    const active = state.garden.active === p.id;
    const btn = active ? '<span class="pill on">種植中</span>'
      : owned ? `<button class="pill" data-action="plant-use" data-id="${p.id}">換這盆</button>`
      : `<button class="pill buy" data-action="plant-buy" data-id="${p.id}" ${state.profile.coins < p.price ? 'disabled' : ''}><i class="ic ic-coin"></i>${p.price}</button>`;
    return `<div class="plant-card ${active ? 'on' : ''} ${owned ? '' : 'locked'}">
      <div class="plant-thumb">${plantSVG(p.id, owned ? info.stage : 4, { blooms: owned ? learnedCount() : 30 })}</div>
      <b>${esc(p.zh)}</b><span class="jp small-jp">${esc(p.jp)}</span>${ro(p.ro)}
      <small>${owned ? `Lv.${info.lv}・${esc(p.stages[info.stage - 1])}` : esc(p.note)}</small>
      ${btn}</div>`;
  }).join('');
  return `
    <header class="top"><h1>植物</h1><div class="coins"><i class="ic ic-coin"></i>${state.profile.coins}</div></header>
    <section class="plant-stage" data-action="plant-tap">
      ${ui.bubble ? `<div class="bubble">${line(ui.bubble)}</div>` : ''}
      <div class="plant-lg ${ui.sway ? 'sway' : ''}">${drawPlant(pi)}</div>
    </section>
    <section class="plant-info">
      <div class="row"><b class="name">${esc(pi.def.zh)}　<span class="jp">${esc(pi.def.jp)}</span></b><span>Lv.${pi.lv}・${esc(pi.def.stages[pi.stage - 1])}</span></div>
      <div class="bar big"><i style="width:${Math.round(pi.pct * 100)}%"></i></div>
      <p class="hint-text">${pi.next ? `成長值 ${pi.exp} / ${pi.next}` : `成長值 ${pi.exp}`}　${nextNote}</p>
      ${pi.id === 'sakura' ? `<p class="hint-text">已經開了 ${Math.min(learnedCount(), 30)} 朵花，每一朵都是你學會的一個字。</p>` : ''}
    </section>
    <h2>照顧它</h2>
    <p class="hint-text">用學習賺到的旅費照顧植物，成長值會增加。</p>
    <div class="care">${CARE.map(c => `
      <button class="care-btn" data-action="care" data-id="${c.id}" ${state.profile.coins < c.price ? 'disabled' : ''}>
        <span class="jp">${esc(c.jp)}</span>${ro(c.ro)}<small>${esc(c.zh)}・成長 +${c.exp}</small>
        <b><i class="ic ic-coin"></i>${c.price}</b></button>`).join('')}</div>
    <h2>我的植物</h2>
    <p class="hint-text">每盆植物各自成長，換盆不會讓原本那盆的進度消失。</p>
    <div class="plant-cards">${cards}</div>`;
}

function viewSettings() {
  const st = state.settings;
  const toggle = (key, label, desc) => `
    <label class="setting"><span><b>${label}</b><small>${desc}</small></span>
      <input type="checkbox" data-action="toggle" data-key="${key}" ${st[key] ? 'checked' : ''}><i class="sw"></i></label>`;
  const ttsNote = speech.hasClips()
    ? `使用預錄真人風格語音（${esc(speech.credit())}），離線也能播放。`
    : !speech.supported()
      ? '這個瀏覽器不支援語音朗讀。'
      : speech.hasJapanese()
        ? '已找到日文語音。'
        : '還沒找到日文語音。iPhone 可到「設定 › 輔助使用 › 朗讀內容 › 聲音 › 日文」下載語音。';
  const cur = mascot();
  const pickBtn = (id, label, sub, img) => `<button class="mascot-pick ${st.mascot === id ? 'on' : ''}" data-action="mascot-set" data-id="${id}" aria-pressed="${st.mascot === id}">
      ${img ? `<img src="${img}" alt="" width="72" height="72">` : '<span class="none" aria-hidden="true">—</span>'}<b>${label}</b><small>${sub}</small></button>`;
  return `
    <header class="top"><h1>設定</h1></header>
    <h2>旅伴</h2>
    <section class="settings">
      <div class="mascot-picks">
        ${MASCOTS.map(mm => pickBtn(mm.id, `${mm.zh}・${mm.name}`, mm.ro, mascotImg(mm.id, 'idle'))).join('')}
        ${pickBtn('none', '不顯示', '只看植物', '')}
      </div>
      ${cur ? `<p class="hint-text">${esc(cur.note)}。<button class="link" data-action="mascot-test">試聽</button></p>` : ''}
    </section>
    <h2>學習</h2>
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
      ${speech.hasClips() ? `<p class="hint-text">語音：${esc(speech.credit())}（由 VOICEVOX 合成）</p>` : ''}
      ${MASCOTS.map(mm => speech.mascotCredit(mm.id) ? `<p class="hint-text">${esc(mm.zh)}${esc(mm.name)}的聲音：${esc(speech.mascotCredit(mm.id))}</p>` : '').join('')}
      <p class="hint-text">旅伴角色插畫以 AI 生成（Google Gemini）後調整。</p>
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
  flashArm();
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
  else if (st.type === 'flash') body = viewFlash(st);
  const bar = session.mode === 'flash'
    ? `<div class="dots" aria-label="第 ${st.n + 1} 題，共 ${session.steps.length} 題">${session.steps.map((x, k) =>
        `<i class="${k < session.idx || (k === session.idx && session.answered) ? 'on' : k === session.idx ? 'cur' : ''}"></i>`).join('')}</div>`
    : `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
  return `<section class="session ${session.mode === 'flash' ? 'is-flash' : ''}">
    <header class="session-top">
      <button class="x" data-action="quit" aria-label="離開">×</button>
      ${bar}
    </header>
    <div class="step step-${st.type}">${body}</div>
  </section>`;
}

function viewBanner(st) {
  const m = mascot();
  const l = m ? (st.mascotLine ||= mascotLine(m.id, 'think')) : null;
  return `<div class="banner">
    <div class="banner-duo"><div class="plant-sm">${drawPlant()}</div>${m ? `<button class="mascot-btn" data-action="mascot-say" data-mood="think">${mascotHTML('think')}</button>` : ''}</div>
    ${l ? `<div class="bubble">${line(l)}</div>` : ''}
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
  const l = ok ? pick(CHEERS) : COMFORT;
  const mk = mascot();
  return `<div class="feedback ${ok ? 'ok' : 'ng'}">
    <div class="fb-head">${mk ? `<div class="fb-mascot" aria-hidden="true">${mascotHTML(ok ? 'cheer' : 'encourage', 'pop')}</div>` : ''}<div class="mark ${mk ? 'small' : ''}" aria-hidden="true">${ok
      ? '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="5"/></svg>'
      : '<svg viewBox="0 0 40 40"><path d="M9 9 31 31M31 9 9 31" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>'}</div>
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
    <p class="hint-text center">點下面的假名會唸給你聽，可以一個一個比對</p>
    <div class="prompt">
      <button class="listen" data-action="say" data-text="${esc(s.word.jp)}" aria-label="再聽一次"><i class="ic ic-sound"></i></button>
      <div class="row-btns">
        <button class="link" data-action="say-slow" data-text="${esc(s.word.jp)}">慢速再聽</button>
        <button class="link" data-action="say-spell" data-text="${esc(s.word.jp)}">一個字一個字聽</button>
      </div>
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

// ---------- 單字快閃 ----------
// 把 text 裡第一次出現的 hl 包上 <em>（不分大小寫）
function hlText(text, hl) {
  const k = hl ? text.toLowerCase().indexOf(hl.toLowerCase()) : -1;
  if (k < 0) return esc(text);
  return `${esc(text.slice(0, k))}<em>${esc(text.slice(k, k + hl.length))}</em>${esc(text.slice(k + hl.length))}`;
}

function rubyHTML(segs) {
  return segs.map(([t, r, h]) => {
    const inner = r ? `<ruby>${esc(t)}<rt>${esc(r)}</rt></ruby>` : esc(t);
    return h ? `<em>${inner}</em>` : inner;
  }).join('');
}

function viewFlash(st) {
  const { w } = st;
  const done = session.answered;
  const left = Math.max(0, FLASH_SECONDS - (Date.now() - (st.t0 || Date.now())) / 1000);
  const opts = st.opts.map((o, i) => {
    let cls = '';
    if (done) cls = o.ok ? 'right' : i === st.picked ? 'wrong' : 'dim';
    return `<button class="fopt ${cls}" data-action="opt" data-i="${i}" ${done ? 'disabled' : ''}>
      <span class="fnum">${i + 1}</span><span class="fjp jp">${esc(o.jp)}</span><span class="fro ro">${esc(o.ro)}</span></button>`;
  }).join('');
  const head = `<p class="f-ask">${st.review ? '<span class="tag soft">複習</span>' : ''}這個用日文怎麼說？</p>
    <h1 class="f-word">${esc(w.zh)}</h1>
    <div class="f-timer ${done ? 'full' : ''}"><i style="animation-duration:${FLASH_SECONDS}s;animation-delay:${(left - FLASH_SECONDS).toFixed(2)}s"></i></div>
    <div class="f-pic ${done ? 'pop' : ''}" aria-hidden="true">${w.emoji}</div>`;
  if (!done) return `${head}<div class="fopts">${opts}</div>`;

  const e = w.ex;
  const others = st.opts.map((o, i) => (o.ok ? '' :
    `<button class="f-other ${i === st.picked ? 'picked' : ''}" data-action="say" data-text="${esc(o.jp)}">${i === st.picked ? '你選的・' : ''}<span class="jp">${esc(o.jp)}</span> ${esc(o.zh)}</button>`)).join('');
  return `${head}
    <div class="f-verdict ${st.correct ? 'ok' : 'ng'}">${st.timeout ? '時間到！答案是' : st.correct ? '答對了！' : '差一點，答案是'}
      <button class="f-ans" data-action="say" data-text="${esc(w.jp)}"><i class="ic ic-sound inline"></i><span class="jp">${esc(w.jp)}</span> ${ro(w.ro)}</button></div>
    <button class="f-sentence" data-action="say" data-text="${esc(e.jp)}" aria-label="播放例句">
      <span class="f-jp jp">${rubyHTML(e.s)}</span>
      <span class="f-line"></span>
      <span class="f-ro ro">${hlText(e.ro, e.roHl)}</span>
      <span class="f-zh">${hlText(e.zh, e.zhHl)}</span>
    </button>
    <div class="f-others">${others}</div>
    ${w.note ? `<p class="f-note">${esc(w.note)}</p>` : ''}
    <div class="foot"><button class="btn primary wide" data-action="next">${session.idx + 1 >= session.steps.length ? '看結果' : '下一個'}</button></div>`;
}

function flashArm() {
  clearTimeout(flashTimer);
  const st = session && ui.overlay === 'session' ? curStep() : null;
  if (!st || st.type !== 'flash' || session.answered) return;
  st.t0 ||= Date.now();
  const ms = FLASH_SECONDS * 1000 - (Date.now() - st.t0);
  flashTimer = setTimeout(() => {
    if (session && curStep() === st && !session.answered) answerFlash(-1);
  }, Math.max(0, ms));
}

function answerFlash(i) {
  const st = curStep();
  if (session.answered) return;
  clearTimeout(flashTimer);
  const ok = i >= 0 && !!st.opts[i].ok;
  st.picked = i;
  st.correct = ok;
  st.timeout = i < 0;
  session.answered = true;
  const s = session.stats[st.w.id] || (session.stats[st.w.id] = { wrong: false, hint: false });
  if (!ok) s.wrong = true;
  session.total++;
  if (ok) session.right++;
  record(st.w.id, st.timeout ? 'flash-timeout' : 'flash', ok);
  ok ? sfx.correct() : sfx.wrong();
  render();
  if (state.settings.autoplay) say(st.w.ex.jp);
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
  if (!(st.filled || []).includes(i)) say(st.s.tiles[i]); // 點了就唸，邊拼邊比對
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
  clearTimeout(flashTimer);
  if (session.idx >= session.steps.length) { finishSession(); return; }
  render();
  autoSpeakStep();
  flashArm();
}

function finishSession() {
  const date = today();
  const before = plantInfo();
  const firstToday = state.profile.lastPlay !== date;
  const newly = [];
  Object.entries(session.stats).forEach(([id, s]) => {
    if (!state.items[id]) newly.push(id);
    applyResult(state, id, s.wrong ? 'wrong' : s.hint ? 'hint' : 'right', date);
  });

  const acc = session.total ? Math.round((session.right / session.total) * 100) : 100;
  let coins = session.right * (session.mode === 'level' ? 5 : 3);
  let exp = 0;
  if (session.mode === 'level') {
    const rec = state.levels[session.level.id] || { done: false, plays: 0, best: 0 };
    const firstClear = !rec.done;
    coins += firstClear ? 20 : 10;
    exp += firstClear ? 30 : 10;
    state.levels[session.level.id] = { done: true, plays: rec.plays + 1, best: Math.max(rec.best, acc) };
  } else if (session.mode === 'flash') {
    exp += 8;
  } else {
    exp += 10;
    if (state.profile.reviewDay !== date) { state.profile.reviewDay = date; state.profile.reviewCount = 0; }
    state.profile.reviewCount += Object.keys(session.stats).length;
  }
  if (firstToday) exp += 10;
  const { usedFreeze } = touchStreak(state, date);
  state.profile.coins += coins;
  state.garden.plants[state.garden.active].exp += exp;
  const after = plantInfo();

  const mood = acc >= 70 ? 'cheer' : 'encourage';
  const ml = mascot() ? mascotLine(mascot().id, mood) : null;
  session.result = { acc, coins, exp, newly, usedFreeze, firstToday, lvUp: after.lv > before.lv, stageUp: after.stage > before.stage, after, mood, line: ml };
  save();
  addLogs(session.logs);
  ui.overlay = 'result';
  ui.bubble = null;
  ui.mood = null;
  render();
  sfx.fanfare();
  if (ml && state.settings.autoplay) setTimeout(() => { if (ui.overlay === 'result') mascotSay(ml); }, 900);
}

function viewResult() {
  const r = session.result;
  const ci = r.after;
  const isLevel = session.mode === 'level';
  const nextIdx = isLevel ? session.levelIdx + 1 : -1;
  const hasNext = isLevel && nextIdx < content.levels.length;
  const newStamps = r.newly.map(byId).filter(Boolean);
  const m = mascot();
  return `<section class="result">
    <h1>${isLevel ? `「${esc(session.level.title)}」完成！` : session.mode === 'flash' ? `單字快閃 ${session.right}/${session.total}` : '今日複習完成！'}</h1>
    <div class="result-duo"><div class="plant-hero grow">${drawPlant(ci)}</div>
      ${m ? `<button class="mascot-btn" data-action="mascot-say" data-mood="${r.mood}">${mascotHTML(r.mood, 'pop')}</button>` : ''}</div>
    ${m && r.line ? `<div class="bubble">${line(r.line)}</div>` : ''}
    ${r.stageUp ? `<div class="levelup">${line({ jp: 'みて！おおきく なった！', ro: 'mite! ookiku natta!', zh: '你看！長大了！' })}<p>${esc(ci.def.zh)}升到 Lv.${ci.lv}，進入「${esc(ci.def.stages[ci.stage - 1])}」</p></div>`
      : r.lvUp ? `<div class="levelup"><p>${esc(ci.def.zh)}升到 Lv.${ci.lv}！</p></div>` : ''}
    <div class="stats">
      <div><b>${r.acc}%</b><span>答對率</span></div>
      <div><b>+${r.coins}</b><span>旅費</span></div>
      <div><b>+${r.exp}</b><span>成長值</span></div>
      <div><b>${state.profile.streak}</b><span>天連續</span></div>
    </div>
    ${r.usedFreeze ? '<p class="hint-text">昨天沒玩，自動用掉一張補票，連續天數保住了。</p>' : ''}
    ${newStamps.length ? `<h2>手帳新蓋的章</h2><div class="stamp-grid result-stamps">${newStamps.map((it, i) =>
      `<span class="stamp-in" style="animation-delay:${0.25 + i * 0.18}s">${stampHTML(it)}</span>`).join('')}</div>` : ''}
    <div class="foot col">
      ${hasNext ? `<button class="btn primary wide" data-action="play" data-i="${nextIdx}">下一站：${esc(content.levels[nextIdx].title)}</button>` : ''}
      ${session.mode === 'flash' ? '<button class="btn primary wide" data-action="flash">再來 5 題</button>' : ''}
      <button class="btn ${hasNext || session.mode === 'flash' ? 'ghost' : 'primary'} wide" data-action="home">回到旅程</button>
    </div>
  </section>`;
}

// ---------- 植物互動 ----------
function swayOnce() {
  ui.sway = true;
  clearTimeout(swayOnce.t);
  swayOnce.t = setTimeout(() => { ui.sway = false; render(); }, 900);
}

function plantTap() {
  const l = pick(LINES.filter(x => x !== ui.bubble));
  ui.bubble = l;
  swayOnce();
  render();
  say(l.jp);
}

function care(id) {
  const c = CARE.find(x => x.id === id);
  if (!c || state.profile.coins < c.price) return;
  const before = plantInfo();
  state.profile.coins -= c.price;
  state.garden.plants[before.id].exp += c.exp;
  state.garden.cared = (state.garden.cared || 0) + 1;
  const after = plantInfo();
  ui.bubble = { jp: `${c.jp}、ありがとう！`, ro: `${c.ro}, arigatou!`, zh: `謝謝你的${c.zh}！` };
  save();
  sfx.correct();
  say(ui.bubble.jp);
  swayOnce();
  if (after.stage > before.stage) toast(`${after.def.zh}長大了！進入「${after.def.stages[after.stage - 1]}」`);
  else if (after.lv > before.lv) toast(`${after.def.zh}升到 Lv.${after.lv}！`);
  else render();
}

function buyPlant(id) {
  const p = plantById(id);
  if (state.garden.plants[id] || state.profile.coins < p.price) return;
  if (!confirm(`用 ${p.price} 旅費買一盆${p.zh}，並開始種它？`)) return;
  state.profile.coins -= p.price;
  state.garden.plants[id] = { exp: 0 };
  state.garden.active = id;
  ui.bubble = null;
  save();
  sfx.stamp();
  say(p.jp);
  toast(`新植物：${p.zh}（${p.jp}）`);
}

function usePlant(id) {
  if (!state.garden.plants[id]) return;
  state.garden.active = id;
  ui.bubble = null;
  save();
  say(plantById(id).jp);
  render();
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


// ---------- 福岡會話 ----------
const sceneById = id => travel?.scenes.find(s => s.id === id);
const kanaLine = l => (l.kana && l.kana.replace(/\s/g, '') !== l.jp.replace(/\s/g, '') ? `<span class="kana">${esc(l.kana)}</span>` : '');

function viewTalk() {
  if (!travel) return `<header class="top"><h1>福岡會話</h1></header><p class="hint-text">會話題庫載入失敗，請連上網路後重新整理。</p>`;
  if (ui.scene) return viewScene(sceneById(ui.scene));
  const done = travel.scenes.filter(s => state.talk.done[s.id]).length;
  return `
    <header class="top"><h1>福岡會話</h1><div class="coins"><i class="ic ic-coin"></i>${state.profile.coins}</div></header>
    <p class="hint-text">旅途上用得到的句子，每個場景都有一段情境模擬。出發前每天練一個場景就好。</p>
    <div class="bar big"><i style="width:${Math.round(done / travel.scenes.length * 100)}%"></i></div>
    <p class="hint-text">情境模擬完成 ${done}／${travel.scenes.length}</p>
    <div class="scene-grid">${travel.scenes.map(s => `
      <button class="scene-card ${state.talk.done[s.id] ? 'done' : ''}" data-action="talk-scene" data-id="${s.id}">
        <span class="emoji" aria-hidden="true">${s.icon}</span><b>${esc(s.title)}</b><small>${esc(s.sub)}</small>
        ${state.talk.done[s.id] ? '<span class="pill on">完成</span>' : `<span class="cnt">${s.phrases.length} 句</span>`}
      </button>`).join('')}</div>
    <p class="hint-text">${esc(travel.note)}</p>`;
}

function viewScene(sc) {
  return `
    <header class="top"><button class="back" data-action="talk-back" aria-label="回到場景列表">‹ 場景</button></header>
    <h1 class="scene-h"><span aria-hidden="true">${sc.icon}</span>${esc(sc.title)}</h1>
    <button class="btn primary wide" data-action="rp-start" data-id="${sc.id}">情境模擬：${esc(sc.roleplay.title)}
      <small>${state.talk.done[sc.id] ? '已完成，可以再練一次' : `${sc.roleplay.turns.filter(t => t.who === 'me').length} 次輪到你回答`}</small></button>
    <h2>常用句</h2>
    <p class="hint-text">點句子聽發音；點「放大」可以直接拿手機給店員看。</p>
    <div class="talk-list">${sc.phrases.map((p, i) => `
      <div class="talk-row">
        <button class="talk-main" data-action="say" data-text="${esc(p.jp)}">
          <span class="jp">${esc(p.jp)}</span>${kanaLine(p)}${ro(p.ro)}<span class="zh">${esc(p.zh)}</span></button>
        <div class="talk-btns">
          <button class="mini" data-action="say-slow" data-text="${esc(p.jp)}">慢速</button>
          <button class="mini" data-action="talk-show" data-id="${sc.id}" data-i="${i}">放大</button>
        </div>
      </div>`).join('')}</div>`;
}

function viewShow() {
  const p = sceneById(ui.show.sid)?.phrases[ui.show.i];
  if (!p) return '';
  return `<div class="show" role="dialog" aria-label="給店員看">
    <button class="x" data-action="close-show" aria-label="關閉">×</button>
    <button class="show-jp jp" data-action="say" data-text="${esc(p.jp)}">${esc(p.jp)}</button>
    ${p.kana ? `<p class="show-kana">${esc(p.kana)}</p>` : ''}
    <p class="show-zh">${esc(p.zh)}</p>
    <p class="hint-text center">點日文可以播放發音</p>
  </div>`;
}

function rpBubble(t, cls = '') {
  return `<div class="rp-msg ${t.who === 'me' ? 'me' : 'them'} ${cls}">
    <small>${t.who === 'me' ? '你' : '對方'}</small>
    <button class="rp-bubble" data-action="say" data-text="${esc(t.jp)}">
      <span class="jp">${esc(t.jp)}</span>${kanaLine(t)}${ro(t.ro)}<span class="zh">${esc(t.zh)}</span></button>
  </div>`;
}

function viewRoleplay() {
  const sc = sceneById(rp.sid);
  const turns = sc.roleplay.turns;
  const finished = rp.idx >= turns.length;
  const pct = Math.round((Math.min(rp.idx, turns.length) / turns.length) * 100);
  const log = turns.slice(0, Math.min(rp.idx + 1, turns.length)).map((t, k) => {
    if (t.who === 'staff') return rpBubble(t, k === rp.idx ? 'now' : '');
    if (k < rp.idx) return rpBubble({ who: 'me', ...t.options[t.answer] });
    return '';
  }).join('');
  let foot = '';
  if (finished) {
    foot = `<div class="rp-end">
      <p class="mark">○</p><h2>對話完成！</h2>
      <p>${rp.wrong ? `選錯 ${rp.wrong} 次，再練一次會更熟。` : '全部一次答對，太厲害了！'}</p>
      ${rp.reward ? `<p class="reward"><i class="ic ic-coin"></i>+${rp.reward}</p>` : ''}
      <button class="btn primary wide" data-action="rp-again">再練一次</button>
      <button class="btn ghost wide" data-action="rp-exit">回到場景</button></div>`;
  } else if (turns[rp.idx].who === 'staff') {
    foot = `<div class="rp-foot"><button class="btn primary wide" data-action="rp-next">繼續</button></div>`;
  } else {
    const t = turns[rp.idx];
    foot = `<div class="rp-foot">
      <p class="rp-goal">🎯 ${esc(t.goal)}</p>
      ${rp.tip ? `<p class="rp-tip">${esc(rp.tip)}</p>` : ''}
      <div class="opts">${t.options.map((o, k) => `
        <button class="opt rp-opt ${rp.picked.includes(k) ? 'wrong' : ''}" data-action="rp-pick" data-i="${k}" ${rp.picked.includes(k) ? 'disabled' : ''}>
          <span class="jp">${esc(o.jp)}</span>${kanaLine(o)}${ro(o.ro)}</button>`).join('')}</div>
    </div>`;
  }
  return `<section class="session rp">
    <header class="session-top">
      <button class="x" data-action="rp-exit" aria-label="離開">×</button>
      <div class="progress"><i style="width:${pct}%"></i></div>
    </header>
    <h2 class="rp-title">${sc.icon} ${esc(sc.roleplay.title)}</h2>
    <p class="hint-text center">${esc(sc.roleplay.intro)}</p>
    <div class="rp-log">${log}</div>
    ${foot}
  </section>`;
}

function rpEnterTurn() {
  const t = sceneById(rp.sid).roleplay.turns[rp.idx];
  rp.picked = [];
  rp.tip = '';
  render();
  window.scrollTo(0, document.body.scrollHeight);
  if (t && t.who === 'staff' && state.settings.autoplay) say(t.jp);
}

function rpStart(sid) {
  rp = { sid, idx: 0, wrong: 0, picked: [], tip: '', reward: 0 };
  ui.overlay = 'rp';
  rpEnterTurn();
}

function rpPick(k) {
  const sc = sceneById(rp.sid);
  const t = sc.roleplay.turns[rp.idx];
  if (!t || t.who !== 'me' || rp.picked.includes(k)) return;
  if (k !== t.answer) {
    rp.picked.push(k);
    rp.wrong++;
    rp.tip = `這句是「${t.options[k].zh}」，再想想看。`;
    sfx.wrong();
    say(t.options[k].jp);
    render();
    return;
  }
  sfx.correct();
  say(t.options[k].jp);
  const myLen = [...t.options[k].jp].length;
  rp.idx++;
  if (rp.idx >= sc.roleplay.turns.length) return rpFinish();
  // 先讓自己那句唸完，再換對方說
  const next = sc.roleplay.turns[rp.idx];
  rp.picked = [];
  rp.tip = '';
  render();
  window.scrollTo(0, document.body.scrollHeight);
  if (next.who === 'staff' && state.settings.autoplay) {
    const myIdx = rp.idx;
    setTimeout(() => { if (rp && rp.idx === myIdx && ui.overlay === 'rp') say(next.jp); }, 700 + myLen * 180);
  }
}

function rpFinish() {
  const first = !state.talk.done[rp.sid];
  rp.reward = first ? 30 : 5;
  state.talk.done[rp.sid] = true;
  state.profile.coins += rp.reward;
  save();
  sfx.fanfare();
  render();
  window.scrollTo(0, document.body.scrollHeight);
}

// ---------- 事件 ----------
app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'INPUT') return;
  const a = el.dataset.action;
  const i = Number(el.dataset.i);
  switch (a) {
    case 'tab': ui.tab = el.dataset.tab; ui.sheet = null; ui.bubble = null; ui.mood = null; ui.scene = null; ui.show = null; render(); window.scrollTo(0, 0); break;
    case 'talk-scene': ui.scene = el.dataset.id; render(); window.scrollTo(0, 0); break;
    case 'talk-back': ui.scene = null; render(); window.scrollTo(0, 0); break;
    case 'talk-show': ui.show = { sid: el.dataset.id, i }; render(); say(sceneById(el.dataset.id).phrases[i].jp); break;
    case 'close-show': ui.show = null; render(); break;
    case 'rp-start': rpStart(el.dataset.id); break;
    case 'rp-next': rp.idx++; rp.idx >= sceneById(rp.sid).roleplay.turns.length ? rpFinish() : rpEnterTurn(); break;
    case 'rp-pick': rpPick(i); break;
    case 'rp-again': rpStart(rp.sid); break;
    case 'rp-exit': rp = null; ui.overlay = null; render(); window.scrollTo(0, 0); break;
    case 'onboard-go': state.onboarded = true; save(); startSession(buildLevel(state, content, 0)); break;
    case 'play': startSession(buildLevel(state, content, i)); break;
    case 'review': startSession(buildReview(state, content)); break;
    case 'flash': if (words) startSession(buildFlash(state, words)); break;
    case 'locked': toast('先完成前一站才能前往'); break;
    case 'home': clearTimeout(flashTimer); session = null; ui.overlay = null; ui.tab = 'home'; ui.bubble = null; ui.mood = null; render(); window.scrollTo(0, 0); break;
    case 'quit':
      clearTimeout(flashTimer);
      if (confirm('現在離開，這一關的進度不會保存。確定離開嗎？')) { window.speechSynthesis?.cancel(); session = null; ui.overlay = null; render(); }
      else flashArm();
      break;
    case 'next': nextStep(); break;
    case 'say': say(el.dataset.text); break;
    case 'say-slow': say(el.dataset.text, { slow: true }); break;
    case 'say-spell': speech.spell(el.dataset.text, { slow: state.settings.slow }); break;
    case 'opt': { const t = curStep().type; t === 'story' ? answerStory(i) : t === 'flash' ? answerFlash(i) : answerQuestion(i); break; }
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
    case 'plant-tap': plantTap(); break;
    case 'mascot-tap': mascotTap(); break;
    case 'mascot-say': {
      const mm = mascot();
      if (!mm) break;
      const l = el.dataset.mood === 'think' ? curStep()?.mascotLine : session?.result?.line;
      mascotSay(l || mascotLine(mm.id, el.dataset.mood));
      break;
    }
    case 'mascot-set':
      state.settings.mascot = el.dataset.id;
      ui.bubble = null; ui.mood = null;
      save(); render();
      if (mascot()) mascotSay(mascotLine(mascot().id, 'idle'));
      break;
    case 'mascot-test': if (mascot()) mascotSay(mascotLine(mascot().id, 'idle')); break;
    case 'care': care(el.dataset.id); break;
    case 'plant-buy': buyPlant(el.dataset.id); break;
    case 'plant-use': usePlant(el.dataset.id); break;
    case 'test-voice': say('こんにちは。いっしょに がんばろう！'); break;
    case 'export': exportData(); break;
    case 'reset':
      if (confirm('所有進度、旅費和植物的成長都會清除，無法復原。確定嗎？')) {
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
  } else if (/^[1-4]$/.test(e.key) && !session.answered && ['q', 'story', 'flash'].includes(curStep().type)) {
    const k = Number(e.key) - 1;
    const st = curStep();
    if (st.type === 'flash') { if (k < st.opts.length) answerFlash(k); return; }
    const n = st.type === 'story' ? st.scene.choices.length : st.q.options.length;
    if (k < n) st.type === 'story' ? answerStory(k) : answerQuestion(k);
  }
});

boot();
