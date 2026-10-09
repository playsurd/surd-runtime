window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.godot = async function (M, S) {
  var cfg = M.config || {};
  if (!document.querySelector('base')) {
    var base = document.createElement('base'); base.href = M.base; document.head.appendChild(base);
  }
  document.body.style.margin = '0'; document.body.style.background = '#000';
  var canvas = document.createElement('canvas');
  canvas.id = 'canvas'; canvas.style.cssText = 'display:block;width:100vw;height:100vh;border:0';
  document.body.appendChild(canvas);
  var redirect = {};
  for (var role in M.files) {
    var a = M.files[role];
    if (a.parts && a.parts.length) {
      redirect[a.path.split('/').pop()] = await S.asset(role);
    }
  }
  var of = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || '';
    for (var name in redirect) {
      var path = u.split('?')[0];
      if (path === name || path.endsWith('/' + name)) return of(redirect[name], init);
    }
    return of(input, init);
  };
  S.status('loading Godot engine');
  await S.loadScript(S.url(cfg.indexJs || 'index.js'));
  S.progress(0.2);
  var gc = Object.assign({}, cfg.godotConfig || {});
  if (!gc.executable) gc.executable = 'index';
  gc.canvas = canvas;
  gc.canvasResizePolicy = gc.canvasResizePolicy != null ? gc.canvasResizePolicy : 2;
  gc.serviceWorker = '';
  var idbOk = await new Promise(function (resolve) {
    var settled = false;
    var done = function (v) { if (!settled) { settled = true; resolve(v); } };
    setTimeout(function () { done(false); }, 3000);
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return done(false);
      var rq = indexedDB.open('surd-persist-probe', 1);
      rq.onsuccess = function () {
        try { rq.result.close(); } catch (e) {}
        done(true);
      };
      rq.onerror = function () { done(false); };
      rq.onblocked = function () { done(false); };
    } catch (e) { done(false); }
  });
  if (idbOk) {
    if (gc.persistentPaths) delete gc.persistentPaths;
    S.post('info', 'godot: persistent storage available — saves will be kept');
  } else {
    gc.persistentPaths = [];
    S.post('warn', 'godot: no persistent storage here — saves are memory-only this session');
  }
  try {
    var sw = navigator.serviceWorker;
    if (sw) {
      var none = function () { return Promise.resolve(undefined); };
      try { sw.register = none; } catch (e) {}
      try { sw.getRegistration = none; } catch (e) {}
      try { sw.getRegistrations = function () { return Promise.resolve([]); }; } catch (e) {}
      try { Object.defineProperty(sw, 'ready', { get: function () { return new Promise(function () {}); } }); } catch (e) {}
    }
  } catch (e) {}
  S.status('starting Godot game');
  if (typeof Engine === 'undefined') { S.fail('Engine not defined by ' + (cfg.indexJs || 'index.js')); return; }
  var engine = new Engine(gc);
  engine.startGame({
    onProgress: function (cur, total) { if (total > 0) S.progress(0.2 + (cur / total) * 0.8); },
  }).then(function () {
    S.done(); S.post('info', 'godot engine running');
  }).catch(function (e) {
    S.fail('startGame: ' + (e && e.message || e));
  });
  var n = 0, iv = setInterval(function () {
    if (canvas.width > 1 && canvas.height > 1) { S.done(); clearInterval(iv); }
    if (++n > 160) clearInterval(iv);
  }, 300);
};