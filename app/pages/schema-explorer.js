import { api } from '../lib/api-client.js';
import { showToast } from '../lib/toast.js';
import { FIELD_TYPE_LABELS } from '../constants.js';
import { getState } from '../lib/state.js';

let currentTab = 'stock';

function renderJsonTree(data, indent = 0) {
  if (data === null) return '<span class="json-null">null</span>';
  if (typeof data === 'boolean') return `<span class="json-boolean">${data}</span>`;
  if (typeof data === 'number') return `<span class="json-number">${data}</span>`;
  if (typeof data === 'string') return `<span class="json-string">"${escapeHtml(data)}"</span>`;

  if (Array.isArray(data)) {
    if (data.length === 0) return '<span class="json-bracket">[]</span>';
    const items = data.map(item => '  '.repeat(indent + 1) + renderJsonTree(item, indent + 1)).join(',\n');
    return `<span class="json-bracket">[</span>\n${items}\n${'  '.repeat(indent)}<span class="json-bracket">]</span>`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return '<span class="json-bracket">{}</span>';
    const entries = keys.map(key =>
      '  '.repeat(indent + 1) + `<span class="json-key">"${escapeHtml(key)}"</span>: ${renderJsonTree(data[key], indent + 1)}`
    ).join(',\n');
    return `<span class="json-bracket">{</span>\n${entries}\n${'  '.repeat(indent)}<span class="json-bracket">}</span>`;
  }

  return String(data);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fieldTypeBadge(type) {
  const colorMap = {
    id: 'info', text: 'primary', tokens: 'neutral', bool: 'warning',
    int: 'success', double: 'success', timestamp: 'neutral', enum: 'primary',
    uenum: 'primary', array: 'info', struct: 'neutral', composite: 'neutral',
  };
  return `<span class="badge badge-${colorMap[type] || 'neutral'}">${FIELD_TYPE_LABELS[type] || type}</span>`;
}

function renderFieldsTable(fields, showExpand = true) {
  if (!fields || fields.length === 0) {
    return '<div class="empty-state"><p>No fields found</p></div>';
  }

  // Filter out hidden/internal fields for cleaner display
  const visibleFields = fields.filter(f => {
    const hidden = f.ui?.is_hidden;
    const apiHidden = f.gateway?.api_visibility === 'hidden';
    return !apiHidden; // show ui-hidden but not api-hidden
  });

  let html = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style="width:30px">#</th>
            <th>Name</th>
            <th>Display Name</th>
            <th>Type</th>
            <th>Data Name</th>
            <th>Filterable</th>
            <th>Required</th>
            ${showExpand ? '<th style="width:60px">Details</th>' : ''}
          </tr>
        </thead>
        <tbody>
  `;

  visibleFields.forEach((field, idx) => {
    const displayName = field.ui?.display_name || field.name || '-';
    const name = field.name || '-';
    const dataName = field.data_name || '-';
    const filterable = field.is_filterable ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-neutral">No</span>';
    const required = field.is_required ? '<span class="badge badge-error">Required</span>' : '';
    const order = field.ui?.order !== undefined ? `<span class="text-muted text-sm">(order: ${field.ui.order})</span>` : '';

    html += `
      <tr>
        <td class="text-muted text-sm">${idx + 1}</td>
        <td><strong>${escapeHtml(name)}</strong> ${order}</td>
        <td>${escapeHtml(displayName)}</td>
        <td>${fieldTypeBadge(field.field_type)}</td>
        <td><code class="font-mono text-sm">${escapeHtml(dataName)}</code></td>
        <td>${filterable}</td>
        <td>${required}</td>
        ${showExpand ? `<td><button class="btn-icon expand-field-btn" data-idx="${idx}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button></td>` : ''}
      </tr>
      ${showExpand ? `<tr class="field-detail-row" data-idx="${idx}" style="display:none"><td colspan="8"><div class="json-viewer"><pre>${renderJsonTree(field)}</pre></div></td></tr>` : ''}
    `;
  });

  html += '</tbody></table></div>';
  html += `<div class="text-sm text-muted mt-2">Showing ${visibleFields.length} of ${fields.length} fields</div>`;
  return html;
}

async function loadStockFields(container) {
  const leafType = getState('leafType');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading stock fields...</div>';
  try {
    const data = await api.schemas.stockList(leafType);
    const fields = data.result?.[0]?.fields || [];
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Stock Fields</div>
            <div class="card-subtitle">System-defined fields for ${leafType} (${fields.length} total)</div>
          </div>
          <button class="btn btn-sm btn-secondary" id="export-stock-btn">Export JSON</button>
        </div>
        <div class="card-body" style="padding:0;">
          ${renderFieldsTable(fields)}
        </div>
      </div>
    `;
    attachExpandListeners(container);
    document.getElementById('export-stock-btn')?.addEventListener('click', () => {
      downloadJson(fields, `stock-fields-${leafType}.json`);
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--error)"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function loadCustomFields(container) {
  const leafType = getState('leafType');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading custom fields...</div>';
  try {
    const data = await api.schemas.customList(leafType, 'tenant_fragment');
    const fragment = data.result?.[0];
    const fields = fragment?.fields || [];
    const overrides = fragment?.stock_field_overrides || [];
    const conditions = fragment?.conditions || [];

    let html = `
      <div class="card mb-4">
        <div class="card-header">
          <div>
            <div class="card-title">Tenant Custom Fields</div>
            <div class="card-subtitle">${fields.length} custom fields defined</div>
          </div>
          <button class="btn btn-sm btn-secondary" id="export-custom-btn">Export JSON</button>
        </div>
        <div class="card-body" style="padding:0;">
          ${renderFieldsTable(fields)}
        </div>
      </div>
    `;

    if (overrides.length > 0) {
      html += `
        <div class="card mb-4">
          <div class="card-header">
            <div class="card-title">Stock Field Overrides (${overrides.length})</div>
          </div>
          <div class="card-body">
            <div class="json-viewer"><pre>${renderJsonTree(overrides)}</pre></div>
          </div>
        </div>
      `;
    }

    if (conditions.length > 0) {
      html += `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Conditions / Dependencies (${conditions.length})</div>
          </div>
          <div class="card-body">
            <div class="json-viewer"><pre>${renderJsonTree(conditions)}</pre></div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    attachExpandListeners(container);
    document.getElementById('export-custom-btn')?.addEventListener('click', () => {
      downloadJson(fragment, 'tenant-fragment.json');
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--error)"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function loadSubtypeFields(container) {
  const leafType = getState('leafType');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading subtype fragments...</div>';
  try {
    const data = await api.schemas.customList(leafType, 'custom_type_fragment');
    const fragments = data.result || [];

    if (fragments.length === 0) {
      container.innerHTML = `
        <div class="card">
          <div class="card-body">
            <div class="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6"/></svg>
              <p>No custom type fragments (subtypes) found</p>
              <p class="text-sm">Subtypes appear when object categories are configured</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    fragments.forEach((frag, idx) => {
      const fields = frag.fields || [];
      const subtype = frag.subtype || frag.subtype_display_name || `Fragment ${idx + 1}`;
      html += `
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <div class="card-title">${escapeHtml(String(subtype))}</div>
              <div class="card-subtitle">${fields.length} fields &middot; Type: custom_type_fragment</div>
            </div>
            <button class="btn btn-sm btn-secondary export-subtype-btn" data-idx="${idx}">Export JSON</button>
          </div>
          <div class="card-body" style="padding:0;">
            ${renderFieldsTable(fields)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    attachExpandListeners(container);
    container.querySelectorAll('.export-subtype-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        downloadJson(fragments[idx], `subtype-${idx}.json`);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--error)"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function loadAllFragments(container) {
  const leafType = getState('leafType');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div>Loading all fragments...</div>';
  try {
    const data = await api.schemas.customList(leafType);
    const fragments = data.result || [];

    const byType = {};
    fragments.forEach(f => {
      const t = f.type || 'unknown';
      if (!byType[t]) byType[t] = [];
      byType[t].push(f);
    });

    let html = `
      <div class="stat-grid mb-4">
        <div class="stat-card">
          <div class="stat-value">${fragments.length}</div>
          <div class="stat-label">Total Fragments</div>
        </div>
        ${Object.entries(byType).map(([type, frags]) => `
          <div class="stat-card">
            <div class="stat-value">${frags.length}</div>
            <div class="stat-label">${type}</div>
          </div>
        `).join('')}
      </div>
    `;

    fragments.forEach((frag, idx) => {
      const fields = frag.fields || [];
      const type = frag.type || 'unknown';
      html += `
        <div class="card mb-4">
          <div class="card-header">
            <div>
              <div class="card-title flex items-center gap-2">
                <span class="badge badge-${type === 'tenant_fragment' ? 'primary' : type === 'app_fragment' ? 'info' : 'warning'}">${type}</span>
                ${frag.description ? escapeHtml(frag.description) : `Fragment ${idx + 1}`}
              </div>
              <div class="card-subtitle font-mono">${frag.id || ''}</div>
            </div>
            <button class="btn btn-sm btn-secondary export-all-btn" data-idx="${idx}">Export JSON</button>
          </div>
          <div class="card-body" style="padding:0;">
            ${renderFieldsTable(fields)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    attachExpandListeners(container);
    container.querySelectorAll('.export-all-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        downloadJson(fragments[idx], `fragment-${idx}.json`);
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:var(--error)"><p>Error: ${escapeHtml(err.message)}</p></div>`;
  }
}

function attachExpandListeners(container) {
  container.querySelectorAll('.expand-field-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      const row = container.querySelector(`.field-detail-row[data-idx="${idx}"]`);
      if (row) {
        row.style.display = row.style.display === 'none' ? '' : 'none';
        btn.classList.toggle('active');
      }
    });
  });
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${filename}`, 'success');
}

export const SchemaExplorerPage = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Schema Explorer</div>
          <div class="page-desc">Browse stock fields, custom fields, and subtype-specific fields for <strong>${getState('leafType')}</strong></div>
        </div>
      </div>

      <div class="sub-tabs" id="schema-tabs">
        <button class="sub-tab active" data-tab="stock">Stock Fields</button>
        <button class="sub-tab" data-tab="custom">Custom Fields</button>
        <button class="sub-tab" data-tab="subtypes">Subtype Fields</button>
        <button class="sub-tab" data-tab="all">All Fragments</button>
      </div>

      <div id="schema-content"></div>
    `;

    const contentEl = document.getElementById('schema-content');
    const tabs = container.querySelectorAll('.sub-tab');

    function switchTab(tabId) {
      currentTab = tabId;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
      switch (tabId) {
        case 'stock': loadStockFields(contentEl); break;
        case 'custom': loadCustomFields(contentEl); break;
        case 'subtypes': loadSubtypeFields(contentEl); break;
        case 'all': loadAllFragments(contentEl); break;
      }
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    switchTab(currentTab);
  },

  unmount() {},
};
