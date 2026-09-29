// Floor 7 storage: everything lives in IndexedDB on this device.
// Stage 2 will add syncing to an online database on top of this.
const DB = (() => {
  const NAME = 'floor7', STORE = 'kv';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const s = t.objectStore(STORE);
      const r = fn(s);
      t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    get: (key) => tx('readonly', (s) => s.get(key)),
    set: (key, val) => tx('readwrite', (s) => s.put(val, key)),
    del: (key) => tx('readwrite', (s) => s.delete(key)),
    keys: () => tx('readonly', (s) => s.getAllKeys()),
  };
})();
