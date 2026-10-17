/* Service worker — makes the site work offline.
   - index.html: network-first (so updates show up as soon as you're online), falls back to the cached copy offline.
   - fonts / icons / lecture_pages_*.js / other same-origin files: stale-while-revalidate.
   - Drive / YouTube links are NOT cached (they need internet).
   Bump CACHE_VERSION if you ever want to force everyone's cache to reset. */
const CACHE_VERSION = 'v1';
const CORE = 'aboukir-core-' + CACHE_VERSION;
const RUNTIME = 'aboukir-runtime-' + CACHE_VERSION;
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'apple-touch-icon.png',
  'lecture_pages_c1.js',
  'lecture_pages_c2.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    // add one by one so a missing optional file doesn't break the whole install
    await Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([CORE, RUNTIME]);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('aboukir-') && !keep.has(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

async function networkFirstPage(request){
  const cache = await caches.open(CORE);
  try{
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if(res && res.ok){ cache.put('index.html', res.clone()); }
    return res;
  }catch(e){
    const cached = await cache.match('index.html', { ignoreSearch: true }) || await cache.match('./', { ignoreSearch: true });
    if(cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request){
  const cache = await caches.open(RUNTIME);
  const core = await caches.open(CORE);
  const cached = await core.match(request, { ignoreSearch: true }) || await cache.match(request);
  const network = fetch(request).then(res => {
    if(res && (res.ok || res.type === 'opaque')){ cache.put(request, res.clone()); }
    return res;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(req.mode === 'navigate'){
    event.respondWith(networkFirstPage(req));
    return;
  }
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if(url.origin === self.location.origin || isFont){
    event.respondWith(staleWhileRevalidate(req));
  }
  // everything else (Drive, YouTube, thumbnails...) goes straight to the network
});
