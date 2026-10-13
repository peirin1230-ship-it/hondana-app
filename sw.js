/* 入れ物のファイルを手元に置いておき、電波がないときでもアプリをひらけるようにする。
   つながるときは、いつも新しいほうを使う。本のデータ（hondana から読んだ HTML）は shell.js が別に持つ。 */
const CACHE = 'hondana-app-shell-v2';
const FILES = [
  './', './index.html', './shell.js', './shell.css',
  './quiz/', './quiz/index.html', './quiz/manifest.webmanifest', './quiz/icon-180.png', './quiz/icon-192.png', './quiz/icon.svg',
  './shelf/', './shelf/index.html', './shelf/manifest.webmanifest', './shelf/icon-180.png', './shelf/icon-192.png', './shelf/icon.svg',
  './kotoba/', './kotoba/index.html', './kotoba/manifest.webmanifest', './kotoba/icon-180.png', './kotoba/icon-192.png', './kotoba/icon.svg',
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('hondana-app-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // GitHub API とフォントはそのまま
  event.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match(new URL('./index.html', self.registration.scope).href))));
});
