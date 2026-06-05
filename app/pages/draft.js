import { showToast } from '../lib/toast.js';
import { FIELD_TYPE_LABELS } from '../constants.js';

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

function renderFieldRow(field, status = 'unchanged') {
  const statusColors = { added: '#10b981', removed: '#ef4444', modified: '#f59e0b', unchanged: '#6b7280' };
  const statusIcons = { added: '+', removed: '-', modified: '~', unchanged: '' };
  const bgColors = { added: '#10b98110', removed: '#ef444410', modified: '#f59e0b10', unchanged: 'transparent' };

  const name = field.name || '—';
  const type = field.field_type || field.type || '—';
  const required = field.is_required ? 'Yes' : 'No';
  const displayName = field.ui?.display_name || name;

  return `
    <tr style="background:${bgColors[status]}">
      <td style="width:24px;text-align:center;font-weight:700;color:${statusColors[status]}">${statusIcons[status]}</td>
      <td><code style="font-size:12px">${escapeHtml(name)}</code></td>
      <td style="font-size:12px;color:#6b7280">${escapeHtml(displayName)}</td>
      <td>${fieldBadge(type)}</td>
      <td style="font-size:12px">${required}</td>
    </tr>`;
}

function diffFields(originalFields, proposedFields) {
  const origMap = new Map((originalFields || []).map(f => [f.name, f]));
  const propMap = new Map((proposedFields || []).map(f => [f.name, f]));

  const rows = [];

  for (const [name, field] of propMap) {
    if (!origMap.has(name)) {
      rows.push({ field, status: 'added' });
    } else {
      const orig = origMap.get(name);
      const changed = JSON.stringify(orig) !== JSON.stringify(field);
      rows.push({ field, status: changed ? 'modified' : 'unchanged' });
    }
  }

  for (const [name, field] of origMap) {
    if (!propMap.has(name)) {
      rows.push({ field, status: 'removed' });
    }
  }

  return rows;
}

function renderComparisonView(draft, original) {
  const proposedFields = draft.fields || [];
  const originalFields = original?.fields || [];
  const diffRows = diffFields(originalFields, proposedFields);

  const addedCount = diffRows.filter(r => r.status === 'added').length;
  const removedCount = diffRows.filter(r => r.status === 'removed').length;
  const modifiedCount = diffRows.filter(r => r.status === 'modified').length;

  let summaryHtml = '';
  if (addedCount || removedCount || modifiedCount) {
    const parts = [];
    if (addedCount) parts.push(`<span style="color:#10b981;font-weight:600">+${addedCount} added</span>`);
    if (modifiedCount) parts.push(`<span style="color:#f59e0b;font-weight:600">~${modifiedCount} modified</span>`);
    if (removedCount) parts.push(`<span style="color:#ef4444;font-weight:600">-${removedCount} removed</span>`);
    summaryHtml = `<div class="diff-summary">${parts.join(' &nbsp; ')}</div>`;
  } else {
    summaryHtml = `<div class="diff-summary" style="color:#6b7280">No field changes detected</div>`;
  }

  const diffTableHtml = diffRows.length ? `
    <table class="diff-table">
      <thead><tr><th></th><th>Field Name</th><th>Display Name</th><th>Type</th><th>Required</th></tr></thead>
      <tbody>${diffRows.map(r => renderFieldRow(r.field, r.status)).join('')}</tbody>
    </table>` : '';

  // Side-by-side panels
  const originalPanel = `
    <div class="comparison-panel comparison-panel--original">
      <div class="comparison-panel-header">
        <span class="comparison-panel-label comparison-panel-label--original">Current (Live)</span>
        <span class="comparison-panel-count">${originalFields.length} fields</span>
      </div>
      <div class="comparison-panel-body">
        ${originalFields.length ? `
          <table class="comparison-table">
            <thead><tr><th>Name</th><th>Type</th><th>Required</th></tr></thead>
            <tbody>${originalFields.map(f => `
              <tr>
                <td><code style="font-size:11px">${escapeHtml(f.name)}</code></td>
                <td>${fieldBadge(f.field_type || f.type || '')}</td>
                <td style="font-size:11px">${f.is_required ? 'Yes' : 'No'}</td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div class="comparison-empty">No existing fields</div>'}
      </div>
    </div>`;

  const proposedPanel = `
    <div class="comparison-panel comparison-panel--proposed">
      <div class="comparison-panel-header">
        <span class="comparison-panel-label comparison-panel-label--proposed">Proposed (Draft)</span>
        <span class="comparison-panel-count">${proposedFields.length} fields</span>
      </div>
      <div class="comparison-panel-body">
        ${proposedFields.length ? `
          <table class="comparison-table">
            <thead><tr><th>Name</th><th>Type</th><th>Required</th></tr></thead>
            <tbody>${proposedFields.map(f => {
              const isNew = !originalFields.find(o => o.name === f.name);
              const bg = isNew ? '#10b98110' : 'transparent';
              return `
              <tr style="background:${bg}">
                <td><code style="font-size:11px">${escapeHtml(f.name)}</code>${isNew ? ' <span style="color:#10b981;font-size:10px;font-weight:700">NEW</span>' : ''}</td>
                <td>${fieldBadge(f.field_type || f.type || '')}</td>
                <td style="font-size:11px">${f.is_required ? 'Yes' : 'No'}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table>` : '<div class="comparison-empty">No fields in draft</div>'}
      </div>
    </div>`;

  return `
    ${summaryHtml}
    <div class="comparison-grid">${originalPanel}${proposedPanel}</div>
    ${diffTableHtml ? `<div class="diff-section"><div class="diff-section-title">Change Details</div>${diffTableHtml}</div>` : ''}
  `;
}

function renderConditionsComparison(draft, original) {
  const proposedConditions = draft.conditions || [];
  const originalConditions = original?.conditions || [];

  if (!proposedConditions.length && !originalConditions.length) return '';

  return `
    <div class="diff-section">
      <div class="diff-section-title">Conditions / Dependencies</div>
      <div class="comparison-grid">
        <div class="comparison-panel comparison-panel--original">
          <div class="comparison-panel-header">
            <span class="comparison-panel-label comparison-panel-label--original">Current</span>
            <span class="comparison-panel-count">${originalConditions.length} rules</span>
          </div>
          <div class="comparison-panel-body">
            ${originalConditions.length ? originalConditions.map(c => `
              <div class="condition-item">
                <code class="condition-expr">${escapeHtml(c.expression || '')}</code>
                <div class="condition-effects">${(c.effects || []).map(e => {
                  if (e.show != null) return `<span class="effect-tag">show: ${e.show}</span>`;
                  if (e.require != null) return `<span class="effect-tag">require: ${e.require}</span>`;
                  return '';
                }).join('')}</div>
              </div>`).join('') : '<div class="comparison-empty">No conditions</div>'}
          </div>
        </div>
        <div class="comparison-panel comparison-panel--proposed">
          <div class="comparison-panel-header">
            <span class="comparison-panel-label comparison-panel-label--proposed">Proposed</span>
            <span class="comparison-panel-count">${proposedConditions.length} rules</span>
          </div>
          <div class="comparison-panel-body">
            ${proposedConditions.length ? proposedConditions.map(c => `
              <div class="condition-item">
                <code class="condition-expr">${escapeHtml(c.expression || '')}</code>
                <div class="condition-effects">${(c.effects || []).map(e => {
                  if (e.show != null) return `<span class="effect-tag">show: ${e.show}</span>`;
                  if (e.require != null) return `<span class="effect-tag">require: ${e.require}</span>`;
                  return '';
                }).join('')}</div>
              </div>`).join('') : '<div class="comparison-empty">No conditions</div>'}
          </div>
        </div>
      </div>
    </div>`;
}

function renderDraftCard(draft, index, original) {
  const filename = (draft.filename || '').replace(/^.*[\\/]/, '');
  const draftType = draft.draft_type || draft.type || 'schema';
  const leafType = draft.leaf_type || '—';
  const subtype = draft.subtype_display_name || draft.subtype || '';
  const isStage = draftType === 'stage_diagram' || filename.includes('stage_diagram');

  let comparisonHtml = '';
  if (isStage) {
    const stages = draft.stages || [];
    comparisonHtml = `
      <div class="draft-card-section">
        <div class="diff-section-title">Stages (${stages.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
          ${stages.map(s => `<span style="padding:4px 10px;border-radius:6px;font-size:12px;background:#f3f4f6;border:1px solid #e5e7eb">${escapeHtml(s.stage_id?.split('/').pop() || '?')}${s.is_start ? ' <span style="color:#f59e0b">★</span>' : ''}</span>`).join('')}
        </div>
      </div>`;
  } else {
    comparisonHtml = renderComparisonView(draft, original);
    comparisonHtml += renderConditionsComparison(draft, original);
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
      <div class="draft-card-comparison">${comparisonHtml}</div>
    </div>`;
}

async function fetchOriginalForDraft(draft) {
  // If the draft has _original embedded (agent put it there), use that
  if (draft._original) return draft._original;

  // Otherwise try to fetch from DevRev
  try {
    const leafType = draft.leaf_type || 'ticket';
    const subtype = draft.subtype || '';
    const fragmentType = draft.type || 'custom_type_fragment';

    const data = await swMessage('FETCH_ORIGINAL_STATE', { leafType, subtype, fragmentType });
    const fragments = data.result || [];

    if (subtype) {
      return fragments.find(f => f.subtype === subtype) || null;
    }
    return fragments[0] || null;
  } catch {
    return null;
  }
}

export async function renderDraftPage(container) {
  container.innerHTML = `
    <div class="draft-page">
      <div class="draft-page-header">
        <div>
          <h2 class="draft-page-title">Draft Changes</h2>
          <p class="draft-page-subtitle">Review proposed changes side-by-side with current live state. Publish when ready.</p>
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
  body.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><div class="spinner"></div></div><div>Loading drafts...</div></div>`;

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
        <p style="margin-top:12px;font-size:12px;color:var(--text-muted)">The agent will start this automatically when you use object customization commands.</p>
      </div>`;
    actionsEl.innerHTML = '';
    return;
  }

  if (!drafts.length) {
    body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="width:40px;height:40px"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <div class="empty-state-title">No pending drafts</div>
        <div class="empty-state-body">Use the Claude agent to describe your schema changes. Drafts will appear here for review.</div>
      </div>`;
    actionsEl.innerHTML = '';
    return;
  }

  // Fetch originals for all drafts
  body.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><div class="spinner"></div></div><div>Loading comparison data...</div></div>`;

  const originals = await Promise.all(drafts.map(d => fetchOriginalForDraft(d)));

  actionsEl.innerHTML = `
    <button class="btn btn-sm btn-secondary" id="discard-all-btn">Discard All</button>
    <button class="btn btn-sm btn-primary" id="publish-all-btn">Publish All (${drafts.length})</button>`;

  body.innerHTML = drafts.map((d, i) => renderDraftCard(d, i, originals[i])).join('');

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
  if (btn) { btn.textContent = 'Publishing...'; btn.disabled = true; }
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
    if (btn) { btn.textContent = 'Publish All'; btn.disabled = false; }
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
