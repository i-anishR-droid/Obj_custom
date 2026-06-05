/**
 * Draft Banner — reads draft files from state/drafts/ (via service worker),
 * shows a persistent banner with a count and a Publish button.
 *
 * Draft files are written by the object-customization Claude plugin's
 * draft_manager.py / schema_engine.py --save-draft.
 *
 * The "Publish" button publishes all drafts to the DevRev API and clears them.
 */

import { showToast } from './toast.js';

const DRAFT_POLL_MS = 3000;
let _pollTimer = null;
let _bannerEl = null;

// ---------------------------------------------------------------------------
// Service-worker messages
// ---------------------------------------------------------------------------

function swMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!resp) return reject(new Error('No response from service worker'));
      if (!resp.success) return reject(new Error(resp.error || 'Service worker error'));
      resolve(resp.data);
    });
  });
}

// ---------------------------------------------------------------------------
// Draft polling
// ---------------------------------------------------------------------------

export async function getDrafts() {
  try {
    const data = await swMessage('GET_DRAFTS');
    return { drafts: data.drafts || [], serverRunning: data.serverRunning !== false };
  } catch {
    return { drafts: [], serverRunning: false };
  }
}

export async function publishAllDrafts() {
  const data = await swMessage('PUBLISH_DRAFTS');
  return data;
}

export async function clearAllDrafts() {
  const data = await swMessage('CLEAR_DRAFTS');
  return data;
}

// ---------------------------------------------------------------------------
// Banner rendering
// ---------------------------------------------------------------------------

function createBanner() {
  const el = document.createElement('div');
  el.id = 'draft-banner';
  el.className = 'draft-banner draft-banner--hidden';
  el.innerHTML = `
    <div class="draft-banner-left">
      <svg class="draft-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <span class="draft-banner-text"></span>
    </div>
    <div class="draft-banner-right">
      <button class="draft-banner-btn draft-banner-btn--details" id="draft-details-btn">Details</button>
      <button class="draft-banner-btn draft-banner-btn--discard" id="draft-discard-btn">Discard</button>
      <button class="draft-banner-btn draft-banner-btn--publish" id="draft-publish-btn">Publish</button>
    </div>
  `;
  return el;
}

function updateBanner({ drafts, serverRunning }) {
  if (!_bannerEl) return;

  if (!serverRunning) {
    _bannerEl.classList.remove('draft-banner--hidden');
    const textEl = _bannerEl.querySelector('.draft-banner-text');
    textEl.textContent = 'Draft server not running — start it with: python3 scripts/draft_server.py';
    _bannerEl.querySelector('#draft-publish-btn').style.display = 'none';
    _bannerEl.querySelector('#draft-discard-btn').style.display = 'none';
    _bannerEl.querySelector('#draft-details-btn').style.display = 'none';
    return;
  }

  // Restore buttons (in case server came back online)
  _bannerEl.querySelector('#draft-publish-btn').style.display = '';
  _bannerEl.querySelector('#draft-discard-btn').style.display = '';
  _bannerEl.querySelector('#draft-details-btn').style.display = '';

  if (!drafts || drafts.length === 0) {
    _bannerEl.classList.add('draft-banner--hidden');
    return;
  }

  _bannerEl.classList.remove('draft-banner--hidden');
  const count = drafts.length;
  const textEl = _bannerEl.querySelector('.draft-banner-text');
  textEl.textContent = `${count} pending change${count !== 1 ? 's' : ''} — ready to publish`;
}

function buildDetailsHtml(drafts) {
  if (!drafts.length) return '<p style="color:var(--text-secondary)">No pending drafts.</p>';
  let html = '<table class="draft-details-table"><thead><tr><th>File</th><th>Type</th><th>Leaf</th><th>Subtype</th></tr></thead><tbody>';
  for (const d of drafts) {
    const name = (d.filename || d.name || '').replace(/^.*[\\/]/, '');
    const dt = d.draft_type || d.type || '—';
    const lt = d.leaf_type || '—';
    const st = d.subtype || '—';
    html += `<tr><td class="draft-details-filename">${escapeHtml(name)}</td><td>${escapeHtml(dt)}</td><td>${escapeHtml(lt)}</td><td>${escapeHtml(st)}</td></tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showDetailsModal(drafts) {
  const existing = document.getElementById('draft-details-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'draft-details-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-header">
        <h3 class="modal-title">Pending Drafts (${drafts.length})</h3>
        <button class="modal-close" id="draft-details-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-secondary);margin-bottom:12px;font-size:13px;">
          These draft payloads were created by the <strong>object-customization</strong> Claude plugin.
          Click <strong>Publish</strong> to push them to DevRev, or <strong>Discard</strong> to cancel.
        </p>
        ${buildDetailsHtml(drafts)}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  document.getElementById('draft-details-close').addEventListener('click', () => modal.remove());
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initDraftBanner(container) {
  _bannerEl = createBanner();
  container.insertAdjacentElement('afterbegin', _bannerEl);

  // Publish button
  _bannerEl.querySelector('#draft-publish-btn').addEventListener('click', async () => {
    const btn = _bannerEl.querySelector('#draft-publish-btn');
    btn.textContent = 'Publishing…';
    btn.disabled = true;
    try {
      const result = await publishAllDrafts();
      const published = result.published || 0;
      const failed = result.failed || 0;
      if (failed > 0) {
        showToast(`Published ${published}, failed ${failed}. Check console.`, 'warning');
      } else {
        showToast(`Published ${published} change${published !== 1 ? 's' : ''} to DevRev.`, 'success');
      }
      await poll();
    } catch (err) {
      showToast(`Publish failed: ${err.message}`, 'error');
    } finally {
      btn.textContent = 'Publish';
      btn.disabled = false;
    }
  });

  // Discard button
  _bannerEl.querySelector('#draft-discard-btn').addEventListener('click', async () => {
    if (!confirm('Discard all pending changes? This cannot be undone.')) return;
    try {
      await clearAllDrafts();
      showToast('Pending changes discarded.', 'info');
      await poll();
    } catch (err) {
      showToast(`Discard failed: ${err.message}`, 'error');
    }
  });

  // Details button
  _bannerEl.querySelector('#draft-details-btn').addEventListener('click', async () => {
    const { drafts } = await getDrafts();
    showDetailsModal(drafts);
  });

  // Start polling
  poll();
  _pollTimer = setInterval(poll, DRAFT_POLL_MS);
}

export function destroyDraftBanner() {
  if (_pollTimer) clearInterval(_pollTimer);
  if (_bannerEl) _bannerEl.remove();
  _bannerEl = null;
}

async function poll() {
  const result = await getDrafts();
  updateBanner(result);
}
