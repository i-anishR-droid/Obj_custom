import { showToast } from '../lib/toast.js';

async function swMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (resp) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!resp?.success) return reject(new Error(resp?.error || 'Service worker error'));
      resolve(resp.data);
    });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fieldBadge(type) {
  const colors = {
    enum: '#8b5cf6', text: '#3b82f6', bool: '#10b981', int: '#f59e0b',
    double: '#f59e0b', date: '#06b6d4', timestamp: '#06b6d4', id: '#ef4444',
  };
  const c = colors[type] || '#6b7280';
  return `<span style="display:inline-block;padding:2px 7px;border-radius:9px;font-size:11px;font-weight:600;background:${c}20;color:${c};border:1px solid ${c}40">${escapeHtml(type)}</span>`;
}

function renderDraftCard(draft, index) {
  const filename = (draft.filename || '').replace(/^.*[\\/]/, '');
  const draftType = draft.draft_type || draft.type || 'schema';
  const leafType = draft.leaf_type || '—';
  const subtype = draft.subtype_display_name || draft.subtype || '';
  const fields = draft.fields || [];
  const conditions = draft.conditions || [];
  const stages = draft.stages || [];
  const isStage = draftType === 'stage_diagram' || filename.includes('stage_diagram');

  let previewHtml = '';
  if (isStage) {
    previewHtml = `
      <div class="draft-card-section">
        <div class="draft-card-section-title">Stages (${stages.length})</div>
        <div class="draft-preview-tags">
          ${stages.map(s => `<span class="draft-preview-tag">${escapeHtml(s.stage_id?.split('/').pop() || '?')}${s.is_start ? ' ★' : ''}</span>`).join('')}
        </div>
      </div>`;
  } else {
    if (fields.length) {
      previewHtml += `
        <div class="draft-card-section">
          <div class="draft-card-section-title">Fields (${fields.length})</div>
          <table class="draft-fields-table">
            <thead><tr><th>Name</th><th>Type</th><th>Required</th></tr></thead>
            <tbody>
              ${fields.map(f => `
                <tr>
                  <td><code>${escapeHtml(f.name)}</code></td>
                  <td>${fieldBadge(f.field_type || f.type || '')}</td>
                  <td>${f.is_required ? '<span style="color:var(--success)">Yes</span>' : '<span style="color:var(--text-muted)">No</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
    if (conditions.length) {
      previewHtml += `
        <div class="draft-card-section">
          <div class="draft-card-section-title">Conditions (${conditions.length})</div>
          ${conditions.map(c => `
            <div class="draft-condition-row">
              <code class="draft-condition-expr">${escapeHtml(c.expression || '')}</code>
              <div class="draft-condition-effects">
                ${(c.effects || []).map(e => {
                  if (e.show != null) return `<span class="draft-effect-tag">show: ${e.show}</span>`;
                  if (e.require != null) return `<span class="draft-effect-tag">require: ${e.require}</span>`;
                  if (e.allowed_values) return `<span class="draft-effect-tag">values: [${e.allowed_values.slice(0,3).join(', ')}${e.allowed_values.length > 3 ? '…' : ''}]</span>`;
                  return '';
                }).join('')}
              </div>
            </div>`).join('')}
        </div>`;
    }
  }

  return `
    <div class="draft-card" data-index="${index}">
      <div class="draft-card-header">
        <div class="draft-card-meta">
          <span class="draft-card-leaf">${escapeHtml(leafType)}</span>
          ${subtype ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;color:var(--text-muted)"><polyline points="9 18 15 12 9 6"/></svg><span class="draft-card-subtype">${escapeHtml(subtype)}</span>` : ''}
          <span class="draft-card-type-badge ${isStage ? 'draft-card-type-badge--stage' : ''}">${isStage ? 'Stage Diagram' : 'Schema'}</span>
        </div>
        <div class="draft-card-actions">
          <button class="btn btn-sm btn-secondary draft-discard-btn" data-index="${index}">Discard</button>
          <button class="btn btn-sm btn-primary draft-publish-btn" data-index="${index}">Publish</button>
        </div>
      </div>
      <div class="draft-card-filename">${escapeHtml(filename)}</div>
      ${previewHtml}
    </div>`;
}

export async function renderDraftPage(container) {
  container.innerHTML = `
    <div class="draft-page">
      <div class="draft-page-header">
        <div>
          <h2 class="draft-page-title">Draft Changes</h2>
          <p class="draft-page-subtitle">Changes created by the <strong>object-customization</strong> Claude plugin. Review and publish when ready.</p>
        </div>
        <div class="draft-page-header-actions" id="draft-page-actions"></div>
      </div>
      <div id="draft-page-body"></div>
    </div>`;

  await refreshDraftPage(container);
}

async function refreshDraftPage(container) {
  const body = container.querySelector('#draft-page-body');
  const actionsEl = container.querySelector('#draft-page-actions');
  body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Loading drafts…</div></div>`;

  let drafts = [];
  let serverRunning = false;

  try {
    const data = await swMessage('GET_DRAFTS');
    drafts = data.drafts || [];
    serverRunning = data.serverRunning !== false;
  } catch {
    serverRunning = false;
  }

  if (!serverRunning) {
    body.innerHTML = `
      <div class="draft-server-offline">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;color:var(--warning)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3>Draft server not running</h3>
        <p>Start it in the object-customization plugin folder:</p>
        <code>python3 scripts/draft_server.py</code>
      </div>`;
    actionsEl.innerHTML = '';
    return;
  }

  if (!drafts.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">No pending drafts</div>
        <div class="empty-state-body">Run a Claude plugin command (e.g. <code>/object-customization:set-fields</code>) to create a draft.</div>
      </div>`;
    actionsEl.innerHTML = '';
    return;
  }

  actionsEl.innerHTML = `
    <button class="btn btn-sm btn-secondary" id="discard-all-btn">Discard All</button>
    <button class="btn btn-sm btn-primary" id="publish-all-btn">Publish All (${drafts.length})</button>`;

  body.innerHTML = drafts.map((d, i) => renderDraftCard(d, i)).join('');

  // Publish All
  container.querySelector('#publish-all-btn')?.addEventListener('click', async () => {
    if (!confirm(`Publish all ${drafts.length} draft${drafts.length !== 1 ? 's' : ''} to DevRev?`)) return;
    await runPublishAll(container);
  });

  // Discard All
  container.querySelector('#discard-all-btn')?.addEventListener('click', async () => {
    if (!confirm('Discard all pending drafts? This cannot be undone.')) return;
    try {
      await swMessage('CLEAR_DRAFTS');
      showToast('All drafts discarded.', 'info');
      await refreshDraftPage(container);
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  });

  // Per-card buttons
  container.querySelectorAll('.draft-publish-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index);
      await runPublishOne(container, drafts[idx]);
    });
  });

  container.querySelectorAll('.draft-discard-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index);
      const draft = drafts[idx];
      if (!confirm(`Discard "${(draft.filename || '').split('/').pop()}"?`)) return;
      try {
        await swMessage('DISCARD_DRAFT', { filename: draft.filename });
        showToast('Draft discarded.', 'info');
        await refreshDraftPage(container);
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });
  });
}

async function runPublishAll(container) {
  const btn = container.querySelector('#publish-all-btn');
  if (btn) { btn.textContent = 'Publishing…'; btn.disabled = true; }
  try {
    const result = await swMessage('PUBLISH_DRAFTS');
    const published = result.published || 0;
    const failed = result.failed || 0;
    if (failed > 0) {
      showToast(`Published ${published}, failed ${failed}.`, 'warning');
    } else {
      showToast(`Published ${published} change${published !== 1 ? 's' : ''} to DevRev.`, 'success');
    }
    await refreshDraftPage(container);
  } catch (err) {
    showToast(`Publish failed: ${err.message}`, 'error');
    if (btn) { btn.textContent = `Publish All`; btn.disabled = false; }
  }
}

async function runPublishOne(container, draft) {
  try {
    await swMessage('PUBLISH_DRAFT', { filename: draft.filename });
    showToast('Draft published to DevRev.', 'success');
    await refreshDraftPage(container);
  } catch (err) {
    showToast(`Publish failed: ${err.message}`, 'error');
  }
}
