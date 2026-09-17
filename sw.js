const CACHE = 'english-travel-prep-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './src/styles.css', './src/app.js',
  './src/data/scenarios.js', './src/domain/evaluateAnswer.js', './src/domain/practiceMachine.js',
  './src/storage/learningStore.js', './src/speech/browserSpeech.js',
  './public/icon-192.png', './public/icon-512.png'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match(new URL('./index.html', self.registration.scope).href))));
});
