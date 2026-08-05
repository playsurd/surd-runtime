(function () {
  var W = window;
  var unityTarget = null;
  function tellUnity(methods, arg) {
    var inst = W.__surdUnity || W.unityInstance || W.gameInstance;
    if (!inst || !inst.SendMessage || !unityTarget) return;
    for (var i = 0; i < methods.length; i++) {
      try { arg === undefined ? inst.SendMessage(unityTarget, methods[i]) : inst.SendMessage(unityTarget, methods[i], arg); }
      catch (e) {  }
    }
  }
  if (typeof W.initPokiBridge !== 'function') {
    W.initPokiBridge = function (name) { unityTarget = name || unityTarget; };
  }
  if (typeof W.commercialBreak !== 'function') {
    W.commercialBreak = function () { setTimeout(function () { tellUnity(['CommercialBreakComplete', 'commercialBreakComplete']); }, 0); };
  }
  if (typeof W.rewardedBreak !== 'function') {
    W.rewardedBreak = function () { setTimeout(function () { tellUnity(['RewardedBreakComplete', 'rewardedBreakComplete'], 'false'); }, 0); };
  }
  var resolved = function () { return Promise.resolve(); };
  if (!W.PokiSDK) {
    W.PokiSDK = {
      init: resolved, initPokiBridge: function () {}, setDebug: function () {},
      gameLoadingStart: function () {}, gameLoadingFinished: function () {},
      gameplayStart: function () {}, gameplayStop: function () {},
      commercialBreak: resolved, rewardedBreak: function () { return Promise.resolve(false); },
      happyTime: function () {}, customEvent: function () {}, captureError: function () {},
      isAdBlocked: function () { return false; }, shareableURL: function () { return Promise.resolve(location.href); },
      getURLParam: function (k) { try { return new URL(location.href).searchParams.get(k) || ''; } catch (e) { return ''; } },
    };
  }
  if (!W.GamePix) {
    W.GamePix = { init: function () {}, ping: function () {}, gameLoadingStart: function () {}, gameLoadingFinished: function () {},
                  interstitialAd: resolved, rewardAd: function () { return Promise.resolve(false); }, happyMoment: function () {} };
  }
  if (!W.CrazyGames) {
    var noop = function () {};
    W.CrazyGames = { SDK: {
      init: resolved, game: { gameplayStart: noop, gameplayStop: noop, loadingStart: noop, loadingStop: noop, happytime: noop },
      ad: { requestAd: function (t, cb) { if (cb && cb.adFinished) cb.adFinished(); }, hasAdblock: function () { return Promise.resolve(false); } },
      user: { getUser: function () { return Promise.resolve(null); } },
      banner: { requestBanner: resolved, clearAllBanners: noop },
    } };
  }
})();