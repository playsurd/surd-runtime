(function () {
  var M = window.SURD_GAME;
  if (!M) { fail('no SURD_GAME manifest'); return; }
  M.base = M.base.replace(/\/?$/, '/');
  M.runtime = (M.runtime || '').replace(/\/?$/, '/');
  function post(type, msg) {
    try { parent.postMessage({ __surdlog: 1, t: type, m: String(msg).slice(0, 400) }, '*'); } catch (e) {}
  }
  var elBar, elStatus;
  function ui() {
    if (elBar) return;
    var d = document.createElement('div');
    d.setAttribute('style', 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0a0a0c;color:#e7e7ea;font:14px/1.4 system-ui,sans-serif;z-index:2147483647');
    d.innerHTML =
      '<div style="width:46px;height:46px;border-radius:11px;background:#c2f04a;display:flex;align-items:center;justify-content:center">' +
      '<svg viewBox="0 0 32 32" width="30" height="30"><path d="M4 17l5 6.5L17.5 6H29" fill="none" stroke="#0a0a0c" stroke-width="3.2"/></svg></div>' +
      '<div style="width:min(260px,60vw);height:4px;border-radius:3px;background:#26262b;overflow:hidden">' +
      '<span style="display:block;height:100%;width:0;background:#c2f04a;transition:width .25s"></span></div>' +
      '<div style="font:12px ui-monospace,monospace;color:#9a9aa2;min-height:16px">preparing</div>';
    (document.body || document.documentElement).appendChild(d);
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () {
        if (d.parentNode !== document.body && document.body) document.body.appendChild(d);
      });
    }
    elBar = d.querySelector('span'); elStatus = d.querySelector('div:last-child'); d.id = 'surd-boot';
  }
  function status(msg) { ui(); if (elStatus) elStatus.textContent = msg; post('info', msg); }
  function progress(f) { ui(); if (elBar) elBar.style.width = Math.max(0, Math.min(1, f)) * 100 + '%'; }
  function done() { var d = document.getElementById('surd-boot'); if (d) { d.style.opacity = 0; d.style.transition = 'opacity .4s'; setTimeout(function () { d.remove(); }, 450); } }
  function fail(msg) { status('error: ' + msg); post('err', msg); }
  var made = [];
  function asset(role) {
    var a = M.files[role];
    if (!a) return Promise.reject(new Error('manifest missing file "' + role + '"'));
    var url = M.base + a.path;
    if (!a.parts || !a.parts.length) return Promise.resolve(url);
    status('assembling ' + a.path.split('/').pop() + ' (' + a.parts.length + ' parts)');
    var bufs = new Array(a.parts.length);
    return Promise.all(a.parts.map(function (suffix, i) {
      return fetch(url + suffix).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + a.path + suffix);
        return r.arrayBuffer();
      }).then(function (b) { bufs[i] = b; });
    })).then(function () {
      var u = URL.createObjectURL(new Blob(bufs, { type: a.mime || 'application/octet-stream' }));
      made.push(u); return u;
    });
  }
  function blobify(url, mime) {
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) {
      var u = URL.createObjectURL(new Blob([b], { type: mime || 'application/javascript' }));
      made.push(u); return u;
    });
  }
  function loadScript(url) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.crossOrigin = 'anonymous';
      s.src = url; s.onload = res; s.onerror = function () { rej(new Error('script ' + url)); };
      document.head.appendChild(s);
    });
  }
  window.SURD = { M: M, status: status, progress: progress, done: done, fail: fail,
                  post: post, asset: asset, blobify: blobify, loadScript: loadScript, url: function (p) { return M.base + p; } };
  status('preparing');
  loadScript(M.runtime + 'adapters/' + M.engine + '.js')
    .then(function () {
      var adapter = (window.SURD_ADAPTERS || {})[M.engine];
      if (!adapter) throw new Error('no adapter for engine "' + M.engine + '"');
      return adapter(M, window.SURD);
    })
    .catch(function (e) { fail((e && e.message) || e); });
  window.addEventListener('error', function (e) {
    if (e && e.target && (e.target.src || e.target.href)) post('err', 'failed to load ' + (e.target.src || e.target.href));
    else post('err', (e && e.message) || 'error');
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    post('err', 'promise rejected: ' + (e && e.reason && (e.reason.message || e.reason) || '?'));
  });
})();