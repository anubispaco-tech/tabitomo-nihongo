# 旅伴日語 Tabitomo

零基礎、每天 5 分鐘的遊戲化日語學習 PWA。玩家和原創小蝦旅伴「たびまる」一起從五十音學起，一路「旅行」到能在日本開口。

## 目前內容：序章 v0.1

| 站 | 主題 | 新內容 |
| --- | --- | --- |
| 1 登機 | あ行 | あいうえお |
| 2 翻開旅遊書 | か行 | かきくけこ |
| 3 機上餐車 | さ行 | さしすせそ |
| 4 機上雜誌 | た行 | たちつてと |
| 5 鄰座的小朋友 | な行 | なにぬねの |
| 6 抵達之前 | 旅遊招呼語 | こんにちは、すみません、おねがいします、これ、ください、ありがとうございます |

## 結構

```
index.html            入口
css/style.css         日系養成風 UI
js/app.js             畫面與互動
js/engine.js          Leitner 5 盒 SRS、組題、旅伴成長、連續天數
js/store.js           IndexedDB 存檔（失敗時退回 localStorage）
js/audio.js           瀏覽器日文 TTS＋合成音效
js/companion.js       たびまる SVG（三階段成長）
data/prologue.json    序章題庫
sw.js                 離線快取
```

## 部署

GitHub Pages：Settings › Pages › Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)`。

## 本機測試

```
python3 -m http.server 8000
```

開啟 http://localhost:8000 。

## 內容來源

序章的假名、例字與會話句由 Claude 以日語教師角度編寫並審稿；字源與注音近似音僅供記憶參考。第 1 章起單字預計使用 JMdict、例句使用 Tatoeba，並依授權標示出處。
