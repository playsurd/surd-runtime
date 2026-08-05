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
    function gather(attempt) {
      var parts = new Array(a.parts.length);
      var bust = attempt ? (url.indexOf('?') < 0 ? '?r=' : '&r=') + attempt : '';
      return Promise.all(a.parts.map(function (suffix, i) {
        return fetch(url + suffix + bust, attempt ? { cache: 'reload' } : undefined).then(function (r) {
          if (!r.ok) throw new Error(r.status + ' ' + a.path + suffix);
          return r.blob();
        }).then(function (b) { parts[i] = b; });
      })).then(function () {
        var blob = new Blob(parts, { type: a.mime || 'application/octet-stream' });
        if (a.bytes && blob.size !== a.bytes) {
          if (attempt < 1) {
            post('warn', 'short read on ' + a.path + ' (' + blob.size + '/' + a.bytes + ') — refetching');
            return gather(attempt + 1);
          }
          throw new Error('size mismatch for ' + a.path + ': got ' + blob.size + ', expected ' + a.bytes);
        }
        var u = URL.createObjectURL(blob);
        made.push(u); return u;
      });
    }
    return gather(0);
  }
  function blobify(url, mime) {
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
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
  function assetChecked(role) {
    var a = M.files[role];
    if (!a) return Promise.reject(new Error('manifest missing file "' + role + '"'));
    if (a.parts && a.parts.length) return asset(role);
    if (!a.bytes) return Promise.resolve(M.base + a.path);
    var url = M.base + a.path;
    function get(attempt) {
      var opts = attempt ? { cache: 'reload' } : undefined;
      return fetch(url + (attempt ? (url.indexOf('?') < 0 ? '?r=' : '&r=') + attempt : ''), opts)
        .then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + a.path); return r.blob(); })
        .then(function (b) {
          if (b.size !== a.bytes) {
            if (attempt < 1) { post('warn', 'short read on ' + a.path + ' (' + b.size + '/' + a.bytes + ') — refetching'); return get(attempt + 1); }
            throw new Error('size mismatch for ' + a.path + ': got ' + b.size + ', expected ' + a.bytes);
          }
          var u = URL.createObjectURL(new Blob([b], { type: a.mime || 'application/octet-stream' }));
          made.push(u); return u;
        });
    }
    return get(0);
  }
  window.SURD = { M: M, status: status, progress: progress, done: done, fail: fail, assetChecked: assetChecked,
                  post: post, asset: asset, blobify: blobify, loadScript: loadScript,
                  url: function (p) { return M.base + p; } };
  if (!window.isSecureContext) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !('audioWorklet' in AC.prototype)) {
        Object.defineProperty(AC.prototype, 'audioWorklet', {
          configurable: true,
          get: function () { return { addModule: function () { return Promise.resolve(); } }; },
        });
      }
      if (AC) {
        window.AudioWorkletNode = function (ctx, name, opts) {
          var ch = (opts && opts.outputChannelCount && opts.outputChannelCount[0]) || 2;
          var node = ctx.createScriptProcessor ? ctx.createScriptProcessor(2048, ch, ch) : ctx.createGain();
          node.port = { postMessage: function () {}, onmessage: null, start: function () {}, close: function () {} };
          node.parameters = { get: function () { return undefined; } };
          return node;
        };
      }
    } catch (e) { post('warn', 'audio shim unavailable: ' + (e && e.message || e)); }
  }
  status('preparing');
  loadScript(M.runtime + 'portal-sdk.js')
    .catch(function () { post('warn', 'portal sdk stubs unavailable'); })
    .then(function () { return loadScript(M.runtime + 'adapters/' + M.engine + '.js'); })
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