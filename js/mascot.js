// 旅伴吉祥物：小龍タツ、小貓ミケ。每隻有 6 種表情圖與各自的 VOICEVOX 聲音（只唸角色台詞，教學發音不受影響）
// 台詞的 jp 會被 tools/gen-audio.mjs 收集：一份用教學聲音（備援），一份用角色聲音（audio/m）
export const MOODS = ['idle', 'cheer', 'encourage', 'think', 'alert', 'sleep'];

export const MASCOTS = [
  {
    id: 'dragon', name: 'タツ', ro: 'Tatsu', zh: '小龍',
    note: '熱血又有點笨拙的幼龍',
    voice: '白上虎太郎', style: 'ふつう',
    lines: {
      idle: [
        { jp: 'きょうも いっしょに がんばろう！', ro: 'kyou mo issho ni ganbarou!', zh: '今天也一起加油吧！' },
        { jp: 'ぼくも にほんごを べんきょうちゅう！', ro: 'boku mo nihongo o benkyouchuu!', zh: '我也在學日文喔！' },
        { jp: 'ふくおか、たのしみだね！', ro: 'fukuoka, tanoshimi da ne!', zh: '好期待福岡喔！' },
      ],
      cheer: [
        { jp: 'やったー！ すごいよ！', ro: 'yattaa! sugoi yo!', zh: '太好了！你好厲害！' },
        { jp: 'その ちょうし！', ro: 'sono choushi!', zh: '就是這樣，保持下去！' },
      ],
      encourage: [
        { jp: 'だいじょうぶ！ つぎは できるよ！', ro: 'daijoubu! tsugi wa dekiru yo!', zh: '沒關係！下次一定可以！' },
        { jp: 'まちがえて おぼえるんだよ。', ro: 'machigaete oboerun da yo.', zh: '就是從錯誤中記住的啊。' },
      ],
      think: [
        { jp: 'じゅんびは いい？', ro: 'junbi wa ii?', zh: '準備好了嗎？' },
      ],
      alert: [
        { jp: 'べんきょうの じかんだよ！', ro: 'benkyou no jikan da yo!', zh: '該唸書囉！' },
        { jp: 'きょうの ごふん、やろう！', ro: 'kyou no gofun, yarou!', zh: '今天的 5 分鐘，來吧！' },
      ],
      sleep: [
        { jp: 'おやすみ…… また あした！', ro: 'oyasumi... mata ashita!', zh: '晚安……明天見！' },
      ],
    },
  },
  {
    id: 'cat', name: 'ミケ', ro: 'Mike', zh: '小貓',
    note: '聰明又有點得意的三花貓。句尾的「にゃ」是貓的口癖，不是正式日文',
    voice: '猫使ビィ', style: 'ノーマル',
    lines: {
      idle: [
        { jp: 'きょうも ちょっとだけ、ね？', ro: 'kyou mo chotto dake, ne?', zh: '今天也來一點點，好嗎？' },
        { jp: 'いっしょに がんばるにゃ！', ro: 'issho ni ganbaru nya!', zh: '一起加油喵！' },
        { jp: 'ふくおかで ラーメン たべたいにゃ。', ro: 'fukuoka de raamen tabetai nya.', zh: '想在福岡吃拉麵喵。' },
      ],
      cheer: [
        { jp: 'なかなか やるにゃ！', ro: 'nakanaka yaru nya!', zh: '挺有一套的嘛喵！' },
        { jp: 'さすが！', ro: 'sasuga!', zh: '不愧是你！' },
      ],
      encourage: [
        { jp: 'まちがえても だいじょうぶ。', ro: 'machigaete mo daijoubu.', zh: '答錯也沒關係。' },
        { jp: 'もう いっかい やってみよう。', ro: 'mou ikkai yatte miyou.', zh: '再試一次看看吧。' },
      ],
      think: [
        { jp: 'さて、じゅんびは いい？', ro: 'sate, junbi wa ii?', zh: '那麼，準備好了嗎？' },
      ],
      alert: [
        { jp: 'そろそろ べんきょうの じかんにゃ。', ro: 'sorosoro benkyou no jikan nya.', zh: '差不多該唸書了喵。' },
      ],
      sleep: [
        { jp: 'おやすみにゃ……', ro: 'oyasumi nya...', zh: '晚安喵……' },
      ],
    },
  },
];

export const mascotById = id => MASCOTS.find(m => m.id === id) || null;
export const mascotImg = (id, mood) => `img/mascot/${id}_${MOODS.includes(mood) ? mood : 'idle'}.webp`;

// 隨機挑一句，盡量不要跟上一句一樣
export function mascotLine(id, mood, avoid) {
  const m = mascotById(id);
  const list = m?.lines[mood] || m?.lines.idle || [];
  const pool = list.length > 1 ? list.filter(l => l.jp !== avoid?.jp) : list;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

// 首頁的心情：今天還沒學 → 提醒；學過了而且是晚上 → 睡覺；其他 → 待機
export function homeMood(playedToday, hour = new Date().getHours()) {
  if (!playedToday) return 'alert';
  if (hour >= 21 || hour < 5) return 'sleep';
  return 'idle';
}
