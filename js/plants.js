// 學習植物：學得越多長得越大。平面插畫風，不畫臉。
// 每種植物 4 個階段；櫻花樹會依「學會的字數」開出等量的花。

export const PLANTS = [
  { id: 'sakura', jp: 'さくら', ro: 'sakura', zh: '櫻花樹', price: 0,
    stages: ['新芽', '小樹苗', '含苞待放', '滿開'], note: '每學會一個字，就多開一朵花。' },
  { id: 'monstera', jp: 'モンステラ', ro: 'monsutera', zh: '龜背芋', price: 150,
    stages: ['新葉', '第一道裂痕', '枝繁葉茂', '大葉舒展'], note: '葉子越長越大，裂痕也越來越多。' },
  { id: 'staghorn', jp: 'ビカクシダ', ro: 'bikakushida', zh: '鹿角蕨', price: 200,
    stages: ['上板', '冒出孢子葉', '鹿角分岔', '垂墜滿板'], note: '掛在木板上的蕨類，鹿角會一層層分岔垂下。' },
];

export const plantById = id => PLANTS.find(p => p.id === id) || PLANTS[0];

// ---------- 共用：花盆 ----------
const pot = `
  <ellipse cx="100" cy="194" rx="50" ry="5" fill="#2B3A67" opacity=".10"/>
  <path d="M60 152 h80 l-7 34 q-1.5 7 -9 7 h-48 q-7.5 0 -9 -7z" fill="#34477E"/>
  <path d="M66 156 h12 l-5 30 q-1 3 -4 3z" fill="#4D63A0" opacity=".55"/>
  <rect x="55" y="143" width="90" height="13" rx="6.5" fill="#4A5F98"/>
  <ellipse cx="100" cy="145" rx="39" ry="4" fill="#6A4A38"/>`;

// ---------- 櫻花 ----------
const TRUNK = '#7A5543';
const PINK = ['#FBDDE5', '#F8C8D4', '#F4B3C3'];

function bloom(x, y, s = 1, i = 0) {
  const c = i % 3 === 0 ? '#F28FA8' : '#F6A9BC';
  return `<g transform="translate(${x} ${y}) scale(${s}) rotate(${(i * 37) % 72})">
    ${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-3.6" rx="2.6" ry="3.8" fill="${c}" transform="rotate(${r})"/>`).join('')}
    <circle r="1.4" fill="#FFF3B8"/></g>`;
}

// 30 個花位（剛好等於序章 30 個學習項目）
const BLOOM_SPOTS = [
  [62, 70], [78, 58], [96, 50], [116, 56], [134, 66], [148, 80], [52, 88], [70, 82], [90, 72], [108, 74],
  [126, 82], [140, 96], [60, 104], [82, 96], [118, 98], [100, 88], [72, 46], [92, 34], [112, 38], [130, 48],
  [44, 76], [156, 64], [86, 112], [110, 112], [136, 112], [64, 120], [50, 60], [146, 44], [104, 24], [122, 26],
];
const BUD_SPOTS = [[128, 92], [72, 86], [104, 72], [118, 98], [84, 96], [110, 82]];

function sakura(stage, blooms) {
  if (stage === 1) {
    return `${pot}
      <path d="M100 145 C100 136 99 128 101 118" stroke="#6E9D5C" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="91" cy="122" rx="9" ry="4.5" fill="#8CC27A" transform="rotate(-25 91 122)"/>
      <ellipse cx="110" cy="117" rx="9" ry="4.5" fill="#79B468" transform="rotate(20 110 117)"/>
      ${blooms > 0 ? bloom(101, 114, 0.9) : ''}`;
  }
  if (stage === 2) {
    const leaves = [[128, 90], [72, 84], [104, 70], [84, 96]];
    return `${pot}
      <g fill="none" stroke="${TRUNK}" stroke-linecap="round">
        <path d="M99 145 C97 130 101 116 99 100" stroke-width="7"/>
        <path d="M99 114 C110 106 120 100 128 92" stroke-width="4"/>
        <path d="M99 108 C90 100 80 94 72 86" stroke-width="4"/>
        <path d="M99 100 C100 90 102 82 104 72" stroke-width="3"/>
      </g>
      ${leaves.map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="4" fill="${i % 2 ? '#8CC27A' : '#79B468'}" transform="rotate(${i * 40 - 30} ${x} ${y})"/>`).join('')}
      ${BUD_SPOTS.slice(0, Math.min(blooms, BUD_SPOTS.length)).map(([x, y], i) => bloom(x, y, 0.9, i)).join('')}`;
  }
  const full = stage === 4;
  const clouds = full
    ? [[100, 62, 46], [62, 80, 32], [138, 80, 32], [78, 50, 28], [124, 48, 28], [100, 94, 30], [48, 98, 20], [152, 98, 20]]
    : [[100, 70, 32], [72, 84, 22], [130, 84, 22], [100, 92, 22]];
  const spots = BLOOM_SPOTS.filter(([x, y]) => full || (x > 60 && x < 142 && y > 50 && y < 110));
  return `${pot}
    <g fill="none" stroke="${TRUNK}" stroke-linecap="round">
      <path d="M100 145 C96 128 104 118 99 100" stroke-width="10"/>
      <path d="M100 118 C114 108 126 100 140 88" stroke-width="5"/>
      <path d="M99 110 C86 100 74 94 60 86" stroke-width="5"/>
      <path d="M99 102 C98 88 104 76 108 60" stroke-width="4"/>
    </g>
    ${clouds.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${PINK[i % 3]}" opacity=".95"/>`).join('')}
    ${spots.slice(0, blooms).map(([x, y], i) => bloom(x, y, 1, i)).join('')}
    ${full ? [[40, 150, 20], [160, 132, -30], [150, 170, 50], [52, 176, 10], [170, 160, 70]].map(([x, y, r]) =>
      `<ellipse cx="${x}" cy="${y}" rx="3" ry="4.5" fill="#F6A9BC" transform="rotate(${r} ${x} ${y})"/>`).join('') : ''}`;
}

// ---------- 龜背芋 ----------
const LEAF = 'M0 -64 C14 -60 32 -44 33 -24 C34 -6 16 4 4 -2 L0 -8 L-4 -2 C-16 4 -34 -6 -33 -24 C-32 -44 -14 -60 0 -64z';
const SPLITS = [
  'M34 -16 L9 -15', 'M33 -32 L8 -30', 'M26 -48 L6 -44',
  'M-34 -16 L-9 -15', 'M-33 -32 L-8 -30', 'M-26 -48 L-6 -44',
];
const HOLES = [[16, -22], [-16, -22], [14, -38], [-14, -38]];

function monsteraLeaf(id, x, y, rot, s, splits, holes, shade) {
  const fill = shade ? '#3E8C5C' : '#4FA06B';
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <mask id="${id}" maskUnits="userSpaceOnUse" x="-40" y="-70" width="80" height="80">
      <path d="${LEAF}" fill="#fff"/>
      ${SPLITS.slice(0, splits).map(d => `<path d="${d}" stroke="#000" stroke-width="3.5" stroke-linecap="round"/>`).join('')}
      ${HOLES.slice(0, holes).map(([hx, hy]) => `<ellipse cx="${hx}" cy="${hy}" rx="2.4" ry="4.5" fill="#000"/>`).join('')}
    </mask>
    <g mask="url(#${id})">
      <path d="${LEAF}" fill="${fill}"/>
      <path d="M0 -64 C14 -60 32 -44 33 -24 C34 -6 16 4 4 -2 L0 -8z" fill="#000" opacity=".08"/>
    </g>
    <path d="M0 -6 L0 -58" stroke="#2F7449" stroke-width="1.8" stroke-linecap="round"/>
  </g>`;
}

function monstera(stage, uid) {
  const L = (i, ...a) => monsteraLeaf(`${uid}-m${i}`, ...a);
  const stems = (list) => list.map(d => `<path d="${d}" stroke="#5F9A62" stroke-width="3.5" fill="none" stroke-linecap="round"/>`).join('');
  if (stage === 1) {
    return `${pot}${stems(['M100 145 C100 132 102 122 104 112'])}${L(1, 104, 114, 8, 0.55, 0, 0, false)}`;
  }
  if (stage === 2) {
    return `${pot}${stems(['M98 145 C94 128 86 112 76 102', 'M102 145 C106 126 116 108 128 96'])}
      ${L(1, 77, 104, -28, 0.7, 2, 0, true)}${L(2, 128, 98, 26, 0.8, 4, 0, false)}`;
  }
  if (stage === 3) {
    return `${pot}${stems(['M96 145 C88 128 70 112 58 104', 'M100 145 C100 120 98 96 96 78', 'M104 145 C112 124 132 108 146 102', 'M101 145 C104 130 114 122 122 116'])}
      ${L(1, 58, 106, -48, 0.75, 4, 1, true)}${L(2, 146, 104, 48, 0.75, 4, 1, true)}
      ${L(3, 96, 80, -6, 0.9, 6, 2, false)}${L(4, 122, 118, 20, 0.6, 2, 0, false)}`;
  }
  return `${pot}
    <path d="M104 130 C120 140 130 156 128 176" stroke="#8B6A4E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    ${stems(['M96 145 C84 126 60 110 44 104', 'M98 145 C96 118 84 92 76 72', 'M102 145 C106 116 118 90 126 70', 'M104 145 C118 126 140 112 158 106', 'M100 145 C100 132 100 124 100 116'])}
    ${L(1, 44, 106, -58, 0.8, 6, 2, true)}${L(2, 158, 108, 58, 0.8, 6, 2, true)}
    ${L(3, 76, 74, -20, 0.95, 6, 4, false)}${L(4, 126, 72, 18, 0.95, 6, 4, false)}
    ${L(5, 100, 118, 0, 0.55, 2, 0, true)}`;
}

// ---------- 鹿角蕨（板植） ----------
const FROND = '#86A97E';
function frond(d, w = 9) {
  return `<path d="${d}" stroke="${FROND}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function staghorn(stage) {
  const board = `
    <ellipse cx="100" cy="194" rx="40" ry="4" fill="#2B3A67" opacity=".08"/>
    <path d="M100 14 L70 40 M100 14 L130 40" stroke="#8A6E55" stroke-width="1.5" fill="none"/>
    <circle cx="100" cy="14" r="3" fill="#6A5545"/>
    <rect x="62" y="38" width="76" height="104" rx="10" fill="#C99A6B"/>
    <path d="M70 52 C90 56 110 48 130 54 M68 84 C88 90 112 80 132 86 M70 118 C92 122 108 114 130 120" stroke="#B4855A" stroke-width="2" fill="none"/>`;
  const moss = `<ellipse cx="100" cy="104" rx="24" ry="18" fill="#7E8F55"/>
    <ellipse cx="94" cy="100" rx="10" ry="6" fill="#93A566"/>`;
  const shield = (big) => `
    <ellipse cx="100" cy="${big ? 84 : 92}" rx="${big ? 36 : 22}" ry="${big ? 30 : 18}" fill="${big ? '#A5B67C' : '#B3C38A'}"/>
    <path d="M100 ${big ? 110 : 106} L100 ${big ? 58 : 76} M100 ${big ? 96 : 98} L${big ? 74 : 84} ${big ? 70 : 82} M100 ${big ? 96 : 98} L${big ? 126 : 116} ${big ? 70 : 82}" stroke="#8C9F63" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  if (stage === 1) {
    return `${board}${moss}${shield(false)}${frond('M104 112 C108 122 114 128 120 134', 7)}`;
  }
  if (stage === 2) {
    return `${board}${moss}${shield(false)}
      ${frond('M94 114 C86 128 76 138 68 150 M68 150 l-8 8 M68 150 l2 12')}
      ${frond('M106 114 C116 126 124 136 132 146 M132 146 l8 6 M132 146 l0 12')}`;
  }
  if (stage === 3) {
    return `${board}${shield(true)}${moss}
      ${frond('M92 114 C78 130 64 142 52 156 M52 156 l-12 6 M52 156 l-4 14 M66 140 l-12 -2')}
      ${frond('M108 114 C122 130 136 142 148 156 M148 156 l12 6 M148 156 l4 14 M134 140 l12 -2')}
      ${frond('M98 118 C96 134 92 150 88 166 M88 166 l-8 10 M88 166 l4 12')}
      ${frond('M104 118 C108 132 112 144 116 156 M116 156 l8 8 M116 156 l-2 12', 7)}`;
  }
  return `${board}${shield(true)}${moss}
    ${frond('M90 112 C70 124 52 134 34 140 M34 140 l-12 -4 M34 140 l-10 10 M50 134 l-8 12 M58 130 l-6 -10', 9)}
    ${frond('M110 112 C130 124 148 134 166 140 M166 140 l12 -4 M166 140 l10 10 M150 134 l8 12 M142 130 l6 -10', 9)}
    ${frond('M94 118 C82 136 70 152 58 172 M58 172 l-12 8 M58 172 l-2 14 M70 152 l-12 2 M66 160 l6 10', 10)}
    ${frond('M106 118 C118 136 130 152 142 172 M142 172 l12 8 M142 172 l2 14 M130 152 l12 2 M134 160 l-6 10', 10)}
    ${frond('M100 120 C99 140 98 158 96 182 M96 182 l-8 8 M96 182 l6 8 M98 160 l-8 6', 8)}`;
}

let uidSeq = 0;
export function plantSVG(type = 'sakura', stage = 1, { blooms = 0 } = {}) {
  const uid = `p${++uidSeq}`;
  const body = type === 'monstera' ? monstera(stage, uid) : type === 'staghorn' ? staghorn(stage) : sakura(stage, blooms);
  const p = plantById(type);
  return `<svg class="plant" viewBox="0 0 200 200" role="img" aria-label="${p.zh}・${p.stages[stage - 1]}">${body}</svg>`;
}
