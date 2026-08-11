window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.generic = function (M, S) {
  S.status('starting game');
  S.progress(0.6);
  function painted() {
    var c = document.querySelector('canvas');
    if (c && c.width > 1 && c.height > 1 && !(c.width === 300 && c.height === 150)) return true;
    if (c && c.__surdCtxType && c.clientWidth >= 64 && c.clientHeight >= 64) return true;
    if (c && c.__surdCtxType === '2d' && c.__surdCtx) {
      try {
        var d = c.__surdCtx.getImageData(0, 0, c.width, c.height).data;
        var step = 4 * 37, first = -1;
        for (var j = 0; j < d.length; j += step) {
          if (d[j + 3] === 0) continue;
          var v = d[j] + (d[j + 1] << 8) + (d[j + 2] << 16);
          if (first < 0) { first = v; continue; }
          if (v !== first) return true;
        }
      } catch (e) {  }
    }
    var b = document.body;
    if (!b) return false;
    var mine = document.getElementById('surd-boot');
    var outside = function (el) { return !(mine && mine.contains(el)); };
    var media = b.querySelectorAll('img,video,svg');
    for (var i = 0; i < media.length; i++) if (outside(media[i])) return true;
    var els = b.getElementsByTagName('*'), n = 0;
    for (var k = 0; k < els.length; k++) if (outside(els[k]) && ++n > 12) return true;
    return false;
  }
  var n = 0;
  var iv = setInterval(function () {
    if (painted()) { S.done(); S.post('info', 'game running'); clearInterval(iv); return; }
    if (++n > 60) {
      clearInterval(iv);
      if (document.querySelector('canvas')) {
        S.post('warn', 'canvas never resized past 300x150 — showing the game anyway');
        S.done();
        return;
      }
      S.fail('game did not render within 15s — assets may be missing');
    }
  }, 250);
};