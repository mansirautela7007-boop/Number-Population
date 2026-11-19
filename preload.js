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
 "assets/portraits/veth-face.webp": 428576,
 "assets/portraits/rill-face.webp": 369312,
 "assets/cover/veth-thumbs-up.webp": 1624736,
 "assets/cover/control-room.jpg": 427408,
 "assets/Game assets/hand.webp": 14440,
 "assets/audio/sfx/alarm.m4a": 23356,
 "assets/audio/sfx/click.m4a": 5560,
 "assets/audio/sfx/correct.m4a": 9739,
 "assets/audio/sfx/fanfare.m4a": 76554,
 "assets/audio/sfx/notify.m4a": 12378,
 "assets/audio/sfx/swish.m4a": 7770,
 "assets/audio/sfx/whoosh.m4a": 6186,
 "assets/voice/narrator-253cd616ff.m4a": 19672,
 "assets/voice/veth-aa58e9a0aa.m4a": 47532,
 "assets/voice/rill-99f4126348.m4a": 23496,
 "assets/voice/computer-4e9e00a477.m4a": 15054,
 "assets/voice/rill-f17752108f.m4a": 18391,
 "assets/voice/veth-8c5931b936.m4a": 27052,
 "assets/voice/veth-0035b3a65f.m4a": 29738,
 "assets/voice/veth-56e188fba7.m4a": 56947,
 "assets/voice/veth-1441bf286f.m4a": 65441,
 "assets/voice/veth-997b8c33b5.m4a": 32487,
 "assets/voice/veth-b8ce38d96d.m4a": 31898,
 "assets/voice/veth-87675f7d0f.m4a": 33683,
 "assets/voice/veth-d17423821a.m4a": 28367,
 "assets/voice/veth-859de2a3fb.m4a": 27412,
 "assets/voice/narrator-d8e4214b5b.m4a": 42065,
 "assets/voice/narrator-0bdef07c7e.m4a": 43819,
 "assets/voice/narrator-ea77fe4dc2.m4a": 40133,
 "assets/voice/narrator-a932a15ae1.m4a": 36447,
 "assets/voice/narrator-5d95c4d65e.m4a": 38910,
 "assets/voice/narrator-295bb800fd.m4a": 37002,
 "assets/voice/narrator-3979b3c600.m4a": 40946,
 "assets/voice/narrator-fd31cf0d7e.m4a": 37587,
 "assets/voice/narrator-9d6bfed8b3.m4a": 39616,
 "assets/voice/narrator-d2949a4261.m4a": 26478,
 "assets/voice/narrator-26cec6e19f.m4a": 67317,
 "assets/voice/veth-9d8624c3fd.m4a": 54498,
 "assets/voice/veth-e00a96ff04.m4a": 58367,
 "assets/voice/veth-64f6a10171.m4a": 59908,
 "assets/voice/veth-2a689ca399.m4a": 69721,
 "assets/voice/veth-5f2884aff1.m4a": 58006,
 "assets/voice/veth-ffdec52568.m4a": 26017,
 "assets/voice/veth-51fc9f5893.m4a": 17590,
 "assets/voice/narrator-8bffe2e4df.m4a": 26550,
 "assets/voice/narrator-ed39a0ccb2.m4a": 63502,
 "assets/voice/veth-2577cdc3c3.m4a": 53407,
 "assets/voice/veth-ec03505bb1.m4a": 59664,
 "assets/voice/veth-a963144d3d.m4a": 67883,
 "assets/voice/veth-4282da897e.m4a": 56425,
 "assets/voice/veth-a32ad6c782.m4a": 34180,
 "assets/voice/narrator-6fbeeef9ca.m4a": 27373,
 "assets/voice/narrator-8796b54454.m4a": 60957,
 "assets/voice/veth-426883550c.m4a": 69660,
 "assets/voice/veth-3de17cb57f.m4a": 57531,
 "assets/voice/veth-11a772fd96.m4a": 61353,
 "assets/voice/veth-b9664b42fc.m4a": 69444,
 "assets/voice/veth-5243b4aa23.m4a": 52291,
 "assets/voice/veth-2f959405af.m4a": 28262,
 "assets/voice/narrator-ad170972e3.m4a": 26736,
 "assets/voice/narrator-e141613bef.m4a": 61427,
 "assets/voice/veth-618b959fd1.m4a": 58908,
 "assets/voice/veth-d6a2b3f6f8.m4a": 61985,
 "assets/voice/veth-86904d7a3f.m4a": 69576,
 "assets/voice/veth-ffe65a92d4.m4a": 52324,
 "assets/voice/veth-4ab16173ba.m4a": 28065,
 "assets/voice/narrator-d3e4374555.m4a": 26480,
 "assets/voice/narrator-e23ea3324b.m4a": 58864,
 "assets/voice/veth-d3d19ba5ec.m4a": 56276,
 "assets/voice/veth-b731a8e69d.m4a": 60590,
 "assets/voice/veth-0d301defd0.m4a": 71122,
 "assets/voice/veth-153a259504.m4a": 50579,
 "assets/voice/veth-688b4f3235.m4a": 31931,
 "assets/voice/narrator-7b9a4e5871.m4a": 26898,
 "assets/voice/narrator-731666c93e.m4a": 63613,
 "assets/voice/veth-92f34f38ef.m4a": 54346,
 "assets/voice/veth-faddd6061d.m4a": 68568,
 "assets/voice/veth-eb02ada8c3.m4a": 57380,
 "assets/voice/veth-51b9193ab6.m4a": 27078,
 "assets/voice/narrator-a4be2fc679.m4a": 27071,
 "assets/voice/narrator-f0f95c19d6.m4a": 61320,
 "assets/voice/veth-712fca2fb5.m4a": 66813,
 "assets/voice/veth-0a0cb06b4f.m4a": 55408,
 "assets/voice/veth-ae4add7c1e.m4a": 58304,
 "assets/voice/veth-692bab09fe.m4a": 65221,
 "assets/voice/veth-a0ff767bc4.m4a": 50812,
 "assets/voice/veth-0d95854211.m4a": 35617,
 "assets/voice/narrator-bc184b499a.m4a": 27783,
 "assets/voice/narrator-440e987853.m4a": 63136,
 "assets/voice/veth-46b4e95cf0.m4a": 42270,
 "assets/voice/veth-6fba06ab5c.m4a": 47113,
 "assets/voice/veth-cfeb0c850e.m4a": 49684,
 "assets/voice/veth-18daf742b9.m4a": 57101,
 "assets/voice/veth-c012c41f1f.m4a": 55801,
 "assets/voice/veth-3794acd665.m4a": 28791,
 "assets/voice/rill-9f7f63eed8.m4a": 21261,
 "assets/voice/veth-78300ab206.m4a": 32277,
 "assets/voice/veth-3953c53616.m4a": 41015,
 "assets/voice/veth-b76c92ff85.m4a": 46640,
 "assets/voice/veth-1967bb2571.m4a": 45623,
 "assets/voice/veth-ebd13e9a03.m4a": 50144,
 "assets/voice/veth-c6a624421e.m4a": 49463,
 "assets/voice/veth-fe6d460856.m4a": 46454,
 "assets/voice/veth-4535b998ac.m4a": 56925,
 "assets/voice/veth-bff5d02d03.m4a": 49491,
 "assets/voice/veth-897956303c.m4a": 67532,
 "assets/voice/veth-e6ccd08c7a.m4a": 52069,
 "assets/voice/veth-14390aae44.m4a": 47314,
 "assets/voice/veth-19bd3df543.m4a": 54489,
 "assets/voice/veth-09771b829c.m4a": 50544,
 "assets/voice/veth-26fa9d57af.m4a": 62425,
 "assets/voice/veth-fe6be5e90e.m4a": 47787,
 "assets/voice/veth-9f02b6773d.m4a": 37479,
 "assets/voice/veth-387a454b53.m4a": 40806,
 "assets/voice/veth-c36561ca21.m4a": 37688,
 "assets/voice/veth-9b3ccb6e05.m4a": 21514,
 "assets/voice/veth-eab3d6f129.m4a": 22342,
 "assets/voice/veth-93d8caa1bd.m4a": 17320,
 "assets/voice/veth-165833afdd.m4a": 31142,
 "assets/voice/veth-d82e4df7f8.m4a": 34691,
 "assets/voice/veth-3d46eb2258.m4a": 38169,
 "assets/voice/veth-5287043d43.m4a": 17904,
 "assets/voice/veth-78b5410ce8.m4a": 30742,
 "assets/voice/veth-f84683b321.m4a": 17295,
 "assets/voice/veth-14afd7c063.m4a": 23718,
 "assets/voice/veth-be5ef1f158.m4a": 35078,
 "assets/voice/veth-8476be455f.m4a": 42388,
 "assets/voice/veth-15567dc44b.m4a": 16522,
 "assets/voice/veth-17f262ed65.m4a": 23062,
 "assets/voice/veth-f37c3a3a5a.m4a": 16921,
 "assets/voice/veth-da4779726d.m4a": 21880,
 "assets/voice/veth-ff7e56df9e.m4a": 28544,
 "assets/voice/veth-567693f16c.m4a": 30343,
 "assets/voice/veth-b859584ac5.m4a": 36965,
 "assets/voice/veth-a346bbc315.m4a": 28053,
 "assets/voice/veth-c07720e32c.m4a": 43716,
 "assets/voice/veth-0c82fedb3e.m4a": 29853,
 "assets/voice/veth-20b2cfaeee.m4a": 39005,
 "assets/voice/veth-000feb7b5d.m4a": 39213,
 "assets/voice/veth-a51ad1cbe8.m4a": 23539,
 "assets/voice/veth-448c4117a3.m4a": 31731,
 "assets/voice/veth-e7f3821ddf.m4a": 28999,
 "assets/voice/veth-5a1fb64cee.m4a": 32180,
 "assets/voice/veth-20e824892c.m4a": 40006,
 "assets/voice/veth-032a979993.m4a": 24511,
 "assets/voice/veth-2a07b50c37.m4a": 22285,
 "assets/voice/veth-6c35c064b4.m4a": 35191,
 "assets/voice/veth-037a4b616f.m4a": 24747,
 "assets/voice/veth-2ecb742c94.m4a": 27794,
 "assets/voice/veth-9681bdfc07.m4a": 19025,
 "assets/voice/veth-e97793e4db.m4a": 24713,
 "assets/voice/veth-a906f70c98.m4a": 25141,
 "assets/voice/veth-015e637308.m4a": 27201,
 "assets/voice/veth-d5aa040d11.m4a": 32724,
 "assets/voice/veth-03fe5e250b.m4a": 53226,
 "assets/voice/narrator-da2d688ca4.m4a": 28403,
 "assets/voice/veth-3402aad186.m4a": 55723,
 "assets/voice/narrator-9b58707b4e.m4a": 30848,
 "assets/voice/veth-636afeb214.m4a": 21574,
 "assets/voice/veth-9cde1447b1.m4a": 51581,
 "assets/voice/veth-e677e9b34b.m4a": 55231,
 "assets/voice/veth-5686a5de50.m4a": 21349,
 "assets/voice/veth-b6e1cd1c8f.m4a": 53255,
 "assets/voice/veth-fce2797ceb.m4a": 55923,
 "assets/voice/veth-6c391ee378.m4a": 21158,
 "assets/voice/veth-a188a53e95.m4a": 49126,
 "assets/voice/veth-94dfa3f489.m4a": 51553,
 "assets/voice/veth-3a9b4d08cf.m4a": 21438,
 "assets/voice/veth-79516f81f4.m4a": 49361,
 "assets/voice/veth-dcb76504f4.m4a": 54110,
 "assets/voice/veth-ce7d38c322.m4a": 21639,
 "assets/voice/veth-5bb5572840.m4a": 42548,
 "assets/voice/veth-9540223959.m4a": 44660,
 "assets/voice/veth-66696a8604.m4a": 22605,
 "assets/voice/veth-7054f8a227.m4a": 53945,
 "assets/voice/veth-8ae2bd8de7.m4a": 57021,
 "assets/voice/veth-aae1c234dd.m4a": 21539,
 "assets/voice/veth-544ea074bf.m4a": 52269,
 "assets/voice/veth-8b118d829f.m4a": 55616,
 "assets/voice/veth-b653d78d81.m4a": 21762,
 "assets/voice/rill-b49122b369.m4a": 24529,
 "assets/voice/veth-5e0d62421a.m4a": 39326
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
    'assets/portraits/rill.webp',
    'assets/portraits/veth-face.webp', 'assets/portraits/rill-face.webp',
    'assets/Game assets/hand.webp'
  ]);
  /* 19 Nov 2026: THE VOICE LINES ARE FETCHED TOO, in the order the game
     says them (tools/gen_asset_sizes.py lists them from the manifest) — a
     line no longer waits on its own download as it starts. START waits for
     the sound effects and the story's opening lines only. */
  var VOICE_LIST = Object.keys(ASSET_SIZES).filter(function (p) { return /^assets\/voice\//.test(p); });
  var OPENING_VOICES = 6, EARLY_VOICES = 14;
  function isPlayable(p) {
    return PLAYABLE_PICS.indexOf(p) >= 0 || /^assets\/audio\/sfx\//.test(p) ||
           (VOICE_LIST.indexOf(p) >= 0 && VOICE_LIST.indexOf(p) < OPENING_VOICES);
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
    /* the next voice lines, then the pictures smallest first, then the
       rest of the lines in the order they are said */
    .concat(VOICE_LIST.slice(OPENING_VOICES, EARLY_VOICES).filter(function (p) { return !pSet[p]; }))
    .concat(list.filter(function (p) { return !pSet[p] && !firstSet[p] && LAST.indexOf(p) < 0 && VOICE_LIST.indexOf(p) < 0; }).sort(bySize))
    .concat(VOICE_LIST.slice(EARLY_VOICES).filter(function (p) { return !pSet[p]; }))
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
  /* 18 Nov 2026: THE COVER FIRST. The background downloads wait until the
     page itself has loaded — the game's code and the cover's pictures
     (index.html preloads those) — so they never share the connection with
     the cover, and the cover comes up as early as it can */
  if (document.readyState === 'complete') pump();
  else window.addEventListener('load', function () { pump(); }, { once: true });
})();
