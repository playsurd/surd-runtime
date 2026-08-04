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

    // Every role goes through asset(): it returns a plain CDN URL when the file is
    // small and a reassembled blob when it was split. Any of them can be oversized.
    var uconf = {
      dataUrl: await S.asset('data'),
      frameworkUrl: await S.asset('framework'),
      codeUrl: await S.asset('code'),
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
  /* Start from the build's own Unity JSON when the port shipped one: loaders read more
   * than the asset URLs (2019.x calls unityVersion.split('.') and dies without it), and
   * guessing those fields is how a game boots to a black screen. Ours override only the
   * URLs and the fields we're authoritative about. */
  var legacy = Object.assign({
    unityVersion: '2019.1.0f1',
  }, cfg.unityConfig || {}, {
    companyName: cfg.companyName || (cfg.unityConfig && cfg.unityConfig.companyName) || 'surd',
    productName: cfg.productName || (cfg.unityConfig && cfg.unityConfig.productName) || M.id,
    dataUrl: data,
    TOTAL_MEMORY: cfg.totalMemory || 268435456,
    graphicsAPI: cfg.graphicsAPI || ['WebGL 2.0', 'WebGL 1.0'],
    webglContextAttributes: { preserveDrawingBuffer: false },
    splashScreenStyle: cfg.splashScreenStyle || (cfg.unityConfig && cfg.unityConfig.splashScreenStyle) || 'Dark',
    backgroundColor: cfg.backgroundColor || (cfg.unityConfig && cfg.unityConfig.backgroundColor) || '#000000',
  });
  /* asm.js and wasm builds are configured through different keys. Getting this wrong
   * surfaces as "Module.asm is not a function" rather than anything about the file. */
  if (cfg.variant === 'asm') {
    legacy.asmCodeUrl = await S.asset('code');
    legacy.asmFrameworkUrl = await S.asset('framework');
    legacy.codeUrl = legacy.asmCodeUrl;
    if (M.files.memory) legacy.memUrl = await S.asset('memory');
  } else {
    legacy.wasmCodeUrl = await S.asset('code');
    legacy.wasmFrameworkUrl = await S.asset('framework');
  }

  S.status('starting Unity game');
  /* global UnityLoader */
  var progressCb = function (_g, p) { if (typeof p === 'number') S.progress(0.15 + p * 0.85); if (p === 1) S.done(); };
  /* Two incompatible legacy call forms exist and neither degrades into the other:
   *   'url'    — the canonical Unity API: instantiate(container, <url of a JSON config>).
   *              2019.x loaders call .lastIndexOf() on it, so an object throws TypeError.
   *   'object' — ports whose UnityLoader was patched to take the config inline.
   * retemplate reads which one the game's own page used and records it, so this is a
   * decision made once at build time rather than probed at runtime.
   * With the url form the JSON is fetched from a blob:, and relative URLs inside it
   * would resolve against that blob — so everything is absolutised first. */
  // Relative URLs would resolve against the blob: the JSON is served from, so absolutise.
  for (var k in legacy) {
    if (typeof legacy[k] === 'string' && /\//.test(legacy[k]) && !/^(data:|blob:|https?:)/.test(legacy[k])) {
      legacy[k] = new URL(legacy[k], document.baseURI).href;
    }
  }
  var jsonUrl = URL.createObjectURL(new Blob([JSON.stringify(legacy)], { type: 'application/json' }));
  var call = {
    object: function () { UnityLoader.instantiate('gameContainer', legacy, { onProgress: progressCb, url: jsonUrl }); },
    url: function () { UnityLoader.instantiate('gameContainer', jsonUrl, { onProgress: progressCb }); },
  };
  var first = cfg.instantiate === 'object' ? 'object' : 'url';
  var other = first === 'object' ? 'url' : 'object';
  try {
    call[first]();
  } catch (e) {
    /* The mismatch is always a synchronous TypeError (the loader calls .lastIndexOf or
     * .split on an argument of the wrong shape), and a port whose page delegates to a
     * custom loader gives the build-time detector nothing to read. So recover once with
     * the other form rather than leaving the player at a black screen. */
    S.post('warn', 'unity ' + first + ' form rejected (' + (e && e.message || e) + ') — retrying as ' + other);
    try { call[other](); }
    catch (e2) { S.fail('instantiate: ' + (e2 && e2.message || e2)); }
  }
  // Belt-and-suspenders: hide the boot overlay once a GL canvas exists.
  var tries = 0, iv = setInterval(function () {
    var c = container.querySelector('canvas');
    if (c && c.width > 1) { S.done(); clearInterval(iv); }
    if (++tries > 120) clearInterval(iv);
  }, 250);
};
