// 學習引擎：日期、Leitner 5 盒 SRS、關卡組題、旅伴成長、連續天數

// ---------- 日期（一律用裝置本地日期） ----------
export function today(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}
function dayDiff(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 864e5);
}

// ---------- 初始存檔 ----------
export function newState() {
  return {
    v: 1,
    createdAt: Date.now(),
    onboarded: false,
    settings: { romaji: true, slow: false, autoplay: true, sound: true },
    profile: { coins: 0, streak: 0, bestStreak: 0, lastPlay: null, freezes: 1, freezeEarnedAt: 0, reviewDay: null, reviewCount: 0 },
    garden: { active: 'sakura', plants: { sakura: { exp: 0 } }, cared: 0 },
    levels: {},
    items: {},
  };
}

// ---------- SRS ----------
// 進入某盒後，幾天後複習
export const BOX_INTERVAL = { 1: 1, 2: 1, 3: 3, 4: 7, 5: 21 };
export const DAILY_REVIEW_CAP = 30;

export function itemStatus(rec) {
  if (!rec) return 'new';
  if (rec.mastered) return 'mastered';
  return 'learning';
}

export function dueItems(state, content, date = today()) {
  return content.items
    .filter(it => state.items[it.id] && state.items[it.id].due <= date)
    .sort((a, b) => {
      const ra = state.items[a.id], rb = state.items[b.id];
      return ra.due.localeCompare(rb.due) || ra.box - rb.box;
    });
}

// outcome: 'right' | 'wrong' | 'hint'
export function applyResult(state, itemId, outcome, date = today()) {
  const rec = state.items[itemId] || { box: 0, due: date, right: 0, wrong: 0, mastered: false, seen: 0 };
  rec.seen += 1;
  if (outcome === 'wrong') {
    rec.wrong += 1;
    rec.box = 1;
    rec.mastered = false;
    rec.due = addDays(date, BOX_INTERVAL[1]);
  } else if (outcome === 'hint') {
    rec.box = Math.max(rec.box, 1);
    rec.due = addDays(date, 1);
  } else {
    rec.right += 1;
    if (rec.box >= 5) rec.mastered = true;
    rec.box = Math.min(Math.max(rec.box, 1) + 1, 5);
    rec.due = addDays(date, BOX_INTERVAL[rec.box]);
  }
  rec.last = date;
  state.items[itemId] = rec;
  return rec;
}

export function progressCounts(state, content) {
  const c = { mastered: 0, learning: 0, fresh: 0 };
  content.items.forEach(it => {
    const s = itemStatus(state.items[it.id]);
    if (s === 'mastered') c.mastered++;
    else if (s === 'learning') c.learning++;
    else c.fresh++;
  });
  return c;
}

// ---------- 小工具 ----------
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }

// 形狀容易混淆的假名，優先當干擾選項
const CONFUSE = {
  'あ': ['お', 'め'], 'お': ['あ', 'す'], 'い': ['こ', 'り'], 'こ': ['い', 'に'], 'に': ['こ', 'た'],
  'さ': ['き', 'ち'], 'き': ['さ', 'ち'], 'ち': ['さ', 'ら'], 'ぬ': ['ね', 'め'], 'ね': ['ぬ', 'れ'],
  'た': ['な', 'に'], 'な': ['た', 'は'], 'う': ['つ', 'ら'], 'つ': ['う', 'し'], 'し': ['つ', 'も'],
  'く': ['へ', 'て'], 'て': ['く', 'そ'], 'そ': ['て', 'ろ'], 'す': ['お', 'む'], 'け': ['は', 'に'],
  'の': ['め', 'ぬ'], 'え': ['ん', 'ろ'], 'せ': ['さ', 'け'], 'と': ['こ', 'て'], 'か': ['や', 'け'],
};

function kanaDistractors(item, pool, n = 3) {
  const others = pool.filter(p => p.id !== item.id);
  const near = (CONFUSE[item.jp] || []).map(ch => others.find(o => o.jp === ch)).filter(Boolean);
  const rest = shuffle(others.filter(o => !near.includes(o)));
  return [...near, ...rest].slice(0, n);
}

// ---------- 題目產生 ----------
// kind: kana-read 看字選音 / kana-listen 聽音選字 / phrase-listen 聽音選意 / phrase-read 看句選意 / spell 假名拼字
export function makeQuestion(kind, item, pool) {
  if (kind === 'kana-read' || kind === 'kana-listen') {
    const ds = kanaDistractors(item, pool.filter(p => p.type === 'kana'));
    const opts = shuffle([item, ...ds]);
    return {
      kind, itemId: item.id, item,
      options: opts.map(o => (kind === 'kana-read' ? { label: o.ro, sub: '', jp: false } : { label: o.jp, sub: o.ro, jp: true })),
      answer: opts.indexOf(item),
    };
  }
  if (kind === 'phrase-listen' || kind === 'phrase-read') {
    const others = pool.filter(p => p.type === 'phrase' && p.id !== item.id);
    const opts = shuffle([item, ...sample(others, 3)]);
    return {
      kind, itemId: item.id, item,
      options: opts.map(o => ({ label: o.zh, sub: '', jp: false })),
      answer: opts.indexOf(item),
    };
  }
  throw new Error('unknown kind ' + kind);
}

export function makeSpell(word, pool) {
  const chars = [...word.jp];
  const extras = sample(pool.filter(p => p.type === 'kana' && !chars.includes(p.jp)), 2);
  const tiles = shuffle([...chars, ...extras.map(e => e.jp)]);
  return { kind: 'spell', word, chars, tiles };
}

function reviewKind(item) {
  if (item.type === 'kana') return Math.random() < 0.5 ? 'kana-read' : 'kana-listen';
  return Math.random() < 0.5 ? 'phrase-listen' : 'phrase-read';
}
function firstKind(item) { return item.type === 'kana' ? 'kana-read' : 'phrase-listen'; }
function secondKind(item) { return item.type === 'kana' ? 'kana-listen' : 'phrase-read'; }

// 避免同一個項目連續出題
function spread(qs) {
  const out = [];
  let rest = qs.slice();
  while (rest.length) {
    const lastId = out.length ? out[out.length - 1].itemId : null;
    let idx = rest.findIndex(q => q.itemId !== lastId);
    if (idx < 0) idx = 0;
    out.push(rest[idx]);
    rest.splice(idx, 1);
  }
  return out;
}

// 已學過（含本關）的項目，用來產生干擾選項
export function learnedPool(content, upToLevelIdx) {
  const ids = new Set();
  content.levels.slice(0, upToLevelIdx + 1).forEach(l => l.new.forEach(id => ids.add(id)));
  return content.items.filter(it => ids.has(it.id));
}

const byId = (content, id) => content.items.find(it => it.id === id);

// 組一關：複習 → 新內容（分組：認識→辨認）→ 拼字 → 劇情
export function buildLevel(state, content, levelIdx) {
  const level = content.levels[levelIdx];
  const pool = learnedPool(content, levelIdx);
  const newItems = level.new.map(id => byId(content, id));
  const steps = [];

  const reviews = dueItems(state, content).filter(it => !level.new.includes(it.id)).slice(0, 5);
  if (reviews.length) {
    steps.push({ type: 'banner', text: '先複習一下之前學過的', sub: `${reviews.length} 題` });
    spread(shuffle(reviews.map(it => ({ ...makeQuestion(reviewKind(it), it, pool.length >= 4 ? pool : content.items), review: true }))))
      .forEach(q => steps.push({ type: 'q', q }));
  }

  steps.push({ type: 'banner', text: `新內容：${level.sub}`, sub: `${newItems.length} 個` });
  const groups = newItems.length > 3 ? [newItems.slice(0, 3), newItems.slice(3)] : [newItems];
  groups.forEach(g => {
    g.forEach(it => steps.push({ type: 'intro', item: it }));
    spread(shuffle(g.map(it => makeQuestion(firstKind(it), it, pool)))).forEach(q => steps.push({ type: 'q', q }));
  });
  spread(shuffle(newItems.map(it => makeQuestion(secondKind(it), it, pool)))).forEach(q => steps.push({ type: 'q', q }));

  sample(level.words || [], 2).forEach(w => steps.push({ type: 'spell', s: makeSpell(w, pool) }));

  (level.story || []).forEach((sc, i) => steps.push({ type: 'story', scene: sc, first: i === 0 }));
  return { level, levelIdx, steps, pool, mode: 'level' };
}

// 純複習模式（每日上限 30 題）
export function buildReview(state, content) {
  const date = today();
  const done = state.profile.reviewDay === date ? state.profile.reviewCount : 0;
  const left = Math.max(0, DAILY_REVIEW_CAP - done);
  const due = dueItems(state, content).slice(0, Math.min(15, left));
  const pool = content.items.filter(it => state.items[it.id]);
  const steps = spread(shuffle(due.map(it => ({ ...makeQuestion(reviewKind(it), it, pool.length >= 4 ? pool : content.items), review: true }))))
    .map(q => ({ type: 'q', q }));
  return { level: { id: 'review', title: '今日複習', sub: '' }, levelIdx: -1, steps, pool, mode: 'review' };
}

export function reviewLeftToday(state, content) {
  const date = today();
  const done = state.profile.reviewDay === date ? state.profile.reviewCount : 0;
  return Math.min(dueItems(state, content).length, Math.max(0, DAILY_REVIEW_CAP - done));
}

// ---------- 植物成長 ----------
const LV_EXP = [0, 50, 120, 210, 320, 450, 600, 780, 1000];
export function growthLevel(exp) {
  let lv = 1;
  LV_EXP.forEach((need, i) => { if (exp >= need) lv = i + 1; });
  const cur = LV_EXP[lv - 1] ?? LV_EXP[LV_EXP.length - 1];
  const next = LV_EXP[lv] ?? null;
  return { lv, cur, next, pct: next ? (exp - cur) / (next - cur) : 1 };
}
// Lv1-2 第 1 階段、Lv3-4 第 2、Lv5-6 第 3、Lv7 以上第 4
export function growthStage(lv) { return lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1; }
export const STAGE_LV = { 2: 3, 3: 5, 4: 7 };

export const CARE = [
  { id: 'mizu', jp: 'みず', ro: 'mizu', zh: '水', price: 20, exp: 8 },
  { id: 'hiryou', jp: 'ひりょう', ro: 'hiryou', zh: '肥料', price: 50, exp: 20 },
  { id: 'eiyouzai', jp: 'えいようざい', ro: 'eiyouzai', zh: '營養劑', price: 80, exp: 32 },
];

export const LINES = [
  { jp: 'がんばろう！', ro: 'ganbarou!', zh: '一起加油吧！' },
  { jp: 'きょうも いっしょに！', ro: 'kyou mo issho ni!', zh: '今天也一起努力！' },
  { jp: 'たのしいね！', ro: 'tanoshii ne!', zh: '很好玩吧！' },
  { jp: 'もう すこし！', ro: 'mou sukoshi!', zh: '再一點點就好！' },
  { jp: 'ふくおか、たのしみ！', ro: 'fukuoka, tanoshimi!', zh: '好期待福岡！' },
];
export const CHEERS = [
  { jp: 'すごい！', ro: 'sugoi!', zh: '好厲害！' },
  { jp: 'いいね！', ro: 'ii ne!', zh: '很棒喔！' },
  { jp: 'せいかい！', ro: 'seikai!', zh: '答對了！' },
];
export const COMFORT = { jp: 'だいじょうぶ！', ro: 'daijoubu!', zh: '沒關係！' };

// ---------- 連續天數 ----------
export function touchStreak(state, date = today()) {
  const p = state.profile;
  let usedFreeze = false;
  if (p.lastPlay === date) return { usedFreeze };
  if (!p.lastPlay) p.streak = 1;
  else {
    const gap = dayDiff(p.lastPlay, date);
    if (gap === 1) p.streak += 1;
    else if (gap === 2 && p.freezes > 0) { p.freezes -= 1; p.streak += 1; usedFreeze = true; }
    else p.streak = 1;
  }
  p.lastPlay = date;
  p.bestStreak = Math.max(p.bestStreak, p.streak);
  // 每連續 7 天補回一張補票（最多 1 張）
  if (p.streak > 0 && p.streak % 7 === 0 && p.freezeEarnedAt !== p.streak) {
    p.freezes = Math.min(1, p.freezes + 1);
    p.freezeEarnedAt = p.streak;
  }
  return { usedFreeze };
}

// 有沒有斷掉（顯示用）
export function streakAlive(state, date = today()) {
  const p = state.profile;
  if (!p.lastPlay) return 0;
  const gap = dayDiff(p.lastPlay, date);
  if (gap <= 1) return p.streak;
  if (gap === 2 && p.freezes > 0) return p.streak;
  return 0;
}
