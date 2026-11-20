/* ==========================================================================
   PRELOAD.JS — everything the game will ever load is fetched here, behind the
   loading bar on the start screen, before START can be pressed.

   FORMATS (20 Nov 2026, tools/convert_media.py). Pictures are WebP; every
   sound — voice lines, music, effects — is Ogg (Opus). Supported by Chrome,
   Edge and Firefox, and by Safari 14+ for WebP and Safari 18.4+ (iOS 18.4+)
   for Ogg Opus.

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
   - START WAITS FOR EVERYTHING (20 Nov 2026; it used to wait only for a
     "playable" part, QA Bug 30, when the game was 15 MB — it is about 7 MB
     now). The cover comes up as soon as its own pictures are in, with a
     loading bar where START will be; START pops in at 100%.
   - NOTHING HERE CAN BLOCK THE GAME. A failed, stalled (no bytes on any
     transfer for STALL_MS, or past its own size-based cap) or aborted transfer, or file:// where fetch is not allowed,
     simply counts as done, and that element keeps its normal file URL.
   ========================================================================== */
var ASSET_SIZES = /*SIZES*/{
 "assets/Game assets/hand.webp": 14440,
 "assets/Story Assets/Map.webp": 221066,
 "assets/audio/music/level1-outer-space.ogg": 917868,
 "assets/audio/music/level2-space-flight.ogg": 417321,
 "assets/audio/music/story-space-overworld.ogg": 630910,
 "assets/audio/sfx/alarm.ogg": 14026,
 "assets/audio/sfx/click.ogg": 1735,
 "assets/audio/sfx/correct.ogg": 8995,
 "assets/audio/sfx/fanfare.ogg": 53674,
 "assets/audio/sfx/notify.ogg": 10441,
 "assets/audio/sfx/swish.ogg": 2376,
 "assets/audio/sfx/whoosh.ogg": 2182,
 "assets/cover/control-room.webp": 122918,
 "assets/cover/hangar.webp": 125602,
 "assets/cover/logo.webp": 153644,
 "assets/cover/rill-full.webp": 65120,
 "assets/cover/start.webp": 154690,
 "assets/cover/veth-full.webp": 85034,
 "assets/cover/veth-thumbs-up.webp": 1624736,
 "assets/portraits/rill-face.webp": 369312,
 "assets/portraits/veth-face.webp": 428576,
 "assets/voice/computer-4e9e00a477.ogg": 6902,
 "assets/voice/narrator-0bdef07c7e.ogg": 29592,
 "assets/voice/narrator-253cd616ff.ogg": 19535,
 "assets/voice/narrator-26cec6e19f.ogg": 45538,
 "assets/voice/narrator-295bb800fd.ogg": 34169,
 "assets/voice/narrator-3979b3c600.ogg": 27686,
 "assets/voice/narrator-440e987853.ogg": 42663,
 "assets/voice/narrator-5d95c4d65e.ogg": 26376,
 "assets/voice/narrator-6fbeeef9ca.ogg": 24279,
 "assets/voice/narrator-731666c93e.ogg": 42949,
 "assets/voice/narrator-7b9a4e5871.ogg": 17425,
 "assets/voice/narrator-8796b54454.ogg": 40795,
 "assets/voice/narrator-8bffe2e4df.ogg": 17413,
 "assets/voice/narrator-9b58707b4e.ogg": 28658,
 "assets/voice/narrator-9d6bfed8b3.ogg": 26018,
 "assets/voice/narrator-a4be2fc679.ogg": 17679,
 "assets/voice/narrator-a932a15ae1.ogg": 24051,
 "assets/voice/narrator-ad170972e3.ogg": 24479,
 "assets/voice/narrator-bc184b499a.ogg": 25619,
 "assets/voice/narrator-d2949a4261.ogg": 24308,
 "assets/voice/narrator-d3e4374555.ogg": 24303,
 "assets/voice/narrator-d8e4214b5b.ogg": 28211,
 "assets/voice/narrator-da2d688ca4.ogg": 25945,
 "assets/voice/narrator-e141613bef.ogg": 41016,
 "assets/voice/narrator-e23ea3324b.ogg": 39568,
 "assets/voice/narrator-ea77fe4dc2.ogg": 26694,
 "assets/voice/narrator-ed39a0ccb2.ogg": 42650,
 "assets/voice/narrator-f0f95c19d6.ogg": 41673,
 "assets/voice/narrator-fd31cf0d7e.ogg": 25263,
 "assets/voice/rill-99f4126348.ogg": 14844,
 "assets/voice/rill-9f7f63eed8.ogg": 14352,
 "assets/voice/rill-b49122b369.ogg": 17144,
 "assets/voice/rill-f17752108f.ogg": 18308,
 "assets/voice/veth-000feb7b5d.ogg": 24159,
 "assets/voice/veth-0035b3a65f.ogg": 28876,
 "assets/voice/veth-015e637308.ogg": 16804,
 "assets/voice/veth-032a979993.ogg": 14658,
 "assets/voice/veth-037a4b616f.ogg": 15356,
 "assets/voice/veth-03fe5e250b.ogg": 34494,
 "assets/voice/veth-09771b829c.ogg": 33247,
 "assets/voice/veth-0a0cb06b4f.ogg": 37127,
 "assets/voice/veth-0c82fedb3e.ogg": 18787,
 "assets/voice/veth-0d301defd0.ogg": 47814,
 "assets/voice/veth-0d95854211.ogg": 22509,
 "assets/voice/veth-11a772fd96.ogg": 41251,
 "assets/voice/veth-14390aae44.ogg": 30338,
 "assets/voice/veth-1441bf286f.ogg": 43045,
 "assets/voice/veth-14afd7c063.ogg": 14885,
 "assets/voice/veth-153a259504.ogg": 33378,
 "assets/voice/veth-15567dc44b.ogg": 14335,
 "assets/voice/veth-165833afdd.ogg": 19585,
 "assets/voice/veth-17f262ed65.ogg": 13743,
 "assets/voice/veth-18daf742b9.ogg": 36736,
 "assets/voice/veth-1967bb2571.ogg": 43131,
 "assets/voice/veth-19bd3df543.ogg": 38129,
 "assets/voice/veth-20b2cfaeee.ogg": 24496,
 "assets/voice/veth-20e824892c.ogg": 25086,
 "assets/voice/veth-2577cdc3c3.ogg": 35463,
 "assets/voice/veth-26fa9d57af.ogg": 44382,
 "assets/voice/veth-2a07b50c37.ogg": 13053,
 "assets/voice/veth-2a689ca399.ogg": 46372,
 "assets/voice/veth-2ecb742c94.ogg": 17524,
 "assets/voice/veth-2f959405af.ogg": 26321,
 "assets/voice/veth-3402aad186.ogg": 36210,
 "assets/voice/veth-3794acd665.ogg": 18013,
 "assets/voice/veth-387a454b53.ogg": 25736,
 "assets/voice/veth-3953c53616.ogg": 38994,
 "assets/voice/veth-3a9b4d08cf.ogg": 12913,
 "assets/voice/veth-3d46eb2258.ogg": 23778,
 "assets/voice/veth-3de17cb57f.ogg": 39076,
 "assets/voice/veth-426883550c.ogg": 46436,
 "assets/voice/veth-4282da897e.ogg": 35226,
 "assets/voice/veth-448c4117a3.ogg": 20084,
 "assets/voice/veth-4535b998ac.ogg": 37583,
 "assets/voice/veth-46b4e95cf0.ogg": 26152,
 "assets/voice/veth-4ab16173ba.ogg": 17119,
 "assets/voice/veth-51b9193ab6.ogg": 16939,
 "assets/voice/veth-51fc9f5893.ogg": 15729,
 "assets/voice/veth-5243b4aa23.ogg": 33142,
 "assets/voice/veth-5287043d43.ogg": 17862,
 "assets/voice/veth-544ea074bf.ogg": 33824,
 "assets/voice/veth-567693f16c.ogg": 28477,
 "assets/voice/veth-5686a5de50.ogg": 12760,
 "assets/voice/veth-56e188fba7.ogg": 37467,
 "assets/voice/veth-5a1fb64cee.ogg": 31104,
 "assets/voice/veth-5bb5572840.ogg": 27197,
 "assets/voice/veth-5e0d62421a.ogg": 25762,
 "assets/voice/veth-5f2884aff1.ogg": 36756,
 "assets/voice/veth-618b959fd1.ogg": 39756,
 "assets/voice/veth-636afeb214.ogg": 13155,
 "assets/voice/veth-64f6a10171.ogg": 40268,
 "assets/voice/veth-66696a8604.ogg": 13716,
 "assets/voice/veth-688b4f3235.ogg": 19693,
 "assets/voice/veth-692bab09fe.ogg": 44280,
 "assets/voice/veth-6c35c064b4.ogg": 21368,
 "assets/voice/veth-6c391ee378.ogg": 12795,
 "assets/voice/veth-6fba06ab5c.ogg": 30224,
 "assets/voice/veth-7054f8a227.ogg": 34945,
 "assets/voice/veth-712fca2fb5.ogg": 44924,
 "assets/voice/veth-78300ab206.ogg": 29765,
 "assets/voice/veth-78b5410ce8.ogg": 19154,
 "assets/voice/veth-79516f81f4.ogg": 31383,
 "assets/voice/veth-8476be455f.ogg": 26385,
 "assets/voice/veth-859de2a3fb.ogg": 16809,
 "assets/voice/veth-86904d7a3f.ogg": 47090,
 "assets/voice/veth-87675f7d0f.ogg": 20802,
 "assets/voice/veth-897956303c.ogg": 44513,
 "assets/voice/veth-8ae2bd8de7.ogg": 37231,
 "assets/voice/veth-8b118d829f.ogg": 36246,
 "assets/voice/veth-8c5931b936.ogg": 16619,
 "assets/voice/veth-92f34f38ef.ogg": 35881,
 "assets/voice/veth-93d8caa1bd.ogg": 17312,
 "assets/voice/veth-94dfa3f489.ogg": 33055,
 "assets/voice/veth-9540223959.ogg": 28540,
 "assets/voice/veth-9681bdfc07.ogg": 18513,
 "assets/voice/veth-997b8c33b5.ogg": 20407,
 "assets/voice/veth-9b3ccb6e05.ogg": 18964,
 "assets/voice/veth-9cde1447b1.ogg": 33217,
 "assets/voice/veth-9d8624c3fd.ogg": 35922,
 "assets/voice/veth-9f02b6773d.ogg": 23625,
 "assets/voice/veth-a0ff767bc4.ogg": 32423,
 "assets/voice/veth-a188a53e95.ogg": 31406,
 "assets/voice/veth-a32ad6c782.ogg": 21438,
 "assets/voice/veth-a346bbc315.ogg": 25063,
 "assets/voice/veth-a51ad1cbe8.ogg": 14085,
 "assets/voice/veth-a906f70c98.ogg": 22536,
 "assets/voice/veth-a963144d3d.ogg": 45105,
 "assets/voice/veth-aa58e9a0aa.ogg": 30922,
 "assets/voice/veth-aae1c234dd.ogg": 12717,
 "assets/voice/veth-ae4add7c1e.ogg": 39268,
 "assets/voice/veth-b653d78d81.ogg": 13052,
 "assets/voice/veth-b6e1cd1c8f.ogg": 34080,
 "assets/voice/veth-b731a8e69d.ogg": 40424,
 "assets/voice/veth-b76c92ff85.ogg": 30286,
 "assets/voice/veth-b859584ac5.ogg": 23224,
 "assets/voice/veth-b8ce38d96d.ogg": 28885,
 "assets/voice/veth-b9664b42fc.ogg": 46560,
 "assets/voice/veth-be5ef1f158.ogg": 22246,
 "assets/voice/veth-bff5d02d03.ogg": 32357,
 "assets/voice/veth-c012c41f1f.ogg": 35600,
 "assets/voice/veth-c07720e32c.ogg": 27218,
 "assets/voice/veth-c36561ca21.ogg": 23433,
 "assets/voice/veth-c6a624421e.ogg": 30880,
 "assets/voice/veth-ce7d38c322.ogg": 13114,
 "assets/voice/veth-cfeb0c850e.ogg": 31756,
 "assets/voice/veth-d17423821a.ogg": 26169,
 "assets/voice/veth-d3d19ba5ec.ogg": 37719,
 "assets/voice/veth-d5aa040d11.ogg": 20064,
 "assets/voice/veth-d6a2b3f6f8.ogg": 41455,
 "assets/voice/veth-d82e4df7f8.ogg": 21845,
 "assets/voice/veth-da4779726d.ogg": 13175,
 "assets/voice/veth-dcb76504f4.ogg": 35196,
 "assets/voice/veth-e00a96ff04.ogg": 39384,
 "assets/voice/veth-e677e9b34b.ogg": 35872,
 "assets/voice/veth-e6ccd08c7a.ogg": 33153,
 "assets/voice/veth-e7f3821ddf.ogg": 22083,
 "assets/voice/veth-e97793e4db.ogg": 21682,
 "assets/voice/veth-eab3d6f129.ogg": 13421,
 "assets/voice/veth-eb02ada8c3.ogg": 36913,
 "assets/voice/veth-ebd13e9a03.ogg": 36091,
 "assets/voice/veth-ec03505bb1.ogg": 40450,
 "assets/voice/veth-f37c3a3a5a.ogg": 9700,
 "assets/voice/veth-f84683b321.ogg": 16976,
 "assets/voice/veth-faddd6061d.ogg": 45838,
 "assets/voice/veth-fce2797ceb.ogg": 36008,
 "assets/voice/veth-fe6be5e90e.ogg": 33848,
 "assets/voice/veth-fe6d460856.ogg": 31914,
 "assets/voice/veth-ff7e56df9e.ogg": 22327,
 "assets/voice/veth-ffdec52568.ogg": 15747,
 "assets/voice/veth-ffe65a92d4.ogg": 33580
}/*END*/;
/* 20 Nov 2026: every file's content fingerprint, written by
   tools/stamp_build.py — a file's URL carries it (?v=…), so a browser that
   kept an older copy (a normal window; incognito keeps nothing) fetches the
   new one. Unlisted files load without one. */
var ASSET_HASH = /*HASHES*/{
"assets/Game assets/hand.webp": "763830b2",
"assets/Story Assets/Map.webp": "4802c0c3",
"assets/audio/CREDITS.md": "fcaccb76",
"assets/audio/music/level1-outer-space.ogg": "e8d9d2c8",
"assets/audio/music/level2-space-flight.ogg": "ec219ce1",
"assets/audio/music/story-space-overworld.ogg": "a10a94eb",
"assets/audio/sfx/alarm.ogg": "74c090b3",
"assets/audio/sfx/click.ogg": "55ca6954",
"assets/audio/sfx/correct.ogg": "9a07693c",
"assets/audio/sfx/fanfare.ogg": "8d4e4cac",
"assets/audio/sfx/notify.ogg": "3ff3f8cc",
"assets/audio/sfx/swish.ogg": "685a91ad",
"assets/audio/sfx/whoosh.ogg": "33faf5d0",
"assets/cover/control-room.webp": "326feaa4",
"assets/cover/hangar.webp": "01aa34e4",
"assets/cover/logo.webp": "2ee3e05a",
"assets/cover/rill-full.webp": "d39fa1d4",
"assets/cover/start.webp": "a1884b17",
"assets/cover/veth-full.webp": "80b5f8d2",
"assets/cover/veth-thumbs-up.webp": "2a1f604f",
"assets/portraits/rill-face.webp": "dd398af3",
"assets/portraits/veth-face.webp": "c7626113",
"assets/voice/computer-4e9e00a477.ogg": "ae7dc76c",
"assets/voice/manifest.json": "c9434279",
"assets/voice/narrator-0bdef07c7e.ogg": "d19197b7",
"assets/voice/narrator-253cd616ff.ogg": "e7496800",
"assets/voice/narrator-26cec6e19f.ogg": "42f9a0cf",
"assets/voice/narrator-295bb800fd.ogg": "33d4efd1",
"assets/voice/narrator-3979b3c600.ogg": "f1fae77e",
"assets/voice/narrator-440e987853.ogg": "ead48f01",
"assets/voice/narrator-5d95c4d65e.ogg": "b32a8491",
"assets/voice/narrator-6fbeeef9ca.ogg": "739f978a",
"assets/voice/narrator-731666c93e.ogg": "d1471671",
"assets/voice/narrator-7b9a4e5871.ogg": "66d29155",
"assets/voice/narrator-8796b54454.ogg": "9137e472",
"assets/voice/narrator-8bffe2e4df.ogg": "35fba998",
"assets/voice/narrator-9b58707b4e.ogg": "5dffe14e",
"assets/voice/narrator-9d6bfed8b3.ogg": "f6d42695",
"assets/voice/narrator-a4be2fc679.ogg": "69c2fda3",
"assets/voice/narrator-a932a15ae1.ogg": "22b47873",
"assets/voice/narrator-ad170972e3.ogg": "1a8dd556",
"assets/voice/narrator-bc184b499a.ogg": "1c714313",
"assets/voice/narrator-d2949a4261.ogg": "6ceea173",
"assets/voice/narrator-d3e4374555.ogg": "b53caa07",
"assets/voice/narrator-d8e4214b5b.ogg": "4e5da51e",
"assets/voice/narrator-da2d688ca4.ogg": "ff6b1e95",
"assets/voice/narrator-e141613bef.ogg": "aa8f74da",
"assets/voice/narrator-e23ea3324b.ogg": "ac846280",
"assets/voice/narrator-ea77fe4dc2.ogg": "2f2d301f",
"assets/voice/narrator-ed39a0ccb2.ogg": "6e075dd1",
"assets/voice/narrator-f0f95c19d6.ogg": "78006632",
"assets/voice/narrator-fd31cf0d7e.ogg": "4ae5a641",
"assets/voice/rill-99f4126348.ogg": "633388c4",
"assets/voice/rill-9f7f63eed8.ogg": "350aa0d8",
"assets/voice/rill-b49122b369.ogg": "e48e33ba",
"assets/voice/rill-f17752108f.ogg": "eedfa644",
"assets/voice/veth-000feb7b5d.ogg": "61b39217",
"assets/voice/veth-0035b3a65f.ogg": "7b238d7b",
"assets/voice/veth-015e637308.ogg": "83cfce39",
"assets/voice/veth-032a979993.ogg": "10ec9475",
"assets/voice/veth-037a4b616f.ogg": "5ca8268a",
"assets/voice/veth-03fe5e250b.ogg": "97321e07",
"assets/voice/veth-09771b829c.ogg": "1a23083b",
"assets/voice/veth-0a0cb06b4f.ogg": "2e9534c7",
"assets/voice/veth-0c82fedb3e.ogg": "e5ca2040",
"assets/voice/veth-0d301defd0.ogg": "98f0b966",
"assets/voice/veth-0d95854211.ogg": "058f2667",
"assets/voice/veth-11a772fd96.ogg": "4605f550",
"assets/voice/veth-14390aae44.ogg": "43d646f1",
"assets/voice/veth-1441bf286f.ogg": "cdebcb5a",
"assets/voice/veth-14afd7c063.ogg": "ee015d1e",
"assets/voice/veth-153a259504.ogg": "9b2fd8ae",
"assets/voice/veth-15567dc44b.ogg": "9ed5175d",
"assets/voice/veth-165833afdd.ogg": "13d327fb",
"assets/voice/veth-17f262ed65.ogg": "b1da410e",
"assets/voice/veth-18daf742b9.ogg": "cea27a68",
"assets/voice/veth-1967bb2571.ogg": "dda62f41",
"assets/voice/veth-19bd3df543.ogg": "67b5b889",
"assets/voice/veth-20b2cfaeee.ogg": "e226bdfc",
"assets/voice/veth-20e824892c.ogg": "2a66a5c8",
"assets/voice/veth-2577cdc3c3.ogg": "6b878125",
"assets/voice/veth-26fa9d57af.ogg": "f079996c",
"assets/voice/veth-2a07b50c37.ogg": "01969e68",
"assets/voice/veth-2a689ca399.ogg": "9d4ddae1",
"assets/voice/veth-2ecb742c94.ogg": "59a6c562",
"assets/voice/veth-2f959405af.ogg": "cea98264",
"assets/voice/veth-3402aad186.ogg": "f171ffe3",
"assets/voice/veth-3794acd665.ogg": "ba8d7883",
"assets/voice/veth-387a454b53.ogg": "614a7989",
"assets/voice/veth-3953c53616.ogg": "12e28608",
"assets/voice/veth-3a9b4d08cf.ogg": "403903c2",
"assets/voice/veth-3d46eb2258.ogg": "a8e9f5d4",
"assets/voice/veth-3de17cb57f.ogg": "4db0485f",
"assets/voice/veth-426883550c.ogg": "ee5fbaf1",
"assets/voice/veth-4282da897e.ogg": "77ead81c",
"assets/voice/veth-448c4117a3.ogg": "dc4646df",
"assets/voice/veth-4535b998ac.ogg": "6f5b8de7",
"assets/voice/veth-46b4e95cf0.ogg": "c70f728f",
"assets/voice/veth-4ab16173ba.ogg": "4dec2d02",
"assets/voice/veth-51b9193ab6.ogg": "3c181a31",
"assets/voice/veth-51fc9f5893.ogg": "d1a84bb0",
"assets/voice/veth-5243b4aa23.ogg": "e270cb28",
"assets/voice/veth-5287043d43.ogg": "e75b9fd1",
"assets/voice/veth-544ea074bf.ogg": "52fb8486",
"assets/voice/veth-567693f16c.ogg": "5eb95b27",
"assets/voice/veth-5686a5de50.ogg": "e3a615b6",
"assets/voice/veth-56e188fba7.ogg": "b6185917",
"assets/voice/veth-5a1fb64cee.ogg": "f6c19367",
"assets/voice/veth-5bb5572840.ogg": "c3ef7b76",
"assets/voice/veth-5e0d62421a.ogg": "9d372b18",
"assets/voice/veth-5f2884aff1.ogg": "49e71505",
"assets/voice/veth-618b959fd1.ogg": "406dd3bf",
"assets/voice/veth-636afeb214.ogg": "42ad1f5c",
"assets/voice/veth-64f6a10171.ogg": "78be9834",
"assets/voice/veth-66696a8604.ogg": "c39bfefa",
"assets/voice/veth-688b4f3235.ogg": "da6d53e4",
"assets/voice/veth-692bab09fe.ogg": "28a91279",
"assets/voice/veth-6c35c064b4.ogg": "297a6c01",
"assets/voice/veth-6c391ee378.ogg": "2a86f34d",
"assets/voice/veth-6fba06ab5c.ogg": "9298b3b8",
"assets/voice/veth-7054f8a227.ogg": "f00eeaf8",
"assets/voice/veth-712fca2fb5.ogg": "664a55b5",
"assets/voice/veth-78300ab206.ogg": "ec978b04",
"assets/voice/veth-78b5410ce8.ogg": "98b39214",
"assets/voice/veth-79516f81f4.ogg": "a857e2fd",
"assets/voice/veth-8476be455f.ogg": "223d4919",
"assets/voice/veth-859de2a3fb.ogg": "1cd76bda",
"assets/voice/veth-86904d7a3f.ogg": "60527569",
"assets/voice/veth-87675f7d0f.ogg": "f17f0df0",
"assets/voice/veth-897956303c.ogg": "a0a10d87",
"assets/voice/veth-8ae2bd8de7.ogg": "b6e4b351",
"assets/voice/veth-8b118d829f.ogg": "feac34a4",
"assets/voice/veth-8c5931b936.ogg": "0304c17a",
"assets/voice/veth-92f34f38ef.ogg": "681d1a96",
"assets/voice/veth-93d8caa1bd.ogg": "a9cb359a",
"assets/voice/veth-94dfa3f489.ogg": "f3436020",
"assets/voice/veth-9540223959.ogg": "8b4f0e9b",
"assets/voice/veth-9681bdfc07.ogg": "c509d6e2",
"assets/voice/veth-997b8c33b5.ogg": "79bf6e04",
"assets/voice/veth-9b3ccb6e05.ogg": "664a3290",
"assets/voice/veth-9cde1447b1.ogg": "27647afa",
"assets/voice/veth-9d8624c3fd.ogg": "f4249bb9",
"assets/voice/veth-9f02b6773d.ogg": "3d67151a",
"assets/voice/veth-a0ff767bc4.ogg": "b370b133",
"assets/voice/veth-a188a53e95.ogg": "e7de17ed",
"assets/voice/veth-a32ad6c782.ogg": "601abf06",
"assets/voice/veth-a346bbc315.ogg": "2a13bc06",
"assets/voice/veth-a51ad1cbe8.ogg": "861fd91e",
"assets/voice/veth-a906f70c98.ogg": "8116874c",
"assets/voice/veth-a963144d3d.ogg": "de85a68f",
"assets/voice/veth-aa58e9a0aa.ogg": "fdf9c5c8",
"assets/voice/veth-aae1c234dd.ogg": "94bdf19a",
"assets/voice/veth-ae4add7c1e.ogg": "3ee5f738",
"assets/voice/veth-b653d78d81.ogg": "c46f4fbf",
"assets/voice/veth-b6e1cd1c8f.ogg": "93bb5754",
"assets/voice/veth-b731a8e69d.ogg": "fb5d1b5e",
"assets/voice/veth-b76c92ff85.ogg": "7ab7aea7",
"assets/voice/veth-b859584ac5.ogg": "06d2bb93",
"assets/voice/veth-b8ce38d96d.ogg": "651aa9e2",
"assets/voice/veth-b9664b42fc.ogg": "dac4bb17",
"assets/voice/veth-be5ef1f158.ogg": "2d29b958",
"assets/voice/veth-bff5d02d03.ogg": "c7ec5b36",
"assets/voice/veth-c012c41f1f.ogg": "4a1c6d25",
"assets/voice/veth-c07720e32c.ogg": "d8975ab3",
"assets/voice/veth-c36561ca21.ogg": "e1f43281",
"assets/voice/veth-c6a624421e.ogg": "583eff9a",
"assets/voice/veth-ce7d38c322.ogg": "61ea2109",
"assets/voice/veth-cfeb0c850e.ogg": "1516d6d7",
"assets/voice/veth-d17423821a.ogg": "e0da4e38",
"assets/voice/veth-d3d19ba5ec.ogg": "8e8c8ba2",
"assets/voice/veth-d5aa040d11.ogg": "3fd485d8",
"assets/voice/veth-d6a2b3f6f8.ogg": "9ae6676f",
"assets/voice/veth-d82e4df7f8.ogg": "163de9a8",
"assets/voice/veth-da4779726d.ogg": "a5ca85c4",
"assets/voice/veth-dcb76504f4.ogg": "7ceaf325",
"assets/voice/veth-e00a96ff04.ogg": "3d4263c7",
"assets/voice/veth-e677e9b34b.ogg": "27e52379",
"assets/voice/veth-e6ccd08c7a.ogg": "96d05576",
"assets/voice/veth-e7f3821ddf.ogg": "f01a7187",
"assets/voice/veth-e97793e4db.ogg": "900158d0",
"assets/voice/veth-eab3d6f129.ogg": "c5e85320",
"assets/voice/veth-eb02ada8c3.ogg": "be406b37",
"assets/voice/veth-ebd13e9a03.ogg": "bfb0acf0",
"assets/voice/veth-ec03505bb1.ogg": "723b6ff7",
"assets/voice/veth-f37c3a3a5a.ogg": "f6631f6e",
"assets/voice/veth-f84683b321.ogg": "9a2b941e",
"assets/voice/veth-faddd6061d.ogg": "4b4f3c23",
"assets/voice/veth-fce2797ceb.ogg": "b3ef9e6d",
"assets/voice/veth-fe6be5e90e.ogg": "c1e7c418",
"assets/voice/veth-fe6d460856.ogg": "bf8208c9",
"assets/voice/veth-ff7e56df9e.ogg": "ba017676",
"assets/voice/veth-ffdec52568.ogg": "cf3799dc",
"assets/voice/veth-ffe65a92d4.ogg": "510f9565",
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
  /* 20 Nov 2026: THE COVER'S OWN PICTURES FIRST — it is what stands on
     screen (with the loading bar in START's place) while the rest arrives */
  var FIRST = [
    'assets/cover/hangar.webp', 'assets/cover/logo.webp', 'assets/cover/start.webp',
    'assets/cover/rill-full.webp', 'assets/cover/veth-full.webp'
  ];
  /* 20 Nov 2026: START WAITS FOR EVERYTHING (the cover shows a bar until
     100%), so "playable" is every file — kept as its own name for the
     screens that ask for it */
  function isPlayable() { return true; }
  /* played last, and big: they go to the back of the queue */
  var LAST = [];

  var blobs = {}, origOf = {};          // file path -> blob URL, blob URL -> file path
  /* 20 Nov 2026: per-file waits, so a screen that needs one file before the
     whole bar is done uses the preloader's copy instead of fetching it again */
  var settledSet = {}, fileWaiters = {};
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
     and a video or sound that was meant to be playing carries on from there.
     Returns true when it reverted (the caller should not give up yet). */
  function revert(el) {
    if (!el || !el.src || el.src.indexOf('blob:') !== 0 || el.__reverted) return false;
    var orig = window.ASSET.original(el.src);
    if (!orig) return false;
    el.__reverted = true;
    var media = el.tagName === 'VIDEO' || el.tagName === 'AUDIO';
    var wasPlaying = media && (!el.paused || el.autoplay || el.__wantPlay) && !(window.PAUSE && PAUSE.paused());
    var at = el.currentTime || 0;
    el.src = orig;
    if (media) {
      try { el.currentTime = at; } catch (x) {}
      if (wasPlaying) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
    }
    return true;
  }
  document.addEventListener('error', function (e) { revert(e.target); }, true);
  /* 20 Nov 2026: a sound made with new Audio() is never in the page, so its
     error never reaches the listener above — the game guards each one */
  window.ASSET.guard = function (el, onFail) {
    el.addEventListener('error', function () { if (!revert(el) && onFail) onFail(); });
    return el;
  };

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
    progress: function () { return pShown; },
    /* one file: fn once the preloader has it (or gave up on it, or does not
       list it) — then ASSET(path) is the local copy when there is one */
    whenFile: function (u, fn) {
      var k = key(u);
      if (done || settledSet[k] || ASSET_SIZES[k] == null) return fn();
      (fileWaiters[k] = fileWaiters[k] || []).push(fn);
    },
    hasFile: function (u) { var k = key(u); return done || !!settledSet[k] || ASSET_SIZES[k] == null; }
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
    Object.keys(fileWaiters).forEach(function (k) {
      var fw = fileWaiters[k]; delete fileWaiters[k];
      fw.forEach(function (fn) { try { fn(); } catch (e) {} });
    });
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
  /* the cover first, then everything else SMALLEST FIRST (five at a time):
     pictures, effects and lines land in the first seconds and are never
     starved behind the music; anything named in LAST goes at the very end */
  var queue = Object.keys(firstSet)
    .concat(list.filter(function (p) { return !firstSet[p] && LAST.indexOf(p) < 0; }).sort(bySize))
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
    settledSet[p] = 1;
    var fw = fileWaiters[p]; delete fileWaiters[p];
    if (fw) fw.forEach(function (fn) { try { fn(); } catch (e) {} });
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
