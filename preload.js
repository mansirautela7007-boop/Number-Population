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
/* 20 Nov 2026: every file's content fingerprint, written by
   tools/stamp_build.py — a file's URL carries it (?v=…), so a browser that
   kept an older copy (a normal window; incognito keeps nothing) fetches the
   new one. Unlisted files load without one. */
var ASSET_HASH = /*HASHES*/{
"assets/Game assets/hand.webp": "763830b2",
"assets/Story Assets/Map.webp": "4802c0c3",
"assets/Story Assets/rill talking.webp": "e54d3c23",
"assets/audio/CREDITS.md": "fcaccb76",
"assets/audio/music/level1-outer-space.m4a": "95302f92",
"assets/audio/music/level2-space-flight.m4a": "46d0101d",
"assets/audio/music/story-space-overworld.m4a": "a8041d86",
"assets/audio/sfx/alarm.m4a": "e357217d",
"assets/audio/sfx/click.m4a": "db430df8",
"assets/audio/sfx/correct.m4a": "38a89c15",
"assets/audio/sfx/fanfare.m4a": "4f93c6c2",
"assets/audio/sfx/notify.m4a": "7391d66a",
"assets/audio/sfx/swish.m4a": "1f2698c1",
"assets/audio/sfx/whoosh.m4a": "0fb8bcbf",
"assets/cover/control-room.jpg": "1a60f021",
"assets/cover/hangar.jpg": "86778102",
"assets/cover/logo.png": "7f4b42ab",
"assets/cover/logo.webp": "2ee3e05a",
"assets/cover/nova.png": "501e2c27",
"assets/cover/ril.png": "ad1a2626",
"assets/cover/rill-full.png": "ca057a52",
"assets/cover/rill-full.webp": "d39fa1d4",
"assets/cover/start.png": "8c9a017c",
"assets/cover/start.webp": "a1884b17",
"assets/cover/titan-viewport.jpg": "bb72a3ac",
"assets/cover/veth-full.png": "3243a0c1",
"assets/cover/veth-full.webp": "80b5f8d2",
"assets/cover/veth-thumbs-up.webp": "2a1f604f",
"assets/cover/veth.png": "0d77186a",
"assets/fonts/OFL-RobotoCondensed.txt": "61e9f279",
"assets/fonts/OFL.txt": "21f5400b",
"assets/fonts/fredoka-latin.woff2": "9591efe1",
"assets/fonts/roboto-condensed-latin-700.woff2": "89e51a47",
"assets/portraits/rill-face.webp": "dd398af3",
"assets/portraits/rill.webp": "45014212",
"assets/portraits/veth talking.webp": "cd4db22c",
"assets/portraits/veth-face.webp": "c7626113",
"assets/portraits/veth.png": "67716594",
"assets/voice/computer-4e9e00a477.m4a": "5892a789",
"assets/voice/manifest.json": "6c0980ad",
"assets/voice/narrator-0bdef07c7e.m4a": "8d90ace8",
"assets/voice/narrator-253cd616ff.m4a": "a2ab887e",
"assets/voice/narrator-26cec6e19f.m4a": "7d9e5c2c",
"assets/voice/narrator-295bb800fd.m4a": "de7a52ee",
"assets/voice/narrator-3979b3c600.m4a": "bad0abd3",
"assets/voice/narrator-440e987853.m4a": "a82ac1e5",
"assets/voice/narrator-5d95c4d65e.m4a": "fbd8b273",
"assets/voice/narrator-6fbeeef9ca.m4a": "710bbfe6",
"assets/voice/narrator-731666c93e.m4a": "d1ebb75f",
"assets/voice/narrator-7b9a4e5871.m4a": "a3662ce4",
"assets/voice/narrator-8796b54454.m4a": "fbfcde9f",
"assets/voice/narrator-8bffe2e4df.m4a": "758c0f84",
"assets/voice/narrator-9b58707b4e.m4a": "f3ae7671",
"assets/voice/narrator-9d6bfed8b3.m4a": "911eddc8",
"assets/voice/narrator-a4be2fc679.m4a": "538023bf",
"assets/voice/narrator-a932a15ae1.m4a": "c1fe9a23",
"assets/voice/narrator-ad170972e3.m4a": "70783dd0",
"assets/voice/narrator-bc184b499a.m4a": "46bcd479",
"assets/voice/narrator-d2949a4261.m4a": "a8e3a80a",
"assets/voice/narrator-d3e4374555.m4a": "4112610d",
"assets/voice/narrator-d8e4214b5b.m4a": "cff6c038",
"assets/voice/narrator-da2d688ca4.m4a": "2cc2d562",
"assets/voice/narrator-e141613bef.m4a": "3c158f72",
"assets/voice/narrator-e23ea3324b.m4a": "ff09ce97",
"assets/voice/narrator-ea77fe4dc2.m4a": "d0830293",
"assets/voice/narrator-ed39a0ccb2.m4a": "70fda88c",
"assets/voice/narrator-f0f95c19d6.m4a": "efe606bd",
"assets/voice/narrator-fd31cf0d7e.m4a": "6eeb4eba",
"assets/voice/rill-99f4126348.m4a": "e8132e80",
"assets/voice/rill-9f7f63eed8.m4a": "fb53f156",
"assets/voice/rill-b49122b369.m4a": "6e437f3e",
"assets/voice/rill-f17752108f.m4a": "2c0b14c3",
"assets/voice/veth-000feb7b5d.m4a": "3373597a",
"assets/voice/veth-0035b3a65f.m4a": "cd73bd69",
"assets/voice/veth-015e637308.m4a": "6eff90fc",
"assets/voice/veth-032a979993.m4a": "bc605534",
"assets/voice/veth-037a4b616f.m4a": "4ba9f570",
"assets/voice/veth-03fe5e250b.m4a": "6fd8d04c",
"assets/voice/veth-09771b829c.m4a": "2a0b726e",
"assets/voice/veth-0a0cb06b4f.m4a": "9906b007",
"assets/voice/veth-0c82fedb3e.m4a": "dff12872",
"assets/voice/veth-0d301defd0.m4a": "068d2b53",
"assets/voice/veth-0d95854211.m4a": "81959af0",
"assets/voice/veth-11a772fd96.m4a": "86bf5af8",
"assets/voice/veth-14390aae44.m4a": "e8a66dcb",
"assets/voice/veth-1441bf286f.m4a": "a8b6ca27",
"assets/voice/veth-14afd7c063.m4a": "a68cf37f",
"assets/voice/veth-153a259504.m4a": "36e7fd09",
"assets/voice/veth-15567dc44b.m4a": "bb76fca2",
"assets/voice/veth-165833afdd.m4a": "5a9b3371",
"assets/voice/veth-17f262ed65.m4a": "ac30252b",
"assets/voice/veth-18daf742b9.m4a": "85282255",
"assets/voice/veth-1967bb2571.m4a": "c05b4b0b",
"assets/voice/veth-19bd3df543.m4a": "24dff3ce",
"assets/voice/veth-20b2cfaeee.m4a": "51a0d372",
"assets/voice/veth-20e824892c.m4a": "2a182b6e",
"assets/voice/veth-2577cdc3c3.m4a": "b58c1b39",
"assets/voice/veth-26fa9d57af.m4a": "4e2f1fb9",
"assets/voice/veth-2a07b50c37.m4a": "f1246b0e",
"assets/voice/veth-2a689ca399.m4a": "048bcff3",
"assets/voice/veth-2ecb742c94.m4a": "3a472c4f",
"assets/voice/veth-2f959405af.m4a": "877b41e3",
"assets/voice/veth-3402aad186.m4a": "ee0b4b2c",
"assets/voice/veth-3794acd665.m4a": "2d649345",
"assets/voice/veth-387a454b53.m4a": "d1c16a40",
"assets/voice/veth-3953c53616.m4a": "c9b280a1",
"assets/voice/veth-3a9b4d08cf.m4a": "e54fac89",
"assets/voice/veth-3d46eb2258.m4a": "01981630",
"assets/voice/veth-3de17cb57f.m4a": "74b99791",
"assets/voice/veth-426883550c.m4a": "ce3e6733",
"assets/voice/veth-4282da897e.m4a": "289b546e",
"assets/voice/veth-448c4117a3.m4a": "6e10d4ae",
"assets/voice/veth-4535b998ac.m4a": "75ecf0fd",
"assets/voice/veth-46b4e95cf0.m4a": "61e973e4",
"assets/voice/veth-4ab16173ba.m4a": "56446474",
"assets/voice/veth-51b9193ab6.m4a": "a010d674",
"assets/voice/veth-51fc9f5893.m4a": "617c5f58",
"assets/voice/veth-5243b4aa23.m4a": "8919f5ec",
"assets/voice/veth-5287043d43.m4a": "79d18f8f",
"assets/voice/veth-544ea074bf.m4a": "b2d66c20",
"assets/voice/veth-567693f16c.m4a": "3664c507",
"assets/voice/veth-5686a5de50.m4a": "87a26a0c",
"assets/voice/veth-56e188fba7.m4a": "549d57d9",
"assets/voice/veth-5a1fb64cee.m4a": "e14836de",
"assets/voice/veth-5bb5572840.m4a": "8fe19d27",
"assets/voice/veth-5e0d62421a.m4a": "5a07fd18",
"assets/voice/veth-5f2884aff1.m4a": "480885bc",
"assets/voice/veth-618b959fd1.m4a": "7679cfcb",
"assets/voice/veth-636afeb214.m4a": "7a7fc3e0",
"assets/voice/veth-64f6a10171.m4a": "f571a7dd",
"assets/voice/veth-66696a8604.m4a": "1f2a4fc9",
"assets/voice/veth-688b4f3235.m4a": "fa76ab00",
"assets/voice/veth-692bab09fe.m4a": "77af9c1e",
"assets/voice/veth-6c35c064b4.m4a": "99a2ba8c",
"assets/voice/veth-6c391ee378.m4a": "7e98c2e3",
"assets/voice/veth-6fba06ab5c.m4a": "afc117d2",
"assets/voice/veth-7054f8a227.m4a": "ab0a6825",
"assets/voice/veth-712fca2fb5.m4a": "c670ffa5",
"assets/voice/veth-78300ab206.m4a": "02b50b82",
"assets/voice/veth-78b5410ce8.m4a": "1725884c",
"assets/voice/veth-79516f81f4.m4a": "c35f6a4f",
"assets/voice/veth-8476be455f.m4a": "c32d6372",
"assets/voice/veth-859de2a3fb.m4a": "6b0a9ec3",
"assets/voice/veth-86904d7a3f.m4a": "d2ff1de9",
"assets/voice/veth-87675f7d0f.m4a": "7df9f1d8",
"assets/voice/veth-897956303c.m4a": "810b5e07",
"assets/voice/veth-8ae2bd8de7.m4a": "6457dec5",
"assets/voice/veth-8b118d829f.m4a": "b9bd71af",
"assets/voice/veth-8c5931b936.m4a": "e931e58a",
"assets/voice/veth-92f34f38ef.m4a": "9bbe13db",
"assets/voice/veth-93d8caa1bd.m4a": "4bba1adb",
"assets/voice/veth-94dfa3f489.m4a": "dd3cd2dd",
"assets/voice/veth-9540223959.m4a": "ec7240ff",
"assets/voice/veth-9681bdfc07.m4a": "1dea8f2e",
"assets/voice/veth-997b8c33b5.m4a": "94a20a65",
"assets/voice/veth-9b3ccb6e05.m4a": "579aa2e4",
"assets/voice/veth-9cde1447b1.m4a": "9645c62b",
"assets/voice/veth-9d8624c3fd.m4a": "9536a2f3",
"assets/voice/veth-9f02b6773d.m4a": "09116f07",
"assets/voice/veth-a0ff767bc4.m4a": "0a326908",
"assets/voice/veth-a188a53e95.m4a": "67594b1c",
"assets/voice/veth-a32ad6c782.m4a": "c8af9bd0",
"assets/voice/veth-a346bbc315.m4a": "c8dc9a8c",
"assets/voice/veth-a51ad1cbe8.m4a": "0bbfe606",
"assets/voice/veth-a906f70c98.m4a": "cc5275e3",
"assets/voice/veth-a963144d3d.m4a": "eb82df60",
"assets/voice/veth-aa58e9a0aa.m4a": "e45c2ae2",
"assets/voice/veth-aae1c234dd.m4a": "9e9ad123",
"assets/voice/veth-ae4add7c1e.m4a": "6a2ce34f",
"assets/voice/veth-b653d78d81.m4a": "749f9487",
"assets/voice/veth-b6e1cd1c8f.m4a": "a0584b2e",
"assets/voice/veth-b731a8e69d.m4a": "2edcde3b",
"assets/voice/veth-b76c92ff85.m4a": "092023ca",
"assets/voice/veth-b859584ac5.m4a": "79588c4e",
"assets/voice/veth-b8ce38d96d.m4a": "35a896e4",
"assets/voice/veth-b9664b42fc.m4a": "49658801",
"assets/voice/veth-be5ef1f158.m4a": "2a48e594",
"assets/voice/veth-bff5d02d03.m4a": "568737d0",
"assets/voice/veth-c012c41f1f.m4a": "66a022e7",
"assets/voice/veth-c07720e32c.m4a": "2ba0c573",
"assets/voice/veth-c36561ca21.m4a": "eafb5b32",
"assets/voice/veth-c6a624421e.m4a": "89cfe869",
"assets/voice/veth-ce7d38c322.m4a": "ee7a30c9",
"assets/voice/veth-cfeb0c850e.m4a": "bf6edd50",
"assets/voice/veth-d17423821a.m4a": "672324a5",
"assets/voice/veth-d3d19ba5ec.m4a": "b9b2d222",
"assets/voice/veth-d5aa040d11.m4a": "35fec31a",
"assets/voice/veth-d6a2b3f6f8.m4a": "aebfc3b0",
"assets/voice/veth-d82e4df7f8.m4a": "4dc6e4ff",
"assets/voice/veth-da4779726d.m4a": "a96238ae",
"assets/voice/veth-dcb76504f4.m4a": "775f56da",
"assets/voice/veth-e00a96ff04.m4a": "1e2f0927",
"assets/voice/veth-e677e9b34b.m4a": "af3d96a6",
"assets/voice/veth-e6ccd08c7a.m4a": "04b719c9",
"assets/voice/veth-e7f3821ddf.m4a": "f82a99ee",
"assets/voice/veth-e97793e4db.m4a": "5eaccf93",
"assets/voice/veth-eab3d6f129.m4a": "ea33e98f",
"assets/voice/veth-eb02ada8c3.m4a": "0e694bc4",
"assets/voice/veth-ebd13e9a03.m4a": "9890ff64",
"assets/voice/veth-ec03505bb1.m4a": "244cc02e",
"assets/voice/veth-f37c3a3a5a.m4a": "abb536a0",
"assets/voice/veth-f84683b321.m4a": "c50f73dc",
"assets/voice/veth-faddd6061d.m4a": "c1bf694e",
"assets/voice/veth-fce2797ceb.m4a": "f7d9ba71",
"assets/voice/veth-fe6be5e90e.m4a": "87a9b31f",
"assets/voice/veth-fe6d460856.m4a": "4f8d9fa2",
"assets/voice/veth-ff7e56df9e.m4a": "e73c10ba",
"assets/voice/veth-ffdec52568.m4a": "2fc9a17b",
"assets/voice/veth-ffe65a92d4.m4a": "1958cce8",
"locales.json": "1f2215e9"
}/*END*/;
window.VER = function (u) {
  var k = String(u || '');
  try { k = decodeURI(k); } catch (e) {}
  k = k.replace(/^\.\//, '').split('#')[0];
  var v = ASSET_HASH[k];
  return v && String(u).indexOf('?') < 0 ? u + '?v=' + v : u;
};

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
    return b || VER(enc(String(u)));
  };
  /* and back again, for an element whose blob failed */
  window.ASSET.original = function (blobUrl) { return origOf[blobUrl] ? VER(enc(origOf[blobUrl])) : null; };

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
    fetch(VER(encodeURI(p)), ctl ? { signal: ctl.signal } : {}).then(function (res) {
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
