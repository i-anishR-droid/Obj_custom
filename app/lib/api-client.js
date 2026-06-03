function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error('No response from service worker'));
        return;
      }
      if (!response.success) {
        reject(new Error(response.error || 'Unknown error'));
        return;
      }
      resolve(response.data);
    });
  });
}

function apiCall(method, endpoint, { params, body, useInternal = true } = {}) {
  return send({ type: 'API_REQUEST', method, endpoint, params, body, useInternal });
}

export const api = {
  auth: {
    connect(pat) { return send({ type: 'SET_AUTH', pat }); },
    disconnect() { return send({ type: 'CLEAR_AUTH' }); },
    getStatus() { return send({ type: 'GET_AUTH' }); },
  },

  schemas: {
    stockList(leafType = 'ticket') {
      return apiCall('GET', 'schemas.stock.list', { params: { leaf_type: leafType } });
    },
    customList(leafType = 'ticket', types) {
      const params = { leaf_type: leafType };
      if (types) params.types = types;
      return apiCall('GET', 'schemas.custom.list', { params });
    },
    customListBySubtype(leafType = 'ticket', subtype) {
      return apiCall('GET', 'schemas.custom.list', { params: { leaf_type: leafType, subtype } });
    },
    subtypesList(leafType = 'ticket') {
      return apiCall('GET', 'schemas.subtypes.list', { params: { leaf_type: leafType } });
    },
    customSet(payload) {
      return apiCall('POST', 'schemas.custom.set', { body: payload });
    },
  },

  parts: {
    list(params = {}) {
      return apiCall('GET', 'parts.list', { params });
    },
  },

  groups: {
    list() { return apiCall('GET', 'groups.list'); },
    get(id) { return apiCall('GET', 'groups.get', { params: { id } }); },
    create(payload) { return apiCall('POST', 'groups.create', { body: payload }); },
    delete(id) { return apiCall('POST', 'groups.delete', { body: { id } }); },
    update(payload) { return apiCall('POST', 'groups.update', { body: payload }); },
  },

  works: {
    list(params = {}) {
      return apiCall('GET', 'works.list', { params, useInternal: false });
    },
  },
};
