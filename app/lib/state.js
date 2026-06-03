const listeners = new Map();
const state = {
  auth: { authenticated: false, user: null },
  activeTab: 'schemas',
  leafType: 'ticket',
};

export function getState(path) {
  if (!path) return state;
  return path.split('.').reduce((obj, key) => obj?.[key], state);
}

export function setState(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let obj = state;
  for (const k of keys) {
    if (obj[k] === undefined) obj[k] = {};
    obj = obj[k];
  }
  obj[last] = value;
  notify(path);
}

function notify(changedPath) {
  for (const [path, cbs] of listeners) {
    if (changedPath.startsWith(path) || path.startsWith(changedPath)) {
      for (const cb of cbs) {
        try { cb(getState(path)); } catch (e) { console.error('State listener error:', e); }
      }
    }
  }
}

export function subscribe(path, callback) {
  if (!listeners.has(path)) listeners.set(path, new Set());
  listeners.get(path).add(callback);
  return () => listeners.get(path)?.delete(callback);
}
