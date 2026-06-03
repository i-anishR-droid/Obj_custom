import { api } from '../lib/api-client.js';
import { showToast } from '../lib/toast.js';
import { getState } from '../lib/state.js';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let tenantFragment = null;
let parts = [];
let customFields = [];

export const DependenciesPage = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dependencies</div>
          <div class="page-desc">Configure cascading dropdown dependencies and field visibility rules</div>
        </div>
      </div>
      <div id="deps-content">
        <div class="loading-state"><div class="spinner"></div>Loading schema data...</div>
      </div>
    `;
    loadDepsData();
  },
  unmount() {
    tenantFragment = null;
    parts = [];
    customFields = [];
  },
};

async function loadDepsData() {
  try {
    const leafType = getState('leafType');
    const [schemaData, partsData] = await Promise.all([
      api.schemas.customList(leafType, 'tenant_fragment'),
      api.parts.list(),
    ]);
    tenantFragment = schemaData.result?.[0] || null;
    parts = partsData.parts || [];
    customFields = tenantFragment?.fields || [];
    renderDeps();
  } catch (err) {
    document.getElementById('deps-content').innerHTML =
      `<div class="empty-state" style="color:var(--error)">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function renderDeps() {
  const el = document.getElementById('deps-content');
  const conditions = tenantFragment?.conditions || [];

  el.innerHTML = `
    <!-- Existing Conditions -->
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="card-title">Existing Conditions (${conditions.length})</div>
          <div class="card-subtitle">Current dependency and visibility rules in the tenant fragment</div>
        </div>
      </div>
      <div class="card-body" style="padding:0;">
        ${conditions.length === 0 ? '<div class="empty-state p-4"><p>No conditions configured yet</p></div>' : ''}
        ${conditions.map((cond, idx) => `
          <div style="padding:16px; border-bottom:1px solid var(--border-light);">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="badge badge-primary">#${idx + 1}</span>
                <code class="font-mono text-sm" style="color:var(--primary); max-width:500px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block;">${escapeHtml(cond.expression || '—')}</code>
              </div>
              <button class="btn-icon toggle-cond-btn" data-idx="${idx}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <div class="flex gap-2 flex-wrap">
              ${(cond.effects || []).map(eff => {
                const tags = [];
                if (eff.show !== undefined) tags.push(eff.show ? '<span class="badge badge-success">Show</span>' : '<span class="badge badge-error">Hide</span>');
                if (eff.require) tags.push('<span class="badge badge-warning">Required</span>');
                if (eff.allowed_values?.length) tags.push(`<span class="badge badge-info">${eff.allowed_values.length} values</span>`);
                const fieldsList = (eff.fields || []).map(f => `<code class="text-sm font-mono">${escapeHtml(f)}</code>`).join(', ');
                return `<div class="text-sm">${tags.join(' ')} → ${fieldsList}</div>`;
              }).join('')}
            </div>
            <div class="cond-detail-${idx}" style="display:none; margin-top:12px;">
              <div class="json-viewer"><pre>${JSON.stringify(cond, null, 2)}</pre></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Add New Condition -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Add New Condition</div>
      </div>
      <div class="card-body">
        <div class="mb-4">
          <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">Expression Builder</h4>
          <div id="expr-rows"></div>
          <button class="btn btn-sm btn-secondary mt-2" id="add-expr-row">+ Add Condition</button>
        </div>

        <div class="mb-4">
          <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">Effects</h4>
          <div id="effect-rows"></div>
          <button class="btn btn-sm btn-secondary mt-2" id="add-effect-row">+ Add Effect</button>
        </div>

        <div class="mb-4">
          <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">Preview</h4>
          <div class="json-viewer"><pre id="condition-preview">{}</pre></div>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary" id="apply-condition-btn">Apply Condition</button>
          <button class="btn btn-secondary" id="clear-condition-btn">Clear</button>
        </div>
      </div>
    </div>
  `;

  // Toggle condition detail
  el.querySelectorAll('.toggle-cond-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const detail = el.querySelector(`.cond-detail-${btn.dataset.idx}`);
      if (detail) detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });
  });

  // Expression builder
  let exprRows = [];
  let effectRows = [];

  function renderExprRows() {
    const container = document.getElementById('expr-rows');
    container.innerHTML = exprRows.map((row, idx) => `
      <div class="expr-row">
        ${idx > 0 ? '<span class="expr-connector">AND</span>' : ''}
        <select class="select" style="width:auto; min-width:180px;" data-expr-field="${idx}">
          <option value="">Select field...</option>
          <option value="applies_to_part" ${row.field === 'applies_to_part' ? 'selected' : ''}>Part (applies_to_part)</option>
          <option value="group" ${row.field === 'group' ? 'selected' : ''}>Group</option>
          <option value="stage" ${row.field === 'stage' ? 'selected' : ''}>Stage</option>
          <option value="subtype" ${row.field === 'subtype' ? 'selected' : ''}>Subtype</option>
          ${customFields.map(f => `<option value="custom_fields.${f.name}" ${row.field === `custom_fields.${f.name}` ? 'selected' : ''}>${escapeHtml(f.ui?.display_name || f.name)}</option>`).join('')}
        </select>
        <select class="select" style="width:auto;" data-expr-op="${idx}">
          <option value="==" ${row.op === '==' ? 'selected' : ''}>=</option>
          <option value="!=" ${row.op === '!=' ? 'selected' : ''}>!=</option>
        </select>
        <input class="input" style="width:auto; min-width:240px;" placeholder="Value (DON ID or string)" value="${escapeHtml(row.value || '')}" data-expr-value="${idx}">
        <button class="btn-icon" data-remove-expr="${idx}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');

    // Attach listeners
    container.querySelectorAll('[data-expr-field]').forEach(sel => {
      sel.addEventListener('change', (e) => { exprRows[sel.dataset.exprField].field = e.target.value; updatePreview(); });
    });
    container.querySelectorAll('[data-expr-op]').forEach(sel => {
      sel.addEventListener('change', (e) => { exprRows[sel.dataset.exprOp].op = e.target.value; updatePreview(); });
    });
    container.querySelectorAll('[data-expr-value]').forEach(input => {
      input.addEventListener('input', (e) => { exprRows[input.dataset.exprValue].value = e.target.value; updatePreview(); });
    });
    container.querySelectorAll('[data-remove-expr]').forEach(btn => {
      btn.addEventListener('click', () => { exprRows.splice(parseInt(btn.dataset.removeExpr), 1); renderExprRows(); updatePreview(); });
    });
  }

  function renderEffectRows() {
    const container = document.getElementById('effect-rows');
    container.innerHTML = effectRows.map((row, idx) => `
      <div style="padding:12px; border:1px solid var(--border); border-radius:var(--radius); margin-bottom:8px;">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-mono text-muted">Effect #${idx + 1}</span>
          <button class="btn-icon" data-remove-effect="${idx}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="grid-2 mb-2">
          <div class="input-group">
            <label class="input-label">Target Fields (comma-separated)</label>
            <input class="input" placeholder="e.g. custom_fields.issue_category_l2" value="${escapeHtml(row.fields || '')}" data-effect-fields="${idx}">
          </div>
          <div class="input-group">
            <label class="input-label">Action</label>
            <select class="select" data-effect-action="${idx}">
              <option value="show" ${row.action === 'show' ? 'selected' : ''}>Show / Set Allowed Values</option>
              <option value="require" ${row.action === 'require' ? 'selected' : ''}>Make Required</option>
              <option value="hide" ${row.action === 'hide' ? 'selected' : ''}>Hide</option>
            </select>
          </div>
        </div>
        ${row.action === 'show' ? `
          <div class="input-group">
            <label class="input-label">Allowed Values (one per line)</label>
            <textarea class="input" style="min-height:80px; resize:vertical;" placeholder="Value 1\nValue 2\nValue 3" data-effect-values="${idx}">${escapeHtml(row.values || '')}</textarea>
          </div>
        ` : ''}
      </div>
    `).join('');

    container.querySelectorAll('[data-effect-fields]').forEach(input => {
      input.addEventListener('input', (e) => { effectRows[input.dataset.effectFields].fields = e.target.value; updatePreview(); });
    });
    container.querySelectorAll('[data-effect-action]').forEach(sel => {
      sel.addEventListener('change', (e) => { effectRows[sel.dataset.effectAction].action = e.target.value; renderEffectRows(); updatePreview(); });
    });
    container.querySelectorAll('[data-effect-values]').forEach(ta => {
      ta.addEventListener('input', (e) => { effectRows[ta.dataset.effectValues].values = e.target.value; updatePreview(); });
    });
    container.querySelectorAll('[data-remove-effect]').forEach(btn => {
      btn.addEventListener('click', () => { effectRows.splice(parseInt(btn.dataset.removeEffect), 1); renderEffectRows(); updatePreview(); });
    });
  }

  function buildCondition() {
    // Build expression
    const exprParts = exprRows
      .filter(r => r.field && r.value)
      .map(r => `${r.field} ${r.op} '${r.value}'`);

    let expression = '';
    if (exprParts.length === 1) {
      expression = exprParts[0];
    } else if (exprParts.length > 1) {
      expression = exprParts.map(p => `( ${p} )`).join(' && ');
    }

    // Build effects
    const effects = effectRows.map(row => {
      const fields = (row.fields || '').split(',').map(f => f.trim()).filter(Boolean);
      const effect = { fields };

      if (row.action === 'show') {
        effect.show = true;
        if (row.values) {
          effect.allowed_values = row.values.split('\n').map(v => v.trim()).filter(Boolean);
        }
      } else if (row.action === 'require') {
        effect.require = true;
      } else if (row.action === 'hide') {
        effect.show = false;
      }

      return effect;
    }).filter(e => e.fields.length > 0);

    return {
      expression,
      expression_ast: [],
      effects,
    };
  }

  function updatePreview() {
    const preview = document.getElementById('condition-preview');
    preview.textContent = JSON.stringify(buildCondition(), null, 2);
  }

  document.getElementById('add-expr-row').addEventListener('click', () => {
    exprRows.push({ field: '', op: '==', value: '' });
    renderExprRows();
  });

  document.getElementById('add-effect-row').addEventListener('click', () => {
    effectRows.push({ fields: '', action: 'show', values: '' });
    renderEffectRows();
  });

  document.getElementById('clear-condition-btn').addEventListener('click', () => {
    exprRows = [];
    effectRows = [];
    renderExprRows();
    renderEffectRows();
    updatePreview();
  });

  document.getElementById('apply-condition-btn').addEventListener('click', async () => {
    const condition = buildCondition();
    if (!condition.expression) {
      showToast('Please add at least one expression condition', 'error');
      return;
    }
    if (condition.effects.length === 0) {
      showToast('Please add at least one effect', 'error');
      return;
    }

    // Build updated payload
    const payload = JSON.parse(JSON.stringify(tenantFragment));
    delete payload.created_by; delete payload.created_date; delete payload.id;
    delete payload.modified_by; delete payload.modified_date; delete payload.object_version;
    delete payload.old_fragment_ref;

    if (!payload.conditions) payload.conditions = [];
    payload.conditions.push(condition);

    const btn = document.getElementById('apply-condition-btn');
    btn.disabled = true;
    btn.textContent = 'Applying...';

    try {
      await api.schemas.customSet(payload);
      showToast('Condition applied successfully', 'success');
      await loadDepsData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply Condition';
    }
  });

  // Initialize
  renderExprRows();
  renderEffectRows();
  updatePreview();
}
