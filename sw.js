// 離線快取：自家檔案網路優先（一推送就拿到新版，斷網時用快取），字型快取優先
const VERSION = 'tabitomo-v0.4.0';
const AUDIO = 'tabitomo-audio'; // 音檔檔名是內容雜湊，不會變，獨立快取、換版不清
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/engine.js',
  'js/store.js',
  'js/audio.js',
  'js/plants.js',
  'data/prologue.json',
  'data/travel.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
  e.waitUntil(precacheAudio()); // 背景預載全部發音，失敗不影響安裝

});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== AUDIO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && /\/audio\/[ns]\/[0-9a-f]+\.mp3$/.test(url.pathname)) {
    e.respondWith(
      caches.open(AUDIO).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  // 音檔清單更新時（Actions 產生新音檔），順便在背景補齊快取
  if (url.origin === location.origin && url.pathname.endsWith('/audio/manifest.json')) e.waitUntil(precacheAudio());

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});

async function precacheAudio() {
  try {
    const m = await (await fetch('audio/manifest.json', { cache: 'no-cache' })).json();
    const c = await caches.open(AUDIO);
    const want = new Set();
    for (const h of new Set(Object.values(m.files || {}))) {
      for (const d of ['n', 's']) want.add(new URL(`audio/${d}/${h}.mp3`, self.registration.scope).href);
    }
    // 刪掉舊聲音的檔案
    for (const req of await c.keys()) if (!want.has(req.url)) await c.delete(req);
    for (const u of want) if (!(await c.match(u))) { try { await c.add(u); } catch (e) { /* 下次再試 */ } }
  } catch (e) { /* 還沒有音檔 */ }
}
