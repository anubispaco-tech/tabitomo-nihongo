// 旅伴「たびまる」：原創角色，三個成長階段
// 原創角色：圓滾滾的小蝦。stage 1：小蝦仔＋櫻花髮夾｜stage 2：戴上旅行斗笠｜stage 3：再加上圍巾和小背包
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

const SHELL = '#F6A592';
const SHELL_DK = '#E9846D';
const BELLY = '#FFE6DC';

// 蝦尾：從身體右下方往上捲，最後是扇形尾巴
const tail = `
  <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <ellipse cx="160" cy="80" rx="6" ry="12" fill="${SHELL_DK}" transform="rotate(-30 160 80)"/>
    <ellipse cx="174" cy="76" rx="6" ry="13" fill="${SHELL_DK}"/>
    <ellipse cx="187" cy="82" rx="6" ry="12" fill="${SHELL_DK}" transform="rotate(30 187 82)"/>
    <ellipse cx="173" cy="100" rx="12" ry="10" fill="${SHELL}"/>
    <ellipse cx="172" cy="124" rx="15" ry="12" fill="${SHELL}"/>
    <ellipse cx="160" cy="150" rx="19" ry="15" fill="${SHELL}"/>
  </g>`;

// 兩根長觸鬚
const antennae = `
  <g fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round">
    <path d="M86 58 C80 30 60 18 36 16"/>
    <path d="M110 57 C112 28 128 14 150 8"/>
  </g>
  <circle cx="36" cy="16" r="4" fill="${SHELL_DK}" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="150" cy="8" r="4" fill="${SHELL_DK}" stroke="${INK}" stroke-width="2.5"/>`;

// 肚子下的小腳
const legs = `
  <g stroke="${INK}" stroke-width="3" stroke-linecap="round">
    <path d="M76 172 l-4 12"/><path d="M92 175 l-2 12"/><path d="M108 175 l2 12"/><path d="M124 172 l4 12"/>
  </g>`;

export function companionSVG(stage = 1, mood = 'idle') {
  return `
  <svg class="tabimaru" viewBox="0 0 200 200" role="img" aria-label="旅伴たびまる">
    <ellipse cx="100" cy="190" rx="62" ry="6" fill="${INK}" opacity=".10"/>
    ${tail}
    ${stage >= 3 ? pack : ''}
    ${legs}
    ${antennae}
    <path d="M100 52 C148 52 168 90 168 126 C168 160 138 176 100 176 C62 176 32 160 32 126 C32 90 52 52 100 52z"
          fill="${SHELL}" stroke="${INK}" stroke-width="3.5"/>
    <path d="M50 146 Q100 160 150 146" fill="none" stroke="${BELLY}" stroke-width="6" stroke-linecap="round"/>
    <path d="M64 162 Q100 172 136 162" fill="none" stroke="${BELLY}" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="34" cy="130" rx="9" ry="13" fill="${SHELL}" stroke="${INK}" stroke-width="3" transform="rotate(20 34 130)"/>
    <ellipse cx="62" cy="124" rx="11" ry="7" fill="#EE7F8E" opacity=".8"/>
    <ellipse cx="138" cy="124" rx="11" ry="7" fill="#EE7F8E" opacity=".8"/>
    ${eyes(mood)}
    ${mouth(mood)}
    ${stage >= 3 ? scarf : ''}
    ${stage >= 2 ? hat : ''}
    ${flower(stage >= 2 ? 146 : 136, stage >= 2 ? 60 : 66, stage >= 2 ? 0.8 : 1)}
  </svg>`;
}

export const STAGE_NAMES = { 1: '小蝦仔', 2: '旅行斗笠', 3: '整裝出發' };
