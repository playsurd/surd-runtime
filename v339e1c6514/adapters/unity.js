window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
function publishInstance(inst) {
  var W = window;
  W.__surdUnity = inst;
  var names = ['unityInstance', 'gameInstance', 'myGameInstance', 'unityGame', 'gameInstanceRef'];
  for (var i = 0; i < names.length; i++) {
    try { if (!W[names[i]]) W[names[i]] = inst; } catch (e) {  }
  }
  return inst;
}
window.SURD_ADAPTERS.unity = async function (M, S) {
  var cfg = M.config || {};
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  if (cfg.era === 'modern') {
    var canvas = document.getElementById('unity-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'unity-canvas';
      canvas.style.cssText = 'width:100vw;height:100vh;display:block';
      document.body.appendChild(canvas);
    }
    S.status('loading Unity engine');
    await S.loadScript(S.url(cfg.loaderJs));
    S.progress(0.15);
    var uconf = {
      dataUrl: await S.asset('data'),
      frameworkUrl: await S.asset('framework'),
      codeUrl: await S.asset('code'),
      streamingAssetsUrl: S.url(cfg.streamingAssetsUrl || 'StreamingAssets'),
      companyName: cfg.companyName || 'surd',
      productName: cfg.productName || M.id,
      productVersion: cfg.productVersion || '1.0',
    };
    if (cfg.memory) uconf.memoryUrl = S.url(cfg.memory);
    if (cfg.symbols) uconf.symbolsUrl = S.url(cfg.symbols);
    S.status('starting Unity game');
    try {
      createUnityInstance(canvas, uconf, function (p) { S.progress(0.15 + p * 0.85); })
        .then(function (inst) { publishInstance(inst); S.done(); S.post('info', 'unity instance running'); })
        .catch(function (e) { S.fail((e && e.message) || e); });
    } catch (e) { S.fail('createUnityInstance threw: ' + (e && e.message || e)); }
    return;
  }
  var container = document.getElementById('gameContainer') || document.getElementById('unity-container');
  if (!container) {
    container = document.createElement('div');
    container.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    document.body.appendChild(container);
  }
  container.id = 'gameContainer';
  S.status('loading Unity engine');
  if (cfg.progressJs) await S.loadScript(S.url(cfg.progressJs)).catch(function () {});
  if (typeof window.UnityProgress !== 'function') {
    window.UnityProgress = function () {
      this.SetMessage = function () {}; this.SetProgress = function () {}; this.Clear = function () {};
    };
  }
  await S.loadScript(cfg.loaderUrl || S.url(cfg.loaderJs));
  S.progress(0.15);
  var data = await S.asset('data');
  var legacy = Object.assign({}, cfg.unityConfig || {}, {
    companyName: cfg.companyName || (cfg.unityConfig && cfg.unityConfig.companyName) || 'surd',
    productName: cfg.productName || (cfg.unityConfig && cfg.unityConfig.productName) || M.id,
    dataUrl: data,
    TOTAL_MEMORY: cfg.totalMemory || 268435456,
    graphicsAPI: cfg.graphicsAPI || ['WebGL 2.0', 'WebGL 1.0'],
    webglContextAttributes: { preserveDrawingBuffer: false },
    splashScreenStyle: cfg.splashScreenStyle || (cfg.unityConfig && cfg.unityConfig.splashScreenStyle) || 'Dark',
    backgroundColor: cfg.backgroundColor || (cfg.unityConfig && cfg.unityConfig.backgroundColor) || '#000000',
  });
  if (cfg.variant === 'asm') {
    legacy.asmCodeUrl = await S.assetChecked('code');
    legacy.asmFrameworkUrl = await S.assetChecked('framework');
    legacy.codeUrl = legacy.asmCodeUrl;
    if (M.files.memory) { var mem = await S.assetChecked('memory'); legacy.asmMemoryUrl = mem; legacy.memUrl = mem; }
  } else {
    legacy.wasmCodeUrl = await S.assetChecked('code');
    legacy.wasmFrameworkUrl = await S.assetChecked('framework');
  }
  S.status('starting Unity game');
  var progressCb = function (_g, p) { if (typeof p === 'number') S.progress(0.15 + p * 0.85); if (p === 1) S.done(); };
  for (var k in legacy) {
    if (typeof legacy[k] === 'string' && /\//.test(legacy[k]) && !/^(data:|blob:|https?:)/.test(legacy[k])) {
      legacy[k] = new URL(legacy[k], M.base).href;
    }
  }
  var jsonUrl = URL.createObjectURL(new Blob([JSON.stringify(legacy)], { type: 'application/json' }));
  var opts = { onProgress: progressCb };
  var wasmCodeUrl = legacy.wasmCodeUrl || legacy.asmCodeUrl || null;
  if (cfg.variant !== 'asm' && wasmCodeUrl) window.wasmurll = wasmCodeUrl;
  if (cfg.variant !== 'asm') {
    opts.Module = {
      locateFile: function (f) {
        if (f === 'build.wasm') return wasmCodeUrl || (this && this.wasmCodeUrl) || ('Build/' + f);
        return 'Build/' + f;
      },
    };
  }
  var call = {
    object: function () { opts.url = jsonUrl; publishInstance(UnityLoader.instantiate('gameContainer', legacy, opts)); },
    url: function () { publishInstance(UnityLoader.instantiate('gameContainer', jsonUrl, opts)); },
  };
  var first = cfg.instantiate === 'object' ? 'object' : 'url';
  var other = first === 'object' ? 'url' : 'object';
  try {
    call[first]();
  } catch (e) {
    if (cfg.instantiate) { S.fail('instantiate: ' + (e && e.message || e)); return; }
    S.post('warn', 'no instantiate form detected; ' + first + ' rejected (' + (e && e.message || e) + ') — trying ' + other);
    try { call[other](); }
    catch (e2) { S.fail('instantiate: ' + (e2 && e2.message || e2)); }
  }
  var tries = 0, iv = setInterval(function () {
    var c = container.querySelector('canvas') || document.querySelector('canvas');
    if (c && c.width > 1 && !(c.width === 300 && c.height === 150)) {
      var live = false;
      try { live = !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { live = true; }
      if (live) { S.done(); S.post('info', 'unity instance running'); clearInterval(iv); return; }
    }
    if (++tries > 120) {
      clearInterval(iv);
      var d = c ? (c.width + 'x' + c.height + ' css ' + Math.round(c.getBoundingClientRect().width) + 'x' + Math.round(c.getBoundingClientRect().height)) : 'no canvas element';
      S.post('warn', 'unity: no drawn canvas after 30s (' + d + ')');
    }
  }, 250);
};