const API_BASE = 'https://api.devrev.ai';
const API_INTERNAL = 'https://api.devrev.ai/internal';

async function getDraftServerBase() {
  const { draftServerPort } = await chrome.storage.local.get('draftServerPort');
  const port = draftServerPort || 7432;
  return `http://127.0.0.1:${port}`;
}

async function getPat() {
  const { devrev_pat, pat_source } = await chrome.storage.local.get(['devrev_pat', 'pat_source']);

  // If the PAT came from the agent, re-check the agent each call —
  // the agent's SessionEnd hook clears it, and we should immediately stop using it.
  if (pat_source === 'agent') {
    try {
      const base = await getDraftServerBase();
      const resp = await fetch(`${base}/auth`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.pat) {
          // Sync if agent rotated the token
          if (data.pat !== devrev_pat) {
            await chrome.storage.local.set({ devrev_pat: data.pat, pat_source: 'agent' });
          }
          return data.pat;
        }
      }
      // Server reachable but no PAT — agent has cleared it. Wipe local copy.
      await chrome.storage.local.remove(['devrev_pat', 'pat_source']);
      return null;
    } catch {
      // Server unreachable — fall through to whatever's in storage
      return devrev_pat || null;
    }
  }

  if (devrev_pat) return devrev_pat;

  // No PAT yet — try fetching from agent's draft server
  try {
    const base = await getDraftServerBase();
    const resp = await fetch(`${base}/auth`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.pat) {
        await chrome.storage.local.set({ devrev_pat: data.pat, pat_source: 'agent' });
        return data.pat;
      }
    }
  } catch { /* server not running */ }

  return null;
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
    return true;
  }

  if (message.type === 'SET_AUTH') {
    chrome.storage.local.set({ devrev_pat: message.pat, pat_source: 'manual' }, () => {
      apiRequest('GET', 'dev-users.self', { useInternal: false })
        .then(data => sendResponse({ success: true, data }))
        .catch(err => {
          chrome.storage.local.remove(['devrev_pat', 'pat_source']);
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

  // Try to sync PAT from draft server (agent pushed it)
  if (message.type === 'SYNC_AUTH_FROM_AGENT') {
    (async () => {
      try {
        const base = await getDraftServerBase();
        const resp = await fetch(`${base}/auth`);
        if (!resp.ok) {
          sendResponse({ success: true, data: { synced: false, reason: 'server_unavailable' } });
          return;
        }
        const authData = await resp.json();
        if (!authData.pat) {
          sendResponse({ success: true, data: { synced: false, reason: 'no_pat' } });
          return;
        }
        await chrome.storage.local.set({ devrev_pat: authData.pat, pat_source: 'agent' });
        const user = await apiRequest('GET', 'dev-users.self', { useInternal: false });
        sendResponse({ success: true, data: { synced: true, ...user } });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['devrev_pat', 'pat_source'], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── Draft management ──

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
          sendResponse({ success: true, data: { drafts: [], serverRunning: false } });
          return;
        }
        const data = await resp.json();
        sendResponse({ success: true, data: { drafts: data.drafts || [], serverRunning: true } });
      } catch {
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
              Object.entries(draft).filter(([k]) => !['draft_type', 'filename', 'error', '_original'].includes(k))
            );
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
          Object.entries(draft).filter(([k]) => !['draft_type', 'filename', 'error', '_original'].includes(k))
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

  // Fetch original/current state from DevRev for comparison
  if (message.type === 'FETCH_ORIGINAL_STATE') {
    (async () => {
      try {
        const { leafType, subtype, fragmentType } = message;
        const params = { leaf_type: leafType };
        if (fragmentType) params.types = fragmentType;
        if (subtype) params.subtype = subtype;
        const data = await apiRequest('GET', 'schemas.custom.list', { params });
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
