const crmDb = {
  dbName: 'crm_behind_schedule_db',
  dbVersion: 1,
  db: null,

  init() {
    return new Promise((resolve) => {
      if (this.db) return resolve(this.db);
      const req = indexedDB.open(this.dbName, this.dbVersion);
      req.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        resolve(null);
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('customers')) {
          db.createObjectStore('customers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('metrics')) {
          db.createObjectStore('metrics', { keyPath: 'CIF_ID' });
        }
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'summary.groupName' });
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      };
    });
  },

  async get(storeName, key) {
    const db = await this.init();
    if (!db) {
      const val = localStorage.getItem(`crmDb_${storeName}_${key}`);
      return val ? JSON.parse(val) : null;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch(e) { resolve(null); }
    });
  },

  async getAll(storeName) {
    const db = await this.init();
    if (!db) {
      const list = [];
      for(let i=0; i<localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(`crmDb_${storeName}_`)) {
          list.push(JSON.parse(localStorage.getItem(k)));
        }
      }
      return list;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch(e) { resolve([]); }
    });
  },

  async put(storeName, val) {
    const db = await this.init();
    const key = storeName === 'customers' ? val.id : (storeName === 'metrics' ? val.CIF_ID : val.summary.groupName);
    if (!db) {
      try {
        localStorage.setItem(`crmDb_${storeName}_${key}`, JSON.stringify(val));
      } catch(e) {}
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(val);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch(e) { resolve(false); }
    });
  },

  async putKV(key, val) {
    const db = await this.init();
    if (!db) {
      try {
        localStorage.setItem(`crmDb_kv_${key}`, JSON.stringify(val));
      } catch(e) {}
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('kv', 'readwrite');
        const store = tx.objectStore('kv');
        const req = store.put(val, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch(e) { resolve(false); }
    });
  },

  async getKV(key) {
    const db = await this.init();
    if (!db) {
      const val = localStorage.getItem(`crmDb_kv_${key}`);
      return val ? JSON.parse(val) : null;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('kv', 'readonly');
        const store = tx.objectStore('kv');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch(e) { resolve(null); }
    });
  },

  async clearStore(storeName) {
    const db = await this.init();
    if (!db) {
      for(let i=localStorage.length-1; i>=0; i--) {
        const k = localStorage.key(i);
        if (k.startsWith(`crmDb_${storeName}_`)) localStorage.removeItem(k);
      }
      return;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch(e) { resolve(false); }
    });
  }
};
