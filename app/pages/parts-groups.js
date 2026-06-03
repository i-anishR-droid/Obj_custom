import { api } from '../lib/api-client.js';
import { showToast } from '../lib/toast.js';

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let parts = [];
let groups = [];
let selectedGroup = null;
let searchQuery = '';
let currentTab = 'parts';

export const PartsGroupsPage = {
  render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Parts & Groups</div>
          <div class="page-desc">Browse parts hierarchy and manage groups</div>
        </div>
      </div>

      <div class="sub-tabs mb-4">
        <button class="sub-tab active" data-tab="parts">Parts</button>
        <button class="sub-tab" data-tab="groups">Groups</button>
      </div>

      <div id="pg-content">
        <div class="loading-state"><div class="spinner"></div>Loading...</div>
      </div>
    `;

    const tabs = container.querySelectorAll('.sub-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        renderContent();
      });
    });

    loadAllData();
  },

  unmount() {
    parts = [];
    groups = [];
    selectedGroup = null;
  },
};

async function loadAllData() {
  try {
    const [partsData, groupsData] = await Promise.all([
      api.parts.list(),
      api.groups.list(),
    ]);
    parts = partsData.parts || [];
    groups = groupsData.groups || [];
    renderContent();
  } catch (err) {
    document.getElementById('pg-content').innerHTML =
      `<div class="empty-state" style="color:var(--error)">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function renderContent() {
  const el = document.getElementById('pg-content');
  if (currentTab === 'parts') {
    renderParts(el);
  } else {
    renderGroups(el);
  }
}

function renderParts(el) {
  // Build hierarchy: product → capability → feature
  const products = parts.filter(p => p.type === 'product');
  const capabilities = parts.filter(p => p.type === 'capability');
  const features = parts.filter(p => p.type === 'feature');

  const filtered = searchQuery
    ? parts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  el.innerHTML = `
    <div class="stat-grid mb-4">
      <div class="stat-card">
        <div class="stat-value">${parts.length}</div>
        <div class="stat-label">Total Parts</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${products.length}</div>
        <div class="stat-label">Products</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${capabilities.length}</div>
        <div class="stat-label">Capabilities</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${features.length}</div>
        <div class="stat-label">Features</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Parts Hierarchy</div>
        <div class="search-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="input search-input" id="parts-search" placeholder="Search parts..." value="${escapeHtml(searchQuery)}" style="width:220px;">
        </div>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Display ID</th>
                <th>DON ID</th>
                <th>Parent</th>
              </tr>
            </thead>
            <tbody>
              ${(filtered || parts).map(part => {
                const parent = part.parent_parts?.[0];
                const typeColors = { product: 'primary', capability: 'info', feature: 'success' };
                return `
                  <tr>
                    <td><strong>${escapeHtml(part.name)}</strong></td>
                    <td><span class="badge badge-${typeColors[part.type] || 'neutral'}">${part.type}</span></td>
                    <td class="font-mono text-sm">${escapeHtml(part.display_id)}</td>
                    <td><code class="font-mono text-sm" style="font-size:10px; word-break:break-all;">${escapeHtml(part.id)}</code></td>
                    <td>${parent ? `<span class="text-sm">${escapeHtml(parent.name)}</span>` : '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.getElementById('parts-search').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderParts(el);
  });
}

function renderGroups(el) {
  el.innerHTML = `
    <div class="stat-grid mb-4">
      <div class="stat-card">
        <div class="stat-value">${groups.length}</div>
        <div class="stat-label">Total Groups</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${groups.filter(g => g.type === 'static').length}</div>
        <div class="stat-label">Static Groups</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${groups.filter(g => g.type === 'dynamic').length}</div>
        <div class="stat-label">Dynamic Groups</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Groups</div>
        <button class="btn btn-sm btn-primary" id="create-group-btn">+ Create Group</button>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Member Type</th>
                <th>Description</th>
                <th>Default</th>
                <th>DON ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${groups.map(g => `
                <tr>
                  <td><strong>${escapeHtml(g.name)}</strong></td>
                  <td><span class="badge badge-${g.type === 'static' ? 'primary' : 'info'}">${g.type}</span></td>
                  <td><span class="badge badge-neutral">${g.member_type || '—'}</span></td>
                  <td class="text-sm" style="max-width:200px;">${escapeHtml(g.description || '—')}</td>
                  <td>${g.is_default ? '<span class="badge badge-warning">Default</span>' : '—'}</td>
                  <td><code class="font-mono" style="font-size:10px; word-break:break-all;">${escapeHtml(g.id)}</code></td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn-icon view-group-btn" data-id="${escapeHtml(g.id)}" title="View details">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      ${!g.is_default ? `<button class="btn-icon delete-group-btn" data-id="${escapeHtml(g.id)}" data-name="${escapeHtml(g.name)}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Create Group Modal -->
    <div id="create-group-modal" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">Create Group</div>
          <button class="modal-close" id="close-create-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="input-group mb-4">
            <label class="input-label">Group Name</label>
            <input class="input" id="new-group-name" placeholder="e.g. One Touch Escalations">
          </div>
          <div class="input-group mb-4">
            <label class="input-label">Description</label>
            <input class="input" id="new-group-desc" placeholder="Brief description">
          </div>
          <div class="grid-2">
            <div class="input-group">
              <label class="input-label">Member Type</label>
              <select class="select" id="new-group-member-type">
                <option value="dev_user">Dev User</option>
                <option value="rev_user">Rev User</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Type</label>
              <select class="select" id="new-group-type">
                <option value="static">Static</option>
                <option value="dynamic">Dynamic</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-sm btn-secondary" id="cancel-create-group">Cancel</button>
          <button class="btn btn-sm btn-primary" id="confirm-create-group">Create</button>
        </div>
      </div>
    </div>

    <!-- Group Detail Modal -->
    <div id="group-detail-modal" class="modal-overlay" style="display:none;">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">Group Details</div>
          <button class="modal-close" id="close-detail-modal">&times;</button>
        </div>
        <div class="modal-body" id="group-detail-body">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  `;

  // Create group modal
  const createModal = document.getElementById('create-group-modal');
  document.getElementById('create-group-btn').addEventListener('click', () => createModal.style.display = 'flex');
  document.getElementById('close-create-modal').addEventListener('click', () => createModal.style.display = 'none');
  document.getElementById('cancel-create-group').addEventListener('click', () => createModal.style.display = 'none');

  document.getElementById('confirm-create-group').addEventListener('click', async () => {
    const name = document.getElementById('new-group-name').value.trim();
    const desc = document.getElementById('new-group-desc').value.trim();
    const memberType = document.getElementById('new-group-member-type').value;
    const type = document.getElementById('new-group-type').value;

    if (!name) { showToast('Group name is required', 'error'); return; }

    try {
      const result = await api.groups.create({ name, description: desc, member_type: memberType, type });
      showToast(`Group "${name}" created`, 'success');
      createModal.style.display = 'none';
      groups.push(result.group);
      renderGroups(el);
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  });

  // View group details
  el.querySelectorAll('.view-group-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const modal = document.getElementById('group-detail-modal');
      const body = document.getElementById('group-detail-body');
      modal.style.display = 'flex';
      body.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

      try {
        const data = await api.groups.get(btn.dataset.id);
        const g = data.group;
        body.innerHTML = `
          <div class="flex flex-col gap-3">
            <div><strong>Name:</strong> ${escapeHtml(g.name)}</div>
            <div><strong>ID:</strong> <code class="font-mono text-sm">${escapeHtml(g.id)}</code></div>
            <div><strong>Type:</strong> <span class="badge badge-primary">${g.type}</span></div>
            <div><strong>Member Type:</strong> ${g.member_type || '—'}</div>
            <div><strong>Description:</strong> ${escapeHtml(g.description || '—')}</div>
            ${g.owner ? `<div><strong>Owner:</strong> ${escapeHtml(g.owner.full_name || g.owner.display_name || '—')}</div>` : ''}
            ${g.custom_fields ? `<div><strong>Custom Fields:</strong><pre class="json-viewer" style="margin-top:8px;">${JSON.stringify(g.custom_fields, null, 2)}</pre></div>` : ''}
          </div>
        `;
      } catch (err) {
        body.innerHTML = `<div class="empty-state" style="color:var(--error)">Error: ${escapeHtml(err.message)}</div>`;
      }
    });
  });

  document.getElementById('close-detail-modal').addEventListener('click', () => {
    document.getElementById('group-detail-modal').style.display = 'none';
  });

  // Delete group
  el.querySelectorAll('.delete-group-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      if (!confirm(`Delete group "${name}"? This cannot be undone.`)) return;

      try {
        await api.groups.delete(btn.dataset.id);
        showToast(`Group "${name}" deleted`, 'success');
        groups = groups.filter(g => g.id !== btn.dataset.id);
        renderGroups(el);
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });
  });
}
