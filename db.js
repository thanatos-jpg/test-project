// Storage layer. Everything that touches persistence goes through window.Store,
// so the backend (IndexedDB today) can be swapped for a cloud service later.
(() => {
  const DB_NAME = 'world-food-log';
  const STORE = 'visits';
  let dbPromise;

  function open() {
    dbPromise ||= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function run(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let req;
      try {
        req = fn(tx.objectStore(STORE));
      } catch (e) {
        reject(e);
        return;
      }
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  window.Store = {
    all: () => run('readonly', s => s.getAll()),
    put: visit => run('readwrite', s => s.put(visit)),
    putMany: list => run('readwrite', s => { list.forEach(v => s.put(v)); }),
    remove: id => run('readwrite', s => s.delete(id)),
  };
})();
