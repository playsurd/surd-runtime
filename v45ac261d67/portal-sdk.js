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
      gameLoadingProgress: function () {},
      gameplayStart: function () {}, gameplayStop: function () {},
      commercialBreak: resolved, rewardedBreak: function () { return Promise.resolve(false); },
      happyTime: function () {}, customEvent: function () {}, captureError: function () {},
      isAdBlocked: function () { return false; }, shareableURL: function () { return Promise.resolve(location.href); },
      getURLParam: function (k) { try { return new URL(location.href).searchParams.get(k) || ''; } catch (e) { return ''; } },
    };
  }
  if (!W.YaGames) {
    var yPlayer = {
      getName: function () { return 'player'; }, getUniqueID: function () { return 'local'; },
      getData: function () { return Promise.resolve({}); }, setData: resolved,
      getStats: function () { return Promise.resolve({}); }, setStats: resolved, incrementStats: resolved,
      getMode: function () { return 'lite'; }, getPhoto: function () { return ''; },
    };
    var yLeaderboards = {
      setLeaderboardScore: resolved,
      getLeaderboardEntries: function () { return Promise.resolve({ entries: [] }); },
      getLeaderboardPlayerEntry: function () { return Promise.reject(new Error('no entry')); },
      getLeaderboardDescription: function () { return Promise.resolve({}); },
    };
    var ySdk = {
      adv: {
        showFullscreenAdv: function (o) { var c = o && o.callbacks; if (c && c.onClose) setTimeout(function () { c.onClose(false); }, 0); },
        showRewardedVideo: function (o) { var c = o && o.callbacks; if (c && c.onClose) setTimeout(function () { c.onClose(); }, 0); },
        getBannerAdvStatus: function () { return Promise.resolve({ stickyAdvIsShowing: false }); },
      },
      getPlayer: function () { return Promise.resolve(yPlayer); },
      getPayments: function () { return Promise.resolve({
        getCatalog: function () { return Promise.resolve([]); },
        getPurchases: function () { return Promise.resolve([]); },
        purchase: function () { return Promise.reject(new Error('payments unavailable')); },
        consumePurchase: resolved,
      }); },
      getFlags: function () { return Promise.resolve({}); },
      getStorage: function () { return Promise.resolve(window.localStorage); },
      clipboard: { writeText: resolved },
      shortcut: { canShowPrompt: function () { return Promise.resolve({ canShow: false }); }, showPrompt: function () { return Promise.resolve({ outcome: 'rejected' }); } },
      feedback: { canReview: function () { return Promise.resolve({ value: false }); }, requestReview: function () { return Promise.resolve({ feedbackSent: false }); } },
      getLeaderboards: function () { return Promise.resolve(yLeaderboards); },
      features: { LoadingAPI: { ready: function () {} } },
      screen: { fullscreen: { request: resolved, exit: resolved } },
      isAvailableMethod: function () { return Promise.resolve(false); },
      environment: { i18n: { lang: 'en' }, app: { id: 'local' } },
      deviceInfo: { isDesktop: function () { return true; }, isMobile: function () { return false; },
                    isTablet: function () { return false; }, isTV: function () { return false; },
                    type: 'desktop' },
    };
    W.YaGames = { init: function () { return Promise.resolve(ySdk); } };
    W.ysdk = ySdk;
  }
  if (!W.ytgame) {
    var ytNoop = function () {};
    W.ytgame = {
      IN_PLAYABLES_ENV: false,
      game: { firstFrameReady: ytNoop, gameReady: ytNoop, loadData: function () { return Promise.resolve(''); },
              saveData: function () { return Promise.resolve(); }, isPaused: function () { return false; } },
      system: { getLanguage: function () { return 'en'; }, isAudioEnabled: function () { return true; },
                onAudioEnabledChange: ytNoop, onPause: ytNoop, onResume: ytNoop },
      health: { logError: ytNoop, logWarning: ytNoop },
      engagement: { sendScore: function () { return Promise.resolve(); } },
      ads: { requestInterstitialAd: function () { return Promise.resolve(); } },
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