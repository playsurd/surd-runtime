(function () {
  var M = window.SURD_GAME;
  if (!M) { fail('no SURD_GAME manifest'); return; }
  M.base = M.base.replace(/\/?$/, '/');
  M.runtime = (M.runtime || '').replace(/\/?$/, '/');
  function post(type, msg) {
    try { parent.postMessage({ __surdlog: 1, t: type, m: String(msg).slice(0, 400) }, '*'); } catch (e) {}
  }
  var elBar, elStatus, elChips;
  function ui() {
    if (elBar) return;
    var d = document.createElement('div');
    d.setAttribute('style', 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0a0a0c;color:#e7e7ea;font:14px/1.4 system-ui,sans-serif;z-index:2147483647');
    d.innerHTML =
      '<div style="width:46px;height:46px;border-radius:11px;background:#c2f04a;display:flex;align-items:center;justify-content:center">' +
      '<svg viewBox="0 0 32 32" width="30" height="30"><path d="M4 17l5 6.5L17.5 6H29" fill="none" stroke="#0a0a0c" stroke-width="3.2"/></svg></div>' +
      '<div style="width:min(260px,60vw);height:4px;border-radius:3px;background:#26262b;overflow:hidden">' +
      '<span style="display:block;height:100%;width:0;background:#c2f04a;transition:width .25s"></span></div>' +
      '<div class="surd-chips" style="display:flex;gap:3px;max-width:min(260px,60vw);flex-wrap:wrap;justify-content:center"></div>' +
      '<div style="font:12px ui-monospace,monospace;color:#9a9aa2;min-height:16px">preparing</div>';
    (document.body || document.documentElement).appendChild(d);
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () {
        if (d.parentNode !== document.body && document.body) document.body.appendChild(d);
      });
    }
    elBar = d.querySelector('span'); elStatus = d.querySelector('div:last-child'); elChips = d.querySelector('.surd-chips'); d.id = 'surd-boot';
  }
  function status(msg) { ui(); if (elStatus) elStatus.textContent = msg; post('info', msg); }
  function progress(f) { ui(); if (elBar) elBar.style.width = Math.max(0, Math.min(1, f)) * 100 + '%'; }
  var STALL_MS = 15000, HARD_MS = 180000;
  var net = { inflight: 0, finished: 0, lastEventAt: 0 };
  var engineUpAt = 0, lifted = false;
  function lift() {
    if (lifted) return;
    lifted = true;
    var d = document.getElementById('surd-boot');
    if (d) { d.style.opacity = 0; d.style.transition = 'opacity .4s'; setTimeout(function () { d.remove(); }, 450); }
  }
  function done() {
    if (engineUpAt || lifted) return;
    if (prefetchWait) { var w = prefetchWait; prefetchWait = null; w.then(done); return; }
    engineUpAt = Date.now();
    if (!net.inflight && !net.finished) { lift(); return; }
    var quiet = 0;
    var iv = setInterval(function () {
      var now = Date.now();
      var idleFor = now - (net.lastEventAt || engineUpAt);
      if (net.inflight > 0) {
        quiet = 0;
        status('still loading game data — ' + net.inflight + ' file'
          + (net.inflight === 1 ? '' : 's') + ' downloading, ' + net.finished + ' done');
        if (idleFor < STALL_MS && now - engineUpAt < HARD_MS) return;
      } else if (++quiet < 4) {
        status('finishing up');
        return;
      }
      clearInterval(iv);
      lift();
      post('info', 'game running');
    }, 250);
  }
  function fail(msg) { status('error: ' + msg); post('err', msg); }
  var CHIP_CAP = 20;
  var chipEls = [];
  function chips(n) {
    ui();
    if (!elChips) return;
    elChips.innerHTML = '';
    chipEls = [];
    for (var i = 0; i < n; i++) {
      var c = document.createElement('div');
      c.setAttribute('style', 'width:11px;height:11px;border-radius:3px;background:#1c1c20;border:1px solid #2c2c32;overflow:hidden;position:relative;flex:none');
      var f = document.createElement('div');
      f.setAttribute('style', 'position:absolute;left:0;bottom:0;width:100%;height:0%;background:#6f8a2e;transition:height .18s linear,background .25s');
      c.appendChild(f);
      elChips.appendChild(c);
      chipEls.push(f);
    }
  }
  function chipFill(i, frac) {
    var f = chipEls[i]; if (!f) return;
    f.style.height = Math.max(0, Math.min(1, frac)) * 100 + '%';
  }
  function chipDone(i) {
    var f = chipEls[i]; if (!f) return;
    f.style.height = '100%'; f.style.background = '#c2f04a';
    var box = f.parentNode;
    if (box) {
      box.style.transition = 'box-shadow .3s, border-color .3s';
      box.style.boxShadow = '0 0 6px #c2f04a99'; box.style.borderColor = '#c2f04a';
      setTimeout(function () { box.style.boxShadow = 'none'; }, 320);
    }
  }
  function chipsClear() { if (elChips) elChips.innerHTML = ''; chipEls = []; }
  var blobStore = {};
  function rememberBlob(url, blob) { blobStore[url] = blob; return url; }
  function lookupBlob(url) {
    if (typeof url !== 'string') return null;
    var shim = window.SURD_SPLIT && window.SURD_SPLIT.blobs;
    if (blobStore[url]) return blobStore[url];
    if (shim && shim[url]) return shim[url];
    if (url.indexOf('blob:') < 0) return null;
    var key;
    for (key in blobStore) if (url.indexOf(key) >= 0) return blobStore[key];
    if (shim) for (key in shim) if (url.indexOf(key) >= 0) return shim[key];
    return null;
  }
  var CACHE_NAME = 'surd-assets-v1';
  var cacheOk = typeof caches !== 'undefined' && caches && typeof caches.open === 'function';
  function cacheRead(a, key) {
    if (!cacheOk || !a.bytes) return Promise.resolve(null);
    return caches.open(CACHE_NAME).then(function (c) { return c.match(key); }).then(function (r) {
      if (!r) return null;
      return r.blob();
    }).then(function (b) {
      return b && b.size === a.bytes ? b : null;
    }).catch(function () { return null; });
  }
  function cacheWrite(key, blob) {
    if (!cacheOk) return;
    try {
      caches.open(CACHE_NAME).then(function (c) {
        return c.put(key, new Response(blob));
      }).catch(function () {  });
    } catch (e) {  }
  }
  function finishAsset(a, blob) {
    var keep = function (b) {
      var u = URL.createObjectURL(b);
      made.push(u); return rememberBlob(u, b);
    };
    if (!/\.unityweb$/i.test(a.path || '') || typeof DecompressionStream === 'undefined') return Promise.resolve(keep(blob));
    return blob.slice(0, 2).arrayBuffer().then(function (head) {
      var b = new Uint8Array(head);
      if (b.length < 2 || b[0] !== 0x1f || b[1] !== 0x8b) return keep(blob);
      status('decompressing ' + a.path.split('/').pop());
      return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob()
        .then(function (out) {
          return out.slice(0, 4).arrayBuffer().then(function (h) {
            var m = new Uint8Array(h), type = a.mime || '';
            if (m.length === 4 && m[0] === 0x00 && m[1] === 0x61 && m[2] === 0x73 && m[3] === 0x6d) type = 'application/wasm';
            return keep(type ? new Blob([out], { type: type }) : out);
          }).catch(function () { return keep(out); });
        })
        .catch(function () { return keep(blob); });
    }).catch(function () { return keep(blob); });
  }
  function fetchTracked(url, opts, onProgress) {
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      var total = +(r.headers.get('content-length') || 0) || 0;
      if (!r.body || !r.body.getReader) {
        return r.blob().then(function (b) { onProgress(b.size, b.size || total); return b; });
      }
      var reader = r.body.getReader();
      var chunks = [], loaded = 0;
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) return new Blob(chunks);
          chunks.push(res.value);
          loaded += res.value.byteLength;
          onProgress(loaded, total);
          return pump();
        });
      }
      return pump();
    });
  }
  var made = [];
  function asset(role) {
    var a = M.files[role];
    if (!a) return Promise.reject(new Error('manifest missing file "' + role + '"'));
    var url = M.base + a.path;
    if (!a.parts || !a.parts.length) return Promise.resolve(url);
    var partName = a.path.split('/').pop();
    function gather(attempt) {
      var parts = new Array(a.parts.length);
      var bust = attempt ? (url.indexOf('?') < 0 ? '?r=' : '&r=') + attempt : '';
      var doneCount = 0;
      status('assembling ' + partName + ' — part 0 of ' + a.parts.length);
      var nParts = a.parts.length;
      var nChips = Math.min(CHIP_CAP, nParts);
      var groupSize = Math.ceil(nParts / nChips);
      chips(nChips);
      var loaded = [], sizes = [], finished = [];
      for (var pi = 0; pi < nParts; pi++) { loaded.push(0); sizes.push(0); finished.push(false); }
      function refreshChip(i) {
        var g = Math.floor(i / groupSize);
        var lo = g * groupSize, hi = Math.min(nParts, lo + groupSize);
        var sum = 0;
        for (var j = lo; j < hi; j++) {
          sum += sizes[j] > 0 ? Math.min(1, loaded[j] / sizes[j]) : (finished[j] ? 1 : 0);
        }
        var frac = sum / (hi - lo);
        if (frac >= 1) chipDone(g); else chipFill(g, frac);
      }
      return Promise.all(a.parts.map(function (suffix, i) {
        return fetchTracked(url + suffix + bust, attempt ? { cache: 'reload' } : undefined, function (got, total) {
          loaded[i] = got; sizes[i] = total; refreshChip(i);
        }).then(function (b) {
          parts[i] = b;
          finished[i] = true; loaded[i] = b.size || loaded[i];
          refreshChip(i);
          doneCount++;
          status('assembling ' + partName + ' — part ' + doneCount + ' of ' + a.parts.length);
        });
      })).then(function () {
        chipsClear();
        var blob = new Blob(parts, { type: a.mime || 'application/octet-stream' });
        if (a.bytes && blob.size !== a.bytes) {
          if (attempt < 1) {
            post('warn', 'short read on ' + a.path + ' (' + blob.size + '/' + a.bytes + ') — refetching');
            return gather(attempt + 1);
          }
          throw new Error('size mismatch for ' + a.path + ': got ' + blob.size + ', expected ' + a.bytes);
        }
        cacheWrite(url, blob);
        return finishAsset(a, blob);
      });
    }
      return cacheRead(a, url).then(function (hit) {
      if (!hit) return gather(0);
      status('loaded ' + a.path.split('/').pop() + ' from cache');
      return finishAsset(a, hit);
    });
  }
  function blobify(url, mime) {
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
      var blob = new Blob([b], { type: mime || 'application/javascript' });
      var u = URL.createObjectURL(blob);
      made.push(u); return rememberBlob(u, blob);
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
          return b.slice(0, 2).arrayBuffer().then(function (h) { return { b: b, h: new Uint8Array(h) }; });
        })
        .then(function (pair) {
          var b = pair.b, b0 = pair.h[0], b1 = pair.h[1];
          if (b.size !== a.bytes) {
            if (attempt < 1) { post('warn', 'short read on ' + a.path + ' (' + b.size + '/' + a.bytes + ') — refetching'); return get(attempt + 1); }
            throw new Error('size mismatch for ' + a.path + ': got ' + b.size + ', expected ' + a.bytes);
          }
          var brotliish = /\.unityweb$/i.test(a.path || '') && !(b0 === 0x1f && b1 === 0x8b);
          if (brotliish) return url;
          return finishAsset(a, new Blob([b], { type: a.mime || 'application/octet-stream' }));
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
  if (!window.isSecureContext) {
    var nativeFetch = window.fetch && window.fetch.bind(window);
    if (nativeFetch) {
      window.fetch = function (input, init) {
        var u = typeof input === 'string' ? input : (input && input.url) || '';
        var b = lookupBlob(u);
        if (b) return Promise.resolve(new Response(b, { status: 200 }));
        return nativeFetch(input, init);
      };
    }
    var NativeXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
      var xhr = new NativeXHR();
      var open = xhr.open, target = null;
      xhr.open = function (method, url) {
        target = lookupBlob(url);
        if (target) return;
        return open.apply(xhr, arguments);
      };
      var send = xhr.send;
      xhr.send = function () {
        if (!target) return send.apply(xhr, arguments);
        var blob = target;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            Object.defineProperty(xhr, 'response', { value: xhr.responseType === 'text' ? reader.result : reader.result, configurable: true });
            Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
            Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
          } catch (e) {}
          if (xhr.onprogress) { try { xhr.onprogress({ loaded: blob.size, total: blob.size, lengthComputable: true }); } catch (e) {} }
          if (xhr.onreadystatechange) { try { xhr.onreadystatechange(); } catch (e) {} }
          if (xhr.onload) { try { xhr.onload({ target: xhr }); } catch (e) {} }
        };
        reader.onerror = function () { if (xhr.onerror) xhr.onerror(reader.error); };
        if (xhr.responseType === 'text' || xhr.responseType === '') reader.readAsText(blob);
        else reader.readAsArrayBuffer(blob);
      };
      return xhr;
    };
  }
  try {
    var swc = navigator.serviceWorker;
    if (swc) {
      var swNone = function () { return Promise.resolve(undefined); };
      try { swc.register = swNone; } catch (e) {}
      try { swc.getRegistration = swNone; } catch (e) {}
      try { swc.getRegistrations = function () { return Promise.resolve([]); }; } catch (e) {}
    }
  } catch (e) {}
  (function () {
    function safeGamepads(orig, self) {
      return function () {
        try { var r = orig ? orig.apply(self, arguments) : null; return r || []; }
        catch (e) { return []; }
      };
    }
    try {
      var nav = window.navigator;
      var proto = window.Navigator && window.Navigator.prototype;
      if (proto && 'getGamepads' in proto) {
        var protoOrig = proto.getGamepads;
        Object.defineProperty(proto, 'getGamepads', { value: safeGamepads(protoOrig, nav), configurable: true, writable: true });
      }
      var own = nav.getGamepads;
      Object.defineProperty(nav, 'getGamepads', { value: safeGamepads(own, nav), configurable: true, writable: true });
    } catch (e) {}
  })();
  var saveBridge = null;
  function makeStore(persistKey) {
    var m = {};
    var flushTimer = null;
    function flush() {
      flushTimer = null;
      if (!persistKey) return;
      try { parent.postMessage({ __surdsave: 1, op: 'save', game: M.id, data: m }, '*'); } catch (e) {}
    }
    var store = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, String(k)) ? m[String(k)] : null; },
      setItem: function (k, v) { m[String(k)] = String(v); if (persistKey && !flushTimer) flushTimer = setTimeout(flush, 400); },
      removeItem: function (k) { delete m[String(k)]; if (persistKey && !flushTimer) flushTimer = setTimeout(flush, 400); },
      clear: function () { m = {}; if (persistKey) flush(); },
      key: function (i) { return Object.keys(m)[i] || null; },
      __hydrate: function (obj) { if (obj && typeof obj === 'object') for (var k in obj) m[k] = String(obj[k]); },
      __flushNow: flush,
    };
    Object.defineProperty(store, 'length', { get: function () { return Object.keys(m).length; } });
    return store;
  }
  function storageWorks(name) {
    try { var s = window[name]; s.setItem('__surd', '1'); s.removeItem('__surd'); return true; }
    catch (e) { return false; }
  }
  function hydrateFromParent(store) {
    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (!done) { done = true; window.removeEventListener('message', onMsg); resolve(); } }
      function onMsg(e) {
        var d = e && e.data;
        if (!d || !d.__surdsave || d.op !== 'loaded' || d.game !== M.id) return;
        store.__hydrate(d.data);
        var n = d.data ? Object.keys(d.data).length : 0;
        if (n) post('info', 'restored ' + n + ' saved value' + (n === 1 ? '' : 's'));
        finish();
      }
      window.addEventListener('message', onMsg);
      try { parent.postMessage({ __surdsave: 1, op: 'load', game: M.id }, '*'); } catch (e) { finish(); }
      setTimeout(finish, 1500);
    });
  }
  var lsBroken = !storageWorks('localStorage');
  if (lsBroken) {
    saveBridge = makeStore(true);
    try { Object.defineProperty(window, 'localStorage', { value: saveBridge, configurable: true }); } catch (e) {}
    window.addEventListener('pagehide', function () { try { saveBridge.__flushNow(); } catch (e) {} });
    window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { try { saveBridge.__flushNow(); } catch (e) {} } });
  }
  if (!storageWorks('sessionStorage')) {
    try { Object.defineProperty(window, 'sessionStorage', { value: makeStore(false), configurable: true }); } catch (e) {}
  }
  try {
    var CP = HTMLCanvasElement.prototype, ngc = CP.getContext;
    CP.getContext = function (type) {
      var ctx = ngc.apply(this, arguments);
      if (ctx && !this.__surdCtxType) {
        try { this.__surdCtxType = String(type).toLowerCase(); this.__surdCtx = ctx; } catch (e) {}
      }
      return ctx;
    };
    var nto = CP.transferControlToOffscreen;
    if (nto) {
      CP.transferControlToOffscreen = function () {
        try { this.__surdCtxType = this.__surdCtxType || 'offscreen'; } catch (e) {}
        return nto.apply(this, arguments);
      };
    }
  } catch (e) {  }
  (function () {
    var mark = function (d) { net.inflight += d; if (d < 0) net.finished++; net.lastEventAt = Date.now(); };
    var f = window.fetch && window.fetch.bind(window);
    if (f) {
      window.fetch = function () {
        mark(1);
        var settled = false, one = function () { if (!settled) { settled = true; mark(-1); } };
        return f.apply(null, arguments).then(function (r) { one(); return r; },
          function (e) { one(); throw e; });
      };
    }
    try {
      var XS = window.XMLHttpRequest.prototype, ns = XS.send;
      XS.send = function () {
        var self = this, settled = false;
        var one = function () { if (!settled) { settled = true; mark(-1); } };
        mark(1);
        try { self.addEventListener('loadend', one); } catch (e) { one(); }
        try { return ns.apply(this, arguments); } catch (e) { one(); throw e; }
      };
    } catch (e) {  }
  })();
  var prefetchWait = null;
  (function () {
    var st = window.SURD_PREFETCH;
    if (!st || !st.total) return;
    chips(st.total);
    prefetchWait = new Promise(function (resolve) {
      var iv = setInterval(function () {
        for (var i = 0; i < st.done; i++) chipDone(i);
        var f = st.bytes ? st.doneBytes / st.bytes : st.done / st.total;
        progress(0.05 + f * 0.9);
        status('downloading game data — ' + st.done + ' of ' + st.total
          + ' file' + (st.total === 1 ? '' : 's'));
        if (st.done + st.failed < st.total) return;
        clearInterval(iv);
        if (st.failed) post('warn', st.failed + ' prefetch(es) failed — the game will fetch those itself');
        status('unpacking game data');
        resolve();
      }, 150);
    });
  })();
  status('preparing');
  var ready = saveBridge ? hydrateFromParent(saveBridge) : Promise.resolve();
  ready.then(function () { return loadScript(M.runtime + 'portal-sdk.js'); })
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