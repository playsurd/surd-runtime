/* surd-runtime — Flash adapter (our own Ruffle loader).
 *
 * Ruffle itself lives once in the runtime repo (runtime/ruffle/), so every Flash game
 * shares one copy instead of each port shipping its own. Ruffle loads its wasm core
 * relative to the script that defines it, so we point its publicPath at our runtime.
 *
 * manifest.files.swf = { path, parts? }   — the movie (reassembled if it was split)
 * manifest.config    = { width?, height?, scale?, quality?, letterbox? }
 */
window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.ruffle = async function (M, S) {
  var cfg = M.config || {};
  document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';

  // Ruffle resolves its core .wasm/.js chunks against this, not against the page.
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = {
    publicPath: M.runtime + 'ruffle/',
    autoplay: 'on',
    unmuteOverlay: 'hidden',
    letterbox: cfg.letterbox || 'on',
    scale: cfg.scale || 'showAll',
    quality: cfg.quality || 'high',
    contextMenu: false,
    warnOnUnsupportedContent: false,
    // Flash content is 32-bit era: give it the whole frame and let Ruffle letterbox.
    forceScale: false,
  };

  S.status('loading Flash player');
  await S.loadScript(M.runtime + 'ruffle/ruffle.js');
  S.progress(0.4);

  var movie = await S.asset('swf');
  S.status('starting Flash game');

  /* global RufflePlayer */
  var ruffle = RufflePlayer.newest();
  if (!ruffle) { S.fail('Ruffle failed to initialise'); return; }
  var player = ruffle.createPlayer();
  player.style.cssText = 'width:100vw;height:100vh;display:block';
  document.body.appendChild(player);

  player.addEventListener('loadedmetadata', function () { S.done(); });
  player.load({ url: movie })
    .then(function () { S.done(); S.post('info', 'flash movie playing'); })
    .catch(function (e) { S.fail('ruffle load: ' + (e && e.message || e)); });

  // Ruffle renders into a shadow-root canvas; treat any canvas as "painted".
  var n = 0, iv = setInterval(function () {
    if (document.querySelector('canvas') || (player.shadowRoot && player.shadowRoot.querySelector('canvas'))) { S.done(); clearInterval(iv); }
    if (++n > 160) clearInterval(iv);
  }, 300);
};
