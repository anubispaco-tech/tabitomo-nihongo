// 旅伴「たびまる」：原創角色，三個成長階段
// stage 1：麻糬小團子＋櫻花髮夾｜stage 2：戴上旅行斗笠｜stage 3：再加上圍巾和小背包
// mood: idle | happy | think

const INK = '#2B3A67';

function eyes(mood) {
  if (mood === 'happy') {
    return `<path d="M72 112 q8 -10 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
            <path d="M112 112 q8 -10 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (mood === 'think') {
    return `<ellipse cx="80" cy="112" rx="5" ry="6" fill="${INK}"/>
            <ellipse cx="120" cy="112" rx="5" ry="6" fill="${INK}"/>
            <path d="M150 82 q6 10 0 16 q-6 -6 0 -16z" fill="#9CC9E8"/>`;
  }
  return `<ellipse cx="80" cy="110" rx="5.5" ry="7" fill="${INK}"/>
          <ellipse cx="120" cy="110" rx="5.5" ry="7" fill="${INK}"/>
          <circle cx="82" cy="107" r="1.8" fill="#fff"/><circle cx="122" cy="107" r="1.8" fill="#fff"/>`;
}

function mouth(mood) {
  if (mood === 'happy') return `<path d="M92 126 q8 10 16 0 z" fill="#E8738E" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  if (mood === 'think') return `<path d="M94 128 h12" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  return `<path d="M93 124 q3.5 4 7 0 q3.5 4 7 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
}

const flower = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    ${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-7" rx="5" ry="7.5" fill="#F7B4C6" stroke="#E88AA6" stroke-width="1.2" transform="rotate(${r})"/>`).join('')}
    <circle r="3.2" fill="#F6C945"/>
  </g>`;

const hat = `
  <g>
    <path d="M34 72 Q100 2 166 72 Q100 62 34 72z" fill="#E9C77B" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M70 52 Q100 45 130 52" fill="none" stroke="#B8893A" stroke-width="2" stroke-linecap="round"/>
    <path d="M42 70 Q100 61 158 70" fill="none" stroke="#C0453A" stroke-width="4" stroke-linecap="round"/>
  </g>`;

const scarf = `
  <g>
    <path d="M44 140 Q100 160 156 140 L156 152 Q100 172 44 152z" fill="#C0453A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M128 152 l10 28 l12 -4 l-6 -26z" fill="#C0453A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M60 148 l6 4 M80 154 l6 3 M104 156 l6 1" stroke="#F3E6C8" stroke-width="2.5" stroke-linecap="round"/>
  </g>`;

const pack = `
  <g>
    <rect x="22" y="112" width="26" height="34" rx="8" fill="#6FB59A" stroke="${INK}" stroke-width="3"/>
    <path d="M26 124 h18" stroke="${INK}" stroke-width="2"/>
  </g>`;

export function companionSVG(stage = 1, mood = 'idle') {
  return `
  <svg class="tabimaru" viewBox="0 0 200 200" role="img" aria-label="旅伴たびまる">
    <ellipse cx="100" cy="186" rx="58" ry="7" fill="${INK}" opacity=".10"/>
    ${stage >= 3 ? pack : ''}
    <ellipse cx="74" cy="176" rx="14" ry="9" fill="#FFFDF8" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="126" cy="176" rx="14" ry="9" fill="#FFFDF8" stroke="${INK}" stroke-width="3"/>
    <path d="M100 52 C150 52 172 90 172 126 C172 160 140 176 100 176 C60 176 28 160 28 126 C28 90 50 52 100 52z"
          fill="#FFFDF8" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="62" cy="126" rx="11" ry="7" fill="#F7B4C6" opacity=".85"/>
    <ellipse cx="138" cy="126" rx="11" ry="7" fill="#F7B4C6" opacity=".85"/>
    ${eyes(mood)}
    ${mouth(mood)}
    ${stage >= 3 ? scarf : ''}
    ${stage >= 2 ? hat : ''}
    ${flower(stage >= 2 ? 146 : 136, stage >= 2 ? 60 : 66, stage >= 2 ? 0.8 : 1)}
  </svg>`;
}

export const STAGE_NAMES = { 1: '小團子', 2: '旅行斗笠', 3: '整裝出發' };
