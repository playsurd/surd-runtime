window.SURD_ADAPTERS = window.SURD_ADAPTERS || {};
window.SURD_ADAPTERS.eaglercraft = async function (M, S) {
  var cfg = M.config || {};
  document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
  var root = document.getElementById('game_frame');
  if (!root) {
    root = document.createElement('div');
    root.id = 'game_frame';
    root.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    document.body.appendChild(root);
  }
  var opts = (cfg.optsFromPage && window.eaglercraftXOpts) || cfg.opts || {};
  opts.container = opts.container || 'game_frame';
  opts.allowUpdateSvc = false;
  opts.checkRelaysForUpdates = false;
  opts.allowUpdateDL = false;
  window.eaglercraftXOpts = opts;
  S.status('fetching game bundle');
  var url = await S.asset('classes');
  S.progress(0.5);
  S.status('starting Eaglercraft');
  await S.loadScript(url);
  S.progress(0.9);
  var entry = cfg.entry || 'main';
  var fn = window[entry];
  if (typeof fn !== 'function') {
    try { fn = (0, eval)(entry); } catch (e) { fn = null; }
  }
  if (typeof fn !== 'function') { S.fail('bundle loaded but ' + entry + '() is missing'); return; }
  var booted = false;
  var guarded = function () { if (booted) return; booted = true; return fn.apply(this, arguments); };
  try { window[entry] = guarded; } catch (e) {}
  try {
    guarded();
    S.post('info', 'eaglercraft started');
  } catch (e) { S.fail('entry ' + entry + '(): ' + (e && e.message || e)); return; }
  var n = 0, iv = setInterval(function () {
    var c = document.querySelector('canvas');
    if (c && c.width > 1 && !(c.width === 300 && c.height === 150)) { S.done(); clearInterval(iv); return; }
    if (++n > 200) { clearInterval(iv); S.post('warn', 'eaglercraft: no canvas after 50s'); }
  }, 250);
};