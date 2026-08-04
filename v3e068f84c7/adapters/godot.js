window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.godot = async function (M, S) {
  var cfg = M.config || {};
  var base = document.createElement('base'); base.href = M.base; document.head.appendChild(base);
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
      if (u.indexOf(name) >= 0 && u.indexOf('.part') < 0) return of(redirect[name], init);
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
  gc.persistentPaths = [];
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