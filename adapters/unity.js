/* surd-runtime — Unity adapter (our own Unity loader).
 *
 * Handles both Unity WebGL eras:
 *   - 2019/2020: UnityLoader.js + UnityLoader.instantiate(container, config, {onProgress})
 *   - 2021+:     <build>.loader.js + createUnityInstance(canvas, config, onProgress)
 *
 * The manifest tells us which via config.era ("legacy" | "modern"). Every big asset
 * (data) is resolved through SURD.asset() (split-parts -> blob); small assets
 * (code, framework, loader.js) are plain jsDelivr URLs the engine fetches itself.
 */
window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.unity = async function (M, S) {
  var cfg = M.config || {};

  // Full-viewport container/canvas.
  document.body.style.margin = '0';
  document.body.style.background = '#000';

  if (cfg.era === 'modern') {
    // ---- Unity 2021+ ----
    var canvas = document.createElement('canvas');
    canvas.id = 'unity-canvas';
    canvas.style.cssText = 'width:100vw;height:100vh;display:block';
    document.body.appendChild(canvas);

    S.status('loading Unity engine');
    await S.loadScript(S.url(cfg.loaderJs));           // <build>.loader.js (small, jsDelivr)
    S.progress(0.15);

    var dataUrl = await S.asset('data');               // may be split -> blob
    var uconf = {
      dataUrl: dataUrl,
      frameworkUrl: S.url(M.files.framework.path),
      codeUrl: S.url(M.files.code.path),
      streamingAssetsUrl: cfg.streamingAssetsUrl ? S.url(cfg.streamingAssetsUrl) : 'StreamingAssets',
      companyName: cfg.companyName || 'surd',
      productName: cfg.productName || M.id,
      productVersion: cfg.productVersion || '1.0',
    };
    if (cfg.memory) uconf.memoryUrl = S.url(cfg.memory);
    if (cfg.symbols) uconf.symbolsUrl = S.url(cfg.symbols);

    S.status('starting Unity game');
    /* global createUnityInstance */
    createUnityInstance(canvas, uconf, function (p) { S.progress(0.15 + p * 0.85); })
      .then(function () { S.done(); S.post('info', 'unity instance running'); })
      .catch(function (e) { S.fail((e && e.message) || e); });
    return;
  }

  // ---- Unity 2019/2020 (legacy UnityLoader) ----
  var container = document.createElement('div');
  container.id = 'gameContainer';
  container.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  document.body.appendChild(container);

  S.status('loading Unity engine');
  if (cfg.progressJs) await S.loadScript(S.url(cfg.progressJs)).catch(function () {}); // UnityProgress.js (optional)
  await S.loadScript(S.url(cfg.loaderJs));             // UnityLoader.js
  S.progress(0.15);

  var data = await S.asset('data');                    // split parts -> blob URL
  var legacy = {
    companyName: cfg.companyName || 'surd',
    productName: cfg.productName || M.id,
    dataUrl: data,
    wasmCodeUrl: S.url(M.files.code.path),
    wasmFrameworkUrl: S.url(M.files.framework.path),
    TOTAL_MEMORY: cfg.totalMemory || 268435456,
    graphicsAPI: cfg.graphicsAPI || ['WebGL 2.0', 'WebGL 1.0'],
    webglContextAttributes: { preserveDrawingBuffer: false },
    splashScreenStyle: cfg.splashScreenStyle || 'Dark',
    backgroundColor: cfg.backgroundColor || '#000000',
  };
  if (cfg.asmCodeUrl) { legacy.codeUrl = S.url(cfg.asmCodeUrl); legacy.asmCodeUrl = S.url(cfg.asmCodeUrl); }
  if (cfg.memUrl) legacy.memUrl = S.url(cfg.memUrl);

  S.status('starting Unity game');
  /* global UnityLoader */
  var progressCb = function (_g, p) { if (typeof p === 'number') S.progress(0.15 + p * 0.85); if (p === 1) S.done(); };
  // Mirror the upstream porter's exact invocation: pass a blob: URL of the JSON
  // config in the 3rd arg's `url` (some UnityLoader builds require it).
  var jsonUrl = URL.createObjectURL(new Blob([JSON.stringify(legacy)], { type: 'application/json' }));
  try {
    UnityLoader.instantiate('gameContainer', legacy, { onProgress: progressCb, url: jsonUrl });
  } catch (e) { S.fail('instantiate: ' + (e && e.message || e)); }
  // Belt-and-suspenders: hide the boot overlay once a GL canvas exists.
  var tries = 0, iv = setInterval(function () {
    var c = container.querySelector('canvas');
    if (c && c.width > 1) { S.done(); clearInterval(iv); }
    if (++tries > 120) clearInterval(iv);
  }, 250);
};
