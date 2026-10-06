(function () {
  function uuidv4() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getDeviceId() {
    let id = localStorage.getItem('telestrations_device_id');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('telestrations_device_id', id);
    }
    return id;
  }

  async function apiFetch(apiPath, options) {
    const opts = options || {};
    const headers = Object.assign(
      { 'X-Device-Id': getDeviceId() },
      opts.body ? { 'Content-Type': 'application/json' } : {},
      opts.headers || {}
    );
    const res = await fetch('/api' + apiPath, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }

  window.Device = { getDeviceId, apiFetch };
})();
