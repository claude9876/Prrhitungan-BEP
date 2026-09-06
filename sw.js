/* ==========================================================================
   SERVICE WORKER — Kalkulator ROAS Marketplace
   ==========================================================================
   SATU-SATUNYA langkah manual yang perlu kamu lakukan setiap kali deploy
   perubahan baru (edit index.html, ganti logo, dsb) adalah menaikkan
   angka CACHE_VERSION di bawah ini, misal 'v1' -> 'v2' -> 'v3', dst.

   Begitu angka ini berubah:
   1. Browser mendeteksi file sw.js berubah (byte-nya beda) lalu otomatis
      mengunduh & memasang service worker baru.
   2. Cache versi lama otomatis DIHAPUS SENDIRI (lihat bagian 'activate').
   3. Tab yang sedang terbuka otomatis di-reload SEKALI oleh script di
      index.html supaya user langsung lihat versi terbaru.

   User TIDAK PERNAH perlu membuka Chrome > Settings > Clear Cache secara
   manual. Semuanya berjalan otomatis di background.
   ========================================================================== */

const CACHE_VERSION = 'v4'; // <-- ubah angka ini tiap kali deploy versi baru
const CACHE_NAME = `roas-calculator-${CACHE_VERSION}`;

// ------------------------------------------------------------------------
// INSTALL
// Tidak melakukan precache daftar file (cache.addAll) dengan sengaja.
// Kenapa? Kalau salah SATU saja file di daftar precache gagal diunduh
// (404, typo nama file, dsb), seluruh proses install akan GAGAL dan
// service worker tidak pernah aktif — inilah sumber bug PWA yang paling
// sering terjadi. Sebagai gantinya, cache diisi secara organik lewat
// event 'fetch' di bawah, jadi jauh lebih tahan terhadap human error.
// ------------------------------------------------------------------------
self.addEventListener('install', () => {
  self.skipWaiting(); // langsung aktif, tidak menunggu semua tab lama ditutup
});

// ------------------------------------------------------------------------
// ACTIVATE
// Hapus semua cache versi lama secara otomatis, lalu ambil alih kendali
// tab yang sedang terbuka tanpa perlu di-refresh manual oleh user.
// ------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('roas-calculator-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ------------------------------------------------------------------------
// FETCH
// - Navigasi halaman (HTML): network-first. Selalu coba ambil versi
//   terbaru dari server dulu; kalau offline baru jatuh ke cache terakhir.
//   Ini mencegah user "terjebak" di HTML versi lama.
// - Aset lain (CSS/JS/gambar/font/CDN): cache-first + stale-while-
//   revalidate. Tampil cepat dari cache, sambil diam-diam mengambil
//   versi terbaru di background untuk kunjungan berikutnya.
// ------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
