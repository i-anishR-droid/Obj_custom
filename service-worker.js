const API_BASE = 'https://api.devrev.ai';
const API_INTERNAL = 'https://api.devrev.ai/internal';

async function getPat() {
  const { devrev_pat } = await chrome.storage.local.get('devrev_pat');
  return devrev_pat || null;
}

async function apiRequest(method, endpoint, { params, body, useInternal = true } = {}) {
  const pat = await getPat();
  if (!pat) throw new Error('Not authenticated');

  const base = useInternal ? API_INTERNAL : API_BASE;
  let url = `${base}/${endpoint}`;

  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  const data = await res.json();

  if (!res.ok) {
    const msg = data.message || data.error || `API error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    const { method, endpoint, params, body, useInternal } = message;
    apiRequest(method, endpoint, { params, body, useInternal })
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'SET_AUTH') {
    chrome.storage.local.set({ devrev_pat: message.pat }, () => {
      // validate by calling dev-users.self
      apiRequest('GET', 'dev-users.self', { useInternal: false })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => {
          chrome.storage.local.remove('devrev_pat');
          sendResponse({ success: false, error: err.message });
        });
    });
    return true;
  }

  if (message.type === 'GET_AUTH') {
    getPat().then(pat => {
      if (!pat) {
        sendResponse({ success: true, data: { authenticated: false } });
        return;
      }
      apiRequest('GET', 'dev-users.self', { useInternal: false })
        .then(data => sendResponse({ success: true, data: { authenticated: true, ...data } }))
        .catch(() => sendResponse({ success: true, data: { authenticated: false } }));
    });
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove('devrev_pat', () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
