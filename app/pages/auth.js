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
            <p class="auth-subtitle">Enter your Personal Access Token to manage object customization</p>

            <div class="input-group mb-4">
              <label class="input-label">Personal Access Token (PAT)</label>
              <input type="password" id="pat-input" class="input auth-pat-input" placeholder="eyJhbGciOiJSUzI1NiIs..." autocomplete="off">
            </div>

            <button id="connect-btn" class="btn btn-primary w-full" style="justify-content: center; padding: 10px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Connect
            </button>

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
    const errorEl = document.getElementById('connect-error');

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

    connectBtn.addEventListener('click', handleConnect);
    patInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleConnect();
    });
    patInput.focus();
  },

  unmount() {},
};
