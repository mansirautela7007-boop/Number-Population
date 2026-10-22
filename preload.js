/* ==========================================================================
   PRELOAD.JS — everything the game will ever load is fetched here, behind the
   loading bar on the start screen, before START can be pressed.

   FORMATS. Pictures are WebP, the end clip is WebM (VP9 + Opus) and every
   voice line is Ogg (Opus). Supported by Chrome, Edge and Firefox, and by
   Safari 14+ for WebP, Safari 15+ for WebM/VP9 and Safari 18.4+ for Ogg Opus.

   HOW IT WORKS
   - ASSET_SIZES is generated from the real files on disk by
     tools/gen_asset_sizes.py — run it after adding or changing any asset. The
     bytes weight the bar, refined by Content-Length as each response arrives.
   - Each file is streamed with a reader, so the bar moves by the byte, and
     never goes backwards.
   - The start screen's own pictures go first (the font is already
     fetched by index.html's <link rel=preload>); after
     that the queue runs smallest-first, five at a time, so pictures are never
     stuck behind the 0.8 MB clip.
   - A fetched file is kept as a blob: URL. ASSET(url) hands the game that
     local copy, or the normal URL if the file did not arrive — so "loaded"
     really means "on this device", and nothing is downloaded twice.
   - START DOES NOT WAIT FOR EVERYTHING (QA Bug 30, 13 Oct 2026). It waits
     for PLAYABLE: the title's pictures, the intro's pictures and the
     narrator's lines — about 6 of the 15 MB. The rest (the lessons' and
     levels' voices, the flight, the end clip) keeps downloading in the
     background while the intro plays, and anything asked for before its
     copy has arrived is simply loaded from its normal URL.
   - NOTHING HERE CAN BLOCK THE GAME. A failed, stalled (no bytes on any
     transfer for STALL_MS, or past its own size-based cap) or aborted transfer, or file:// where fetch is not allowed,
     simply counts as done, and that element keeps its normal file URL.
   ========================================================================== */
var ASSET_SIZES = /*SIZES*/{
 "assets/Story Assets/Map.webp": 221066,
 "assets/Story Assets/rill talking.webp": 1505662,
 "assets/portraits/rill.webp": 17956,
 "assets/Game assets/hand.webp": 14440
}/*END*/;

(function () {
  'use strict';
  var CONCURRENCY = 5;
  /* A TRANSFER IS GIVEN UP ONLY WHEN THE WHOLE PIPE HAS GONE QUIET. On a slow
     link the browser feeds a few streams at a time, so one file can sit for
     15 s without a byte while the others are moving — that is not a stall,
     and killing it meant downloading it all over again from the element.
     So: no bytes on ANY transfer for STALL_MS, or this one past its own hard
     cap (its size at a 16 KB/s floor, and never under a minute). */
  var STALL_MS = 15000;
  var FLOOR_BPS = 16 * 1024, CAP_MIN_MS = 60000;
  var lastByteAt = Date.now();
  var FIRST = [                // the chart's backdrop
    'assets/Story Assets/Map.webp'
  ];

  /* what START waits for: the title's own pictures, everything the intro
     decodes before its first frame, and the narrator's and Veth's lines */
  var PLAYABLE_PICS = FIRST.concat([
    'assets/Story Assets/rill talking.webp', 'assets/portraits/rill.webp',
    'assets/Game assets/hand.webp'
  ]);
  function isPlayable(p) {
    return PLAYABLE_PICS.indexOf(p) >= 0 || /^assets\/voice\/(narrator|veth)-/.test(p);
  }
  /* played last, and big: they go to the back of the queue */
  var LAST = [];

  var blobs = {}, origOf = {};          // file path -> blob URL, blob URL -> file path
  var total = 0, got = 0, shown = 0, done = false, firstDone = false;
  var waiters = [], firstWaiters = [], listeners = [];
  /* the PLAYABLE group has its own count, bar and waiters */
  var pTotal = 0, pGot = 0, pShown = 0, pDone = false, pLeft = 0;
  var pWaiters = [], pListeners = [];
  /* and so does FIRST, for the dark loader that stands before the title */
  var fTotal = 0, fGot = 0, fShown = 0, fListeners = [];

  function key(u) {
    u = String(u || '');
    try { u = decodeURI(u); } catch (e) {}
    return u.replace(/^\.\//, '').split('#')[0];
  }
  function enc(u) { return /%[0-9A-Fa-f]{2}/.test(u) ? u : encodeURI(u); }

  /* the URL an element should use: the local copy when there is one */
  window.ASSET = function (u) {
    var b = blobs[key(u)];
    return b || enc(String(u));
  };
  /* and back again, for an element whose blob failed */
  window.ASSET.original = function (blobUrl) { return origOf[blobUrl] ? enc(origOf[blobUrl]) : null; };

  /* ANY element fed a blob that then fails goes back to the real file once,
     and a video carries on playing from there */
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (!el || !el.src || el.src.indexOf('blob:') !== 0 || el.__reverted) return;
    var orig = window.ASSET.original(el.src);
    if (!orig) return;
    el.__reverted = true;
    var wasPlaying = el.tagName === 'VIDEO' && !el.paused;
    var at = el.currentTime || 0;
    el.src = orig;
    if (el.tagName === 'VIDEO') {
      try { el.currentTime = at; } catch (x) {}
      if (wasPlaying || el.autoplay) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
    }
  }, true);

  window.ASSETS = {
    /* every file */
    ready: function () { return done; },
    whenReady: function (fn) { if (done) fn(); else waiters.push(fn); },
    onAllProgress: function (fn) { listeners.push(fn); fn(shown, done); },
    /* the title's own pictures */
    whenFirst: function (fn) { if (firstDone) fn(); else firstWaiters.push(fn); },
    onFirstProgress: function (fn) { fListeners.push(fn); fn(fShown, firstDone); },
    /* enough to press START and play the intro: what the start screen's bar shows */
    playable: function () { return pDone; },
    whenPlayable: function (fn) { if (pDone) fn(); else pWaiters.push(fn); },
    onProgress: function (fn) { pListeners.push(fn); fn(pShown, pDone); },
    progress: function () { return pShown; }
  };

  function call(list, a, b) { list.forEach(function (fn) { try { fn(a, b); } catch (e) {} }); }
  function emit() {
    var f = total ? Math.min(1, got / total) : 1;
    if (done) f = 1;
    if (f < shown) f = shown;              // never backwards
    shown = f;
    call(listeners, shown, done);
    var pf = pDone ? 1 : (pTotal ? Math.min(1, pGot / pTotal) : 1);
    if (pf > pShown) { pShown = pf; call(pListeners, pShown, pDone); }
    var ff = firstDone ? 1 : (fTotal ? Math.min(1, fGot / fTotal) : 1);
    if (ff > fShown) { fShown = ff; call(fListeners, fShown, firstDone); }
  }

  function finishPlayable() {
    if (pDone) return;
    pDone = true; pShown = 1; call(pListeners, 1, true);
    var w = pWaiters; pWaiters = []; w.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function finishAll() {
    if (done) return;
    done = true; emit();
    finishPlayable();
    var w = waiters; waiters = []; w.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  var list = Object.keys(ASSET_SIZES);
  if (!list.length || !window.fetch || location.protocol === 'file:') {
    firstDone = true; finishAll(); return;
  }
  list.forEach(function (p) { total += ASSET_SIZES[p] || 1; });
  var firstSet = {}; FIRST.forEach(function (p) { if (ASSET_SIZES[p] != null) firstSet[p] = 1; });
  var firstLeft = Object.keys(firstSet).length;
  Object.keys(firstSet).forEach(function (p) { fTotal += ASSET_SIZES[p] || 1; });
  var pSet = {};
  list.forEach(function (p) { if (isPlayable(p)) { pSet[p] = 1; pTotal += ASSET_SIZES[p] || 1; pLeft++; } });
  /* the title first; then what START waits for; then the rest, smallest
     first so pictures are never stuck behind a big file, and the two that
     are only seen at the very end after everything else */
  var bySize = function (a, b) { return ASSET_SIZES[a] - ASSET_SIZES[b]; };
  var queue = Object.keys(firstSet)
    .concat(list.filter(function (p) { return pSet[p] && !firstSet[p]; }).sort(bySize))
    .concat(list.filter(function (p) { return !pSet[p] && !firstSet[p] && LAST.indexOf(p) < 0; }).sort(bySize))
    .concat(LAST.filter(function (p) { return ASSET_SIZES[p] != null; }));
  if (!firstLeft) firstDone = true;
  if (!pLeft) finishPlayable();
  var left = queue.length, running = 0;

  function firstOne(p) {
    if (!firstSet[p] || firstDone) return;
    if (--firstLeft <= 0) {
      firstDone = true;
      var w = firstWaiters; firstWaiters = []; w.forEach(function (fn) { try { fn(); } catch (e) {} });
    }
  }

  function settle(p, counted, expect) {
    /* whatever happened, this file's whole share of the bar is now spent */
    add(p, Math.max(0, expect - counted));
    emit();
    firstOne(p);
    if (pSet[p] && --pLeft <= 0) finishPlayable();
    running--;
    if (--left === 0) finishAll(); else pump();
  }

  /* bytes arrived for p: they count on every bar p is part of */
  function add(p, n) {
    got += n;
    if (pSet[p]) pGot += n;
    if (firstSet[p]) fGot += n;
  }

  function load(p) {
    running++;
    var expect = ASSET_SIZES[p] || 1, counted = 0, ended = false;
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = null;
    var startedAt = Date.now(), capMs = Math.max(CAP_MIN_MS, expect / FLOOR_BPS * 1000);
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var now = Date.now();
        if (now - lastByteAt < STALL_MS && now - startedAt < capMs) return arm();
        if (ctl) ctl.abort();
        end(false);
      }, STALL_MS);
    }
    function end(ok, blob) {
      if (ended) return; ended = true; clearTimeout(timer);
      if (ok && blob) {
        var url = URL.createObjectURL(blob);
        blobs[p] = url; origOf[url] = p;
      }
      settle(p, counted, expect);
    }
    arm();
    fetch(encodeURI(p), ctl ? { signal: ctl.signal } : {}).then(function (res) {
      if (!res.ok) return end(false);
      var len = +res.headers.get('Content-Length');
      if (len > 0 && len !== expect) {
        total += len - expect;
        if (pSet[p]) pTotal += len - expect;
        if (firstSet[p]) fTotal += len - expect;
        expect = len;
      }
      var type = res.headers.get('Content-Type') || '';
      if (!res.body || !res.body.getReader) {
        return res.blob().then(function (b) { counted = expect; add(p, expect); emit(); end(true, b); }, function () { end(false); });
      }
      var reader = res.body.getReader(), parts = [];
      (function pull() {
        reader.read().then(function (r) {
          if (ended) return;
          if (r.done) return end(true, new Blob(parts, { type: type }));
          parts.push(r.value);
          var n = Math.min(r.value.length, Math.max(0, expect - counted));
          counted += n; add(p, n); emit(); lastByteAt = Date.now(); arm();
          pull();
        }, function () { end(false); });
      })();
    }, function () { end(false); });
  }

  function pump() {
    while (running < CONCURRENCY && queue.length) load(queue.shift());
  }
  pump();
})();
