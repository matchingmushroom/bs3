const API_BASE = (() => {
  const stored = localStorage.getItem('crm_api_base');
  if (stored) return stored;
  const url = new URL(window.location.href);
  if (url.origin.includes('google.com') || url.origin.includes('googleusercontent.com')) {
    return url.origin + url.pathname;
  }
  return 'https://script.google.com/macros/s/AKfycbydwcqyb5uGC1KSSumY04Y5wc3Vt2y2RqGH6ucuJgercdbyAoTl2h2fjTInLGr4WqmR/exec';
})();

const _pendingRequests = {};
async function callBackend(action, params = {}, signal) {
  const key = action + '|' + JSON.stringify(params);
  if (_pendingRequests[key]) return _pendingRequests[key];

  const url = new URL(API_BASE);
  url.searchParams.append('action', action);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  
  const promise = (async () => {
    const response = await fetch(url.toString(), { signal });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return await response.json();
  })();
  _pendingRequests[key] = promise;
  promise.then(() => {}, () => {}).finally(() => { delete _pendingRequests[key]; });
  return promise;
}

async function isCacheFresh(cacheKey = 'last_full_sync', maxAgeMs = 5 * 60 * 1000) {
  const ts = await crmDb.getKV(cacheKey);
  return ts && (Date.now() - ts < maxAgeMs);
}

async function getCachedExtraDetails(cifId, maxAgeMs = 15 * 60 * 1000) {
  if (window.db) {
    try {
      const doc = await window.db.collection('customerInfo').doc(cifId).get();
      if (doc.exists) return doc.data();
    } catch(e) {}
  }
  const cached = await crmDb.getKV('contact_' + cifId);
  if (cached && cached._cachedAt && (Date.now() - cached._cachedAt < maxAgeMs)) {
    return cached;
  }
  if (!navigator.onLine) return cached || null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const data = await callBackend('extraDetails', { cifId }, controller.signal);
    clearTimeout(timeoutId);
    if (data) {
      data._cachedAt = Date.now();
      await crmDb.putKV('contact_' + cifId, data);
    }
    return data;
  } catch (e) {
    clearTimeout(timeoutId);
    return cached || null;
  }
}

async function setCachedInsights(cifId, key, data) {
  if (data) {
    data._cachedAt = Date.now();
    await crmDb.putKV(key + '_' + cifId, data);
  }
}

async function getCachedInsights(cifId, apiAction, cacheKey) {
  if (window.db) {
    try {
      const doc = await window.db.collection('insights').doc(cifId).get();
      if (doc.exists) return doc.data();
    } catch(e) {}
  }
  const cached = await crmDb.getKV(cacheKey + '_' + cifId);
  if (cached && cached._cachedAt && (Date.now() - cached._cachedAt < 5 * 60 * 1000)) {
    return cached;
  }
  if (!navigator.onLine) return cached || null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const data = await callBackend(apiAction, { cifId }, controller.signal);
    clearTimeout(timeoutId);
    if (data) {
      data._cachedAt = Date.now();
      await crmDb.putKV(cacheKey + '_' + cifId, data);
    }
    return data;
  } catch (e) {
    clearTimeout(timeoutId);
    return cached || null;
  }
}
