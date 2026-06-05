const API_BASE = 'https://api.devrev.ai';
const API_INTERNAL = 'https://api.devrev.ai/internal';

// Draft server — the object-customization Claude plugin runs a local HTTP server
// (draft_server.py) at http://127.0.0.1:<port> that exposes state/drafts/.
// Default port is 7432. Configurable via chrome.storage.local key 'draftServerPort'.
async function getDraftServerBase() {
  const { draftServerPort } = await chrome.storage.local.get('draftServerPort');
  const port = draftServerPort || 7432;
  return `http://127.0.0.1:${port}`;
}

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

  // -------------------------------------------------------------------------
  // Draft management — read/publish/clear draft files from the Claude plugin
  // -------------------------------------------------------------------------

  if (message.type === 'SET_DRAFT_SERVER_PORT') {
    chrome.storage.local.set({ draftServerPort: message.port }, () => {
      sendResponse({ success: true, data: { port: message.port } });
    });
    return true;
  }

  if (message.type === 'GET_DRAFTS') {
    (async () => {
      try {
        const base = await getDraftServerBase();
        const resp = await fetch(`${base}/drafts`);
        if (!resp.ok) {
          // Draft server not running — return empty with a hint
          sendResponse({ success: true, data: { drafts: [], serverRunning: false } });
          return;
        }
        const data = await resp.json();
        sendResponse({ success: true, data: { drafts: data.drafts || [], serverRunning: true } });
      } catch {
        // ECONNREFUSED — server not started
        sendResponse({ success: true, data: { drafts: [], serverRunning: false } });
      }
    })();
    return true;
  }

  if (message.type === 'PUBLISH_DRAFTS') {
    (async () => {
      try {
        const base = await getDraftServerBase();
        const resp = await fetch(`${base}/drafts`);
        if (!resp.ok) {
          sendResponse({ success: true, data: { published: 0, failed: 0, serverRunning: false } });
          return;
        }
        const { drafts } = await resp.json();
        if (!drafts || !drafts.length) {
          sendResponse({ success: true, data: { published: 0, failed: 0 } });
          return;
        }

        let published = 0;
        let failed = 0;

        for (const draft of drafts) {
          try {
            const draftType = draft.draft_type || draft.type || 'schema';
            const endpoint = (draftType === 'stage_diagram' || draft.filename?.includes('stage_diagram'))
              ? 'stage-diagrams.create'
              : 'schemas.custom.set';

            const clean = Object.fromEntries(
              Object.entries(draft).filter(([k]) => !['draft_type', 'filename', 'error'].includes(k))
            );
            // DevRev API requires description — inject fallback if missing
            if (!clean.description) {
              clean.description = `Custom fields for ${clean.subtype_display_name || clean.subtype || clean.leaf_type}`;
            }
            await apiRequest('POST', endpoint, { body: clean });
            published++;
          } catch (err) {
            console.error('Draft publish failed:', err.message, draft.filename);
            failed++;
          }
        }

        // If all succeeded, clear via DELETE; otherwise leave failures for retry
        if (failed === 0) {
          await fetch(`${base}/drafts`, { method: 'DELETE' });
        }

        sendResponse({ success: true, data: { published, failed } });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'CLEAR_DRAFTS') {
    (async () => {
      try {
        const base = await getDraftServerBase();
        await fetch(`${base}/drafts`, { method: 'DELETE' });
        sendResponse({ success: true, data: { cleared: true } });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'PUBLISH_DRAFT') {
    (async () => {
      try {
        const base = await getDraftServerBase();
        const resp = await fetch(`${base}/drafts`);
        const { drafts } = await resp.json();
        const draft = drafts.find(d => d.filename === message.filename);
        if (!draft) throw new Error(`Draft not found: ${message.filename}`);

        const draftType = draft.draft_type || draft.type || 'schema';
        const endpoint = (draftType === 'stage_diagram' || message.filename?.includes('stage_diagram'))
          ? 'stage-diagrams.create'
          : 'schemas.custom.set';
        const clean = Object.fromEntries(
          Object.entries(draft).filter(([k]) => !['draft_type', 'filename', 'error'].includes(k))
        );
        if (!clean.description) {
          clean.description = `Custom fields for ${clean.subtype_display_name || clean.subtype || clean.leaf_type}`;
        }
        await apiRequest('POST', endpoint, { body: clean });
        await fetch(`${base}/draft/${encodeURIComponent(message.filename)}`, { method: 'DELETE' });
        sendResponse({ success: true, data: { published: 1 } });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'DISCARD_DRAFT') {
    (async () => {
      try {
        const base = await getDraftServerBase();
        await fetch(`${base}/draft/${encodeURIComponent(message.filename)}`, { method: 'DELETE' });
        sendResponse({ success: true, data: { discarded: true } });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
