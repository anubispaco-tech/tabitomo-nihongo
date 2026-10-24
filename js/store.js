// 存檔：IndexedDB 為主，失敗時退回 localStorage
const DB_NAME = 'tabitomo';
const DB_VER = 1;
const LS_KEY = 'tabitomo-state';
let dbPromise = null;

function openDB() {
  if (!('indexedDB' in self)) return Promise.reject(new Error('no indexedDB'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const result = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export async function loadState() {
  try {
    const st = await run('kv', 'readonly', s => s.get('state'));
    if (st) return st;
  } catch (e) { /* 退回 localStorage */ }
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { return null; }
}

export async function saveState(state) {
  try {
    await run('kv', 'readwrite', s => s.put(state, 'state'));
  } catch (e) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e2) { /* 無法存檔 */ }
  }
}

export async function addLogs(logs) {
  if (!logs.length) return;
  try {
    await run('logs', 'readwrite', s => { logs.forEach(l => s.add(l)); return null; });
  } catch (e) { /* 紀錄失敗不影響遊玩 */ }
}

export async function allLogs() {
  try { return await run('logs', 'readonly', s => s.getAll()); } catch (e) { return []; }
}

export async function clearAll() {
  try {
    await run('kv', 'readwrite', s => s.clear());
    await run('logs', 'readwrite', s => s.clear());
  } catch (e) { /* ignore */ }
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch (e) { /* ignore */ }
}
