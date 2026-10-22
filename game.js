/* ============================================================================
   NUMBER POPULATION — the crore lesson, on the place-value chart.

   Built from Nova's Rocket League (TITAN RUN): the same engine, assets and
   chart, booted straight into one lesson (level 4: ten-lakhs and crore) and
   its practice Tries. No title, intro, console or flight is ever started.
   There is no recorded voice: every line is dialogue text only, paced by
   the silent VOICE below as if it were being said.

   GAME.JS — the whole game in one file.

   index.html loads only this. It reads locales.json first (every word on
   screen lives there), and only then runs boot(), which is the game itself:
   what used to be fifteen separate files, in the order they used to load,
   each under a banner with its old name so it can still be found.

   Everything inside boot() shares one scope, exactly as the separate plain
   scripts shared the page's global scope — config.js's constants are seen by
   console.js the same way they always were.

   locales.json is read with a request, which browsers only allow over http —
   open the game through a local server (e.g. VS Code's Live Server), not by
   double-clicking index.html.
   ========================================================================= */
(function () {

  /* ---- I18N ---------------------------------------------------------------
       i18n('intro.screen1')                    a string
       i18n('levels.level1.brief')              an array, where the JSON has one
       i18n('teach.again', { words: '...' })    {name} placeholders filled in
     A missing key is logged and comes back as the key itself, so a typo shows
     on screen rather than as a blank. */
  var LOCALE = {};

  window.i18n = function (key, vars) {
    var v = String(key).split('.').reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, LOCALE);
    if (v == null) {
      console.warn('[locale] missing key "' + key + '" in locales.json');
      return key;
    }
    if (typeof v === 'string' && vars) {
      v = v.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
    }
    return v;
  };

  /* the page's own static labels: anything with data-i18n */
  function fillStatic() {
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = i18n(els[i].getAttribute('data-i18n'));
    }
  }

  function fail(why) {
    console.error('[locale] could not read locales.json — ' + why);
    var lt = document.querySelector('#loader .lt');
    if (lt) lt.textContent = 'Could not load locales.json — open the game through a local server.';
  }

  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'locales.json');
  xhr.onload = function () {
    /* status 0 is a file:// read that the browser allowed */
    if (xhr.status !== 200 && !(xhr.status === 0 && xhr.responseText)) {
      return fail('HTTP ' + xhr.status);
    }
    try { LOCALE = JSON.parse(xhr.responseText); }
    catch (e) { return fail('it is not valid JSON (' + e.message + ')'); }
    fillStatic();
    boot();
  };
  xhr.onerror = function () { fail('the browser blocked the request'); };
  xhr.send();

})();

/* THE GAME. Runs once, after locales.json has arrived. */
function boot() {

/* ########################################################################## */
/*  PAUSE.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   PAUSE.JS — the game stops when the player leaves it, and carries on from
   the same moment when they come back.

   AWAY means the tab is hidden (another tab, the window minimised, the phone
   locked) or the window has lost focus to another application.

   ONE FREEZE, UNDER EVERYTHING. Rather than teach every screen to pause, this
   stops time underneath all of them, and it is installed before any of them
   runs:
     performance.now()       stands still while away, and afterwards reads as
                             if the time away never happened. The clock, the
                             typewriters, the camera moves and the flight all
                             read it, so each picks up exactly where it was.
     requestAnimationFrame   callbacks are held while away and handed back on
                             return, with the same frozen time.
     setTimeout              a timer keeps the time it had left, and gets it.
     CSS animations          the running ones are paused, and played again.
     <video>                 Nova's clip, paused and played again.
     sound                   SFX's audio context is suspended and resumed, so
                             the hum and anything still ringing stop mid-note.

   Nothing is drawn while away: the tab is hidden, so there is nobody to see
   a PAUSED screen, and on return the game simply carries on.
   ========================================================================= */
/* IMAGE WAITS CAN NEVER HOLD THE GAME. A screen that decodes its pictures
   before it shows moves on when they are ready, when one fails, or after
   IMG_WAIT_MS at the latest — a picture stuck on a dead connection paints
   late instead of freezing the screen in front of it. */
var IMG_WAIT_MS = 8000;
function imgReady(i, fn, ms) {
  var fired = false, wd;
  var go = function () { if (fired) return; fired = true; clearTimeout(wd); fn(); };
  wd = setTimeout(go, ms || IMG_WAIT_MS);
  if (i.decode) i.decode().then(go, go);
  else { i.onload = go; i.onerror = go; }
  return go;
}

var PAUSE = (function () {
  var realNow = performance.now.bind(performance);
  var realRAF = window.requestAnimationFrame.bind(window);
  var realCAF = window.cancelAnimationFrame.bind(window);
  var realST = window.setTimeout.bind(window);
  var realCT = window.clearTimeout.bind(window);

  var paused = false, since = 0, lost = 0;       // lost: every ms spent away
  function vnow() { return (paused ? since : realNow()) - lost; }
  performance.now = vnow;

  /* ---- animation frames ------------------------------------------------ */
  var nextF = 1, frames = {};                    // id -> { cb, real }
  function armFrame(id, f) {
    f.real = realRAF(function () { delete frames[id]; f.cb(vnow()); });
  }
  window.requestAnimationFrame = function (cb) {
    var id = nextF++, f = { cb: cb, real: null };
    frames[id] = f;
    if (!paused) armFrame(id, f);
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    var f = frames[id];
    if (!f) return;
    if (f.real !== null) realCAF(f.real);
    delete frames[id];
  };

  /* ---- timers ------------------------------------------------------------ */
  var nextT = 1, timers = {};                    // id -> { fn, args, due, real }
  function armTimer(id, t) {
    t.real = realST(function () {
      delete timers[id];
      if (typeof t.fn === 'function') t.fn.apply(window, t.args);
    }, Math.max(0, t.due - vnow()));
  }
  window.setTimeout = function (fn, ms) {
    var id = nextT++;
    var t = { fn: fn, args: Array.prototype.slice.call(arguments, 2),
              due: vnow() + (+ms || 0), real: null };
    timers[id] = t;
    if (!paused) armTimer(id, t);
    return id;
  };
  window.clearTimeout = function (id) {
    var t = timers[id];
    if (!t) return;
    if (t.real !== null) realCT(t.real);
    delete timers[id];
  };

  /* ---- stop and go ------------------------------------------------------ */
  var anims = [], videos = [];
  function pause() {
    if (paused) return;
    since = realNow();
    paused = true;
    Object.keys(frames).forEach(function (id) {
      var f = frames[id];
      if (f.real !== null) { realCAF(f.real); f.real = null; }
    });
    Object.keys(timers).forEach(function (id) {
      var t = timers[id];
      if (t.real !== null) { realCT(t.real); t.real = null; }
    });
    anims = document.getAnimations ? document.getAnimations().filter(function (a) {
      var t = a.effect && a.effect.target;
      /* the rotate card's own hint keeps moving: it is what is on screen */
      if (t && t.closest && t.closest('#rotate, #pausecard, #pausebtn')) return false;
      return a.playState === 'running';
    }) : [];
    anims.forEach(function (a) { a.pause(); });
    videos = Array.prototype.filter.call(document.querySelectorAll('video'), function (v) {
      return !v.paused && !v.ended;
    });
    videos.forEach(function (v) { v.pause(); });
    if (typeof SFX !== 'undefined') SFX.suspend();
    if (window.VOICE) VOICE.hold();
  }
  function resume() {
    if (!paused) return;
    lost += realNow() - since;
    paused = false;
    Object.keys(frames).forEach(function (id) {
      var f = frames[id];
      if (f.real === null) armFrame(id, f);
    });
    Object.keys(timers).forEach(function (id) {
      var t = timers[id];
      if (t.real === null) armTimer(id, t);
    });
    anims.forEach(function (a) { try { a.play(); } catch (e) {} });
    videos.forEach(function (v) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
    anims = []; videos = [];
    if (typeof SFX !== 'undefined') SFX.resume();
    if (window.VOICE) VOICE.unhold();
  }

  /* ---- when -------------------------------------------------------------- */
  /* QA Bugs 5 and 6 (13 Oct 2026): switching to ANOTHER APPLICATION is away
     too. The tab stays visible then, so visibilitychange never fired and the
     voice carried on over whatever the player had switched to. The window
     losing focus now pauses as well, and getting it back resumes. Only an
     actual blur counts: a game embedded in a page that never focused it is
     not paused for that. */
  var blurred = false;
  /* held upright (QA Bug 27): the rotate card is up and the game waits */
  var upright = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
  /* the pause button (13 Oct 2026): held until the player presses play */
  var held = false;
  function sync() {
    if (document.hidden || blurred || held || (upright && upright.matches)) pause();
    else resume();
  }
  if (upright) {
    if (upright.addEventListener) upright.addEventListener('change', function () { sync(); });
    else if (upright.addListener) upright.addListener(function () { sync(); });
  }
  /* 20 Oct 2026: a blur BEFORE THE PLAYER HAS TOUCHED THE PAGE does not
     count — an in-app browser opening the game can report the window as
     unfocused, which froze the loader and the title for good */
  var engaged = false;
  window.addEventListener('pointerdown', function () { engaged = true; }, true);
  window.addEventListener('keydown', function () { engaged = true; }, true);
  window.addEventListener('blur', function () { if (!engaged) return; blurred = true; sync(); });
  window.addEventListener('focus', function () { blurred = false; sync(); });
  /* any press on the page means it has the player again, even if a focus
     event was missed on the way back */
  window.addEventListener('pointerdown', function () {
    if (blurred) { blurred = false; sync(); }
  }, true);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && document.hasFocus && document.hasFocus()) blurred = false;
    sync();
  });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', sync);
  if (document.hidden || (upright && upright.matches)) pause();

  return {
    paused: function () { return paused; },
    /* the player's own pause: on until hold(false) */
    hold: function (on) { held = !!on; sync(); },
    held: function () { return held; },
    /* for driving it from a test */
    pause: pause,
    resume: resume
  };
})();
window.PAUSE = PAUSE;

/* ########################################################################## */
/*  PAUSEBUTTON                                                             */
/* ########################################################################## */
/* THE PAUSE BUTTON (13 Oct 2026, Anmol). Top-left corner, on every screen of
   play — intro, lessons, levels, flights — and not on the loader, the title
   or the celebration. Pressing it freezes the whole game through PAUSE.JS
   (voice, sound, timers, animations, video) and puts up a card with one big
   play button; that, or Esc / P / Space, carries on exactly where it was. */
(function () {
  var stage = document.getElementById('stage');
  if (!stage) return;
  var btn = document.createElement('button');
  btn.id = 'pausebtn'; btn.type = 'button';
  btn.setAttribute('aria-label', i18n('ui.pause'));
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';
  stage.appendChild(btn);

  var card = document.createElement('div');
  card.id = 'pausecard'; card.hidden = true;
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', i18n('ui.paused'));
  card.innerHTML =
    '<div class="pc-box"><p class="pc-title"></p>' +
    '<button type="button" class="pc-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><span></span></button></div>';
  card.querySelector('.pc-title').textContent = i18n('ui.paused');
  card.querySelector('.pc-play span').textContent = i18n('ui.resume');
  stage.appendChild(card);

  function set(on) {
    PAUSE.hold(on);
    card.hidden = !on;
    document.body.classList.toggle('held', on);
    if (on) card.querySelector('.pc-play').focus();
    else btn.blur();
  }
  /* neither press reaches the game underneath */
  [btn, card].forEach(function (el) {
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  });
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(true); });
  card.addEventListener('click', function (e) { e.stopPropagation(); set(false); });
  /* while held, the keyboard only resumes — Space and Enter would otherwise
     move the intro on underneath the card */
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (PAUSE.held()) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (k === 'Escape' || k === 'p' || k === 'P' || k === ' ' || k === 'Enter') set(false);
      return;
    }
    if ((k === 'Escape' || k === 'p' || k === 'P') && !document.body.classList.contains('pre-game') &&
        !document.body.classList.contains('in-start') && !document.body.classList.contains('in-post')) {
      e.preventDefault(); set(true);
    }
  }, true);
  window.PAUSE_BUTTON = { set: set };
})();


/* ########################################################################## */
/*  TRACK.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   TRACK.JS — play events, for knowing how the game is used. QA Bug 29
   (13 Oct 2026): the game sent nothing at all.

   ONE CALL, TRACK(name, data), and every event goes out four ways, so it can
   be wired to whatever the platform uses without touching the game again:
     window.dataLayer          pushed as { event: 'nrr_<name>', ... } — Google
                               Tag Manager / GA4 pick this up as it is
     window 'nrr:track'        a CustomEvent, for a host page's own listener
     parent.postMessage        { source: 'novas-rocket-run', event, data } when
                               the game runs inside an iframe (SwiftChat etc.)
     a beacon (optional)       POSTed as JSON to the URL in ?track=<url> or
                               window.NRR_TRACK_URL — nothing is sent anywhere
                               unless one of those is set

   Every event carries the session id, the time since the page opened and
   the game's version, so a session can be read in order.

     game_load       the page has opened
     game_start      START pressed
     intro_skip      SKIP pressed during the intro
     intro_complete  the intro reached the lesson
     lesson_start    { level }               a teaching screen began
     level_start     { level }
     lesson_answer   { level, attempt, correct, given, target }  a lesson Try
     answer          { level, run, correct, attempt, given, target }
     level_complete  { level, wrong }
     game_complete   { wrong }
     game_exit       { screen }              the page was closed or hidden away
   ========================================================================= */
var TRACK = (function () {
  var VERSION = '2026-10-13';
  var sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  var t0 = Date.now(), url = null, where = 'load';
  try {
    url = new URLSearchParams(location.search).get('track') || window.NRR_TRACK_URL || null;
  } catch (e) {}
  window.dataLayer = window.dataLayer || [];
  function send(name, data) {
    var ev = { event: 'nrr_' + name, game: 'novas-rocket-run', version: VERSION,
               session: sid, ms: Date.now() - t0 };
    if (data) Object.keys(data).forEach(function (k) { ev[k] = data[k]; });
    try { window.dataLayer.push(ev); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('nrr:track', { detail: ev })); } catch (e) {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'novas-rocket-run', event: name, data: ev }, '*'); } catch (e) {}
    if (url) {
      try {
        var body = JSON.stringify(ev);
        if (!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })))) {
          fetch(url, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () {});
        }
      } catch (e) {}
    }
  }
  var exited = false;
  window.addEventListener('pagehide', function () {
    if (exited) return; exited = true; send('game_exit', { screen: where });
  });
  send('game_load');
  return {
    send: send,
    /* where the player is, for game_exit */
    at: function (w) { where = w; }
  };
})();
window.TRACK = TRACK;


/* ########################################################################## */
/*  CONFIG.JS                                                               */
/* ########################################################################## */

/* ============================================================================
   CONFIG.JS — TITAN RUN, the opening map sequence.

   Every number here is a percentage of an image or of the stage. Nothing is a
   pixel. All four artworks are 1672 x 941, which is 16:9, so at scale 1 each
   one fills the stage exactly and image % and stage % are the same thing.

   THE TWO ANCHOR POINTS ARE THE WHOLE TRICK.
   `mapPoint` is where a settlement sits on the wide map. `closeupPoint` is
   where the SAME settlement sits in its own close-up. The dive drives the map
   so that its mapPoint arrives at the screen position the close-up is holding
   closeupPoint at, and holds it there. From the moment the pan finishes — well
   before the cross-fade opens — the settlement is at identical screen
   coordinates in both layers.

   `ratio` is the third measured number, and the one that makes the two sizes
   agree: how much larger the settlement is in the close-up than on the map.
   It is not guessed. Each location records how it was measured.

   `focus` is the fourth, and it is about FRAMING rather than about the swap:
   the centre of the settlement in its own close-up, which FRAME then puts in
   the same place on the stage every time.
   ========================================================================= */

const ART = 'assets/Story Assets/';

const MAP_SRC = ART + 'Map.webp';

/* ---------------------------------------------------------------------------
   THE INDIAN GROUPING the whole game reads figures in: the last three digits,
   then every two. 9999 -> 9,999   99999 -> 99,999   999999 -> 9,99,999.
   ------------------------------------------------------------------------ */
function commas(n) {
  var s = String(Math.abs(n));
  if (s.length <= 3) return s;
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
}



/* ---------------------------------------------------------------------------
   THE FRAMING

   The settlement's centre lands here, on every location, at whatever scale it
   takes. `x` sits well right of Veth; `guard` is the band he occupies, which
   nothing may enter. The close-up is scaled up and cropped as far as it has to
   be for its own edges to stay off the stage at this position — see
   solveFrame() — rather than letting the settlement drift back toward him.

   That framing decides where everything else can go, and both of the other
   two overlays are placed against it rather than by eye:

     the speech bubble  up at the speaker's head, in the left column, which is
                        open on all three close-ups because the settlement is
                        held right of `guard`.
     the name card      low and left, below every settlement's lowest point
                        and right of Veth. One place, all three locations.

   Both are laid out in style.css. introRest() in intro.js reports each
   settlement's real on-stage rectangle so the two can be checked against it.
   ------------------------------------------------------------------------ */
const FRAME = {
  x: 62,                 // % of stage width
  y: 48,                 // % of stage height
  guard: 26,             // Veth's band, % of stage width

  /* The map is never allowed below the scale that covers the stage for its
     current pan offset, and it runs this much above it so the clamp is never
     working exactly on the edge. Without it the map's own corner walks into
     frame early in the dive and the stage shows through behind it. */
  cover: 1.04
};


/* ---------------------------------------------------------------------------
   THE THREE SETTLEMENTS
   ------------------------------------------------------------------------ */
const LOCATIONS = [

  {
    id: 'rockpost',
    name: i18n('locations.rockpost.name'),
    /* The card reads Station / Population / Distance, as the storyboard
       has it. The figures live in locales.json beside the name. */
    get dist() { return i18n('locations.distance', { km: i18n('locations.' + this.id + '.distance') }); },
    get pop()  { return i18n('locations.population', { n: i18n('locations.' + this.id + '.population') }); },

    /* MEASURED, not estimated. Rock Post carries two masts with electric-cyan
       lamps, and they are the only saturated cyan anywhere near it in either
       render — so they are the same two physical objects, findable to the
       pixel in both images.
         Map       lamps at (374.1, 583.2) and (394.1, 595.0) px
                   -> separation  23.2px, midpoint (384.1, 589.1)
         Close-up  lamps at (589.4, 311.0) and (691.6, 392.4) px
                   -> separation 130.7px, midpoint (640.5, 351.7)
       The anchor is the midpoint of the pair; the ratio is the ratio of the
       separations — a length between two identified points, so it does not
       care how much of the outpost each render happens to include. */
    mapPoint:     [22.97, 62.60],
    closeupSrc:   ART + 'Location 1.webp',
    closeupPoint: [38.31, 37.37],
    ratio:        5.63,

    /* The centre of the outpost: the area centroid of the footprint below. */
    focus: [32.70, 50.21],

    /* THE FOOTPRINT, traced off the artwork against a percentage grid: the
       whole outpost — landing pad, both crate stacks, both modules, both
       masts. Nothing is drawn from it. It is the record of where the
       settlement actually IS, which is what lets the name card and the speech
       bubble be checked against it rather than eyeballed. */
    footprint: [
      [18.2, 56.5], [19.6, 52.8], [25.4, 46.0], [34.6, 30.6], [36.4, 30.8],
      [42.2, 40.4], [43.6, 58.6], [41.0, 62.8], [31.0, 62.4], [25.0, 62.0],
      [18.6, 61.2]
    ]
  },

  {
    id: 'lakestation',
    name: i18n('locations.lakestation.name'),
    /* The card reads Station / Population / Distance, as the storyboard
       has it. The figures live in locales.json beside the name. */
    get dist() { return i18n('locations.distance', { km: i18n('locations.' + this.id + '.distance') }); },
    get pop()  { return i18n('locations.population', { n: i18n('locations.' + this.id + '.population') }); },

    /* Measured from the built footprint in both renders: the pixels that are
       both bright and DESATURATED, which on Titan means metal and glass — the
       terrain is strongly saturated ochre and never passes the test.
         Map       structure centroid 48.25, 14.05   footprint  9.21% wide
         Close-up  structure centroid 42.25, 41.42   footprint 45.57% wide
       ratio = 45.57 / 9.21 */
    mapPoint:     [48.25, 14.05],
    closeupSrc:   ART + 'Location 2.webp',
    closeupPoint: [42.25, 41.42],
    ratio:        4.95,

    focus: [53.08, 37.80],

    /* The built core: sphere tanks, control tower, depot, container rows and
       all five domes. The jetty out over the water, the settling ponds along
       the shore and the derrick out in the desert are outworks and sit
       outside it. */
    footprint: [
      [32.5, 30.0], [34.0, 24.5], [40.5, 20.0], [43.0, 10.5], [46.0, 11.5],
      [60.0, 22.5], [70.5, 28.5], [73.2, 43.5], [72.4, 55.0], [68.0, 58.5],
      [52.0, 59.0], [40.0, 52.0], [35.0, 43.0]
    ],
  },

  {
    id: 'titancity',
    name: i18n('locations.titancity.name'),
    /* The card reads Station / Population / Distance, as the storyboard
       has it. The figures live in locales.json beside the name. */
    get dist() { return i18n('locations.distance', { km: i18n('locations.' + this.id + '.distance') }); },
    get pop()  { return i18n('locations.population', { n: i18n('locations.' + this.id + '.population') }); },

    /* Same method as Lake Station.
         Map       structure centroid 80.85, 66.85   footprint 14.29% wide
         Close-up  structure centroid 55.00, 38.66   footprint 60.02% wide
       ratio = 60.02 / 14.29 */
    mapPoint:     [80.85, 66.85],
    closeupSrc:   ART + 'location 3.webp',
    closeupPoint: [55.00, 38.66],
    ratio:        4.20,

    focus: [57.94, 38.38],

    /* The dome and the ring of building terraced round its base. The
       spaceport out on the left, the refinery stacks on the right and the
       outlying landing pads sit outside it. */
    footprint: [
      [34.5, 38.0], [36.5, 27.5], [44.0, 13.5], [58.0, 8.5], [62.0, 9.0],
      [77.0, 20.5], [80.8, 31.0], [81.0, 45.0], [75.5, 58.5], [67.5, 66.5],
      [52.0, 66.5], [40.5, 57.5], [34.8, 49.0]
    ],
  }

];


/* ---------------------------------------------------------------------------
   THE DIVE — 1400ms, one continuous move
   ------------------------------------------------------------------------ */
const DIVE = {
  ms: 1400,

  /* Accelerating: it should feel like falling toward the surface rather than
     gliding onto it, so both control points sit below the diagonal.

     WEIGHTED LATER since the close-up came to rest at scale 1. The dive used
     to magnify by ratio x zoom — on Rock Post 5.63 x 1.90, near eleven times.
     It now magnifies by ratio alone, a little over five, in the same 1400ms,
     and the old curve left the middle of the move reading as a drift. Holding
     more of it back keeps the momentum going into the swap, which is the part
     that has to be quick to stay invisible. The length is unchanged: the fade
     needs the time it has. */
  ease: [0.68, 0, 0.90, 0.28],

  /* THE CLOSE-UP IS NOT GIVEN A SCALE OF ITS OWN. It is locked to the map:
     a(t) = s(t) / ratio, every frame. That is stronger than matching the two
     at the hand-off, and it is what the brief was reaching for with "both
     layers growing on screen at the same rate throughout" — here they are the
     same motion, not two motions tuned to agree once.

     The consequence is worth stating, because it is a real change from the
     brief: the close-up does NOT run 1.30 down to 1.00. Running it down while
     the map runs up means the two layers move in OPPOSITE directions across
     the swap, and opposed motion is exactly what the eye reads as a cut. It
     runs up with the map to `over` and settles afterwards.

     `lock` is the fraction of the dive at which the close-up reaches its
     framing scale — the solved `zoom` — and the map therefore reaches
     ratio x zoom. It is the same instant the fade opens, which is not a
     coincidence: before it the close-up is under its framing scale and could
     not cover the stage, so it must be invisible, and after it the two are
     locked, so the fade has nothing left to give away. Move the fade and this
     moves with it. */
  /* QA Bug 8 (13 Oct 2026): the close-up used to carry 10% past its framing
     and then shrink back onto it — a second movement after the zoom had
     finished, which read as a jerk. It now carries 6% past and STAYS there:
     the close-up's resting scale is its framing x over, so the move eases to
     a stop and never reverses. */
  over: 1.06,            // how far past its own framing the close-up carries
  landMs: 420,           // and how long it then takes to settle back onto it
  landEase: [0.16, 1, 0.3, 1],

  /* Where the map's pan finishes, as a fraction of the dive. It lands BEFORE
     the fade opens, so that through the whole cross-fade the settlement is at
     one screen position in both layers and nothing is sliding. */
  panEnd: 0.55,
  panEase: [0.4, 0, 0.2, 1],

  /* The cross-fade. LINEAR on purpose: an eased opacity curve spends its first
     and last frames barely changing, and those two plateaus are exactly what
     the eye reads as a cut. */
  fade: { from: 0.58, to: 0.78 },

  /* The blur is what hides the change in detail density between a wide map and
     a close render. It opens BEFORE the fade and closes AFTER it — deliberately
     not symmetrical with the opacity, so there is no frame where the picture is
     both sharp and half-swapped. */
  blur: { from: 0.46, to: 0.90, px: 7 },

  /* Atmosphere rushing past. */
  bloom: 0.08
};


/* ---------------------------------------------------------------------------
   THE PULL-OUT — 900ms, blur-through
   ------------------------------------------------------------------------ */
const PULL = {
  ms: 900,
  ease: [0.35, 0, 0.2, 1],
  cardFade: 200,         // the name card goes first, on its own
  closeTo: 1.14,         // the close-up scales up as it smears away
  closeBlur: 16,
  closeBloom: 0.12,
  mapBlur: 16            // the map comes back blurred and clears as it settles
};


/* ---------------------------------------------------------------------------
   TIMING
   ------------------------------------------------------------------------ */
const TIME = {
  charMs: 16,            // typewriter, speech and tag card alike
  tagRowGap: 180,
  tagIn: 280,
  charIn: 2000,          // a character sliding in
  /* A character RISING from below the frame. It has to match .actor's own
     transform transition in style.css, because that is what actually carries
     the move — this is only how long the code waits for it to land. */
  charRise: 520,
  turn: 480,          // a cut-out flipping round; matches the .fig scale transition
  charFade: 400,
  slideGap: 220,
  lineHold: 450,         // after a spoken line ends, before the next begins
  /* THE GAP BETWEEN SCREENS. Once everything on a screen is finished — its
     last line said out loud, its last move made — it holds this long before
     the next screen comes, so nothing arrives on top of the end of the last
     thing. Counted from when the voice stops, in real time: reduced motion
     does not shorten it, and taps during it do not cut it short (SKIP does). */
  screenGap: 800,
  reducedScale: 0.5,
  /* Reduced motion swaps the whole dive for a plain cross-fade this long, with
     no zoom and no blur. Every slide and every line survives. */
  reducedFade: 300
};


/* ---------------------------------------------------------------------------
   THE CAST
   Both cut-outs are transparent PNGs with a lot of empty margin, so each names
   the box its FIGURE actually occupies as a % of the file. The art is laid in
   as a background sized and positioned so that box exactly fills its element,
   which is what lets a character stand on the floor of the stage rather than
   on the bottom edge of a mostly empty file.
   SWAPPING THEM IS ONE LINE: exchange the two `src` values.
   ------------------------------------------------------------------------ */
const CAST = {
  veth: {                                   // tall, navy coat, fleece collar
    /* HE TALKS IN FRAMES: a 6x6 sheet of him speaking and gesturing to his
       left (towards Nova), 436x864 a frame — a web copy of the artist's
       sprite-max-px-frames-36-rows-6-cols-6.webp, 1.9 MB rather than 14.
       `box` is the union of every frame's opaque bounds, as a % of ONE frame,
       so he does not shift as the frames change; `aspect` is that box's own
       width over height in pixels. While his voice plays the sheet runs
       forward and back between `from` and `to` (frame 0, a wink, and the
       wrap from 35 to 0 are the only rough joins in it, so it never crosses
       them); between lines he holds a closed-mouth frame, `rest` (the whole
       of the sheet's second row). SPRITE.JS plays it. */
    src: ART + 'veth talking.webp',
    box: { x: 8.72, y: 0.23, w: 90.36, h: 99.08 },
    aspect: 0.460,                          // 394/856 px of a frame, measured
    sprite: { cols: 6, rows: 6, fps: 12, from: 1, to: 35, rest: [6, 7, 8, 9, 10] },
    /* Screen 5 is the only screen he stands on, and he takes its left. At h 78
       he is 78 * (9/16) * 0.607 = 26.6% of the stage wide, so at 20 he spans 7
       to 33 — clear of the edge and well clear of Rill, who starts at 67. */
    h: 78, x: 20
  },
  nova: {                                   // small, navy and white flight suit
    /* The new cut-out, measured the same way: the opaque bounds of the figure
       as a percentage of its own file. It is a 1024x1536 portrait rather than
       the old 1980x1080 frame, so the box is quite different — carrying the old
       numbers over would have cropped her head off. */
    src: ART + 'Nova.webp',
    box: { x: 26.66, y: 1.24, w: 48.34, h: 98.76 },
    aspect: 0.326,                          // 495 / 1517 px
    /* SHE IS SHORTER THAN VETH, and visibly: he is 78% of the stage's height
       and she is 58%, which is three quarters of him. She is the junior in
       this scene and the silhouette should say so before either of them
       speaks. h is the figure's own height on the stage — the box crop maps
       the figure to fill the element — so these two numbers are the only
       thing setting their relative size. */
    h: 58, x: 84
  },

  /* RILL, who now walks on at slide 6 to hand over to the console. Same
     cut-out the level's brief uses; the aspect is her own opaque width over
     her own opaque height in pixels — 586/1058 — measured rather than
     assumed, because deriving it from the box would take the file for 16:9
     and stretch her. She stands between Veth and the middle so the left-hand
     bubble has somebody under it whichever of them is speaking. */
  rill: {
    /* HER STANDING CUT-OUT, which is the one that belongs beside the other
       two: a whole figure, framed the way Veth and Nova are framed. `h` is
       the height of the figure on the stage, so two cut-outs only read as the
       same size of person if they crop the same amount of person — her
       three-quarter pose at the same `h` gave her a head twice Veth's.

       `x` is her CENTRE, because .actor carries translate(-50%, 0). At h 70
       she is 70 * (9/16) * 0.382 = 15.0% of the stage wide, so at 74 she spans
       67 to 82 — the right of screen 5, against Veth on its left, with half
       the stage of open map between them. Her other pose is a per-screen
       `look` in SLIDE_ART. */
    /* HE TALKS IN FRAMES, like Veth: a 6x6 sheet of him speaking and
       gesturing to his left — towards the machine on screen 6 — 504x844 a
       frame, a web copy of the artist's sheet (1.7 MB rather than 12). Every
       join in it is smooth, so the talking runs across all 36; between lines
       he holds a closed-mouth frame, starting on 13 (arms down). The same
       frames play, cropped to his head, in the dialogue box's portrait (see
       FACES in DIALOG.JS). */
    src: ART + 'rill talking.webp',
    box: { x: 16.67, y: 0.24, w: 82.94, h: 98.34 },
    aspect: 0.504,                          // 418/830 px of a frame, measured
    sprite: { cols: 6, rows: 6, fps: 12, from: 0, to: 35,
              rest: [13, 14, 6, 7, 8, 12, 18, 19, 24, 25, 26, 27, 30] },
    h: 70, x: 74
  }
};

/* Every image the sequence touches. All of them are decoded before the first
   frame: a dive that hits an undecoded image stutters, and a stutter at the
   hand-off is exactly what exposes the swap.

   The cast is read off CAST rather than listed, so a character added there is
   decoded here without a second edit — Rill was walking on at screen 6
   undecoded because this list still named only two of the three. The three
   stills live in script.js and are added to this list by intro.js, which is
   the one place that has both. */
const PRELOAD = [MAP_SRC]
  .concat(Object.keys(CAST).map(function (id) { return CAST[id].src; }))
  .concat(LOCATIONS.map(function (l) { return l.closeupSrc; }));


/* ============================================================================
   THE CONSOLE — Level 1

   EVERY NUMBER HERE WAS MEASURED OFF THE NEW RENDERS, not carried over. The
   old console was photographed at an angle and needed a corner-quad homography
   to put anything on it; this one is straight-on, so every overlay is a plain
   axis-aligned rectangle and that whole layer is gone.

   Both renders are 1672 x 941 — 16:9, like the stage — so a percentage of the
   image is a percentage of the stage. Measured pixel values are in the comment
   beside each figure.
   ========================================================================= */

const ART_G = 'assets/Game assets/';

/* ---------------------------------------------------------------------------
   THE THREE FACEPLATES.

   There is one console render per level, and they are not the same faceplate
   with plates coming off: level 1 carries four dial bays, level 2 five and
   level 3 six, and level 1's grid sits about 1% right of the other two.

   MEASURED, on all three, by walking the dark runs across the aperture row.
   Everything else on the console — the comms glass, the manifest, the loaded
   slot, the window height, the label row and the arrow row — came back
   identical on all three to within a few pixels, so only this differs and the
   rest stays in WIDE where it belongs.

     L1  4 bays   39.35  49.73  60.17  70.63          pitch 10.38
     L2  5 bays   28.20  38.40  48.65  59.27  70.28   pitch 10.12
     L3  6 bays   18.18  28.29  38.43  48.65  59.27  70.28

   Levels 2 and 3 share a grid — 2 is exactly 3's rightmost five, to within a
   tenth of a percent — so the transition from 2 to 3 really is one plate
   coming off with nothing else moving. From 1 to 2 the dials shift left by
   15-18px, which the transition has to carry rather than pretend away.
   ------------------------------------------------------------------------ */
/* EACH FACEPLATE IS TWO LAYERS NOW: the bay floor (`bg`) filling the stage,
   and the machine (`src`) cut out and laid over it. `fit` is where the
   machine's own file sits, as a % of the stage, so its dials land exactly
   where the old one-piece renders had them — every overlay below was
   measured on those, and none of it moves.

   console 2 and 3 are 1672 x 941 like the old renders and line up with them
   as they are. console 1 is 1586 x 992 and framed differently: matched
   against the old level 1 render it is the same scale, 69px right and 15px
   up — 69/1672, -15/941, 1586/1672, 992/941. */
const FACE_BG = ART_G + 'background.webp';

/* HOW FAR THE MACHINE SITS DOWN THE STAGE, in stage %. At 17.5 the lower
   blue band (bottom edge measured at 82.5% on all three) lands on the
   stage's bottom edge and the vents and feet go out of frame. Everything
   drawn on the machine moves with it; nothing below is re-measured. */
const FACE_DROP = 17.5;
/* THE NEW MACHINES — no arrow buttons: the child SCROLLS each digit, drag
   up or down or turn the mouse wheel. The windows are taller now the arrows
   are gone, so each faceplate carries its own aperture (winY/winH/winW).
   Fitted by matching the new renders' windows onto where the old ones were,
   so the glass, the lamps and LOAD stay where they were measured. */
const FACEPLATES = {
  1: { bg: FACE_BG, src: ART_G + 'Console 4 dials cutout.webp',
       fit: { x: 4.207, y: -1.952, w: 94.732, h: 112.275 },
       bays: [39.24, 49.66, 60.15, 70.66],
       winY: 51.86, winH: 19.58, winW: 6.00 },
  2: { bg: FACE_BG, src: ART_G + 'Industrial Sci-Fi Console Panel.webp',
       fit: { x: 0.088, y: 0.109, w: 99.941, h: 99.995 },
       bays: [28.15, 38.37, 48.62, 59.26, 70.29],
       winY: 52.07, winH: 20.28, winW: 6.15 },
  3: { bg: FACE_BG, src: ART_G + 'Futuristic Sci-Fi Control Console.webp',
       fit: { x: 2.748, y: 2.609, w: 95.162, h: 95.213 },
       bays: [17.89, 28.13, 38.40, 48.71, 59.29, 70.11],
       winY: 52.07, winH: 17.07, winW: 6.08,
       /* QA Bug 24 (13 Oct 2026): this render is drawn 5% smaller and lower
          on the right than the other two, so the shared lamp and button
          positions in WIDE missed its badge and its button face. Measured off
          this render (the lamp housings' centres, and the button face's four
          screws against level 2's): */
       lamps: [
         { x: 78.59, y: 29.06, w: 1.66, h: 2.96 },
         { x: 80.77, y: 29.06, w: 1.66, h: 2.96 },
         { x: 82.89, y: 29.06, w: 1.66, h: 2.96 },
         { x: 84.97, y: 29.06, w: 1.66, h: 2.96 },
         { x: 87.14, y: 29.06, w: 1.66, h: 2.96 },
         { x: 89.32, y: 29.06, w: 1.66, h: 2.96 }
       ],
       lever: { x: 78.49, y: 41.41, w: 14.14, h: 28.09 },
       labelDy: 0.26 }
};

const WIDE = {
  src: ART_G + 'Machine screen.webp',


  /* THE DIGIT APERTURES — the dark interior, not the bezel.

     These were wrong. The first pass blob-measured them at four different
     widths (104 / 97 / 103 / 100) because the threshold caught the bevel
     shadow on two of them. Walking out from each centre with the threshold
     swept gives a stable answer, and they are IDENTICAL: 97px, every one.
       lum 0.18-0.22   x 612-707, 785-881, 959-1054, 1134-1231   y 490-608
     The top edge is 490, not 486: 486 is the inner bevel, and covering it with
     the window's own dark background hides 4px of the render's own chamfer.
     So there is one width and one height here, and the four x values are
     derived from the bay centres rather than written down four times. */
  winW: 5.80,                       // px 97
  winY: 52.07,                      // px 490
  winH: 12.65,                      // px 119

  /* The aperture is a chamfered octagon, not a rectangle. Measured off the
     close-up, where it is biggest: the corner cut steps the edge in by 12px
     of a 230px aperture. As a fraction of the element that is 5.2% across and
     4.1% down, and the two renders share the aperture's proportions. */
  chamfer: { x: 5.2, y: 4.1 },

  /* THE LABEL PLATES. A vertical profile through one shows the plate is not a
     single flat panel — it is a rim around a sunken face:
       y 394-422  bright   the plate's top rim
       y 424      dark     the recess groove
       y 425-467  flat     THE RECESSED FACE — where lettering is engraved
       y 468-472  dark     the bottom groove
       y 474-480  bright   the bottom rim
     The outer plate is y 393-479 (h 86), which is what was measured from the
     outside; the face inside it is y 425-467 (h 43). Text belongs in the face.
     Width agrees exactly at 118px either way. */
  labelW: 7.06,                     // px 118
  labelY: 45.16,                    // px 425  (the recessed face, not the rim)
  labelH: 4.57,                     // px 43
  plateY: 41.76, plateH: 9.14,      // px 393-479, the whole plate, for ?align=1

  /* RUNG 3's POINTER, in the band between the comms glass (bottom 38.15%)
     and the label plates (top 41.76%). Centred on whichever bay is wrong. */
  nudgeY: 38.35, nudgeW: 3.2, nudgeH: 3.1,
  loadPtrY: -3.2,         // the LOAD pointer's top, below the lever rect's top (% of the stage)

  /* The two arrow buttons, as one pair box per bay. */
  /* THE ARROW PAIR, as a size and a row rather than a table of four. The
     painted pairs sit centred on their bay to within 0.14% on every render, so
     one rect derived from the bay centre serves any number of dials — and a
     table of four could not have survived a fifth. */
  arrowW: 7.48, arrowY: 66.95, arrowH: 6.06,   // px 125 wide, y 630, 57 tall
  /* The two buttons all but touch in the render: the dark housing wells run
     597-655 and 660-718 with the cyan triangles centred at 626 and 688, so the
     gap is a pixel, not the 1.40% that was here. A gap that is too wide makes
     each hit box too narrow and leaves dead strips down the middle. */
  arrowGap: 0.10,


  /* THE GAUGE COLUMN on the left flank: the outer frame and the recessed
     channel inside it, separately, as asked. */
  /* THE GAUGE. The channel was wrong on all four numbers — too far left, too
     narrow, starting too low and far too short, which is why the fill spilled
     over the frame's inner edge and the scale never reached the ends.
     Re-profiled across and down: the dark interior runs x 123-189 and y
     125-660, and a threshold sweep holds those edges still.
     The frame's bottom had to come down with it: at 659 it ended ABOVE the
     channel it is supposed to contain. */
  /* THE GAUGE STANDS ON THE FLOOR, BESIDE THE MACHINE.
     The render no longer has a painted gauge at all — the left column of the
     console is clean plate now — so there is nothing to cover and nothing to
     align to. The gauge is a free-standing column in the open floor to the
     left of the console, drawn whole in code: frame, caps, channel, ticks,
     fill, marker, needle.

     WHERE THE MACHINE IS. Re-measured after the console was re-rendered
     narrower. Its left silhouette, traced by sharpness rather than colour —
     the depot floor is out of focus and the console is not — now sits at
     x 242-248 through the gauge's height, where it used to be at x 75-95.
     The old column at x 26-114 was on the machine; it would have been left
     standing on bare floor. The base flares left to x 139 below y 660, so the
     column stops at y 640. It lives in x 24-132: clear of the machine on the
     right by 30px at the closest row, and clear of the stage edge.
  */
  /* QA Bug 28 (13 Oct 2026): narrower and shorter, on the same centre — it
     was a big column for a readout that only moves at the launch. Was
     { x: 1.44, y: 13.81, w: 6.46, h: 54.20 } (px 24,130 108x510). */
  /* 13 Oct 2026 (Anmol): taller again, standing level with the machine —
     its top cap lines up with the top of the console and its foot with the
     its foot stops short of the machine's lower corner, which flares out
     to the left (it was touching it). Was { x: 2.39, y: 18.21, w: 4.56, h: 45.40 }. */

  /* THE THREE GLASS SURFACES Rill and the console speak through.

     MEASURED TO THE GLASS, NOT THE BEZEL. Two of the three numbers I was given
     were the outer edge of the black bezel rather than the lit panel inside
     it: comms came in at x 228-1234, y 86-364, which is 45px of bezel on the
     left and 41px on the right, and manifest at x 1326-1580 against a glass of
     1375-1566. Text laid out to those would have sat on the frame. A threshold
     walk cannot tell bezel from glass — both are near-black — so the comms
     panel was taken from luminance profiles across and down instead: the glass
     holds 0.088-0.108 while the bezel drops to 0.003-0.07.
       comms     glass x 273-1193, y 100-358
       manifest  glass x 1345-1572, y 388-600
       loaded    slot  x 1356-1564, y 633-653
     NOTHING else on this console was unchanged. The re-render narrowed it: the
     right-hand column moved LEFT about 30px and the whole left edge moved
     RIGHT from x 90 to x 242, which left the fuel gauge standing on bare floor
     clear of the machine. The dial bays did hold — window0 is still 610-706 x
     490-608 — but nothing around them did.
     Check them with ?align=1 before putting anything in them. */
  /* ONE SCREEN. The re-rendered consoles have no right-hand glass and no
     slot under it — that whole block is a single blank face now, and the
     lever is on it. Re-measured against the new art: the comms glass has
     not moved a pixel, and neither has the bay grid. */
  screens: {
    comms: { x: 16.33, y: 10.63, w: 55.08, h: 27.52 }      // px 273,100  921x259
  },

  /* THE BIG SCREEN and the narrow manifest slot beneath it. */
  /* The screen's DARK GLASS, walked out from its centre — 1375-1566 x 397-598.
     The earlier 1333,381 240x219 was the bezel, so every line of the readout
     was set a bezel's width too far out. */
  screen: { x: 82.24, y: 42.19, w: 11.48, h: 21.47 }, // px 1375,397 192x202
  slot:   { x: 81.04, y: 66.63, w: 12.62, h: 3.40 },  // px 1355,627 211x32

  /* THE SATURN BADGE's six lamp housings — one per scored run, 1.1 to 1.6.
     Calibration does not score, which is why six is exactly right. */
  lamps: [
    { x: 79.07, y: 27.74, w: 1.73, h: 3.08 },    // px 1322,261 29x29
    { x: 81.34, y: 27.74, w: 1.73, h: 3.08 },    // px 1360,261
    { x: 83.55, y: 27.74, w: 1.73, h: 3.08 },    // px 1397,261
    { x: 85.77, y: 27.74, w: 1.61, h: 3.08 },    // px 1434,261
    { x: 87.98, y: 27.74, w: 1.73, h: 3.08 },    // px 1471,261
    { x: 90.25, y: 27.74, w: 1.73, h: 3.08 }     // px 1509,261
  ],

  /* LOAD is engraved into the blue faceplate band at the lower right. The art
     has no lever, so nothing is drawn but the word. */
  /* LOAD, pulled in off the corner armour on the right. */
  /* THE LEVER. An engraved word did not read as something you pull, so LOAD
     is a throw lever now: a recessed track with a knob that travels left to
     right. It sits on the navy band under the screen, which measures
     x 1300-1505, y 682-726 — the whole of it, so the throw has room. */
  /* THE LOAD LEVER. The art has no lever and no flat bed for one. The only
     candidate is the raised blue pedestal under the order screen, whose top
     face is x 1295-1508, y 680-729 — and even that is cut diagonally by a
     bracket whose edge, walked row by row across the gate band y 684-725,
     reaches x 1388 at its widest. So the box starts at 1388: everything the
     lever draws lands on clean plate, and nothing crosses the bracket.
     The lever STANDS PROUD of the block rather than pretending to be cut
     into it: a gate across the face, a stick in the gate, a ball grip above,
     and LOAD cut into the shadowed front face below. The ball clears the
     manifest slot (bottom y 659) by a few pixels. */
  /* THE LEVER, on the right-hand face where the screen used to be. Measured
     off all three renders — px 1308,380 272x298, the same in each to within
     a pixel or two — and inset slightly so the throw sits on the clean part
     of the face rather than against its bevel. */
  lever: { x: 78.80, y: 41.20, w: 15.20, h: 30.20 },
  /* the cap's travel when it is pushed, as a % of the box's height. A button
     moves a little and stops; a big number here would read as a trapdoor. */
  pressDepth: 1.5,
};

const CLOSE = {
  src: ART_G + 'Machine screen.webp',
  windows: [
    { x:  5.44, y: 30.61, w: 13.76, h: 31.24 },  // px   91,288  230x294
    { x: 30.56, y: 30.61, w: 13.82, h: 31.24 },  // px  511,288  231x294
    { x: 55.68, y: 30.61, w: 13.70, h: 31.24 },  // px  931,288  229x294
    { x: 80.92, y: 30.61, w: 13.76, h: 31.24 }   // px 1353,288  230x294
  ],
  labels: [
    { x:  5.26, y: 17.11, w: 14.06, h: 8.93 },   // px   88,161  235x84
    { x: 30.38, y: 17.22, w: 14.17, h: 8.82 },   // px  508,162  237x83
    { x: 55.50, y: 17.22, w: 14.06, h: 8.82 },   // px  928,162  235x83
    { x: 80.62, y: 17.22, w: 14.06, h: 8.82 }    // px 1348,162
  ],
  arrows: [
    { x:  4.19, y: 66.42, w: 16.15, h: 14.88 },  // px   70,625  270x140
    { x: 29.37, y: 66.42, w: 16.21, h: 14.88 },  // px  491,625  271x140
    { x: 54.49, y: 66.42, w: 16.15, h: 14.88 },  // px  911,625  270x140
    { x: 79.78, y: 66.42, w: 16.15, h: 14.88 }   // px 1334,625  270x140
  ],
  arrowGap: 0.60                                 // px 10
};

/* ---------------------------------------------------------------------------
   THE DRUM — ported from archive/fuel-v1 unchanged. Weeks of fixes live in
   these five numbers; do not tune them without re-testing a long drag.
   ------------------------------------------------------------------------ */
const DRUM = {
  ms: 260,
  ease: 'cubic-bezier(0.34, 1.3, 0.64, 1)',   // slight detent overshoot
  cells: 64, base: 32,
  dragPixelsPerDigit: 26,
  /* Must be more than half of dragPixelsPerDigit or it gates nothing: brushing
     13px while tapping a dormant dial used to roll its digit. */
  dragTapSlop: 16
};

/* The wide/close push-in, also ported. */
const ZOOM = { ms: 700, ease: 'cubic-bezier(0.22, 1, 0.36, 1)' };

/* ---------------------------------------------------------------------------
   THE OPENING BEAT — Rill briefs Nova before anything is playable.
   ------------------------------------------------------------------------ */
const BRIEF = {
  /* A flat 20% sheet changed almost nothing — the console still read at full
     brightness behind it. This is a VIGNETTE: darkest at the edges, lighter
     over the middle of the machine, so it reads as dimmed rather than greyed.
     Rill and his bubble sit above it at full brightness. */
  scrim: 0.55,
  scrimLift: 600,
  powerUp: 500,          // the console lights left to right
  rill: {
    src: ART + 'screen 4 Rill.webp',
    /* The figure's own box inside a mostly empty PNG, as a % of the file —
       measured from the alpha channel, like the intro's two. 'Screen 5 Rill'
       is a half-body pose that fills the frame; this one stands. */
    box: { x: 15.56, y: 1.02, w: 29.55, h: 97.87 },
    h: 74, inAt: 15, from: -30,
    inMs: 2000, outMs: 1100, inEase: 'cubic-bezier(0.16, 1, 0.3, 1)', fadeMs: 400
  },

  /* Which brief line lights the label plates: "Four dials. Thousands,
     hundreds, tens, ones — left to right." Zero-based. */
  plateLine: 1,

  /* HER PORTRAIT for the instruction panel: head and shoulders cropped out of
     the same cut-out she walks in with. A % box of the file, like `box`, but
     tight on the head — her figure occupies x 15.56-45.11, y 1.02-98.89, and
     the head sits in the top fifth of that. */
  /* HER PORTRAIT for the instruction panel. Found from the cut-out's own
     pixels rather than guessed: her skin is a strong orange-red and nothing
     else in the file is, so the face finds itself. Skin box 437-598 x 29-247,
     widest row (the cheek line) at y 145, so the eye line sits just above at
     y 128 and the head is 219px tall. A circle of 313px puts the head at 70%
     of the diameter, centred on the eyes — which is why y is negative: the
     circle reaches above the top of the file, and that space is empty anyway.
     Nudge these four and the portrait moves; nothing else reads them. */
  portrait: { x: 18.26, y: -2.64, w: 15.81, h: 28.98 }
};

/* ---------------------------------------------------------------------------
   THE TEACHING SCREEN — the place-value chart, before levels 1 and 2.

   The chart is the console's own machine: one drum per place with a header
   plate above it. NOTHING HERE IS A COLUMN COUNT. teach.js divides the width
   by however many places the level has, so the same numbers lay out four
   columns and six.

     x, y, w, h  the box the whole chart sits in, as a % of the stage
     fill        how much of each column's share of the width it takes, so
                 there is air between them
     arrowY      where the x10 arrows run, above the plates
   ------------------------------------------------------------------------ */
/* ---------------------------------------------------------------------------
   THE TEACHING CHART — the classroom place-value chart, printed on card.

   It is one table, not a row of separate columns, so `fill` is 1 and the
   cells share their rules. `card` is the white paper the table is printed
   on: how far it reaches past the table on each side, in stage percent. The
   head is deep enough to carry the x10 row, so those arrows are printed on
   the chart rather than floating above it.

   A place keeps its colour at every width, so the four the child meets in
   level 1 are the same four inside level 2's six. The first four are
   sampled from the classroom chart this is drawn from; lakh and
   ten-thousands continue the run leftward.

   NO COUNT HERE. These are look-ups by place name — a level with three
   places or eight would read out of the same two tables.
   ------------------------------------------------------------------------ */
const TEACH = {
  /* THE CHASSIS the modules are bolted into, and the strip of it they sit
     on. `gap` is the space between two modules, in stage percent. It runs
     right across the stage, left to right: with the card's `side` round it
     the chassis spans 2.1% to 97.9%, a small margin at each edge. */
  chart: { x: 4.5, y: 30, w: 91, h: 38, gap: 0.45 },
  card:  { side: 2.4, top: 3.0, foot: 3.0 },

  /* THE CHART FILLS `chart` FROM THE FIRST LESSON: one slot per place of the
     widest level (six, up to lakh), with the row right-aligned in them and the
     places still to come waiting in covered bays on the left. A module is
     always that one size, and nothing moves when level 2 opens a bay. */

  /* stage % between the chassis and the line above it / CHECK below it */
  lineGap: 2.5,
  goGap: 2.5
};

/* ---------------------------------------------------------------------------
   THE PRE-LOAD SCREEN — the title screen, before anything else.

   Its own art, not the intro's: a landscape plate with nobody standing in it,
   and all three of them cut out fresh for this pose.

   EVERY BOX HERE IS MEASURED FROM THE ALPHA CHANNEL — the opaque bounds of the
   figure as a percentage of its own file — and every aspect is the figure's own
   width over its own height in pixels. All three cut-outs are 1024x1536
   portraits, NOT 16:9 frames, so deriving the aspect from the box alone would
   stretch every one of them half again its width.

     h    the figure's height on the stage, as a % of stage height
     cx   where its CENTRE sits, as a % of stage width
     z    who stands in front of whom
   ------------------------------------------------------------------------ */
const PRELBD = {
  bg: ART + 'background for pre lbd..webp',

  /* left to right as the plate is composed: Rill, Veth, Nova. Veth is the
     tallest and stands behind the other two; Nova is the smallest and in
     front of them. */
  cast: [
    { key: 'rill', src: ART + 'pre lbd Rill.webp',
      box: { x: 15.04, y: 0.33, w: 61.04, h: 99.67 }, aspect: 0.408,   // 625/1531 px
      h: 82, cx: 55.3, z: 2 },
    { key: 'veth', src: ART + 'pre lbd veth.webp',
      box: { x: 19.24, y: 0.07, w: 61.52, h: 99.61 }, aspect: 0.412,   // 630/1530 px
      h: 95, cx: 71.8, z: 1 },
    { key: 'nova', src: ART + 'pre lbd Nova.webp',
      box: { x: 25.49, y: 0.78, w: 55.66, h: 98.70 }, aspect: 0.376,   // 570/1516 px
      h: 68, cx: 86.4, z: 3 }
  ],

  /* THE GAME'S NAME, as artwork. Measured the same way as everything else:
     the opaque bounds of the logo as a percentage of its own file, and the
     aspect its own width over its own height in pixels. */
  heading: { src: ART + 'heading text for pre lbd.webp',
             box: { x: 0.89, y: 1.10, w: 98.70, h: 95.00 }, aspect: 2.431,
             w: 44, cx: 25, cy: 26 },

  /* START. The crew fill the right of the plate from about 47% across, so the
     button is centred in the space that is LEFT rather than at the middle of
     the stage, where it would sit on Rill. It is drawn in code (start.css),
     not a picture; `size` is its type size in % of the stage's width, and
     everything else about it is in em off that. */
  start: { size: 3.5, cx: 25, cy: 62 },

  /* HOW THEY ARRIVE AND HOW THEY LEAVE. They come up from under the bottom
     edge one at a time, and on START they drop back out the same way — the
     screen does not simply fade with them standing in it.
       in     the first one starts this long after the screen comes up
       gap    between one and the next, both directions
       out    the last one is clear this long after START is pressed
       fade   what is left of the screen fading once they are gone */
  pop: { in: 380, gap: 240, out: 120, hold: 780, fade: 420 },

  /* THE SHIP'S RUN — ONE WAY ACROSS, and never a turn.

     It used to wander a closed box, which meant reversing at each end, and a
     ship that is always upright has to FLIP to reverse. Hiding that flip
     behind the title only hid it most of the time. So there is no flip now:
     it crosses the band from x0 to x1 facing the same way the whole time,
     leaves the stage, and comes back on at the far side. The one
     discontinuity in the path is off screen.

     Measured off the live screen for the band it runs in: the logo occupies
     x 3-47, y 9.9-42.1; the crew stand from x 45.9 to 93.6 with their heads
     at y 5, 18 and 32; START sits at x 10-40, y 55.6-68.4. A band at this
     height passes behind the name and behind the three of them and never
     reaches down into the button.

       x0, x1   where it comes on and where it goes off, both clear of the edge
       cy, ay   the centre of its drift and how far it rises and falls
       cross    ms for one crossing
       waves    how many rises and falls it makes on the way over */
  ship: { w: 9, x0: 112, x1: -12, cy: 30, ay: 11, cross: 16000, waves: 1.35,
          scale: 1, swing: 0.2, sp: 26000 }
};

/* ---------------------------------------------------------------------------
   THE FAILURE — the shuttle launches anyway and stops where she sent it.
   ------------------------------------------------------------------------ */
const SHORT = {
  travelMs: 450,          // was 1400, then 850; the gauge it animated is gone (13 Oct)
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  holdMs: 150,           // was 900, then 350
  flashMs: 1200,         // the LOAD button's green / red flash before it goes back to blue
  idleMs: 10000,         // the first idle nudge, after this long with nothing done
  idleStep: 5000,        // each nudge after it waits this much longer…
  idleMaxMs: 30000       // …up to this: from then on, one every 30 s
};

/* ---------------------------------------------------------------------------
   THE DELIVERY FLIGHT — S-17, from the pad out to the settlement.

   The frames live in their own folder so the six that are used sit together;
   plume1..4 stayed behind in s17_shuttle_frames/ because the README says they
   were rendered for a low-angle view and will not sit on cruise.webp's nozzles.
   The exhaust here is drawn in code instead.

   EVERY PATH GOES THROUGH ASSET() before it reaches a src. Relative URLs
   never carry the project folder's own apostrophe, so this is belt-and-braces
   rather than a live bug — but the space in "Game assets" is real, and a raw
   space in a CSS url() fails silently rather than loudly.
   ------------------------------------------------------------------------ */
const SHUTTLE = {
  dir: 'assets/Game assets/Shuttle/',

  /* cruise.webp — nozzle centres as % of that image, from the README */
  nozzle: [ { x: 49.4, y: 84.5 }, { x: 79.7, y: 69.3 } ],

  /* the painted ship's own heading in screen degrees (0 = pointing right,
     clockwise positive). cruise.webp points up and to the left. */
  headingDeg: -155,
  maxBankDeg: 20,        // never rotate further than this off the painted heading

  start:  { x: 50, y: 108 },   // % of stage — just below the bottom edge
  cruiseMs: 4200,
  scaleStart: 1.00,            // near the camera
  scaleEnd:   0.16,            // out at the location — it shrinks the whole way there

  /* scaleStart/scaleEnd are multipliers with no size to multiply; baseW is the
     width of the ship's BODY as a % of stage width at scale 1 — the body, not
     the sprite canvas, because the two frames' canvases are different shapes
     and only the body is the same object. */
  baseW: 14,

  /* THE ARRIVAL. There is no landing: the camera stays on the wide map for the
     whole delivery, so the ship reaches the settlement, keeps shrinking as it
     drops away towards it, and is gone. land1..4 are not played — on the wide
     map the settlement is two or three percent of the stage across, and a
     shuttle set down on it would be three times the size of the place it is
     delivering to. */
  arriveMs: 1000,
  /* the last of it, over the settlement: how much smaller it gets as a
     multiple of scaleEnd, and how far into the arrival the fade begins */
  arriveScale: 0.4,
  arriveFadeFrom: 0.2,

  plumeHz: 12,
  plumeCycle: [1.00, 0.88, 0.96, 0.82],

  /* the console has to get out of the way before the map comes back */
  handoverMs: 460,
  reducedFadeMs: 400
};

/* ########################################################################## */
/*  SCRIPT.JS                                                               */
/* ########################################################################## */

/* ============================================================================
   SCRIPT.JS — every word the opening sequence says.

   One array. Edit the words here and the animation does not need touching:
   intro.js reads `slide` and `speaker` and works out the rest.

     slide    which beat this line belongs to (1-6)
     speaker  'narrator', 'veth', 'rill' or 'nova'
     text     the line itself
     vo       the audio-hook id. Nothing plays it yet; it is the handle a
              voice-over file gets hung on later. See audioHook() in intro.js.

   THE NARRATOR IS NOT A CHARACTER. Screens 1 to 4 are narration over the map
   and the station close-ups, and there is nobody on stage to point a tail at,
   so those lines are not spoken in a bubble at all. They run in a caption
   band low on the stage — same armour language as the tag card, centred, no
   tail. intro.js picks the band over the bubble purely from `speaker`, so
   moving a line between the two is an edit here and nowhere else.

   IT IS A FUEL GAME. The crates are already aboard. What Nova sets is the
   FUEL, one gallon carries the shuttle one kilometre, and a wrong load
   launches anyway and stops short. That proportional consequence is the
   mechanic the whole game rests on — a shuttle that simply refuses to launch
   on a wrong number replaces a lesson with a locked door, so nothing here
   says the amount has to be right before it will go. Rill's line on screen 6
   says what he does without promising a launch gate.

   REGISTER: grade 6, age 11-12. Brisk and matter-of-fact. No encouragement,
   no exclamation marks, nothing that reads as talking down. If you rewrite a
   line, keep that.
   ========================================================================= */

const LINES = [

  /* SCREEN 1 — the three of them at the base station, over the holo-table. */
  { slide: 1, speaker: 'narrator', vo: 'v1-01',
    text: i18n('intro.screen1') },

  /* SCREEN 2 — dive to Rock Post, outline draws, tag card. */
  { slide: 2, speaker: 'narrator', vo: 'v1-02',
    text: i18n('intro.screen2') },

  /* SCREEN 3 — pull out, then dive to Lake Station. */
  { slide: 3, speaker: 'narrator', vo: 'v1-03',
    text: i18n('intro.screen3') },

  /* SCREEN 4 — pull out, then dive to Titan City. */
  { slide: 4, speaker: 'narrator', vo: 'v1-04',
    text: i18n('intro.screen4') },

  /* SCREEN 5 — back on the map, and the only screen the three of them stand
     up on. Veth rises to speak, and Nova and Rill rise from below the frame
     as the line reaches their names — "Nova" is its first word and "Rill" its
     fifth, so the three of them arrive across the sentence rather than all at
     once. Nothing schedules that: intro.js watches the typewriter. */
  { slide: 5, speaker: 'veth', vo: 'v1-05',
    text: i18n('intro.screen5') },

  /* SCREEN 6 — still the map, and still Rill: Veth goes and he stays exactly
     where he was standing, which is why there is no entrance to play here. */
  /* QA Bug 10 (13 Oct 2026): this was one bubble and one 14-second breath —
     three instructions at once. It is now three lines, each its own bubble
     and its own clip (the recording cut at its two sentence pauses), with a
     longer beat between them so each one can land before the next. */
  { slide: 6, speaker: 'rill', vo: 'v1-06a', hold: 1000,
    text: i18n('intro.screen6')[0] },
  { slide: 6, speaker: 'rill', vo: 'v1-06b', hold: 1000,
    text: i18n('intro.screen6')[1] },
  { slide: 6, speaker: 'rill', vo: 'v1-06c',
    text: i18n('intro.screen6')[2] }

];

/* Which location each slide dives into. Screens 1, 5 and 6 do not dive: 1 and
   6 stand on a still of their own, 5 stands on the map. */
const SLIDE_LOC = { 1: null, 2: 'rockpost', 3: 'lakestation', 4: 'titancity', 5: null, 6: null };

/* ---------------------------------------------------------------------------
   WHO STANDS ON A SCREEN, where naming it beats working it out.

   intro.js otherwise derives the cast from the screen's own lines: whoever
   speaks, plus whoever the words name. On screen 5 that would bring Rill up
   too, because Veth's line names his — but the scene is Veth and Nova: he
   is talking TO his, so he stands across from him on the right, rising as
   he says her name (it is his first word, so she is up as soon as he starts).
   Rill stays off until screen 6, where he is at the machine.

   A screen with no entry is derived as before. Anyone painted into a screen's
   own artwork is still removed on top of this, so this list can never put
   somebody on stage twice.
   ------------------------------------------------------------------------ */
const SLIDE_CAST = { 5: ['veth', 'nova'] };

/* WHERE A CHARACTER STANDS on a screen that has no still of its own. On
   screen 5 Veth stands on the LEFT, a little smaller, with his hand out to
   the right — across the screen to Nova, who stands on the right looking
   back at him. His bubble opens on his right, between the two of them. At
   x 12 he spans about 3% to 21%, just left of Rock Post. She keeps three
   quarters of his height, as everywhere else. */
const SLIDE_POS = { 5: { veth: { x: 12, h: 68 }, nova: { x: 83, h: 51 } } };

/* ---------------------------------------------------------------------------
   WHO WALKS ACROSS THE STAGE before a screen's first line.

   On screen 6 Veth sinks out and Rill crosses from the right of the map
   towards where he stood. She is mirrored on screen 5 to face him; `turn`
   flips his back on the spot first, and only then does he walk. `x` is his centre, as in
   CAST; `ms` is how long the crossing takes before she speaks; `bubbleDx`
   moves her speech box that many stage % to the right of her (the tail still
   points at her).
   ------------------------------------------------------------------------ */
const SLIDE_WALK = {};

/* ---------------------------------------------------------------------------
   THE STILLS — the screens that are a picture rather than a camera move.
   A screen with no entry here stands on the map or on its own dive.

   `cast` names who is ALREADY PAINTED INTO that picture, and nobody painted
   in is ever also stood up as a cut-out — which is the whole of why screen 1
   plays no entrances even though its line names all three of them.

   `look` re-dresses an actor for that screen only — a different cut-out, its
   own measurements, its own place. Rill has two poses: he stands with the
   others on the map, and on the panel he is turned to his left with an arm
   out at the drums, which is a three-quarter crop and so needs its own box,
   aspect and height to read as the same size of person.

   The stills are 1980x1080, which is 1.833 rather than the stage's 16:9, so
   they are laid in with `cover` and lose about 1.5% off each side. Both are
   framed well inside that, and the crop is centred.
   ------------------------------------------------------------------------ */
const SLIDE_ART = {
  1: { src: ART + 'screen 3.webp', cast: ['veth', 'rill', 'nova'] },
  /* SCREEN 6 IS THE MACHINE SCREEN: Rill explains the panel standing beside
     the very console the player is about to use. */
  6: { src: 'assets/Game assets/Machine screen.webp', cast: [],
       look: { rill: { x: 11 } } }
};

/* ########################################################################## */
/*  SFX.JS                                                                  */
/* ########################################################################## */

/* ============================================================================
   SFX.JS — the console's sound, synthesised.

   There are no audio files. Every sound in this game is built live out of
   oscillators and noise, which means it ships with nothing to download, works
   straight off a file:// URL, and never pops because an asset was slow.

   It is not a bank of beeps. Each sound is layered the way a real one is:
   a transient (the hit), a body (the pitched part), and a tail (the room).
   A generated reverb sits behind everything so the console sounds like it is
   in a hangar rather than inside a phone speaker.

   TO CHANGE THE FEEL: the numbers in VOICES near the bottom are the whole
   design — pitches, lengths and levels. Tweak those, not the engine.

   TO MUTE: the speaker control in the corner, or SFX.toggle() from anywhere.
   ========================================================================= */
var SFX = (function () {
  "use strict";

  var ctx = null;
  var master = null, wet = null, dry = null, comp = null, verb = null;
  var noiseBuf = null;
  var ambient = null;
  var on = true;
  var ready = false;

  /* remember the player's choice between sessions where we can */
  try {
    var saved = localStorage.getItem("titan-sound");
    /* the sound button is gone (13 Oct 2026), so a muted choice saved
       earlier would leave the game silent with no way back: sound is
       always on now */
    if (saved === "off") localStorage.removeItem("titan-sound");
  } catch (e) { /* private window, blocked storage — just default to on */ }


  /* ========================================================================
     ENGINE
     ===================================================================== */

  /* A tail built from decaying noise. Convolving against it puts every sound
     in the same room, which is most of what separates "a sound" from "a sound
     effect". Slightly different left and right so it has width. */
  function buildRoom(seconds, decay) {
    var n = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < n; i++) {
        var t = i / n;
        // a touch of early reflection sparkle, then a smooth exponential tail
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.15);
      }
    }
    return buf;
  }

  function buildNoise(seconds) {
    var n = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    /* master chain: everything -> compressor -> out.
       The compressor is doing real work: it glues the layers of a sound
       together and stops a launch plus a chord plus the hum from clipping. */
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    master = ctx.createGain();
    master.gain.value = on ? 0.9 : 0;

    verb = ctx.createConvolver();
    verb.buffer = buildRoom(2.4, 2.6);

    wet = ctx.createGain(); wet.gain.value = 0.34;   // send level into the room
    dry = ctx.createGain(); dry.gain.value = 1;

    dry.connect(master);
    wet.connect(verb); verb.connect(master);
    master.connect(comp); comp.connect(ctx.destination);

    noiseBuf = buildNoise(2.0);
    ready = true;
    return true;
  }

  function now() { return ctx.currentTime; }

  /* Route a voice to the room and the direct signal at once. `send` is how
     much of it goes to the reverb. */
  function out(node, send) {
    node.connect(dry);
    if (send > 0) {
      var s = ctx.createGain();
      s.gain.value = send;
      node.connect(s);
      s.connect(wet);
    }
  }

  /* One pitched layer. Everything optional so the voices below stay readable.
       f / f2  : start and end frequency (a glide if f2 is given)
       type    : oscillator shape
       t       : when to start, relative to now
       dur     : total length
       peak    : level
       atk     : attack time
       curve   : 'exp' decays like a struck object, 'lin' like a fade
       lp / hp : filter the layer
       q       : filter resonance
       send    : reverb amount
       detune  : cents                                                      */
  function tone(o) {
    if (!ready) return;
    var t0 = now() + (o.t || 0);
    var dur = o.dur || 0.25;
    var osc = ctx.createOscillator();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) {
      if (o.glide === "lin") osc.frequency.linearRampToValueAtTime(o.f2, t0 + dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + dur);
    }
    if (o.detune) osc.detune.value = o.detune;

    var g = ctx.createGain();
    var peak = o.peak === undefined ? 0.25 : o.peak;
    var atk = o.atk === undefined ? 0.004 : o.atk;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + atk);
    if (o.curve === "lin") g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    var node = osc;
    if (o.lp || o.hp) {
      var f = ctx.createBiquadFilter();
      f.type = o.hp ? "highpass" : "lowpass";
      f.frequency.setValueAtTime(o.hp || o.lp, t0);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.lp2), t0 + dur);
      if (o.q) f.Q.value = o.q;
      node.connect(f); node = f;
    }
    node.connect(g);
    out(g, o.send === undefined ? 0.25 : o.send);

    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /* One noise layer — the transient in most of these sounds.
       bp / bp2 : band centre, swept if bp2 is given
       hp, lp   : simple filters instead of a band                          */
  function hiss(o) {
    if (!ready) return;
    var t0 = now() + (o.t || 0);
    var dur = o.dur || 0.12;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;

    var f = ctx.createBiquadFilter();
    if (o.bp) {
      f.type = "bandpass";
      f.frequency.setValueAtTime(o.bp, t0);
      if (o.bp2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.bp2), t0 + dur);
      f.Q.value = o.q === undefined ? 1.2 : o.q;
    } else if (o.hp) {
      f.type = "highpass"; f.frequency.value = o.hp;
    } else {
      f.type = "lowpass";
      f.frequency.setValueAtTime(o.lp || 1200, t0);
      if (o.lp2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.lp2), t0 + dur);
      if (o.q) f.Q.value = o.q;
    }

    var g = ctx.createGain();
    var peak = o.peak === undefined ? 0.2 : o.peak;
    var atk = o.atk === undefined ? 0.002 : o.atk;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(f); f.connect(g);
    out(g, o.send === undefined ? 0.25 : o.send);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  var rand = function (a, b) { return a + Math.random() * (b - a); };


  /* ========================================================================
     THE AMBIENT BED
     A machine that is switched on should never be silent. Two detuned sub
     oscillators and a filtered noise floor, well under everything else.
     ===================================================================== */
  function startAmbient() {
    if (!ready || ambient) return;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now());
    g.gain.linearRampToValueAtTime(0.055, now() + 2.5);

    var a = ctx.createOscillator(); a.type = "sine"; a.frequency.value = 56;
    var b = ctx.createOscillator(); b.type = "sine"; b.frequency.value = 56.7;
    var c = ctx.createOscillator(); c.type = "triangle"; c.frequency.value = 112;
    var cg = ctx.createGain(); cg.gain.value = 0.18;

    var air = ctx.createBufferSource();
    air.buffer = noiseBuf; air.loop = true;
    var af = ctx.createBiquadFilter();
    af.type = "bandpass"; af.frequency.value = 480; af.Q.value = 0.7;
    var ag = ctx.createGain(); ag.gain.value = 0.06;

    /* a very slow wobble, so it breathes instead of sitting dead */
    var lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.07;
    var lfoG = ctx.createGain(); lfoG.gain.value = 0.9;
    lfo.connect(lfoG); lfoG.connect(a.frequency);

    a.connect(g); b.connect(g); c.connect(cg); cg.connect(g);
    air.connect(af); af.connect(ag); ag.connect(g);
    g.connect(dry);

    [a, b, c, lfo].forEach(function (o) { o.start(); });
    air.start();
    ambient = { g: g, nodes: [a, b, c, lfo, air] };
  }


  /* ========================================================================
     VOICES — the sound design. These numbers are the whole feel of the game.
     ===================================================================== */
  var VOICES = {

    /* A drum detent. Three layers: the pawl striking, the drum body, and a
       faint metal ring. Pitch shifts with the digit so a run of taps sounds
       like a mechanism rather than a repeated sample. */
    click: function (digit) {
      var k = 1 + ((digit || 0) % 10) * 0.012;
      hiss({ bp: 2600 * k, bp2: 1500, q: 1.1, dur: 0.045, peak: 0.30, send: 0.12 });
      tone({ f: 235 * k, f2: 120, type: "triangle", dur: 0.085, peak: 0.22, lp: 1800, send: 0.18 });
      tone({ f: 1420 * k, type: "sine", dur: 0.11, peak: 0.045, send: 0.4, t: 0.004 });
      tone({ f: 2260 * k, type: "sine", dur: 0.08, peak: 0.025, send: 0.4, t: 0.004 });
    },

    /* The servo, while a drag is actually spinning the drum. */
    whir: function () {
      hiss({ bp: 900, bp2: 2200, q: 3.5, dur: 0.14, peak: 0.10, send: 0.15 });
      tone({ f: 150, f2: 330, type: "sawtooth", dur: 0.14, peak: 0.055, lp: 1400, send: 0.1 });
    },

    /* Moving the live dial. A short lit blip, not a UI beep. */
    focus: function () {
      tone({ f: 620, f2: 930, type: "sine", dur: 0.16, peak: 0.13, send: 0.5 });
      tone({ f: 1240, f2: 1860, type: "sine", dur: 0.13, peak: 0.04, send: 0.5 });
      hiss({ bp: 3400, dur: 0.03, peak: 0.07, send: 0.3 });
    },

    /* The camera push. Filtered air moving, with a sub swell underneath, cut
       to the same 700ms as the zoom itself. */
    zoom: function (dir) {
      var inward = dir !== "out";
      hiss({
        bp: inward ? 320 : 3200, bp2: inward ? 3200 : 320, q: 0.9,
        dur: 0.62, peak: 0.13, atk: 0.12, send: 0.45
      });
      tone({
        f: inward ? 70 : 180, f2: inward ? 180 : 70, type: "sine",
        dur: 0.6, peak: 0.16, atk: 0.1, send: 0.3
      });
    },

    /* Fuel moving into a cell. The band climbs with the level, so a 9 sounds
       fuller than a 1 — the sound carries the same information as the tube. */
    pour: function (level) {
      var l = Math.max(0, Math.min(9, level || 0)) / 9;
      hiss({ bp: 380 + l * 700, bp2: 900 + l * 1500, q: 2.2, dur: 0.30, peak: 0.11, atk: 0.03, send: 0.4 });
      tone({ f: 180 + l * 220, f2: 260 + l * 380, type: "sine", dur: 0.28, peak: 0.07, send: 0.35 });
      for (var i = 0; i < 3; i++) {
        tone({ f: rand(900, 1900), type: "sine", dur: 0.05, peak: 0.03, t: rand(0.02, 0.22), send: 0.5 });
      }
    },

    /* The lever. A sprung creak, a heavy seat, and the latch catching. */
    lever: function () {
      hiss({ bp: 700, bp2: 300, q: 2.0, dur: 0.09, peak: 0.16, send: 0.2 });
      tone({ f: 96, f2: 54, type: "triangle", dur: 0.22, peak: 0.34, lp: 900, send: 0.25 });
      tone({ f: 300, f2: 170, type: "sawtooth", dur: 0.12, peak: 0.07, lp: 1200, send: 0.2 });
      hiss({ bp: 3200, q: 2.4, dur: 0.05, peak: 0.20, t: 0.13, send: 0.35 });
      tone({ f: 1800, type: "sine", dur: 0.16, peak: 0.05, t: 0.13, send: 0.5 });
    },

    /* Wrong load. A two-pulse klaxon over a falling tone — firm, and over
       quickly, because a child is going to hear it more than once. */
    wrong: function () {
      [0, 0.19].forEach(function (t) {
        tone({ f: 233, type: "square", dur: 0.16, peak: 0.14, lp: 1100, q: 4, t: t, send: 0.3 });
        tone({ f: 220, type: "square", dur: 0.16, peak: 0.12, lp: 1100, q: 4, t: t, send: 0.3, detune: -12 });
      });
      tone({ f: 420, f2: 150, type: "triangle", dur: 0.42, peak: 0.12, lp: 1400, send: 0.35 });
      hiss({ bp: 1200, bp2: 400, q: 1.4, dur: 0.3, peak: 0.07, send: 0.3 });
    },

    /* Correct load. The bolt seating, then the readout locking green: a rising
       figure with the room opening up behind it. */
    lock: function () {
      hiss({ bp: 2400, q: 2, dur: 0.05, peak: 0.22, send: 0.25 });
      tone({ f: 120, f2: 78, type: "triangle", dur: 0.2, peak: 0.26, lp: 900, send: 0.25 });
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone({ f: f, type: "triangle", dur: 0.5 + i * 0.12, peak: 0.15 - i * 0.018,
               t: 0.06 + i * 0.075, atk: 0.008, send: 0.62 });
        tone({ f: f * 2, type: "sine", dur: 0.35, peak: 0.035,
               t: 0.06 + i * 0.075, send: 0.62 });
      });
      hiss({ bp: 1800, bp2: 6000, q: 1.1, dur: 0.7, peak: 0.05, atk: 0.14, t: 0.1, send: 0.7 });
    },

    /* The shuttle going. Rumble with the pitch falling away, and a body of
       air passing the camera. */
    launch: function () {
      hiss({ lp: 260, lp2: 90, dur: 1.5, peak: 0.34, atk: 0.12, send: 0.5 });
      tone({ f: 62, f2: 28, type: "sawtooth", dur: 1.5, peak: 0.20, lp: 420, atk: 0.1, send: 0.4 });
      hiss({ bp: 2600, bp2: 380, q: 0.8, dur: 1.2, peak: 0.13, atk: 0.2, t: 0.12, send: 0.6 });
      tone({ f: 330, f2: 120, type: "triangle", dur: 0.9, peak: 0.07, t: 0.1, send: 0.55 });
    },

    /* THE DELIVERY RUN. A bed, not a hit: the band and the body both climb
       across the cruise so the ship reads as getting further away and working
       harder, and 'thrustDown' takes it back off during the descent. Both are
       built from the same two helpers as everything else here — no files. */
    thrust: function (secs) {
      var d = secs || 3.2;
      hiss({ lp: 300, lp2: 700, dur: d, peak: 0.16, atk: 0.55, send: 0.5 });
      hiss({ bp: 420, bp2: 1500, q: 0.7, dur: d, peak: 0.09, atk: 0.7, send: 0.6 });
      tone({ f: 46, f2: 78, type: "sawtooth", dur: d, peak: 0.13, lp: 380,
             atk: 0.6, send: 0.35 });
    },
    thrustDown: function (secs) {
      var d = secs || 1.6;
      hiss({ lp: 700, lp2: 180, dur: d, peak: 0.13, atk: 0.1, send: 0.5 });
      tone({ f: 78, f2: 34, type: "sawtooth", dur: d, peak: 0.11, lp: 340,
             atk: 0.08, send: 0.35 });
    },

    /* Weight settling onto the pads. One soft note and a little dust. */
    touchdown: function () {
      tone({ f: 88, f2: 58, type: "sine", dur: 0.5, peak: 0.24, lp: 700,
             atk: 0.012, send: 0.4 });
      tone({ f: 176, type: "triangle", dur: 0.34, peak: 0.07, atk: 0.01, send: 0.5 });
      hiss({ bp: 900, bp2: 260, q: 1.1, dur: 0.42, peak: 0.10, atk: 0.02, send: 0.55 });
    },

    /* A depot light coming on. Climbs a little with each one, so six runs
       feel like progress rather than six identical pings. */
    lamp: function (n) {
      var f = 880 * Math.pow(2, ((n || 0) % 6) / 12);
      tone({ f: f, type: "sine", dur: 0.42, peak: 0.12, send: 0.7 });
      tone({ f: f * 1.5, type: "sine", dur: 0.3, peak: 0.05, send: 0.7 });
      hiss({ bp: 5200, dur: 0.04, peak: 0.06, send: 0.5 });
    },

    /* Level complete. A held chord that blooms rather than a fanfare. */
    complete: function () {
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach(function (f, i) {
        tone({ f: f, type: "triangle", dur: 2.2, peak: 0.11 - i * 0.012,
               atk: 0.06 + i * 0.03, t: i * 0.06, send: 0.8 });
      });
      hiss({ bp: 900, bp2: 7000, q: 0.8, dur: 1.8, peak: 0.06, atk: 0.5, send: 0.8 });
      tone({ f: 65.4, type: "sine", dur: 2.4, peak: 0.14, atk: 0.1, send: 0.3 });
    },

    /* The headline landing on the celebration. A quick climb of bell notes
       over Nova's own cheering; the 2.76x partial is what makes it a bell. */
    chime: function () {
      [1318.51, 1661.22, 1975.53, 2637.02].forEach(function (f, i) {
        var t = i * 0.075;
        tone({ f: f, type: "sine", dur: 1.1 - i * 0.12, peak: 0.12 - i * 0.015,
               atk: 0.004, t: t, send: 0.75 });
        tone({ f: f * 2.76, type: "sine", dur: 0.35, peak: 0.025, atk: 0.002, t: t, send: 0.8 });
      });
      hiss({ bp: 7000, q: 1.2, dur: 0.25, peak: 0.03, atk: 0.01, send: 0.7 });
    },

    /* APPLAUSE for a number set right in the lesson: a short patter of
       hand-claps, each a band of noise with a snap and a little room. */
    clap: function () {
      for (var i = 0; i < 14; i++) {
        var t = i * 0.075 + Math.random() * 0.03;
        hiss({ bp: 1200 + Math.random() * 900, q: 1.4, dur: 0.07, peak: 0.16 + Math.random() * 0.08,
               atk: 0.002, t: t, send: 0.35 });
      }
    },

    /* The same bell for a retry, two notes and quieter: kind, not a fanfare. */
    chimeSoft: function () {
      [987.77, 1318.51].forEach(function (f, i) {
        tone({ f: f, type: "sine", dur: 0.9, peak: 0.08, atk: 0.006, t: i * 0.11, send: 0.7 });
        tone({ f: f * 2.76, type: "sine", dur: 0.25, peak: 0.015, t: i * 0.11, send: 0.7 });
      });
    },

    /* The idle nudge. Two soft notes, deliberately unhurried. */
    idle: function () {
      tone({ f: 587.33, type: "sine", dur: 0.5, peak: 0.09, atk: 0.03, send: 0.6 });
      tone({ f: 783.99, type: "sine", dur: 0.6, peak: 0.08, atk: 0.03, t: 0.22, send: 0.6 });
    },

    /* Anything else you can press. */
    tick: function () {
      hiss({ bp: 2200, dur: 0.026, peak: 0.13, send: 0.2 });
      tone({ f: 520, f2: 360, type: "sine", dur: 0.06, peak: 0.07, send: 0.25 });
    },

    /* The console dropping to standby: the hum falls about a fifth and loses
       its top end, which is most of what "the room went quiet" sounds like. */
    standby: function () {
      if (ambient) {
        ambient.nodes[0].frequency.setTargetAtTime(37, now(), 0.45);
        ambient.nodes[1].frequency.setTargetAtTime(37.5, now(), 0.45);
        ambient.nodes[2].frequency.setTargetAtTime(74, now(), 0.45);
        ambient.g.gain.setTargetAtTime(0.035, now(), 0.5);
      }
      tone({ f: 150, f2: 62, type: "sine", dur: 1.1, peak: 0.13, atk: 0.06, send: 0.4 });
      hiss({ bp: 1400, bp2: 300, q: 1.2, dur: 0.9, peak: 0.07, send: 0.45 });
    },

    /* and back up again */
    wake: function () {
      if (ambient) {
        ambient.nodes[0].frequency.setTargetAtTime(56, now(), 0.35);
        ambient.nodes[1].frequency.setTargetAtTime(56.7, now(), 0.35);
        ambient.nodes[2].frequency.setTargetAtTime(112, now(), 0.35);
        ambient.g.gain.setTargetAtTime(0.055, now(), 0.4);
      }
      tone({ f: 70, f2: 160, type: "sine", dur: 0.8, peak: 0.14, atk: 0.05, send: 0.35 });
    },

    /* The machine waking up, under the first slide. */
    power: function () {
      tone({ f: 40, f2: 58, type: "sine", dur: 1.4, peak: 0.22, atk: 0.5, send: 0.3 });
      hiss({ bp: 200, bp2: 1400, q: 1.1, dur: 1.2, peak: 0.08, atk: 0.5, send: 0.5 });
      tone({ f: 1200, f2: 2400, type: "sine", dur: 0.5, peak: 0.03, t: 0.7, send: 0.7 });
    }
  };


  /* ========================================================================
     PUBLIC
     ===================================================================== */

  /* Browsers will not let audio start until the player has interacted, so the
     first gesture of any kind arms everything. */
  function arm() {
    if (held || !init()) return;
    if (ctx.state === "suspended") ctx.resume();
    if (!ambient && on) { startAmbient(); VOICES.power(); }
  }

  /* PAUSE.JS holds the whole room while the player is away. Nothing plays
     under a hold, and nothing else may lift it. */
  var held = false;

  function play(name, arg) {
    if (!on || !ready || held) return;
    if (ctx.state === "suspended") ctx.resume();
    var v = VOICES[name];
    if (v) { try { v(arg); } catch (e) { /* never let a sound break the game */ } }
  }

  function setOn(next) {
    on = !!next;
    try { localStorage.setItem("titan-sound", on ? "on" : "off"); } catch (e) {}
    if (!ready) { if (on) arm(); return; }
    master.gain.cancelScheduledValues(now());
    master.gain.setTargetAtTime(on ? 0.9 : 0, now(), 0.05);
    if (on && !ambient) startAmbient();
    if (window.VOICE) window.VOICE.mute(!on);
  }

  return {
    arm: arm,
    play: play,
    isOn: function () { return on; },
    toggle: function () { setOn(!on); return on; },
    setOn: setOn,
    suspend: function () {
      held = true;
      if (ctx && ctx.state === "running") ctx.suspend();
    },
    resume: function () {
      if (!held) return;
      held = false;
      if (ctx && ctx.state === "suspended") ctx.resume();
    },
    /* so you can audition a voice from the console while tuning VOICES */
    voices: VOICES
  };
})();

/* SFX is a name inside this file's one scope, not a global. The preview page
   (ending-demo.html) and the browser console reach it here. */
window.SFX = SFX;

/* ########################################################################## */
/*  VOICE.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   VOICE.JS — every spoken line, as recorded audio.

   The storyboard puts the dialogue in the characters' mouths, not on the
   screen, so the game SAYS its lines and shows none of them. The clips are
   made by tools/make_voices.py with Kokoro, an open-source TTS model
   (Apache-2.0), and listed in assets/voice/manifest.json by the line's own
   wording — so a line is found by what it says, and changing a line in
   locales.json only needs the script to be run again.

     Veth      am_onyx, slowed and lowered — heavy and deep
     Rill      Ranbir M (ElevenLabs) — Rill is a boy
     Nova      af_bella, quicker and raised — small, bright and bouncy
     narrator  bf_emma

   VOICE.play(text) starts a line (stopping any other) and returns its length
   in ms, or 0 if there is no clip. The sound button mutes it with the SFX.
   ========================================================================= */
var VOICE = (function () {
  /* NUMBER POPULATION: NO RECORDED VOICE — DIALOGUE ONLY.

     Everything in the game that waits on a line (the beats, the Try ladder,
     the typewriter in the dialogue box, the marks clearing) asks VOICE when
     the line is done. So VOICE is kept, with the same calls, but each line is
     a SILENT TIMER instead of a clip: it "plays" for as long as a child needs
     to read it, and the box types it out over the first part of that time.

       type   ms per letter the box types at
       read   ms per word, the reading time a line is given at the least
       tail   ms the finished line stands before the next thing happens  */
  var PACE = { type: 34, read: 330, tail: 1100, min: 1600, clipTail: 500 };
  var cur = null, held = false, quietAt = -Infinity, lastK = '', tick = null;

  /* 22 Oct 2026: SAMPLE VOICES. A line with a clip in assets/voice (made by
     tools/make_voices.py, listed in manifest.json by the line's wording)
     plays it, and lasts as long as the clip; a line without one stays a
     silent timer as above. The timer is still what says a line is over, so
     everything that waits on VOICE waits on the clip the same way. */
  var CLIPS = {}, audio = null, muted = false, unlocked = false;
  (function () {
    var x = new XMLHttpRequest();
    x.open('GET', 'assets/voice/manifest.json');
    x.onload = function () {
      if (x.status !== 200 && !(x.status === 0 && x.responseText)) return;
      try { CLIPS = JSON.parse(x.responseText) || {}; } catch (e) { CLIPS = {}; }
    };
    x.send();
  })();
  function startAudio(c, fromMs) {
    stopAudio();
    var a = audio = new Audio(ASSET('assets/voice/' + c.file));
    a.muted = muted;
    if (fromMs > 0) a.addEventListener('loadedmetadata', function () { a.currentTime = fromMs / 1000; }, { once: true });
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
  }
  function stopAudio() {
    if (audio) { audio.pause(); audio = null; }
  }
  /* A BROWSER WILL NOT PLAY SOUND BEFORE THE FIRST TAP. If a line started
     before it, the first tap picks the clip up from where the line is. */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (cur && cur.clip && !held && (!audio || audio.paused) && elapsed() < cur.clip.ms - 200) {
      startAudio(cur.clip, elapsed());
    }
  }
  ['pointerdown', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, unlock, { capture: true, once: true });
  });

  function key(t) {
    return String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function typeMs(text) { return key(text).length * PACE.type; }
  function lineMs(text) {
    var k = key(text);
    if (!k) return 0;
    var words = k.split(' ').length;
    return Math.round(Math.max(PACE.min, typeMs(text) + PACE.tail, words * PACE.read));
  }
  function now() { return performance.now(); }
  /* how far into the current line, not counting time spent paused */
  function elapsed() {
    if (!cur) return 0;
    return cur.acc + (held || cur.pausedAt != null ? 0 : now() - cur.from);
  }
  function loop() {
    if (tick) return;
    tick = setInterval(function () {
      if (!cur) { clearInterval(tick); tick = null; return; }
      if (held) return;
      if (elapsed() >= cur.ms) {
        var c = cur;
        cur = null; quietAt = now();
        clearInterval(tick); tick = null;
        if (c.onEnd) c.onEnd();
      }
    }, 40);
  }
  function stop() {
    stopAudio();
    if (cur) { cur = null; quietAt = now(); }
  }
  function play(text, onEnd) {
    var k = key(text);
    if (!k) return 0;
    /* the same line asked for again while it is still up is said once */
    if (cur && cur.k === k) {
      if (onEnd) { var prev = cur.onEnd; cur.onEnd = function () { if (prev) prev(); onEnd(); }; }
      return Math.max(0, cur.ms - elapsed());
    }
    stop();
    lastK = k;
    cur = { k: k, ms: lineMs(text), type: typeMs(text), acc: 0, from: now(), pausedAt: held ? 0 : null, onEnd: onEnd || null };
    var c = CLIPS[k];
    if (c && c.ms) {
      /* the clip sets the line's length, and the words type along with it */
      cur.clip = c;
      cur.ms = Math.max(PACE.min, c.ms + PACE.clipTail);
      cur.type = c.ms * 0.85;
      if (!held) startAudio(c, 0);
    }
    if (held) cur.pausedAt = 0;
    loop();
    return cur.ms;
  }
  function then(text) {
    if (!cur) return play(text);
    var c = cur, prev = c.onEnd;
    c.onEnd = function () { if (prev) prev(); play(text); };
    return lineMs(text);
  }
  return {
    play: play, stop: stop, then: then,
    fresh: function () { lastK = ''; if (cur) cur.k = ''; },
    ms: function (text) { return lineMs(text); },
    playing: function () { return !!cur && !held; },
    quietFor: function () { return cur ? 0 : now() - quietAt; },
    left: function () { return cur ? Math.max(0, cur.ms - elapsed()) : 0; },
    hold: function () {
      if (held) return;
      held = true;
      if (cur) { cur.acc += now() - cur.from; cur.pausedAt = 1; }
      if (audio) audio.pause();
    },
    unhold: function () {
      if (!held) return;
      held = false;
      if (cur) { cur.from = now(); cur.pausedAt = null; }
      if (audio && cur && cur.clip) {
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      }
    },
    mute: function (m) { muted = !!m; if (audio) audio.muted = muted; },
    /* the START press: the tap that lets the browser play sound */
    unlock: unlock,
    hasClip: function (text) { return !!CLIPS[key(text)]; },
    /* the typewriter follows this: 0..1 across the typing part of the line */
    progress: function (text) {
      var k = key(text);
      if (cur && cur.k === k) return Math.max(0, Math.min(1, elapsed() / Math.max(1, cur.type)));
      if (lastK === k) return 1;
      return -1;
    },
    /* Rill's mouth moves while the words are being typed */
    mouth: function () { return !!cur && !held && elapsed() < cur.type; },
    misses: [],
    /* run fn when the line reaches `ms` — dropped if another line takes over */
    reach: function (text, ms, fn) {
      var k = key(text), dead = false;
      (function poll() {
        if (dead) return;
        if (cur && cur.k === k) {
          if (elapsed() >= ms) return fn();
        } else if (lastK === k) {
          return fn();                       // already said out
        } else {
          return;                            // cut off by another line
        }
        setTimeout(poll, 40);
      })();
      return function () { dead = true; };
    }
  };
})();
window.VOICE = VOICE;
/* a line is being said right now: the dials wait for it (16 Oct 2026) */
function voiceBusy() { return !!(window.VOICE && VOICE.playing()); }

/* a talking sprite's state, from whether its line is on (base) and whether
   the voice is sounding: true runs the mouth, 'hold' rests it but keeps
   watching (a pause mid-line), false lets it settle and stop */
function mouthState(base) {
  if (!base) return false;
  var m = VOICE.mouth();
  return m === null ? true : (m ? true : 'hold');
}

/* WHERE IN A CLIP A WORD IS SAID, in ms from the clip's start. Measured off
   the ElevenLabs clips by forced alignment (pocketsphinx), 12 Oct 2026, so
   what the screen does lands on the word rather than on a guess. Keyed by
   the line as VOICE keys it (lower case). A line that is not here, or a
   re-recorded clip, falls back to cueMs()'s estimate from the text — so
   re-measure a line here if its clip is replaced.
     words   the number name has been said (the order shows on the glass)
     dials   "Set the dials"      load   "press LOAD"
     ONES… LAKH   the place's name is said, in a list of places */
var VOICE_CUES = {
  /* 21 Oct 2026: THE ORDER TYPES ON AS IT IS SAID. Measured off every order
     clip (pocketsphinx forced alignment): `from` is where the number name
     starts, `words` where it ends; the glass types the words across that
     span, so the text keeps pace with Rill's voice. */
  'load three thousand two hundred forty-four.': { from: 480, words: 2340 },
  'load seven thousand six hundred twenty-four.': { from: 290, words: 2470 },
  'load nine thousand fifty.': { from: 350, words: 1530 },
  'load five thousand six.': { from: 320, words: 1540 },
  'load six thousand.': { from: 400, words: 1190 },
  'load forty-five thousand six hundred seventy-eight.': { from: 550, words: 2860 },
  'load forty-two thousand nine hundred thirty.': { from: 290, words: 2440 },
  'load ten thousand eight hundred fifty-four.': { from: 450, words: 2360 },
  'load sixty-two thousand.': { from: 320, words: 1560 },
  'load twenty thousand seven hundred six.': { from: 520, words: 2390 },
  'load thirteen thousand six hundred fifty-three.': { from: 350, words: 2430 },
  'load five lakh eight thousand seven hundred sixty.': { from: 350, words: 2920 },
  'load one lakh four hundred.': { from: 310, words: 1440 },
  'load four lakh nine.': { from: 420, words: 1430 },
  'load seven lakh twenty thousand sixty-five.': { from: 290, words: 2510 },
  'load four thousand two hundred seventy-five. set the dials, then press load.':
    { from: 300, words: 2300, dials: 2950, load: 4170 },
  'load thirty-eight thousand four hundred twenty-seven. set the dials, then press load.':
    { from: 320, words: 2790, dials: 3170, load: 4540 },
  'load two lakh sixty-four thousand three hundred fifteen. set the dials, then press load.':
    { from: 550, words: 3310, dials: 3820, load: 5290 },
  /* the extend lines: when the new place's name is said (speech-to-text),
     so the module slides in and the bot lands on it on that word */
  'this station is farther — we need a new place. left of thousands comes the ten-thousands, ten times bigger. ten thousand.':
    { land: 6230 },   /* re-cut 21 Oct 2026 ('farther' re-recorded): "ten" starts at 6.28 s */
  'the last station is very far — one more place. left of ten-thousands comes the lakh. ten ten-thousands make one lakh — a lakh, one-oh-oh-oh-oh-oh.':
    { land: 6240 },
  'same digit, new place, new value — in 4347, this 4 is four thousand and this 4 is forty.':
    /* the new tutorial's example (16 Oct 2026), off ElevenLabs speech-to-text:
       "in 4347" 2.9 s, "four thousand" 6.8 s, "forty" 9.16 s */
    { roll: 2900, seq: [6400, 8750] },
  'try writing a number in the place value chart: seven thousand five hundred fifty-four.':
    /* the number itself starts after the pause at 3.19 s */
    { words: 3190 }
};
/* the measured run of cue times for a line, or null */
function cueSeq(text) {
  var k = String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  var c = VOICE_CUES[k];
  return c && c.seq ? c.seq : null;
}
/* the cue's time: measured if it is in VOICE_CUES, otherwise estimated from
   where `phrase` sits in the text (start of it, or its end with atEnd) over
   the clip's length — or the typing speed, with no clip */
function cueMs(text, name, phrase, atEnd) {
  var k = String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  var c = VOICE_CUES[k];
  if (c && typeof c[name] === 'number') return c[name];
  var len = VOICE.ms(text) || k.length * 38;
  var at = phrase ? k.indexOf(String(phrase).toLowerCase()) : -1;
  if (at < 0) return atEnd ? len : 0;
  return (at + (atEnd ? phrase.length : 0)) / Math.max(1, k.length) * len;
}

/* ########################################################################## */
/*  FX.JS                                                                   */
/* ########################################################################## */

/* ============================================================================
   FX.JS — the little storybook moments shared by every screen: numbers that
   pop up and float away, confetti and a camera shake. Everything is Web Animations on plain elements, so
   PAUSE.JS stops it with the rest and nothing needs its own loop.
   ========================================================================= */
var FX = (function () {
  var stage = document.getElementById('stage');
  var COLORS = ['#2fd8ff', '#ffd166', '#ff7b54', '#7cf29a', '#ffffff', '#b692ff'];
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rectIn(el) {
    var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - s.left) / s.width * 100, y: (r.top - s.top) / s.height * 100,
             w: r.width / s.width * 100, h: r.height / s.height * 100 };
  }

  /* A NUMBER POPS OUT above an element and floats up and away:
     "4,000" over the thousands column, "+1" over a lamp. */
  function pop(text, el, o) {
    o = o || {};
    var r = rectIn(el);
    var d = document.createElement('div');
    d.className = 'fx-pop' + (o.big ? ' big' : '') + (o.tone ? ' ' + o.tone : '');
    d.textContent = text;
    d.style.left = (r.x + r.w / 2) + '%';
    d.style.top = (r.y + (o.dy || 0)) + '%';
    stage.appendChild(d);
    var rise = o.rise == null ? 9 : o.rise;
    var a = d.animate([
      { transform: 'translate(-50%, 0) scale(0.2)', opacity: 0 },
      { transform: 'translate(-50%, -30%) scale(1.25)', opacity: 1, offset: 0.18 },
      { transform: 'translate(-50%, -40%) scale(1)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%, -' + (40 + rise * 20) + '%) scale(1)', opacity: 1, offset: 0.78 },
      { transform: 'translate(-50%, -' + (40 + rise * 26) + '%) scale(0.9)', opacity: 0 }
    ], { duration: o.ms || 1900, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', delay: o.delay || 0, fill: 'both' });
    a.onfinish = function () { d.remove(); };
    return d;
  }

  /* CONFETTI from a point, or across the top when there is none */
  function confetti(n, el) {
    if (REDUCED) return;
    var r = el ? rectIn(el) : { x: 0, y: -4, w: 100, h: 0 };
    for (var i = 0; i < (n || 60); i++) {
      var c = document.createElement('i');
      c.className = 'fx-conf';
      c.style.background = COLORS[i % COLORS.length];
      var x0 = r.x + Math.random() * r.w, y0 = r.y + Math.random() * r.h;
      c.style.left = x0 + '%'; c.style.top = y0 + '%';
      if (i % 3 === 0) c.style.borderRadius = '50%';
      stage.appendChild(c);
      var dx = (Math.random() - 0.5) * (el ? 60 : 20), up = el ? 20 + Math.random() * 25 : 0;
      var fall = 60 + Math.random() * 50, spin = (Math.random() - 0.5) * 1440;
      var w = stage.clientWidth / 100, h = stage.clientHeight / 100;
      var a = c.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx * 0.6 * w + 'px,' + (-up) * h + 'px) rotate(' + spin * 0.4 + 'deg)', opacity: 1, offset: 0.3 },
        { transform: 'translate(' + dx * w + 'px,' + (fall - up) * h + 'px) rotate(' + spin + 'deg)', opacity: 0 }
      ], { duration: 1800 + Math.random() * 1400, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', delay: Math.random() * 250, fill: 'both' });
      a.onfinish = (function (c) { return function () { c.remove(); }; })(c);
    }
  }

  /* A CAMERA SHAKE — a launch, a stamp. Strength is in % of the element. */
  function shake(el, k, ms) {
    if (REDUCED || !el) return;
    k = k || 0.6;
    var f = [];
    for (var i = 0; i <= 8; i++) {
      var d = k * (1 - i / 8);
      f.push({ transform: i === 8 ? 'translate(0,0)' :
        'translate(' + ((i % 2 ? 1 : -1) * d) + '%,' + ((i % 3 ? -1 : 1) * d * 0.7) + '%)' });
    }
    el.animate(f, { duration: ms || 480, easing: 'linear' });
  }

  return { pop: pop, confetti: confetti, shake: shake };
})();
window.FX = FX;

/* ########################################################################## */
/*  SPRITE.JS                                                               */
/* ########################################################################## */

/* ============================================================================
   SPRITE.JS — a character who talks in frames: Veth on intro screen 5, Nova
   in the corner of every delivery flight. Each is a 6x6 sheet of them
   speaking and gesturing.

     sheet  { src, box, cols, rows, fps, from, to, rest }
       box   the union of every frame's opaque bounds, as a % of ONE frame, so
             the figure never shifts as the frames change
       from, to   the frames the talking runs between, forward and back —
             chosen so it never crosses a rough join in the sheet
       rest  closed-mouth frames; rest[0] is where they start

   While `talking()` says so, the frames run; when it stops, the figure
   steps (twice as fast) to the nearest rest frame and holds — no snap back.
   The loop only runs while there is something to animate, and PAUSE.JS
   holds it with everything else when the player is away.
   ========================================================================= */
var SPRITE = (function () {
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the frame is chosen by background-position, worked out so that the same
     part of every frame (the `box`) fills the element: for column c, the
     image's x position is (c + box.x) over (cols - box.w), as a % */
  function size(fig, s) {
    fig.style.backgroundImage = 'url("' + ASSET(s.src) + '")';
    fig.style.backgroundRepeat = 'no-repeat';
    fig.style.backgroundSize = (s.cols * 100 / s.box.w * 100).toFixed(3) + '% ' +
                               (s.rows * 100 / s.box.h * 100).toFixed(3) + '%';
  }
  function show(fig, s, n) {
    var col = n % s.cols, row = Math.floor(n / s.cols), b = s.box;
    fig.style.backgroundPosition =
      ((col + b.x / 100) / (s.cols - b.w / 100) * 100).toFixed(4) + '% ' +
      ((row + b.y / 100) / (s.rows - b.h / 100) * 100).toFixed(4) + '%';
  }
  /* the rest frame nearest to n, and so where to settle */
  function nearestRest(s, n) {
    return s.rest.reduce(function (best, r) {
      return Math.abs(r - n) < Math.abs(best - n) ? r : best;
    }, s.rest[0]);
  }

  function player(fig, s, talking) {
    var st = { frame: s.rest[0], dir: 1, raf: 0, t: 0 };
    function step(now) {
      st.raf = 0;
      if (!fig.isConnected) return;
      var said = talking(), talk = said === true, hold = said === 'hold';
      var atRest = s.rest.indexOf(st.frame) >= 0;
      if (!talk && atRest) {
        if (!hold) return;                                       // at rest
        st.raf = requestAnimationFrame(step);                    // a pause mid-line:
        return;                                                  // keep watching
      }
      if (now - st.t >= 1000 / s.fps / (talk ? 1 : 2)) {
        st.t = now;
        if (talk) {
          var nx = st.frame + st.dir;
          if (nx > s.to || nx < s.from) { st.dir = -st.dir; nx = st.frame + st.dir; }
          st.frame = nx;
        } else {
          st.frame += nearestRest(s, st.frame) > st.frame ? 1 : -1;
        }
        show(fig, s, st.frame);
      }
      st.raf = requestAnimationFrame(step);
    }
    var p = {
      /* back to the start: the sheet on, the first rest frame showing */
      reset: function () {
        if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
        st.frame = s.rest[0]; st.dir = 1;
        size(fig, s); show(fig, s, st.frame);
      },
      /* start the frames, or the settling, if they are not already going */
      kick: function () { if (!st.raf && !REDUCED) st.raf = requestAnimationFrame(step); },
      /* let go of the element: nothing more is drawn on it (the dialogue
         portrait does this when another speaker, with a still face, takes it) */
      stop: function () { if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } },
      frame: function () { return st.frame; }
    };
    p.reset();
    return p;
  }

  return { player: player };
})();

/* ########################################################################## */
/*  DIALOG.JS                                                               */
/* ########################################################################## */

/* ============================================================================
   DIALOG.JS — the characters' dialogue box.

   Only Veth, Rill and Nova get one. The narrator is heard and never shown.
   A portrait, a name plate in the speaker's colour, and the line typed out
   in step with the voice, with a small sound-wave while it plays.

     DIALOG.say(who, text, { pos: 'top' | 'bottom', ms: voice length })
     DIALOG.hide()
   ========================================================================= */
var DIALOG = (function () {
  var stage = document.getElementById('stage');
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* NUMBER POPULATION: Rill plays the storyboard's Officer; the team member
     and the control-centre computer speak too (names in locales.json) */
  var NAMES = { veth: 'COMMANDER VETH', rill: i18n('names.rill'), nova: 'NOVA',
                team: i18n('names.team'), computer: i18n('names.computer'),
                narrator: i18n('names.narrator') };
  /* the two with no artwork get a drawn face */
  var DRAWN = {
    narrator: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a1f3d"/>' +
          '<rect x="25" y="12" width="14" height="24" rx="7" fill="#d9c7ff"/>' +
          '<path d="M19 30 Q19 44 32 44 Q45 44 45 30" fill="none" stroke="#d9c7ff" stroke-width="3"/>' +
          '<rect x="30" y="44" width="4" height="8" fill="#d9c7ff"/><rect x="22" y="51" width="20" height="4" rx="2" fill="#d9c7ff"/></svg>',
    team: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1d3a5c"/>' +
          '<circle cx="32" cy="26" r="12" fill="#f2c39a"/><path d="M20 22 Q32 6 44 22 Q40 14 32 14 Q24 14 20 22Z" fill="#3b2a20"/>' +
          '<path d="M12 64 Q14 42 32 42 Q50 42 52 64Z" fill="#2fd8ff"/>' +
          '<path d="M19 26 Q19 12 32 12 Q45 12 45 26" fill="none" stroke="#0b1420" stroke-width="2.5"/>' +
          '<rect x="16" y="24" width="5" height="9" rx="2" fill="#0b1420"/><rect x="43" y="24" width="5" height="9" rx="2" fill="#0b1420"/>' +
          '<path d="M45 31 Q44 37 38 37" fill="none" stroke="#0b1420" stroke-width="2"/></svg>',
    computer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#10202e"/>' +
          '<rect x="10" y="14" width="44" height="30" rx="4" fill="#0b1420" stroke="#7cf29a" stroke-width="2.5"/>' +
          '<circle cx="24" cy="27" r="3.5" fill="#7cf29a"/><circle cx="40" cy="27" r="3.5" fill="#7cf29a"/>' +
          '<path d="M24 35 Q32 40 40 35" fill="none" stroke="#7cf29a" stroke-width="2.5" stroke-linecap="round"/>' +
          '<rect x="27" y="44" width="10" height="6" fill="#3a4b5c"/><rect x="18" y="50" width="28" height="4" rx="2" fill="#3a4b5c"/></svg>'
  };
  var box = null, face, name, text, wave, raf = null, hideT = null, cur = '';

  /* A SPEAKER WHO TALKS IN FRAMES (Rill) talks in the portrait too: their
     sheet, cropped to head and shoulders and scaled to the circle, running
     while the box is 'speaking' — the length of the voice — and settling to
     a closed mouth after. `box` here is that crop, a square in pixels, as a
     % of one frame; the frames, speed and rest frames are the cast's own. */
  var FACES = {
    rill: faceSheet('rill', { x: 25, y: 0.5, w: 50, h: 29.86 }),   // 252x252 of 504x844
    /* 19 Oct 2026 (Anmol): NOVA TALKS IN THE PORTRAIT TOO, off the same 6x6
       sheet she talks in during the flight (504x830 a frame); the crop is a
       290px square round her head */
    nova: { src: ART + 'nova talking.webp', cols: 6, rows: 6, fps: 12, from: 0, to: 35,
            rest: [5, 9, 12, 17, 18, 30, 31],
            box: { x: 16.5, y: 0.5, w: 57.54, h: 34.94 } }
  };
  function faceSheet(id, crop) {
    var c = CAST[id], s = {};
    Object.keys(c.sprite).forEach(function (k) { s[k] = c.sprite[k]; });
    s.src = c.src; s.box = crop;
    return s;
  }
  var facePlayer = null, faceWho = '';
  function portrait(who) {
    var fs = FACES[who];
    if (fs) {
      if (faceWho !== who) {
        if (facePlayer) facePlayer.stop();
        facePlayer = SPRITE.player(face, fs, function () {
          return mouthState(cur === who && box.classList.contains('speaking'));
        });
        faceWho = who;
      }
      return;
    }
    /* a still face: whoever had the frames lets go of the circle first */
    if (facePlayer) { facePlayer.stop(); facePlayer = null; faceWho = ''; }
    face.style.backgroundSize = '';
    face.style.backgroundPosition = '';
    face.style.backgroundRepeat = '';
    face.style.backgroundImage = DRAWN[who]
      ? 'url("data:image/svg+xml,' + encodeURIComponent(DRAWN[who]) + '")'
      : 'url("' + ASSET('assets/portraits/' + who + '.webp') + '")';
  }

  function build() {
    box = document.createElement('div');
    box.id = 'dialog';
    box.innerHTML =
      '<div class="dl-card">' +
        '<i class="dl-face"></i>' +
        '<div class="dl-body">' +
          '<div class="dl-name"></div>' +
          '<p class="dl-text"></p>' +
          '<p class="dl-text dl-sizer" aria-hidden="true"></p>' +
        '</div>' +
        '<span class="dl-wave"><i></i><i></i><i></i><i></i></span>' +
      '</div>';
    stage.appendChild(box);
    face = box.querySelector('.dl-face');
    name = box.querySelector('.dl-name');
    text = box.querySelector('.dl-text');
    wave = box.querySelector('.dl-wave');
  }

  function say(who, line, o) {
    o = o || {};
    if (!NAMES[who] || !line) return hide();
    if (!box) build();
    clearTimeout(hideT);
    if (raf) cancelAnimationFrame(raf);
    var fresh = !box.classList.contains('on') || cur !== who;
    cur = who;
    box.className = 'on ' + who + ' ' + (o.pos === 'bottom' ? 'bottom' : 'top');
    portrait(who);
    name.textContent = NAMES[who];
    box.querySelector('.dl-sizer').textContent = line;
    if (fresh && !REDUCED) {
      box.querySelector('.dl-card').animate([
        { transform: 'translateY(' + (o.pos === 'bottom' ? '30%' : '-30%') + ') scale(0.92)', opacity: 0 },
        { transform: 'translateY(0) scale(1.02)', opacity: 1, offset: 0.7 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ], { duration: 460, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' });
      face.animate([{ transform: 'scale(0.6) rotate(-10deg)' }, { transform: 'scale(1.08) rotate(3deg)', offset: 0.7 }, { transform: 'none' }],
                   { duration: 520, easing: 'ease-out' });
    }
    /* typed in step with the voice: the last letter lands as the voice ends */
    var ms = Math.max(600, (o.ms || line.length * 38) * 0.92), t0 = performance.now();
    box.classList.add('speaking');
    if (REDUCED) { text.textContent = line; }
    else (function step(t) {
      /* with a voice, the words follow its playhead (finishing a little
         before it does); with none, an even pace (QA Bug 19) */
      var p = VOICE.progress(line);
      var f = p >= 0 ? Math.min(1, p / 0.92) : (t - t0) / ms;
      var k = Math.min(line.length, Math.ceil(f * line.length));
      if (text.textContent.length !== k) text.textContent = line.slice(0, k);
      if (k < line.length) raf = requestAnimationFrame(step); else raf = null;
    })(t0);
    hideT = setTimeout(function () { box.classList.remove('speaking'); }, o.ms || ms);
    if (facePlayer && faceWho === who) facePlayer.kick();
  }

  function hide() {
    if (!box) return;
    if (raf) cancelAnimationFrame(raf); raf = null;
    clearTimeout(hideT);
    box.classList.remove('on', 'speaking');
    cur = '';
  }
  return { say: say, hide: hide };
})();
window.DIALOG = DIALOG;

/* ########################################################################## */
/*  SWIPE.JS — the scroll tutorial                                          */
/* ########################################################################## */

/* ============================================================================
   SWIPE.JS — there are no arrow buttons: a digit is changed by SCROLLING it,
   a drag up or down (or the mouse wheel). The first time it matters — the
   first Try of the level-1 lesson and the first run of level 1, L1.1 — a
   hand shows the move on the first dial, up and down, until the child
   touches any digit.

   AND THE DIAL ANSWERS IT. Handed the drum it is pointing at, the hint turns
   it one number up as the hand swipes up and back down as it swipes down —
   0, 1, 0 — so the child sees what the move does, not just the move. Those
   turns are silent and are not the child's: any touch puts the digit back
   first, so a demo turn can never be read as an answer.
   ========================================================================= */
var SWIPE = (function () {
  var stage = document.getElementById('stage');
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hand = null, anims = [], target = null, done = false;
  /* the hand's stroke is CYCLE ms; the drum turns up at UP of the way
     through it (as the hand reaches the top) and back at DOWN (on its way
     back down). Read off the hand's own animation clock every frame, so the
     two never drift — not even across a pause. */
  var CYCLE = 2200, UP = 0.32, DOWN = 0.7;
  var drum = null, net = 0, raf = 0, lastPhase = 0;

  function turn(dir) {
    if (!drum) return;
    var was = drum.interactive;
    drum.interactive = false;              // the drum clicks only for the child
    drum.roll(dir);
    drum.interactive = was;
    net += dir;
  }
  /* back to the digit it had before the demo touched it */
  function settle() { if (net) turn(-net); }
  function follow() {
    raf = 0;
    if (!hand || !anims[0]) return;
    var ph = ((anims[0].currentTime || 0) % CYCLE) / CYCLE;
    if (lastPhase < UP && ph >= UP) turn(1);
    if (lastPhase < DOWN && ph >= DOWN) turn(-1);
    lastPhase = ph;
    raf = requestAnimationFrame(follow);
  }
  /* THE HAND NUDGE (16 Oct 2026, Anmol): the 3D pointing hand, one picture
     for every hand in the game — the dial swipe, the lesson's pointer and the
     tap cue. Built when it is shown, so it picks up the preloaded copy. Its
     fingertip is 73% of the way across the picture, at the very top. */
  var HAND_SRC = ART_G + 'hand.webp';
  function handHtml() {
    return '<img class="hand-img" src="' + ASSET(HAND_SRC) + '" alt="" draggable="false">';
  }

  function rectIn(el) {
    var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - s.left) / s.width * 100, y: (r.top - s.top) / s.height * 100,
             w: r.width / s.width * 100, h: r.height / s.height * 100 };
  }
  function stop(e) {
    if (!hand) return;
    /* any touch at all puts the demo's digit back before it lands */
    settle();
    if (e && target && !(e.target.closest && e.target.closest('.window, .tc-screen, .tc-well'))) return;
    hide();
  }
  /* el: what to point at; d: the drum behind it, if it should turn */
  function show(el, d) {
    if (!el) return;
    hide();
    target = el;
    drum = d || null; net = 0; lastPhase = 0;
    var r = rectIn(el);
    hand = document.createElement('div');
    hand.id = 'swipe';
    hand.innerHTML = '<i class="sw-track"><b>▲</b><b>▼</b></i><span class="sw-hand">' + handHtml() + '</span>';
    hand.style.left = r.x + '%'; hand.style.top = r.y + '%';
    hand.style.width = r.w + '%'; hand.style.height = r.h + '%';
    stage.appendChild(hand);
    var h = hand.querySelector('.sw-hand');
    if (!REDUCED) anims = [
      h.animate([
        { transform: 'translate(-43%, 55%)', opacity: 0 },
        { transform: 'translate(-43%, 45%)', opacity: 1, offset: 0.12 },
        { transform: 'translate(-43%, -25%)', opacity: 1, offset: 0.42 },
        { transform: 'translate(-43%, -25%)', opacity: 1, offset: 0.5 },
        { transform: 'translate(-43%, 45%)', opacity: 1, offset: 0.82 },
        { transform: 'translate(-43%, 55%)', opacity: 0 }
      ], { duration: CYCLE, iterations: Infinity, easing: 'ease-in-out' })
    ];
    if (anims.length && drum) raf = requestAnimationFrame(follow);
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('wheel', stop, true);
  }
  function hide() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    settle();
    drum = null;
    anims.forEach(function (a) { a.cancel(); }); anims = [];
    if (hand && hand.parentNode) hand.parentNode.removeChild(hand);
    hand = null; target = null;
    document.removeEventListener('pointerdown', stop, true);
    document.removeEventListener('wheel', stop, true);
  }
  return { show: show, hide: hide, on: function () { return !!hand; }, hand: handHtml };
})();
window.SWIPE = SWIPE;

/* ########################################################################## */
/*  RUNS.JS                                                                 */
/* ########################################################################## */

/* ============================================================================
   RUNS.JS — Level 1's demo and runs, and the copy every level shares.

   Rock Post, four digits. The cargo is MEDICINE CRATES on every run of every
   level: this is one mission, not a shopping list, and the manifest says so.

   EACH ENTRY
     id      the storyboard's own id — L1.1, L1.2 …
     demo    true on the screen that opens the level. No scoring, no target;
             Rill demonstrates, and the level moves on by itself.
     dest    where the fuel is going.
     target  the figure, and the kilometres — they are the same number.
     words   how Rill says it. This IS the puzzle: he hears words and places
             digits.
     cargo   what is aboard. MEDICINE CRATES, always.
     hint    RUNG 2, verbatim from the storyboard. Every hint uses the arrow
             glyph → and names the place and the digit for each spoken group.
     idle    what she says if nothing is touched for a while.

   THERE IS NO `win` FIELD. The correct-feedback line is one sentence plus a
   second that appears only when the figure contains a zero — eleven of the
   eighteen runs. Writing it out eleven times is eleven chances to get it
   wrong, so winLine() in console.js derives it from the target instead.

   NO CALIBRATION RUNS AND NO SPLIT RUNS. The bench test is replaced by the
   demo screen; the split run is gone. console.js no longer references either.
   ========================================================================= */

const RUNS = [

  {
    id: 'L1.1', dest: i18n('levels.level1.dest'), target: 4275,
    words: i18n('runs.L1_1.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L1.2', dest: i18n('levels.level1.dest'), target: 3244,
    words: i18n('runs.L1_2.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L1.3', dest: i18n('levels.level1.dest'), target: 7624,
    words: i18n('runs.L1_3.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L1.4', dest: i18n('levels.level1.dest'), target: 9050,
    words: i18n('runs.L1_4.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L1.5', dest: i18n('levels.level1.dest'), target: 5006,
    words: i18n('runs.L1_5.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L1.6', dest: i18n('levels.level1.dest'), target: 6000,
    words: i18n('runs.L1_6.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  }

];


/* ---------------------------------------------------------------------------
   WHAT RILL SAYS — the same wording in every level.
   {dest} the destination, {words} the figure spoken, {figure} the figure with
   its separators, {chain} the digits one per place.
   ------------------------------------------------------------------------ */

/* THE NARRATOR, on the panel with no portrait, just before the first order of
   a level. {place} is the level's name. */
const NARRATOR_LINE = i18n('lines.narrator');

/* the order, said when a run starts and again whenever the screen is tapped */
const ORDER_LINE = i18n('lines.order');
/* "Set the dials, then press LOAD" only on each level's first load */
const ORDER_SHORT = i18n('lines.orderShort');

/* CORRECT. The second sentence is added by winLine() when — and only when —
   the figure has a zero in it. It is the whole point of those eleven runs, so
   it is said on all eleven and on none of the others. */
const WIN_LINE = i18n('lines.win');
const WIN_ZERO = i18n('lines.winZero');
/* a different short praise after each load (no number, no repeat), and the
   empty-places line only the first time a level needs it */
const WIN_POOL = i18n('lines.winPool');

/* THE LADDER — three rungs.
     1  this line, a red glow and a wiggle on the dials
     2  "Listen carefully." and the order again (sayListen)
     3  the answer is shown on the dials, and a pointer at the first wrong dial */
const WRONG_1 = i18n('lines.wrong1');

/* Inactivity. Every run carries its own copy in `idle`; this is the fallback
   for anything that has none. The timer is reset by any touch of any control. */
const IDLE_LINE = i18n('lines.idle');

const DONE_LINE = i18n('lines.done');


/* the instruction panel's own label for the order it is carrying. It is on
   the PANEL, not on the comms glass: the glass shows the figure in words and
   nothing else at all. */
const ORDER_LABEL = i18n('ui.order');


/* ########################################################################## */
/*  RUNS2.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   RUNS2.JS — Level 2's demo and runs. Lake Station, five digits.

   Same shape as RUNS. What is new is the place on the left: a fifth dial, and
   with it the first number a child has to hear as TWO places at once —
   "thirty-eight thousand" is not one word's worth of dial.

   L2.0 IS WHERE THE DIAL ARRIVES. The bay opens as Rill names the place, so
   the plate coming off and the dial sliding in are one move rather than a
   transition that happens and then an explanation of what happened.
   ========================================================================= */

const RUNS2 = [

  {
    id: 'L2.0',
    demo: true,
    show: 'dial',
    dest: i18n('levels.level2.dest'),
    cargo: 'MEDICINE CRATES',
    say: i18n('runs.L2_0.say')
  },

  {
    id: 'L2.1', dest: i18n('levels.level2.dest'), target: 38427,
    words: i18n('runs.L2_1.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L2.2', dest: i18n('levels.level2.dest'), target: 45678,
    words: i18n('runs.L2_2.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L2.3', dest: i18n('levels.level2.dest'), target: 42930,
    words: i18n('runs.L2_3.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L2.4', dest: i18n('levels.level2.dest'), target: 10854,
    words: i18n('runs.L2_4.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L2.5', dest: i18n('levels.level2.dest'), target: 62000,
    words: i18n('runs.L2_5.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L2.6', dest: i18n('levels.level2.dest'), target: 20706,
    words: i18n('runs.L2_6.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  }

];

/* ---------------------------------------------------------------------------
   LEVEL 2's OPENING BRIEF. She is not re-explaining the console by now, only
   the place that has appeared on the left of it.
   ------------------------------------------------------------------------ */
const BRIEF_2 = i18n('levels.level2.brief');

/* said once, as the bay opens on the demo screen */
const REVEAL_2 = i18n('levels.level2.reveal');

/* ########################################################################## */
/*  RUNS3.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   RUNS3.JS — Level 3's demo and runs. Titan City, six digits and the lakh.

   THE LAKH. The sixth place is a lakh, and one lakh is ten ten-thousands.
   L3.0 is where that dial arrives, and where the readout visibly re-groups to
   Indian commas — 1,00,000 rather than 100,000 — as it lands. The comma
   moving is the sign of the new place, and a child notices it before they can
   name it, so it is a beat they watch rather than a silent reformat.

   L3.2 IS FIVE DIGITS ON PURPOSE. Thirteen thousand six hundred fifty-three
   has no lakh in it, so the lakh dial stays at 0 and its hint says so. It is
   not a data error and it must not be padded up to six spoken digits: a place
   that is there and empty is exactly what this level is about.

   L3.5 IS THE EXTREME CASE. "Four lakh nine" is four zeros between two digits,
   which is the hardest thing in the game to hold in your head and the whole
   argument for place value in one line.
   ========================================================================= */

const RUNS3 = [

  {
    id: 'L3.0',
    demo: true,
    show: 'dial',
    regroup: true,
    dest: i18n('levels.level3.dest'),
    cargo: 'MEDICINE CRATES',
    say: i18n('runs.L3_0.say')
  },

  {
    id: 'L3.1', dest: i18n('levels.level3.dest'), target: 264315,
    words: i18n('runs.L3_1.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L3.2', dest: i18n('levels.level3.dest'), target: 13653,
    words: i18n('runs.L3_2.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L3.3', dest: i18n('levels.level3.dest'), target: 508760,
    words: i18n('runs.L3_3.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L3.4', dest: i18n('levels.level3.dest'), target: 100400,
    words: i18n('runs.L3_4.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L3.5', dest: i18n('levels.level3.dest'), target: 400009,
    words: i18n('runs.L3_5.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  },

  {
    id: 'L3.6', dest: i18n('levels.level3.dest'), target: 720065,
    words: i18n('runs.L3_6.words'),
    cargo: 'MEDICINE CRATES',
    idle: i18n('lines.idle')
  }

];

/* ---------------------------------------------------------------------------
   LEVEL 3's OPENING BRIEF — the place, the name, and the comma.
   ------------------------------------------------------------------------ */
const BRIEF_3 = i18n('levels.level3.brief');

/* said once, as the sixth bay opens on the demo screen */
const REVEAL_3 = i18n('levels.level3.reveal');

/* ########################################################################## */
/*  LEVELS.JS                                                               */
/* ########################################################################## */

/* ============================================================================
   LEVELS.JS — the level registry.

   One entry per level. Everything that changes between levels lives here, and
   `places` is the spine: the number of dials, the place names on the label
   plates, the gauge maximum, the zero-padding the ladder uses and which of the
   console's six bays are live are all derived from its length. NOTHING in
   console.js counts dials by hand — there is no literal 4, 5 or 6 anywhere in
   the engine, which is the only reason three levels can share it.

   The console always has SIX bays. A level occupies the RIGHTMOST
   places.length of them and leaves the rest sealed, so level 2 unbolts one
   cover plate and level 3 unbolts the next without the faceplate being rebuilt.
   That unbolting IS the transition between levels — see transition.js.

   Loaded after runs.js, runs2.js and runs3.js so it can reference them.
   ========================================================================= */

/* ---------------------------------------------------------------------------
   LEVEL 1's OPENING BRIEF — she speaks to camera: Nova is the player, so there
   is no second character on screen. Levels 2 and 3 carry their own, shorter,
   in runs2.js and runs3.js: she is not re-explaining the console by then, only
   the place that has appeared on the left of it.
   ------------------------------------------------------------------------ */
const BRIEF_LINES = i18n('levels.level1.brief');

const LEVELS = [

  {
    id: 1,
    name: i18n('levels.level1.name'),
    mission: i18n('levels.level1.mission'),
    narrate: true,
    places: ['THOUSANDS', 'HUNDREDS', 'TENS', 'ONES'],
    runs: RUNS,
    dest: i18n('levels.level1.dest'),
    /* which settlement the delivery flight flies to when the level is done.
       It is the LOCATIONS id from config.js, not the display name. */
    locId: 'rockpost',

    briefLines: BRIEF_LINES,
    /* which brief line names the places, and so lights the label plates */
    plateLine: 1,
    /* THE SPOTLIGHT: on these brief lines one part of the console stays lit
       and everything else but Rill and his words goes dark. 'dials' is the
       row of dials (the number you set), 'load' is the LOAD lever. */
    briefFocus: { 1: 'dials', 2: 'dials', 3: 'load' },
    brief: BRIEF
  },

  {
    id: 2,
    name: i18n('levels.level2.name'),
    mission: i18n('levels.level2.mission'),
    places: ['TEN-THOUSANDS', 'THOUSANDS', 'HUNDREDS', 'TENS', 'ONES'],
    runs: RUNS2,
    dest: i18n('levels.level2.dest'),
    locId: 'lakestation',
    briefLines: BRIEF_2,
    plateLine: 2,
    revealLine: REVEAL_2,
    brief: BRIEF
  },

  {
    id: 3,
    name: i18n('levels.level3.name'),
    mission: i18n('levels.level3.mission'),
    places: ['LAKH', 'TEN-THOUSANDS', 'THOUSANDS', 'HUNDREDS', 'TENS', 'ONES'],
    runs: RUNS3,
    dest: i18n('levels.level3.dest'),
    locId: 'titancity',
    briefLines: BRIEF_3,
    plateLine: 2,
    revealLine: REVEAL_3,
    /* LEVEL 3 HAS NO TEACHING SCREEN — the lakh was taught on level 2's chart.
       It is named again here as the thing this level runs on, and this is the
       brief line the console lights the lakh column on. Zero-based. */
    lakhLine: 2,
    /* no cover plate over the lakh bay: it is open from the start of the
       level, and the demo only names it */
    coverPlate: false,
    brief: BRIEF
  },

  /* NUMBER POPULATION (22 Oct 2026): the crore stage. Only the lesson chart
     is played - no console, no runs. Its eight places are the widest row,
     so the chart is laid out in eight slots. */
  {
    id: 4,
    name: i18n('levels.level4.name'),
    places: ['CRORE', 'TEN-LAKHS', 'LAKH', 'TEN-THOUSANDS', 'THOUSANDS', 'HUNDREDS', 'TENS', 'ONES'],
    runs: []
  }

];
/* the one level this game plays */
var NP_LEVEL = 4;

/* ########################################################################## */
/*  CONSOLE.JS                                                              */
/* ########################################################################## */

/* ============================================================================
   CONSOLE.JS — Level 1. The fuel console.

   WHAT CAME ACROSS FROM archive/fuel-v1, UNCHANGED:
     - the drum: the digit strip, the roll timing and easing, the short-route
       wrap, the silent re-base, the drag and the wheel. Weeks of fixes.
     - the wide/close camera push-in: both layers travel the same way so it
       reads as one camera move rather than two pictures swapping.
     - sfx.js in full, and the stage handling in style.css.

   WHAT DID NOT:
     - every coordinate. The art is new and was measured fresh into config.js.
     - the corner-quad homography. The new render is straight-on, so every
       overlay is a plain axis-aligned rectangle. Deleting that layer is the
       whole point of the new art.
     - all old copy and run data.

   NOTHING FLOATS OVER THE ART. Every readout is placed on a feature that
   exists in the render — the blank label plates, the recessed gauge channel,
   the dark screen, the manifest slot, the lamp housings, the blue band where
   LOAD is engraved.

   NO LITERAL DIGIT COUNT ANYWHERE. The dial count, the place names, the gauge
   top and the zero-padding all come from the level's `places`, because Levels
   2 and 3 add a dial by unbolting a cover plate.
   ========================================================================= */

(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- level state ----------------------------------------------------- */
  var L = null;                 // the LEVELS entry in play
  var runIndex = 0, run = null;
  var digits = [];              // one per live place, most significant first
  var wrongCount = 0;
  var levelWrong = 0;           // every wrong LOAD this level, for the end screen
  var view = 'wide';            // 'wide' | 'close'
  var busy = false;             // a camera move or a launch owns the console
  var armed = false;            // input accepted at all (false during the brief)
  var focusIdx = -1;
  var onDone = null;
  var lamps = [], drums = { wide: [], close: [] };
  var idleTimer = null, timers = [];

  /* ---- helpers --------------------------------------------------------- */
  function el(tag, cls, host) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (host) host.appendChild(e);
    return e;
  }
  function box(e, r) {
    e.style.left = r.x + '%'; e.style.top = r.y + '%';
    e.style.width = r.w + '%'; e.style.height = r.h + '%';
  }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function N() { return L.places.length; }
  /* the render and the bay grid for the level in play. One console per level —
     see FACEPLATES in config.js for why they are not one faceplate. */
  function face() { return FACEPLATES[L.id] || FACEPLATES[1]; }
  function arrowRect(cx) {
    return { x: cx - WIDE.arrowW / 2, y: WIDE.arrowY, w: WIDE.arrowW, h: WIDE.arrowH };
  }
  /* INDIAN GROUPING, and the only place any figure in the game is formatted.
     The last three digits group together and every two after that, so 999999
     prints as 9,99,999 rather than 999,999.

     There is no per-level flag and there must not be one: below six digits the
     rule is identical to the plain style, so 4,275 and 38,420 come out exactly
     as they always did and levels 1 and 2 are untouched. The separator moving
     is the visible sign that a new place has arrived, which is why level 3's
     calibration names it out loud. */
  function commas(n) {
    var s = String(Math.abs(n)), sign = n < 0 ? '-' : '';
    if (s.length <= 3) return sign + s;
    var tail = s.slice(-3), head = s.slice(0, -3);
    return sign + head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail;
  }
  function pad(n) { var s = String(n); while (s.length < N()) s = '0' + s; return s; }
  function loaded() { return digits.reduce(function (a, d) { return a * 10 + d; }, 0); }
  /* A demo screen has no figure to reach, so its target is 0 and the gauge's
     amber marker stays down with it. */
  function target() { return (run && run.target) || 0; }
  /* LOAD IS NOT GATED. It was, on whether every dial had been touched, and
     that broke exactly the runs the level exists to teach: 2,700 leaves tens
     and ones untouched, 9,050 leaves hundreds, 5,006 leaves hundreds and tens.
     She would set the right answer and the lever would stay dark — punishing
     her for leaving a place empty, which is the correct move.
     Loading 0000 is a legitimate wrong answer, and the stops-short launch and
     the three-rung ladder say far more about it than a dead lever does. */

  /* ======================================================================= */
  /*  THE LAYER                                                              */
  /* ======================================================================= */
  var root, wideView, closeView, closeFrame, wideArt, closeArt, wideOv, closeOv;
  var wideMachine, closeMachine;
  var scrim, loadEl;
  var commsEl;
  var nudgeEl, spot;
  var panel, panelText, panelSizer, panEls = {};
  var cmEls = {};
  var bubble, bubText, bubSizer, rill;
  var briefing = true;          // which speech component is live

  function buildLayer() {
    root = document.getElementById('level');
    root.innerHTML = '';

    wideView = el('div', 'view wide', root);
    wideArt = el('img', 'art', wideView);
    wideArt.alt = ''; wideArt.draggable = false;
    wideMachine = el('img', 'machine', wideView);
    wideMachine.alt = ''; wideMachine.draggable = false;
    wideOv = el('div', 'ov', wideView);
    /* the overlay rides down with the machine (FACE_DROP), so every % in
       WIDE still lands on the same feature of the render */
    wideOv.style.transform = 'translateY(' + FACE_DROP + '%)';

    closeView = el('div', 'view close', root);
    closeView.hidden = true;
    /* the view itself carries the push-in animation, so the close-up's own
       magnification goes on an inner frame — two transforms on one element
       would fight each other every time the camera moved */
    closeFrame = el('div', 'close-frame', closeView);
    closeArt = el('img', 'art', closeFrame);
    closeArt.alt = ''; closeArt.draggable = false;
    closeMachine = el('img', 'machine', closeFrame);
    closeMachine.alt = ''; closeMachine.draggable = false;
    el('i', 'close-grain', closeFrame);
    closeOv = el('div', 'ov', closeFrame);
    closeOv.style.transform = 'translateY(' + FACE_DROP + '%)';

    scrim = el('div', 'scrim', root);
    /* the brief's spotlight: a lit window over one part of the console, with
       everything round it dark. Above the scrim, below Rill and his words. */
    spot = el('i', 'spot', root);

    /* Rill and his bubble use the intro's own classes, so they are the same
       component — same figure-box fitting, same breathing loop, same bubble
       face — without intro.js having to expose anything. */
    var cast = el('div', 'cast', root);
    rill = el('div', 'actor rill', cast);
    var fig = el('div', 'fig', rill);
    var R = BRIEF.rill;
    fig.style.backgroundImage = 'url("' + ASSET(R.src) + '")';
    fig.style.backgroundSize = (100 / R.box.w * 100).toFixed(3) + '% ' +
                               (100 / R.box.h * 100).toFixed(3) + '%';
    fig.style.backgroundPosition = (R.box.x / (100 - R.box.w) * 100).toFixed(3) + '% ' +
                                   (R.box.y / (100 - R.box.h) * 100).toFixed(3) + '%';
    rill.style.height = R.h + '%';
    rill.style.aspectRatio = (R.box.w * 16) + ' / ' + (R.box.h * 9);
    rill.style.left = R.from + '%';

    bubble = el('div', 'bubble left', cast);
    bubble.hidden = true;
    var face = el('div', 'bub-face', bubble);
    bubText = el('p', '', face);
    bubSizer = el('p', 'sizer', face);
    el('i', 'tail', bubble);

    /* THE INSTRUCTION PANEL — top centre, above everything, for the whole
       level once the brief is over. The comms glass shows the number and
       nothing else; every word Rill says arrives here, so the child never
       has to hunt for where the instruction went. Console language: dark
       glass, armour edge down the left, chamfered bottom-right, no border. */
    panel = el('div', 'panel', root);
    panel.hidden = true;
    var pf = el('div', 'panel-face', panel);
    var por = el('i', 'portrait', pf);
    /* her head and shoulders, cropped out of the same cut-out she walks in
       with — the actor's background maths, scaled up and re-centred */
    var Rl = BRIEF.rill, P = BRIEF.portrait;
    por.style.backgroundImage = 'url("' + ASSET(Rl.src) + '")';
    por.style.backgroundSize = (100 / P.w * 100).toFixed(3) + '% ' +
                               (100 / P.h * 100).toFixed(3) + '%';
    por.style.backgroundPosition = (P.x / (100 - P.w) * 100).toFixed(3) + '% ' +
                                   (P.y / (100 - P.h) * 100).toFixed(3) + '%';
    var col = el('div', 'panel-body', pf);

    /* THE PANEL CARRIES THE ORDER TOO. Pushed in, the comms glass is out of
       frame, and a panel with only her commentary on it would strand the
       player exactly as a single slot did. */
    var pord = el('button', 'panel-order', col);
    pord.type = 'button';
    pord.setAttribute('aria-label', 'Repeat the order');
    var olab = el('div', 'panel-olab', pord);
    panEls.tag = el('span', 'panel-otag', olab);
    panEls.dest = el('span', 'panel-odest', olab);
    panEls.words = el('p', 'panel-owords', pord);
    panEls.sizer = el('p', 'panel-owords panel-osizer', pord);
    panEls.sizer.setAttribute('aria-hidden', 'true');
    pord.addEventListener('click', function (e) { e.stopPropagation(); repeatOrder(); });

    /* NO NAME on the panel: the portrait is who is speaking, and until she
       arrives it is the narrator (the panel's .narrator state hides her) */
    panelText = el('p', 'panel-line', col);
    panelSizer = el('p', 'panel-line sizer', col);
  }

  /* shown whenever she has something to say, in either view */
  function panelShow(on) {
    if (!panel) return;
    if (on) {
      panel.hidden = false;
      void panel.offsetWidth;
      panel.classList.add('on');
    } else {
      panel.classList.remove('on');
      later(function () {
        if (!panel.classList.contains('on')) panel.hidden = true;
      }, 220);
    }
  }

  /* ======================================================================= */
  /*  THE DRUM — ported from the archive, unchanged                          */
  /*                                                                         */
  /*  A vertical strip of digits behind the recessed aperture. The strip is   */
  /*  DRUM.cells tall as a PERCENTAGE, so it rescales with the stage for      */
  /*  free. Position may run past 0..9 in either direction so that 9 -> 0 and */
  /*  0 -> 9 always take the short route rather than spinning back through    */
  /*  the middle.                                                            */
  /* ======================================================================= */
  var CELLS = DRUM.cells, BASE = DRUM.base;
  var CELL_PCT = 100 / CELLS;
  var SAFE_LO = -(BASE - 6), SAFE_HI = (CELLS - BASE - 7);

  function makeDrum(host, rect, interactive, index, hooks) {
    /* the console's own couplings, unless a caller brings its own */
    var H = hooks || {
      can: function () { return armed && !busy; },
      poke: poke, focus: focusDial, changed: onDigitChanged
    };
    var win = el('div', 'window', host);
    box(win, rect);
    var strip = el('div', 'strip', win);
    strip.style.height = (CELLS * 100) + '%';
    for (var i = 0; i < CELLS; i++) {
      var c = el('div', 'cell', strip);
      c.style.height = CELL_PCT + '%';
      c.textContent = String((((i - BASE) % 10) + 10) % 10);
    }
    el('div', 'curve', win);

    var d = { win: win, strip: strip, pos: 0, index: index,
              rolling: false, interactive: !!interactive };

    /* the digit always fills its aperture, whatever the stage is doing */
    d.sizeCells = function () {
      strip.style.fontSize = (win.clientHeight * 0.62) + 'px';
    };

    function apply(animate, fast) {
      var y = -(d.pos + BASE) * CELL_PCT;
      if (animate && !REDUCED) {
        strip.style.transition = 'transform ' + (fast ? 120 : DRUM.ms) + 'ms ' +
                                 (fast ? 'ease-out' : DRUM.ease);
        if (!d.rolling) { d.rolling = true; strip.classList.add('rolling'); }
      } else {
        strip.style.transition = 'none';
      }
      strip.style.transform = 'translateY(' + y + '%)';
    }
    d.apply = apply;

    /* Slide the strip back toward the middle of its cells if it has drifted.
       The move is always a whole multiple of ten cells and the strip repeats
       every ten digits, so the pixels are identical before and after — there
       is nothing to see. Returns the shift so a drag can keep its own origin
       in step. */
    function rebase() {
      var shift = 0;
      while (d.pos + shift < SAFE_LO) shift += 10;
      while (d.pos + shift > SAFE_HI) shift -= 10;
      if (shift) {
        d.pos += shift;
        apply(false);
        /* Commit the un-animated shift NOW. Without this flush the browser
           coalesces it with the caller's next apply(true), sees only a
           ten-cell change, and ANIMATES it — spinning the drum a whole
           revolution instead of jumping it invisibly. */
        void strip.offsetHeight;
      }
      return shift;
    }
    d.rebase = rebase;

    function settle() {
      d.rolling = false;
      strip.classList.remove('rolling');
      rebase();
    }
    strip.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'transform') settle();
    });

    d.digit = function () { return (((d.pos % 10) + 10) % 10); };

    /* Roll by n steps. Rapid taps retarget the running transition, which
       chains smoothly rather than snapping; the re-base first means even a
       long burst that never lets a transition finish cannot walk the strip
       off the end of its cells. */
    d.roll = function (n) {
      rebase();
      d.pos += n;
      apply(true);
      if (d.interactive) SFX.play('click', d.digit());
      if (REDUCED) settle();
    };

    d.set = function (v, animate) {
      var cur = d.digit();
      var diff = ((v - cur) % 10 + 10) % 10;
      if (diff > 5) diff -= 10;              // short route
      if (animate) d.roll(diff);
      else { d.pos = v; apply(false); }
    };

    apply(false);

    if (interactive) {
      var dragging = false, latched = false, startY = 0, startPos = 0, moved = 0;
      win.style.cursor = 'ns-resize';
      win.addEventListener('pointerdown', function (e) {
        /* 16 Oct 2026 (Anmol): NO DIAL MOVES WHILE A LINE IS BEING SAID —
           anywhere in the game. The child listens first, then turns. */
        if (!H.can() || voiceBusy()) return;
        H.poke(); H.focus(index);
        dragging = true; latched = false; moved = 0;
        startY = e.clientY; startPos = d.pos;
        win.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      win.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dy = e.clientY - startY;
        moved = Math.abs(dy);
        /* Finger drift below the slop is still a tap. Without this, brushing
           13px while tapping a dormant dial to focus it also rolled its
           digit — half a step is enough to register. */
        if (!latched) { if (moved <= DRUM.dragTapSlop) return; latched = true; }
        var steps = -Math.round(dy / DRUM.dragPixelsPerDigit);
        var want = startPos + steps;
        if (want !== d.pos) {
          var jump = Math.abs(want - d.pos);
          d.pos = want;
          startPos += rebase();              // keep the drag 1:1 with the finger
          apply(true, true);
          SFX.play(jump > 1 ? 'whir' : 'click', d.digit());
          H.poke(); H.changed(index);
        }
      });
      function endDrag(e) {
        if (!dragging) return;
        dragging = false; latched = false;
        try { win.releasePointerCapture(e.pointerId); } catch (_) {}
        settle();
      }
      win.addEventListener('pointerup', endDrag);
      win.addEventListener('pointercancel', endDrag);
      win.addEventListener('wheel', function (e) {
        if (!H.can() || voiceBusy()) { if (voiceBusy()) e.preventDefault(); return; }
        e.preventDefault();
        H.focus(index);
        d.roll(e.deltaY > 0 ? -1 : 1);
        H.poke(); H.changed(index);
      }, { passive: false });
    }
    return d;
  }

  /* the bay floor, and this level's machine laid over it where `fit` puts it */
  function dressFace(art, machine) {
    var f = face(), r = f.fit || { x: 0, y: 0, w: 100, h: 100 };
    art.src = ASSET(f.bg || f.src);
    machine.hidden = !f.bg;
    if (!f.bg) return;
    machine.src = ASSET(f.src);
    machine.style.left = r.x + '%';
    machine.style.top = (r.y + FACE_DROP) + '%';
    machine.style.width = r.w + '%';
    machine.style.height = r.h + '%';
  }

  /* ======================================================================= */
  /*  BUILD — the wide console                                               */
  /* ======================================================================= */
  function buildWide() {
    dressFace(wideArt, wideMachine);
    wideOv.innerHTML = '';
    drums.wide = [];               // the old level's drums are gone with the DOM
    root.style.setProperty('--pl', plateType().toFixed(3));

    /* Every bay on this level's faceplate is live: the render carries exactly
       as many as the level has places, so there is nothing to seal and nothing
       counts dials by hand. */
    face().bays.forEach(function (cx, k) {
      /* the label plate, engraved */
      var lab = el('div', 'plate', wideOv);
      box(lab, labelRect(cx));
      lab.textContent = i18n('places.' + L.places[k]);
      if (lab.textContent.indexOf('-') >= 0) lab.classList.add('long');   // TEN-THOUSANDS: one line, same size as the row
      lab.dataset.dial = k;

      /* the drum in the chamfered window. One measured size, the positions
         derived from the bay centres — the apertures are identical. */
      var d = makeDrum(wideOv, winRect(cx), true, k);
      d.plate = lab;
      drums.wide.push(d);

      /* the two arrow buttons, off the same centre */
      var a = arrowRect(cx);
      var half = (a.w - WIDE.arrowGap) / 2;
      mkArrow(wideOv, { x: a.x, y: a.y, w: half, h: a.h }, k, +1);
      mkArrow(wideOv, { x: a.x + half + WIDE.arrowGap, y: a.y, w: half, h: a.h }, k, -1);
    });

    buildComms();
    buildLamps();
    buildNudge();
    buildLoad();
  }

  function winRect(cx) {
    var f = face(), w = f.winW || WIDE.winW;
    return { x: cx - w / 2, y: f.winY || WIDE.winY, w: w, h: f.winH || WIDE.winH };
  }
  function plateType() {
    var longest = 0;
    /* the WHOLE label, hyphen and all: TEN-THOUSANDS sits on one line, and
       every plate in the row takes the size that fits it, so the row reads
       as one size (it used to be shrunk on its own and looked smaller) */
    L.places.forEach(function (p) {
      var w = i18n('places.' + p);
      if (w.length > longest) longest = w.length;
    });
    /* 9.85 is labelW less a margin, over the display face's advance width and
       tracking — measured against the plate rather than guessed */
    return Math.min(1, 9.85 / Math.max(1, longest));
  }
  function labelRect(cx) {
    /* centred on the PAINTED plate (13 Oct 2026): capitals sit high in their
       line box, so the box comes down a little; level 3's render has its
       plates drawn a touch lower again (labelDy) */
    var dy = 0.35 + (face().labelDy || 0);
    return { x: cx - WIDE.labelW / 2, y: WIDE.labelY + dy, w: WIDE.labelW, h: WIDE.labelH };
  }

  function mkArrow(host, rect, dial, dir) {
    var b = el('button', 'arrow', host);
    b.type = 'button';
    box(b, rect);
    b.setAttribute('aria-label', (dir > 0 ? 'up' : 'down'));
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!armed || busy || voiceBusy()) return;
      poke(); focusDial(dial);
      drums.wide[dial].roll(dir);
      if (drums.close[dial]) drums.close[dial].set(drums.wide[dial].digit(), false);
      onDigitChanged(dial);
    });
    return b;
  }




  /* THE COMMS SCREEN — the wide glass across the top. Everything Rill says in
     the wide view lands here, including all three rungs of the ladder, each
     replacing the last rather than stacking.

     The glass carries a painted diagonal specular, so the text sits on a soft
     dark wash with no edge to it — a gradient, not a panel. No border, no
     outline: the house rule holds on the screens too. */
  /* THE COMMS SCREEN IS TWO ZONES, and the split is the point.

     THE ORDER is standing information. It is what she has to set, and it stays
     on the glass for the whole run whatever else happens — a wrong answer used
     to replace it with "That's not the figure", which left a child staring at
     a console with no idea what figure to set. Run 1.6 was the worst of it,
     because the destination changes between legs too.

     RILL is commentary. The ladder, the calibration steps, the idle line and
     the win line all live down here and all replace each other. Empty is fine;
     a missing order is not.

     Nothing separates them but spacing and a change of type size — no rule, no
     border, no box. Colour does the rest: the order in the console's cyan, her
     line warm-red when it is a correction and neutral otherwise. The red never
     touches the order.

     THE ORDER ZONE IS THE CONTROL. Tapping it re-types the words, so a child
     who has lost the thread can get the figure back without failing on purpose
     to see it again. It is not a button: the zone itself is tappable. */
  /* THE COMMS SCREEN — the figure in words, and nothing else on it.
     It used to carry four things at once: an ORDER label, the destination, a
     RILL · FLIGHT OPS header and his running line, all competing with the one
     thing the screen exists to show. The glass now holds the words alone, as
     large as they will go, centred in the whole box. Everything Rill says has
     moved to the instruction panel, which is on in both views. */
  function buildComms() {
    commsEl = el('div', 'comms no-order', wideOv);   // empty until an order arrives
    box(commsEl, WIDE.screens.comms);
    el('i', 'cm-wash', commsEl);

    /* THE FIGURE, on top and the larger of the two, and a tap on it says it
       again. It is still what the screen is for. */
    var ord = el('button', 'cm-order', commsEl);
    ord.type = 'button';
    ord.setAttribute('aria-label', 'Repeat the order');
    cmEls.words = el('p', 'cm-owords', ord);
    /* the sizer holds the FINISHED sentence so the fit is solved once, before
       a character is typed — fitting as it types would resize every frame */
    cmEls.wordsSizer = el('p', 'cm-owords cm-osizer', ord);
    cmEls.wordsSizer.setAttribute('aria-hidden', 'true');
    ord.addEventListener('click', function (e) { e.stopPropagation(); repeatOrder(); });

    /* AND NOTHING ELSE. Her zone sat under the figure and repeated it word
       for word — the order line read "load four thousand two hundred
       seventy-five" under "four thousand two hundred seventy-five". This
       screen shows the number; she is on the instruction panel. */

    /* THE HINT WINDOW — rung 2. The hint opens in a window of its own rather
       than replacing the order, because the order is the thing it is helping
       with and taking it away to explain it is no help at all. It is a wash
       over the glass, not a panel on it: no border, no outline, no edge. */
  }

  /* A HARD FLOOR. Nothing in the console is allowed to shrink its way out of a
     layout problem: below this the line wraps instead, and if it still does not
     fit that is a copy problem to be fixed in runs.js, not a type size. */
  /* TWO ZONES, and the figure gets the larger one. Without the ORDER label,
     the destination and the header, both zones are taller than they were
     the last time this screen carried two things, so both ceilings are up. */
  /* the figure has the WHOLE glass now, so the ceiling goes back up and the
     budget is three lines */
  /* TYPE FITTING, one routine for both zones. Step the size down from the
     ideal until the finished line fits its own box, and stop at a floor low
     enough that the zone's line budget still fits. Nothing is ever clipped,
     scrolled or ellipsized. */
  function fitInto(host, sizer, text, max, min, varName) {
    if (!host || !sizer) return;
    sizer.textContent = text || '';
    var size = min;
    for (var v = max; v >= min - 0.0001; v -= 0.06) {
      host.style.setProperty(varName, v.toFixed(3));
      if (sizer.scrollHeight <= sizer.clientHeight + 1) { size = v; break; }
    }
    host.style.setProperty(varName, size.toFixed(3));
  }
  var OR_MAX = 4.2, OR_MIN = 1.5;
  function fitOrder(text) { fitInto(commsEl, cmEls.wordsSizer, text, OR_MAX, OR_MIN, '--or'); }
  function fitComms(text) { if (panelSizer) panelSizer.textContent = text; }
  /* THE LAUNCH MONITOR IS GONE, with the screen it played on. The
     re-rendered consoles have no right-hand glass — that block is one
     blank face now and the lever is on it — so there is nowhere for a
     camera feed to be. Nothing else wanted it: it was a reward surface,
     and the lamp on the badge is the reward that the console already has.
     flight.js still owns cruise.webp and the delivery still flies. */

  /* THE ORDER. Filled when a run starts and when a leg changes, and at no
     other time — not by feedback, not by the idle line, not by a correct
     answer. The figure in words is the puzzle, so it is never printed as a
     numeral here or anywhere else. */
  function orderFaces() { return [cmEls.words, panEls.words]; }

  function paintOrder(retype, durMs) {
    if (!run || !cmEls.words) return;
    /* A DEMO SCREEN HAS NO ORDER. The upper zone empties, the glass goes to
       its no-order layout and Rill has the whole of it — which is what a
       screen he is demonstrating on should look like. */
    var text = run.demo ? '' : (run.words || '');
    /* the glass shows the order as a sentence, so it opens on a capital; the
       run keeps it lower-case because it is also read out mid-line */
    text = text.charAt(0).toUpperCase() + text.slice(1);

    /* THE GLASS CARRIES THE WORDS AND NOTHING ELSE — no ORDER label and no
       destination on it. Both of those are on the PANEL, where they are
       beside her rather than crowding the number. */
    if (panEls.tag) {
      panEls.tag.textContent = run.demo ? '' : ORDER_LABEL;
      panEls.dest.textContent = run.demo ? '' : (run.dest || '');
      panEls.sizer.textContent = text;
    }
    fitOrder(text);
    /* the words type on when the order changes and when the zone is tapped;
       a silent re-fill would not read as being told again */
    if (retype === false) {
      orderFaces().forEach(function (n) { if (n) n.textContent = text; });
    } else {
      runTyper(otyper, text, orderFaces(), durMs);
    }
    commsEl.classList.toggle('no-order', !text);
  }

  /* the zone is the control: a tap says it again */
  /* the handle a voice-over track gets hung on later. Silent today: the runs
     already carry the id, and this is the one place that would play it. */
  function audioHook(id) { return id; }

  function repeatOrder() {
    if (!run || !armed) return;
    /* 19 Oct 2026 (Varsha): A TAP ON THE NUMBER NAME SAYS IT AGAIN — the
       short order ("Load forty-five thousand…"), or the full one on the
       level's first run, which is the only one it has a clip for */
    if (voiceBusy()) return;
    VOICE.fresh();
    poke();
    var short = ORDER_SHORT.replace('{dest}', run.dest).replace('{words}', run.words);
    var again = VOICE.ms(short) ? short : lastOrder;
    if (again) { var ms = VOICE.play(again); DIALOG.say('rill', again, { pos: 'top', ms: ms }); }
    audioHook(run.voice);
    /* the figure stays put on the glass — a tap says it again, it does not
       blank the words and type them back in */
    orderShown = true;
    paintOrder(false);
  }

  /* THERE IS NO STANDING READOUT ANY MORE. The slot that carried the
     destination and the running numeral was cut into the old render and the
     new one has no such slot — that whole block is the lever's face now.
     Nothing is lost that is not shown twice over: the dials ARE the numeral,
     the gauge is how full it is, and Rill names the destination in the line
     he reads the order out in. */
  /* RUNG 3's POINTER, built once with the layer: a chevron of light with no
     edge to it. */
  function buildNudge() {
    nudgeEl = el('i', 'nudge', wideOv);
    nudgeEl.hidden = true;
  }

  function buildLamps() {
    lamps = (face().lamps || WIDE.lamps).map(function (r) {
      var e = el('i', 'lamp', wideOv);
      box(e, r);
      return e;
    });
  }

  /* THE LOAD LEVER, on the right-hand face.
     The re-rendered console has no screen there — one large blank face
     instead — so the lever is no longer a small throw tucked onto the
     pedestal below the dials. It is the whole of that face: a vertical gate
     cut down it, a grip at the top of the gate that falls when it is
     pulled, and LOAD engraved across the bottom. Still no box anywhere —
     the gate is a shadow, the grip is a bevel, the wash is a gradient. */
  function buildLoad() {
    loadEl = el('button', 'load', wideOv);
    loadEl.type = 'button';
    box(loadEl, face().lever || WIDE.lever);
    loadEl.setAttribute('aria-label', 'Load');
    /* the armed wash: a soft cyan gradient lying on the face, with no edge
       of its own, so the whole block lifts when the figure is accepted
       rather than only the cap */
    el('i', 'btn-wash', loadEl);
    /* the socket the cap sits in — an inset shadow, not a ring */
    el('i', 'btn-well', loadEl);
    /* THE CAP, with LOAD on it (QA Bug 16, 13 Oct 2026). It had no word,
       and children did not know the big button was the thing to press —
       while Rill was telling them to "press LOAD". */
    var cap = el('i', 'btn-cap', loadEl);
    el('b', 'btn-label', cap).textContent = i18n('ui.load');
    /* the ring that turns while the figure is being checked (QA Bug 13) */
    el('i', 'btn-spin', loadEl);
    /* the first-run cue: one ring off the cap, the first time it arms in a
       level. Once per LEVEL, not once per run — a pulse on every run is
       wallpaper by the third one. */
    el('i', 'btn-sweep', loadEl);
    loadEl.style.setProperty('--press', WIDE.pressDepth + '%');
    loadEl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!armed || busy || !loadEl.classList.contains('lit')) return;
      /* QA Bug 18 (13 Oct 2026): GREY MEANS IT DOES NOTHING. The button is
         grey until a dial has been turned on this run, and pressing it then
         used to send 0000 as a wrong answer. Now it only points at the dials
         — the thing to do first — and counts nothing. */
      if (!loadEl.classList.contains('ready')) { notYet(); return; }
      pressLoad();
    });
  }

  /* a press on the grey button: a small shake, and the dials light in turn */
  function notYet() {
    loadEl.classList.remove('nope'); void loadEl.offsetWidth;
    loadEl.classList.add('nope');
    later(function () { loadEl.classList.remove('nope'); }, 420);
    SFX.play('wrong');
    startWalk();
    later(stopWalk, 1900);
    poke();
  }

  /* THE CAP GOES DOWN FIRST, and only then does the run go. A button that
     fires before it has moved reads as a picture of a button. It comes back
     up on its own once the figure is away. */
  function pressLoad() {
    busy = true; paintLoad();
    loadEl.classList.remove('beckon');
    if (loadPtr) loadPtr.classList.remove('on');
    showOrder();
    loadEl.classList.add('pressed', 'checking');
    SFX.play('lever');
    /* QA Bug 13: the press answers at once — the cap goes down and the ring
       starts turning on the same frame — and the verdict follows sooner
       (SHORT.travelMs / holdMs were cut) */
    later(function () {
      busy = false;
      send();
      later(function () { loadEl.classList.remove('pressed'); }, 220);
    }, REDUCED ? 0 : 90);
  }
  /* the first-arm cue, once per level */
  var sweptThisLevel = false;
  /* set by startLevel when this level arrives by rolling out of the last one,
     and spent by the demo screen, which is where the bay opens */
  var pendingTransition = false;
  function paintLoad() {
    /* USABLE — a run is live and the console is not mid-move. It stays usable
       while the figure is wrong: sending a wrong figure is how the ladder is
       reached, so the lever must never refuse one. */
    var live = !!(armed && !busy && run && !run.demo);
    loadEl.classList.toggle('lit', live);
    /* ARMED — the dials match the order. This is the look, not the
       permission: the block lifts, the ball breathes and the word is the
       brightest thing in this corner of the console. Wrong or empty, the
       lever goes back to being bare metal that still plainly reads LOAD. */
    /* BLUE ONCE SHE HAS TOUCHED A DIAL. It says "you can send this now",
       never "this is right" — lighting only on the correct figure was
       telling her the answer. Held through the launch, so the green or red
       flash lands on a lit lever. */
    var ready = touched && armed && run && !run.demo;
    loadEl.classList.toggle('ready', !!ready);
    if (ready && !sweptThisLevel) {
      sweptThisLevel = true;
      loadEl.classList.add('sweep');
      later(function () { loadEl.classList.remove('sweep'); }, 560);
    }
  }

  /* ======================================================================= */
  /*  BUILD — the close-up                                                   */
  /* ======================================================================= */
  /* THE CLOSE-UP IS THE WIDE RENDER, ENLARGED.

     There was a second, tighter render for the dial strip, and it had exactly
     four plates painted on it — so levels 2 and 3 had nothing to zoom into and
     the push-in threw. One six-dial close-up render will replace this, with
     levels 1 and 2 covering the bays they are not using, exactly as the wide
     view does; until it exists the wide render is magnified instead.

     The softness is deliberate rather than apologised for: the backplate takes
     a small blur and a light grain so it reads as shallow depth of field. The
     dial windows, digits, label plates and arrow pads are all drawn in code and
     sit ABOVE that, so they stay fully sharp, and the windows keep their
     chamfer because the clip-path is on the overlay, not on the picture.

     NOTHING HERE COUNTS DIALS. The frame is solved from the level's own bay
     grid, so four, five and six all work, and dropping the real close-up in
     later is a one-line asset swap. */
  function closeFraming() {
    var bays = face().bays;
    var pad = WIDE.labelW / 2 + 1.5;              // half a plate, plus a margin
    var x0 = bays[0] - pad, x1 = bays[bays.length - 1] + pad;
    /* top of the label plates to the bottom of the arrow pads, plus a margin */
    var y0 = WIDE.plateY - 2 + FACE_DROP;
    var y1 = WIDE.arrowY + WIDE.arrowH + 2 + FACE_DROP;
    /* fit on WIDTH: every dial has to be in frame, and the strip is wider than
       the stage's aspect so height is never the binding constraint */
    var k = 100 / (x1 - x0);
    return { k: k,
             tx: 50 - k * (x0 + x1) / 2,
             ty: 50 - k * (y0 + y1) / 2 };
  }

  function buildClose() {
    dressFace(closeArt, closeMachine);
    closeOv.innerHTML = '';
    drums.close = [];

    var f = closeFraming();
    closeFrame.style.transform =
      'translate(' + f.tx.toFixed(4) + '%,' + f.ty.toFixed(4) + '%) scale(' + f.k.toFixed(5) + ')';
    /* the blur follows the magnification: the more the plate is enlarged, the
       shallower the focus has to read to stay honest */
    closeFrame.style.setProperty('--dof', (f.k * 0.34).toFixed(3));

    face().bays.forEach(function (cx, k) {
      var lab = el('div', 'plate', closeOv);
      box(lab, labelRect(cx));
      lab.textContent = i18n('places.' + L.places[k]);
      if (lab.textContent.indexOf('-') >= 0) lab.classList.add('long');   // TEN-THOUSANDS: one line, same size as the row
      lab.dataset.dial = k;
      var d = makeDrum(closeOv, winRect(cx), true, k);
      d.plate = lab;
      drums.close.push(d);
      var a = arrowRect(cx);
      var half = (a.w - WIDE.arrowGap) / 2;
      mkArrowC(closeOv, { x: a.x, y: a.y, w: half, h: a.h }, k, +1);
      mkArrowC(closeOv, { x: a.x + half + WIDE.arrowGap, y: a.y, w: half, h: a.h }, k, -1);
    });
  }
  function mkArrowC(host, rect, dial, dir) {
    var b = el('button', 'arrow', host);
    b.type = 'button';
    box(b, rect);
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!armed || busy || voiceBusy()) return;
      poke(); focusDial(dial);
      drums.close[dial].roll(dir);
      drums.wide[dial].set(drums.close[dial].digit(), false);
      onDigitChanged(dial);
    });
  }

  /* ======================================================================= */
  /*  INPUT AND STATE                                                        */
  /* ======================================================================= */
  function onDigitChanged(k) {
    digits[k] = (view === 'close' ? drums.close[k] : drums.wide[k]).digit();
    var other = (view === 'close' ? drums.wide[k] : drums.close[k]);
    if (other) other.set(digits[k], false);
    clearWrongMark();
    if (run && !run.demo) { touched = true; SWIPE.hide(); }
    /* the rung went with the attempt it was about */
    if (panel && panel.classList.contains('bad')) {
      panel.classList.remove('bad');
      sayHtml('', '');
    }
    /* the pointer went with the attempt it was about, the moment she moves
       the dial it was pointing at */
    if (nudgeIdx >= 0 && k === nudgeIdx) clearNudge();
    paintLoad();
  }

  /* Free focus: any dial, any order, no auto-advance. Focus is only ever a
     highlight — it never gates which dial will accept input. */
  function focusDial(k) {
    focusIdx = k;
    paintFocus();
  }
  function paintFocus() {
    [].forEach.call(root.querySelectorAll('.plate'), function (p) {
      p.classList.toggle('live', +p.dataset.dial === focusIdx);
    });
  }

  function setAll(v, animate) {
    clearWrongMark();
    var s = pad(v);
    for (var k = 0; k < N(); k++) {
      digits[k] = +s[k];
      drums.wide[k].set(digits[k], !!animate);
      if (drums.close[k]) drums.close[k].set(digits[k], false);
    }
    paintLoad();
  }

  /* ======================================================================= */
  /*  THE CAMERA — ported: one continuous push-in, not two pictures swapping  */
  /* ======================================================================= */
  function zoom(from, to, dir, after) {
    busy = true;
    if (REDUCED) {
      to.hidden = false;
      to.style.transform = 'none'; to.style.opacity = '0';
      from.style.transition = to.style.transition = 'opacity 300ms ease';
      void to.offsetWidth;
      from.style.opacity = '0'; to.style.opacity = '1';
      later(function () { from.hidden = true; busy = false; paintLoad(); if (after) after(); }, 320);
      return;
    }
    var wideIn = (dir === 'in');
    var origin = '50% 60%';
    from.style.transformOrigin = to.style.transformOrigin = origin;

    /* Both layers travel the SAME way or it reads as a swap:
         in  — WIDE 1 -> 2 fading out, CLOSE 0.92 -> 1 fading in  (both grow)
         out — CLOSE 1 -> 0.92 fading out, WIDE 2 -> 1 fading in  (both shrink)
       The outgoing layer starts at its true resting scale, which is where it
       already is, so frame 0 is a no-op rather than a visible pop. */
    from.style.transition = 'none';
    from.style.transform = 'scale(1)'; from.style.opacity = '1';
    to.hidden = false;
    to.style.transition = 'none';
    to.style.transform = wideIn ? 'scale(0.92)' : 'scale(2)';
    to.style.opacity = '0';
    void to.offsetWidth;

    var tr = 'transform ' + ZOOM.ms + 'ms ' + ZOOM.ease + ', opacity ' + ZOOM.ms + 'ms ease';
    from.style.transition = to.style.transition = tr;
    from.style.transform = wideIn ? 'scale(2)' : 'scale(0.92)';
    from.style.opacity = '0';
    to.style.transform = 'scale(1)'; to.style.opacity = '1';

    later(function () {
      from.hidden = true;
      from.style.transform = 'none'; from.style.opacity = '1';
      busy = false; paintLoad();
      if (after) after();
    }, ZOOM.ms + 20);
  }

  /* Both refuse to start while one is running: tapping through the push-in
     used to kick off a second zoom whose timer hid the view the first was
     bringing in, leaving the stage blank. */
  function toClose(k) {
    if (busy || view === 'close') { if (typeof k === 'number') focusDial(k); return; }
    SFX.play('zoom', 'in');
    view = 'close';
    root.classList.add('close-view');
    if (typeof k === 'number') focusDial(k);
    zoom(wideView, closeView, 'in', function () {
      drums.close.forEach(function (d) { d.sizeCells(); });
      paintFocus();
    });
  }
  function toWide(then) {
    if (busy || view === 'wide') { if (then) then(); return; }
    SFX.play('zoom', 'out');
    view = 'wide';
    root.classList.remove('close-view');
    zoom(closeView, wideView, 'out', function () {
      drums.wide.forEach(function (d) { d.sizeCells(); });
      paintFocus();
      if (then) then();
    });
  }

  /* ======================================================================= */
  /*  SPEECH — the intro's component, same typewriter, same 16ms             */
  /* ======================================================================= */
  var typer = { raf: null, text: '', i: 0, t0: 0, done: true, faces: [], html: null };
  /* the order types on its own clock: tapping the order to hear the figure
     again must not restart, blank or hurry whatever Rill is part-way through */
  var otyper = { raf: null, text: '', i: 0, t0: 0, done: true, faces: [] };
  /* and so does the hint window, for the same reason: rung 2 says a line AND
     opens the hint, and one typewriter cannot be typing both */

  function runTyper(t, text, faces, durMs) {
    t.faces = faces;
    /* a duration types the text across it (the order, in step with the
       voice); without one, the house pace */
    var cms = durMs ? Math.max(12, Math.min(150, durMs / Math.max(1, text.length))) : TIME.charMs;
    t.faces.forEach(function (n) { if (n) n.textContent = ''; });
    t.text = text; t.i = 0; t.t0 = performance.now(); t.done = false;
    if (t.raf) cancelAnimationFrame(t.raf);
    if (REDUCED) {
      t.faces.forEach(function (n) { if (n) n.textContent = text; });
      t.done = true; t.raf = null; return;
    }
    (function step() {
      var want = Math.floor((performance.now() - t.t0) / cms);
      if (want > t.i) {
        t.i = Math.min(want, t.text.length);
        var cut = t.text.slice(0, t.i);
        t.faces.forEach(function (n) { if (n) n.textContent = cut; });
      }
      if (t.i >= t.text.length) { t.done = true; t.raf = null; return; }
      t.raf = requestAnimationFrame(step);
    })();
  }

  /* ONE typewriter, EVERY face at once. During the brief Rill is standing
     there, so the bubble carries her; after it the comms screen does, and the
     instruction panel does whenever the view is pushed in and the screen is
     off-frame.

     Both faces are written on every tick whether or not they are visible.
     That is what makes the zoom handoff free: the panel already holds the
     sentence, at the same character, so it opens mid-sentence instead of
     re-typing. A child who touches an arrow does not lose the sentence. */
  /* EVERY LINE IS ON THE PANEL, the brief included — nobody walks on to say
     it. The brief and the demo are the narrator's, with no portrait. */
  function faces() { return [panelText]; }
  function say(text, then) {
    typer.html = null;
    var voiced = VOICE.play(text);
    if (panel && panel.classList.contains('narrator')) DIALOG.hide();
    else DIALOG.say('rill', text, { pos: 'top', ms: voiced });
    typer.cms = voiced ? voiced / Math.max(1, text.length) : 0;
    panelShow(true);
    fitComms(text);
    typer.faces = faces();
    typer.faces.forEach(function (n) { if (n) n.textContent = ''; });
    typer.text = text; typer.i = 0; typer.t0 = performance.now();
    typer.done = false; typer.then = then;
    if (REDUCED) { finishLine(); return; }
    if (typer.raf) cancelAnimationFrame(typer.raf);
    typer.raf = requestAnimationFrame(typeStep);
  }

  /* The two drawn rungs are markup, not a sentence, so they arrive whole
     rather than a character at a time — but they still go to BOTH faces. */
  function sayHtml(html, plain) {
    var vms = VOICE.play(plain || '');
    if (plain) DIALOG.say('rill', plain, { pos: 'top', ms: vms }); else DIALOG.hide();
    if (typer.raf) cancelAnimationFrame(typer.raf);
    typer.raf = null; typer.done = true;
    typer.text = plain || ''; typer.html = html;
    panelShow(true);
    fitComms(plain || '');
    faces().forEach(function (n) { if (n) n.innerHTML = html; });
  }

  function typeStep() {
    var vp = VOICE.progress(typer.text);
    var want = vp >= 0 ? Math.floor(Math.min(1, vp / 0.92) * typer.text.length)
                       : Math.floor((performance.now() - typer.t0) / (typer.cms || TIME.charMs));
    if (want > typer.i) {
      typer.i = Math.min(want, typer.text.length);
      var cut = typer.text.slice(0, typer.i);
      typer.faces.forEach(function (n) { if (n) n.textContent = cut; });
    }
    if (typer.i >= typer.text.length) { typer.done = true; typer.raf = null; return; }
    typer.raf = requestAnimationFrame(typeStep);
  }
  function finishLine() {
    if (typer.raf) cancelAnimationFrame(typer.raf);
    typer.raf = null;
    (typer.faces || []).forEach(function (n) { if (n) n.textContent = typer.text; });
    typer.done = true;
  }
  function hideBubble() { bubble.classList.remove('on'); later(function () { bubble.hidden = true; }, 240); }

  /* ======================================================================= */
  /*  THE OPENING BEAT                                                       */
  /* ======================================================================= */
  var briefIdx = 0;
  /* each level carries its own brief — levels 2 and 3 are shorter, because by
     then she is not re-explaining the console, only the new place */
  function briefLines() { return (L && L.briefLines) || []; }
  /* which brief line names the places, and so lights the label plates. Per
     level, because the naming line is not in the same position in each. */
  function platesOnAt() {
    return (L && typeof L.plateLine === 'number') ? L.plateLine : BRIEF.plateLine;
  }
  function startBrief() {
    /* THE BRIEF BEGINS HERE, so the brief's own state is set here. Leaving
       these at their load-time values worked exactly once. */
    briefing = true;
    briefIdx = 0;
    armed = false;
    busy = false;
    view = 'wide';
    root.classList.remove('close-view');
    root.classList.remove('plates-on', 'live');
    root.classList.add('briefing');
    /* the brief is told on the panel by the narrator — no portrait, and
       nobody walks on. She appears on the panel after the narrator hands the
       level over, just before the first order. */
    if (panel) panel.classList.remove('bad', 'good');
    narrator(true);
    narrated = false;
    scrim.style.opacity = BRIEF.scrim;
    later(function () { briefIdx = 0; briefLine(); }, 600);
  }
  function briefLine() {
    if (briefIdx >= briefLines().length) { endBrief(); return; }
    /* the plates light on the line that names them, and stay lit — she should
       not be pointing at four blank slots while saying what they are */
    if (briefIdx === platesOnAt()) root.classList.add('plates-on');
    /* THE NEW PLACE, NAMED. A level whose brief points at the place it has
       just gained lights that one column while she says it — the leftmost,
       because that is where a new place always arrives. */
    if (L && briefIdx === L.lakhLine && drums.wide[0] && drums.wide[0].plate) {
      drums.wide[0].plate.classList.add('demo');
      later(function () {
        if (drums.wide[0] && drums.wide[0].plate) drums.wide[0].plate.classList.remove('demo');
      }, 4200);
    }
    focusOn(L && L.briefFocus ? L.briefFocus[briefIdx] : null);
    say(briefLines()[briefIdx]);
  }

  /* THE SPOTLIGHT'S WINDOW, in stage %. Both are solved from the same
     measurements the console is laid out from, so the light stays on the
     thing it is lighting whatever the level. */
  function focusRect(what) {
    if (what === 'dials') {
      var bays = face().bays, pad = WIDE.labelW / 2 + 1.4;
      return { x: bays[0] - pad, y: WIDE.plateY - 1.2 + FACE_DROP,
               w: bays[bays.length - 1] - bays[0] + pad * 2,
               h: WIDE.arrowY + WIDE.arrowH - WIDE.plateY + 3.6 };
    }
    if (what === 'load') {
      var r = (face().lever || WIDE.lever);
      return { x: r.x - 1, y: r.y - 1.5 + FACE_DROP, w: r.w + 2, h: r.h + 3 };
    }
    return null;
  }
  /* light one part and darken the rest, or put the brief's own scrim back */
  function focusOn(what) {
    var r = focusRect(what);
    if (!r) {
      spot.classList.remove('on');
      if (briefing) scrim.style.opacity = BRIEF.scrim;
      return;
    }
    box(spot, r);
    spot.classList.add('on');
    scrim.style.opacity = '0';
  }

  function briefTap() {
    if (!typer.done) { finishLine(); return; }
    /* a tap shows the whole line at once, but it does not cut her off: the
       next line comes only once this one has been said */
    if (VOICE.playing()) return;
    briefIdx++;
    if (briefIdx >= briefLines().length) { endBrief(); return; }
    briefLine();
  }
  function endBrief() {
    spot.classList.remove('on');
    briefing = false;
    root.classList.remove('briefing');
    root.classList.add('plates-on');
    /* the scrim lifts and the console powers up left to right */
    scrim.style.transition = 'opacity ' + BRIEF.scrimLift + 'ms ease';
    scrim.style.opacity = '0';
    root.classList.add('powering');
    later(function () {
      root.classList.remove('powering');
      root.classList.add('live');
      /* Nova's tutorial comes before the first load — on level 1 here, on
         levels 2 and 3 after their bay opening (demoReady) */
      var go = function () { armed = true; startRun(0); };
      if (L.runs[0] && L.runs[0].demo) go();
      else runTutorial(go);
    }, BRIEF.scrimLift + BRIEF.powerUp);
  }

  /* ======================================================================= */
  /*  THE RUNS                                                               */
  /* ======================================================================= */
  /* STATUS reads DELIVERED once she has committed, not before */
  var sentThisRun = false;
  var touched = false;          // a dial has been moved on this run
  var narrated = false;         // the narrator has handed this level over
  var narrating = null;         // the hand-over is on screen: what comes next

  function startRun(i) {
    clearTimers();
    endTutorial(true);
    stopCues();
    novaCheerOut(true);
    SWIPE.hide();
    runIndex = i;
    syncJump();
    run = L.runs[i];
    wrongCount = 0;
    idleCount = 0; lastOrder = '';
    touched = false;
    loadEl.classList.remove('right', 'wrong');
    focusIdx = -1;
    setAll(0, false);
    paintFocus();
    /* a jump taken mid-press leaves the cap down, because the timer that
       lets it back up was cleared with the rest. */
    loadEl.classList.remove('pressed');
    /* the previous run's win line used to survive into the next one: the
       state class was reset but the line itself never was */
    commsEl.classList.remove('regroup');
    if (panel) panel.classList.remove('bad', 'good');
    clearNudge();
    sayHtml('', '');
    sentThisRun = false;
    /* the console is Rill's while he demonstrates: the arrows and the lever
       are inert until the demo moves on */
    root.classList.toggle('demo', !!run.demo);
    /* THE ORDER IS NOT ON THE GLASS YET: the number name appears once Rill
       has said it (orderLine), never before — the screen used to show it
       while the narrator was still handing over */
    if (run.demo) paintOrder(); else holdOrder();
    paintLoad();
    if (run.demo) return startDemo();
    /* THE HAND-OVER: the narrator says it once, before the level's first
       order, and then her portrait comes up on the panel */
    if (!narrated && L.narrate) return narrate(function () { narrator(false); orderLine(); });
    narrator(false);
    orderLine();
  }
  function orderLine() {
    /* the order waits for the last line (the previous run's "well done", the
       hand-over) to be said out */
    whenQuiet(function () {
      var nth = L.runs.slice(0, runIndex + 1).filter(function (r) { return !r.demo; }).length;
      var tmpl = (nth > 1 && typeof ORDER_SHORT === 'string' && ORDER_SHORT.indexOf('{words}') >= 0) ? ORDER_SHORT : ORDER_LINE;
      var text = tmpl.replace('{dest}', run.dest).replace('{words}', run.words);
      lastOrder = text;
      rillSay(text);
      cueOrder(text);
      /* THE FIRST RUN OF THE GAME teaches the scroll: a hand on the first
         dial, and Rill says how, once the order has been read */
      if (L.id === 1 && runIndex === 0 && !touched) {
        SWIPE.show(drums.wide[0] && drums.wide[0].win, drums.wide[0]);
        VOICE.then(i18n('lines.swipe'));
        /* its box comes up when the order has been said out — not on a guess
           at the clip's length, which put it up over the order mid-line */
        cueStops.push(VOICE.reach(text, VOICE.ms(text) || 0, function () {
          if (SWIPE.on()) DIALOG.say('rill', i18n('lines.swipe'), { pos: 'top', ms: VOICE.ms(i18n('lines.swipe')) });
        }));
      }
    });
  }

  /* THE GLASS WAITS FOR THE WORDS. Until Rill has said the number name the
     glass keeps its order layout but shows nothing. */
  var orderShown = false, lastOrder = '';
  function holdOrder() {
    orderShown = false;
    orderFaces().forEach(function (n) { if (n) n.textContent = ''; });
    if (otyper && otyper.raf) { cancelAnimationFrame(otyper.raf); otyper.raf = null; }
    if (panEls.tag) { panEls.tag.textContent = ''; panEls.dest.textContent = ''; }
    commsEl.classList.remove('no-order');
  }
  function showOrder(durMs) {
    if (orderShown || !run || run.demo) return;
    orderShown = true;
    paintOrder(undefined, durMs);
  }
  /* WHAT THE ORDER LINE POINTS AT, AS IT SAYS IT: the number name types onto
     the glass once it has been said; "Set the dials" walks a glow across
     the dials; "press LOAD" lights the button and puts a pointer over it.
     Each is cued off the clip's own playhead (VOICE.reach, VOICE_CUES). */
  var cueStops = [];
  function stopCues() {
    cueStops.forEach(function (f) { f(); }); cueStops = [];
    if (loadEl) loadEl.classList.remove('beckon');
    if (loadPtr) loadPtr.classList.remove('on');
    root.classList.remove('beckon-dials');
  }
  function cueOrder(text) {
    stopCues();
    var mine = run;
    function at(name, phrase, atEnd, fn) {
      var ms = cueMs(text, name, phrase, atEnd);
      cueStops.push(VOICE.reach(text, ms, function () { if (run === mine && L) fn(); }));
    }
    /* the number name types onto the glass AS she says it: it starts on her
       first word of it and finishes on her last (QA 21 Oct 2026 — it used to
       wait for the words to be said, then type, so it trailed the voice) */
    var from = cueMs(text, 'from', run.words, false), to = cueMs(text, 'words', run.words, true);
    at('from', run.words, false, function () { showOrder(Math.max(300, to - from)); });
    /* and whatever happens to the line, the order is up once it is over */
    later(function () { if (run === mine) showOrder(); }, (VOICE.ms(text) || text.length * TIME.charMs) + 2000);
    if (/press load/i.test(text)) {
      at('dials', 'set the dials', false, function () {
        if (touched) return;
        root.classList.add('beckon-dials');
        later(function () { root.classList.remove('beckon-dials'); }, 1500);
      });
      at('load', 'press load', false, beckonLoad);
    }
  }
  /* "press LOAD": the cap lights and rings, and a pointer bobs over it */
  var loadPtr = null;
  function beckonLoad() {
    if (!loadEl) return;
    loadEl.classList.add('beckon');
    if (!loadPtr) {
      loadPtr = el('i', 'nudge load-ptr', wideOv);
      var r = (face().lever || WIDE.lever), w = WIDE.nudgeW * 1.4, h = WIDE.nudgeH * 1.4;
      loadPtr.style.left = (r.x + r.w / 2 - w / 2) + '%';
      loadPtr.style.top = (r.y + WIDE.loadPtrY) + '%';
      loadPtr.style.width = w + '%';
      loadPtr.style.height = h + '%';
    }
    void loadPtr.offsetWidth;
    loadPtr.classList.add('on');
    later(function () {
      if (loadEl) loadEl.classList.remove('beckon');
      if (loadPtr) loadPtr.classList.remove('on');
    }, 3200);
  }

  /* the panel without her portrait — the narrator speaking */
  function narrator(on) { if (panel) panel.classList.toggle('narrator', !!on); if (on) DIALOG.hide(); }

  /* "Help Nova, launch the shuttles to Rock Post." The console waits while it
     is said; a tap, or a moment after it has typed out, moves on. */
  function narrate(then) {
    narrated = true;
    narrator(true);
    var was = armed;
    armed = false;
    var go = function () {
      if (!narrating) return;
      narrating = null;
      armed = was;
      then();
    };
    narrating = go;
    say(NARRATOR_LINE.replace('{place}', L.name));
    /* on once it is typed AND said — the voice can run past the typing */
    (function wait() {
      if (narrating !== go) return;
      if (!typer.done || VOICE.playing()) { later(wait, 250); return; }
      later(go, 700);
    })();
  }

  function rillSay(text) { say(text); poke(); }

  /* ONE LINE AT A TIME. A line asked for while the last one is still being
     said waits for it to finish, and TIME.lineHold after it, before it starts: the
     panel never cuts a sentence off to begin the next. Straight away (and so
     in step with the caller) when nothing is being said. Only the newest
     request waits — a later one replaces an earlier one still waiting — so a
     burst of presses cannot stack lines up behind each other. It runs on
     later(), so a jump's clearTimers() drops whatever is waiting. */
  var waiting = null;
  /* run fn once nothing is being said AND nothing is queued to be said, plus
     the usual breath after a line — the next screen never starts mid-line */
  function afterVoice(fn) {
    (function check() {
      if (VOICE.playing() || waiting) { later(check, 120); return; }
      var rest = TIME.lineHold - VOICE.quietFor();
      if (rest > 0) { later(check, rest); return; }
      fn();
    })();
  }
  function whenQuiet(fn) {
    var mine = waiting = {};
    (function check() {
      if (waiting !== mine) return;
      if (VOICE.playing()) { later(check, 120); return; }
      var rest = TIME.lineHold - VOICE.quietFor();
      if (rest <= 0) { waiting = null; fn(); return; }
      later(function () { if (waiting === mine) { waiting = null; fn(); } }, rest);
    })();
  }

  /* "MISSION: ROCK POST" — the storyboard's on-screen title as a level's
     game begins. Shown once per level, over the console, then gone. */
  var missioned = false;
  /* its OWN beat: the level waits for it, so no line or box is ever on
     screen under it */
  function missionCard(then) {
    if (missioned || !L || !L.mission) return then && then();
    missioned = true;
    root.classList.add('missioning');
    later(function () { root.classList.remove('missioning'); if (then) then(); }, 1800);
    var m = document.createElement('div');
    m.className = 'cm-mission';
    m.textContent = L.mission;
    /* QA Bug 12 (13 Oct 2026): centred on the machine's big glass, not on
       the stage, so the card sits square in the screen it is shown on */
    if (commsEl) {
      var rr = root.getBoundingClientRect(), cr = commsEl.getBoundingClientRect();
      if (rr.width && cr.width) {
        m.style.left = ((cr.left + cr.width / 2 - rr.left) / rr.width * 100).toFixed(2) + '%';
        m.style.top = ((cr.top + cr.height / 2 - rr.top) / rr.height * 100).toFixed(2) + '%';
      }
    }
    root.appendChild(m);
    void m.offsetWidth;
    m.classList.add('on');
    /* stamped on, with a little jolt through the console */
    m.animate([
      { transform: 'translate(-50%, -50%) scale(2.4) rotate(-6deg)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(0.94) rotate(1deg)', opacity: 1, offset: 0.55 },
      { transform: 'translate(-50%, -50%) scale(1.03) rotate(-0.4deg)', offset: 0.78 },
      { transform: 'translate(-50%, -50%) scale(1) rotate(0)', opacity: 1 }
    ], { duration: 700, easing: 'ease-out' });
    setTimeout(function () {
      root.animate([
        { transform: 'translate(0,0)' }, { transform: 'translate(-0.5%, 0.4%)' },
        { transform: 'translate(0.4%, -0.3%)' }, { transform: 'translate(-0.2%, 0.2%)' },
        { transform: 'translate(0,0)' }
      ], { duration: 320, easing: 'ease-out' });
      SFX.play('lock');
    }, 390);
    setTimeout(function () { m.classList.remove('on'); }, 2600);
    setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 3200);
  }

  /* ======================================================================= */
  /*  THE DEMO SCREEN — L2.0, L3.0                                           */
  /*                                                                         */
  /*  Console visible, Rill present, nothing scored, no button. He        */
  /*  says the thing and the console does it while he says it: the new    */
  /*  bay opens, and on level 3 the readout re-groups to Indian commas as    */
  /*  the lakh lands. Level 1 has no demo — its brief goes straight in.      */
  /*  It runs on the level's own later() timers, so clearTimers() cancels    */
  /*  the whole thing and no second animation loop is started.               */
  /* ======================================================================= */
  var DEMOS = { settle: 900, regroup: 900, regroupHold: 1600, onward: 400 };

  function startDemo() {
    armed = true; busy = false;
    /* the brief left the panel in narrator mode, which hides the dialogue
       box; the demo line is Rill's, so his box comes back for it */
    narrator(false);
    rillSay(run.say);
    /* LEVEL 3: the lakh column is lit while she says "in lakhs" */
    if (run.regroup) later(function () {
      var pl = drums.wide[0] && drums.wide[0].plate;
      if (!pl) return;
      pl.classList.add('demo');
      later(function () { pl.classList.remove('demo'); }, 4200);
    }, 1400);
    later(demoShow, DEMOS.settle);
  }

  function demoShow() {
    if (!run || !run.demo) return;
    if (run.show === 'dial') return demoDial();
    demoReady();
  }

  /* LEVELS 2 AND 3 — the bay opens on her line, so the plate coming off and
     the dial arriving are one move rather than a transition that happens and
     then an explanation of what happened. */
  function demoDial() {
    if (pendingTransition && window.TRANSITION) {
      pendingTransition = false;
      window.TRANSITION.play(L, function () {
        if (run && run.regroup) return demoRegroup(demoReady);
        demoReady();
      });
      return;
    }
    if (run.regroup) return demoRegroup(demoReady);
    demoReady();
  }

  /* THE COMMA MOVING is the visible sign of the new place, so it is a beat
     the player watches: the figure goes up plain, then re-groups. A demo
     screen has no target, so printing a numeral here gives nothing away. */
  function demoRegroup(then) {
    var n = Math.pow(10, N() - 1);            // 1 followed by a zero per place
    setOrderText(String(n));
    later(function () {
      commsEl.classList.add('regroup');
      setOrderText(commas(n));
    }, DEMOS.regroup);
    later(function () {
      commsEl.classList.remove('regroup');
      setOrderText('');
      then();
    }, DEMOS.regroup + DEMOS.regroupHold);
  }

  function setOrderText(t) {
    commsEl.classList.toggle('no-order', !t);
    fitOrder(t);
    if (cmEls.words) cmEls.words.textContent = t;
    if (cmEls.wordsSizer) cmEls.wordsSizer.textContent = t;
  }

  /* THERE IS NO START BUTTON. Once the demo has played and she has finished
     her line, the level moves on to its first run by itself. */
  function demoReady() {
    if (!run || !run.demo) return;
    var demo = run;
    (function onward() {
      if (run !== demo) return;              // a jump has already moved on
      if (!typer.done) { later(onward, 250); return; }
      later(function () {
        if (run !== demo) return;
        runTutorial(function () { armed = true; nextRun(); });
      }, DEMOS.onward);
    })();
  }

  /* ======================================================================= */
  /*  NOVA'S TAP-THROUGH TUTORIAL (15 Oct 2026, "Tutorial Feedback Updates" */
  /*  sheet). It replaces the old place-value-chart lessons. It runs on the  */
  /*  machine itself, before the first load of each level: Nova says one    */
  /*  line at a time in the dialogue box, a small Nova hops along the dial   */
  /*  plates to the place she is naming, the dials show its value, and a    */
  /*  tap moves on. The last step is a START button.                        */
  /*    Level 1 — none (removed 21 Oct 2026)                               */
  /*    Level 2 — after the bay opens: ten-thousands                         */
  /*    Level 3 — after the bay opens: the lakh                              */
  /*  Text only for now: the lines have no recordings yet, so they are     */
  /*  typed at an even pace and VOICE stays silent for them.                */
  /* ======================================================================= */
  var TUT_STEPS = {
    /* level 1 has no tutorial (removed 21 Oct 2026, Anmol): Rock Post
       goes straight from its brief to the first load */
    2: [ { act: 'stand' },
         { act: 'hop', place: 'TEN-THOUSANDS', value: 10000, pop: '\u00d710' },
         { act: 'run' },
         { act: 'start' } ],
    3: [ { act: 'stand' },
         { act: 'hop', place: 'LAKH', value: 100000, pop: '1,00,000' },
         { act: 'run' },
         { act: 'start' } ]
  };
  var tut = null;                     // the tutorial on screen, or null
  var tutSeen = {};                   // level id -> shown this session

  function runTutorial(then) {
    var steps = TUT_STEPS[L && L.id], lines = i18n('tutorial.level' + (L && L.id));
    if (!steps || !Array.isArray(lines) || tutSeen[L.id]) return then();
    tutSeen[L.id] = true;
    armed = false; busy = false;
    narrator(false);
    stopCues(); SWIPE.hide();
    root.classList.add('plates-on', 'tutoring');
    /* 16 Oct 2026 (Anmol): THE HAND NUDGE, not the little Nova — the same
       3D pointing hand as everywhere else, on the dial being talked about.
       And no "Tap to continue": each line runs on once it has been said. */
    var bot = el('div', 'tut-hand', wideOv);
    bot.innerHTML = SWIPE.hand();
    var next = el('div', 'tut-next', wideOv);
    tut = { steps: steps, lines: lines, i: -1, bot: bot, next: next, then: then,
            ready: false, start: null };
    placeBot(face().bays[0] - 7.5, false);
    setAll(0, false); setOrderText('');
    later(tutStep, 500);
  }

  /* the hand on the dial at bay x (fingertip just under its digit); a spot
     that is not a bay — the old "beside the machine" — just puts it away */
  function placeBot(cx) {
    if (!tut) return;
    var b = tut.bot, k = face().bays.indexOf(cx), d = k >= 0 && drums.wide[k];
    if (!d || !d.win) { b.classList.remove('on'); return; }
    var R = wideOv.getBoundingClientRect(), w = d.win.getBoundingClientRect();
    if (!R.width) return;
    b.style.left = ((w.left + w.width / 2 - R.left) / R.width * 100).toFixed(2) + '%';
    /* 21 Oct 2026 (Anmol): THE FINGER NEVER COVERS THE DIGIT. Its tip rests
       on the window's bottom rim, under the glyph, and points up at it, so
       the number stays readable the whole time (the tap is a small press). */
    b.style.top = ((w.bottom - w.height * 0.07 - R.top) / R.height * 100).toFixed(2) + '%';
    b.classList.add('on');
    b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap');
  }
  function bayOf(place) {
    var k = L.places.indexOf(place);
    return { k: k, cx: k >= 0 ? face().bays[k] : face().bays[0] };
  }
  function litDial(k, on) {
    [drums.wide[k], drums.close[k]].forEach(function (d) {
      if (d && d.win) d.win.classList.toggle('tut-lit', !!on);
      if (d && d.plate) d.plate.classList.toggle('demo', !!on);
    });
  }
  function unlightAll() { for (var k = 0; k < N(); k++) litDial(k, false); }

  function tutStep() {
    if (!tut) return;
    tut.i++;
    var st = tut.steps[tut.i], line = tut.lines[tut.i];
    if (!st) return endTutorial();
    tut.ready = false;
    tut.next.classList.remove('on');
    unlightAll();
    /* VOICE-LED: ready when the line has really been said (its clip's end, or
       the typing time with no clip) and the dial animation is done; then a
       600 ms breath and on to the next. A tap once ready skips the breath. */
    var me = tut.i, voDone = false, animDone = false;
    function ready() {
      if (!tut || tut.i !== me || !voDone || !animDone || tut.ready) return;
      tut.ready = true;
      later(function () { if (tut && tut.i === me && !tut.start) tutStep(); }, 600);
    }
    var ms = VOICE.play(line, function () { voDone = true; ready(); }) || 0;
    DIALOG.say('nova', line, { pos: 'top', ms: ms });
    var typeMs = Math.max(600, (ms || line.length * 38) * 0.92);
    if (st.act === 'hop') {
      var b = bayOf(st.place);
      placeBot(b.cx, true);
      later(function () {
        if (!tut) return;
        setAll(st.value, true); setOrderText(commas(st.value));
        litDial(b.k, true);
        SFX.play('lamp', b.k);
        if (st.pop && drums.wide[b.k]) FX.pop(st.pop, drums.wide[b.k].win, { big: true, dy: -3, rise: 5, ms: 1700 });
      }, 420);
    } else if (st.act === 'stand') {
      placeBot(face().bays[0] - 7.5, true);
    } else if (st.act === 'run') {
      setAll(0, true); setOrderText('');
      face().bays.forEach(function (cx, k) {
        later(function () { if (!tut) return; placeBot(cx, true); litDial(k, true); SFX.play('lamp', k); }, k * 480);
      });
    } else if (st.act === 'start') {
      /* 19 Oct 2026 (Anmol): NO START BUTTON — "Let's load the shuttle!" is
         said, and the level runs straight on from it like the rest */
      setAll(0, true); setOrderText('');
      placeBot(face().bays[0] - 7.5, true);
    }
    var animMs = st.act === 'run' ? N() * 480 + 300 : 700;
    later(function () { animDone = true; ready(); }, animMs);
    /* no clip, or one that never reports its end: the typing time stands in */
    later(function () { voDone = true; ready(); }, ms ? ms + 1500 : typeMs + 350);
  }

  /* a tap anywhere on the console moves on, once the line is out */
  function tutTap() {
    if (!tut || tut.start) return;
    if (!tut.ready) return;
    tutStep();
  }

  /* silent: a jump or a level change took over — just clear it away */
  function endTutorial(silent) {
    if (!tut) return;
    var t = tut; tut = null;
    unlightAll();
    [t.bot, t.next, t.start].forEach(function (e) { if (e && e.parentNode) e.parentNode.removeChild(e); });
    root.classList.remove('tutoring');
    DIALOG.hide();
    setAll(0, false); setOrderText('');
    if (!silent && t.then) t.then();
  }

  /* GREEN FOR RIGHT, RED FOR WRONG, and then back to blue */
  function flashLoad(ok) {
    loadEl.classList.remove('right', 'wrong');
    void loadEl.offsetWidth;
    loadEl.classList.add(ok ? 'right' : 'wrong');
    later(function () {
      loadEl.classList.remove('right', 'wrong');
      paintLoad();
    }, SHORT.flashMs);
  }

  function send() {
    /* Loading between runs threw here: startRun has not been called yet, or
       the previous run has finished and nextRun is still on the clock, so
       `run` is null and reading it crashes. A demo screen has no figure to
       send. */
    if (!run || busy || !armed || run.demo) return;
    busy = true; paintLoad();
    var got = loaded(), want = target();
    TRACK.send('answer', { level: L.id, run: run.id, correct: got === want,
                           attempt: wrongCount + 1, given: got, target: want });
    launch(got, want, function () {
      loadEl.classList.remove('checking');
      flashLoad(got === want);
      if (got === want) return good();
      wrong(got, want);
    });
  }

  /* THE BENCH TEST IS GONE. Each level now opens on a demo screen instead —
     see startDemo() — so there is no guided two-step run, no calStep, and no
     line that confirms a correct figure before the player commits to it. */

  /* THE LAUNCH. The shuttle goes whatever she set, and the needle travels to
     where she actually sent it while the amber marker stays where the
     settlement is. 4,257 lands a hair under; 425 lands a quarter of the way
     up. Same "wrong", wildly different pictures — and that difference is the
     whole argument for place value, so it is shown before any text. */
  function launch(got, want, then) {
    SFX.play('launch');
    later(then, SHORT.travelMs + (got === want ? 120 : SHORT.holdMs));
  }

  function good() {
    panel.classList.remove('bad');
    panel.classList.add('good');
    clearWrongMark(); clearNudge();
    sentThisRun = true;
    whenQuiet(function () { say(winLine()); });
    SFX.play('lock');
    lightLamp();
    celebrate();
    busy = false;
    /* the next run waits for the praise to be heard out, not a fixed clock */
    later(function () { afterVoice(nextRun); }, 2600);
  }

  /* RIGHT: the digits flash green, each one's value pops up out of its dial
     (4,000 · 200 · 70 · 5), the whole figure bursts out of the screen, and
     confetti goes up from the dials. */
  function celebrate() {
    var t = target(), sd = pad(t);
    root.classList.remove('allright'); void root.offsetWidth;
    root.classList.add('allright');
    later(function () { root.classList.remove('allright'); }, 1600);
    drums.wide.forEach(function (d, i) {
      var v = +sd[i] * Math.pow(10, N() - 1 - i);
      if (!v || !d) return;
      later(function () { FX.pop(commas(v), d.win, { big: true, dy: -4, rise: 6, ms: 2300 }); }, i * 140);
    });
    FX.pop(commas(t) + '!', commsEl, { big: true, dy: -6, rise: 3, ms: 2400 });
    /* QA Bug 12: 100 pieces plus a repainting glow dropped frames on the
       low-end laptop; 60 pieces, and the glow is an opacity fade now */
    if (drums.wide[0]) FX.confetti(60, drums.wide[0].win.parentNode);
  }

  /* THE CORRECT-FEEDBACK LINE. The second sentence belongs to every figure
     with an empty place in it and to no other, so it is asked of the figure
     rather than written out on the eleven runs that have one. String(target),
     not the padded form: L3.2 is a five-digit figure sitting on six dials and
     the 0 the lakh holds is not one of ITS digits. */
  var zeroSaidFor = null;
  function winLine() {
    var t = target();
    var n = L.runs.slice(0, runIndex + 1).filter(function (r) { return !r.demo; }).length;
    var s = (Array.isArray(WIN_POOL) && WIN_POOL.length)
      ? WIN_POOL[(Math.max(1, n) - 1) % WIN_POOL.length]
      : WIN_LINE.replace('{figure}', commas(t));
    if (String(t).indexOf('0') >= 0 && zeroSaidFor !== L) { s += WIN_ZERO; zeroSaidFor = L; }
    return s;
  }

  /* THE SPLIT RUN IS GONE. Every run has one destination and one figure, so
     there are no legs to advance between. */

  function lightLamp() {
    var n = L.runs.slice(0, runIndex + 1).filter(function (r) { return !r.demo; }).length;
    if (lamps[n - 1]) { lamps[n - 1].classList.add('lit'); SFX.play('lamp', n - 1); }
  }

  /* The closing line, filled from the level that just ended. The count is the
     runs that carry a lamp — the calibration is not one of them — so it stays
     right if a level is ever given more or fewer. */
  function doneLine() {
    var n = L.runs.filter(function (r) { return !r.demo; }).length;
    var words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six',
                 'seven', 'eight', 'nine', 'ten'];
    var w = words[n] || String(n);
    return DONE_LINE.replace(/{name}/g, L.name)
                    .replace('{n}', w.charAt(0).toUpperCase() + w.slice(1))
                    .replace(/{n}/g, w);
  }

  /* NOVA IS HAPPY WHEN A LEVEL IS DONE. She pops up in the bottom-left
     corner and jumps for joy — the crouch, three jumps and the arms-out
     landing from her celebration clip (end.webm, 1.0-4.95 s at 12 fps),
     keyed off the green screen once into a sprite sheet. Played once, then
     she holds the landing until the delivery flight takes over. Not on the
     last level: the end celebration is this same jump, full screen. */
  var CHEER = { src: ART + 'nova cheer.webp', cols: 8, rows: 6, frames: 48, fps: 12,
                aspect: 254 / 324, h: 62, x: 0.5 };
  var cheerEl = null, cheerRaf = 0;
  function novaCheer() {
    if (!L || L.id >= LEVELS[LEVELS.length - 1].id) return 0;
    novaCheerOut(true);
    cheerEl = el('div', 'nova-cheer', root);
    cheerEl.style.height = CHEER.h + '%';
    cheerEl.style.left = CHEER.x + '%';
    cheerEl.style.aspectRatio = String(CHEER.aspect);
    var fig = el('i', 'fig', cheerEl);
    fig.style.backgroundImage = 'url("' + ASSET(CHEER.src) + '")';
    fig.style.backgroundSize = (CHEER.cols * 100) + '% ' + (CHEER.rows * 100) + '%';
    function show(n) {
      fig.style.backgroundPosition = ((n % CHEER.cols) / (CHEER.cols - 1) * 100).toFixed(3) + '% ' +
                                     (Math.floor(n / CHEER.cols) / (CHEER.rows - 1) * 100).toFixed(3) + '%';
    }
    show(0);
    void cheerEl.offsetWidth;
    cheerEl.classList.add('on');
    if (REDUCED) { show(CHEER.frames - 1); return 0; }
    var t0 = 0, last = -1, mine = cheerEl;
    (function step(now) {
      if (cheerEl !== mine) return;
      if (!t0) t0 = now;
      var n = Math.min(CHEER.frames - 1, Math.floor((now - t0) / 1000 * CHEER.fps));
      if (n !== last) {
        show(n);
        if (last < 6 && n >= 6) SFX.play('clap');     // off the ground on the first jump
        last = n;
      }
      if (n < CHEER.frames - 1) cheerRaf = requestAnimationFrame(step);
    })(performance.now());
    return CHEER.frames / CHEER.fps * 1000;
  }
  function novaCheerOut(now) {
    if (cheerRaf) { cancelAnimationFrame(cheerRaf); cheerRaf = 0; }
    var e = cheerEl;
    cheerEl = null;
    if (!e) return;
    if (now) { e.remove(); return; }
    e.classList.remove('on');
    e.classList.add('out');
    setTimeout(function () { e.remove(); }, 500);
  }

  function nextRun() {
    if (runIndex + 1 >= L.runs.length) return finish();
    startRun(runIndex + 1);
  }

  function finish() {
    var line = doneLine();
    SFX.play('complete');
    FX.confetti(90, commsEl);
    armed = false;
    /* the closing line waits for the last run's "well done" to be said out */
    whenQuiet(function () {
      say(line);
      var cheerAt = Date.now(), cheering = novaCheer();
      /* THE CLOSING LINE IS HEARD OUT, and the console holds TIME.screenGap
         after it, before the delivery takes the screen. It used to hand over
         on the same frame, which cut the line off as it started. later(), so
         the jump menu's clearTimers() still cancels it. */
      var lineMs = VOICE.ms(line) || line.length * TIME.charMs;
      /* the clip's length first, then whatever is still left of it (a voice
         starts a moment after it is asked for), and only then the gap */
      later(function () {
        /* …and, when Nova is cheering, not before her jump has landed */
        var hold = VOICE.left() + TIME.screenGap;
        if (cheering) hold = Math.max(hold, cheering + 500 - (Date.now() - cheerAt));
        later(function () {
          if (typeof onDone === 'function') onDone(L.id, { wrong: levelWrong });
        }, hold);
        /* she drops back down just before the next screen comes */
        later(novaCheerOut, Math.max(0, hold - 450));
      }, lineMs);
    });
  }

  /* ======================================================================= */
  /*  THE LADDER — three rungs                                               */
  /*                                                                         */
  /*  1  "Oops! Try again." The dials glow red and wiggle. Nothing is said    */
  /*     about the figure: a first miss is a slip, not a misunderstanding.    */
  /*  2  The run's own hint, opening in a WINDOW of its own rather than       */
  /*     replacing the order — the order is the thing the hint is helping     */
  /*     with, and taking it away to explain it is no help at all. Red glow   */
  /*     and wiggle again.                                                    */
  /*  3  The figure and its digits, one per place, and a pointer on the first */
  /*     dial that is wrong with its plate lit. She still sets it herself and */
  /*     still pulls LOAD: this is a hand on the shoulder, not an answer.     */
  /*                                                                         */
  /*  The digit chain and the pointer are both derived from the target and    */
  /*  places.length. There is no literal 4, 5 or 6 anywhere in here.          */
  /* ======================================================================= */
  /* WHAT EACH RUNG SAYS, as a pure function of the attempt. The teaching
     chart runs the same three rungs on the same drums, so the copy and the
     order live here once and both callers render what comes back. It knows
     nothing about the console's DOM — the dial it names is an index. */
  function rungContent(n, want, dials, places) {
    var s = String(want);
    while (s.length < places) s = '0' + s;
    /* the three rungs from the "Incorrect Feedback" sheet (15 Oct 2026) */
    if (n <= 1) return { kind: 'say', text: WRONG_1 };
    if (n === 2) return { kind: 'hint', text: i18n('lines.wrong2', { words: (run && run.words) || commas(want) }) };
    /* the first place that is wrong, reading left to right — which is the
       order the whole game teaches */
    var k = -1;
    for (var i = 0; i < places; i++) if (dials[i] !== +s[i]) { k = i; break; }
    return { kind: 'nudge', dial: k, text: i18n('lines.wrong3') };
  }

  function wrong(got, want) {
    wrongCount++;
    levelWrong++;
    panel.classList.add('bad');
    SFX.play('wrong');
    markWrong(got, want);
    shake();

    /* the buzz, the red and the wiggle answer the press at once; what she
       SAYS about it waits for her to finish the line she is on */
    var r = rungContent(wrongCount, want, digits, N());
    var reveal = (r.kind === 'nudge');
    /* the answer is about to be shown: the hint still being read is cut off */
    if (reveal) VOICE.stop();
    whenQuiet(function () {
      VOICE.fresh();
      /* 19 Oct 2026 (Varsha): FEEDBACK IS IN THE DIALOGUE BOX ONLY — the
         glass keeps the number name on it the whole time, and no hint window
         goes up over it. Rung 2 is voiced: "Listen carefully." and then the
         order itself again, from its own clip. */
      var ms;
      if (r.kind === 'hint') ms = sayListen();
      else ms = say(r.text) || 0;
      if (reveal) showAnswer(want, ms);
      else clearMarksWhenSaid();
    });
    /* rung 3 and after: the dials are locked while the answer is shown */
    busy = reveal; paintLoad();
  }

  /* "Listen carefully." + the order, two clips back to back, one box */
  function sayListen() {
    var lc = i18n('lines.wrong2');
    var short = ORDER_SHORT.replace('{dest}', run.dest).replace('{words}', run.words);
    var ord = VOICE.ms(short) ? short : (lastOrder || short);
    var a = VOICE.play(lc) || 0;
    var b = VOICE.ms(ord) || 0;
    VOICE.then(ord);
    var both = lc + ' ' + ord;
    DIALOG.say('rill', both, { pos: 'top', ms: a + b });
    if (panelText) panelText.textContent = both;
    poke();
    return a + b;
  }

  /* RUNG 3 SHOWS THE ANSWER: while Rill reads the figure digit by digit, the
     dials roll to the correct number, hold it, then roll back to 0 so she
     sets it herself. The pointer then marks the first dial she has to turn. */
  function showAnswer(want, ms) {
    busy = true; paintLoad();
    clearNudge();
    later(function () { clearWrongMark(); setAll(want, true); root.classList.add('reveal'); }, 250);
    later(function () {
      root.classList.remove('reveal');
      setAll(0, true);
      touched = false;   // she turns a dial before LOAD counts again
      var s = pad(want), k = -1;
      for (var i = 0; i < N(); i++) if (+s[i] !== 0) { k = i; break; }
      if (k >= 0) {
        nudgeIdx = k;
        if (drums.wide[k]) drums.wide[k].plate.classList.add('demo');
        if (drums.close[k]) drums.close[k].plate.classList.add('demo');
        pointAt(k);
        /* the hand-nudge (rung 3): a hand on the first dial to turn */
        if (drums.wide[k]) SWIPE.show(drums.wide[k].win);
      }
      busy = false; paintLoad();
    }, Math.max(2800, ms + 700));
  }

  /* THE WIGGLE — two cycles, small, transform only, so nothing reflows and
     nothing but the dials themselves moves. */
  function shake() {
    root.classList.remove('wiggle');
    void root.offsetWidth;
    root.classList.add('wiggle');
    later(function () { root.classList.remove('wiggle'); }, 260);
  }


  /* ---- rung 3's pointer. What it SAYS is in rungContent above, with the
     other two rungs; this is only where the hand goes. */
  var nudgeIdx = -1;

  function pointAt(k) {
    if (!nudgeEl) return;
    var cx = face().bays[k];
    if (typeof cx !== 'number') return;
    nudgeEl.style.left = (cx - WIDE.nudgeW / 2) + '%';
    nudgeEl.style.top = WIDE.nudgeY + '%';
    nudgeEl.style.width = WIDE.nudgeW + '%';
    nudgeEl.style.height = WIDE.nudgeH + '%';
    nudgeEl.hidden = false;
    void nudgeEl.offsetWidth;
    nudgeEl.classList.add('on');
  }

  function clearNudge() {
    nudgeIdx = -1;
    if (nudgeEl) {
      nudgeEl.classList.remove('on');
      later(function () {
        if (!nudgeEl.classList.contains('on')) nudgeEl.hidden = true;
      }, 220);
    }
    [].forEach.call(root.querySelectorAll('.plate.demo'), function (p) {
      p.classList.remove('demo');
    });
  }

  /* the mis-set places light on the faceplate — structure, not the answer */
  /* QA Bugs 21 and 25 (13 Oct 2026): ONE MEANING PER COLOUR, AND IT GOES
     AWAY. The whole number used to turn red, mixed with the grey and blue
     the dials already wear, and it stayed red until a dial was touched —
     sometimes after the feedback was long over. Now each place says its own
     verdict, red with a cross where it is wrong and green with a tick where
     it is right, and every mark clears once Rill has finished saying what
     was wrong (or at once, if a dial is turned first). */
  var markTimer = null;
  function markWrong(got, want) {
    var g = pad(got), w = pad(want);
    clearWrongMark();
    for (var k = 0; k < N(); k++) {
      var ok = g[k] === w[k];
      [drums.wide[k], drums.close[k]].forEach(function (d) {
        if (!d) return;
        if (!ok) d.plate.classList.add('wrong');
        d.win.classList.add(ok ? 'dg-right' : 'dg-wrong');
        var m = el('b', 'dg-mark ' + (ok ? 'ok' : 'no'), d.win);
        m.textContent = ok ? '\u2713' : '\u2715';
      });
    }
  }
  function clearWrongMark() {
    clearTimeout(markTimer); markTimer = null;
    root.classList.remove('allwrong');
    [].forEach.call(root.querySelectorAll('.plate.wrong'), function (p) {
      p.classList.remove('wrong');
    });
    [].forEach.call(root.querySelectorAll('.dg-right, .dg-wrong'), function (w) {
      w.classList.remove('dg-right', 'dg-wrong');
    });
    [].forEach.call(root.querySelectorAll('.dg-mark'), function (m) {
      if (m.parentNode) m.parentNode.removeChild(m);
    });
  }
  /* the marks go once the feedback has been said out (and whatever it
     queued — the rung-2 hint — with it) */
  function clearMarksWhenSaid() {
    clearTimeout(markTimer);
    markTimer = setTimeout(function check() {
      if (VOICE.playing() || VOICE.left() > 0) { markTimer = setTimeout(check, 250); return; }
      markTimer = setTimeout(clearWrongMark, 700);
    }, 400);
    timers.push(markTimer);
  }

  /* ======================================================================= */
  /*  IDLE — informational, and it never interrupts someone working          */
  /* ======================================================================= */
  /* IT KEEPS NUDGING. It used to speak once and then never again (and a
     check that found the console busy dropped the timer for good). Now every
     stretch of nothing brings another nudge, each a little further apart —
     SHORT.idleMs, then +SHORT.idleStep each time, up to SHORT.idleMaxMs — and
     they take turns: the "start with the dial on the far left" line with the
     glow walking the dials, then the order read out again with the dials and
     LOAD pointed at. Any touch starts the wait over (the count stays, so the
     gaps do not shrink back after a single idle tap). */
  var idleCount = 0;
  function poke() {
    clearTimeout(idleTimer);
    stopWalk();
    if (!run || run.demo) return;            // nothing to set on a demo screen
    var wait = Math.min(SHORT.idleMaxMs, SHORT.idleMs + idleCount * SHORT.idleStep);
    idleTimer = setTimeout(function () {
      if (!armed) return;                    // the level is over or not begun
      /* never over a line she is still saying, a move, a win, or a word still
         typing: try again a little later */
      if (busy || !typer.done || VOICE.playing() || waiting ||
          (panel && panel.classList.contains('good'))) { poke(); return; }
      idleCount++;
      if (idleCount % 2 === 1 || !lastOrder) {
        say((run && run.idle) || IDLE_LINE);
        /* and a soft glow walks the dials left to right, which is the order
           the line is telling her to work in */
        startWalk();
      } else {
        VOICE.fresh();
        say(lastOrder);
        cueOrder(lastOrder);
        if (touched) later(beckonLoad, Math.max(600, VOICE.ms(lastOrder) - 400));
      }
      poke();
    }, wait);
  }

  function startWalk() {
    drums.wide.forEach(function (d, i) {
      if (d && d.plate) d.plate.style.animationDelay = (i * 180) + 'ms';
    });
    root.classList.add('walking');
  }
  function stopWalk() {
    root.classList.remove('walking');
  }

  /* ======================================================================= */
  /*  WIRING                                                                 */
  /* ======================================================================= */
  function preload(done) {
    var srcs = Object.keys(FACEPLATES).map(function (k) { return FACEPLATES[k].src; });
    srcs.push(FACE_BG);
    srcs.push(BRIEF.rill.src);
    var left = srcs.length;
    srcs.forEach(function (s) {
      var i = new Image();
      var next = function () {
        if (i.complete && !i.naturalWidth) {
          console.error('[titan] could not load "' + s + '" — check the filename ' +
                        'in config.js; capitals and spaces must match exactly.');
        }
        if (--left === 0) done();
      };
      i.src = ASSET(s);
      imgReady(i, next);
    });
  }

  function relayout() {
    drums.wide.forEach(function (d) { d.sizeCells(); });
    drums.close.forEach(function (d) { d.sizeCells(); });
    fitPlates();
  }

  /* THE PLACE NAMES AS BIG AS THE PLATES ALLOW (13 Oct 2026, Anmol: "make
     the font bigger so it can be seen clearly"). The row was sized by
     character count, which held TEN-THOUSANDS on one line and so shrank the
     whole row to about 11px. Now the size is MEASURED: the largest that lets
     every name in the row fit inside its plate, with TEN-THOUSANDS allowed
     to break after its hyphen onto two lines. One size for the whole row,
     re-solved on every resize. The close-up's plates are the same plates
     magnified, so the same number serves both. */
  function fitPlates() {
    if (!root || !wideOv) return;
    var plates = [].slice.call(wideOv.querySelectorAll('.plate'));
    if (!plates.length || !plates[0].getBoundingClientRect().width) return;
    var range = document.createRange();
    var fits = function () {
      return plates.every(function (p) {
        var b = p.getBoundingClientRect();
        range.selectNodeContents(p);
        var t = range.getBoundingClientRect();
        /* the space the text may use: inside the plate's padding, and kept
           off the rims top and bottom so two lines never touch them */
        return t.width <= b.width * 0.94 && t.height <= b.height * 0.9;
      });
    };
    var pl = 1.6;
    root.style.setProperty('--pl', pl.toFixed(3));
    while (pl > 0.6 && !fits()) {
      pl -= 0.04;
      root.style.setProperty('--pl', pl.toFixed(3));
    }
  }
  window.addEventListener('resize', relayout);
  /* and again whenever a web font finishes loading (the plates' face) */
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { fitPlates(); });
  }

  /* ?align=1 draws a 1px magenta outline round every overlay, so each can be
     checked against the feature it is supposed to be sitting on. Off by
     default and it changes nothing else. */
  function alignMode() {
    try { return /[?&]align=1/.test(location.search); } catch (e) { return false; }
  }

  window.startLevel = function (n, opts) {
    /* nothing the last level left on its timers (its closing hand-off, above
       all) may land on this one */
    clearTimers();
    L = LEVELS.find(function (x) { return x.id === n; }) || LEVELS[0];
    onDone = opts && opts.onComplete;
    levelWrong = 0;
    TRACK.send('level_start', { level: L.id }); TRACK.at('level ' + L.id);
    sweptThisLevel = false;
    pendingTransition = false;
    digits = L.places.map(function () { return 0; });

    var stage = document.getElementById('stage');
    var lvl = document.getElementById('level');
    if (!lvl) { lvl = document.createElement('div'); lvl.id = 'level'; stage.appendChild(lvl); }
    lvl.hidden = false;
    document.body.classList.add('in-level');

    buildLayer();
    if (alignMode()) root.classList.add('align');
    preload(function () {
      buildWide();
      buildClose();
      if (alignMode()) buildAlignProbes();
      relayout();
      setAll(0, false);
      buildJump();
      /* once more after the display font has surely arrived, so the fit is
         measured in the real face rather than the fallback */
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitPlates);
      /* THE CONSOLE IS DRAWN: tell whoever is covering it (the lesson) that it
         can go, two frames on so the faceplate has actually been painted */
      if (opts && typeof opts.onReady === 'function') {
        var ready = opts.onReady;
        requestAnimationFrame(function () { requestAnimationFrame(ready); });
      }
      if (typeof opts === 'object' && opts && typeof opts.at === 'number') {
        /* started by the jump menu: straight to the run, no brief */
        jumpTo(L.id, opts.at);
      } else if (opts && opts.transition && window.TRANSITION && L.revealLine) {
        /* THE BAY OPENS ON THE DEMO SCREEN, not here. The cover plate is laid
           on NOW, before anything is visible, so the new bay is never seen
           before it opens; the opening itself waits for L2.0 or L3.0, where
           the plate coming off and Rill naming the place are one move.
           The briefing class is NOT set here: console.css holds .comms at zero
           opacity under it, and the reveal line is on that screen — the same
           mistake that made level 2's whole brief invisible. */
        armed = false;
        pendingTransition = true;
        window.TRANSITION.arm(L);
        missionCard(startBrief);
      } else {
        missionCard(startBrief);
      }
    });

    /* one tap handler for the whole layer: it advances the brief, and in play
       it pushes in to the close-up on a bare tap of the faceplate */
    root.addEventListener('pointerdown', function (e) {
      if (tut) { tutTap(); return; }
      if (briefing) { briefTap(); return; }
      if (narrating) { if (!typer.done) finishLine(); else narrating(); return; }
      /* not armed and not briefing: the level is over, or a run has not come
         up yet. Either way the console is not taking input. */
      if (!armed) return;
      if (busy) return;
      /* TAPPING THE FACEPLATE NO LONGER PUSHES IN. The comms screen carries the
         order and her voice in the wide view, so the zoomed dial strip was a
         second place to look rather than a help — and a child drumming on a
         dial kept throwing the camera. The zoom is still here and still driven
         by levelZoomIn/Out for tests; nothing reaches it by touch. */
    });
    window.addEventListener('keydown', function (e) {
      if (!armed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (tut) { if (tut.start) tut.start.click(); else tutTap(); return; }
          if (narrating) { if (!typer.done) finishLine(); else narrating(); }
          else briefTap();
        }
        return;
      }
      if (e.key === 'Escape' && view === 'close') toWide();
    });
  };

  /* the two features nothing is drawn on, outlined only under ?align=1 so the
     measurement can be checked against the art */
  function buildAlignProbes() {
    face().bays.forEach(function (cx) {
      var e = el('div', 'probe', wideOv);
      box(e, { x: cx - WIDE.labelW / 2, y: WIDE.plateY,
               w: WIDE.labelW, h: WIDE.plateH });
      e.dataset.what = 'plate';
    });
  }

  /* ======================================================================= */
  /*  THE JUMP MENU                                                          */
  /*                                                                         */
  /*  Every level in the registry, every run inside it. It reads LEVELS, so   */
  /*  Levels 2 and 3 appear the moment they are registered — there is no      */
  /*  list of runs written down here to fall out of step.                     */
  /* ======================================================================= */
  function runLabel(r, i) {
    if (r.calibration) return r.id + '   calibration';
    if (r.split) return r.id + '   split run';
    /* THE TARGET IS NEVER PRINTED AS A NUMERAL — not on a screen, and not
       here either. This menu sits in the bottom-left corner, which is in the
       player's eye line, and it was showing the answer to the run they were
       about to be asked. The destination says which run it is without
       saying what the figure is. */
    return r.id + '   ' + (r.dest || '').toLowerCase();
  }

  function buildJump() {
    var sel = document.getElementById('jump');
    if (!sel) return;
    sel.innerHTML = '';
    LEVELS.forEach(function (lv) {
      var grp = document.createElement('optgroup');
      grp.label = i18n('ui.jumpLevel', { n: lv.id, name: lv.name });
      lv.runs.forEach(function (r, i) {
        var o = document.createElement('option');
        o.value = lv.id + ':' + i;
        o.textContent = runLabel(r, i);
        grp.appendChild(o);
      });
      sel.appendChild(grp);
    });
    sel.addEventListener('change', function () {
      var p = sel.value.split(':');
      jumpTo(+p[0], +p[1]);
      sel.blur();                    // hand the keyboard back to the game
    });
    syncJump();
  }

  function syncJump() {
    var sel = document.getElementById('jump');
    if (!sel || !L) return;
    sel.value = L.id + ':' + runIndex;
    var out = document.querySelector('#jumpWrap .jump-value');
    if (out) out.textContent =
      runLabel(L.runs[runIndex], runIndex).split('   ').join('  ·  ');
  }

  /* Jumping mid-launch has to cancel it, or the old run's callback lands on
     the new one and scores it. clearTimers() is what does that. */
  function jumpTo(levelId, i) {
    clearTimers();
    clearTimeout(idleTimer);
    busy = false;   // clearTimers() above already killed the launch callback
    if (!L || levelId !== L.id) { window.startLevel(levelId, { onComplete: onDone, at: i }); return; }
    briefing = false;
    root.classList.remove('briefing', 'powering');
    root.classList.add('live', 'plates-on');
    scrim.style.opacity = '0';
    spot.classList.remove('on');
    hideBubble();
    rill.classList.remove('in');
    rill.style.left = BRIEF.rill.from + '%';
    armed = true;
    /* the lamps for everything before it, so the badge is not lying */
    var scored = 0;
    L.runs.slice(0, i).forEach(function (r) { if (!r.calibration) scored++; });
    lamps.forEach(function (e, k) { e.classList.toggle('lit', k < scored); });
    startRun(i);
    syncJump();
  }

  /* for driving it from a test */
  window.levelJump = jumpTo;
  window.levelState = function () {
    return { level: L && L.id, run: run && run.id, runIndex: runIndex,
             digits: digits.slice(), loaded: loaded(), target: target(),
             view: view, armed: armed, busy: busy, wrong: wrongCount,
             lamps: lamps.filter(function (e) { return e.classList.contains('lit'); }).length };
  };
  window.levelSet = function (v) { if (run) setAll(v, false); };
  window.levelSend = function () { if (run && armed && !busy) send(); };
  /* the push-in, for driving the handoff from a test — the same two calls the
     faceplate tap makes, and nothing the player does not already have */
  window.levelZoomIn = function (k) { toClose(typeof k === 'number' ? k : 0); };
  window.levelZoomOut = function () { toWide(); };
  window.levelSkipBrief = function () { clearTimers(); endBrief(); };

  /* ======================================================================= */
  /*  THE TRANSITION'S HANDLE ON THE CONSOLE                                 */
  /*                                                                         */
  /*  transition.js plays the bay opening between levels. It does not reach   */
  /*  into the console: everything it needs is here, and nothing here knows   */
  /*  what it is going to do with it.                                        */
  /* ======================================================================= */
  window.LEVELUI = {
    root: function () { return root; },
    layer: function () { return wideOv; },
    /* the NEW bay — the leftmost one, the place this level has just gained */
    newBay: function () {
      var cx = face().bays[0];
      return {
        cx: cx,
        plate: WIDE.labelW ? { x: cx - WIDE.labelW / 2, y: WIDE.plateY,
                               w: WIDE.labelW, h: WIDE.plateH } : null,
        win: winRect(cx),
        arrows: arrowRect(cx),
        els: [drums.wide[0] && drums.wide[0].plate,
              drums.wide[0] && drums.wide[0].win].filter(Boolean)
          .concat([].slice.call(wideOv.querySelectorAll('.arrow')).slice(0, 2))
      };
    },
    /* the new dial, hidden while the cover is still on it */
    showNewBay: function (on) {
      this.newBay().els.forEach(function (e) {
        e.style.transition = 'opacity 220ms ease';
        e.style.opacity = on ? '1' : '0';
      });
    },
    /* the drum spins up from nothing and settles on 0 */
    spinNewDrum: function () {
      var d = drums.wide[0];
      if (!d) return;
      d.set(7, true);
      later(function () { d.set(3, true); }, 170);
      later(function () { d.set(0, true); }, 340);
      SFX.play('whir', 0);
    },
    plateW: function () { return WIDE.labelW; },
    /* the new place's name cut into its plate */
    engraveLabel: function () {
      var p = drums.wide[0] && drums.wide[0].plate;
      if (!p) return;
      p.textContent = i18n('places.' + L.places[0]);
      p.classList.toggle('long', p.textContent.length > 10);
      p.classList.remove('engrave');
      void p.offsetWidth;
      p.classList.add('engrave');
      root.classList.add('plates-on');
    },
    /* THE LESSON BORROWS THE MACHINE. teach.js builds its place-value chart
       out of these drums — the same module, the same DRUM config, the same
       roll and detent — and runs the same three rungs through rungContent, so
       what the child learns on the chart is literally the thing she operates
       in the level. */
    drum: function (host, rect, interactive, index, hooks) {
      return makeDrum(host, rect, interactive, index, hooks);
    },
    rung: rungContent,
    /* the demo may already be saying this very line: no restart */
    say: function (text) { briefing = false; if (typer.text === text) return; say(text); },
    at: function (ms, fn) { later(fn, ms); },
    lines: function () { return briefLines().length; }
  };
})();

/* ########################################################################## */
/*  TEACH.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   TEACH.JS — the place-value lesson, before levels 1 and 2.

   IT LOOKS LIKE THE CLASSROOM CHART and it works like the console. Each
   column is a cell of a place-value chart printed on card — a coloured
   header carrying the place's name and its short form, a white cell under
   it — and inside that cell is a drum borrowed from console.js through
   LEVELUI.drum: the same module, the same DRUM config, the same roll,
   detent, drag and wheel. There is no second input widget and no second way
   of showing a digit, so what the child turns on this chart is literally the
   thing she operates in the level a moment later.

   THE COLUMN COUNT IS DERIVED. It comes from the level's own `places` array,
   exactly as the console derives it. There is no literal 4, 5 or 6 in this
   file or in teach.css — and the table's frame is laid on the columns' own
   box, so it never learns how many are inside it either. A place's colour
   and short form are looked up by name in TEACH.tint and TEACH.abbr.

   THE LADDER IS THE GAME'S. A wrong Try runs LEVELUI.rung, which is the same
   function the console's wrong() calls, so the three rungs say the same
   things in the same order in the lesson as they do in a run.

   NO SECOND ANIMATION LOOP AND NO setTimeout. Every beat is an {at, fn} on
   the intro's clock through INTRO.at, so INTRO.kill() cancels the whole
   thing — the same rule transition.js and the flight follow.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     WHAT RILL SAYS, AND WHAT THE CHART DOES WHILE SHE SAYS IT.

     Each beat is { who, text, act } — act names the thing the chart does as
     the line is read. The Try items carry their own hint, which is rung 2,
     written in the same form as every hint in runs*.js: each spoken group
     mapped to its place and its digit, with the arrow glyph.
     --------------------------------------------------------------------- */
  var SCRIPT = {

    1: {
      /* opens at its own level's width and stays there */
      chart: 1,
      lead: { who: 'veth', text: i18n('teach.level1.lead') },
      /* ONE HOP = ONE TAP (16 Oct 2026): a beat per place, Nova-bot hopping
         onto each one right to left as it lights, then the 4347 example */
      beats: [
        { who: 'rill', act: 'hop:ones',
          text: i18n('teach.level1.beats.0') },
        { who: 'rill', act: 'hop:tens',
          text: i18n('teach.level1.beats.1') },
        { who: 'rill', act: 'hop:hundreds',
          text: i18n('teach.level1.beats.2') },
        { who: 'rill', act: 'hop:thousands',
          text: i18n('teach.level1.beats.3') },
        { who: 'rill', act: 'example',
          text: i18n('teach.level1.beats.4') }
      ],
      example: 4347,
      /* which places the two 4s sit in, from the left of a four-column chart.
         Derived at run time from the figure, not written down. */
      tries: [
        { target: 7554,
          say: i18n('teach.level1.tries.0.say'),
          words: i18n('teach.level1.tries.0.words') }
      ]
    },

    2: {
      /* opens at the width level 1 left it and adds ONE place, ten-thousands.
         The lakh is level 3's lesson now (16 Oct 2026). */
      chartFrom: 1, chart: 2,
      context: { who: 'veth', text: i18n('teach.level2.context') },
      lead: { who: 'veth', text: i18n('teach.level2.lead') },
      beats: [
        { who: 'rill', act: 'extend',
          text: i18n('teach.level2.beats.0') },
        { who: 'rill', act: 'name',
          text: i18n('teach.level2.beats.1') }
      ],
      tries: [
        { target: 68703,
          say: i18n('teach.level2.tries.0.say'),
          words: i18n('teach.level2.tries.0.words') }
      ]
    },

    /* LEVEL 3 TEACHES THE LAKH (16 Oct 2026): the chart level 2 left grows
       one more place, and the six-digit Try moved here from level 2. */
    3: {
      chartFrom: 2, chart: 3,
      context: { who: 'veth', text: i18n('teach.level3.context') },
      lead: { who: 'veth', text: i18n('teach.level3.lead') },
      beats: [
        { who: 'rill', act: 'extend',
          text: i18n('teach.level3.beats.0') },
        { who: 'rill', act: 'name',
          text: i18n('teach.level3.beats.1') }
      ],
      tries: [
        { target: 789543,
          say: i18n('teach.level3.tries.0.say'),
          words: i18n('teach.level3.tries.0.words') }
      ]
    }
  };

  /* NUMBER POPULATION: TEN-LAKHS AND CRORE. The chart opens on the six
     places up to lakh, already known, and opens one new place per beat.
     The Tries are the two teaching ones and then the practice set, all on
     this same chart. */
  /* 22 Oct 2026 — THE STORYBOARD'S LEVEL 1 (sheet "L1 V2"): Country A's
     4,32,56,781 on the chart; the 4 stands in the lakh place, and each new
     place that opens carries it one place left (x10 each time) until it is
     the crore. Then the practice intro and how-to-play, and the eight
     country reports as Tries — the same chart, drums and CHECK (now VERIFY).
     `show` is the figure the drums roll to once the beat's move has landed,
     `point` the column the hand then rests on, `title` the band's text. */
  var L4_TITLES = i18n('teach.level4.beatTitles');
  SCRIPT[4] = {
    chartFrom: 3, chart: 4,
    intro: { who: 'narrator', text: i18n('teach.level4.narrator') },
    context: { who: 'rill', text: i18n('teach.level4.context'),
               title: i18n('teach.level4.contextTitle') },
    lead: { who: 'rill', text: '' },
    start: 400000,
    beats: i18n('teach.level4.beats').map(function (t, k) {
      return { who: 'rill', act: ['extend:1', 'extend:1'][k] || '', text: t,
               show: [4000000, 40000000, 43256781][k], point: [0, 0, 0][k],
               title: L4_TITLES[k] || '' };
    }),
    tries: i18n('teach.level4.tries'),
    done: i18n('teach.level4.done'),
    outro: i18n('teach.level4.outro')
  };

  var T = {
    /* PACING (16 Oct 2026). A beat is VO-led: it is ready the moment its line
       has really finished (the clip's own end) AND its chart animation is
       done, plus `settle` — the one pause to tune. Then the tap cue shows; a
       tap moves on at once, and with no tap it moves on after `fallback`.
       The old fixed 2.6 s floor per line is gone. */
    settle: 600,       // the breath after a line has finished
    fallback: 3500,    // no tap: the beat moves itself on after this
    /* THE HOP. Nova-bot is slaved to the chart, not to words: each hop takes
       off `hopLead` before the place lights and lands on that frame, then
       squashes for the rest of `hopMs`. */
    hopMs: 300,        // the whole hop, landing squash included
    hopLead: 420,      // the hand's slide onto a place (teach.css .tc-pointer): it lights on arrival
    x10: 150,          // after landing, the "x10" on the gap just crossed pops
    name: 380,         // between one header lighting and the next
    arrow: 220,        // between one x10 arrow and the next
    roll: 520,         // the example rolling in
    hold: 1200,        // the example standing before it is read back
    pick: 1400,        // one 4 lit, then the other
    read: 520,         // one column lighting per place on the read-back
    slide: 520,        // a new column arriving
    win: 1800,         // the columns running after a correct Try
    spinLead: 700,     // "this is how it is supposed to be", then the drums go
    spinGap: 160,      // between one drum starting to spin and the next
    showHold: 2000,    // the answer standing on the drums
    valHold: 1800,     // every value said, all of them up together, before the next line
    out: 620,          // the screen leaving
    beforeSwipe: 800   // the first Try: number said, this beat, then "swipe it up or down"
  };

  var root = null, cols = [], bays = [], arrows = [], card = null, line = null, ask = null;
  var live = false, done = null, level = null, script = null;
  var tryIdx = -1, tryOn = false, wrongCount = 0;
  var onResize = null;
  var beatTap = null;
  var waveThrough = false;
  var titleText = null, chips = [];
  /* INACTIVITY (storyboard column O): nothing touched for this long during
     a Try and the Officer says the Try's own nudge, then waits again */
  var IDLE_MS = 12000, idleSeq = 0, lastAct = 0;

  /* INTRO.at measures from the clock's start, not from the moment of the
     call, so every beat here is scheduled against the clock's own reading. */
  function after(delay, fn) {
    INTRO.at(INTRO.now() + INTRO.ms(delay), function () { if (root) fn(); });
  }

  
  function el(tag, cls, host) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (host) host.appendChild(e);
    return e;
  }

  /* the places a lesson's chart shows, borrowed from whichever level defines
     that width — never a list written out here */
  function placesOf(id) {
    var l = LEVELS.filter(function (x) { return x.id === id; })[0];
    return l ? l.places : level.places;
  }
  function places() { return placesOf(script.chart || level.id); }
  function N() { return places().length; }

  /* the figure padded to the chart's width — the chart is as wide as the
     level says and never as wide as a literal */
  function pad(v) {
    var s = String(v);
    while (s.length < N()) s = '0' + s;
    return s;
  }
  /* a figure rolled onto the columns that are up right now, which during
     the crore beats is fewer than the chart's full width */
  function setShow(v, roll) {
    var s = String(v);
    while (s.length < cols.length) s = '0' + s;
    s = s.slice(-cols.length);
    cols.forEach(function (c, i) { c.drum.set(+s[i], !!roll); });
  }
  function setTitle(t) { if (titleText && t) titleText.textContent = t; }
  function digits() { return cols.map(function (c) { return c.drum.digit(); }); }
  function value() { return digits().reduce(function (a, d) { return a * 10 + d; }, 0); }

  /* the game's own Indian grouping, so a figure reads here as it reads there */
  function commas(n) {
    var s = String(Math.abs(n));
    if (s.length <= 3) return s;
    return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
  }

  /* ---------------------------------------------------------------------
     THE CHART. One column per place, laid out across the middle of the
     stage: a header plate with the place's name and a drum under it. The
     geometry is all derived from the count, so the chart is the same shape
     at four columns and at six.
     --------------------------------------------------------------------- */
  /* THE CHART IS ALWAYS ITS FULL WIDTH: one slot for every place the widest
     level has — up to lakh — across the whole of TEACH.chart, from the very
     first lesson. The places are RIGHT-ALIGNED, as a place-value chart is
     read: ones always in the last slot, and every slot to the left of the
     row a covered bay waiting for the place a later level opens there. */
  function widest() {
    return LEVELS.reduce(function (w, l) { return l.places.length > w.length ? l.places : w; }, []);
  }
  function slots() { return widest().length; }
  function span() { return TEACH.chart.w / slots(); }
  function slotRect(s) {
    var G = TEACH.chart, w = span();
    return { x: G.x + w * s + G.gap / 2, y: G.y, w: w - G.gap, h: G.h };
  }
  /* column i of a row of n stands in slot (slots - n + i) */
  function colRect(i, n) { return slotRect(slots() - n + i); }

  /* THE CHASSIS spans every slot, the covered ones too */
  function layCard() {
    var G = TEACH.chart, C = TEACH.card;
    card.style.left = (G.x - C.side) + '%';
    card.style.width = (G.w + C.side * 2) + '%';
  }

  /* THE COVERED BAYS, left of the row: a module powered down, with the name
     of the place it is waiting for on its plate and a blank where the drum
     will go. Level 2's lesson takes the ten-thousands one off (actExtend). */
  function layBays(n) {
    bays.forEach(function (b) { b.remove(); });
    bays = [];
    if (!n) return;
    var full = widest();
    for (var s = 0; s < slots() - n; s++) {
      var r = slotRect(s);
      var b = el('div', 'tc-col tc-bay', root);
      b.style.left = r.x + '%';
      b.style.top = r.y + '%';
      b.style.width = r.w + '%';
      b.style.height = r.h + '%';
      b.dataset.slot = s;
      el('span', 'tc-name', el('div', 'tc-plate', b)).textContent = i18n('places.' + full[s]);
      el('div', 'tc-screen tc-blank', el('div', 'tc-well', b));
      /* the keys' row, unseen and unpressable, so the blank is exactly the
         height of the screens beside it */
      var ar = el('div', 'tc-arrows', b);
      el('i', 'tc-arrow up', ar); el('i', 'tc-arrow down', ar);
      bays.push(b);
    }
  }

  function addColumn(i, n, name, slid) {
    var r = colRect(i, n);
    var c = el('div', 'tc-col' + (slid ? ' sliding' : ''), root);
    c.style.left = r.x + '%';
    c.style.top = r.y + '%';
    c.style.width = r.w + '%';
    c.style.height = r.h + '%';

    /* THE LABEL PLATE, stamped into the module's face: the place's name and
       nothing else. It is dim until the line names it, and comes up then. */
    var plate = el('div', 'tc-plate', c);
    el('span', 'tc-name', plate).textContent = i18n('places.' + name);

    /* the bezel, and the black screen recessed into it */
    var well = el('div', 'tc-well', c);
    var screen = el('div', 'tc-screen', well);
    /* THE DRUM IS THE CONSOLE'S — the same module, the same roll, detent,
       drag and wheel. Its aperture is inset inside the cell so the digit sits
       on the paper with a margin around it, the way a written one would,
       rather than filling the cell edge to edge. Its couplings come in as
       hooks so it can be live here without the console being on screen. */
    var d = LEVELUI.drum(screen, { x: 0, y: 0, w: 100, h: 100 }, true, i, {
      /* a place switched off for this Try (startTry) does not turn */
      can: function () { return tryOn && !c.classList.contains('off'); },
      poke: function () {},
      focus: function () {},
      changed: function () { onChanged(); }
    });
    d.plate = plate;
    d.sizeCells();

    /* the two arrows the console uses, so the chart is driven the same way */
    var ar = el('div', 'tc-arrows', c);
    [1, -1].forEach(function (dir) {
      var b = el('button', 'tc-arrow ' + (dir > 0 ? 'up' : 'down'), ar);
      b.type = 'button';
      b.setAttribute('aria-label', (dir > 0 ? 'Up' : 'Down'));
      el('i', 'tc-tri', b);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!tryOn || c.classList.contains('off') || voiceBusy()) return;
        d.roll(dir);
        onChanged();
      });
    });
    return { el: c, drum: d, plate: plate, place: name };
  }

  /* `known` is for a chart the child has already been taught: level 2 opens
     on the one level 1 left behind, so those places are coloured in from the
     start and only the new ones arrive blank and get named. */

  function buildChart(n, names, known) {
    cols.forEach(function (c) { c.el.remove(); });
    cols = [];
    layCard();
    layBays(n);
    for (var i = 0; i < n; i++) {
      var c = addColumn(i, n, names[i], false);
      if (known) c.plate.classList.add('lit');
      cols.push(c);
    }
    /* the card and its rules only exist where there is a table to print:
       level 3 hands over without one */
    root.classList.toggle('charted', n > 0);
  }

  /* ---- the beats ------------------------------------------------------- */

  /* the headers name themselves RIGHT TO LEFT, which is the order the places
     are built in and the order the line says them in */
  function actName(t0) {
    /* NOVA-BOT HOPS ACROSS THE ROW, right to left, and each plate lights on
       the frame its foot lands (16 Oct 2026). The hop takes off T.hopLead
       before that moment, so t0 must leave room for it. */
    t0 = Math.max(t0, T.hopLead);
    var mine = lineNo;
    cols.forEach(function (c, i) {
      var k = cols.length - 1 - i;              // right-hand column first
      after(t0 + k * T.name - T.hopLead, function () {
        if (mine !== lineNo) return;
        BOT.hopTo(c, function () { c.plate.classList.add('lit'); });
      });
    });
    return t0 + (cols.length - 1) * T.name + T.hopMs;
  }

  /* ONE PLACE PER BEAT (level 1): the bot hops onto it and it lights as the
     foot lands; 150 ms later the "x10" pops on the gap it just crossed —
     the x10 beat folded into the hop. Ones, the first, has no gap behind. */
  function actHop(t0, place) {
    t0 = Math.max(t0, T.hopLead);
    var i = -1;
    cols.forEach(function (c, k) { if (c.place === place) i = k; });
    if (i < 0) return t0;
    var c = cols[i], mine = lineNo;
    after(t0 - T.hopLead, function () {
      if (mine !== lineNo) return;
      BOT.hopTo(c, function () {
        c.plate.classList.add('lit');
        SFX.play('tick');
        if (i < cols.length - 1) after(T.x10, function () { popX10(i); });
      });
    });
    return t0 + T.hopMs + T.x10 + 300;
  }

  /* THE x10 BADGE on the gap between column i and the place on its right,
     the gap the bot has just hopped across. It stays up for the lesson's
     place beats and goes when the example comes in. */
  var x10s = [];
  function popX10(i) {
    if (!root || !cols[i] || !cols[i + 1]) return;
    var r = colRect(i, cols.length), G = TEACH.chart;
    if (x10s.some(function (b) { return b.place === cols[i].place; })) return;
    var b = el('div', 'tc-x10', root);
    b.textContent = '\u00d710';
    b.style.left = (r.x + r.w + G.gap / 2) + '%';
    b.style.top = (G.y + G.h * 0.09) + '%';
    x10s.push({ place: cols[i].place, el: b });
  }
  function clearX10() {
    x10s.forEach(function (b) { b.el.classList.add('gone'); setTimeout(function () { b.el.remove(); }, 260); });
    x10s = [];
  }

  /* ---- NOVA-BOT -----------------------------------------------------------
     The little Nova cut-out the console's tutorial uses, standing on the top
     edge of the chart's modules. hopTo(col, onLand) arcs it onto a column
     and calls onLand on the frame it touches down (squash-and-stretch on
     the way); pointAt(col) turns it to a column and puts the hand on it;
     toStart() hops it down beside CHECK for the Try. Reduced motion: no
     arcs — it is simply there, and onLand runs at once. */
  /* 19 Oct 2026 (Anmol): NO LITTLE NOVA ON THE CHART — the 3D hand nudge
     does her job. BOT keeps its old calls so the beats are unchanged:
     hopTo moves the hand onto a place and lands (lights it) when the hand
     has arrived; pointAt is the hand; the rest put the hand away. */
  var BOT = (function () {
    var landT = 0;
    return {
      startBy: function () { pointTo(null); },
      hopTo: function (c, onLand) {
        if (!c) return;
        clearTimeout(landT);
        var first = !namePtr || !namePtr.classList.contains('on');
        pointTo(c);
        if (!onLand) return;
        if (INTRO.REDUCED || first) onLand();
        else landT = setTimeout(function () { if (root) onLand(); }, T.hopLead);
      },
      aside: function () { pointTo(null); },
      pointAt: function (c) { if (c) pointTo(c); },
      toStart: function () { pointTo(null); },
      hide: function () { pointTo(null); },
      reset: function () { clearTimeout(landT); },
      state: function () { return namePtr ? { on: namePtr.classList.contains('on'), x: parseFloat(namePtr.style.left) || 0, y: parseFloat(namePtr.style.top) || 0 } : null; }
    };
  })();

  var namePtr = null, nudged = null, nudgeT = 0;
  /* 16 Oct 2026 (Anmol): THE DIGIT LIGHTS WHEN THE HAND LANDS ON IT — once
     the hand has finished moving there (its 420 ms slide in teach.css), and
     it goes dark again as the hand leaves for the next one. */
  function nudge(col) {
    clearTimeout(nudgeT);
    if (nudged && nudged !== col) nudged.el.classList.remove('nudged');
    nudged = col || null;
    if (!col) return;
    nudgeT = setTimeout(function () { if (nudged === col && root) col.el.classList.add('nudged'); }, 420);
  }
  function pointTo(col) {
    if (!root) return;
    nudge(col);
    if (!col) { if (namePtr) namePtr.classList.remove('on'); return; }
    if (!namePtr || !namePtr.isConnected) {
      namePtr = el('i', 'tc-pointer', root);
      namePtr.innerHTML = SWIPE.hand();
    }
    /* 19 Oct 2026 (Anmol): the hand points DOWN onto the block from above it */
    /* from the chart's own layout, not the element's box: a module still
       sliding in would put the hand beside it */
    var ci = cols.indexOf(col);
    if (ci < 0) return;
    var r = colRect(ci, cols.length);
    namePtr.style.left = (r.x + r.w / 2).toFixed(2) + '%';
    namePtr.style.top = (r.y - 0.4).toFixed(2) + '%';
    namePtr.classList.add('on');
    namePtr.classList.remove('tap'); void namePtr.offsetWidth; namePtr.classList.add('tap');
  }

  /* one arrow per gap, each pointing from a place to the place on its LEFT,
     because that is the direction the value multiplies in */
  /* THE x10 BEAT. The row of arrows that used to be drawn across the top of
     the chart is gone with the single card it was printed on — the line is
     still read, and the chart simply holds while it is. */
  function actTimes(t0) {
    return t0 + cols.length * T.arrow;
  }

  /* ---- SAYING A VALUE, AND SHOWING IT -----------------------------------
     A digit's value pops up out of its column AS THE LINE SAYS IT, and then
     stays parked on top of the column until the next line begins (say()
     clears them). Where in the line each value is said is found in the line
     itself, so the lines can be reworded in locales.json and the values still
     land on the right words. */
  var UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  var TENS_W = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  var lineText = '', lineMs = 0;              // the line being said, and how long it takes
  var lineNo = 0;                             // counts lines, so a cue knows whose it is

  /* the ways a digit's value can be said: with its place ("4 thousands",
     "four thousand") or, for tens and ones, by the word that names them on
     their own ("forty", "seven") */
  function sayings(d, power) {
    var n = String(d), w = UNITS[d];
    switch (power) {
      case 0: return [n + ' ones', w + ' ones', w];
      case 1: return [n + ' tens', w + ' tens', TENS_W[d]];
      case 2: return [n + ' hundred', w + ' hundred'];
      case 3: return [n + ' thousand', w + ' thousand'];
      case 4: return [n + ' ten thousand', n + ' ten-thousand', w + ' ten thousand', TENS_W[d]];
      case 5: return [n + ' lakh', w + ' lakh'];
      case 6: return [n + ' ten lakh', w + ' ten lakh', TENS_W[d]];
      default: return [n + ' crore', w + ' crore'];
    }
  }
  /* where the line has finished saying it, searching from `from` on so the
     values are found in the order they are said; null if it is not said */
  function cue(d, power, from) {
    var best = null;
    sayings(d, power).forEach(function (p) {
      if (!p) return;
      /* the place may be said in the plural: "4 thousands" */
      var re = new RegExp('(^|[^a-z0-9])' + p.replace(/[-]/g, '\\-') + 's?(?![a-z])', 'ig');
      re.lastIndex = from;
      var m = re.exec(lineText);
      if (m) {
        var end = m.index + m[0].length;
        if (!best || m.index < best.at) best = { at: m.index, end: end };
      }
    });
    return best;
  }
  /* ms into the line at which the voice reaches a character */
  function when(ch) { return lineText.length ? ch / lineText.length * lineMs : 0; }
  /* that moment in real time: after() is halved for reduced motion, and the
     voice is not */
  function onVoice(ms, fn) { INTRO.at(INTRO.now() + ms, function () { if (root) fn(); }); }
  /* A CUE BELONGS TO ITS LINE. If the lesson has moved on before the cue's
     moment comes (a tap to the next line, a Try starting), it is dropped —
     otherwise "40" from the example would land on the Try after it, with
     nothing left to clear it. */
  function onLine(ms, fn) {
    var mine = lineNo;
    onVoice(ms, function () { if (mine === lineNo) fn(); });
  }

  /* THE PARKED VALUE: "4,000" popped up over the thousands column, staying
     there until the next line. A 0 shows nothing. */
  var vals = [];
  /* 16 Oct 2026 (Anmol): THE HAND, NOT A HIGHLIGHT. As a digit is said, the
     pointing hand moves onto it — no value popping up over the column and no
     glow on the module. A 0 before the first digit (the dark places) is
     skipped; a 0 inside the number is pointed at, since it holds that place. */
  function showValue(i, digits) {
    var d = +digits[i];
    if (!cols[i] || !root) return;
    if (!d && !/[1-9]/.test(String(digits).slice(0, i))) return;
    pointTo(cols[i]);
    SFX.play('tick');
  }
  function clearValues(keepHand) {
    if (!keepHand) pointTo(null);
    vals.forEach(function (t) {
      t.el.classList.add('gone');
      setTimeout(function () { t.el.remove(); }, 260);
    });
    vals = [];
  }
  /* light the column as its value is said */
  function flash(i, cls, ms) { /* the hand does this now (16 Oct 2026) */ }


  /* THE EXAMPLE: the figure rolls in as the line says it, and the two like
     digits light up, and show what they are worth, as the line says each
     one ("this 4 is four thousand, and this 4 is forty") */
  function actExample(t0) {
    var s = pad(script.example), fig = String(script.example);
    var at = lineText.indexOf(fig);
    var t = at >= 0 ? Math.max(t0, when(at)) : t0;
    /* measured: the figure rolls in as "4347" is said */
    var rk = VOICE_CUES[String(lineText).replace(/\s+/g, ' ').trim().toLowerCase()];
    if (rk && typeof rk.roll === 'number') t = Math.max(t0, rk.roll);
    cols.forEach(function (c, i) {
      onLine(t + i * 120, function () { c.drum.set(+s[i], true); });
    });
    var rolled = t + cols.length * 120 + T.roll;

    /* WHICH digits get picked is derived: the first digit that appears twice
       in the figure, and the two places it sits in. Nothing here is written
       down, so the example can change in one place. */
    var seen = {}, dup = -1;
    for (var i = 0; i < s.length && dup < 0; i++) {
      if (seen[s[i]] !== undefined) dup = +s[i];
      seen[s[i]] = i;
    }
    var picks = [s.indexOf(String(dup)), s.lastIndexOf(String(dup))];
    var from = at >= 0 ? at + fig.length : 0, last = rolled;
    /* MEASURED: each 4 is pointed at on its own spoken word, off the clip's
       playhead, and the hand goes once the line is said */
    var seq = cueSeq(lineText), mine = lineNo;
    if (seq && seq.length >= picks.length) {
      picks.forEach(function (col, k) {
        VOICE.reach(lineText, seq[k], function () { if (root && mine === lineNo) { showValue(col, s); BOT.pointAt(cols[col]); } });
      });
      VOICE.reach(lineText, VOICE.ms(lineText) || 0, function () {
        INTRO.at(INTRO.now() + 1000, function () { if (root && mine === lineNo) pointTo(null); });
      });
      return Math.max(last, seq[seq.length - 1]) + T.valHold;
    }
    picks.forEach(function (col, k) {
      var c = cue(+s[col], cols.length - 1 - col, from);
      var tc = c ? Math.max(rolled, when(c.end)) : rolled + T.hold + k * T.pick;
      if (c) from = c.end;
      onLine(tc, function () { flash(col, 'pick', T.pick); showValue(col, s); BOT.pointAt(cols[col]); });
      last = Math.max(last, tc);
    });
    return last + T.valHold;
  }

  /* THE READ-BACK: each place lights, and its value comes up, as the line
     names it — "4 thousands, 3 hundreds, forty-seven" */
  function actReadback(t0) {
    var sd = pad(script.example), from = 0, t = t0;
    var seq = cueSeq(lineText), mine = lineNo;
    if (seq) {
      var n = 0;
      cols.forEach(function (c, i) {
        if (!+sd[i] && !/[1-9]/.test(sd.slice(0, i))) return;      // a dark place
        var at = seq[Math.min(n++, seq.length - 1)];
        VOICE.reach(lineText, at, function () { if (root && mine === lineNo) showValue(i, sd); });
      });
      VOICE.reach(lineText, VOICE.ms(lineText) || 0, function () {
        INTRO.at(INTRO.now() + 1000, function () { if (root && mine === lineNo) pointTo(null); });
      });
      return seq[seq.length - 1] + T.valHold;
    }
    cols.forEach(function (c, i) {
      var cu = cue(+sd[i], cols.length - 1 - i, from);
      var tc = cu ? Math.max(t0, when(cu.end)) : t + T.read;
      if (cu) from = cu.end;
      t = tc;
      onLine(tc, function () { flash(i, 'read', T.read * 1.6); showValue(i, sd); });
    });
    return t + T.valHold;
  }

  /* LEVEL 2: the chart EXTENDS rather than being rebuilt. The columns that
     are already there slide right into their new places and the new ones
     arrive on the left under a cover plate, which is the same bolt-and-plate
     move transition.js makes on the console's own bay. */
  function actExtend(t0, upto) {
    var names = places(), n = names.length, was = cols.length;
    var stop = upto ? Math.max(0, n - was - upto) : 0;   // the last k opened
    /* THE PLACES ALREADY UP DO NOT MOVE: the row is right-aligned on a chart
       that was full width from the start, so they are already in their slots.
       The new places open in the covered bays to their left, one after
       another — the plate lifts off and the module slides in under it. */
    for (var k = n - was - 1; k >= stop; k--) {
      (function (k, ord) {
        after(t0 + T.slide + ord * T.slide, function () {
          var s = slots() - n + k;
          var bay = bays.filter(function (b) { return +b.dataset.slot === s; })[0];
          if (bay) {
            bays = bays.filter(function (b) { return b !== bay; });
            bay.classList.add('opening');
            after(T.slide, function () { bay.remove(); });
          }
          var c = addColumn(k, n, names[k], true);
          cols.unshift(c);
          void c.el.offsetWidth;
          c.el.classList.remove('sliding');
          c.drum.sizeCells();
          /* and again once it has landed, so its digit matches the rest */
          after(T.slide + 40, function () {
            cols.forEach(function (o) { o.drum.sizeCells(); });
          });
          SFX.play('lever');
          /* NOVA-BOT hops onto the new place, landing as its plate lights
             (the same moment the plate always lit), and the x10 pops on the
             gap it crossed */
          after(T.slide * 0.6 - T.hopLead, function () {
            BOT.hopTo(c, function () {
              c.plate.classList.add('lit');
              after(T.x10, function () { popX10(cols.indexOf(c)); });
            });
          });
        });
      })(k, n - was - 1 - k);
    }
    return t0 + T.slide * (n - was - stop + 1) + T.x10 + 300;
  }

  /* ---- the Try --------------------------------------------------------- */

  function startTry(i) {
    if (!root) return;
    tryIdx = i; wrongCount = 0;
    var item = script.tries[i];
    /* a Try starts on a clean chart: nothing the last line put up, and no
       cue from it still to come */
    clearValues();
    clearX10(); cueNext(false);
    lineNo++;
    cols.forEach(function (c) { c.drum.set(0, true); });
    /* ONLY THE PLACES THIS NUMBER USES ARE LIVE. A place to the left of its
       first digit is switched off for the Try — powered down like a covered
       bay, and it will not turn — so sixty-eight thousand seven hundred three
       is set on five places with the lakh dark, and the lakh lights back up
       for a number that reaches it. */
    var uses = String(item.target).length;
    cols.forEach(function (c, k) { c.el.classList.toggle('off', k < cols.length - uses); });
    setTouched(false);
    clearMarks();
    chips.forEach(function (ch, k) { ch.classList.toggle('cur', k === i); });
    whenQuiet(function () {
      say(item.who || 'rill', item.say);
      armIdle(item);
      var mine = lineNo, end = VOICE.ms(item.say) || 0;
      /* 16 Oct 2026: THE NUMBER IN WORDS GLOWS as Rill says it, and goes back
         once the line is said */
      var wordsAt = cueMs(item.say, 'words', item.words, false);
      VOICE.reach(item.say, wordsAt, function () { if (root && mine === lineNo) ask.classList.add('lit'); });
      VOICE.reach(item.say, end + 300, function () { if (root) ask.classList.remove('lit'); });
      if (level && level.id === NP_LEVEL && i === 0) {
        /* AND THE SWIPE LINE WAITS: the number line is said out, then a
           beat of T.beforeSwipe, and only then the hand and "swipe it up or
           down" — its own clip, its own box */
        VOICE.reach(item.say, end, function () {
          INTRO.at(INTRO.now() + T.beforeSwipe, function () {
            if (!root || mine !== lineNo || !tryOn || root.classList.contains('touched')) return;
            SWIPE.show(cols[0] && cols[0].el.querySelector('.tc-screen'), cols[0] && cols[0].drum);
            var sw = i18n('lines.swipe');
            VOICE.play(sw);
            DIALOG.say('rill', sw, { pos: 'bottom', ms: VOICE.ms(sw) });
          });
        });
      }
    });
    /* the country's data in words, and the number its report wrongly has */
    ask.innerHTML = '';
    el('span', 'tc-ask-words', ask).textContent =
      i18n('teach.ask', { words: item.words, country: item.country || '' });
    if (item.wrong) el('span', 'tc-ask-wrong', ask).textContent = i18n('teach.reported', { n: item.wrong });
    ask.classList.add('on');
    after(700, function () { tryOn = true; root.classList.add('trying'); });
  }

  function armIdle(item) {
    var mine = ++idleSeq;
    lastAct = performance.now();
    if (!item.idle) return;
    (function wait() {
      after(IDLE_MS, function () {
        if (mine !== idleSeq || !tryOn) return;
        if (VOICE.playing() || performance.now() - lastAct < IDLE_MS - 100) return wait();
        say('rill', item.idle);
        if (ask) {
          ask.classList.add('lit');
          after(1600, function () { if (ask) ask.classList.remove('lit'); });
        }
        lastAct = performance.now();
        wait();
      });
    })();
  }

  /* CHECK IS A DISABLED BUTTON until a dial has been turned on this Try
     (QA Bug 20): it cannot be pressed at all, and it wakes the moment the
     child scrolls a dial. */
  var goBtn = null;
  function setTouched(on) {
    if (root) root.classList.toggle('touched', !!on);
    if (goBtn) {
      goBtn.disabled = !on;
      goBtn.setAttribute('aria-disabled', on ? 'false' : 'true');
    }
  }


  function onChanged() {
    if (!root) return;
    if (tryOn) setTouched(true);
    lastAct = performance.now();
    /* the rung went with the attempt it was about */
    root.classList.remove('bad');
    clearMarks();
  }

  function submit() {
    if (!tryOn) return;
    var item = script.tries[tryIdx];
    TRACK.send('lesson_answer', { level: level && level.id, attempt: wrongCount + 1,
                                  correct: value() === item.target, given: value(), target: item.target });
    if (value() === item.target) return good();
    wrong(item);
  }

  function good() {
    tryOn = false;
    idleSeq++;
    if (chips[tryIdx]) chips[tryIdx].classList.add('done');
    SWIPE.hide();
    if (ask) ask.classList.remove('on');
    root.classList.remove('bad', 'trying');
    clearMarks();
    SFX.play('lock');
    SFX.play('clap');
    root.classList.add('cheer');
    after(T.win, function () { if (root) root.classList.remove('cheer'); });
    if (card) FX.confetti(40, card);
    /* the clap and the confetti answer the press at once; "That is it" and
       the read-back wait for her to finish the line she is on */
    var idx = tryIdx;
    whenQuiet(function () {
      var it = script.tries[idx];
      var spoke = it.right ? say('computer', it.right)
                           : say('rill', i18n('teach.right', { figure: commas(it.target) }));
      /* the columns run left to right, which is the reading order the whole
         lesson has been in */
      var sd = pad(script.tries[idx].target);
      cols.forEach(function (c, i) {
        var mine = lineNo;
        after(i * T.read, function () {
          if (mine !== lineNo) return;            // a newer line has the chart
          showValue(i, sd);
        });
        after(i * T.read + T.read, function () { c.el.classList.remove('read'); });
      });
      /* the next Try follows a beat after the line; after the LAST one the
         lesson waits for everything — the line and the read-back running
         across the columns — and lead() then holds its gap from there */
      var last = idx + 1 >= script.tries.length;
      var readback = cols.length * T.read + T.read;
      after(last ? Math.max(T.win, readback, spoke) : Math.max(T.win, spoke + 400), function () {
        if (!last) startTry(idx + 1);
        else lead();
      });
    });
  }

  /* ONE LINE AT A TIME, as on the console: a line asked for while the last
     one is still being said waits for it, and TIME.lineHold after it. Only
     the newest request waits, so presses cannot stack lines up. On the
     intro's clock in real time (onVoice), so it dies with the lesson. */
  var waiting = null;
  function whenQuiet(fn) {
    var mine = waiting = {};
    (function check() {
      if (waiting !== mine || !root) return;
      if (VOICE.playing()) { onVoice(120, check); return; }
      var rest = TIME.lineHold - VOICE.quietFor();
      if (rest <= 0) { waiting = null; fn(); return; }
      onVoice(rest, function () { if (waiting === mine) { waiting = null; fn(); } });
    })();
  }

  /* THE LESSON'S OWN TWO RUNGS, taken in turn. Odd misses: Rill reads the
     number out again. Even misses: the drums spin to the answer, hold it,
     spin back to zero, and he reads it out again for another go. */
  function wrong(item) {
    wrongCount++;
    root.classList.add('bad');
    SFX.play('wrong');
    markWrong(item.target);
    shake();

    /* the buzz and the red answer at once; what she says waits its turn */
    lastAct = performance.now();
    /* the storyboard's own feedback for this report: what is wrong, then the
       hint (odd misses); the reveal is said as the drums show it (even) */
    if (wrongCount % 2 === 1) {
      whenQuiet(function () {
        say('rill', item.fb1 ? item.fb1 + ' ' + item.fb2
                             : i18n('teach.wrongFirst', { words: item.words }));
      });
      return;
    }
    /* hands off now; the showing starts once she has finished her line */
    tryOn = false;
    root.classList.remove('trying');
    whenQuiet(function () { showAnswer(item); });
  }

  /* spin every drum a full turn and on to its digit, left to right */
  function spinTo(ds) {
    cols.forEach(function (c, i) {
      if (c.el.classList.contains('off')) return;     // a dark place stays at 0
      after(i * T.spinGap, function () {
        var diff = ((ds[i] - c.drum.digit()) % 10 + 10) % 10;
        c.drum.roll(diff + 10);
      });
    });
  }

  function showAnswer(item) {
    /* hands off while she shows it */
    tryOn = false;
    root.classList.remove('trying');
    say('rill', item.fb3 || i18n('teach.wrongShow'));

    var answer = pad(item.target).split('').map(Number);
    var zeros = answer.map(function () { return 0; });
    var spin = (cols.length - 1) * T.spinGap + DRUM.ms;
    var t = T.spinLead;
    after(t, function () {
      root.classList.remove('bad');
      clearMarks();
      spinTo(answer);
    });
    t += spin + T.showHold;
    after(t, function () { spinTo(zeros); });
    t += spin + 200;
    after(t, function () {
      whenQuiet(function () {
        say('rill', item.idle || i18n('teach.again', { words: item.words }));
        lastAct = performance.now();
        tryOn = true;
        setTouched(false);
        root.classList.add('trying');
      });
    });
  }

  /* QA Bugs 21 and 25: each live place shows its own verdict — red with a
     cross, green with a tick — instead of the whole chart going red, and the
     marks clear once the feedback has been said */
  function markWrong(want) {
    var s = pad(want), d = digits();
    clearMarks();
    cols.forEach(function (c, i) {
      if (c.el.classList.contains('off')) return;
      var ok = d[i] === +s[i];
      c.plate.classList.toggle('wrong', !ok);
      c.el.classList.add(ok ? 'dg-right' : 'dg-wrong');
      var m = el('b', 'dg-mark ' + (ok ? 'ok' : 'no'), c.el.querySelector('.tc-screen') || c.el);
      m.textContent = ok ? '\u2713' : '\u2715';
    });
    var mine = ++markSeq;
    (function check() {
      after(400, function () {
        if (mine !== markSeq || !root) return;
        if (VOICE.playing() || VOICE.left() > 0) return check();
        after(700, function () { if (mine === markSeq) clearMarks(); });
      });
    })();
  }
  var markSeq = 0;
  function clearMarks() {
    markSeq++;
    if (root) {
      root.classList.remove('allwrong');
      [].forEach.call(root.querySelectorAll('.dg-mark'), function (m) {
        if (m.parentNode) m.parentNode.removeChild(m);
      });
    }
    cols.forEach(function (c) {
      c.plate.classList.remove('wrong');
      c.el.classList.remove('point', 'dg-right', 'dg-wrong');
    });
  }
  function shake() {
    if (!root) return;
    root.classList.remove('wiggle');
    void root.offsetWidth;
    root.classList.add('wiggle');
    after(300, function () { root.classList.remove('wiggle'); });
  }


  /* ---- the voice ------------------------------------------------------- */
  function say(speaker, text, onEnd, keepHand) {
    if (!root) return 0;
    /* a new line takes down the values the last one put up — the hand stays
       on when the next beat moves it on (place to place) */
    clearValues(keepHand);
    if (!keepHand) pointTo(null);
    root.setAttribute('data-who', speaker);
    line.textContent = text;
    root.classList.add('talking');
    /* onEnd is the clip's REAL end (VOICE's onended, or its stall watchdog).
       A line with no clip, or one already being said, has no end to wait on,
       so it is called once the time play() reports has passed. */
    var ended = false;
    var end = function () { if (ended) return; ended = true; if (onEnd) onEnd(); };
    var ms = VOICE.play(text, end);
    if (onEnd) INTRO.at(INTRO.now() + (ms ? ms + 1500 : 0), end);
    DIALOG.say(speaker, text, { pos: 'bottom', ms: ms });
    /* kept for the value cues: the line, and how long it takes to say (with
       no clip, how long the dialogue box takes to type it — 38ms a letter) */
    lineNo++;
    lineText = text;
    lineMs = ms || text.length * 38;
    return ms;
  }

  /* ---- the run of it --------------------------------------------------- */

  function build() {
    var stage = document.getElementById('stage');
    root = el('div', 'teach', stage);
    root.id = 'teach';
    el('i', 'tc-veil', root);

    /* THE CHASSIS the modules are mounted in, laid out from TEACH.chart and
       TEACH.card — the same block colRect reads, so the frame and what sits
       on it can never drift apart. It needs no knowledge of how many modules
       are inside it. */
    var G = TEACH.chart, C = TEACH.card;
    card = el('i', 'tc-card', root);
    card.style.top = (G.y - C.top) + '%';
    card.style.height = (G.h + C.top + C.foot) + '%';
    layCard();

    /* the voice sits above the chassis, and CHECK just under it */
    var bar = el('div', 'tc-line', root);
    bar.style.bottom = (100 - (G.y - C.top) + TEACH.lineGap) + '%';
    line = el('p', 'tc-text', bar);

    /* THE NUMBER TO SET, on screen during a Try — the storyboard's on-screen
       text for these rows ("Try: seven thousand five hundred fifty-four").
       The rest of the lesson is voice only. A tap says it again. */
    ask = el('button', 'tc-ask', root);
    ask.type = 'button';
    ask.style.bottom = bar.style.bottom;
    ask.addEventListener('click', function (e) {
      e.stopPropagation();
      var it = script && script.tries[tryIdx];
      if (it) { VOICE.fresh(); VOICE.play(it.say); }
    });

    /* THE TITLE, centred in the band above the chassis so the top of the
       screen is never empty while the lesson is taught. It comes straight
       after the Try box in the markup because teach.css hides it with a
       sibling rule whenever that box is up in the same place. */
    var title = el('div', 'tc-title', root);
    title.style.top = ((G.y - C.top) / 2) + '%';
    titleText = el('span', 'tc-title-text', title);
    titleText.textContent = i18n('teach.title');

    /* ONE MARKER PER COUNTRY REPORT, top right: the one being checked is
       lit, and each turns green with a tick once it is verified */
    chips = [];
    if (script.tries.some(function (t) { return t.country; })) {
      var row = el('div', 'tc-countries', root);
      script.tries.forEach(function (t) {
        var ch = el('span', 'tc-cty', row);
        ch.textContent = t.country;
        chips.push(ch);
      });
    }

    /* CHECK only where there is something to check — level 3's lesson is
       just the hand-over, with no Try on it */
    if (script.tries.length) {
      var go = el('button', 'ctl tc-go', root);
      go.type = 'button';
      go.style.top = (G.y + G.h + C.foot + TEACH.goGap) + '%';
      go.textContent = i18n('teach.check');
      /* QA Bug 20 (13 Oct 2026): CHECK is dim and does nothing until a dial
         has been turned on this Try. A press before that points at the
         first dial instead of marking an empty chart wrong. */
      go.disabled = true;
      goBtn = go;
      go.addEventListener('click', function (e) {
        e.stopPropagation();
        if (go.disabled || !root || !root.classList.contains('touched')) return;
        submit();
      });
    }

    /* a tap anywhere else moves a read-only beat along. BUBBLE PHASE, not
       capture: stopping the event on its way DOWN kept it from ever reaching
       a drum's window, so the digits could not be dragged. Stopped on its way
       back up, it still never reaches the stage behind this screen. */
    root.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      if (e.target.closest('.tc-arrow, .tc-go, .window')) return;
      if (beatTap) beatTap();
    });

    /* the digit is sized in pixels off its aperture, so it has to be sized
       again when the stage is. Not a loop — the same resize event the
       console already listens on. */
    onResize = function () {
      cols.forEach(function (c) { c.drum.sizeCells(); });
    };
    window.addEventListener('resize', onResize);
  }

  /* EVERY BEAT IS VO-LED AND SELF-PACED (16 Oct 2026). A beat is ready at
     max(the line's real end, its chart animation's end) + T.settle. Then the
     tap cue shows: a tap moves on at once, and with no tap it moves on by
     itself after T.fallback. Before it is ready a tap does nothing, so the
     voice is never cut off. */
  /* 19 Oct 2026 (Varsha): BACK AND FORWARD through the lesson's steps.
     Forward cuts the line and goes on to the next step at once; back opens
     the lesson again at the step before (the chart put into the state the
     earlier steps leave it in, as the DEV jump does). Gone during a Try. */
  var beatAt = null, navEls = null;
  function buildNav() {
    if (!root || (navEls && navEls[0].isConnected)) return;
    var G = TEACH.chart, C = TEACH.card;
    navEls = [-1, 1].map(function (dir) {
      var b = el('button', 'tc-nav ' + (dir < 0 ? 'back' : 'fwd'), root);
      b.type = 'button';
      b.setAttribute('aria-label', dir < 0 ? 'Back' : 'Next');
      b.style.top = (G.y + G.h + C.foot + TEACH.goGap) + '%';
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      b.addEventListener('click', function (e) { e.stopPropagation(); if (dir < 0) navBack(); else navNext(); });
      return b;
    });
  }
  function showNav(on) {
    buildNav();
    if (!navEls) return;
    navEls.forEach(function (b) { b.classList.toggle('on', !!on); });
    if (on && beatAt) navEls[0].disabled = beatAt.i <= 0;
  }
  function navNext() {
    if (!root || !beatAt || tryOn) return;
    var a = beatAt;
    VOICE.stop(); lineNo++; beatTap = null;
    runBeats(a.list, a.i + 1, a.then);
  }
  function navBack() {
    if (!root || !beatAt || tryOn || beatAt.i <= 0) return;
    var b = beatAt.i - 1, lv = level, d = done;
    VOICE.stop(); lineNo++; beatTap = null;
    if (root.parentNode) root.parentNode.removeChild(root);
    if (onResize) { window.removeEventListener('resize', onResize); onResize = null; }
    root = null; cols = []; bays = []; vals = []; arrows = []; card = null;
    line = null; ask = null; goBtn = null;
    x10s = []; nextEl = null; navEls = null; namePtr = null; beatAt = null;
    tryOn = false; tryIdx = -1; live = false; done = null;
    play(lv, d, { beat: b });
  }

  function runBeats(list, i, then) {
    if (!root) return;
    beatTap = null; cueNext(false);
    beatAt = i < list.length ? { list: list, i: i, then: then } : null;
    showNav(i < list.length);
    if (i >= list.length) {
      /* the lesson's place beats are over: the bot hops down to CHECK */
      if (script.tries.length) BOT.toStart();
      return then();
    }
    var beat = list[i], act = beat.act || '';
    var voDone = false, animDone = false, ready = false, mine;
    if (beat.title) setTitle(beat.title);
    function check() {
      if (!voDone || !animDone || ready) return;
      ready = true;
      INTRO.at(INTRO.now() + T.settle, function () {
        if (!root || mine !== lineNo) return;
        var go = function () { if (beatTap !== go) return; beatTap = null; cueNext(false); runBeats(list, i + 1, then); };
        /* 16 Oct 2026 (Anmol): NO "Tap to continue" — the lesson runs on by
           itself, a T.settle breath after each line. */
        beatTap = go;
        go();
      });
    }
    say(beat.who, beat.text, function () { voDone = true; check(); },
        act.indexOf('hop:') === 0 || act.indexOf('extend') === 0);
    mine = lineNo;
    var anim = 0;
    if (act === 'example') { clearX10(); BOT.aside(); }
    if (act.indexOf('hop:') === 0) anim = actHop(0, act.slice(4).toUpperCase());
    else if (act === 'name') anim = actName(T.hopLead);
    else if (act === 'times') anim = actTimes(200);
    else if (act === 'example') anim = actExample(200);
    else if (act === 'readback') anim = actReadback(200);
    else if (act.indexOf('extend') === 0) {
      /* the new place arrives ON its name: the plate lights T.slide * 0.6
         after the module starts in, which starts T.slide after t0 */
      var ec = VOICE_CUES[String(beat.text).replace(/\s+/g, ' ').trim().toLowerCase()];
      anim = actExtend(ec && ec.land ? Math.max(200, ec.land - T.slide * 1.6) : 200, +act.split(':')[1] || 0);
    }
    /* after() runs at half time under reduced motion, as the animation does */
    after(anim, function () {
      if (mine !== lineNo) return;
      if (beat.show == null) { animDone = true; return check(); }
      /* THE DIGIT MOVES LEFT: once the new place has opened the drums roll
         to the beat's figure, and the hand rests on where the 4 now is */
      setShow(beat.show, true);
      SFX.play('lever');
      if (beat.point != null && cols[beat.point]) pointTo(cols[beat.point]);
      after(DRUM.ms + 900, function () { if (mine === lineNo) { animDone = true; check(); } });
    });
  }

  /* THE TAP CUE: the hand and "tap to continue", once a beat is ready */
  var nextEl = null;
  function cueNext(on) {
    if (!root) return;
    if (!nextEl || !nextEl.isConnected) {
      nextEl = el('div', 'tc-next', root);
      el('span', 'tc-next-hand', nextEl).innerHTML = SWIPE.hand();
      el('span', 'tc-next-text', nextEl).textContent = i18n('ui.tapNext');
    }
    nextEl.classList.toggle('on', !!on);
  }

  function lead() {
    if (!root) return;
    tryOn = false;
    root.classList.remove('trying');
    /* NO CLOSING LINE. A lesson that taught something holds its gap after the
       last thing in it; one with nothing in it at all (level 3's is only the
       hand-over) passes straight through, since the screen before it has
       already held its own gap. */
    if (script.outro) return outro();
    if (!script.lead.text) {
      var taught = script.beats.length || script.tries.length ||
                   (script.context && script.context.text);
      return taught ? leave() : finish();
    }
    var spoke = say(script.lead.who, script.lead.text);
    /* a tap on the hand-over starts the gap now rather than waiting out the
       line; either way the gap itself is not cut short */
    beatTap = function () { beatTap = null; leave(); };
    after(spoke, function () {
      if (beatTap) { beatTap = null; leave(); }
    });
  }

  /* NUMBER POPULATION: the lesson IS the game, so it ends on the chart. */
  function outro() {
    if (!root) return;
    pointTo(null);
    idleSeq++;
    if (ask) ask.classList.remove('on');
    /* 22 Oct 2026: LEVEL COMPLETE, then on to the storyboard's Level 2 — the
       team's line, the Officer's, and the reports go to the headquarters */
    if (script.done && window.COMMAS) {
      root.classList.add('ended');
      setTitle(i18n('teach.title'));
      if (goBtn) goBtn.style.display = 'none';
      if (card) FX.confetti(60, card);
      SFX.play('clap');
      TRACK.send('level_complete', { level: 1 });
      say('team', script.done, function () {
        whenQuiet(function () {
          say('rill', script.outro, function () {
            INTRO.at(INTRO.now() + TIME.screenGap, function () {
              if (!root) return;
              finish();
              window.COMMAS.play();
            });
          });
        });
      });
      return;
    }
    root.classList.add('ended');
    root.classList.add('touched');            // PLAY AGAIN is lit, as CHECK is once a dial turns
    say('rill', script.outro);
    if (card) FX.confetti(60, card);
    SFX.play('clap');
    if (goBtn) goBtn.style.display = 'none';
    var G = TEACH.chart, C = TEACH.card;
    var again = el('button', 'ctl tc-go tc-again', root);
    again.type = 'button';
    again.style.top = (G.y + G.h + C.foot + TEACH.goGap) + '%';
    again.textContent = i18n('teach.again_btn');
    again.addEventListener('click', function (e) {
      e.stopPropagation();
      location.reload();
    });
    TRACK.send('game_complete', {});
  }

  /* THE LESSON HOLDS before the console comes: whatever is left of the line
     being said, then TIME.screenGap — in real time, so it is scheduled on the
     clock directly rather than through after(), which reduced motion halves.
     SKIP still goes straight to finish(). */
  function leave() {
    if (!root) return;
    INTRO.at(INTRO.now() + VOICE.left() + TIME.screenGap, function () { if (root) finish(); });
  }

  function play(lv, then, from) {
    if (live) return then && then();
    if (waveThrough) { waveThrough = false; return then && then(); }
    /* THE LESSONS ARE REPLACED (15 Oct 2026) by Nova's tap-through tutorial
       on the machine itself (runTutorial in the console). The chart is still
       here for the DEV menu's lesson links (?dev=1&go=teach:…). */
    /* (16 Oct 2026: the lessons are back, and Nova's tutorial follows them) */
    TRACK.send('lesson_start', { level: lv.id }); TRACK.at('lesson ' + lv.id);
    level = lv;
    script = SCRIPT[lv.id];
    if (!script) return then && then();
    live = true; done = then || null;

    if (!INTRO.running()) INTRO.clockStart(); else INTRO.clockStart();
    build();
    document.body.classList.add('in-teach');
    void root.offsetWidth;
    root.classList.add('on');

    /* LEVEL 2 EXTENDS THE CHART IT ALREADY HAD, so it opens with the places
       the PREVIOUS level had and grows to this one's. Level 1 opens at its
       own width. */
    var opening = script.chartFrom ? placesOf(script.chartFrom) : places();
    if (script.beats.length) buildChart(opening.length, opening, !!script.chartFrom);
    if (script.start) setShow(script.start, false);
    /* NOVA-BOT: level 1 starts it just right of the ones; a level that
       extends the chart starts it on the leftmost place it already has */
    BOT.reset();
    if (script.beats.length && cols.length) {
      if (script.chartFrom) BOT.startBy(cols[0], 0);
      else BOT.startBy(cols[cols.length - 1], 1);
    }

    /* ?dev=1&go=teach:L:b:N / teach:L:t:N (dev.js) opens at a later step */
    if (from) return jump(from);

    /* the narrator names the level first, where the script has a line */
    var opening = function () {
      var t = 0;
      if (script.context && script.context.text) {
        setTitle(script.context.title);
        t = say(script.context.who, script.context.text) + T.settle;
      }
      after(Math.max(t, VOICE.left() + 300), function () {
        runBeats(script.beats, 0, function () {
          if (script.tries.length) startTry(0);
          else lead();
        });
      });
    };
    if (script.intro && script.intro.text) {
      say(script.intro.who, script.intro.text, function () { after(T.settle, opening); });
    } else opening();
  }

  /* DEV JUMP: start at beat N, or straight at Try N. The chart is first put
     into the state the skipped beats would have left it in — the new places
     opened, the plates lit, the example on the drums — and then the lesson
     runs on from there exactly as it would in play. No context line. */
  function jump(from) {
    var b = from.tryAt != null ? script.beats.length
                               : Math.min(from.beat || 0, script.beats.length);
    script.beats.slice(0, b).forEach(function (beat) {
      if (beat.act.indexOf('extend') === 0) {
        var up = +beat.act.split(':')[1] || 0, all = places();
        var m = up ? Math.min(all.length, cols.length + up) : all.length;
        buildChart(m, all.slice(all.length - m), true); BOT.startBy(cols[0], 0);
      }
      else if (beat.act === 'name') cols.forEach(function (c) { c.plate.classList.add('lit'); });
      else if (beat.act.indexOf('hop:') === 0) cols.forEach(function (c) {
        if (c.place === beat.act.slice(4).toUpperCase()) { c.plate.classList.add('lit'); BOT.startBy(c, 0); }
      });
      else if (beat.act === 'example') {
        var sd = pad(script.example);
        cols.forEach(function (c, i) { c.drum.set(+sd[i], false); });
      }
      if (beat.show != null) setShow(beat.show, false);
      if (beat.title) setTitle(beat.title);
    });
    after(300, function () {
      if (from.tryAt != null && script.tries[from.tryAt]) return startTry(from.tryAt);
      runBeats(script.beats, b, function () {
        if (script.tries.length) startTry(0);
        else lead();
      });
    });
  }

  /* THE HAND-OVER TO THE CONSOLE. The map must never show between the two,
     so the order is: the map is put away for good (body.no-map — it comes
     back only for the next delivery flight), the console is started UNDER the
     lesson, and only once it reports it is drawn does the lesson fade off
     over it. The console's start is handed a `ready` to call for that; a
     caller that never calls it still gets the lesson taken down, a moment
     later. On setTimeout rather than the intro's clock, because the console
     restarts that clock and would wipe the teardown off it. */
  function finish() {
    if (!live) return;
    live = false;
    idleSeq++;
    DIALOG.hide();
    tryOn = false; beatTap = null;
    document.body.classList.add('no-map');
    var gone = false;
    function leave() {
      if (gone || !root) return;
      gone = true;
      document.body.classList.remove('in-teach');
      root.classList.add('off');
      setTimeout(function () {
        if (root && root.parentNode) root.parentNode.removeChild(root);
        if (onResize) { window.removeEventListener('resize', onResize); onResize = null; }
        root = null; cols = []; bays = []; vals = []; arrows = []; card = null;
        x10s = []; nextEl = null; BOT.reset();
        line = null; ask = null; goBtn = null; titleText = null; chips = [];
        beatTap = null; tryOn = false; tryIdx = -1;
      }, T.out);
    }
    var f = done; done = null;
    if (f) { f(leave); setTimeout(leave, 4000); }
    else leave();
  }

  window.TEACH_SCREEN = {
    play: play,
    /* for driving it from a test: set the right number and press CHECK */
    solve: function () {
      if (!tryOn || !script) return false;
      var item = script.tries[tryIdx];
      spinTo(pad(item.target).split('').map(Number));
      after((cols.length - 1) * T.spinGap + DRUM.ms + 300, submit);
      return true;
    },
    skip: function () { if (live) finish(); else waveThrough = true; },
    live: function () { return live; },
    /* the lesson's steps, for dev.js's menu: b:N is a beat, t:N a Try */
    steps: function (id) {
      var sc = SCRIPT[id];
      if (!sc) return [];
      return sc.beats.map(function (b, i) { return { go: 'b:' + i, kind: 'Step', n: i + 1, text: b.text }; })
        .concat(sc.tries.map(function (t, i) { return { go: 't:' + i, kind: 'Try', n: i + 1, text: t.words }; }));
    },
    state: function () {
      return {
        live: live,
        level: level && level.id,
        cols: cols.length,
        names: cols.map(function (c) { return c.place; }),
        lit: cols.filter(function (c) { return c.plate.classList.contains('lit'); }).length,
        picked: cols.map(function (c, i) { return c.el.classList.contains('pick') ? i : -1; })
                    .filter(function (i) { return i >= 0; }),
        arrows: arrows.length,
        value: cols.length ? value() : 0,
        digits: cols.length ? digits() : [],
        tryOn: tryOn, tryIdx: tryIdx, wrongCount: wrongCount,
        pointed: cols.map(function (c, i) { return c.el.classList.contains('point') ? i : -1; })
                     .filter(function (i) { return i >= 0; }),
        who: root ? root.getAttribute('data-who') : null,
        bot: BOT.state(),
        x10: x10s.length,
        tapCue: !!(nextEl && nextEl.classList.contains('on')),
        line: line ? line.textContent : ''
      };
    },
    /* for driving a Try from a test, the way levelSet drives the console */
    set: function (v) {
      var s = pad(v);
      cols.forEach(function (c, i) { c.drum.set(+s[i], false); });
    },
    check: function () { submit(); }
  };
})();

/* ########################################################################## */
/*  POST.JS                                                                 */
/* ########################################################################## */

/* ============================================================================
   POST.JS — the level-complete celebration, the last thing the player sees.

   Back to front: the sky plate, pushing in slowly; Nova, keyed live off her
   green screen, with her own shadow and a warm rim from the sun; a layer of
   cyan confetti; and the words on top.

   IT IS TIMED BY THE CLIP, NOT BY A CLOCK. Every beat — the headline, the
   subtitle, the second burst — is a time in end.webm and is read off
   video.currentTime, so a clip that stalls to buffer holds the words with it
   instead of letting them run ahead of her. Only a clip that cannot play at
   all hands the timing to the intro's clock.

   THREE RESULTS. 'perfect' and 'pass' play the clip from the crouch into
   her first jump to the end; 'retry' plays her idle and her arms-out landing
   only — no jump — cut together under a cross-fade, with words that say try
   again. The result comes from the finished
   level's wrong LOADs (POST.result), or is handed in by the demo page.
   Every word is in locales.json under "post"; every time and size is in
   POST below.

   IT IS NOT INSIDE THE 16:9 STAGE. The rest of the game is letterboxed; this
   screen is laid over the whole window, so a phone held upright gets a
   portrait layout with Nova and the words centred instead of a thin band.

   NO SECOND ANIMATION LOOP: the key, the timeline and the confetti are all
   one frame hook on the intro's rAF.
   ========================================================================= */
(function () {
  'use strict';

  var POST = {
    video: 'assets/Game assets/end.webm',
    graceS: 4,          // the clip may run this much past its own length before the clock takes over
    bg: PRELBD.bg,

    /* the finished level's wrong LOADs decide the result: this many or fewer
       is perfect, this many or fewer is a pass, anything more is a retry */
    result: { perfectMaxWrong: 0, passMaxWrong: 6 },

    /* THE TIMELINE, in seconds of end.webm, measured off the clip:
         0.0-1.0 idle · 1.0-1.5 crouch · 1.6-4.4 three jumps (cyan arcs at
         2.0) · 4.5 lands arms-out · 4.8-5.8 settles · 6.0-8.0 thumbs-up
       play      the pieces of the clip to play, in order. A jump from one to
                 the next is covered by a cross-fade. Perfect and pass skip
                 the idle and open on the crouch into the first jump.
       beats     when each thing arrives, as a time in the clip. A time that
                 falls between two pieces arrives when the next one starts.
       loop      [from, to], cycled silently under the same cross-fade once
                 the last piece ends; null holds the last frame instead
       burst     confetti pieces at the headline, 0 for none
       encore    a second, smaller burst on the thumbs-up (beats.encore)
       chime     the SFX voice played as the headline lands */
    variants: {
      /* 21 Oct 2026 (Anmol): she STOPS on the thumbs-up (7.0 s: thumb at
         her chest, eyes open, smiling) and holds it — no loop after it */
      perfect: { play: [[1, 7.0]], beats: { headline: 1.85, subtitle: 4.45, encore: 5.9 },
                 loop: null, burst: 150, encore: 60, chime: 'chime' },
      pass:    { play: [[1, 7.0]], beats: { headline: 1.85, subtitle: 4.45 },
                 loop: null, burst: 100, encore: 0, chime: 'chime' },
      retry:   { play: [[0, 1.05], [4.45, 5.85]], beats: { headline: 4.5, subtitle: 4.85 },
                 loop: null, burst: 0, encore: 0, chime: 'chimeSoft' }
    },
    fadeMs: 220,            // the cross-fade over a cut or a loop
    pushMs: 8000,           // the plate's push-in, 1.00 -> 1.05
    stallMs: 5000,          // a clip that has not started by now is given up on

    /* WHERE SHE IS IN THE CLIP'S FRAME, as fractions of it: the top of her
       head standing, her feet, her centre line, and how wide she gets with
       her arms out. post.css stands her feet on the bottom of her zone and
       fits her head to its top; `span` keeps her arms on a narrow screen. */
    frame: { head: 0.05, feet: 0.961, cx: 0.485, span: 0.42 },

    /* THE KEY. The screen's green, measured off the clip (RGB 0-1). A pixel
       starts to clear once it is `lo` greener than its other two channels,
       and is gone by `hi` — the screen itself sits at 0.39-0.42. The rim is
       the sun on the top-left edges: its colour, its strength, and how far
       in (source pixels) it is looked for. `warm` grades her toward the sky. */
    key: { rgb: [0.025, 0.665, 0.257], lo: 0.12, hi: 0.36,
           rim: [1.0, 0.62, 0.3], rimStrength: 0.45, rimPx: [3, 6, 10], warm: 0.05 },

    /* HER SHADOW. How far off the floor she is — 0 standing, 1 at the top of
       the highest jump — measured from where her feet are in each frame of
       the clip at 12fps. The shadow shrinks and fades by that much. */
    lift: [[1.5, 0], [1.58, .14], [1.67, .57], [1.75, .79], [1.83, .72], [1.92, .28],
           [2.0, 0], [2.25, 0], [2.33, .18], [2.42, .65], [2.5, .9], [2.58, .97],
           [2.67, 1], [2.75, 1], [2.83, .97], [2.92, .65], [3.0, .11], [3.08, .03],
           [3.17, .07], [3.25, .32], [3.33, .72], [3.42, .9], [3.5, .9], [3.58, .61],
           [3.67, .07], [3.75, 0], [3.83, 0], [3.92, .07], [4.0, .46], [4.08, .75],
           [4.17, .79], [4.25, .68], [4.33, .35], [4.42, 0]],
    shadow: { shrink: 0.45, fade: 0.65 },

    /* the antennae's cyan, most of the time, and a few lighter tints of it */
    confetti: { colors: ['#4FE3FF', '#4FE3FF', '#4FE3FF', '#4FE3FF', '#8FEEFF', '#D4F9FF', '#FFFFFF'],
                sparkleShare: 0.28, lifeMs: 4200, twinkleEveryMs: 420 }
  };

  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var root = null, video = null, canvas = null, ghost = null, gctx = null;
  var bgEl = null, headEl = null, subEl = null, shadowEl = null;
  var fx = null, fxc = null, sprite = null;
  var hook = null, live = false, keyer = null;

  /* the timeline */
  var result = 'pass', V = null, pieces = [], piece = 0, span = 0, marks = [], fired = {};
  var clipOK = true, started = false, seeking = false, looping = false, held = false;
  var playAt = 0, clockAt = 0, clockFrom = 0, lastDrawn = -1;
  var soundBlocked = false;

  /* the confetti */
  var parts = [], fxW = 0, fxH = 0, dpr = 1, lastT = 0, nextTwinkle = 0, drewFx = false;

  function el(tag, cls, host) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (host) host.appendChild(e);
    return e;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function sfxOn() { return SFX.isOn(); }

  /* ---- THE KEY -----------------------------------------------------------
     1  alpha: how much greener than its other two channels a pixel is
     2  the outermost pixel is choked — an edge half suit-navy, half green is
        barely greener than its neighbours, so it would otherwise stay solid
        and come out teal
     3  the known green is un-mixed out of every part-clear pixel, which
        leaves the colour that was really in front of the screen
     4  what spill is left is taken off: white and grey go neutral, but a
        pixel that is really cyan (the antennae) keeps its green
     5  the rim: an edge whose top-left neighbours are clear catches the sun */
  var VS = 'attribute vec2 p; varying vec2 uv;' +
           'void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    'precision mediump float;',
    'varying vec2 uv;',
    'uniform sampler2D v;',
    'uniform vec3 uKey; uniform vec2 uRange; uniform vec2 uPx;',
    'uniform vec3 uRim; uniform float uRimK; uniform vec3 uRimR; uniform float uWarm;',
    'float keyA(vec2 q){ vec3 c = texture2D(v, q).rgb;',
    '  return 1.0 - smoothstep(uRange.x, uRange.y, c.g - max(c.r, c.b)); }',
    'void main(){',
    '  vec3 c = texture2D(v, uv).rgb;',
    '  float a = 1.0 - smoothstep(uRange.x, uRange.y, c.g - max(c.r, c.b));',
    '  float m = min(min(keyA(uv + vec2(uPx.x, 0.0)), keyA(uv - vec2(uPx.x, 0.0))),',
    '                min(keyA(uv + vec2(0.0, uPx.y)), keyA(uv - vec2(0.0, uPx.y))));',
    '  a *= 0.5 + 0.5 * smoothstep(0.0, 0.6, m);',
    '  if (a < 0.003) { gl_FragColor = vec4(0.0); return; }',
    '  vec3 f = clamp(c - (1.0 - a) * uKey, 0.0, a) / a;',
    '  float cy = smoothstep(0.15, 0.45, f.b - f.r);',
    '  f.g = min(f.g, mix((f.r + f.b) * 0.5, max(f.r, f.b), cy) + 0.01);',
    '  f.g = mix(f.g, max(f.g, min(f.r, f.b)), step(a, 0.98));',
    '  vec2 d = -uPx;',
    '  float o = (keyA(uv + d * uRimR.x) + keyA(uv + d * uRimR.y) + keyA(uv + d * uRimR.z)) / 3.0;',
    '  float rim = pow(max(0.0, 1.0 - o), 1.2) * uRimK;',
    '  f = min(vec3(1.0), f * (1.0 + uWarm * vec3(0.6, 0.0, -0.8)) + uRim * rim);',
    '  gl_FragColor = vec4(f * a, a);',
    '}'
  ].join('\n');

  function glKeyer(cv) {
    /* preserveDrawingBuffer so the frame can be copied onto the ghost for a
       cross-fade at any moment, not only straight after a draw */
    var opt = { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true };
    var gl = cv.getContext('webgl', opt) || cv.getContext('experimental-webgl', opt);
    if (!gl) return null;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s;
    }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    /* ?key=white draws her white, the way the QA laptop's GPU did, to test
       the fall-back to the CPU key (QA Bug 26) */
    var fs = /[?&]key=white\b/.test(location.search)
      ? FS.replace('gl_FragColor = vec4(f * a, a);', 'gl_FragColor = vec4(vec3(a), a);') : FS;
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var K = POST.key, U = function (n) { return gl.getUniformLocation(pr, n); };
    gl.uniform3fv(U('uKey'), K.rgb);
    gl.uniform2f(U('uRange'), K.lo, K.hi);
    gl.uniform3fv(U('uRim'), K.rim);
    gl.uniform1f(U('uRimK'), K.rimStrength);
    gl.uniform3fv(U('uRimR'), K.rimPx);
    gl.uniform1f(U('uWarm'), K.warm);
    var uPx = U('uPx');
    return function (vid) {
      if (cv.width !== vid.videoWidth) {
        cv.width = vid.videoWidth; cv.height = vid.videoHeight;
        gl.uniform2f(uPx, 1 / cv.width, 1 / cv.height);
      }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  /* the same key on the CPU, at half size so it keeps up. It follows the
     shader step for step; the rim is looked for at half the distance because
     the pixels are twice the size. */
  var CPU_K = 0.75;
  function cpuKeyer(cv) {
    var cx = cv.getContext('2d', { willReadFrequently: true });
    if (!cx) return null;
    var K = POST.key, kr = K.rgb[0], kg = K.rgb[1], kb = K.rgb[2];
    var A = null, w = 0, h = 0;
    /* the key's alpha for every possible (g - max(r, b)), worked out once */
    var LUT = new Float32Array(511);
    for (var v = -255; v <= 255; v++) {
      var t0 = Math.min(1, Math.max(0, (v / 255 - K.lo) / (K.hi - K.lo)));
      LUT[v + 255] = 1 - t0 * t0 * (3 - 2 * t0);
    }
    var wr = 1 + K.warm * 0.6, wb = 1 - K.warm * 0.8;
    var ema = 0;
    return function (vid) {
      var t0 = performance.now();
      /* at 0.75 of the clip's size: sharp at full-screen sizes. A machine
         that takes too long at that size drops to half for the rest of the
         clip (see the end of this function). */
      var W = Math.round(vid.videoWidth * CPU_K), H = Math.round(vid.videoHeight * CPU_K);
      if (cv.width !== W || cv.height !== H) { cv.width = w = W; cv.height = h = H; A = new Float32Array(w * h); }
      cx.clearRect(0, 0, w, h);
      cx.drawImage(vid, 0, 0, w, h);
      var img = cx.getImageData(0, 0, w, h), d = img.data, i, j, x, y, n = w * h;
      /* pass 1: the alpha, and the box she stands in. Everything outside
         that box is green screen and is never looked at again — that is
         what keeps this cheap enough to run on the CPU every frame. */
      var x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (y = 0, i = 0; y < h; y++) for (x = 0; x < w; x++, i++) {
        j = i << 2;
        var r8 = d[j], g8 = d[j + 1], b8 = d[j + 2];
        var al = LUT[g8 - (r8 > b8 ? r8 : b8) + 255];
        A[i] = al;
        if (al > 0.003) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      cx.clearRect(0, 0, w, h);
      if (x1 < 0) return;
      var r1 = Math.max(1, Math.round(K.rimPx[0] * CPU_K)), r2 = Math.max(1, Math.round(K.rimPx[1] * CPU_K)),
          r3 = Math.max(1, Math.round(K.rimPx[2] * CPU_K));
      var wm = w - 1, hm = h - 1;
      function at(px, py) {
        if (px < 0) px = 0; else if (px > wm) px = wm;
        if (py < 0) py = 0; else if (py > hm) py = hm;
        return A[py * w + px];
      }
      /* pass 2, inside the box only: the same steps as the shader */
      for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
        i = y * w + x;
        var o4 = i << 2, a = A[i];
        if (a < 0.003) { d[o4 + 3] = 0; continue; }
        var m;
        if (x > 0 && x < wm && y > 0 && y < hm) {
          m = A[i - 1]; if (A[i + 1] < m) m = A[i + 1];
          if (A[i - w] < m) m = A[i - w]; if (A[i + w] < m) m = A[i + w];
        } else m = Math.min(at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1));
        if (m < 0.6) { var t = m / 0.6; a *= 0.5 + 0.5 * t * t * (3 - 2 * t); }
        if (a < 0.003) { d[o4 + 3] = 0; continue; }
        var r = d[o4] / 255, g = d[o4 + 1] / 255, b = d[o4 + 2] / 255, q = 1 - a;
        if (q > 0) {
          r = Math.min(a, Math.max(0, r - q * kr)) / a;
          g = Math.min(a, Math.max(0, g - q * kg)) / a;
          b = Math.min(a, Math.max(0, b - q * kb)) / a;
        }
        var c = (b - r - 0.15) / 0.3; c = c < 0 ? 0 : c > 1 ? 1 : c; c = c * c * (3 - 2 * c);
        var gc = ((r + b) / 2) * (1 - c) + (r > b ? r : b) * c + 0.01;
        if (g > gc) g = gc;
        if (a <= 0.98) { var mn = r < b ? r : b; if (g < mn) g = mn; }
        var ov = (at(x - r1, y - r1) + at(x - r2, y - r2) + at(x - r3, y - r3)) / 3;
        var rim = ov < 1 ? Math.pow(1 - ov, 1.2) * K.rimStrength : 0;
        r = r * wr + K.rim[0] * rim; g = g + K.rim[1] * rim; b = b * wb + K.rim[2] * rim;
        /* putImageData takes straight (unpremultiplied) colour */
        d[o4] = r > 1 ? 255 : r * 255; d[o4 + 1] = g > 1 ? 255 : g * 255;
        d[o4 + 2] = b > 1 ? 255 : b * 255; d[o4 + 3] = a * 255;
      }
      /* only her box is written; the rest of the canvas stays clear */
      cx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
      ema = ema ? ema * 0.8 + (performance.now() - t0) * 0.2 : performance.now() - t0;
      if (ema > 16 && CPU_K > 0.5) CPU_K = 0.5;
    };
  }

  /* ---- THE TIMELINE ------------------------------------------------------
     The pieces are laid end to end; `at` is where each starts on the
     timeline. A beat's clip time becomes a timeline time once, here, so the
     same beats work whether a piece was skipped or not. */
  function lay() {
    pieces = []; span = 0;
    V.play.forEach(function (p) {
      pieces.push({ from: p[0], to: p[1], at: span });
      span += p[1] - p[0];
    });
    marks = Object.keys(V.beats).map(function (name) {
      return { name: name, at: onTimeline(V.beats[name]) };
    });
    piece = 0; fired = {};
  }
  function onTimeline(t) {
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (t < p.from) return p.at;
      if (t <= p.to) return p.at + (t - p.from);
    }
    return span;
  }
  function position() {
    if (!clipOK) return clockFrom + (INTRO.now() - clockAt) / 1000;
    if (looping || held) return span;
    var p = pieces[piece];
    return p.at + Math.max(0, Math.min(video.currentTime, p.to) - p.from);
  }

  /* moves the clip on: into the next piece, onto the loop, or to a stop */
  /* THE WATCHDOG: the clip has to keep moving. One that stops advancing
     mid-way (a stall with no error), or that has not reached its end a few
     seconds after it should have, hands over to the clock, which carries the
     headline and subtitle on exactly as the clip would have. */
  var lastCt = -1, lastMoveAt = 0;
  function drive() {
    if (!clipOK || !video || seeking || held) return;
    var now = INTRO.now();
    if (!started) {
      if (video.currentTime > pieces[0].from + 0.01) { started = true; lastCt = video.currentTime; lastMoveAt = now; }
      else if (now - playAt > POST.stallMs) giveUp();
      return;
    }
    var ct = video.currentTime;
    if (Math.abs(ct - lastCt) > 0.001) { lastCt = ct; lastMoveAt = now; }
    else if (!video.paused && now - lastMoveAt > POST.stallMs) { giveUp(); return; }
    if (!looping && now - playAt > (span + POST.graceS) * 1000) { giveUp(); return; }
    if (looping) {
      if (ct >= V.loop[1] || video.ended) cut(V.loop[0]);
      return;
    }
    var p = pieces[piece];
    if (ct < p.to - 0.02 && !video.ended) return;
    if (piece + 1 < pieces.length) {
      piece++;
      cut(pieces[piece].from);
    } else if (V.loop) {
      /* the first time round had her sound; the loop is quiet */
      looping = true;
      cut(V.loop[0]);
    } else {
      held = true;
      video.pause();
      /* a slow frame can notice the end late; hold on the piece's own last
         frame, not on whatever the clip had run on to */
      if (ct > p.to + 0.03) video.currentTime = p.to;
    }
  }

  /* THE CUT. The frame on screen is copied onto the ghost, the clip is sent
     to its new time, and the ghost fades off once the new frame is up — a
     cross-fade, so a jump in the clip never reads as a jump. */
  function cut(to) {
    if (ghost && canvas && canvas.width) {
      if (ghost.width !== canvas.width) { ghost.width = canvas.width; ghost.height = canvas.height; }
      gctx.clearRect(0, 0, ghost.width, ghost.height);
      try { gctx.drawImage(canvas, 0, 0); } catch (e) {}
      ghost.style.transition = 'none';
      ghost.style.opacity = '1';
    }
    seeking = true;
    video.currentTime = to;
    if (video.paused) video.play().catch(function () {});
  }
  function onSeeked() {
    if (!seeking) return;
    seeking = false;
    lastDrawn = -1;
    drawNova();
    if (!ghost) return;
    void ghost.offsetWidth;
    ghost.style.transition = 'opacity ' + POST.fadeMs + 'ms ease';
    ghost.style.opacity = '0';
  }

  /* The clip could not play at all. The intro's clock takes over the timing
     from wherever the clip had got to, so the words still come. */
  function giveUp() {
    if (!clipOK) return;
    clockFrom = video ? position() : 0;
    clockAt = INTRO.now();
    clipOK = false;
    if (video) video.pause();
    if (root) root.classList.add('no-clip');
  }

  function beats(pos) {
    for (var i = 0; i < marks.length; i++) {
      var b = marks[i];
      if (!fired[b.name] && pos >= b.at) { fired[b.name] = true; BEAT[b.name](); }
    }
  }
  var BEAT = {
    headline: function () {
      root.classList.add('head-on');
      VOICE.play(copy('headline'));
      SFX.play(V.chime);
      if (V.burst) burst(V.burst);
    },
    subtitle: function () {
      root.classList.add('sub-on');
      VOICE.then(subEl ? subEl.textContent : '');
    },
    encore: function () { if (V.encore) burst(V.encore, true); }
  };

  /* ---- NOVA -------------------------------------------------------------- */
  function drawNova() {
    if (!keyer || !video || video.readyState < 2 || seeking) return;
    /* a new frame only; a held or paused clip is left on the canvas as it is */
    if (video.currentTime === lastDrawn) return;
    lastDrawn = video.currentTime;
    /* a key that cannot run (a tainted frame, a lost context) shows her
       unkeyed rather than not at all */
    try { keyer(video); } catch (e) { keyer = null; root.classList.add('raw'); }
    if (keyer && keyerIsGL && checks < 3 && video.currentTime > 0.25) verifyGL();
  }

  /* QA Bug 26 (13 Oct 2026): NOVA CAME OUT WHITE on the QA laptop (Intel
     HD 520): its GPU drew the WebGL key wrong. So the GPU's picture is
     checked against the same key done on the CPU, on a small copy of the
     same frame, for the first few frames. If they disagree — she is far
     brighter, or her colour is off — the canvas is swapped for one keyed
     on the CPU, which is slower but the same on every machine. */
  var keyerIsGL = false, checks = 0, probe = null;
  function verifyGL() {
    checks++;
    try {
      var W = 96, H = 54;
      if (!probe) { probe = document.createElement('canvas'); probe.width = W * 2; probe.height = H; }
      var pc = probe.getContext('2d', { willReadFrequently: true });
      pc.clearRect(0, 0, W * 2, H);
      pc.drawImage(video, 0, 0, W, H);
      pc.drawImage(canvas, W, 0, W, H);
      var d = pc.getImageData(0, 0, W * 2, H).data, K = POST.key;
      var sm = function (x) { var t = Math.min(1, Math.max(0, (x - K.lo) / (K.hi - K.lo))); return t * t * (3 - 2 * t); };
      /* compared as a whole, not pixel by pixel: the clip may have moved on
         a frame between the two copies, but what she looks like overall —
         how much of the frame she covers and her average colour — does not
         change in a twelfth of a second. A white-out moves both a long way. */
      var cA = 0, gA = 0, cS = [0, 0, 0], gS = [0, 0, 0];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var i = (y * W * 2 + x) * 4, j = (y * W * 2 + W + x) * 4;
        var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        var a = 1 - sm(g - Math.max(r, b));
        if (a > 0.5) { cA++; cS[0] += r; cS[1] += Math.min(g, (r + b) / 2 + 0.15); cS[2] += b; }
        if (d[j + 3] > 127) { gA++; gS[0] += d[j] / 255; gS[1] += d[j + 1] / 255; gS[2] += d[j + 2] / 255; }
      }
      var n = cA, diff = 0, adiff = Math.abs(gA - cA) / Math.max(1, cA);
      if (cA > 40 && gA > 0) {
        for (var q = 0; q < 3; q++) diff += Math.abs(gS[q] / gA - cS[q] / cA) / 3;
        diff *= cA;                                  // so diff / n is the mean
      }
      var bad = (n > 40 && (gA === 0 || diff / n > 0.15)) || (n > 40 && adiff > 0.5);
      if (!bad) return;
      console.warn('[post] the GPU key disagrees with the CPU key (' +
                   (n ? (diff / n).toFixed(2) : '-') + ', ' + adiff.toFixed(2) + '): keying on the CPU');
      var fresh = document.createElement('canvas');
      fresh.className = canvas.className;
      canvas.parentNode.replaceChild(fresh, canvas);
      canvas = fresh;
      keyer = cpuKeyer(canvas);
      keyerIsGL = false;
      lastDrawn = -1;
      if (keyer) keyer(video); else root.classList.add('raw');
    } catch (e) { checks = 3; }
  }

  function liftAt(t) {
    var L = POST.lift;
    if (t <= L[0][0] || t >= L[L.length - 1][0]) return 0;
    for (var i = 1; i < L.length; i++) {
      if (t <= L[i][0]) {
        var a = L[i - 1], b = L[i], k = (t - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return 0;
  }
  function shadowStep() {
    if (!shadowEl) return;
    var l = clipOK && video ? liftAt(video.currentTime) : 0;
    shadowEl.style.transform = 'translate(-50%, -50%) scale(' +
                               (1 - POST.shadow.shrink * l).toFixed(3) + ')';
    shadowEl.style.opacity = (1 - POST.shadow.fade * l).toFixed(3);
  }

  /* HER SOUND follows the game's sound setting. It is off on the loop, and
     it is left off if the browser only let the clip start muted — unmuting it
     then, before anyone has touched the page, would make the browser stop it. */
  function soundStep() {
    if (!video || !clipOK) return;
    var want = !looping && !soundBlocked && sfxOn();
    if (video.muted === want) video.muted = !want;
  }

  function startVideo() {
    playAt = INTRO.now();
    /* the first piece need not start at 0; set before the clip has loaded,
       this is where it opens rather than a seek, so there is nothing to fade */
    if (pieces[0].from > 0) video.currentTime = pieces[0].from;
    video.muted = !sfxOn();
    var p = video.play();
    if (p && p.catch) p.catch(function () {
      if (!video) return;
      soundBlocked = true;
      video.muted = true;
      video.play().catch(function () { giveUp(); });
    });
  }

  /* ---- THE CONFETTI ------------------------------------------------------
     Two kinds of piece: paper, which tumbles and flutters down, and
     sparkles, which drift and twinkle out. All in the antennae's cyan. Every
     size is in `u`, 1% of the window's short side. */
  function fxSize() {
    if (!fx) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    fxW = root.clientWidth; fxH = root.clientHeight;
    fx.width = Math.round(fxW * dpr); fx.height = Math.round(fxH * dpr);
    fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /* the sparkle is drawn once, glow and all, and stamped from then on */
  function makeSprite() {
    var s = document.createElement('canvas'), n = 64, c = s.getContext('2d');
    s.width = s.height = n;
    var g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(210,250,255,0.9)');
    g.addColorStop(0.25, 'rgba(79,227,255,0.45)');
    g.addColorStop(1, 'rgba(79,227,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, n, n);
    var m = n / 2, r = n * 0.48;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(m, m - r);
    c.quadraticCurveTo(m, m, m + r, m);
    c.quadraticCurveTo(m, m, m, m + r);
    c.quadraticCurveTo(m, m, m - r, m);
    c.quadraticCurveTo(m, m, m, m - r);
    c.fill();
    return s;
  }
  function headBox() {
    var r = headEl.getBoundingClientRect(), o = root.getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
  }
  function burst(n, fromTop) {
    if (REDUCED || !fxc) return;
    var u = Math.min(fxW, fxH) / 100, box = headBox(), C = POST.confetti;
    for (var i = 0; i < n; i++) {
      var sparkle = Math.random() < C.sparkleShare;
      var x, y, a, sp;
      if (fromTop) {
        /* the encore falls in from above the top edge */
        x = rand(0, fxW); y = rand(-8 * u, -2 * u);
        a = Math.PI / 2 + rand(-0.4, 0.4); sp = rand(10, 30) * u;
      } else {
        x = box.x + rand(0.08, 0.92) * box.w; y = box.y + rand(0.2, 0.8) * box.h;
        /* mostly up and out, some sideways and down, so it fills the sky
           round the words rather than leaving by the top edge */
        a = -Math.PI / 2 + rand(-2.1, 2.1); sp = rand(22, 80) * u;
      }
      parts.push({
        sparkle: sparkle,
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (fromTop ? 0 : 10 * u),
        rot: rand(0, Math.PI * 2), vr: rand(-9, 9),
        flip: rand(0, Math.PI * 2), vf: rand(6, 14),
        w: (sparkle ? rand(1.2, 2.8) : rand(0.9, 1.5)) * u,
        h: rand(0.45, 0.7) * u,
        color: pick(C.colors),
        age: 0, life: (sparkle ? rand(0.55, 0.45 + C.lifeMs / 4000) : rand(0.7, 1) * C.lifeMs / 1000)
      });
    }
  }
  /* once the headline is up, a sparkle now and then around it, so a screen
     that is holding for a tap still has a little life */
  function twinkle(t) {
    if (REDUCED || !fired.headline || !V.burst || t < nextTwinkle) return;
    nextTwinkle = t + POST.confetti.twinkleEveryMs * rand(0.6, 1.4);
    var u = Math.min(fxW, fxH) / 100, b = headBox();
    parts.push({
      sparkle: true, x: b.x + rand(-0.05, 1.05) * b.w, y: b.y + rand(-0.2, 1.2) * b.h,
      vx: rand(-1, 1) * u, vy: rand(-3, -1) * u, rot: 0, vr: rand(-1, 1),
      flip: 0, vf: 0, w: rand(1.0, 2.2) * u, h: 0, color: '#4FE3FF',
      age: 0, life: rand(0.7, 1.2)
    });
  }
  function fxStep(t) {
    if (!fxc) return;
    var dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    twinkle(t);
    if (!parts.length) {
      if (drewFx) { fxc.clearRect(0, 0, fxW, fxH); drewFx = false; }
      return;
    }
    var u = Math.min(fxW, fxH) / 100, g = 60 * u;
    fxc.clearRect(0, 0, fxW, fxH);
    drewFx = true;
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.age += dt;
      if (p.age >= p.life || p.y > fxH + 4 * u) { parts.splice(i, 1); continue; }
      var drag = p.sparkle ? 2.2 : 1.7;
      p.vx -= p.vx * drag * dt;
      p.vy += (p.sparkle ? g * 0.12 : g) * dt;
      p.vy -= p.vy * drag * dt;
      p.flip += p.vf * dt;
      p.rot += p.vr * dt;
      /* paper sways as it tumbles */
      p.x += (p.vx + (p.sparkle ? 0 : Math.sin(p.flip * 0.5) * 6 * u)) * dt;
      p.y += p.vy * dt;
      var k = p.age / p.life;
      var fade = k > 0.8 ? (1 - k) / 0.2 : 1;
      if (p.sparkle) {
        var s = p.w * Math.sin(Math.PI * Math.min(1, k * 1.15)) * 2.2;
        if (s <= 0) continue;
        fxc.globalCompositeOperation = 'lighter';
        fxc.globalAlpha = 0.95 * fade;
        fxc.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
      } else {
        fxc.globalCompositeOperation = 'source-over';
        fxc.globalAlpha = fade;
        fxc.fillStyle = p.color;
        fxc.save();
        fxc.translate(p.x, p.y);
        fxc.rotate(p.rot);
        fxc.scale(1, Math.cos(p.flip));
        fxc.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxc.restore();
      }
    }
    fxc.globalAlpha = 1;
    fxc.globalCompositeOperation = 'source-over';
  }

  /* ---- THE FRAME HOOK ---------------------------------------------------- */
  function tick(t) {
    drive();
    drawNova();
    beats(position());
    shadowStep();
    soundStep();
    fxStep(t);
  }

  /* ---- THE SCREEN -------------------------------------------------------- */
  function copy(key) { return i18n('post.' + result + '.' + key); }

  function build() {
    var host = document.getElementById('viewport') || document.body;
    root = el('div', 'post', host);
    root.id = 'post';
    root.setAttribute('data-result', result);
    var F = POST.frame;
    root.style.setProperty('--head', F.head);
    root.style.setProperty('--feet', F.feet);
    root.style.setProperty('--cx', F.cx);
    root.style.setProperty('--span', F.span);
    root.style.setProperty('--push', POST.pushMs + 'ms');

    bgEl = el('i', 'po-bg', root);
    bgEl.style.backgroundImage = 'url("' + ASSET(POST.bg) + '")';

    /* the column: the words at the top, Nova under them. The words are in
       the layout from the start — only invisible — so nothing moves when
       they arrive. */
    var col = el('div', 'po-col', root);
    var top = el('div', 'po-top', col);
    headEl = el('h1', 'po-head', top);
    String(copy('headline')).split(' ').forEach(function (w, i, all) {
      var s = el('span', 'w', headEl);
      s.textContent = w;
      s.style.setProperty('--i', i);
      if (i < all.length - 1) headEl.appendChild(document.createTextNode(' '));
    });
    subEl = el('p', 'po-sub', top);
    subEl.textContent = i18n('post.' + result + '.subtitle', { skill: i18n('post.skill') });

    var zone = el('div', 'po-char', col);
    var fig = el('div', 'po-fig', zone);
    shadowEl = el('i', 'po-shadow', fig);
    canvas = el('canvas', 'po-nova', fig);
    ghost = el('canvas', 'po-ghost', fig);
    gctx = ghost.getContext('2d');
    /* QA Bug 26 / 13 Oct 2026: NOVA KEYED ON THE CPU, ALWAYS. The WebGL key
       drew her as a white silhouette on real machines (the QA Windows laptop
       and Anmol's Mac, on the live Vercel build), while every software
       renderer drew her right — a GPU/driver difference that cannot be
       tested for ahead of time. The CPU key is the same arithmetic, gives
       the same picture on every machine, and is cheap at 12-30 frames a
       second. ?key=gl brings the GPU key back (with its self-check and
       fall-back) for comparison. */
    keyer = null; keyerIsGL = false; checks = 0;
    if (/[?&]key=(gl|white)\b/.test(location.search)) {
      keyer = glKeyer(canvas);
      keyerIsGL = !!keyer;
    }
    if (!keyer) keyer = cpuKeyer(canvas);

    video = el('video', 'po-src', fig);
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', giveUp);
    video.src = ASSET(POST.video);

    /* the confetti sits over Nova and under the words */
    fx = el('canvas', 'po-fx', root);
    fxc = fx.getContext('2d');
    sprite = makeSprite();

    /* any touch is a gesture: sound may start, and her voice may come up if
       the browser had only let the clip start muted */
    root.addEventListener('pointerdown', function () {
      SFX.arm();
      soundBlocked = false;
    });

    window.addEventListener('resize', fxSize);
    fxSize();
  }

  function variantFor(opts) {
    if (opts && POST.variants[opts.result]) return opts.result;
    var w = opts && typeof opts.wrong === 'number' ? opts.wrong : null;
    if (w === null) return 'pass';
    if (w <= POST.result.perfectMaxWrong) return 'perfect';
    if (w <= POST.result.passMaxWrong) return 'pass';
    return 'retry';
  }

  /* play({ result: 'perfect' | 'pass' | 'retry' })  or  play({ wrong: n }) */
  function play(opts) {
    if (live) stop();
    opts = opts || {};
    result = variantFor(opts);
    V = POST.variants[result];
    live = true;
    clipOK = true; started = false; seeking = false; looping = false; held = false;
    soundBlocked = false; lastDrawn = -1; parts = []; nextTwinkle = 0; drewFx = false;
    lay();
    build();
    document.body.classList.add('in-post');
    void root.offsetWidth;
    root.classList.add('on');
    startVideo();
    if (!INTRO.running()) INTRO.clockStart();
    lastT = INTRO.now();
    hook = tick;
    INTRO.frame(hook);
  }

  function stop() {
    if (hook) { INTRO.unframe(hook); hook = null; }
    window.removeEventListener('resize', fxSize);
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = video = canvas = ghost = gctx = keyer = fx = fxc = sprite = null;
    bgEl = headEl = subEl = shadowEl = null;
    parts = [];
    live = false;
    document.body.classList.remove('in-post');
  }

  window.POST_SCREEN = {
    play: play,
    stop: stop,
    live: function () { return live; },
    resultFor: function (wrong) { return variantFor({ wrong: wrong }); },
    state: function () {
      return {
        live: live,
        result: result,
        keyed: !!keyer,
        clip: clipOK,
        time: video ? +video.currentTime.toFixed(2) : null,
        timeline: live ? +position().toFixed(2) : null,
        piece: piece, looping: looping, held: held,
        beats: Object.keys(fired),
        confetti: parts.length
      };
    }
  };
})();

/* ########################################################################## */
/*  TRANSITION.JS                                                           */
/* ########################################################################## */

/* ============================================================================
   TRANSITION.JS — the bay opening, between levels.

   A level does not begin with a new console sliding in. It begins with the
   bay the previous level was not using sitting DARK — the console's own
   painted bay, with no name on its plate and nothing on its screen — and
   then powering up in front of the child: the label engraves, the drum spins
   up and settles on zero, the gauge re-cuts its ticks for a scale ten times
   larger, and only then does Rill name the new place.

   THERE IS NO COVER PLATE. A bolted metal plate used to be drawn over the new
   bay and taken off; it read as a blocker stuck on the console, so it is
   gone. The dark bay is simply the new bay's label, drum and keys held
   invisible (LEVELUI.showNewBay), which leaves the render's own empty bay
   showing — the same look as a place still to come in the lesson.

   IT RUNS ON THE INTRO'S CLOCK. Every beat is an {at, fn} through INTRO.at,
   so INTRO.kill() cancels the whole thing and there is no second loop and no
   setTimeout anywhere in here.
   ========================================================================= */
(function () {
  'use strict';

  var T = {
    dark: 600,          // the bay sitting dark before it powers up
    engrave: 260,       // the label cutting in
    spin: 500,          // the drum winding up to zero
    ticks: 400          // a beat before she names the new place (the gauge it re-cut is gone)
  };

  var live = false, armed = false, done = null, level = null;

  /* INTRO.at measures from the clock's start, not from the moment of the call,
     so every beat here is scheduled against the clock's own reading. */
  function after(delay, fn) { INTRO.at(INTRO.now() + INTRO.ms(delay), fn); }

  /* ARM — the new bay goes dark. Called the moment the level layer is built,
     so the bay the last level did not use is never seen lit before it opens. */
  function arm(L) {
    if (armed || !window.LEVELUI || !L.revealLine) return;
    if (L.coverPlate === false) return;       // this level's new bay is open all along
    level = L;
    armed = true;
    LEVELUI.showNewBay(false);
  }

  function play(L, then) {
    if (live || !window.LEVELUI || !L.revealLine) { if (then) then(); return; }
    live = true; level = L; done = then;

    INTRO.clockStart();
    /* this level's bay has been open all along: she just names the place */
    if (L.coverPlate === false) {
      LEVELUI.say(level.revealLine);
      after(800, finish);
      return;
    }
    arm(L);
    if (INTRO.REDUCED) return finish();

    /* the bay sits dark a moment — the pause is what makes the rest land —
       then powers up: the label engraves, then the drum, then the gauge */
    after(T.dark, function () {
      LEVELUI.showNewBay(true);
      LEVELUI.engraveLabel();
      SFX.play('lever');
    });
    after(T.dark + T.engrave, function () { LEVELUI.spinNewDrum(); });

    /* and she names it */
    after(T.dark + T.engrave + T.spin + T.ticks, function () {
      LEVELUI.say(level.revealLine);
    });
    /* the brief follows only once the reveal has been read */
    after(T.dark + T.engrave + T.spin + T.ticks + 800, finish);
  }

  /* the end state, reached by finishing or by a tap: bay lit, label set, drum
     on zero, gauge re-cut. Never a half-opened bay. */
  function finish() {
    if (!live) return;
    live = false;
    armed = false;
    LEVELUI.showNewBay(true);
    LEVELUI.engraveLabel();
    var f = done; done = null;
    if (f) f();
  }

  /* a tap lands it, the same way a tap lands everything else in this game */
  document.addEventListener('pointerdown', function (e) {
    if (!live) return;
    if (e.target.closest && e.target.closest('.ctl')) return;   // SKIP, sound
    e.stopPropagation();
    finish();
  }, true);

  window.TRANSITION = {
    arm: arm,
    play: play,
    skip: finish,
    state: function () { return { live: live, level: level && level.id }; }
  };
})();

/* ########################################################################## */
/*  INTRO.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   INTRO.JS — the opening map sequence.

   THE ONE HARD PROBLEM: the map and each close-up are different pictures, and
   the cut between them must never be visible. Three things hide it, and all
   three have to be true at once — the brief is right that missing any one of
   them shows the seam:

     1. FRAMING.  The settlement is at the same screen position in both layers.
        The close-up is placed by its own framing — see solveFrame() — which
        fixes where it is holding closeupPoint on the stage at any scale; the
        map is then driven so that its mapPoint travels to exactly that place.
        The travel finishes at 55% of the dive, before the fade opens at 58%,
        so through the whole cross-fade neither layer is sliding relative to
        the other.

     2. SIZE.  Solved, not eyeballed. See solveDive(): given the measured ratio
        between the settlement's size in the two pictures, and the close-up's
        scale at the hand-off frame, there is exactly one map scale that puts
        the settlement at the same on-screen size. The map's end scale is
        derived backwards from that.

     3. SOFTNESS.  Both layers blur through the swap, and the blur window is
        wider than the fade on both sides, so there is no frame where the
        picture is sharp and half-swapped at the same time.

   Only the close-up's opacity animates. The map is left fully opaque
   underneath and is not hidden until the dive is over — fading both at once
   would let the background show through the middle of the cross-fade, which
   is its own kind of flash.

   ONE CLOCK. Every timed thing is an {at, fn} entry on a single array driven
   by one requestAnimationFrame loop. Nothing calls setTimeout. That is what
   makes Skip safe: kill() empties one array and stops one loop, and there is
   nothing left in flight to fire over the top of the next screen.
   ========================================================================= */

(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SPEED = REDUCED ? TIME.reducedScale : 1;
  function ms(v) { return v * SPEED; }

  /* ---- elements -------------------------------------------------------- */
  var stage   = document.getElementById('stage');
  var mapWrap = document.getElementById('mapWrap');
  var mapImg  = document.getElementById('mapImg');
  var closeWrap = document.getElementById('closeWrap');
  var closeImg  = document.getElementById('closeImg');
  var tagEl   = document.getElementById('tag');
  var bubble  = document.getElementById('bubble');
  var bubTxt  = document.getElementById('bubbleText');
  var bubSize = document.getElementById('bubbleSizer');
  var uiEl    = document.getElementById('ui');
  var stillEl = document.getElementById('still');
  var capEl   = document.getElementById('caption');
  var capTxt  = document.getElementById('captionText');
  var capSize = document.getElementById('captionSizer');
  var skipBtn = document.getElementById('skip');
  var sndBtn  = document.getElementById('sound');
  var loader  = document.getElementById('loader');

  var actors  = {};
  /* where each actor stands on the CURRENT screen, so a bubble pinned to a
     character follows them instead of duplicating their x in the stylesheet */
  var stageX  = {};
  /* what each actor is currently DRESSED in — cut-out, size and place, as one
     string. A screen whose target matches this leaves that actor untouched. */
  var stageKey = {};
  var byId    = {};
  LOCATIONS.forEach(function (l) { byId[l.id] = l; });

  /* ======================================================================= */
  /*  EASING                                                                 */
  /* ======================================================================= */
  function cubicBezier(x1, y1, x2, y2) {
    function cx(t) { return ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t; }
    function cy(t) { return ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t; }
    function dx(t) { return 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1; }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x, i, d, e;
      for (i = 0; i < 6; i++) {
        d = dx(t); if (Math.abs(d) < 1e-7) break;
        e = cx(t) - x; if (Math.abs(e) < 1e-7) break;
        t -= e / d;
      }
      return cy(Math.min(1, Math.max(0, t)));
    };
  }
  var E_DIVE = cubicBezier.apply(null, DIVE.ease);
  var E_PAN  = cubicBezier.apply(null, DIVE.panEase);
  var E_PULL = cubicBezier.apply(null, PULL.ease);
  var E_LAND = cubicBezier.apply(null, DIVE.landEase);

  /* `hidden` is a property of HTMLElement, and SVGElement is not one: assigning
     el.hidden on an <svg> quietly makes an expando and leaves the attribute —
     and so the rule that hides it — exactly where it was. Toggle the attribute
     and it works for both kinds of element. */
  function show(el, on) {
    if (on) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* 0 before a, 1 after b, linear between — the cross-fade uses this raw */
  function ramp(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  /* ======================================================================= */
  /*  THE FRAMING, SOLVED                                                    */
  /*                                                                         */
  /*  Every settlement's centre lands on the same spot: FRAME.x, FRAME.y. The */
  /*  close-up therefore has to be translated, and a translated picture shows */
  /*  its own edge unless it is also scaled up. There is one smallest scale   */
  /*  that keeps all four edges off the stage, and that is what `zoom` is —   */
  /*  never a guess, and never smaller than it has to be, so no location is   */
  /*  cropped harder than its own framing demands.                           */
  /*                                                                         */
  /*  With transform-origin 0 0 a point at image % p lands at  C + z * p,     */
  /*  and C = FRAME - z * focus. Covering the stage is C <= 0 and C + 100z >= */
  /*  100 on both axes, which rearranges to the four ratios below.           */
  /* ======================================================================= */
  /* THE REST STATE IS THE ARTWORK, WHOLE. Every close-up is painted at
     1672x941 — exactly 16:9, exactly the stage — so at scale 1 with no pan it
     fills the frame edge to edge and nothing is cropped. That is the frame the
     player sees at the end of every dive and for the whole settlement scene.

     This used to scale each close-up up until its centroid landed on
     FRAME.x/FRAME.y, and crop whatever that cost. On Rock Post it came out at
     1.9, which showed the landing pad and one dome instead of the settlement.

     coverScale is still the floor, so a future asset that is not 16:9 cannot
     show the stage through a corner. For a 16:9 file it returns 1 and the rest
     state is the identity transform. */
  function solveFrame(loc) {
    return Math.max(1, coverScale([50, 50], [50, 50]));
  }

  /* ======================================================================= */
  /*  THE DIVE, SOLVED                                                       */
  /*                                                                         */
  /*  The close-up is never given a scale of its own. It is LOCKED to the map:*/
  /*                                                                         */
  /*        a(t) = s(t) / ratio        every frame, not just at the hand-off  */
  /*                                                                         */
  /*  Since the settlement is `ratio` times larger in the close-up than on the*/
  /*  map, that identity is exactly the statement "the settlement is the same */
  /*  size on screen in both layers". It holds continuously, so the two       */
  /*  layers also share one velocity: there is no frame anywhere in the fade  */
  /*  where one picture is moving and the other is not.                       */
  /*                                                                         */
  /*  That fixes the map's scale at the moment the fade opens. `a` must have  */
  /*  reached the framing scale `zoom` by then — below it the close-up cannot */
  /*  cover the stage and its edges would show — so s must be exactly         */
  /*  ratio x zoom there. Hence:                                             */
  /*                                                                         */
  /*     0 .. lock   the fall.    a climbs 1/ratio -> zoom, accelerating      */
  /*                              (so s climbs 1 -> ratio x zoom)             */
  /*     lock .. 1   the settle.  a carries on to zoom x over, decelerating,  */
  /*                              with the map locked to it                   */
  /*     then        the landing. a eases from zoom x over back to zoom       */
  /*                              with the map already gone                   */
  /*                                                                         */
  /*  Framing changed the DEPTH of the fall, by the factor `zoom`, and        */
  /*  nothing else: the settle is still x over, the landing still over -> 1,  */
  /*  and every duration and easing curve is untouched.                       */
  /*                                                                         */
  /*  The fall is interpolated in LOG scale. Zoom is multiplicative: a linear  */
  /*  ramp of `scale` reads as slowing down even while the number climbs, so  */
  /*  a dive that is meant to feel like falling has to accelerate in the      */
  /*  exponent, not in the scale.                                             */
  /* ======================================================================= */
  function solveDive(loc) {
    var lock = DIVE.fade.from;
    return {
      lock: lock,
      aStart: 1 / loc.ratio,             // close-up scale while the map is at 1
      aLock: loc.zoom,                   // where the two lock together
      sLock: loc.ratio * loc.zoom,       // the map's scale at that instant
      sEnd: loc.ratio * loc.zoom * DIVE.over
    };
  }
  LOCATIONS.forEach(function (l) {
    l.zoom = solveFrame(l);
    l.solved = solveDive(l);
    /* and it rests where the dive leaves it (DIVE.over, QA Bug 8) */
    l.zoom = l.zoom * DIVE.over;
  });

  /* the close-up's scale at dive progress t */
  function closeScale(loc, t) {
    var S = loc.solved;
    if (t <= S.lock) return S.aStart * Math.pow(S.aLock / S.aStart, E_DIVE(t / S.lock));
    return S.aLock * Math.pow(DIVE.over, E_LAND((t - S.lock) / (1 - S.lock)));
  }
  /* the map's scale at dive progress t — the close-up's is this over ratio */
  function diveScale(loc, t) { return loc.ratio * closeScale(loc, t); }

  /* ======================================================================= */
  /*  THE CLOCK                                                              */
  /* ======================================================================= */
  var clock = { t0: 0, entries: [], raf: null, running: false };

  function clockStart() {
    clock.t0 = performance.now();
    clock.entries = [];
    if (!clock.running) { clock.running = true; clock.raf = requestAnimationFrame(tick); }
  }
  function now() { return performance.now() - clock.t0; }
  /* ABSOLUTE from the start of this slide's clock. */
  function at(t, fn) { clock.entries.push({ at: ms(t), fn: fn, done: false }); }
  /* RELATIVE to this moment — the same queue and the same kill(), but measured
     from now rather than from clockStart(). Anything scheduled from inside a
     camera move needs this: the move runs on its own timer and finishes a long
     way into the slide's clock, so an absolute delay is already in the past by
     then and fires the whole run of entries in a single tick. That is what was
     making the tag card appear whole instead of typing. */
  function after(d, fn) { clock.entries.push({ at: now() + ms(d), fn: fn, done: false }); }

  /* Run everything still pending, in order, immediately. The queue is emptied
     BEFORE the work runs: some of these entries start the next beat, which
     schedules entries of its own, and clearing afterwards would throw that
     new work away and the sequence would stop dead. */
  function flush() {
    var pending = clock.entries.filter(function (e) { return !e.done; })
                               .sort(function (a, b) { return a.at - b.at; });
    clock.entries = [];
    pending.forEach(function (e) { e.done = true; e.fn(); });
  }

  /* one cancel for everything */
  function kill() {
    frameHooks.length = 0;
    clock.entries = [];
    clock.running = false;
    if (clock.raf) cancelAnimationFrame(clock.raf);
    clock.raf = null;
    if (typer.raf) cancelAnimationFrame(typer.raf);
    typer.raf = null;
    anim = null;
  }

  /* The one rAF loop: it fires due timeline entries and steps whatever
     transition is running. There is no other animation driver. */
  var anim = null;          // { kind, loc, t0, ms, done }
  function tick() {
    if (!clock.running) return;
    var t = now();
    for (var i = 0; i < clock.entries.length; i++) {
      var e = clock.entries[i];
      if (!e.done && t >= e.at) { e.done = true; e.fn(); }
    }
    if (anim) stepAnim(performance.now());
    /* the flight draws here, on this loop and no other */
    for (var h = 0; h < frameHooks.length; h++) frameHooks[h](t);
    clock.raf = requestAnimationFrame(tick);
  }
  var frameHooks = [];

  /* ======================================================================= */
  /*  CAMERA STATE                                                           */
  /*                                                                         */
  /*  The map layer is a full-stage element with transform-origin 0 0, so a   */
  /*  point at (px, py)% of it lands on screen at  translate + scale * p.     */
  /*  Putting mapPoint at the screen position `focus` is therefore just       */
  /*  translate = focus - scale * mapPoint, which is exact at any scale.      */
  /* ======================================================================= */
  var cam = { s: 1, fx: 50, fy: 50, anchor: [50, 50], a: 1 };

  /* THE SMALLEST SCALE THAT STILL COVERS THE STAGE for a given pan.
     Putting map point `anchor` at screen `focus` means translate = focus - s *
     anchor, and the picture covers only while translate <= 0 and translate +
     100s >= 100 on both axes. Solve each for s and take the largest. Below
     this the map's own corner walks into frame — which is exactly the wedge
     that was opening from the bottom-left during the pan, because early in
     the dive the travel outruns the zoom. */
  function coverScale(anchor, focus) {
    return Math.max(1,
      focus[0] / anchor[0], (100 - focus[0]) / (100 - anchor[0]),
      focus[1] / anchor[1], (100 - focus[1]) / (100 - anchor[1]));
  }

  function applyMap() {
    /* the translate clamp is the backstop: with the scale floor above it is
       already satisfied, and if anything ever slips past that floor the edge
       still cannot enter the frame */
    var lo = 100 * (1 - cam.s);
    var tx = clamp(cam.fx - cam.s * cam.anchor[0], lo, 0);
    var ty = clamp(cam.fy - cam.s * cam.anchor[1], lo, 0);
    mapWrap.style.transform =
      'translate(' + tx.toFixed(4) + '%,' + ty.toFixed(4) + '%) scale(' + cam.s.toFixed(5) + ')';
  }
  /* returns the scale actually used, which may have been raised to cover */
  function setMap(anchor, focus, s) {
    cam.anchor = anchor; cam.fx = focus[0]; cam.fy = focus[1];
    cam.s = Math.max(s, coverScale(anchor, focus) * FRAME.cover);
    applyMap();
    return cam.s;
  }

  /* THE CLOSE-UP. transform-origin 0 0, like the map, and translated so that
     `focus` — the settlement's centre — sits on FRAME whatever the scale. That
     one point is nailed to the stage for the whole dive, the landing and the
     rest, so the framing is fixed before the picture is ever visible. */
  /* The close-up is scaled ABOUT closeupPoint: that one point stays at its own
     image percentage on the stage at every scale, so at a = 1 the transform is
     the identity and the artwork sits exactly as the file is. At scale 1 image
     percent and stage percent are the same thing, which is the whole reason
     the solve gets shorter rather than longer. */
  function setClose(loc, a) {
    cam.a = a;                         // read by the flight bridge's terrain()
    var cx = (1 - a) * loc.closeupPoint[0];
    var cy = (1 - a) * loc.closeupPoint[1];
    closeWrap.style.transform =
      'translate(' + cx.toFixed(4) + '%,' + cy.toFixed(4) + '%) scale(' + a.toFixed(5) + ')';
  }
  /* where the close-up is holding the SETTLEMENT — closeupPoint, the point the
     map has to arrive at. It is not FRAME unless the measured swap anchor and
     the framing centre happen to be the same point, which they are not. */
  /* WHERE THE CLOSE-UP IS HOLDING THE SETTLEMENT, and so where the map has to
     bring it. Now that the close-up is scaled about closeupPoint, that is the
     same stage position at every scale — the target no longer moves, and the
     map's travel is a straight run to one fixed place. */
  function closeAnchor(loc, a) {
    return [loc.closeupPoint[0], loc.closeupPoint[1]];
  }
  function filt(el, blurPx, bright) {
    var f = '';
    if (blurPx > 0.01) f += 'blur(' + blurPx.toFixed(2) + 'px) ';
    if (Math.abs(bright - 1) > 0.001) f += 'brightness(' + bright.toFixed(3) + ')';
    el.style.filter = f || 'none';
  }
  function willChange(on) {
    var v = on ? 'transform, opacity, filter' : 'auto';
    mapWrap.style.willChange = v;
    closeWrap.style.willChange = v;
  }

  /* ======================================================================= */
  /*  TRANSITIONS                                                            */
  /* ======================================================================= */
  /* THE TWO STATES A CHARACTER CAN BE IN.

     `in`      is in this scene. `ducked` is below the frame. An actor that is
     ducked WITHOUT `in` is not in the scene at all and stays down; one that is
     ducked WITH `in` is only out of shot for a camera move and comes back up.
     That difference is what lets popUp() raise the scene again without also
     raising whoever does not belong on this screen.

     Neither list is written out — both run over CAST_IDS, so Rill is covered
     by the same code that covers the other two. */
  function duckCast(on) {
    CAST_IDS.forEach(function (id) {
      if (actors[id]) actors[id].classList.toggle('ducked', !!on);
    });
    /* the bubble belongs to whoever is standing there: it leaves with them and
       comes back with them, rather than floating over a moving map */
    bubble.classList.toggle('ducked', !!on);
  }
  /* everyone who is in the scene comes back up, not only the speaker — Veth is
     still there while Nova asks him something */
  function popUp() {
    CAST_IDS.forEach(function (id) {
      var a = actors[id];
      if (a && a.classList.contains('in')) a.classList.remove('ducked');
    });
    bubble.classList.remove('ducked');
  }

  function startAnim(kind, loc, dur, onEnd) {
    if (kind === 'dive' || kind === 'pull') duckCast(true);
    anim = { kind: kind, loc: loc, t0: performance.now(), ms: ms(dur), end: onEnd };
    willChange(true);
    stepAnim(performance.now());
  }

  function stepAnim(tNow) {
    var t = clamp((tNow - anim.t0) / anim.ms, 0, 1);
    if (anim.kind === 'dive') stepDive(anim.loc, t);
    else if (anim.kind === 'pull') stepPull(anim.loc, t);
    if (t >= 1) {
      var end = anim.end;
      anim = null;
      willChange(false);
      if (end) end();
    }
  }

  /* ---- the dive -------------------------------------------------------- */
  function stepDive(loc, t) {
    var s = diveScale(loc, t);

    /* map: falling in, and travelling so the settlement arrives at the screen
       position the close-up is holding it at. The travel is finished before
       the fade opens, so through the swap neither layer is sliding. */
    var q = closeAnchor(loc, s / loc.ratio);
    var p = E_PAN(clamp(t / DIVE.panEnd, 0, 1));
    var fx = lerp(loc.mapPoint[0], q[0], p);
    var fy = lerp(loc.mapPoint[1], q[1], p);

    /* setMap may RAISE the scale to keep the map's edge out of frame. It only
       ever does so in the first tenth of the dive, where the travel briefly
       outruns the zoom and the close-up is still at opacity 0 — but the
       close-up is driven from whatever scale came back, so the lock stays
       exact whether the clamp fired or not. */
    s = setMap(loc.mapPoint, [fx, fy], s);

    /* close-up: locked to the map, every frame */
    setClose(loc, s / loc.ratio);

    /* LINEAR cross-fade. Only the close-up's opacity moves; the map stays
       opaque underneath so nothing shows through the middle of the swap. */
    closeWrap.style.opacity = ramp(t, DIVE.fade.from, DIVE.fade.to).toFixed(4);

    /* blur and bloom: wider than the fade on both sides, peaking on its
       midpoint, so the picture is never sharp and half-swapped at once */
    var b = blurAt(t);
    filt(mapWrap, b.px, b.bright);
    filt(closeWrap, b.px, b.bright);
  }

  /* the close-up carried a little past its own framing so that it and the map
     could stay locked through the fade; now, alone on screen, it settles */
  function land(loc, done) {
    if (REDUCED) { setClose(loc, loc.zoom); if (done) done(); return; }
    var t0 = performance.now(), D = ms(DIVE.landMs);
    /* the dive now ends at the resting scale itself (QA Bug 8), so there
       is nothing to settle: from and to are the same */
    var from = loc.zoom, to = loc.zoom;
    closeWrap.style.willChange = 'transform';
    (function step() {
      if (!clock.running) { setClose(loc, to); closeWrap.style.willChange = 'auto'; if (done) done(); return; }
      var t = clamp((performance.now() - t0) / D, 0, 1);
      setClose(loc, lerp(from, to, E_LAND(t)));
      if (t < 1) requestAnimationFrame(step);
      else { closeWrap.style.willChange = 'auto'; if (done) done(); }
    })();
  }

  function blurAt(t) {
    var mid = (DIVE.fade.from + DIVE.fade.to) / 2;
    var k = t < mid ? ramp(t, DIVE.blur.from, mid)
                    : 1 - ramp(t, mid, DIVE.blur.to);
    k = smooth(clamp(k, 0, 1));
    return { px: DIVE.blur.px * k, bright: 1 + DIVE.bloom * k };
  }

  /* ---- the pull-out ---------------------------------------------------- */
  function stepPull(loc, t) {
    var e = E_PULL(t);
    /* the close-up smears away: bigger, blurrier, brighter, gone */
    setClose(loc, loc.zoom * lerp(1, PULL.closeTo, e));
    closeWrap.style.opacity = (1 - e).toFixed(4);
    filt(closeWrap, PULL.closeBlur * e, 1 + PULL.closeBloom * e);

    /* underneath, the map comes back at the scale that matches the close-up's
       framing — ratio x zoom, by construction — and settles to 1 as the blur
       clears. It starts from exactly where the dive left it. */
    var q = closeAnchor(loc, loc.zoom);
    var s = lerp(loc.ratio * loc.zoom, 1, e);
    var fx = lerp(q[0], loc.mapPoint[0], e);
    var fy = lerp(q[1], loc.mapPoint[1], e);
    s = setMap(loc.mapPoint, [fx, fy], s);
    filt(mapWrap, PULL.mapBlur * (1 - e), 1);

  }

  /* ======================================================================= */
  /*  THE TAG CARD                                                           */
  /*                                                                         */
  /*  One fixed place, low and left, chosen because it is open ground on all  */
  /*  THREE close-ups and clear of Veth — see CARD in config.js, and the      */
  /*  check in introRest() that measures it against each settlement's real    */
  /*  extent. Fixed beats clever here: a readout that hops about to dodge     */
  /*  things reads as an accident, and one place that never covers anything   */
  /*  is better than three places that each only just miss.                   */
  /*  The position itself lives in style.css; nothing here touches it.        */
  /* ======================================================================= */
  /* how long the card takes to finish typing — the beat after it waits for
     THIS rather than for a fixed delay, so a longer row does not get its tail
     stepped on by the next line */
  var tagRuns = TIME.tagIn;

  function showTag(loc) {
    /* THREE ROWS: Station, Population, Distance. A card can also be handed
       straight in as { name, rows } — screen 1's Base Station card is. */
    var card = loc.rows ? loc :
      { name: i18n('locations.station', { name: loc.name }), rows: [loc.pop, loc.dist] };
    tagEl.innerHTML =
      '<div class="tag-face">' +
        '<div class="tag-name"><i class="glyph">◈</i><span></span></div>' +
        card.rows.map(function () { return '<div class="tag-row tag-ord"><span></span></div>'; }).join('') +
      '</div>';
    show(tagEl, true);
    void tagEl.offsetWidth;
    tagEl.classList.add('on');
    if (!REDUCED) tagEl.animate([
      { transform: 'translateY(-140%) rotate(-5deg)', opacity: 0 },
      { transform: 'translateY(10%) rotate(1.5deg)', opacity: 1, offset: 0.62 },
      { transform: 'translateY(-3%) rotate(-0.5deg)', offset: 0.82 },
      { transform: 'translateY(0) rotate(0)', opacity: 1 }
    ], { duration: 820, easing: 'ease-out' });

    var n = tagEl.querySelector('.tag-name span');
    var rows = tagEl.querySelectorAll('.tag-ord span');
    var t = TIME.tagIn;
    t += typeInto(n, card.name, t);
    card.rows.forEach(function (txt, i) {
      t += TIME.tagRowGap;
      t += typeInto(rows[i], txt, t);
    });
    tagRuns = t;
  }
  function hideTag() {
    tagEl.classList.remove('on');
    after(TIME.tagIn, function () {
      if (!tagEl.classList.contains('on')) { tagEl.innerHTML = ''; show(tagEl, false); }
    });
  }
  function typeInto(node, text, start) {
    if (REDUCED) { after(start, function () { node.textContent = text; }); return 0; }
    for (var i = 1; i <= text.length; i++) {
      (function (k) {
        after(start + k * TIME.charMs, function () {
          node.textContent = text.slice(0, k);
          if (k % 3 === 0) SFX.play('tick');
        });
      })(i);
    }
    return text.length * TIME.charMs;
  }

  /* ======================================================================= */
  /*  THE CAST                                                               */
  /* ======================================================================= */
  /* THE CAST IS A LIST, so adding Rill for slide 6 is one entry here and one
     in CAST. Nothing else in the intro counts characters. */
  var CAST_IDS = ['veth', 'rill', 'nova'];

  /* DRESS AN ACTOR IN A LOOK: a cut-out, the opaque box inside its own file,
     the figure's own aspect, and how tall it stands. A screen may override any
     of it through SLIDE_ART's `look`, which is how Rill carries a standing
     pose for the map and a pointing one for the panel without being two
     characters. Anything the look leaves out falls back to CAST. */
  function dress(id, look) {
    var c = CAST[id], a = actors[id];
    if (!a) return;
    a.classList.remove('turned');         // a walk's turn belongs to that screen
    var L = look || {};
    var box = L.box || c.box;
    var f = a.querySelector('.fig');
    f.style.backgroundImage = 'url("' + ASSET(L.src || c.src) + '")';
    f.style.backgroundSize = (100 / box.w * 100).toFixed(3) + '% ' +
                             (100 / box.h * 100).toFixed(3) + '%';
    /* A cut-out whose figure touches an edge of its own file has box.w or
       box.h at 100, and the crop fraction is then 0/0. That is NaN, which
       makes the whole declaration invalid and silently drops the framing —
       Rill's panel pose is exactly that case, full height in his file, and
       he was being cropped to the left edge of the picture. Nothing to slide
       along an axis with no slack, so it is 0. */
    var px = box.w < 100 ? box.x / (100 - box.w) * 100 : 0;
    var py = box.h < 100 ? box.y / (100 - box.h) * 100 : 0;
    f.style.backgroundPosition = px.toFixed(3) + '% ' + py.toFixed(3) + '%';
    a.style.height = (L.h != null ? L.h : c.h) + '%';
    a.style.aspectRatio = String(L.aspect != null ? L.aspect : c.aspect);
    /* a SHEET of frames rather than one picture: the box is one frame's, so
       the sheet is scaled up by its column and row count, and he is put on
       his resting frame */
    var s = !L.src && c.sprite;
    a.classList.toggle('sprite', !!s);
    if (s) {
      if (!players[id]) {
        players[id] = SPRITE.player(f, sheetOf(id), function () {
          return mouthState(a.classList.contains('talking') && a.classList.contains('sprite'));
        });
      } else players[id].reset();
    }
  }

  /* a cast member who talks in frames: their sheet, as SPRITE.JS wants it */
  var players = {};
  function sheetOf(id) {
    var c = CAST[id], s = {};
    Object.keys(c.sprite).forEach(function (k) { s[k] = c.sprite[k]; });
    s.src = c.src; s.box = c.box;
    return s;
  }

  function buildCast() {
    CAST_IDS.forEach(function (id) {
      var a = document.createElement('div');
      a.className = 'actor ' + id;
      var f = document.createElement('div');
      f.className = 'fig';
      a.appendChild(f);
      uiEl.appendChild(a);
      actors[id] = a;
      dress(id, null);
      /* everyone starts where they will stand, below the frame. Nobody walks
         in from the side any more: they rise. */
      a.style.left = CAST[id].x + '%';
      a.classList.add('ducked');
    });
  }

  /* MOVE an actor without animating the move. Rill stands in one place on the
     map and another on the panel, and he is below the frame when he is put
     there, so sliding between the two would be a two-second transition
     playing over nothing. */
  function place(id, x) {
    var a = actors[id];
    if (!a) return;
    a.style.transition = 'none';
    a.style.left = x + '%';
    void a.offsetWidth;
    a.style.transition = '';
  }

  /* RISE FROM BELOW THE FRAME. The overshoot in .actor's transform curve is
     what makes it read as stepping up rather than sliding on. Idempotent:
     calling it for somebody already standing there just brings them back up
     if a camera move had put them down. */
  function popIn(id) {
    var a = actors[id];
    if (!a) return;
    if (a.classList.contains('in')) { a.classList.remove('ducked'); return; }
    a.classList.add('in');
    void a.offsetWidth;
    a.classList.remove('ducked');
    after(TIME.charRise, function () { a.classList.add('settled'); });
    SFX.play(id === 'nova' ? 'wake' : 'focus');
  }

  /* WALK somebody already standing to a new spot, in view. The duration is
     written to `left` only; place() clears it again next time they are moved.
     A turn flips the cut-out on the spot before the walk starts. stageKey is dropped because they are no
     longer where their dressing put them. */
  var walks = [], bubbleDx = {};
  function walkAcross(walk) {
    Object.keys(walk).forEach(function (id) {
      var a = actors[id], w = walk[id];
      if (!a) return;
      var e = { a: a, w: w, started: false };
      walks.push(e);
      var go = function () {
        if (e.started) return;
        e.started = true;
        a.style.transitionDuration = ms(w.ms) + 'ms, 400ms, 520ms';
        a.style.left = w.x + '%';
      };
      stageX[id] = w.x;
      bubbleDx[id] = w.bubbleDx || 0;
      stageKey[id] = null;
      /* the turn comes first, and she only sets off once it has finished */
      if (w.turn) { a.classList.toggle('turned'); after(TIME.turn, go); }
      else go();
    });
  }

  /* A TAP DURING THE SCENE CHANGE lands everything at once, and her line
     starts with it — so a walk in progress has to land too, or the bubble
     arrives at her spot before she does. */
  function landWalks() {
    walks.forEach(function (e) {
      e.started = true;
      e.a.style.transitionDuration = '0ms, 400ms, 520ms';
      e.a.style.left = e.w.x + '%';
    });
    walks = [];
  }

  /* OUT OF THE SCENE: down, and `in` taken off so popUp() leaves them down. */
  function exit(id) {
    var a = actors[id];
    if (!a) return;
    a.classList.remove('in', 'settled');
    a.classList.add('ducked');
  }

  /* Veth -> 'Veth'. The cast ids ARE the names, so there is no second list to
     keep in step. */
  function nameOf(id) { return id.charAt(0).toUpperCase() + id.slice(1); }

  /* WHO BELONGS ON A SCREEN, derived from the screen's own lines: whoever
     speaks on it and whoever it names by name — minus anyone the screen's own
     artwork already contains, who must never also be stood up as a cut-out. */
  function castFor(n) {
    var art = SLIDE_ART[n] || null;
    var painted = art ? art.cast : [];
    var named = SLIDE_CAST[n] || null;
    var lines = linesFor(n);
    return CAST_IDS.filter(function (id) {
      /* never twice: anybody the screen's own artwork already contains is out,
         whichever way the rest of the list was arrived at */
      if (painted.indexOf(id) >= 0) return false;
      /* a screen may name its cast outright — see SLIDE_CAST — for the case
         where a line addresses somebody who is not in the frame */
      if (named) return named.indexOf(id) >= 0;
      return lines.some(function (l) {
        return l.speaker === id || l.text.indexOf(nameOf(id)) >= 0;
      });
    });
  }

  /* THE NAME WATCHER. As the line types, anyone it names rises the moment
     their name lands — so on screen 5 Nova arrives on the first word and Rill
     four words later, without a single timing written down. */
  var lineCast = [], risen = {};
  function watchNames(typed) {
    lineCast.forEach(function (id) {
      if (risen[id] || typed.indexOf(nameOf(id)) < 0) return;
      risen[id] = true;
      popIn(id);
    });
  }

  /* ======================================================================= */
  /*  SPEECH                                                                 */
  /* ======================================================================= */
  var typer = { raf: null, text: '', i: 0, t0: 0, done: true, node: null };

  /* THE NARRATOR HAS NO BUBBLE. A narrated line has nobody on stage to point
     a tail at, so it runs in the caption band instead. The only thing that
     decides which is `speaker`, so moving a line between the two is an edit
     in script.js and nowhere else. Both are typed by the same typewriter at
     the same rate and both carry the same `vo` hook. */
  function narrated(line) { return line.speaker === 'narrator'; }

  function hideVoice() {
    bubble.classList.remove('on', 'ducked'); show(bubble, false);
    capEl.classList.remove('on'); show(capEl, false);
  }

  function say(line) {
    popUp();
    var cap = narrated(line);
    var host = cap ? capEl : bubble;
    var node = cap ? capTxt : bubTxt;
    var size = cap ? capSize : bubSize;

    /* Whatever is not speaking this line goes away first, so the two are
       never on screen together — and it is emptied, not just hidden. A hidden
       box still holding the last line is a box that flashes the wrong words
       the next time it is shown. */
    if (cap) {
      bubble.classList.remove('on', 'ducked'); show(bubble, false);
      bubTxt.textContent = ''; bubSize.textContent = '';
    } else {
      capEl.classList.remove('on'); show(capEl, false);
      capTxt.textContent = ''; capSize.textContent = '';
    }

    /* whose side the box sits on: Nova right, Rill over herself in the
       middle, Veth left. The band has no side. */
    if (!cap) {
      bubble.className = 'bubble ' + (line.speaker === 'nova' ? 'right' :
                                      line.speaker === 'rill' ? 'mid' : 'left');
      bubble.style.left = '';
      bubble.style.removeProperty('--tail');
    }
    show(host, true);
    node.textContent = '';
    size.textContent = line.text;         // sizes the box to the finished line
    void host.offsetWidth;

    /* THE MIDDLE BUBBLE SITS ON ITS SPEAKER, so it goes where she is standing
       rather than where the stylesheet once guessed she would be. She stands
       three quarters of the way across, though, and a box centred there runs
       off the stage — so the box is held inside the frame and the TAIL slides
       along it to keep pointing at her. Measured, because it depends on how
       long the line is. */
    if (!cap && line.speaker === 'rill' && stageX.rill != null) {
      var stageW = stage.getBoundingClientRect().width;
      var half = stageW ? (bubble.offsetWidth / stageW) * 50 : 0;
      var pad = 1.5;
      /* a screen's walk can push the box off-centre to the right of her */
      var want = stageX.rill + (bubbleDx.rill || 0);
      var at = Math.min(Math.max(want, half + pad), 100 - half - pad);
      bubble.style.left = at + '%';
      /* where she is, as a percentage along the box's own width */
      var t = half > 0 ? 50 + (stageX.rill - at) / (2 * half) * 100 : 50;
      bubble.style.setProperty('--tail', Math.min(Math.max(t, 4), 96) + '%');
    }
    host.classList.add('on');
    host.dataset.vo = line.vo;
    audioHook(line);
    typer.node = node;
    /* THE LINE IS SPOKEN, not shown: the typewriter still runs underneath
       (it is what raises the characters as they are named), paced to finish
       as the voice does, and the next line follows on its own a beat later.
       A tap still finishes a line early and moves on. */
    talking(line.speaker, true);
    var voiced = VOICE.play(line.text, function () { talking(line.speaker, false); bubble.classList.remove('speaking'); });
    DIALOG.hide();
    if (!narrated(line)) sideBubble(line.speaker);
    typer.cms = voiced ? voiced / Math.max(1, line.text.length) : 0;
    var mine = ++lineSeq;
    after((voiced || line.text.length * TIME.charMs) + (line.hold || TIME.lineHold), function () {
      if (mine !== lineSeq || finished) return;
      if (phase === 'typing' || phase === 'held') { phase = 'held'; nextLine(true); }
    });

    /* the speaker rises first, then anyone the line names rises as it is
       typed. Both go through the same list, so nobody the screen's art
       already contains is ever stood up. */
    lineCast = castFor(slide); risen = {};
    if (lineCast.indexOf(line.speaker) >= 0) { risen[line.speaker] = true; popIn(line.speaker); }

    if (REDUCED) { node.textContent = line.text; typer.done = true; watchNames(line.text); return; }
    typer.text = line.text; typer.i = 0; typer.t0 = performance.now(); typer.done = false;
    if (typer.raf) cancelAnimationFrame(typer.raf);
    typer.raf = requestAnimationFrame(typeStep);
  }
  function typeStep() {
    var vp = VOICE.progress(typer.text);
    var want = vp >= 0 ? Math.floor(Math.min(1, vp / 0.92) * typer.text.length)
                       : Math.floor((performance.now() - typer.t0) / (typer.cms || ms(TIME.charMs)));
    if (want > typer.i) {
      typer.i = Math.min(want, typer.text.length);
      if (typer.node) typer.node.textContent = typer.text.slice(0, typer.i);
      watchNames(typer.text.slice(0, typer.i));
    }
    if (typer.i >= typer.text.length) { typer.done = true; typer.raf = null; return; }
    typer.raf = requestAnimationFrame(typeStep);
  }
  function finishLine() {
    if (typer.raf) cancelAnimationFrame(typer.raf);
    typer.raf = null;
    if (typer.node) typer.node.textContent = typer.text;
    /* tapping through the line still brings on everyone it names */
    watchNames(typer.text);
    typer.done = true;
  }


  /* ======================================================================= */
  /*  MOTION — the storybook layer: the push into the holo-table, a slow     */
  /*  drift on every still, the card dropping in, an iris on the machine,    */
  /*  and dust in the air. All Web Animations, so PAUSE.JS holds them too.   */
  /* ======================================================================= */
  var MOTION = {
    holo: { origin: '50% 84%', scale: 3.6, blur: 22, ms: 1500, flashMs: 380, clearMs: 900 },
    drift: { to: 1.07, ms: 14000 },
    iris: { ms: 900 }
  };
  var holoAnims = [];
  function holoZoom(done) {
    var H = MOTION.holo;
    if (REDUCED || !stillEl.classList.contains('on')) {
      hideStill();
      return after(TIME.tagIn, done);
    }
    SFX.play('zoom', 'in');
    stillEl.style.transformOrigin = H.origin;
    var flash = document.getElementById('holoFlash');
    if (!flash) {
      flash = document.createElement('div');
      flash.id = 'holoFlash';
      stage.insertBefore(flash, document.getElementById('ui'));
    }
    holoAnims = [
      stillEl.animate([
        { transform: 'scale(1)', filter: 'blur(0px) brightness(1)' },
        { transform: 'scale(' + H.scale + ')', filter: 'blur(' + H.blur + 'px) brightness(1.35)' }
      ], { duration: H.ms, easing: 'cubic-bezier(0.55, 0, 0.75, 0.2)', fill: 'forwards' }),
      flash.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }],
                    { duration: H.ms, easing: 'ease-in', fill: 'forwards' })
    ];
    after(H.ms, function () {
      /* the map is under the still already; it comes up blurred and clears */
      holoAnims.forEach(function (a) { a.cancel(); });
      stillEl.classList.remove('on'); show(stillEl, false);
      stillEl.style.transformOrigin = '';
      filt(mapWrap, 0, 1);
      holoAnims = [
        mapWrap.animate([{ filter: 'blur(' + H.blur + 'px) brightness(1.3)' }, { filter: 'blur(0px) brightness(1)' }],
                        { duration: H.clearMs, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }),
        flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: H.flashMs + H.clearMs, easing: 'ease-out', fill: 'forwards' })
      ];
      after(H.clearMs * 0.6, done);
    });
  }

  /* every still drifts in slowly while it is up — a camera that is alive */
  var driftAnim = null;
  function drift(el) {
    if (REDUCED) return;
    if (driftAnim) driftAnim.cancel();
    driftAnim = el.animate([{ scale: '1' }, { scale: String(MOTION.drift.to) }],
                           { duration: MOTION.drift.ms, easing: 'ease-out', fill: 'forwards' });
  }

  /* the machine screen opens as an iris, the way a storybook turns a page */
  function iris(el) {
    if (REDUCED) return;
    el.animate([{ clipPath: 'circle(0% at 50% 55%)' }, { clipPath: 'circle(75% at 50% 55%)' }],
               { duration: MOTION.iris.ms, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
  }


  /* THE SPOTLIGHT. When a character is on screen the picture dims a little
     and what they are talking about stays lit: on screen 5 Veth's three
     stations, on screen 6 the panel Rill is about to explain. Shapes are in
     stage % — ellipses { x, y, rx, ry } or rects { x, y, w, h }. */
  var SPOTS = {
    5: { dim: 0.55, ring: true, shapes: LOCATIONS.map(function (l) {
           return { x: l.mapPoint[0], y: l.mapPoint[1], rx: 8, ry: 13 }; }) },
    6: { dim: 0.6, shapes: [{ x: 34.6, y: 60.5, w: 40.8, h: 30 }, { x: 79.4, y: 59.4, w: 14, h: 28.8 }] }
  };
  var spotEl = null;
  function spotFor(n) {
    var S = SPOTS[n];
    if (!spotEl) {
      spotEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      spotEl.id = 'spot';
      spotEl.setAttribute('viewBox', '0 0 100 100');
      spotEl.setAttribute('preserveAspectRatio', 'none');
      stage.insertBefore(spotEl, document.getElementById('ui'));
    }
    if (!S) { spotEl.classList.remove('on'); return; }
    var holes = S.shapes.map(function (h) {
      return h.w != null
        ? '<rect x="' + h.x + '" y="' + h.y + '" width="' + h.w + '" height="' + h.h + '" rx="1.5" fill="#000"/>'
        : '<ellipse cx="' + h.x + '" cy="' + h.y + '" rx="' + h.rx + '" ry="' + h.ry + '" fill="#000"/>';
    }).join('');
    var rings = S.ring ? S.shapes.map(function (h, i) {
      return '<ellipse class="spot-ring" style="animation-delay:' + (i * 0.35) + 's" cx="' + h.x + '" cy="' + h.y +
             '" rx="' + (h.rx * 0.7) + '" ry="' + (h.ry * 0.7) + '"/>';
    }).join('') : S.shapes.map(function (h) {
      return '';
    }).join('');
    spotEl.innerHTML =
      '<defs><filter id="spotSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>' +
      '<mask id="spotMask"><rect width="100" height="100" fill="#fff"/><g filter="url(#spotSoft)">' + holes + '</g></mask></defs>' +
      '<rect width="100" height="100" fill="rgba(4,8,14,' + S.dim + ')" mask="url(#spotMask)"/>' + rings;
    void spotEl.getBoundingClientRect();
    spotEl.classList.add('on');
  }


  /* THE SPEECH BUBBLE SITS ON ITS SPEAKER: beside their head, tail pointing
     at them, in their colour, with their name on it. Worked out from where
     the cut-out stands and how tall it is on this screen, not measured off
     the element, because at this moment it is still rising into place. */
  var BUB_NAMES = { veth: 'COMMANDER VETH', rill: 'RILL', nova: 'NOVA' };
  /* THE TAIL POINTS AT THE FACE. It leaves the bubble's side nearest the
     speaker, as level with their face as the bubble allows, and turns to aim
     straight at it — so a bubble that had to move above or below the head
     still points at the person talking. */
  function aimTail(x, w, h, right) {
    var st = stage.getBoundingClientRect(), b = bubble.getBoundingClientRect();
    if (!st.width || !b.width) return;
    var fx = st.left + (right ? x - w * 0.12 : x + w * 0.12) / 100 * st.width;
    var fy = st.top + (100 - h + h * 0.1) / 100 * st.height;
    var ex = right ? b.right : b.left;
    var pad = Math.min(30, b.height / 2 - 4);
    var ay = Math.max(b.top + pad, Math.min(b.bottom - pad, fy));
    var ang = Math.atan2(fy - ay, fx - ex) * 180 / Math.PI;
    var rot = right ? ang : ang - 180;
    if (rot > 180) rot -= 360; if (rot < -180) rot += 360;
    rot = Math.max(-65, Math.min(65, rot));
    bubble.style.setProperty('--ty', (ay - b.top) + 'px');
    bubble.style.setProperty('--tr', rot + 'deg');
  }
  function spotBoxes() {
    var S = SPOTS[slide];
    if (!S) return [];
    return S.shapes.map(function (h) {
      return h.w != null ? { x0: h.x, x1: h.x + h.w, y0: h.y, y1: h.y + h.h }
                         : { x0: h.x - h.rx, x1: h.x + h.rx, y0: h.y - h.ry, y1: h.y + h.ry };
    });
  }
  function placeClear(want, headTop) {
    var boxes = spotBoxes();
    var st = stage.getBoundingClientRect(), b = bubble.getBoundingClientRect();
    if (!st.width) return;
    var bw = b.width / st.width * 100, bh = b.height / st.height * 100;
    var x0 = (b.left - st.left) / st.width * 100, x1 = x0 + bw;
    var pad = 1.5;
    function hits(top) {
      return boxes.some(function (r) {
        return x1 > r.x0 && x0 < r.x1 && top + bh + pad > r.y0 && top - pad < r.y1;
      });
    }
    var best = want;
    if (hits(want)) {
      best = null;
      for (var d = 1; d <= 100 && best === null; d++) {
        [want - d, want + d].forEach(function (t) {
          if (best === null && t >= 1.5 && t + bh <= 98.5 && !hits(t)) best = t;
        });
      }
      if (best === null) best = Math.max(1.5, want);
    }
    bubble.style.top = best + '%';
    /* the tail comes off whichever corner is nearer the speaker's head */
    bubble.classList.toggle('tail-low', best + bh < headTop + 12);
  }
  function sideBubble(id) {
    var c = CAST[id];
    if (!c) return;
    var art = SLIDE_ART[slide], lk = (art && art.look && art.look[id]) || (SLIDE_POS[slide] || {})[id] || {};
    var h = lk.h != null ? lk.h : c.h, asp = lk.aspect != null ? lk.aspect : c.aspect;
    var x = lk.x != null ? lk.x : (stageX[id] != null ? stageX[id] : c.x);
    var w = h * (9 / 16) * asp;
    /* the bubble goes on whichever side of the speaker has room for it */
    var right = x + w / 2 + 42 > 98.5;
    bubble.className = 'bubble on side ' + id + (right ? ' flip' : '');
    bubble.style.removeProperty('--tail');
    /* THE BUBBLE NEVER COVERS WHAT IS BEING TALKED ABOUT. It starts beside
       the speaker's head and is slid up or down, as little as it takes,
       until it clears every lit shape of this screen's spotlight. The box
       already holds the whole line (the sizer), so its height is final. */
    var want = 100 - h + 4;
    bubble.style.bottom = '';
    bubble.style.top = want + '%';
    placeClear(want, 100 - h);
    if (right) { bubble.style.left = ''; bubble.style.right = (100 - (x - w / 2) + 0.8) + '%'; }
    else { bubble.style.right = ''; bubble.style.left = (x + w / 2 + 0.8) + '%'; }
    var tag = bubble.querySelector('.bub-name');
    if (!tag) {
      tag = document.createElement('span'); tag.className = 'bub-name';
      bubble.querySelector('.bub-face').prepend(tag);
      var wv = document.createElement('span'); wv.className = 'bub-wave';
      wv.innerHTML = '<i></i><i></i><i></i><i></i>';
      bubble.querySelector('.bub-face').appendChild(wv);
    }
    tag.textContent = BUB_NAMES[id] || '';
    aimTail(x, w, h, right);
    bubble.classList.add('speaking');
    if (!REDUCED) bubble.animate([
      { transform: 'scale(0.3)', opacity: 0 },
      { transform: 'scale(1.06)', opacity: 1, offset: 0.65 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: 480, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.3)' });
  }

  /* THE SPEAKER MOVES while the voice plays: a small talking bob on the
     cut-out, off again the moment the line ends. */
  function talking(id, on) {
    CAST_IDS.forEach(function (k) {
      if (actors[k]) actors[k].classList.toggle('talking', !!on && k === id);
      /* one who talks in frames starts them, or settles back to rest */
      if (players[k]) players[k].kick();
    });
  }

  /* DUST IN THE AIR over Titan — orange haze motes outside, cyan holo
     sparks indoors. One small canvas, one frame loop, gone with the intro. */
  var dust = (function () {
    var cv = document.createElement('canvas'), cx = cv.getContext('2d'), motes = [], on = false, tint = 'haze';
    cv.id = 'dust';
    stage.insertBefore(cv, document.getElementById('ui'));
    function size() { cv.width = stage.clientWidth; cv.height = stage.clientHeight; }
    function seed() {
      motes = [];
      for (var i = 0; i < 46; i++) motes.push({
        x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.2,
        vx: 0.00004 + Math.random() * 0.00012, vy: -0.00002 - Math.random() * 0.00006,
        a: 0.15 + Math.random() * 0.45, p: Math.random() * 6.28
      });
    }
    var last = 0;
    function frame(t) {
      if (!on) return;
      var dt = last ? Math.min(50, t - last) : 16; last = t;
      cx.clearRect(0, 0, cv.width, cv.height);
      var col = tint === 'holo' ? '120,225,255' : '255,196,120';
      motes.forEach(function (m) {
        m.x += m.vx * dt; m.y += m.vy * dt; m.p += dt * 0.0015;
        if (m.x > 1.02) m.x = -0.02; if (m.y < -0.02) m.y = 1.02;
        var tw = 0.6 + 0.4 * Math.sin(m.p);
        cx.beginPath();
        cx.fillStyle = 'rgba(' + col + ',' + (m.a * tw).toFixed(3) + ')';
        cx.arc(m.x * cv.width, m.y * cv.height, m.r * (cv.width / 1280), 0, 6.283);
        cx.fill();
      });
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', size);
    return {
      start: function () { if (on || REDUCED) return; on = true; size(); seed(); last = 0; cv.classList.add('on'); requestAnimationFrame(frame); },
      tint: function (k) { tint = k; },
      stop: function () { on = false; cv.classList.remove('on'); }
    };
  })();

  /* ---- AUDIO HOOK -------------------------------------------------------
     Called once per line, the moment it starts. `line.vo` is the id from
     script.js. Drop a voice-over player in here — nothing else has to change,
     because every line already waits for a tap. */
  function audioHook(line) {
    if (typeof window.onIntroLine === 'function') window.onIntroLine(line);
  }

  /* ======================================================================= */
  /*  THE SEQUENCE                                                           */
  /* ======================================================================= */
  var slide = 0, queue = [], phase = 'idle', finished = false, current = null;
  var lineSeq = 0;      // which spoken line is current — a late timer checks it
  /* the last slide there are lines for — derived, so adding a slide to
     script.js is a change to script.js and nothing else */
  var LAST_SLIDE = LINES.reduce(function (m, l) { return l.slide > m ? l.slide : m; }, 1);

  function linesFor(n) { return LINES.filter(function (l) { return l.slide === n; }); }

  function playSlide(n) {
    slide = n; phase = 'choreo';
    dust.start();
    DIALOG.hide();
    spotFor(n);
    walks = []; bubbleDx = {};
    clockStart();
    var loc = SLIDE_LOC[n] ? byId[SLIDE_LOC[n]] : null;

    var art = SLIDE_ART[n] || null;

    /* THE STAGE IS SET BEFORE A WORD IS SAID, and nobody rises here — that is
       the speaker and the name watcher, in say(). */
    var here = castFor(n);

    /* what each of them is wearing and where they stand on THIS screen */
    var target = {};
    CAST_IDS.forEach(function (id) {
      var look = (art && art.look ? art.look[id] : null) || (SLIDE_POS[n] || {})[id] || null, c = CAST[id];
      var x = look && look.x != null ? look.x : c.x;
      target[id] = { look: look, x: x, key: [
        (look && look.src) || c.src,
        look && look.h != null ? look.h : c.h,
        look && look.aspect != null ? look.aspect : c.aspect, x].join('|') };
    });

    /* ANYBODY STANDING WHOSE DRESSING IS ABOUT TO CHANGE GOES DOWN FIRST.
       Changing a cut-out, a size or a place in full view is a teleport. But
       somebody whose dressing is identical on the next screen simply stays
       where they are — Rill is on the map on both 5 and 6, and sinking him
       only to raise his again would be a curtsy between two lines. */
    var changing = CAST_IDS.filter(function (id) {
      return actors[id] && actors[id].classList.contains('in') &&
             stageKey[id] !== target[id].key;
    });
    CAST_IDS.forEach(function (id) { if (here.indexOf(id) < 0) exit(id); });
    changing.forEach(exit);
    /* the last screen's words leave with the people who said them, rather
       than hanging over the stage until the next line replaces them */
    bubble.classList.add('ducked');
    capEl.classList.remove('on');

    var restage = function () {
      CAST_IDS.forEach(function (id) {
        if (stageKey[id] === target[id].key) return;   // already dressed for it
        dress(id, target[id].look);
        place(id, target[id].x);
        stageKey[id] = target[id].key;
        stageX[id] = target[id].x;
      });
    };
    /* only wait if somebody visible has to sink out of the way first */
    var lead = changing.length ? TIME.charRise : 0;
    if (lead) at(lead, restage); else restage();

    if (art) {
      restStill(art.src);
      at(lead + TIME.slideGap, beginLines);

    } else if (n === 2) {
      /* SCREEN 1 -> 2: the camera pushes into the blue holo-map on the table,
         blurring as it goes, and comes out over the real map of Titan — which
         then carries on into the dive to Rock Post. */
      at(lead, function () { holoZoom(function () { diveTo(loc, beginLines); }); });

    } else if (loc) {
      pullThenDive(loc, beginLines);

    } else {
      /* the map, with nobody on it yet: the cast rises as the line names them */
      restMap();
      /* a walk waits for whoever is leaving to sink out of the way first */
      var walk = SLIDE_WALK[n] || null;
      var walkMs = 0;
      if (walk) {
        at(lead + TIME.charRise, function () { walkAcross(walk); });
        Object.keys(walk).forEach(function (id) {
          walkMs = Math.max(walkMs, TIME.charRise +
                            (walk[id].turn ? TIME.turn : 0) + walk[id].ms);
        });
      }
      at(lead + walkMs + TIME.slideGap, beginLines);
    }
  }

  /* the map, with nothing laid over it */
  function restMap() {
    hideStill();
    show(closeWrap, false);
    closeWrap.style.opacity = 0;
    mapWrap.style.display = '';
    mapWrap.style.opacity = 1;
    filt(mapWrap, 0, 1); filt(closeWrap, 0, 1);
    setMap([50, 50], [50, 50], 1);
    current = null;
  }

  /* A STILL COVERS BOTH CAMERA LAYERS, so bringing it up is the whole of
     putting the map away for that beat. The camera underneath is left at rest
     so that whatever comes next starts from a known place. */
  function restStill(src) {
    hideTag();
    show(closeWrap, false);
    closeWrap.style.opacity = 0;
    mapWrap.style.display = '';
    mapWrap.style.opacity = 1;
    filt(mapWrap, 0, 1); filt(closeWrap, 0, 1);
    setMap([50, 50], [50, 50], 1);
    current = null;

    var put = function () {
      stillEl.style.backgroundImage = 'url("' + ASSET(src) + '")';
      show(stillEl, true);
      void stillEl.offsetWidth;
      stillEl.classList.add('on');
      /* the machine holds still, so the lit panel stays on the dials */
      if (slide === 6) { if (driftAnim) driftAnim.cancel(); iris(stillEl); }
      else drift(stillEl);
      dust.tint(slide === 1 || slide === 6 ? 'holo' : 'haze');
    };
    /* one still following another is a cut unless the first is taken down
       first — 5 to 6 is exactly that case */
    if (stillEl.classList.contains('on')) {
      stillEl.classList.remove('on');
      at(TIME.tagIn, put);
    } else {
      put();
    }
  }
  function hideStill() {
    if (!stillEl.classList.contains('on')) { show(stillEl, false); return; }
    stillEl.classList.remove('on');
    at(TIME.tagIn, function () {
      if (!stillEl.classList.contains('on')) show(stillEl, false);
    });
  }

  function diveTo(loc, done) {
    current = loc;
    dust.tint('haze');
    closeImg.src = ASSET(loc.closeupSrc);
    show(closeWrap, true);
    closeWrap.style.opacity = 0;
    setClose(loc, closeScale(loc, 0));

    if (REDUCED) {
      /* Every slide and every word survives; only the movement goes. The map
         is left exactly where it is: panning it onto the close-up's framing
         would force the coverage clamp to scale it up, and a zoom is the one
         thing reduced motion is here to remove. */
      setClose(loc, loc.zoom);
      closeWrap.style.transition = 'opacity ' + ms(TIME.reducedFade) + 'ms linear';
      void closeWrap.offsetWidth;
      closeWrap.style.opacity = 1;
      at(TIME.reducedFade, function () {
        closeWrap.style.transition = '';
        SFX.play('lock');
        showTag(loc);
        after(Math.min(tagRuns, 400), done);
      });
      return;
    }

    SFX.play('zoom', 'in');
    startAnim('dive', loc, DIVE.ms, function () {
      /* only now — never during — is the map put away */
      mapWrap.style.opacity = 0;
      mapWrap.style.display = 'none';
      closeWrap.style.opacity = 1;
      filt(closeWrap, 0, 1);
      land(loc, function () {
        SFX.play('lock');
        showTag(loc);
        after(Math.min(tagRuns, 400), done);
      });
    });
  }

  function pullOut(loc, done) {
    hideTag();
    if (REDUCED) {
      at(TIME.reducedFade, function () {
        show(closeWrap, false); closeWrap.style.opacity = 0;
        mapWrap.style.display = ''; mapWrap.style.opacity = 1;
        restMap(); if (done) done();
      });
      return;
    }
    at(PULL.cardFade, function () {
      mapWrap.style.display = '';
      mapWrap.style.opacity = 1;
      SFX.play('zoom', 'out');
      startAnim('pull', loc, PULL.ms, function () {
        show(closeWrap, false);
        closeWrap.style.opacity = 0;
        filt(closeWrap, 0, 1); filt(mapWrap, 0, 1);
        setMap([50, 50], [50, 50], 1);
        if (done) done();
      });
    });
  }

  /* Leaving one place and arriving at the next. There is no separate pan
     between them and there is nowhere for one to go: at scale 1 the map
     already fills the stage exactly, so a pan has no picture left to travel
     over. The travelling is done by the next dive, whose own pan carries the
     camera from that settlement's position on the map to where the close-up
     will hold it. The pull-out ends at rest and the dive starts from rest, so
     the two still read as one move. */
  function pullThenDive(loc, done) {
    pullOut(current, function () { diveTo(loc, done); });
  }

  function beginLines() { queue = linesFor(slide).slice(); phase = 'held'; nextLine(); }
  /* `auto` is true when the line before ran out on its own, after its
     TIME.lineHold, rather than being tapped on */
  function nextLine(auto) {
    lineSeq++;
    if (!queue.length) { betweenScreens(auto); return; }
    phase = 'typing';
    say(queue.shift());
  }
  /* THE SCREEN HOLDS before the next one, for TIME.screenGap counted from
     when the last line really ended: after the voice, if it is still talking;
     otherwise from when it went quiet or the line ran out (the lineHold ago,
     if it ran out by itself), whichever was later. Phase 'gap' makes taps do
     nothing meanwhile; SKIP still works, because kill() empties the clock
     this waits on. */
  function betweenScreens(auto) {
    phase = 'gap';
    var wait;
    if (VOICE.playing()) wait = VOICE.left() + TIME.screenGap;
    else wait = TIME.screenGap - Math.min(auto ? ms(TIME.lineHold) : 0, VOICE.quietFor());
    clock.entries.push({ at: now() + Math.max(0, wait), fn: endOfSlide, done: false });
  }
  function endOfSlide() {
    if (slide === 4) {
      phase = 'choreo';
      clockStart();
      pullOut(current, function () {
        at(600, function () { playSlide(5); });
      });
      return;
    }
    if (slide >= LAST_SLIDE) { finish(); return; }
    playSlide(slide + 1);
  }

  /* ======================================================================= */
  /*  INPUT                                                                  */
  /* ======================================================================= */
  function advance() {
    SFX.arm();
    if (finished) return;
    if (phase === 'choreo') {
      /* land the move now rather than make them wait for it */
      if (anim) { stepAnim(anim.t0 + anim.ms); }
      flush();
      landWalks();
      return;
    }
    if (phase === 'typing') {
      if (!typer.done) { finishLine(); return; }
      phase = 'held'; nextLine(); return;
    }
    if (phase === 'held') { nextLine(); }
  }

  function skip() {
    if (finished) return;
    VOICE.stop();
    kill(); clockStart();
    /* exactly the state the last slide leaves behind */
    tagEl.innerHTML = ''; show(tagEl, false); tagEl.classList.remove('on');
    show(closeWrap, false); closeWrap.style.opacity = 0;
    filt(closeWrap, 0, 1); filt(mapWrap, 0, 1);
    mapWrap.style.display = ''; mapWrap.style.opacity = 1;
    setMap([50, 50], [50, 50], 1);
    hideVoice();
    stillEl.classList.remove('on'); show(stillEl, false);
    bubTxt.textContent = ''; bubSize.textContent = '';
    capTxt.textContent = ''; capSize.textContent = '';
    typer.text = ''; typer.node = null; typer.done = true;
    /* exactly the cast the LAST screen leaves standing, not all of them:
       putting everybody up was showing Veth and Nova on the panel close-up */
    var lastArt = SLIDE_ART[LAST_SLIDE] || null;
    var lastCast = castFor(LAST_SLIDE);
    CAST_IDS.forEach(function (id) {
      var a = actors[id];
      var look = lastArt && lastArt.look ? lastArt.look[id] : null;
      dress(id, look);
      place(id, look && look.x != null ? look.x : CAST[id].x);
      stageX[id] = look && look.x != null ? look.x : CAST[id].x;
      stageKey[id] = null;
      /* AFTER place(), which writes the transition shorthand and would wipe
         this longhand right back off again */
      a.style.transitionDuration = '0ms';
      if (lastCast.indexOf(id) >= 0) {
        a.classList.remove('ducked');
        a.classList.add('in', 'settled');
      } else {
        a.classList.remove('in', 'settled');
        a.classList.add('ducked');
      }
    });
    slide = LAST_SLIDE; queue = [];
    finish();
  }

  function finish() {
    if (finished) return;
    finished = true; phase = 'over';
    TRACK.send('intro_complete');
    kill();
    dust.stop(); talking(null, false); DIALOG.hide(); spotFor(0);
    holoAnims.forEach(function (a) { a.cancel(); }); holoAnims = [];
    SFX.play('complete');
    if (typeof window.startLevel === 'function') {
      /* THE LESSON COMES FIRST. teach.js runs the place-value chart and hands
         back when it is done; if it is not loaded the level simply starts, as
         it did before. */
      /* `ready` is the lesson's: called once the console is drawn, so the
         lesson can fade off over it without the map showing between */
      var begin = function (ready) { window.startLevel(1, { onComplete: onLevelComplete, onReady: ready }); };
      if (window.TEACH_SCREEN) window.TEACH_SCREEN.play(LEVELS[0], begin);
      else begin();
    }
  }

  /* THE DELIVERY. The level is over, so the shuttle actually makes the run:
     flight.js flies it out on this same clock and dives with this same
     camera. If it has not loaded, nothing happens and the level simply ends
     as it did before. */
  /* `stats` is the console's own count of the level — { wrong } — and rides
     along to the end screen, which picks its result from it */
  function onLevelComplete(levelId, stats) {
    TRACK.send('level_complete', { level: levelId, wrong: stats ? stats.wrong : 0 });
    var lv = LEVELS.filter(function (l) { return l.id === levelId; })[0];
    if (!window.FLIGHT || !lv || !lv.locId) return rollOut(levelId, stats);
    window.FLIGHT.play(lv.locId, function () { rollOut(levelId, stats); });
  }

  /* and then the next level rolls in. Nothing happens if there is not one
     yet — the delivery simply ends with the map on screen. */
  function rollOut(levelId, stats) {
    var next = LEVELS.filter(function (l) { return l.id === levelId + 1; })[0];
    /* THE LAST DELIVERY IS THE END OF THE GAME. There is no level after
       Titan City, so the roll-out hands straight over to the celebration
       instead of leaving the map on screen. */
    if (!next) {
      endScreen({ wrong: stats ? stats.wrong : 0 });
      return;
    }
    /* transition: true asks the console to let the bay open before the brief.
       Reaching a level any other way — the jump menu, a fresh start — skips
       it, because there is no previous console for a plate to come off. */
    /* and again between levels: level 2 extends the chart, level 3 only gets
       the hand-over. Both come out of teach.js's own script. */
    if (!next) return;
    var begin = function (ready) {
      window.startLevel(next.id, { onComplete: onLevelComplete, transition: true, onReady: ready });
    };
    if (window.TEACH_SCREEN) window.TEACH_SCREEN.play(next, begin);
    else begin();
  }

  /* THE CELEBRATION. The last screen of the game: it plays and then holds,
     with nowhere further to go. opts is { wrong } from the level or
     { result } from a dev jump. */
  function endScreen(opts) {
    TRACK.send('game_complete', { wrong: opts && opts.wrong != null ? opts.wrong : null });
    TRACK.at('celebration');
    DIALOG.hide();
    if (!window.POST_SCREEN) return;
    var lvl = document.getElementById('level');
    if (lvl) lvl.hidden = true;
    document.body.classList.remove('in-level');
    window.POST_SCREEN.play(opts);
  }


  /* ======================================================================= */
  /*  RELAYOUT                                                               */
  /*                                                                         */
  /*  There is no fullscreen. A child drumming on a dial arrow fires dblclick
      and the old handler threw the window in and out of fullscreen mid-tap,
      so the whole feature is gone — the dblclick handler, the F key, the
      button and the fullscreenchange listeners. The game runs in the page. */
  window.addEventListener('resize', function () { if (!anim) applyMap(); });

  /* ======================================================================= */
  /*  GO                                                                     */
  /* ======================================================================= */
  function preload(done) {
    /* PRELOAD names everything config.js knows about; the three stills live
       in script.js, and this is the one place that has both lists. */
    var all = PRELOAD.slice();
    Object.keys(SLIDE_ART).forEach(function (k) {
      var a = SLIDE_ART[k];
      all.push(a.src);
      /* a per-screen look is a DIFFERENT cut-out, and it is swapped onto an
         actor the player is about to see — undecoded, that is a blank frame */
      if (a.look) Object.keys(a.look).forEach(function (id) {
        if (a.look[id].src) all.push(a.look[id].src);
      });
    });
    var left = all.length;
    if (!left) return done();
    all.forEach(function (src) {
      var i = new Image();
      i.src = ASSET(src);
      var next = function () { if (--left === 0) done(); };
      imgReady(i, next);
    });
  }

  function startIntro() {
    finished = false;
    document.body.classList.toggle('reduced', REDUCED);
    var lbar = loader.querySelector('.bar i');
    if (lbar) ASSETS.onFirstProgress(function (f) { lbar.style.width = (f * 100).toFixed(1) + '%'; });
    var hideLoader = function () {
      loader.classList.add('gone');
      setTimeout(function () { show(loader, false); }, 420);
    };
    /* THE LOADING BAR. preload.js fetches every file the game uses; the
       intro's pictures are only put up once they are on this device, so each
       is downloaded once and comes from the local copy. */
    var prepared = false, whenPrepared = null;
    var prepare = function () {
      mapImg.src = ASSET(MAP_SRC);
      buildCast();
      restMap();
      preload(function () {
        prepared = true;
        if (whenPrepared) { var f = whenPrepared; whenPrepared = null; f(); }
      });
    };
    /* THE TITLE SCREEN GOES FIRST, and hands back when PLAY is pressed.
       It borrows this same clock for the ship it flies around, and takes
       its hook off again before calling us, so clockStart() below starts
       the intro on a loop with nothing of that screen left on it. */
    var begin = function () {
      document.body.classList.remove('pre-game');
      clockStart(); playSlide(1);
    };
    var afterPrepared = function (f) { if (prepared) f(); else whenPrepared = f; };
    /* NUMBER POPULATION: the game is the place-value chart and nothing
       else - no title, no intro, no console. The chart opens over the
       darkened map as soon as the map is decoded. ?dev=1&go=teach:4:b:N /
       teach:4:t:N still opens it at a later step. */
    ASSETS.whenPlayable(function () { setTimeout(npUp, 0); });
    function npUp() {
      mapImg.src = ASSET(MAP_SRC);
      restMap();
      imgReady(mapImg, function () {
        hideLoader();
        document.body.classList.remove('pre-game');
        finished = true; phase = 'over'; kill();
        var lv = LEVELS.filter(function (l) { return l.id === NP_LEVEL; })[0];
        var p = String(window.DEV_GO || '').split(':');
        var from = p[0] !== 'teach' ? null :
                   p[2] === 'b' ? { beat: +p[3] } : p[2] === 't' ? { tryAt: +p[3] } : null;
        /* 22 Oct 2026: THE STORYBOARD'S FLOW — the control-centre story, the
           Level 1 chart, Level 2's commas (COMMAS.JS), the closing story.
           ?dev=1&go= still opens any of them directly (see dev.js). */
        if (p[0] === 'commas') {
          return window.COMMAS.play(p[1] === 'p' ? { practice: +p[2] } : p[1] === 'how' ? { howTo: true } : null);
        }
        if (p[0] === 'end') return window.STORY.end();
        if (p[0] === 'teach') return window.TEACH_SCREEN.play(lv, null, from);
        window.STORY.gate(function () {
          window.STORY.open(function () { window.TEACH_SCREEN.play(lv, null, null); });
        });
      });
    }
    return;
    /* ?dev=1&go=... opens the game at that screen instead (see dev.js) */
    if (window.DEV_GO) {
      ASSETS.whenPlayable(function () { setTimeout(devUp, 0); });
      var devUp = function () {
        prepare();
        afterPrepared(function () {
          hideLoader();
          if (devRoute(window.DEV_GO)) { document.body.classList.remove('pre-game'); return; }
          if (window.START_SCREEN) window.START_SCREEN.play(begin); else begin();
        });
      };
      return;
    }
    /* the title comes up as soon as its own pictures are here, with the bar
       where START will be; START itself waits for everything. ONE TICK LATE
       on purpose: on a slow line locales.json can land after the title's
       pictures, and then this runs while game.js is still being read —
       before START_SCREEN exists. */
    ASSETS.whenFirst(function () { setTimeout(showTitle, 0); });
    /* QA Bug 1: the loader stays up until the title is actually drawn, and
       the two cross-fade — there used to be a blank frame of bare stage
       between them while the title's pictures decoded. */
    function showTitle() {
      ASSETS.whenPlayable(prepare);
      if (window.START_SCREEN) window.START_SCREEN.play(function () { afterPrepared(begin); }, hideLoader);
      else { hideLoader(); ASSETS.whenPlayable(function () { afterPrepared(begin); }); }
    }
  }

  /* DEV JUMPS. Each target is started the same way the game itself reaches
     it, with the same onComplete, so play carries on normally from there.
       intro:N        intro screen N
       teach:L        the lesson before level L
       teach:L:b:N    that lesson from beat N (0-based)
       teach:L:t:N    that lesson straight at Try N (0-based)
       level:L        level L from its brief
       bay:L          level L with the bay opening (2 and 3)
       run:L:i        level L, straight into run i
       flight:L       the delivery flight after level L
       post           the celebration (post:perfect, post:pass, post:retry)
     Returns false for anything it does not know, so the title plays. */
  function devRoute(go) {
    var p = String(go).split(':'), what = p[0], n = +p[1], i = +p[2];
    var lv = LEVELS.filter(function (l) { return l.id === n; })[0];
    /* what finish() does, minus starting level 1 */
    var leaveIntro = function () { finished = true; phase = 'over'; kill(); };
    if (what === 'title') return false;
    if (what === 'intro' && n >= 1 && n <= LAST_SLIDE) {
      /* screens 3 and 4 open by pulling out of the previous close-up, so
         that close-up has to be on screen for them to pull out of */
      var prev = SLIDE_LOC[n] && SLIDE_LOC[n - 1] ? byId[SLIDE_LOC[n - 1]] : null;
      if (prev) window.INTRO.snapClose(prev);
      clockStart(); playSlide(n); return true;
    }
    /* post, or post:perfect / post:pass / post:retry for one result */
    if (what === 'post' && window.POST_SCREEN) {
      leaveIntro();
      endScreen({ result: p[1] });
      return true;
    }
    if (!lv) return false;
    if (what === 'teach' && window.TEACH_SCREEN) {
      leaveIntro();
      var from = p[2] === 'b' ? { beat: +p[3] } : p[2] === 't' ? { tryAt: +p[3] } : null;
      window.TEACH_SCREEN.play(lv, function (ready) {
        window.startLevel(lv.id, { onComplete: onLevelComplete, transition: lv.id > 1, onReady: ready });
      }, from);
      return true;
    }
    if (what === 'level' || what === 'bay') {
      leaveIntro();
      window.startLevel(lv.id, { onComplete: onLevelComplete, transition: what === 'bay' });
      return true;
    }
    if (what === 'run' && lv.runs[i]) {
      leaveIntro();
      window.startLevel(lv.id, { onComplete: onLevelComplete, at: i });
      return true;
    }
    if (what === 'flight' && window.FLIGHT) {
      leaveIntro();
      onLevelComplete(lv.id);
      return true;
    }
    return false;
  }

  /* the title screen swallows its own taps, but the keyboard reaches the
     window whatever is on top, so both routes ask it first */
  function titleUp() { return !!(window.START_SCREEN && window.START_SCREEN.live()); }
  stage.addEventListener('pointerdown', function (e) {
    if (titleUp()) return;
    if (e.target.closest('.ctl')) return;
    advance();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (titleUp()) return window.START_SCREEN.go();
      advance();
    }
  });
  /* SKIP and the sound button were removed from the page (13 Oct 2026), so
     these only wire them up if they are ever put back */
  if (skipBtn) skipBtn.addEventListener('click', function (e) { e.stopPropagation(); skip(); });
  if (sndBtn) sndBtn.addEventListener('click', function (e) {
    e.stopPropagation(); SFX.arm();
    sndBtn.classList.toggle('off', !SFX.toggle());
  });

  /* ======================================================================= */
  /*  THE FLIGHT BRIDGE                                                      */
  /*                                                                         */
  /*  flight.js is not allowed its own rAF loop and is not allowed to         */
  /*  re-derive the dive, so everything it needs is handed over here and      */
  /*  nowhere else. Nothing below is new machinery — it is the intro's own    */
  /*  clock, camera and dive, made reachable.                                 */
  /* ======================================================================= */
  window.INTRO = {
    REDUCED: REDUCED,
    ms: ms,
    at: at,
    now: now,
    kill: kill,
    /* so a test can prove a skip left nothing behind on the clock */
    pending: function () {
      return clock.entries.filter(function (e) { return !e.done; }).length;
    },
    hooks: function () { return frameHooks.length; },
    /* which screen it is on and what it is doing, for timing it from a test */
    where: function () { return { slide: slide, phase: phase }; },
    /* intro.finish() kills the loop before level 1 begins, and the launch
       monitor rides it. This lets the console restart the SAME loop rather
       than start one of its own — and only while it is stopped, because
       clockStart() empties the queue. */
    running: function () { return clock.running; },
    clockStart: clockStart,
    frame: function (fn) { if (frameHooks.indexOf(fn) < 0) frameHooks.push(fn); },
    unframe: function (fn) {
      var i = frameHooks.indexOf(fn); if (i >= 0) frameHooks.splice(i, 1);
    },
    loc: function (id) {
      return LOCATIONS.filter(function (l) { return l.id === id; })[0] || null;
    },
    restMap: restMap,
    diveTo: diveTo,
    /* the dive's END STATE with no dive: what Skip needs, since a skip that
       plays a two-second zoom is not a skip */
    snapClose: function (l) {
      current = l;
      closeImg.src = ASSET(l.closeupSrc);
      show(closeWrap, true);
      closeWrap.style.opacity = 1;
      filt(closeWrap, 0, 1); filt(mapWrap, 0, 1);
      setClose(l, l.zoom);
      mapWrap.style.opacity = 0;
      mapWrap.style.display = 'none';
    },

    /* WHERE THE SETTLEMENT IS, RIGHT NOW, and how magnified the ground under
       it is — in map-scale units on both sides of the swap, so the number is
       continuous through the cross-fade.

       Before the map is put away this is the applied map transform, clamp and
       all, rather than the requested focus: setMap can RAISE the scale to keep
       the map's edge out of frame in the first tenth of the dive, and a ship
       placed on the requested focus would slide against the ground exactly
       there. Afterwards only the close-up moves, so it is read instead. */
    terrain: function (loc) {
      /* the settlement itself. The delivery no longer dives, so there is no
         landing pad to aim at and no close-up offset to carry. */
      if (mapWrap.style.display === 'none') {
        var q = closeAnchor(loc, cam.a);
        return { x: q[0], y: q[1], m: cam.a * loc.ratio };
      }
      var lo = 100 * (1 - cam.s);
      var tx = clamp(cam.fx - cam.s * cam.anchor[0], lo, 0);
      var ty = clamp(cam.fy - cam.s * cam.anchor[1], lo, 0);
      return { x: tx + cam.s * loc.mapPoint[0],
               y: ty + cam.s * loc.mapPoint[1], m: cam.s };
    }
  };

  window.startIntro = startIntro;
  /* SKIP TAKES THE TITLE SCREEN WITH IT. Otherwise a skip started the game
     underneath a screen that was still sitting on top of it. */
  window.introSkip = function () {
    if (!finished) TRACK.send('intro_skip');
    if (window.START_SCREEN && window.START_SCREEN.live()) window.START_SCREEN.stop();
    /* unconditionally: at the moment SKIP is pressed the lesson has not been
       handed anything yet, so a check on live() would always be false and the
       lesson would start a moment later anyway. skip() arms a one-shot. */
    if (window.TEACH_SCREEN) window.TEACH_SCREEN.skip();
    skip();
  };
  /* for driving it from a test, and for hanging a voice-over track on the
     same clock the pictures use */
  window.introState = function () {
    return { slide: slide, phase: phase, left: queue.length, done: finished,
             loc: current ? current.id : null, cam: { s: cam.s, fx: cam.fx, fy: cam.fy },
             closeOpacity: +closeWrap.style.opacity || 0 };
  };
  /* the solved dive numbers, so they can be checked rather than believed */
  window.introSolve = function () {
    var o = {};
    LOCATIONS.forEach(function (l) {
      var fadeOpen = l.solved.lock, fadeShut = DIVE.fade.to;
      var sample = function (t) {
        var s2 = diveScale(l, t);
        return { t: t, map: +s2.toFixed(4), close: +(s2 / l.ratio).toFixed(4),
                 sizeRatio: +((s2) / ((s2 / l.ratio) * l.ratio)).toFixed(6) };
      };
      o[l.id] = {
        ratio: l.ratio,
        lockAt: fadeOpen,
        zoom: +l.zoom.toFixed(4),
        mapScaleAtLock: +l.solved.sLock.toFixed(4),
        mapEndScale: +l.solved.sEnd.toFixed(4),
        closeScaleAtRest: +l.zoom.toFixed(4),
        framedAt: [FRAME.x, FRAME.y],
        acrossTheFade: [sample(fadeOpen), sample((fadeOpen + fadeShut) / 2), sample(fadeShut)]
      };
    });
    return o;
  };
  /* park a location at rest, framed, and report where every traced point has
     landed on the stage — so a trace can be checked against the picture it was
     traced from rather than believed */
  window.introRest = function (id) {
    var l = byId[id];
    kill();
    mapWrap.style.display = 'none';
    closeImg.src = ASSET(l.closeupSrc);
    show(closeWrap, true);
    closeWrap.style.opacity = 1;
    filt(closeWrap, 0, 1);
    setClose(l, l.zoom);
    show(tagEl, false); show(bubble, false);
    current = l;
    var toScreen = function (p) {
      return [p[0], p[1]];          // at rest the close-up is the identity
    };
    var cx = 0, cy = 0;             // at rest the close-up is the identity
    return {
      loc: l.id, zoom: l.zoom,
      focusScreen: toScreen(l.focus),
      anchorScreen: closeAnchor(l, l.zoom),
      footprintScreen: l.footprint.map(toScreen),
      settlement: (function () {
        var xs = l.footprint.map(function (q) { return toScreen(q)[0]; });
        var ys = l.footprint.map(function (q) { return toScreen(q)[1]; });
        return { l: Math.min.apply(null, xs), r: Math.max.apply(null, xs),
                 t: Math.min.apply(null, ys), b: Math.max.apply(null, ys) };
      })(),
      cover: { left: +cx.toFixed(3), top: +cy.toFixed(3),
               right: +(cx + 100 * l.zoom).toFixed(3),
               bottom: +(cy + 100 * l.zoom).toFixed(3) }
    };
  };
  /* step the dive to an exact fraction, for the frame-by-frame proof */
  window.introProbe = function (id, t) {
    var l = byId[id];
    kill();
    mapWrap.style.display = ''; mapWrap.style.opacity = 1;
    closeImg.src = ASSET(l.closeupSrc);
    show(closeWrap, true);
    show(tagEl, false);
    show(bubble, false);
    current = l;
    stepDive(l, t);
    return { t: t, mapScale: cam.s, closeOpacity: +closeWrap.style.opacity };
  };

  /* ONE TICK LATE on purpose: boot() runs after locales.json, so the page is
     usually loaded by now, and starting at once would read window.DEV_GO
     before dev.js, further down this file, has set it — every dev jump
     would land on the title screen instead. */
  /* 20 Oct 2026: STARTED BY MORE THAN ONE ROUTE, ONCE. On a phone the page
     sometimes sat on LOADING for good: the one timer that started the game
     could be held (or lost) by PAUSE.JS while an in-app browser had not given
     the page focus yet. Now it is also kicked when the page has loaded and
     when the title's pictures are in — none of them through a timer — and
     whichever comes first starts it; the others do nothing. */
  var introKicked = false;
  var kickIntro = function () {
    if (introKicked) return;
    introKicked = true;
    try { startIntro(); } catch (e) { introKicked = false; throw e; }
  };
  var kickSoon = function () { Promise.resolve().then(kickIntro); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kickIntro);
  else setTimeout(kickIntro, 0);
  if (document.readyState === 'complete') kickSoon();
  else window.addEventListener('load', kickSoon);
  ASSETS.whenFirst(kickSoon);
})();

/* ########################################################################## */
/*  START.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   START.JS — the screen before the game.

   Built from its own plates, not from the intro's: the landscape behind, the
   three of them cut out for this pose and standing on the ridge at the right,
   START in the space to their left, and the S-17 wandering the
   whole frame behind them the entire time it is up.

   WHY THE SHIP RIDES THE INTRO'S CLOCK. A CSS motion path would have been
   less code, but offset-path: path() takes PIXEL coordinates and this stage
   is sized in pixels by JS on every resize — the path would have been right
   at one window size and wrong at every other. So the ship is positioned in
   PERCENT, from a frame hook on the intro's single rAF loop: the same loop
   the delivery flight and the launch monitor use, and no second one is
   started anywhere.

   WHAT HANDS OVER. play(then) shows the screen; START fades it out and calls
   then(), which is where the intro takes over. The hook comes off before
   that, so the intro's own clockStart() finds nothing of this screen left.

   HOUSE RULE. No borders, no outlines, no visible box-shadow edges — the
   figures are cut-outs with cast shadows, and START is drawn as artwork
   in its own right: its gold rim is a layer of the drawing, not a border.
   ========================================================================= */
(function () {
  'use strict';

  var P = PRELBD;
  var root = null, ship = null, plumes = [], hook = null, live = false;
  var timers = [], done = null;

  /* START's two drawings. The rocket is drawn nose-up and turned 45 degrees,
     so it points up and to the right — the way it goes when START is pressed.
     White hull and gold fins and nose like the logo; the window is the crew's
     cyan. The star is the one on the logo's orbit. */
  var ROCKET_SVG =
    '<svg class="st-rocket" viewBox="0 0 64 64" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="stHull" x1="0" x2="1"><stop offset="0" stop-color="#FFFFFF"/>' +
    '<stop offset="0.6" stop-color="#E4F1FF"/><stop offset="1" stop-color="#9DBBE0"/></linearGradient>' +
    '<linearGradient id="stGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD256"/>' +
    '<stop offset="1" stop-color="#F07A12"/></linearGradient>' +
    '<linearGradient id="stFire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6C8"/>' +
    '<stop offset="0.45" stop-color="#FFB43C"/><stop offset="1" stop-color="#FF6A1A" stop-opacity="0"/></linearGradient>' +
    '</defs>' +
    '<g transform="rotate(45 32 32)">' +
    '<path class="st-flame" d="M26 46 Q32 64 38 46 Z" fill="url(#stFire)"/>' +
    '<path d="M22 32 L13 43 L13 48 L23 44 Z" fill="url(#stGold)"/>' +
    '<path d="M42 32 L51 43 L51 48 L41 44 Z" fill="url(#stGold)"/>' +
    '<path d="M32 6 C40 12 43 20 43 29 L43 44 L21 44 L21 29 C21 20 24 12 32 6 Z" fill="url(#stHull)"/>' +
    '<path d="M32 6 C36 9 39 13 40.5 18 L23.5 18 C25 13 28 9 32 6 Z" fill="url(#stGold)"/>' +
    '<circle cx="32" cy="28" r="5.4" fill="#0A2A6B"/>' +
    '<circle cx="32" cy="28" r="3.9" fill="#4FE3FF"/>' +
    '<circle cx="30.5" cy="26.5" r="1.3" fill="#FFFFFF" opacity="0.9"/>' +
    '<rect x="24" y="44" width="16" height="3.2" rx="1.2" fill="#0A2A6B"/>' +
    '</g></svg>';
  var SPARK_SVG =
    '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="stStar">' +
    '<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.45" stop-color="#FFE9A0"/>' +
    '<stop offset="1" stop-color="#FFB43C"/></radialGradient></defs>' +
    '<path d="M16 0 Q18 14 32 16 Q18 18 16 32 Q14 18 0 16 Q14 14 16 0 Z" fill="url(#stStar)"/></svg>';

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearAll() { timers.forEach(clearTimeout); timers = []; }

  function el(tag, cls, host) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (host) host.appendChild(e);
    return e;
  }

  /* THE BOX MATHS. background-size scales the file so the figure's own opaque
     bounds fill the element, and background-position slides that box into it.
     The aspect ratio is the MEASURED one — width over height of the figure in
     pixels — because these plates are 1024x1536 portraits and deriving it
     from the box alone would assume a 16:9 file and stretch every one. */
  function plate(host, cfg, cls) {
    var e = el('div', cls, host);
    var fig = el('div', 'fig', e);
    fig.style.backgroundImage = 'url("' + ASSET(cfg.src) + '")';
    fig.style.backgroundSize = (100 / cfg.box.w * 100).toFixed(3) + '% ' +
                               (100 / cfg.box.h * 100).toFixed(3) + '%';
    fig.style.backgroundPosition = (cfg.box.x / (100 - cfg.box.w) * 100).toFixed(3) + '% ' +
                                   (cfg.box.y / (100 - cfg.box.h) * 100).toFixed(3) + '%';
    e.style.aspectRatio = String(cfg.aspect);
    return e;
  }

  function build() {
    var stage = document.getElementById('stage');
    root = el('div', 'start', stage);
    root.id = 'start';

    var bg = el('i', 'st-bg', root);
    bg.style.backgroundImage = 'url("' + ASSET(P.bg) + '")';

    /* THE SHIP, and the two cones it burns, placed as a percentage of the
       ship's own box so they are carried by its rotation and cannot come
       unstuck from the engines. It sits UNDER the crew: it is out over the
       plain and they are on the ridge in front of it. */
    ship = el('i', 'st-ship', root);
    ship.style.width = P.ship.w + '%';
    ship.style.backgroundImage = 'url("' + ASSET(SHUTTLE.dir + 'cruise.webp') + '")';
    plumes = SHUTTLE.nozzle.map(function (n) {
      var p = el('i', 'st-plume', ship);
      p.style.left = n.x + '%';
      p.style.top = n.y + '%';
      p.style.transform = 'rotate(' + (SHUTTLE.headingDeg + 180) + 'deg) translateY(-50%)';
      return p;
    });

    /* the crew, each centred on its own cx and standing on the bottom edge */
    var cast = el('div', 'st-cast', root);
    P.cast.forEach(function (c, i) {
      var a = plate(cast, c, 'st-actor ' + c.key);
      a.style.height = c.h + '%';
      a.style.left = c.cx + '%';
      a.style.zIndex = c.z;
      /* coming and going are different orders of business, so each figure
         carries both delays and the stylesheet picks the one that applies */
      a.style.setProperty('--in-delay', (P.pop.in + i * P.pop.gap) + 'ms');
      a.style.setProperty('--out-delay', (P.pop.out + i * P.pop.gap * 0.45) + 'ms');
    });

    /* THE GAME'S NAME, above the button in the same open space. Artwork, so
       the element is a window onto the logo's opaque bounds exactly as each
       figure is onto its own. */
    var head = el('i', 'st-heading', root);
    var hg = plate(head, P.heading, 'st-glyph');
    hg.style.height = '100%';
    hg.style.aspectRatio = String(P.heading.aspect);
    head.style.width = P.heading.w + '%';
    head.style.left = P.heading.cx + '%';
    head.style.top = P.heading.cy + '%';

    /* START, drawn from the logo's own palette: a glossy capsule in the blue
       of "Nova's" with the gold of its orbit round the edge, the word in the
       gold of ROCKET RUN, the logo's four-point star on its shoulder, and a
       rocket in a porthole that blasts off when it is pressed. */
    var btn = el('button', 'st-start', root);
    btn.type = 'button';
    btn.style.left = P.start.cx + '%';
    btn.style.top = P.start.cy + '%';
    /* UNTIL THE INTRO CAN PLAY, START is hidden and a loading bar stands in
       its place. It pops in at 100% of what the intro needs; the rest of the
       game carries on downloading behind it (preload.js, PLAYABLE). */
    if (!ASSETS.playable()) {
      btn.classList.add('st-wait');
      btn.disabled = true;
      var bar = el('div', 'st-load', root);
      bar.style.left = P.start.cx + '%';
      bar.style.top = P.start.cy + '%';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      var track = el('i', 'st-load-track', bar);
      var fill = el('i', 'st-load-fill', track);
      var pct = el('b', 'st-load-pct', bar);
      ASSETS.onProgress(function (f) {
        var n = Math.floor(f * 100);
        fill.style.width = (f * 100).toFixed(1) + '%';
        pct.textContent = n + '%';
        bar.setAttribute('aria-valuenow', String(n));
      });
      ASSETS.whenPlayable(function () {
        bar.classList.add('done');
        setTimeout(function () {
          if (bar.parentNode) bar.parentNode.removeChild(bar);
          btn.disabled = false;
          btn.classList.remove('st-wait');
          btn.classList.add('st-pop');
        }, 260);
      });
    }
    btn.style.setProperty('--st-size', P.start.size);
    /* the logo's own furniture, round the key: its speed streaks off the
       left, and its orange orbit swinging round the capsule */
    var streaks = el('span', 'st-streaks', btn);
    for (var si = 0; si < 3; si++) el('i', '', streaks);
    el('i', 'st-orbit', btn);
    var rim = el('span', 'st-rim', btn);
    var body = el('span', 'st-body', rim);
    el('span', 'st-label', body).textContent = i18n('ui.start');
    el('span', 'st-badge', btn).innerHTML = ROCKET_SVG;
    el('i', 'st-spark', btn).innerHTML = SPARK_SVG;
    btn.addEventListener('click', function (e) { e.stopPropagation(); go(); });

    /* nothing behind this screen should hear a tap on it — the intro's own
       stage handler would take it as "advance the slide" */
    root.addEventListener('pointerdown', function (e) { e.stopPropagation(); }, true);
  }

  /* one frame of the run, from the clock's own reading */
  var flight = { bank: 0, facing: 180, u: 0 };
  function step(t) {
    var S = P.ship;
    /* one crossing, and then the next. The wrap is the only jump in the whole
       path and it happens at x0, which is off the stage. */
    var u = (t % S.cross) / S.cross;
    var w = u * S.waves * Math.PI * 2;
    var x = S.x0 + (S.x1 - S.x0) * u;
    var y = S.cy + S.ay * Math.sin(w);

    /* THE NOSE NEVER TURNS AND THE HULL IS NEVER INVERTED. It flies one way
       the whole time, so there is no reversal to flip through — and that
       flip was the only thing that could ever have shown the ship edge-on or
       on its back.

       What is left is PITCH: it lifts and drops with the drift, clamped to
       SHUTTLE.maxBankDeg so the nose never swings far off level. The two
       speeds are put in the same units first — x is a percentage of the
       stage's WIDTH and y of its HEIGHT, and on a 16:9 stage those are not
       the same distance, so an uncorrected ratio read the climb far steeper
       than it is and sat on the clamp the whole way across. */
    var dx = (S.x1 - S.x0) / S.cross;
    var dy = S.ay * S.waves * Math.PI * 2 * Math.cos(w) / S.cross * (9 / 16);
    var climb = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
    var bank = Math.max(-SHUTTLE.maxBankDeg, Math.min(SHUTTLE.maxBankDeg, climb));

    /* cruise.webp is painted pointing up and to the LEFT, which is the way it
       is going, so it is never mirrored either. */
    var facing = 180 - bank;
    var sc = S.scale * (1 + S.swing * Math.sin(t / S.sp * Math.PI * 2));
    flight.bank = bank; flight.facing = facing; flight.u = u;

    ship.style.left = x + '%';
    ship.style.top = y + '%';
    ship.style.transform = 'translate(-50%, -50%) rotate(' +
      (facing - SHUTTLE.headingDeg).toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';

    var f = SHUTTLE.plumeCycle[Math.floor(t / (1000 / SHUTTLE.plumeHz)) %
                               SHUTTLE.plumeCycle.length];
    plumes.forEach(function (p) {
      p.style.width = (26 * f) + '%';
      p.style.opacity = (0.5 + 0.45 * f).toFixed(3);
    });
  }

  /* the screen's own plates are not in the intro's PRELOAD list, so they are
     fetched here and the screen only comes up once it can be drawn whole */
  function preload(then) {
    var srcs = [P.bg, P.heading.src, SHUTTLE.dir + 'cruise.webp']
      .concat(P.cast.map(function (c) { return c.src; }));
    var left = srcs.length;
    srcs.forEach(function (src) {
      var i = new Image();
      i.src = ASSET(src);
      var next = function () { if (--left === 0) then(); };
      imgReady(i, next);
    });
  }

  function play(then, shown) {
    if (live) return;
    live = true; done = then || null;
    build();
    document.body.classList.add('in-start');
    preload(function () {
      if (!live) return;
      void root.offsetWidth;
      root.classList.add('on');
      if (shown) shown();
      if (!INTRO.running()) INTRO.clockStart();
      hook = function (t) { step(t); };
      INTRO.frame(hook);
      step(INTRO.now());
    });
  }

  /* 20 Oct 2026 (Anmol): ON A PHONE OR TABLET, START GOES FULL SCREEN, so
     the browser's address bar and buttons stop eating the screen and the
     game comes up as big as the screen allows (still 16:9 — the game is laid
     out on that shape). Only here, once, on the START press itself (a browser
     only allows it on a tap), and never toggled — the old double-click
     toggle is what made the earlier fullscreen a problem. The phone's back
     gesture leaves it. Turned sideways is locked too, where allowed. */
  function goBig() {
    try {
      if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      var de = document.documentElement;
      var rq = de.requestFullscreen || de.webkitRequestFullscreen;
      if (!rq) return;
      var p = rq.call(de, { navigationUI: 'hide' });
      var lock = function () {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {});
      };
      if (p && p.then) p.then(lock).catch(function () {}); else lock();
    } catch (e) {}
  }

  function go() {
    /* keyboard and code start the game the same way the button does, so they
       wait for the loading bar too */
    if (!live || !ASSETS.playable()) return;
    live = false;
    TRACK.send('game_start'); TRACK.at('intro');
    goBig();
    SFX.arm();
    /* the rocket on START is what goes first, so it is what is heard */
    SFX.play('launch');
    /* THEY LEAVE BEFORE THE SCREEN DOES. The crew drop back out under the
       bottom edge one at a time and the name pops away with them; only once
       the stage is empty does what is left of it fade. */
    root.classList.add('out');
    /* the hook comes off BEFORE the intro starts, so its own clockStart()
       finds nothing of this screen still on the loop */
    if (hook) { INTRO.unframe(hook); hook = null; }
    /* QA Bug 7: THE FIRST SCREEN IS ALREADY UNDER THIS ONE WHEN IT FADES.
       The intro used to be started only once this screen had gone, so the
       bare map flashed up between the two. Now it starts a fade-length
       before the fade, and its first picture comes up underneath. */
    later(function () {
      var f = done; done = null;
      if (f) f();
    }, Math.max(0, P.pop.hold - P.pop.fade));
    later(function () { if (root) root.classList.add('off'); }, P.pop.hold);
    later(function () {
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = null;
      document.body.classList.remove('in-start');
    }, P.pop.hold + P.pop.fade);
  }

  function stop() {
    clearAll();
    if (hook) { INTRO.unframe(hook); hook = null; }
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; live = false;
    document.body.classList.remove('in-start');
  }

  window.START_SCREEN = {
    play: play,
    go: go,
    stop: stop,
    live: function () { return live; },
    state: function () {
      return {
        live: live,
        hooked: !!hook,
        ship: ship ? { left: ship.style.left, top: ship.style.top,
                       facing: +flight.facing.toFixed(1), bank: +flight.bank.toFixed(1),
                       u: +flight.u.toFixed(3) } : null,
        cast: root ? root.querySelectorAll('.st-actor').length : 0,
        start: !!(root && root.querySelector('.st-start')),
        heading: !!(root && root.querySelector('.st-heading'))
      };
    }
  };
})();

/* ########################################################################## */
/*  FLIGHT.JS                                                               */
/* ########################################################################## */

/* ============================================================================
   FLIGHT.JS — the delivery flight.

   The level is over, so the shuttle actually makes the run: it lifts from the
   pad below the frame, curves out across the map to the settlement, and is
   gone. The camera does not move — the delivery is a flyover on the wide map,
   not a landing — and when it is done the next level rolls in.

   WHAT THIS FILE IS NOT ALLOWED TO DO
     - start a second animation loop. Every timed beat is an {at, fn} on the
       intro's clock, and every per-frame redraw is a frame hook on the intro's
       one rAF. window.INTRO is the whole of the contract; see the bridge at
       the foot of intro.js.
     - zoom. The camera stays on the wide map for the whole delivery: the
       shuttle is shown going, and then the next level rolls in. There is no
       dive, no close-up and no landing here.
     - draw a border, an outline, or a visible box-shadow edge. The exhaust is
       a gradient with a soft edge; the shadow is a cut PNG.

   The landing frames land1..4 are no longer played. They are still in the
   asset folder and nothing draws them: on the wide map the settlement is two
   or three percent of the stage across, so a shuttle set down on it would be
   three times the size of the place it is delivering to.
   ========================================================================= */
(function () {
  'use strict';

  var S = SHUTTLE;
  var stage = document.getElementById('stage');
  var levelEl = document.getElementById('level');
  var skipBtn = document.getElementById('skip');

  /* Relative URLs never carry the project folder's own apostrophe, so this is
     belt-and-braces — but the space in "Game assets" is real, and a raw space
     in a CSS url() fails silently rather than loudly. */
  function src(name) { return ASSET(S.dir + name); }

  var FRAMES = ['cruise', 'land1', 'land2', 'land3', 'land4', 'shadow'];
  var img = {};            // name -> decoded Image, for natural sizes
  var loaded = false;

  /* ----------------------------------------------------------------- state */
  var layer = null, shipEl = null, shipImg = null, shadowEl = null, shadowImg = null;
  var body = {};                // body width as a fraction of each canvas
  var mirrored = false;         // flying east, so the hull is flipped to suit
  var plumes = [];
  var live = false;           // a flight is on screen
  var loc = null;
  var onEnd = null;
  var phase = 'idle';         // idle | handover | cruise | dive | landing | done
  var t0 = 0;                 // performance.now() at the start of the phase
  var curve = null;           // the four bezier control points
  var arrival = null;         // terrain magnification when the cruise ended
  var cruiseEndScale = 1;
  var plumeStep = 0;
  var frameName = 'cruise';
  var lineText = '';

  /* NOVA, STANDING IN THE BOTTOM-LEFT CORNER while the shuttle flies, saying
     what has just been done and what comes next. She TALKS IN FRAMES: a 6x6
     sheet of her speaking and gesturing, 504x830 a frame — a web copy of the
     artist's 'Nova (2).webp', 1.8 MB rather than 13. She gestures to her
     right in it, which from the corner would point off the screen, so she is
     mirrored to face into the map. Every step between neighbouring frames is
     smooth and only the wrap from 35 back to 0 is rough, so the talking runs
     forward and back across all 36; her closed-mouth frames are scattered,
     and she settles on whichever is nearest.
       box     the union of every frame's opaque bounds, as a % of one frame
       aspect  that box's own width over height in pixels
       h, x    her height and left edge, in % of the stage: full height,
               clear of the dialogue box, which starts about 17% across
       hideAt  settlements whose delivery she sits out: her line is still
               heard, but she does not come up into the corner */
  var NOVA = {
    sheet: { src: ART + 'nova talking.webp',
             box: { x: 0.4, y: 0.24, w: 80.16, h: 99.28 },
             cols: 6, rows: 6, fps: 12, from: 0, to: 35,
             rest: [5, 9, 12, 17, 18, 30, 31] },
    aspect: 0.490,                          // 404/824 px of a frame, measured
    h: 58, x: 1,
    hideAt: []                              // she is in every delivery, Titan City too
  };
  var novaEl = null, novaPlayer = null;

  /* ------------------------------------------------------------- utilities */
  /* at() is measured from the clock's start, not from the moment of the call.
     The intro schedules a whole slide up front, so it never had to care; the
     flight schedules each phase as the one before it ends, and without this
     every beat of the landing was already in the past and fired together on
     one frame. */
  function after(delay, fn) { INTRO.at(INTRO.now() + INTRO.ms(delay), fn); }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function el(tag, cls, host) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (host) host.appendChild(e);
    return e;
  }

  /* A cubic bezier and its tangent. The first control point is pulled straight
     up out of the pad so the ship leaves vertically; the second is pulled back
     along the approach so it arrives along its own heading instead of swinging
     in sideways. A straight diagonal slide reads as a sprite being moved. */
  function bezier(c, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
    return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x,
             y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
  }
  function tangent(c, t) {
    var u = 1 - t, a = 3 * u * u, b = 6 * u * t, d = 3 * t * t;
    return { x: a * (c[1].x - c[0].x) + b * (c[2].x - c[1].x) + d * (c[3].x - c[2].x),
             y: a * (c[1].y - c[0].y) + b * (c[2].y - c[1].y) + d * (c[3].y - c[2].y) };
  }

  function buildCurve(target) {
    var p0 = { x: S.start.x, y: S.start.y };
    var p3 = { x: target[0], y: target[1] };
    var dx = p3.x - p0.x, dy = p3.y - p0.y;
    return [
      p0,
      { x: p0.x, y: p0.y - 30 },                        // straight up off the pad
      { x: p3.x - dx * 0.20, y: p3.y - dy * 0.20 },     // back along the approach
      p3
    ];
  }

  /* ------------------------------------------------------------ the layer */
  function build() {
    if (layer) return;
    layer = el('div', '', stage);
    layer.id = 'flight';
    layer.hidden = true;

    shadowEl = el('i', 'fl-shadow', layer);
    shadowImg = el('img', '', shadowEl);
    shadowImg.alt = '';
    shadowImg.src = src('shadow.webp');

    shipEl = el('i', 'fl-ship', layer);
    shipImg = el('img', '', shipEl);
    shipImg.alt = '';
    shipImg.src = src('cruise.webp');

    /* One cone per nozzle, positioned as a percentage of the SHIP'S OWN BOX —
       so they are carried by the hull's rotation and scale rather than being
       re-solved every frame, and cannot come unstuck from the engines. */
    plumes = S.nozzle.map(function (n) {
      var p = el('i', 'fl-plume', shipEl);
      p.style.left = n.x + '%';
      p.style.top = n.y + '%';
      /* the exhaust leaves along the painted axis, directly away from the nose */
      p.style.transform = 'rotate(' + (S.headingDeg + 180) + 'deg) translateY(-50%)';
      return p;
    });

    /* Nova: a window onto her own opaque bounds, the box maths the title
       screen's cut-outs use, so the file's empty margins are never drawn */
    novaEl = el('div', 'fl-nova', layer);
    var fig = el('i', 'fig', novaEl);
    var me = novaEl;
    /* fetched now, so it is decoded by the time she rises */
    (new Image()).src = ASSET(NOVA.sheet.src);
    novaPlayer = SPRITE.player(fig, NOVA.sheet, function () {
      return mouthState(me.classList.contains('talking'));
    });
    novaEl.style.height = NOVA.h + '%';
    novaEl.style.aspectRatio = String(NOVA.aspect);
    novaEl.style.left = NOVA.x + '%';
  }

  /* she rises from under the bottom edge as she starts to speak, and drops
     back out of it just before the next screen */
  function novaIn() {
    if (!novaEl) return;
    novaEl.classList.remove('out');
    void novaEl.offsetWidth;
    novaEl.classList.add('on');
  }
  function novaOut() {
    if (!novaEl) return;
    novaEl.classList.remove('on', 'talking');
    novaEl.classList.add('out');
  }

  function preload(done) {
    if (loaded) return done();
    var left = FRAMES.length;
    FRAMES.forEach(function (n) {
      var i = new Image();
      i.src = src(n + '.webp');
      img[n] = i;
      var next = function () { if (--left === 0) { measureBodies(); loaded = true; done(); } };
      imgReady(i, next);
    });
  }

  /* The body's width as a fraction of its canvas, read off the alpha across the
     middle band of the hull so that wings, legs and the open ramp do not widen
     the answer. Measured rather than written down, because it is the thing that
     keeps the painted ship the same size when the frame changes. */
  function bodyWidthFrac(im) {
    try {
      var W = im.naturalWidth, H = im.naturalHeight;
      if (!W) return null;
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(im, 0, 0);
      var d = c.getContext('2d').getImageData(0, 0, W, H).data;
      var x0 = 1e9, x1 = -1;
      for (var y = Math.round(H * 0.30); y < Math.round(H * 0.55); y++) {
        for (var x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
        }
      }
      return x1 > x0 ? (x1 - x0 + 1) / W : null;
    } catch (e) { return null; }   // a tainted canvas is not worth a crash
  }
  function measureBodies() {
    body.cruise = bodyWidthFrac(img.cruise) || 0.955;
    body.land = bodyWidthFrac(img.land4) || 0.888;
  }

  /* ------------------------------------------------------------- painting */

  /* The ship's on-screen width. scaleStart/scaleEnd are multipliers, so they
     need a size to multiply: baseW is it. The landing frames are a different
     canvas from cruise.webp (448x353 against 486x300), so they are drawn at
     their own natural width ratio — that keeps the painted hull the same size
     across the swap instead of stretching it to fit a box cut for the other
     frame. */
  /* THE SHIP IS SIZED BY ITS BODY, NOT BY ITS CANVAS. The hull fills 95.5% of
     cruise.webp but only 88.8% of the landing canvas, so sizing the element by
     the canvas shrank the painted ship by fifteen per cent the instant land1
     appeared — a visible pop at exactly the hand-off. baseW is now the BODY's
     width as a % of stage width at scale 1, and the element is widened to suit
     whichever frame is up.

     The four landing frames share one reference rather than each using their
     own: they are aligned on the hull and drift 2% between them, so giving
     each its own would wobble the element — and with it the contact point —
     while the ship is trying to sit still. */
  function bodyFrac() {
    return frameName === 'cruise' ? (body.cruise || 0.955) : (body.land || 0.888);
  }
  function widthPct(scale) {
    return S.baseW * scale / bodyFrac();
  }

  /* A percentage in translate() resolves against the ELEMENT'S own box; a
     percentage in left/top resolves against the containing block. The ship's
     place on the stage is a stage percentage, so it goes in left/top — and
     only the centring -50% pair, which really is relative to the ship, goes in
     the transform. */
  function placeShip(x, y, scale, bankDeg) {
    shipEl.style.width = widthPct(scale) + '%';
    shipEl.style.left = x + '%';
    shipEl.style.top = y + '%';
    /* scaleX goes LAST, so it is innermost: the hull, both nozzles and both
       exhaust cones mirror together and the engines stay on the engines. */
    shipEl.style.transform =
      'translate(-50%,-50%) rotate(' + bankDeg.toFixed(2) + 'deg)' +
      (mirrored ? ' scaleX(-1)' : '');
  }

  /* The shadow. The ship is miles up over the wide map, so this is a small
     soft patch below it, keeping the image's own aspect. */
  function placeShadow(x, y, scale, opacity) {
    var w = widthPct(1) * scale * 0.9;
    shadowEl.style.width = w + '%';
    shadowEl.style.height = 'auto';
    shadowEl.style.left = x + '%';
    shadowEl.style.top = y + '%';
    shadowEl.style.opacity = opacity.toFixed(3);
    shadowEl.style.transform = 'translate(-50%,-50%)';
  }

  /* The bank. Tangent to screen degrees (0 = right, clockwise positive), minus
     the ship's own painted heading, clamped. The clamp is the point: the hull
     is a fixed three-quarter view, and past about twenty degrees it stops
     reading as banking and starts reading as a picture being turned. */
  /* THE PAINTED SHIP FLIES UP AND TO THE LEFT. Rock Post is west of the pad
     and Lake Station is all but straight up, so that was always right — but
     Titan City is at x 80.85 and the shuttle was flying to it backwards.

     Mirroring about the vertical axis maps a screen angle to 180 - angle, so
     the painted heading of -155 becomes -25: up and to the RIGHT. Everything
     else in the bank maths is unchanged; it is the same subtraction against a
     heading that now matches the picture. */
  function paintedHeading() {
    return mirrored ? 180 - S.headingDeg : S.headingDeg;
  }

  function bankAt(t) {
    var v = tangent(curve, t);
    var deg = Math.atan2(v.y, v.x) * 180 / Math.PI;
    var off = deg - paintedHeading();
    while (off > 180) off -= 360;
    while (off < -180) off += 360;
    return clamp(off, -S.maxBankDeg, S.maxBankDeg);
  }

  /* The cones breathe. Length and opacity ride the same cycle so a shorter
     flame is also a dimmer one — two independent wobbles read as a fault. */
  function paintPlumes(on) {
    var k = on ? S.plumeCycle[plumeStep % S.plumeCycle.length] : 0;
    plumes.forEach(function (p) {
      /* off: hidden outright, so its blurred layer is released (GPU budget) */
      if (!on) { p.style.opacity = '0'; p.style.visibility = 'hidden'; p.style.willChange = 'auto'; return; }
      p.style.visibility = ''; p.style.willChange = '';
      /* 3.2x as long as it is wide, both as a % of the ship's own box */
      var h = 13;
      p.style.height = h + '%';
      p.style.width = (h * 3.2 * k) + '%';
      p.style.opacity = (0.55 + 0.45 * k).toFixed(3);
    });
  }

  function frame(tNow) {
    if (!live) return;
    var t = (performance.now() - t0);

    if (phase === 'cruise') {
      var p = clamp(t / INTRO.ms(S.cruiseMs), 0, 1);
      var pt = bezier(curve, p);
      /* IT GETS SMALLER THE WHOLE WAY: an even shrink along the path, so the
         further it has flown the smaller it is, all the way to the settlement */
      var sc = lerp(S.scaleStart, S.scaleEnd, p);
      cruiseEndScale = sc;
      placeShip(pt.x, pt.y, sc, bankAt(p));
      placeShadow(pt.x, pt.y + 7, 0.30, 0.20);
      paintPlumes(true);

    } else if (phase === 'arrive') {
      /* IT ARRIVES, IT DOES NOT LAND. The camera stays on the wide map for the
         whole delivery — no dive, no close-up, no landing frames. The ship
         reaches the settlement, keeps shrinking as it drops away towards it,
         and is gone by the time the map hands over to the next level.

         Fading it out rather than setting it down is not a dodge. On the wide
         map the settlement is two or three percent of the stage across and the
         ship is nearer nine, so a shuttle "landing" there would be three times
         the size of the place it is delivering to. Shrinking away reads as
         arrival; sitting on it would read as a mistake. */
      /* the last of the shrink, and then it is gone */
      var a = clamp(t / INTRO.ms(S.arriveMs), 0, 1);
      var e = a;
      var end = bezier(curve, 1);
      placeShip(end.x, end.y, lerp(S.scaleEnd, S.scaleEnd * S.arriveScale, e), bankAt(1));
      placeShadow(end.x, end.y + lerp(7, 1, e), lerp(0.30, 0.03, e), lerp(0.20, 0, e));
      paintPlumes(a < 0.5);
      var f = clamp((a - S.arriveFadeFrom) / (1 - S.arriveFadeFrom), 0, 1);
      shipEl.style.opacity = (1 - f).toFixed(3);
    }
    /* she moves while her voice is going, and stands still once it stops */
    if (novaEl) {
      novaEl.classList.toggle('talking', novaEl.classList.contains('on') && VOICE.playing());
      /* her frames run while she talks, and she settles when she stops */
      if (novaPlayer) novaPlayer.kick();
    }
  }

  /* The end of the sequence, from any route into it. in-flight borrows SKIP
     from the intro and hides the RUN menu; both have to be handed back. The
     cast stay gone — they were the intro's, and the depot is not their scene. */
  function finish() {
    phase = 'done';
    /* AND THE MODULE STANDS DOWN. Without this, live stayed true from the
       first delivery onward and every later play() returned at its guard —
       silently, and before it had stored the caller's callback, so the level
       after it never started. */
    live = false;
    /* the frame hook goes with it. Skip removed it; the normal path never did,
       so a finished delivery left a painter running on the intro's loop. */
    INTRO.unframe(frame);
    hideLine();
    novaOut();
    document.body.classList.remove('in-flight');
    document.body.classList.add('flight-over');
    if (onEnd) onEnd(loc.id);
  }

  /* WHAT NOVA SAYS WHILE IT FLIES — HEARD, NOT SHOWN. She comes up into the
     corner and says it; there is no dialogue box and no instruction panel on
     the delivery, so nothing covers the flight. Only settlements with a line
     in locales.json get one. */
  function showLine() {
    var lines = i18n('flight');
    lineText = (lines && lines[loc.id]) || '';
    if (!lineText) return;
    if (NOVA.hideAt.indexOf(loc.id) < 0) novaIn();
    VOICE.then(lineText);
  }
  function hideLine() {
    DIALOG.hide();
  }

  function setFrame(name) {
    frameName = name;
    shipImg.src = src(name + '.webp');
  }

  /* ------------------------------------------------------------------ run */

  function play(locId, done) {
    var L = INTRO.loc(locId);
    if (!L || live) return;
    loc = L; onEnd = done || null;
    build();
    /* THE CONSOLE'S INSTRUCTION PANEL GOES THE MOMENT THE DELIVERY IS CALLED.
       Left alone it stayed up through the preload and the console's fade,
       over the start of the flight. The transition screen has Nova's
       dialogue box and nothing else. */
    Array.prototype.forEach.call(levelEl.querySelectorAll('.panel'), function (p) {
      p.classList.remove('on');
      p.hidden = true;
    });
    DIALOG.hide();

    preload(function () {
      live = true;
      document.body.classList.add('in-flight');
      /* the delivery is flown over the map, so the map is back for it (a
         lesson put it away when it handed over to the console) */
      document.body.classList.remove('no-map');
      INTRO.kill();
      INTRO.clockStart();
      INTRO.frame(frame);

      if (INTRO.REDUCED) return reduced();

      /* 1. the console stands down and the map comes back underneath it */
      phase = 'handover';
      levelEl.classList.add('flying');
      after(S.handoverMs, function () {
        levelEl.hidden = true;
        levelEl.classList.remove('flying');
        INTRO.restMap();
        startCruise();
      });
    });
  }

  function startCruise() {
    /* aim at whatever terrain() is going to hold the ship on, not at mapPoint
       directly — otherwise the first frame of the dive steps by the pad offset */
    var g0 = INTRO.terrain(loc);
    curve = buildCurve([g0.x, g0.y]);
    /* which way the run actually goes, from the pad to the settlement */
    mirrored = g0.x > S.start.x;
    setFrame('cruise');
    layer.hidden = false;
    shipEl.style.opacity = '1';
    showLine();
    phase = 'cruise';
    t0 = performance.now();
    SFX.play('thrust', S.cruiseMs / 1000);
    /* lift-off: a jolt through the picture as the engines light */
    SFX.play('launch');
    FX.shake(document.getElementById('stage'), 0.7, 620);

    /* the cones breathe on the clock, not on a timer of their own */
    var n = Math.round(S.cruiseMs / (1000 / S.plumeHz));
    for (var i = 0; i < n; i++) {
      (function (i) {
        after(i * (1000 / S.plumeHz), function () { plumeStep = i; });
      })(i);
    }

    after(S.cruiseMs, startArrive);
  }

  function startArrive() {
    phase = 'arrive';
    t0 = performance.now();
    SFX.play('thrustDown', S.arriveMs / 1000);
    after(S.arriveMs, function () {
      SFX.play('lock');
      /* DELIVERED: the sky celebrates */
      FX.confetti(70);
      wrapUp();
    });
  }

  /* THE DELIVERY HOLDS before the next screen: Nova's line heard out, then
     TIME.screenGap to see the station light up. Real time, on the clock
     directly — after() here is scaled down for reduced motion. */
  function wrapUp() {
    var wait = VOICE.left() + TIME.screenGap;
    /* Nova steps down out of the corner just before the next screen comes */
    INTRO.at(INTRO.now() + Math.max(0, wait - NOVA_OUT_MS), novaOut);
    INTRO.at(INTRO.now() + wait, finish);
  }
  var NOVA_OUT_MS = 560;      // her drop out of frame; matches .fl-nova.out in flight.css

  /* REDUCED MOTION. No cruise, no cycling cones: the map is simply put back
     and the delivery is over. There is nothing to cross-fade to any more. */
  function reduced() {
    levelEl.hidden = true;
    levelEl.classList.remove('flying');
    INTRO.restMap();
    layer.hidden = true;
    after(S.reducedFadeMs, function () { SFX.play('lock'); wrapUp(); });
  }

  /* ----------------------------------------------------------------- skip */

  /* Straight to the end state, from any phase. Everything this file put on the
     clock goes with it — the frame hook first, so nothing can paint one more
     time after the sequence is supposed to be over. */
  function skip() {
    if (!live || phase === 'done') return;
    INTRO.unframe(frame);
    INTRO.kill();
    INTRO.clockStart();

    levelEl.hidden = true;
    levelEl.classList.remove('flying');
    INTRO.restMap();
    paintPlumes(false);
    layer.hidden = true;
    finish();
  }

  /* The intro's own SKIP button, borrowed while the flight is up. It is taken
     in the capture phase and stopped there, so the intro's handler — which
     would return immediately anyway, the intro being finished — never sees it
     and no new control is introduced. */
  if (skipBtn) {
    skipBtn.addEventListener('click', function (e) {
      if (!live || phase === 'done') return;
      e.stopPropagation();
      skip();
    }, true);
  }

  /* --------------------------------------------------------------- public */
  window.FLIGHT = {
    play: play,
    skip: skip,
    /* for driving it from a test */
    state: function () {
      if (!live) return { live: false, phase: phase };
      var st = shipEl ? shipEl.style.transform : '';
      var m = /rotate\(([-\d.]+)deg\)/.exec(st);
      return {
        live: true, phase: phase, frame: frameName,
        bank: m ? +m[1] : 0,
        ship: shipEl ? shipEl.getBoundingClientRect().toJSON() : null,
        shadow: shadowEl ? shadowEl.getBoundingClientRect().toJSON() : null,
        shadowOpacity: shadowEl ? +shadowEl.style.opacity : 0,
        body: { cruise: body.cruise, land: body.land },
      target: (function () {
        if (!loc) return null;
        var g = INTRO.terrain(loc);
        var st = document.getElementById('stage').getBoundingClientRect();
        return [+(st.x + g.x / 100 * st.width).toFixed(2),
                +(st.y + g.y / 100 * st.height).toFixed(2)];
      })(),
      plumes: plumes.map(function (p) {
          var r = p.getBoundingClientRect();
          return { x: +r.x.toFixed(1), y: +r.y.toFixed(1),
                   w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                   o: +p.style.opacity };
        })
      };
    }
  };
})();

/* ########################################################################## */
/*  STORY.JS                                                                */
/* ########################################################################## */

/* ============================================================================
   STORY.JS — the storyboard's opening and closing scenes (sheet "Story").

   The World Population Control Centre: a digital screen of country markers
   over the darkened map. open(then) plays the opening — the reports arrive,
   one blinks red, and the team sets out to verify them — and hands over to
   the Level 1 chart. end() is the closing scene: every report delivered,
   both headquarters green, MISSION COMPLETE and PLAY AGAIN.

   Every line goes through VOICE and DIALOG like the lesson's, so it is
   paced the same way and the pause freezes it the same way.
   ========================================================================= */
var STORY = (function () {
  'use strict';

  var stage = document.getElementById('stage');
  /* where each country's marker sits on the control-centre screen, in % of
     the screen; the first is Country A, the one that raises the alert */
  var SPOTS = [[14, 30], [30, 18], [46, 32], [60, 16], [58, 52],
               [12, 64], [28, 54], [42, 74], [60, 80]];
  var RECORDS = [43256781, 56234781, 27634781, 4325817];
  var SETTLE = 600;

  var root = null, screen = null, marks = [], recs = null, focus = null, timers = [];

  function el(tag, cls, host) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (host) host.appendChild(e);
    return e;
  }
  function later(fn, ms) {
    var t = setTimeout(function () { if (root) fn(); }, ms);
    timers.push(t);
  }

  /* a line said, and `then` a breath after it has finished */
  function talk(who, text, then) {
    var ms = VOICE.play(text, function () { if (then) later(then, SETTLE); });
    DIALOG.say(who, text, { pos: 'bottom', ms: ms });
    return ms;
  }
  function run(list, i, then) {
    if (!root) return;
    if (i >= list.length) return then && then();
    var b = list[i];
    if (b.act) b.act();
    talk(b.who, b.text, function () { run(list, i + 1, then); });
  }

  function build(mode) {
    stop();
    document.body.classList.remove('no-map');
    root = el('div', 'story ' + mode, stage);
    root.id = 'story';
    el('i', 'sy-veil', root);
    el('div', 'sy-title', root).textContent = i18n('story.centre');
    screen = el('div', 'sy-screen', root);
    el('i', 'sy-grid', screen);
    marks = SPOTS.map(function (p, k) {
      var m = el('span', 'sy-mark', screen);
      m.style.left = p[0] + '%';
      m.style.top = p[1] + '%';
      el('b', '', m).textContent = String.fromCharCode(65 + k);
      return m;
    });
    root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    void root.offsetWidth;
    root.classList.add('on');
  }

  function lightMarks() {
    marks.forEach(function (m, k) {
      later(function () { m.classList.add('lit'); SFX.play('tick'); }, 180 * k);
    });
  }
  function showRecords() {
    recs = el('div', 'sy-records', screen);
    el('div', 'sy-rec-head', recs).textContent = i18n('story.records');
    RECORDS.forEach(function (n, k) {
      var r = el('div', 'sy-rec', recs);
      el('span', '', r).textContent = i18n('story.country', { c: String.fromCharCode(65 + k) });
      el('b', '', r).textContent = String(n);
      later(function () { r.classList.add('in'); SFX.play('chime'); }, 250 * k);
    });
  }
  function alarm() {
    marks[0].classList.add('alert');
    if (recs) recs.firstChild.nextSibling.classList.add('alert');
    var a = el('div', 'sy-alert', root);
    a.textContent = i18n('story.alert');
    SFX.play('wrong');
    FX.shake(stage, 0.5, 500);
  }
  function zoom() {
    if (recs) recs.classList.add('away');
    focus = el('div', 'sy-focus', root);
    el('span', '', focus).textContent = i18n('story.country', { c: 'A' });
    el('b', '', focus).textContent = String(RECORDS[0]);
    SFX.play('zoom', 1);
  }
  function started() {
    var s = el('div', 'sy-started', root);
    s.textContent = i18n('story.started');
    SFX.play('whir');
  }

  /* START: one tap before the story, because a browser plays no sound
     until the player has touched the page */
  function gate(then) {
    build('gate');
    var b = el('button', 'sy-btn sy-start', root);
    b.type = 'button';
    b.textContent = i18n('ui.start');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      SFX.arm();
      VOICE.unlock();
      TRACK.send('game_start');
      stop();
      if (then) then();
    });
  }

  function open(then) {
    build('opening');
    TRACK.at('story');
    var L = function (k) { return i18n('story.lines.' + k); };
    run([
      { who: 'narrator', text: L('narrator') },
      { who: 'rill', text: L('hello'), act: lightMarks },
      { who: 'team', text: L('ready'), act: showRecords },
      { who: 'computer', text: L('error'), act: alarm },
      { who: 'team', text: L('verify') },
      { who: 'team', text: L('huge') },
      { who: 'rill', text: L('check'), act: zoom },
      { who: 'rill', text: L('closer') },
      { who: 'computer', text: L('started'), act: started }
    ], 0, function () {
      DIALOG.hide();
      root.classList.add('off');
      later(function () { stop(); if (then) then(); }, 520);
    });
  }

  function end() {
    build('ending');
    TRACK.at('story end');
    marks.forEach(function (m) { m.classList.add('lit', 'ok'); });
    var hq = el('div', 'sy-hqs', root);
    [i18n('commas.indianHQ'), i18n('commas.intlHQ')].forEach(function (t) {
      var h = el('div', 'sy-hq', hq);
      el('i', '', h).textContent = '✓';
      el('span', '', h).textContent = t;
    });
    FX.confetti(90);
    SFX.play('complete');
    run([
      { who: 'team', text: i18n('story.end.team') },
      { who: 'rill', text: i18n('story.end.officer') }
    ], 0, function () {
      DIALOG.hide();
      var c = el('div', 'sy-done', root);
      el('h2', '', c).textContent = i18n('story.end.headline');
      el('p', '', c).textContent = i18n('story.end.sub');
      var again = el('button', 'sy-btn', c);
      again.type = 'button';
      again.textContent = i18n('teach.again_btn');
      again.addEventListener('click', function (e) { e.stopPropagation(); location.reload(); });
      FX.confetti(60, c);
      SFX.play('clap');
      TRACK.send('game_complete', {});
    });
  }

  function stop() {
    timers.forEach(clearTimeout); timers = [];
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; screen = null; marks = []; recs = null; focus = null;
  }

  return { gate: gate, open: open, end: end, stop: stop };
})();
window.STORY = STORY;

/* ########################################################################## */
/*  COMMAS.JS                                                               */
/* ########################################################################## */

/* ============================================================================
   COMMAS.JS — Level 2 (sheet "L2 V2"): the Indian and International number
   systems, and the reports for both headquarters.

   The teaching puts the commas into 43256781 one group at a time, first the
   Indian way (3, then pairs) and then the International way (threes), and
   sets the two side by side. Then ten country reports: the child taps the
   gaps between the digits to place the commas and presses SEND, and the
   report flies to its headquarters.

   Wrong answers climb the storyboard's three rungs: the wrong commas shake,
   then the last three digits light, then the right gaps glow.
   ========================================================================= */
var COMMAS = (function () {
  'use strict';

  var stage = document.getElementById('stage');
  var SETTLE = 600, IDLE_MS = 12000;
  var DEMO = 43256781;

  var root = null, timers = [], live = false;
  var titleEl, sysEl, hqs = {}, area, btn, strips = [];
  var item = null, idx = -1, tryOn = false, misses = 0, idleSeq = 0, lastAct = 0, sent = { in: 0, intl: 0 };

  function el(tag, cls, host) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (host) host.appendChild(e);
    return e;
  }
  function later(fn, ms) {
    var t = setTimeout(function () { if (root) fn(); }, ms);
    timers.push(t);
  }
  function talk(who, text, then) {
    var ms = VOICE.play(text, function () { if (then) later(then, SETTLE); });
    DIALOG.say(who, text, { pos: 'bottom', ms: ms });
    return ms;
  }

  /* THE GROUPING RULE. Commas sit after the 3rd digit from the right, then
     every 2 (Indian) or every 3 (International). A gap k is the one after
     digit k, counted from the left. */
  function rightCounts(sys) { return sys === 'in' ? [3, 5, 7, 9, 11] : [3, 6, 9, 12]; }
  function answer(n, sys) {
    var len = String(n).length;
    return rightCounts(sys).filter(function (r) { return r < len; })
                           .map(function (r) { return len - 1 - r; }).sort();
  }
  function groups(n, sys) {
    var len = String(n).length, names = sys === 'in'
      ? ['ones', 'thousands', 'lakhs', 'crores'] : ['ones', 'thousands', 'millions', 'billions'];
    var cuts = [len].concat(rightCounts(sys).filter(function (r) { return r < len; })
                                            .map(function (r) { return len - r; }), [0]);
    var out = [];
    for (var k = 0; k + 1 < cuts.length && k < names.length; k++) {
      out.push({ from: cuts[k + 1], to: cuts[k], name: names[k] });
    }
    return out;
  }

  /* ---- A NUMBER STRIP: digit tiles with a tappable gap between each two */
  function strip(n, live) {
    var s = { n: n, digits: [], gaps: [], on: {}, labels: [] };
    s.el = el('div', 'cm-strip', area);
    s.row = el('div', 'cm-row', s.el);
    String(n).split('').forEach(function (d, k, all) {
      var t = el('span', 'cm-digit', s.row);
      t.textContent = d;
      s.digits.push(t);
      if (k < all.length - 1) {
        var g = el(live ? 'button' : 'span', 'cm-gap', s.row);
        if (live) {
          g.type = 'button';
          g.setAttribute('aria-label', 'Comma after digit ' + (k + 1));
          g.addEventListener('click', function (e) { e.stopPropagation(); toggle(s, k); });
        }
        el('i', 'cm-comma', g).textContent = ',';
        s.gaps.push(g);
      }
    });
    strips.push(s);
    return s;
  }
  function setComma(s, k, on) {
    s.on[k] = !!on;
    s.gaps[k].classList.toggle('on', !!on);
  }
  function commaSet(s) {
    return Object.keys(s.on).filter(function (k) { return s.on[k]; }).map(Number).sort();
  }
  function glow(s, from, to, cls) {
    s.digits.forEach(function (d, k) { d.classList.toggle(cls || 'glow', k >= from && k < to); });
  }
  /* a group's name under its digits, laid out in % of the strip so it stays
     put when the stage is resized */
  function label(s, from, to, text, ghost) {
    var row = s.row.getBoundingClientRect();
    var a = s.digits[from].getBoundingClientRect(), b = s.digits[to - 1].getBoundingClientRect();
    var l = el('span', 'cm-label' + (ghost ? ' ghost' : ''), s.el);
    if (ghost) {
      l.style.right = ((row.right - a.left) / row.width * 100 + 2) + '%';
    } else {
      l.style.left = ((a.left - row.left) / row.width * 100) + '%';
      l.style.width = ((b.right - a.left) / row.width * 100) + '%';
    }
    el('span', '', l).textContent = text;
    s.labels.push(l);
    return l;
  }
  function clearStrips() {
    strips.forEach(function (s) { s.el.remove(); });
    strips = [];
  }
  function gname(k) { return i18n('commas.groups.' + k); }

  function setSys(sys) {
    sysEl.textContent = sys ? i18n(sys === 'in' ? 'commas.indianSys' : 'commas.intlSys') : '';
    sysEl.classList.toggle('on', !!sys);
    hqs.in.classList.toggle('active', sys === 'in' || sys === 'both');
    hqs.intl.classList.toggle('active', sys === 'intl' || sys === 'both');
    if (sys === 'both') sysEl.classList.remove('on');
  }

  /* ---- BUILD ----------------------------------------------------------- */
  function build() {
    root = el('div', 'commas', stage);
    root.id = 'commas';
    el('i', 'cm-veil', root);
    titleEl = el('div', 'cm-title', root);
    titleEl.textContent = i18n('commas.title');
    ['in', 'intl'].forEach(function (k) {
      var h = el('div', 'cm-hq ' + k, root);
      el('span', 'cm-hq-name', h).textContent = i18n(k === 'in' ? 'commas.indianHQ' : 'commas.intlHQ');
      h.count = el('b', 'cm-hq-count', h);
      h.count.textContent = '0';
      hqs[k] = h;
    });
    sysEl = el('div', 'cm-sys', root);
    area = el('div', 'cm-area', root);
    btn = el('button', 'cm-btn', root);
    btn.type = 'button';
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (btn.onpress) btn.onpress(); });
    root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    void root.offsetWidth;
    root.classList.add('on');
  }
  function button(text, fn) {
    btn.textContent = text;
    btn.onpress = fn;
    btn.classList.toggle('on', !!fn);
  }

  /* ---- TEACHING -------------------------------------------------------- */
  function teach(then) {
    var t = i18n('commas.teach'), s = null;
    var gs = groups(DEMO, 'in'), gi = groups(DEMO, 'intl');
    var demo = function () { clearStrips(); s = strip(DEMO, false); };
    var step = function (g, comma) {
      return function () {
        glow(s, g.from, g.to);
        label(s, g.from, g.to, gname(g.name));
        if (comma != null) setComma(s, comma, true);
        SFX.play('click', 3);
      };
    };
    var read = function (gl) {
      return function () {
        gl.slice().reverse().forEach(function (g, k) {
          later(function () { glow(s, g.from, g.to, 'read'); SFX.play('tick'); }, 700 * k);
        });
      };
    };
    var beats = [
      { who: 'narrator', text: i18n('commas.narrator') },
      { who: 'computer', text: t[0], act: function () { setSys('both'); SFX.play('chime'); } },
      { who: 'rill', text: t[1], act: function () {
          demo(); titleEl.textContent = i18n('commas.country', { c: 'A' }); } },
      { who: 'rill', text: t[2], act: function () {
          s.el.classList.add('error'); SFX.play('wrong'); } },
      { who: 'rill', text: t[3], act: function () { s.el.classList.remove('error'); } },
      { who: 'rill', text: t[4] },
      { who: 'rill', text: t[5], act: function () { setSys('in'); } },
      { who: 'rill', text: t[6], act: step(gs[0], 4) },
      { who: 'rill', text: t[7], act: step(gs[1], 2) },
      { who: 'rill', text: t[8], act: function () {
          step(gs[2], 0)();
          later(function () { label(s, gs[3].from, gs[3].to, gname(gs[3].name)); glow(s, 0, 1, 'glow2'); }, 900);
        } },
      { who: 'rill', text: t[9], act: read(gs) },
      { who: 'rill', text: t[10], act: function () { setSys('intl'); demo(); } },
      { who: 'rill', text: t[11], act: step(gi[0], 4) },
      { who: 'rill', text: t[12], act: step(gi[1], 1) },
      { who: 'rill', text: t[13], act: function () {
          step(gi[2])();
          later(function () { label(s, 0, 1, gname('billions'), true); }, 900);
        } },
      { who: 'rill', text: t[14], act: read(gi) },
      { who: 'rill', text: t[15], act: function () {
          clearStrips(); setSys('both'); sysEl.classList.remove('on');
          [['in', 'commas.indianSys'], ['intl', 'commas.intlSys']].forEach(function (p) {
            var c = strip(DEMO, false);
            c.el.classList.add('compare', p[0]);
            el('span', 'cm-tag', c.el).textContent = i18n(p[1]);
            answer(DEMO, p[0]).forEach(function (k) { setComma(c, k, true); });
          });
        } }
    ];
    (function run(i) {
      if (!root) return;
      if (i >= beats.length) {
        /* "Now prepare the reports for both headquarters!" waits on CONTINUE */
        talk('rill', t[16]);
        var mine = ++idleSeq;
        button(i18n('commas.continue'), function () {
          idleSeq++; button(i18n('commas.send'), null);
          SFX.play('whir');
          then();
        });
        (function nag() {
          later(function () {
            if (mine !== idleSeq) return;
            if (!VOICE.playing()) { talk('rill', i18n('commas.transitionIdle')); btn.classList.add('pulse'); }
            later(function () { btn.classList.remove('pulse'); }, 1600);
            nag();
          }, IDLE_MS);
        })();
        return;
      }
      var b = beats[i];
      if (b.act) b.act();
      talk(b.who, b.text, function () { run(i + 1); });
    })(0);
  }

  /* ---- PRACTICE -------------------------------------------------------- */
  function howTo(then) {
    clearStrips();
    titleEl.textContent = i18n('commas.title');
    setSys(null);
    var s = strip(12345678, false);
    s.el.classList.add('demo');
    s.gaps.forEach(function (g) { g.classList.add('hint'); });
    later(function () { setComma(s, 4, true); SFX.play('click', 3); }, 1400);
    talk('rill', i18n('commas.howTo'), then);
  }

  function practice(i) {
    var list = i18n('commas.practice');
    if (i >= list.length) return finishLevel();
    idx = i; item = list[i]; misses = 0;
    clearStrips();
    titleEl.textContent = i18n('commas.country', { c: item.country });
    setSys(item.sys);
    var s = strip(item.n, true);
    button(i18n('commas.send'), null);
    talk('rill', i18n(item.sys === 'in' ? 'commas.prepIn' : 'commas.prepIntl'));
    tryOn = true;
    armIdle();
  }
  function cur() { return strips[0]; }

  function toggle(s, k) {
    if (!tryOn || s !== cur()) return;
    setComma(s, k, !s.on[k]);
    s.gaps[k].classList.remove('bad');
    SFX.play('click', 3);
    lastAct = performance.now();
    var any = commaSet(s).length > 0;
    button(i18n('commas.send'), any ? send : null);
  }

  function armIdle() {
    var mine = ++idleSeq;
    lastAct = performance.now();
    (function wait() {
      later(function () {
        if (mine !== idleSeq || !tryOn) return;
        if (VOICE.playing() || performance.now() - lastAct < IDLE_MS - 100) return wait();
        talk('rill', i18n('commas.idle', { c: item.country }));
        var s = cur();
        if (s) {
          s.el.classList.add('pulse');
          later(function () { s.el.classList.remove('pulse'); }, 1600);
        }
        lastAct = performance.now();
        wait();
      }, IDLE_MS);
    })();
  }

  function send() {
    if (!tryOn) return;
    var s = cur(), want = answer(item.n, item.sys), got = commaSet(s);
    var ok = want.length === got.length && want.every(function (k, j) { return k === got[j]; });
    TRACK.send('lesson_answer', { level: 2, attempt: misses + 1, correct: ok,
                                  given: got.join(','), target: want.join(',') });
    if (ok) return good(s);
    wrong(s, want);
  }

  function good(s) {
    tryOn = false; idleSeq++;
    button(i18n('commas.send'), null);
    s.gaps.forEach(function (g) { g.classList.remove('bad', 'hint'); });
    s.el.classList.add('right');
    SFX.play('lock');
    FX.confetti(30, s.el);
    talk('computer', i18n('commas.ready', { c: item.country }), function () {
      flyTo(s, hqs[item.sys], function () { practice(idx + 1); });
    });
  }

  /* the finished report flies up into its headquarters' card */
  function flyTo(s, hq, then) {
    var a = s.el.getBoundingClientRect(), b = hq.getBoundingClientRect();
    var dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    var dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    SFX.play('whir');
    var anim = s.el.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.2)', opacity: 0.2 }
    ], { duration: 700, easing: 'cubic-bezier(0.5, 0, 0.7, 1)', fill: 'forwards' });
    /* the report lands on the animation's end, or on a timer if the
       animation never reports one, so a stalled frame cannot hold the level */
    var landed = false;
    later(function () { if (anim.onfinish) anim.onfinish(); }, 1100);
    anim.onfinish = function () {
      if (!root || landed) return;
      landed = true;
      sent[item.sys]++;
      hq.count.textContent = String(sent[item.sys]);
      hq.classList.remove('got'); void hq.offsetWidth; hq.classList.add('got');
      SFX.play('chime');
      later(then, 500);
    };
  }

  function wrong(s, want) {
    misses++;
    lastAct = performance.now();
    SFX.play('wrong');
    s.gaps.forEach(function (g, k) { g.classList.toggle('bad', !!s.on[k] && want.indexOf(k) < 0); });
    s.el.classList.remove('shake'); void s.el.offsetWidth; s.el.classList.add('shake');
    var len = String(item.n).length;
    if (misses === 1) {
      talk('rill', i18n('commas.wrong1'));
    } else if (misses === 2) {
      glow(s, len - 3, len);
      talk('rill', i18n('commas.wrong2'));
    } else {
      glow(s, len - 3, len);
      want.forEach(function (k) { s.gaps[k].classList.add('hint'); });
      talk('rill', i18n(item.sys === 'in' ? 'commas.wrong3in' : 'commas.wrong3intl'));
    }
  }

  function finishLevel() {
    clearStrips();
    titleEl.textContent = i18n('commas.title');
    setSys('both');
    button(i18n('commas.send'), null);
    FX.confetti(70);
    SFX.play('complete');
    TRACK.send('level_complete', { level: 2 });
    talk('team', i18n('commas.done'), function () {
      later(function () { stop(); STORY.end(); }, 400);
    });
  }

  /* ---- RUN ------------------------------------------------------------- */
  /* from: null for the whole level, or { practice: N } to open at report N */
  function play(from) {
    if (live) return;
    live = true;
    document.body.classList.remove('no-map');
    TRACK.at('level 2'); TRACK.send('lesson_start', { level: 2 });
    build();
    sent = { in: 0, intl: 0 };
    if (from && from.practice != null) return practice(from.practice);
    if (from && from.howTo) return howTo(function () { practice(0); });
    teach(function () { howTo(function () { practice(0); }); });
  }

  function stop() {
    timers.forEach(clearTimeout); timers = [];
    idleSeq++; tryOn = false; live = false;
    DIALOG.hide();
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; strips = []; hqs = {};
  }

  return {
    play: play,
    stop: stop,
    /* for driving it from a test: place the right commas and SEND */
    solve: function () {
      var s = cur();
      if (!tryOn || !s) return false;
      answer(item.n, item.sys).forEach(function (k) { setComma(s, k, true); });
      send();
      return true;
    },
    state: function () {
      var s = cur();
      return { live: live, idx: idx, tryOn: tryOn, misses: misses,
               commas: s ? commaSet(s) : [], sent: sent };
    }
  };
})();
window.COMMAS = COMMAS;

/* ########################################################################## */
/*  DEV.JS                                                                  */
/* ########################################################################## */

/* ============================================================================
   DEV.JS — jump to any screen of the game.

   Add ?dev=1 to the URL and a small DEV menu appears in the top-left corner.
   Picking a screen reloads the page at ?dev=1&go=<target>, and intro.js starts
   the game there instead of on the title (see devRoute in intro.js). Reloading
   rather than jumping in place means every screen starts from a clean page,
   exactly as it would in play.

   ?demo=1 honours go= the same way but shows no menu: it is what the
   ending-demo.html preview page opens. Without either, this file does nothing.
   ========================================================================= */
(function () {
  var q = new URLSearchParams(location.search);
  /* ON A LOCAL SERVER (Live Server, 127.0.0.1 / localhost) the menu is up
     without asking; ?dev=0 hides it there. Anywhere else it needs ?dev=1. */
  var local = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  var menu = q.get('dev') === '1' ||
             (local && q.get('dev') !== '0' && q.get('demo') !== '1');
  if (!menu && q.get('demo') !== '1') return;

  /* read by intro.js once everything has loaded */
  window.DEV_GO = q.get('go') || null;

  /* every screen, in the order the game plays them. Built from LEVELS and
     LINES, so a new level or intro screen turns up here by itself. */
  function targets() {
    /* NUMBER POPULATION: only the chart's own steps */
    var lv = LEVELS.filter(function (l) { return l.id === NP_LEVEL; })[0];
    var items = [{ go: 'teach:' + lv.id, label: 'Lesson' }];
    window.TEACH_SCREEN.steps(lv.id).forEach(function (st) {
      var t = st.text.length > 40 ? st.text.slice(0, 40) + '\u2026' : st.text;
      items.push({ go: 'teach:' + lv.id + ':' + st.go, label: st.kind + ' ' + st.n + ' \u2014 ' + t });
    });
    var l2 = [{ go: 'commas', label: 'Teaching' }, { go: 'commas:how', label: 'How to play' }];
    i18n('commas.practice').forEach(function (r, i) {
      l2.push({ go: 'commas:p:' + i, label: 'Report ' + (i + 1) + ' \u2014 Country ' + r.country + ' (' + r.sys + ')' });
    });
    return [{ group: 'Story', items: [{ go: 'story', label: 'Opening' }] },
            { group: 'Level 1 \u2014 ' + lv.name, items: items },
            { group: 'Level 2 \u2014 Commas', items: l2 },
            { group: 'End', items: [{ go: 'end', label: 'Story ending' }] }];
  }
  function targetsOld() {
    var list = [{ group: 'Start', items: [{ go: 'title', label: 'Title screen' }] }];

    var slides = [];
    LINES.forEach(function (l) {
      if (slides.some(function (s) { return s.n === l.slide; })) return;
      slides.push({ n: l.slide, text: l.text });
    });
    list.push({ group: 'Intro', items: slides.map(function (s) {
      var t = s.text.length > 40 ? s.text.slice(0, 40) + '…' : s.text;
      return { go: 'intro:' + s.n, label: 'Screen ' + s.n + ' — ' + t };
    }) });

    LEVELS.forEach(function (lv) {
      var items = [{ go: 'teach:' + lv.id, label: 'Lesson' }];
      /* every step inside the lesson, so a later one can be opened without
         sitting through the ones before it */
      if (window.TEACH_SCREEN) window.TEACH_SCREEN.steps(lv.id).forEach(function (st) {
        var t = st.text.length > 40 ? st.text.slice(0, 40) + '…' : st.text;
        items.push({ go: 'teach:' + lv.id + ':' + st.go,
                     label: 'Lesson · ' + st.kind + ' ' + st.n + ' — ' + t });
      });
      items.push({ go: 'level:' + lv.id, label: 'Brief' });
      if (lv.id > 1) items.push({ go: 'bay:' + lv.id, label: 'Bay opening + brief' });
      lv.runs.forEach(function (r, i) {
        var what = r.calibration ? 'calibration' : r.split ? 'split run' :
                   (r.dest || '').toLowerCase();
        items.push({ go: 'run:' + lv.id + ':' + i, label: 'Run ' + r.id + ' — ' + what });
      });
      items.push({ go: 'flight:' + lv.id, label: 'Delivery flight' });
      list.push({ group: 'Level ' + lv.id + ' — ' + lv.name, items: items });
    });

    list.push({ group: 'End', items: [
      { go: 'post:perfect', label: 'Celebration — perfect' },
      { go: 'post:pass', label: 'Celebration — pass' },
      { go: 'post:retry', label: 'Celebration — retry' }
    ] });
    return list;
  }

  function build() {
    var css = document.createElement('style');
    css.textContent =
      '#devMenu{position:fixed;top:8px;left:8px;z-index:99999;display:flex;' +
      'align-items:center;gap:6px;padding:4px 6px;border-radius:6px;' +
      'background:rgba(10,14,22,.85);color:#9fd8ff;font:12px/1.2 system-ui,sans-serif;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.4);opacity:.35;transition:opacity .15s}' +
      /* faint until reached for, so it does not cover the game's own corner */
      '#devMenu:hover,#devMenu:focus-within{opacity:1}' +
      '#devMenu b{letter-spacing:.08em;font-size:11px}' +
      '#devMenu select{max-width:260px;font:inherit;color:#fff;background:#1a2230;' +
      'border:1px solid #33465e;border-radius:4px;padding:2px 4px}' +
      '#devMenu button{font:inherit;color:#fff;background:#1a2230;border:1px solid #33465e;' +
      'border-radius:4px;padding:2px 6px;cursor:pointer}';
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.id = 'devMenu';
    var tag = document.createElement('b');
    tag.textContent = 'DEV';
    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Jump to a screen');

    targets().forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = g.group;
      g.items.forEach(function (it) {
        var o = document.createElement('option');
        o.value = it.go; o.textContent = it.label;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.value = window.DEV_GO || 'story';

    /* the same screen again, from the start */
    var again = document.createElement('button');
    again.type = 'button'; again.textContent = '↻';
    again.title = 'Restart this screen';

    var go = function (target) {
      var u = new URLSearchParams(location.search);
      u.set('dev', '1'); u.set('go', target);
      location.search = u.toString();
    };
    sel.addEventListener('change', function () { go(sel.value); });
    again.addEventListener('click', function () { go(sel.value); });

    /* keep taps and keys on the menu from reaching the game underneath */
    ['pointerdown', 'click', 'keydown'].forEach(function (ev) {
      box.addEventListener(ev, function (e) { e.stopPropagation(); });
    });

    box.appendChild(tag); box.appendChild(sel); box.appendChild(again);
    document.body.appendChild(box);
  }

  if (!menu) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

}
