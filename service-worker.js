const CACHE_NAME = 'blue-haven-cache-v2';

// Aset statis yang aman di-cache (tidak berubah tiap request, tidak mengandung data pribadi)
const STATIC_ASSETS = [
  'assets/style.css',
  'assets/app.js',
  'assets/growth-data.js',
  'assets/growth-who-lms.js',
  'assets/growth-assess.js',
  'assets/growth-chart.js',
  'assets/logo.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan pernah cache panggilan API (data reservasi/loyalitas harus selalu terbaru)
  if (url.pathname.includes('/api/')) {
    return; // biarkan lewat ke jaringan seperti biasa
  }

  // Halaman .php (index.php, admin.php): coba jaringan dulu, baru fallback ke cache kalau offline
  if (url.pathname.endsWith('.php') || url.pathname === '/' ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset statis (css/js/gambar): pakai cache dulu kalau ada, biar cepat, sambil tetap cek jaringan
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
