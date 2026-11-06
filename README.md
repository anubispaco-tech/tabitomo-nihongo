# 旅伴日語 Tabitomo

零基礎、每天 5 分鐘的遊戲化日語學習 PWA。從五十音學起，一路「旅行」到能在日本開口。學得越多，你種的植物（櫻花樹、龜背芋、鹿角蕨）就長得越大。

## 目前內容：序章 v0.1

| 站 | 主題 | 新內容 |
| --- | --- | --- |
| 1 登機 | あ行 | あいうえお |
| 2 翻開旅遊書 | か行 | かきくけこ |
| 3 機上餐車 | さ行 | さしすせそ |
| 4 機上雜誌 | た行 | たちつてと |
| 5 鄰座的小朋友 | な行 | なにぬねの |
| 6 抵達之前 | 旅遊招呼語 | こんにちは、すみません、おねがいします、これ、ください、ありがとうございます |

## 福岡會話（v0.4.0）

下方「會話」分頁：6 個旅遊場景，各有常用句（可放大給店員看）與一段情境模擬對話。

| 場景 | 情境模擬 |
| --- | --- |
| 🍜 餐廳 | 在天神吃水炊鍋（入座、兒童椅、點餐、結帳） |
| 🏪 便利商店 | 在 7-11 買早餐（加熱、湯匙、袋子、Suica） |
| 🚃 車站與電車 | 搭由布院之森（月台、電梯、指定席） |
| 🏨 飯店 | 博多的飯店入住（寄放行李、護照、早餐） |
| 🧸 帶小孩 | 麵包超人博物館（兒童票、推車、尿布台） |
| 🗺️ 問路與求助 | 在天神迷路（請對方說慢一點） |

題庫在 `data/travel.json`。

## 單字快閃（v0.6.0）

首頁「單字快閃・5 題」：看中文＋圖，10 秒內從 3 個**發音相近**的選項選出日文（例：ねこ／ねぎ／ねつ）。答完顯示含假名注音的例句、羅馬拼音與中文，目標字以朱色標出，另兩個選項的意思也一起列出。單字納入 SRS，答錯或超時隔天再出。

題庫在 `data/words.json`（33 字，旅遊常用名詞）。

## 結構

```
index.html            入口
css/style.css         日系養成風 UI
js/app.js             畫面與互動
js/engine.js          Leitner 5 盒 SRS、組題、旅伴成長、連續天數
js/store.js           IndexedDB 存檔（失敗時退回 localStorage）
js/audio.js           發音（VOICEVOX 預錄音檔優先，退回瀏覽器 TTS）＋合成音效
js/plants.js          植物 SVG（櫻花樹、龜背芋、鹿角蕨，各 4 階段）
data/prologue.json    序章題庫
data/words.json       單字快閃題庫
sw.js                 離線快取（含音檔預載）
audio/                VOICEVOX 產生的音檔（n＝正常、s＝慢速）與 manifest.json
tools/gen-audio.mjs   音檔產生腳本
.github/workflows/voice.yml  在 GitHub Actions 上跑 VOICEVOX 產生音檔
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

## 發音音檔（VOICEVOX）

App 會唸到的每一句日文，都由 [VOICEVOX](https://voicevox.hiroshiba.jp/) 預先合成成 mp3，正常速度和慢速各一份。慢速是另外合成的，不是播放時拉長，聲音才不會變形。沒有音檔的句子，會自動退回使用瀏覽器內建的語音。

- **自動**：推送 `data/` 或 `js/` 的變更後，Actions 會自動補產生新句子的音檔並提交回來。
- **手動／換聲音**：Actions › 產生發音音檔 › Run workflow
  - `mode = samples`：產生各候選聲音的試聽檔到 `audio/_samples/`
  - `mode = generate`、`speaker = 角色名`：用指定的聲音重新產生全部音檔
- 使用聲音前，請先確認該角色的使用規約；App 內會自動標示「VOICEVOX:角色名」。
