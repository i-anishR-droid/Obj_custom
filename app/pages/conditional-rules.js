import { api } from '../lib/api-client.js';
import { showToast } from '../lib/toast.js';
import { getState } from '../lib/state.js';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let tenantFragment = null;
let subtypeFragments = [];
let allFields = [];
let parts = [];
let groups = [];

export const ConditionalRulesPage = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Conditional Rules</div>
          <div class="page-desc">Make fields mandatory or hidden based on Part, Group, Stage, and Subtype conditions</div>
        </div>
      </div>
      <div id="rules-content">
        <div class="loading-state"><div class="spinner"></div>Loading data...</div>
      </div>
    `;
    loadRulesData();
  },
  unmount() {
    tenantFragment = null;
    subtypeFragments = [];
    allFields = [];
    parts = [];
    groups = [];
  },
};

async function loadRulesData() {
  try {
    const leafType = getState('leafType');
    const [tenantData, subtypeData, partsData, groupsData] = await Promise.all([
      api.schemas.customList(leafType, 'tenant_fragment'),
      api.schemas.customList(leafType, 'custom_type_fragment'),
      api.parts.list(),
      api.groups.list(),
    ]);

    tenantFragment = tenantData.result?.[0] || null;
    subtypeFragments = subtypeData.result || [];
    parts = partsData.parts || [];
    groups = groupsData.groups || [];

    // Build all fields list with fragment info
    allFields = [];
    if (tenantFragment?.fields) {
      tenantFragment.fields.forEach(f => {
        allFields.push({
          ...f,
          fragment: 'tenant_fragment',
          fragmentId: tenantFragment.id,
          fieldRef: `custom_fields.${f.name}`,
        });
      });
    }
    subtypeFragments.forEach(sf => {
      (sf.fields || []).forEach(f => {
        allFields.push({
          ...f,
          fragment: 'custom_type_fragment',
          fragmentId: sf.id,
          subtype: sf.subtype || sf.subtype_display_name,
          fieldRef: `custom_fields.${f.name}`,
        });
      });
    });

    renderRules();
  } catch (err) {
    document.getElementById('rules-content').innerHTML =
      `<div class="empty-state" style="color:var(--error)">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function renderRules() {
  const el = document.getElementById('rules-content');

  // Collect existing conditions from all fragments
  const allConditions = [];
  if (tenantFragment?.conditions) {
    tenantFragment.conditions.forEach((c, idx) => {
      allConditions.push({ ...c, source: 'tenant_fragment', sourceIdx: idx });
    });
  }
  subtypeFragments.forEach(sf => {
    (sf.conditions || []).forEach((c, idx) => {
      allConditions.push({ ...c, source: sf.subtype || sf.id, sourceIdx: idx });
    });
  });

  el.innerHTML = `
    <!-- Existing Rules Overview -->
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <div class="card-title">Active Conditional Rules</div>
          <div class="card-subtitle">${allConditions.length} rules across all fragments</div>
        </div>
      </div>
      <div class="card-body" style="padding:0;">
        ${allConditions.length === 0 ? '<div class="empty-state p-4"><p>No conditional rules configured</p></div>' : ''}
        <div class="table-wrapper">
          ${allConditions.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Source Fragment</th>
                  <th>Expression</th>
                  <th>Effects</th>
                </tr>
              </thead>
              <tbody>
                ${allConditions.map((c, idx) => `
                  <tr>
                    <td class="text-muted">${idx + 1}</td>
                    <td><span class="badge badge-${c.source === 'tenant_fragment' ? 'primary' : 'info'}">${escapeHtml(c.source)}</span></td>
                    <td><code class="font-mono text-sm" style="word-break:break-all;">${escapeHtml(c.expression || '—')}</code></td>
                    <td>
                      ${(c.effects || []).map(eff => {
                        const tags = [];
                        if (eff.require) tags.push('Required');
                        if (eff.show === true) tags.push('Show');
                        if (eff.show === false) tags.push('Hide');
                        if (eff.allowed_values?.length) tags.push(`${eff.allowed_values.length} values`);
                        return `<div class="text-sm"><span class="badge badge-warning">${tags.join(', ')}</span> → ${(eff.fields || []).map(f => `<code class="text-sm">${escapeHtml(f)}</code>`).join(', ')}</div>`;
                      }).join('')}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Create Mandatory Rule -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Create Mandatory Field Rule</div>
      </div>
      <div class="card-body">
        <div class="mb-4">
          <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">1. Select Target Fields</h4>
          <div class="text-sm text-muted mb-2">Select which fields should become mandatory when conditions are met</div>
          <div id="field-checkboxes" style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius); padding:8px;">
            ${allFields.map((f, idx) => `
              <label style="display:flex; align-items:center; gap:8px; padding:6px 8px; cursor:pointer; border-radius:var(--radius-sm);" class="list-item">
                <input type="checkbox" data-field-idx="${idx}" value="${escapeHtml(f.fieldRef)}">
                <div class="flex-1">
                  <div class="text-sm" style="font-weight:500;">${escapeHtml(f.ui?.display_name || f.name)}</div>
                  <div class="text-sm text-muted">${escapeHtml(f.fieldRef)} &middot; <span class="badge badge-${f.fragment === 'tenant_fragment' ? 'primary' : 'info'}" style="font-size:10px;">${f.fragment}${f.subtype ? ` (${f.subtype})` : ''}</span></div>
                </div>
              </label>
            `).join('')}
            ${allFields.length === 0 ? '<div class="text-sm text-muted p-4">No custom fields found</div>' : ''}
          </div>
        </div>

        <div class="mb-4">
          <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">2. Set Conditions</h4>
          <div class="grid-2 mb-2">
            <div class="input-group">
              <label class="input-label">Part</label>
              <select class="select" id="rule-part">
                <option value="">— Any Part —</option>
                ${parts.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${p.type})</option>`).join('')}
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Group</label>
              <select class="select" id="rule-group">
                <option value="">— Any Group —</option>
                ${groups.map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Stage (DON ID)</label>
              <input class="input" id="rule-stage" placeholder="e.g. don:core:...:custom_stage/25">
            </div>
            <div class="input-group">
              <label class="input-label">Subtype</label>
              <input class="input" id="rule-subtype" placeholder="e.g. ocl_cst">
            </div>
          </div>
        </div>

        <div class="mb-4">
          <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">3. Action</h4>
          <div class="flex gap-3">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="rule-action" value="require" checked> Make Required
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="rule-action" value="show"> Show
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="rule-action" value="hide"> Hide
            </label>
          </div>
        </div>

        <div class="mb-4">
          <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">Preview</h4>
          <div class="json-viewer"><pre id="rule-preview">{}</pre></div>
        </div>

        <div class="flex gap-2">
          <button class="btn btn-primary" id="apply-rule-btn">Apply Rule</button>
          <button class="btn btn-secondary" id="clear-rule-btn">Clear</button>
        </div>
      </div>
    </div>
  `;

  // Live preview update
  function updateRulePreview() {
    const checkedFields = [...el.querySelectorAll('#field-checkboxes input:checked')].map(cb => cb.value);
    const partId = document.getElementById('rule-part').value;
    const groupId = document.getElementById('rule-group').value;
    const stageId = document.getElementById('rule-stage').value.trim();
    const subtype = document.getElementById('rule-subtype').value.trim();
    const action = el.querySelector('input[name="rule-action"]:checked')?.value || 'require';

    // Build expression
    const exprParts = [];
    if (partId) exprParts.push(`applies_to_part == '${partId}'`);
    if (groupId) exprParts.push(`group == '${groupId}'`);
    if (stageId) exprParts.push(`stage == '${stageId}'`);
    if (subtype) exprParts.push(`subtype == '${subtype}'`);

    let expression = '';
    if (exprParts.length === 1) expression = exprParts[0];
    else if (exprParts.length > 1) expression = exprParts.map(p => `( ${p} )`).join(' && ');

    const effect = { fields: checkedFields };
    if (action === 'require') effect.require = true;
    else if (action === 'show') effect.show = true;
    else if (action === 'hide') effect.show = false;

    const condition = { expression, expression_ast: [], effects: [effect] };
    document.getElementById('rule-preview').textContent = JSON.stringify(condition, null, 2);

    return condition;
  }

  // Attach change listeners for live preview
  el.querySelectorAll('#field-checkboxes input, #rule-part, #rule-group, input[name="rule-action"]').forEach(input => {
    input.addEventListener('change', updateRulePreview);
  });
  ['rule-stage', 'rule-subtype'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateRulePreview);
  });

  document.getElementById('clear-rule-btn').addEventListener('click', () => {
    el.querySelectorAll('#field-checkboxes input').forEach(cb => cb.checked = false);
    document.getElementById('rule-part').value = '';
    document.getElementById('rule-group').value = '';
    document.getElementById('rule-stage').value = '';
    document.getElementById('rule-subtype').value = '';
    updateRulePreview();
  });

  document.getElementById('apply-rule-btn').addEventListener('click', async () => {
    const condition = updateRulePreview();
    if (!condition.expression) {
      showToast('Please set at least one condition', 'error');
      return;
    }
    if (!condition.effects[0]?.fields?.length) {
      showToast('Please select at least one target field', 'error');
      return;
    }

    // Determine which fragment to update based on selected fields
    const selectedFields = condition.effects[0].fields;
    const fieldInfos = selectedFields.map(ref => allFields.find(f => f.fieldRef === ref)).filter(Boolean);

    // Group by fragment
    const tenantFields = fieldInfos.filter(f => f.fragment === 'tenant_fragment');
    const subtypeGroups = {};
    fieldInfos.filter(f => f.fragment === 'custom_type_fragment').forEach(f => {
      if (!subtypeGroups[f.fragmentId]) subtypeGroups[f.fragmentId] = [];
      subtypeGroups[f.fragmentId].push(f);
    });

    const btn = document.getElementById('apply-rule-btn');
    btn.disabled = true;
    btn.textContent = 'Applying...';

    try {
      // Apply to tenant fragment
      if (tenantFields.length > 0 && tenantFragment) {
        const payload = JSON.parse(JSON.stringify(tenantFragment));
        delete payload.created_by; delete payload.created_date; delete payload.id;
        delete payload.modified_by; delete payload.modified_date; delete payload.object_version;
        delete payload.old_fragment_ref;

        if (!payload.conditions) payload.conditions = [];
        payload.conditions.push({
          expression: condition.expression,
          expression_ast: [],
          effects: [{ ...condition.effects[0], fields: tenantFields.map(f => f.fieldRef) }],
        });

        await api.schemas.customSet(payload);
        showToast('Rule applied to tenant fragment', 'success');
      }

      // Apply to each subtype fragment
      for (const [fragId, fields] of Object.entries(subtypeGroups)) {
        const frag = subtypeFragments.find(f => f.id === fragId);
        if (!frag) continue;

        const payload = JSON.parse(JSON.stringify(frag));
        delete payload.created_by; delete payload.created_date; delete payload.id;
        delete payload.modified_by; delete payload.modified_date; delete payload.object_version;
        delete payload.old_fragment_ref;

        if (!payload.conditions) payload.conditions = [];
        payload.conditions.push({
          expression: condition.expression,
          expression_ast: [],
          effects: [{ ...condition.effects[0], fields: fields.map(f => f.fieldRef) }],
        });

        await api.schemas.customSet(payload);
        showToast(`Rule applied to subtype fragment: ${frag.subtype || fragId}`, 'success');
      }

      await loadRulesData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply Rule';
    }
  });

  updateRulePreview();
}
