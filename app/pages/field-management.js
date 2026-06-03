import { api } from '../lib/api-client.js';
import { showToast } from '../lib/toast.js';
import { getState } from '../lib/state.js';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let tenantFragment = null;
let currentContext = 'tenant'; // 'tenant' or subtype name

export const FieldManagementPage = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Field Management</div>
          <div class="page-desc">Reorder fields and manage stock field overrides</div>
        </div>
      </div>

      <div class="sub-tabs mb-4">
        <button class="sub-tab active" data-ctx="tenant">Tenant Custom Fields</button>
        <button class="sub-tab" data-ctx="stock-overrides">Stock Field Overrides</button>
      </div>

      <div id="field-mgmt-content">
        <div class="loading-state"><div class="spinner"></div>Loading schema...</div>
      </div>
    `;

    const tabs = container.querySelectorAll('.sub-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentContext = tab.dataset.ctx;
        renderContent();
      });
    });

    loadData();
  },

  unmount() {
    tenantFragment = null;
  },
};

async function loadData() {
  try {
    const leafType = getState('leafType');
    const data = await api.schemas.customList(leafType, 'tenant_fragment');
    tenantFragment = data.result?.[0] || null;
    renderContent();
  } catch (err) {
    document.getElementById('field-mgmt-content').innerHTML =
      `<div class="empty-state" style="color:var(--error)">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function renderContent() {
  const el = document.getElementById('field-mgmt-content');
  if (!tenantFragment) {
    el.innerHTML = '<div class="empty-state"><p>No tenant fragment found. Create custom fields first.</p></div>';
    return;
  }

  if (currentContext === 'stock-overrides') {
    renderStockOverrides(el);
  } else {
    renderTenantFields(el);
  }
}

function renderTenantFields(el) {
  const fields = tenantFragment.fields || [];
  if (fields.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>No custom fields defined in tenant fragment</p></div>';
    return;
  }

  // Sort by current ui.order if exists
  const sorted = [...fields].sort((a, b) => {
    const oa = a.ui?.order ?? 999;
    const ob = b.ui?.order ?? 999;
    return oa - ob;
  });

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Custom Fields Order</div>
          <div class="card-subtitle">Drag to reorder. Changes are saved when you click "Save Order".</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="reset-order-btn">Reset</button>
          <button class="btn btn-sm btn-primary" id="save-order-btn">Save Order</button>
        </div>
      </div>
      <div class="card-body" id="sortable-container">
        ${sorted.map((field, idx) => `
          <div class="sortable-item" draggable="true" data-idx="${idx}" data-name="${escapeHtml(field.name)}">
            <div class="drag-handle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/>
              </svg>
            </div>
            <div class="flex-1">
              <div style="font-weight:500; font-size:13px;">${escapeHtml(field.ui?.display_name || field.name)}</div>
              <div class="text-sm text-muted font-mono">${escapeHtml(field.data_name || field.name)}</div>
            </div>
            <span class="badge badge-${field.field_type === 'uenum' ? 'primary' : 'neutral'}">${field.field_type}</span>
            <div class="text-sm text-muted" style="min-width:60px; text-align:right;">
              order: <strong>${field.ui?.order ?? '—'}</strong>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card mt-4" id="preview-card" style="display:none;">
      <div class="card-header">
        <div class="card-title">Payload Preview</div>
      </div>
      <div class="card-body">
        <div class="json-viewer"><pre id="preview-json"></pre></div>
      </div>
    </div>
  `;

  // Drag and drop
  const sortableContainer = document.getElementById('sortable-container');
  let draggedItem = null;

  sortableContainer.querySelectorAll('.sortable-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      sortableContainer.querySelectorAll('.sortable-item').forEach(i => i.classList.remove('drag-over'));
      draggedItem = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item !== draggedItem) {
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (draggedItem && draggedItem !== item) {
        const items = [...sortableContainer.querySelectorAll('.sortable-item')];
        const fromIdx = items.indexOf(draggedItem);
        const toIdx = items.indexOf(item);
        if (fromIdx < toIdx) {
          item.after(draggedItem);
        } else {
          item.before(draggedItem);
        }
        updateOrderNumbers();
      }
    });
  });

  function updateOrderNumbers() {
    const items = sortableContainer.querySelectorAll('.sortable-item');
    items.forEach((item, idx) => {
      const orderEl = item.querySelector('div[style*="min-width:60px"] strong');
      if (orderEl) orderEl.textContent = String((idx + 1) * 10);
    });
  }

  document.getElementById('save-order-btn').addEventListener('click', () => saveFieldOrder(sortableContainer));
  document.getElementById('reset-order-btn').addEventListener('click', () => renderContent());
}

async function saveFieldOrder(sortableContainer) {
  const items = sortableContainer.querySelectorAll('.sortable-item');
  const newOrder = [];
  items.forEach((item, idx) => {
    newOrder.push({ name: item.dataset.name, order: (idx + 1) * 10 });
  });

  // Build updated tenant_fragment payload
  const payload = JSON.parse(JSON.stringify(tenantFragment));

  // Remove system metadata
  delete payload.created_by;
  delete payload.created_date;
  delete payload.id;
  delete payload.modified_by;
  delete payload.modified_date;
  delete payload.object_version;
  delete payload.old_fragment_ref;

  // Update field orders
  for (const field of payload.fields || []) {
    const orderInfo = newOrder.find(o => o.name === field.name);
    if (orderInfo) {
      if (!field.ui) field.ui = {};
      field.ui.order = orderInfo.order;
    }
  }

  // Show preview
  const previewCard = document.getElementById('preview-card');
  const previewJson = document.getElementById('preview-json');
  previewCard.style.display = 'block';
  previewJson.textContent = JSON.stringify(payload, null, 2);

  const saveBtn = document.getElementById('save-order-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await api.schemas.customSet(payload);
    showToast('Field order saved successfully', 'success');
    // Reload data
    await loadData();
  } catch (err) {
    showToast(`Failed to save: ${err.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Order';
  }
}

function renderStockOverrides(el) {
  const overrides = tenantFragment.stock_field_overrides || [];

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Stock Field Overrides</div>
          <div class="card-subtitle">Override stock field properties like order, visibility, and placeholders</div>
        </div>
        <button class="btn btn-sm btn-primary" id="add-override-btn">+ Add Override</button>
      </div>
      <div class="card-body">
        ${overrides.length === 0 ? '<div class="empty-state"><p>No stock field overrides configured</p></div>' : ''}
        <div id="overrides-list">
          ${overrides.map((ov, idx) => `
            <div class="sortable-item" style="margin-bottom:8px;">
              <div class="flex-1">
                <div style="font-weight:500;">${escapeHtml(ov.name)}</div>
                <div class="text-sm text-muted">
                  ${ov.ui?.order !== undefined ? `order: ${ov.ui.order}` : ''}
                  ${ov.is_required !== undefined ? ` &middot; required: ${ov.is_required}` : ''}
                  ${ov.ui?.placeholder ? ` &middot; placeholder: "${escapeHtml(ov.ui.placeholder)}"` : ''}
                  ${ov.ui?.search_query ? ` &middot; search_query: "${escapeHtml(ov.ui.search_query)}"` : ''}
                </div>
              </div>
              <button class="btn-icon remove-override-btn" data-idx="${idx}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('')}
        </div>

        <div id="add-override-form" style="display:none; margin-top:16px; padding:16px; border:1px solid var(--border); border-radius:var(--radius);">
          <div class="grid-2 mb-4">
            <div class="input-group">
              <label class="input-label">Stock Field Name</label>
              <input class="input" id="override-name" placeholder="e.g. applies_to_part, group, severity">
            </div>
            <div class="input-group">
              <label class="input-label">Order</label>
              <input class="input" id="override-order" type="number" placeholder="e.g. 10">
            </div>
          </div>
          <div class="grid-2 mb-4">
            <div class="input-group">
              <label class="input-label">Placeholder</label>
              <input class="input" id="override-placeholder" placeholder="e.g. Add">
            </div>
            <div class="input-group">
              <label class="input-label">Required</label>
              <select class="select" id="override-required">
                <option value="">— Don't override —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-primary" id="confirm-add-override">Add</button>
            <button class="btn btn-sm btn-secondary" id="cancel-add-override">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('add-override-btn').addEventListener('click', () => {
    document.getElementById('add-override-form').style.display = 'block';
  });

  document.getElementById('cancel-add-override')?.addEventListener('click', () => {
    document.getElementById('add-override-form').style.display = 'none';
  });

  document.getElementById('confirm-add-override')?.addEventListener('click', async () => {
    const name = document.getElementById('override-name').value.trim();
    if (!name) { showToast('Field name is required', 'error'); return; }

    const override = { name };
    const order = document.getElementById('override-order').value;
    const placeholder = document.getElementById('override-placeholder').value.trim();
    const required = document.getElementById('override-required').value;

    if (order || placeholder) {
      override.ui = {};
      if (order) override.ui.order = parseInt(order);
      if (placeholder) override.ui.placeholder = placeholder;
    }
    if (required !== '') override.is_required = required === 'true';

    // Update payload
    const payload = JSON.parse(JSON.stringify(tenantFragment));
    delete payload.created_by; delete payload.created_date; delete payload.id;
    delete payload.modified_by; delete payload.modified_date; delete payload.object_version;
    delete payload.old_fragment_ref;

    if (!payload.stock_field_overrides) payload.stock_field_overrides = [];
    payload.stock_field_overrides.push(override);

    try {
      await api.schemas.customSet(payload);
      showToast('Stock field override added', 'success');
      await loadData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  });

  el.querySelectorAll('.remove-override-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const payload = JSON.parse(JSON.stringify(tenantFragment));
      delete payload.created_by; delete payload.created_date; delete payload.id;
      delete payload.modified_by; delete payload.modified_date; delete payload.object_version;
      delete payload.old_fragment_ref;

      payload.stock_field_overrides.splice(idx, 1);

      try {
        await api.schemas.customSet(payload);
        showToast('Override removed', 'success');
        await loadData();
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });
  });
}
