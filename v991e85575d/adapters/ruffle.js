window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
function vendoredRules(M) {
  var map = (M && M.ext) || {}, base = String(M.base || '').replace(/\/?$/, '/'), out = [];
  for (var k in map) {
    if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
    var to = base + map[k];
    out.push([k, to]);
    var alt = /^https:/.test(k) ? k.replace(/^https:/, 'http:') : /^http:/.test(k) ? k.replace(/^http:/, 'https:') : null;
    if (alt && !map[alt]) out.push([alt, to]);
  }
  return out;
}
window.SURD_ADAPTERS.ruffle = async function (M, S) {
  var cfg = M.config || {};
  document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = {
    publicPath: 'https://cdn.jsdelivr.net/gh/playsurd/surd-runtime@main/vendor/ruffle-495e9e3d/',
    autoplay: 'on',
    unmuteOverlay: 'hidden',
    letterbox: cfg.letterbox || 'on',
    scale: cfg.scale || 'showAll',
    quality: cfg.quality || 'high',
    contextMenu: false,
    warnOnUnsupportedContent: false,
    forceScale: false,
    forceAlign: true,
    urlRewriteRules: vendoredRules(M),
  };
  S.status('loading Flash player');
  await S.loadScript('https://cdn.jsdelivr.net/gh/playsurd/surd-runtime@main/vendor/ruffle-495e9e3d/' + 'ruffle.js');
  S.progress(0.4);
  var movie = await S.asset('swf');
  S.status('starting Flash game');
  var ruffle = RufflePlayer.newest();
  if (!ruffle) { S.fail('Ruffle failed to initialise'); return; }
  var player = ruffle.createPlayer();
  player.style.cssText = 'width:100vw;height:100vh;display:block';
  document.body.appendChild(player);
  try {
    if (player.shadowRoot) {
      var hide = document.createElement('style');
      hide.textContent = '#hardware-acceleration-modal{display:none!important}';
      player.shadowRoot.appendChild(hide);
    }
  } catch (e) {  }
  function focusPlayer() {
    [0, 400, 1500, 4000].forEach(function (ms) {
      setTimeout(function () {
        var a = document.activeElement;
        if (!a || a === document.body || a === document.documentElement) {
          try { player.focus({ preventScroll: true }); } catch (e) {}
        }
      }, ms);
    });
  }
  player.addEventListener('loadedmetadata', function () { S.done(); focusPlayer(); });
  player.load({ url: movie })
    .then(function () {
      S.done(); S.post('info', 'flash movie playing');
      focusPlayer();
    })
    .catch(function (e) { S.fail('ruffle load: ' + (e && e.message || e)); });
  var n = 0, iv = setInterval(function () {
    if (document.querySelector('canvas') || (player.shadowRoot && player.shadowRoot.querySelector('canvas'))) { S.done(); clearInterval(iv); }
    if (++n > 160) clearInterval(iv);
  }, 300);
};