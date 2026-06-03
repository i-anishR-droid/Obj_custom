import { setState, getState, subscribe } from './state.js';

const pages = {};
let currentPage = null;
let container = null;

export function registerPage(id, pageModule) {
  pages[id] = pageModule;
}

export function navigate(tabId) {
  location.hash = tabId;
}

export function reloadCurrentPage() {
  if (currentPage && container) {
    if (pages[currentPage]?.unmount) pages[currentPage].unmount();
    container.innerHTML = '';
    if (pages[currentPage]?.render) pages[currentPage].render(container);
  }
}

export function initRouter(contentEl) {
  container = contentEl;

  window.addEventListener('hashchange', () => {
    const hash = location.hash.slice(1) || 'schemas';
    setState('activeTab', hash);
  });

  subscribe('activeTab', (tab) => renderPage(tab));
  subscribe('auth.authenticated', (auth) => {
    if (!auth) renderPage('auth');
  });

  const initial = location.hash.slice(1) || 'schemas';
  setState('activeTab', initial);
}

function renderPage(tabId) {
  if (!container) return;

  const isAuth = getState('auth.authenticated');
  const pageId = isAuth ? tabId : 'auth';

  if (currentPage && pages[currentPage]?.unmount) {
    pages[currentPage].unmount();
  }

  container.innerHTML = '';
  currentPage = pageId;

  if (pages[pageId]?.render) {
    pages[pageId].render(container);
  } else {
    container.innerHTML = `<div class="empty-state"><p>Page "${pageId}" not found</p></div>`;
  }
}
