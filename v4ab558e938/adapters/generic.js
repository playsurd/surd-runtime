window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.generic = function (M, S) {
  S.status('starting game');
  S.progress(0.6);
  function painted() {
    var c = document.querySelector('canvas');
    if (c && c.width > 1 && c.height > 1) return true;
    var b = document.body;
    if (!b) return false;
    if (b.querySelector('img,video,svg')) return true;
    return b.getElementsByTagName('*').length > 12;
  }
  var n = 0;
  var iv = setInterval(function () {
    if (painted()) { S.done(); S.post('info', 'game running'); clearInterval(iv); return; }
    if (++n > 60) { S.done(); clearInterval(iv); }
  }, 250);
};