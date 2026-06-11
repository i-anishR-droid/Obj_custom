import { api } from '../lib/api-client.js';
import { setState } from '../lib/state.js';
import { showToast } from '../lib/toast.js';

export const AuthPage = {
  render(container) {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card card">
          <div class="card-body" style="padding: 32px;">
            <div class="auth-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <path d="M9 12h6M12 9v6"/>
              </svg>
            </div>
            <h1 class="auth-title">Connect to DevRev</h1>
            <p class="auth-subtitle">Enter your PAT below, or let the Claude agent handle authentication automatically.</p>

            <div id="agent-auth-status" style="margin-bottom:16px;"></div>

            <div class="input-group mb-4">
              <label class="input-label">Personal Access Token (PAT)</label>
              <input type="password" id="pat-input" class="input auth-pat-input" placeholder="eyJhbGciOiJSUzI1NiIs..." autocomplete="off">
            </div>

            <div style="display:flex;gap:8px;">
              <button id="connect-btn" class="btn btn-primary" style="flex:1;justify-content:center;padding:10px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                Connect
              </button>
              <button id="sync-agent-btn" class="btn btn-secondary" style="justify-content:center;padding:10px;" title="Sync PAT from the Claude agent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Sync from Agent
              </button>
            </div>

            <div id="connect-error" style="display:none; margin-top: 12px; padding: 10px; background: var(--error-light); color: var(--error); border-radius: var(--radius); font-size: 12px;"></div>

            <div class="auth-footer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Token is stored locally and only sent to DevRev APIs
            </div>
          </div>
        </div>
      </div>
    `;

    const patInput = document.getElementById('pat-input');
    const connectBtn = document.getElementById('connect-btn');
    const syncBtn = document.getElementById('sync-agent-btn');
    const errorEl = document.getElementById('connect-error');
    const agentStatus = document.getElementById('agent-auth-status');

    // Check if agent already shared PAT
    checkAgentAuth(agentStatus, syncBtn);

    async function handleConnect() {
      const pat = patInput.value.trim();
      if (!pat) {
        errorEl.textContent = 'Please enter your PAT';
        errorEl.style.display = 'block';
        return;
      }

      connectBtn.disabled = true;
      connectBtn.innerHTML = '<div class="spinner"></div> Connecting...';
      errorEl.style.display = 'none';

      try {
        const result = await api.auth.connect(pat);
        setState('auth', { authenticated: true, user: result.dev_user });
        showToast(`Connected as ${result.dev_user.full_name}`, 'success');
      } catch (err) {
        errorEl.textContent = `Connection failed: ${err.message}`;
        errorEl.style.display = 'block';
        connectBtn.disabled = false;
        connectBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Connect
        `;
      }
    }

    async function handleSyncFromAgent() {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<div class="spinner"></div>';
      errorEl.style.display = 'none';

      try {
        const result = await api.auth.syncFromAgent();
        if (result?.synced) {
          setState('auth', { authenticated: true, user: result.dev_user });
          showToast(`Connected via agent as ${result.dev_user.full_name}`, 'success');
        } else {
          const reason = result?.reason === 'no_pat'
            ? 'Agent has not shared a PAT yet. Run /object-customization:customize in Claude Code first.'
            : 'Draft server not running. Start it with: python3 scripts/draft_server.py';
          errorEl.textContent = reason;
          errorEl.style.display = 'block';
        }
      } catch (err) {
        errorEl.textContent = `Sync failed: ${err.message}`;
        errorEl.style.display = 'block';
      } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Sync from Agent
        `;
      }
    }

    connectBtn.addEventListener('click', handleConnect);
    syncBtn.addEventListener('click', handleSyncFromAgent);
    patInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleConnect();
    });
    patInput.focus();
  },

  unmount() {},
};

async function checkAgentAuth(statusEl, syncBtn) {
  try {
    const result = await api.auth.syncFromAgent();
    if (result?.synced) {
      statusEl.innerHTML = `
        <div class="auto-auth-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          Agent authentication detected — connecting automatically...
        </div>`;
      const { setState } = await import('../lib/state.js');
      setState('auth', { authenticated: true, user: result.dev_user });
    } else if (result?.reason === 'no_pat') {
      statusEl.innerHTML = `
        <div style="padding:8px 12px;background:var(--info-light);border:1px solid #bfdbfe;border-radius:var(--radius);font-size:12px;color:var(--info)">
          Tip: Run the Claude agent command and it will share authentication automatically.
        </div>`;
    }
  } catch { /* server not running, show normal login */ }
}
