/* surd-runtime — Godot 4 adapter (our own Godot loader).
 *
 * Godot's emscripten module (index.js, defines `Engine`) fetches its payload by
 * RELATIVE path (index.wasm, index.pck, index.side.wasm, index.audio.worklet.js).
 * We: (1) set a <base> to the jsDelivr game dir so every relative fetch resolves to
 * the CDN; (2) pre-assemble split roles (pck / side.wasm) into blob URLs and redirect
 * only those specific filenames through a wrapped fetch; (3) build the Engine from the
 * manifest's captured GODOT_CONFIG and start it. No blind shim — a controlled map of
 * our own known files.
 *
 * manifest.config = { godotConfig: <the game's GODOT_CONFIG object>, indexJs:"index.js" }
 * manifest.files  = { <name>: {path, parts?, mime?}, ... } for every split file.
 */
window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.godot = async function (M, S) {
  var cfg = M.config || {};

  // Relative fetches (wasm, audio worklet) resolve to the CDN dir.
  var base = document.createElement('base'); base.href = M.base; document.head.appendChild(base);
  document.body.style.margin = '0'; document.body.style.background = '#000';
  var canvas = document.createElement('canvas');
  canvas.id = 'canvas'; canvas.style.cssText = 'display:block;width:100vw;height:100vh;border:0';
  document.body.appendChild(canvas);

  // Assemble split files -> blob URLs BEFORE patching fetch (asset() uses fetch).
  var redirect = {};   // basename -> resolved URL
  for (var role in M.files) {
    var a = M.files[role];
    if (a.parts && a.parts.length) {
      redirect[a.path.split('/').pop()] = await S.asset(role);
    }
  }
  // Wrap fetch: our split files -> their blob; everything else untouched.
  var of = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || '';
    for (var name in redirect) {
      if (u.indexOf(name) >= 0 && u.indexOf('.part') < 0) return of(redirect[name], init);
    }
    return of(input, init);
  };

  // Godot optionally registers a PWA service worker for offline play. It can only
  // register from the document's own origin, and games run from a blob: document, so
  // it always throws. Neutralise it — the feature is irrelevant here.
  try {
    var sw = navigator.serviceWorker;
    if (sw) {
      var no = function () { return Promise.resolve(undefined); };
      if (sw.register) sw.register = no;
      if (sw.getRegistration) sw.getRegistration = no;
      if (sw.getRegistrations) sw.getRegistrations = function () { return Promise.resolve([]); };
    }
  } catch (e) {}

  S.status('loading Godot engine');
  await S.loadScript(S.url(cfg.indexJs || 'index.js'));   // defines Engine
  S.progress(0.2);

  var gc = Object.assign({}, cfg.godotConfig || {});
  if (!gc.executable) gc.executable = 'index';
  gc.canvas = canvas;
  gc.canvasResizePolicy = gc.canvasResizePolicy != null ? gc.canvasResizePolicy : 2;

  S.status('starting Godot game');
  /* global Engine */
  if (typeof Engine === 'undefined') { S.fail('Engine not defined by ' + (cfg.indexJs || 'index.js')); return; }
  var engine = new Engine(gc);
  engine.startGame({
    onProgress: function (cur, total) { if (total > 0) S.progress(0.2 + (cur / total) * 0.8); },
  }).then(function () {
    S.done(); S.post('info', 'godot engine running');
  }).catch(function (e) {
    S.fail('startGame: ' + (e && e.message || e));
  });

  // Fallback: hide overlay once the canvas has real pixels.
  var n = 0, iv = setInterval(function () {
    if (canvas.width > 1 && canvas.height > 1) { S.done(); clearInterval(iv); }
    if (++n > 160) clearInterval(iv);
  }, 300);
};
