import { api } from './lib/api-client.js';
import { getState, setState, subscribe } from './lib/state.js';
import { initRouter, registerPage, navigate, reloadCurrentPage } from './lib/router.js';
import { TABS, LEAF_TYPES } from './constants.js';
import { renderDraftPage } from './pages/draft.js';

// Import pages
import { AuthPage } from './pages/auth.js';
import { SchemaExplorerPage } from './pages/schema-explorer.js';
import { FieldManagementPage } from './pages/field-management.js';
import { PartsGroupsPage } from './pages/parts-groups.js';
import { DependenciesPage } from './pages/dependencies.js';
import { ConditionalRulesPage } from './pages/conditional-rules.js';

const TAB_ICONS = {
  database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  'git-branch': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
};

function renderTabBar() {
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = '';
  const active = getState('activeTab');

  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.className = `tab-item${active === tab.id ? ' active' : ''}`;
    btn.innerHTML = `${TAB_ICONS[tab.icon] || ''}${tab.label}`;
    btn.addEventListener('click', () => navigate(tab.id));
    tabBar.appendChild(btn);
  }
}

function renderHeaderRight() {
  const el = document.getElementById('header-right');
  const auth = getState('auth');

  if (auth?.authenticated && auth?.user) {
    const initials = (auth.user.full_name || auth.user.display_name || 'U')
      .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    el.innerHTML = `
      <div class="user-badge">
        <div class="user-avatar">${initials}</div>
        <span>${auth.user.full_name || auth.user.display_name}</span>
      </div>
      <button class="btn btn-sm btn-secondary" id="disconnect-btn">Disconnect</button>
    `;

    document.getElementById('disconnect-btn').addEventListener('click', async () => {
      await api.auth.disconnect();
      setState('auth', { authenticated: false, user: null });
    });
  } else {
    el.innerHTML = '';
  }
}

function updateVisibility() {
  const isAuth = getState('auth.authenticated');
  document.getElementById('tab-bar').style.display = isAuth ? 'flex' : 'none';
  document.getElementById('leaf-type-selector').style.display = isAuth ? 'flex' : 'none';
  document.getElementById('mode-bar').style.display = isAuth ? 'flex' : 'none';
}

// ── Mode switcher (Main / Draft) ───────────────────────────────────────────

let _draftPollTimer = null;

async function updateDraftBadge() {
  try {
    const resp = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_DRAFTS' }, r => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(r);
      });
    });
    const count = (resp?.data?.drafts || []).length;
    const badge = document.getElementById('draft-count-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch { /* server not running — badge stays hidden */ }
}

function initModeBar() {
  const mainBtn  = document.getElementById('mode-main');
  const draftBtn = document.getElementById('mode-draft');
  const mainContent  = document.getElementById('content');
  const draftContent = document.getElementById('draft-content');

  function showMain() {
    mainBtn.classList.add('active');
    draftBtn.classList.remove('active');
    mainContent.style.display = '';
    draftContent.style.display = 'none';
  }

  function showDraft() {
    draftBtn.classList.add('active');
    mainBtn.classList.remove('active');
    mainContent.style.display = 'none';
    draftContent.style.display = '';
    renderDraftPage(draftContent);
  }

  mainBtn.addEventListener('click', showMain);
  draftBtn.addEventListener('click', showDraft);

  // Poll draft count every 4 s to keep badge fresh
  updateDraftBadge();
  _draftPollTimer = setInterval(updateDraftBadge, 4000);
}

function initLeafTypeSelector() {
  const select = document.getElementById('leaf-type-select');
  select.value = getState('leafType');
  select.addEventListener('change', () => {
    setState('leafType', select.value);
    reloadCurrentPage();
  });
}

async function init() {
  // Register pages
  registerPage('auth', AuthPage);
  registerPage('schemas', SchemaExplorerPage);
  registerPage('fields', FieldManagementPage);
  registerPage('parts-groups', PartsGroupsPage);
  registerPage('dependencies', DependenciesPage);
  registerPage('rules', ConditionalRulesPage);

  // Subscribe to state changes
  subscribe('activeTab', () => renderTabBar());
  subscribe('auth', () => {
    renderHeaderRight();
    updateVisibility();
    renderTabBar();
  });

  // Check existing auth
  try {
    const status = await api.auth.getStatus();
    if (status.authenticated) {
      setState('auth', { authenticated: true, user: status.dev_user });
    }
  } catch (e) {
    console.log('No existing auth');
  }

  // Init router
  initRouter(document.getElementById('content'));
  initLeafTypeSelector();
  renderTabBar();
  renderHeaderRight();
  updateVisibility();
  initModeBar();
}

init();
