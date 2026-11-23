// public/js/utils.js (force Node backend on port 3000)
(() => {
  const DEFAULT_LOCAL_PORT = 3000;

  // Always point API to Express server on port 3000
  const API_HOST = `http://localhost:${DEFAULT_LOCAL_PORT}`;
  const API_BASE = API_HOST + '/api';
  const API_ROOT = API_BASE;

  function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  async function fetchJson(pathOrUrl, opts) {
    let url;
    if (/^https?:\/\//i.test(pathOrUrl)) {
      url = pathOrUrl;
    } else if (pathOrUrl.startsWith('/api')) {
      url = API_HOST + pathOrUrl;
    } else if (pathOrUrl.startsWith('/')) {
      url = API_BASE + pathOrUrl;
    } else {
      url = API_BASE + '/' + pathOrUrl.replace(/^\/+/, '');
    }

    const res = await fetch(url, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Fetch error', url, res.status, text);
      throw new Error(`Fetch ${url} failed: ${res.status}`);
    }
    return res.json();
  }

  window.API_BASE = API_BASE;
  window.API_ROOT = API_ROOT;
  window.API_HOST = API_HOST;
  window.fetchJson = fetchJson;
  window.safeNumber = safeNumber;
})();
