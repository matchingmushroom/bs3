const crmDb = {
  dbName: 'crm_behind_schedule_db',
  dbVersion: 1,
  db: null,

  async init() {
    console.log('crmDb initialized in online-only mode (no local storage/cache).');
    return null;
  },

  async get(storeName, key) {
    return null;
  },

  async getAll(storeName) {
    return [];
  },

  async put(storeName, val) {
    return true;
  },

  async putKV(key, val) {
    return true;
  },

  async getKV(key) {
    return null;
  },

  async clearStore(storeName) {
    return true;
  }
};
