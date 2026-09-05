/* ===================================================================== */
/* public/sw.js — Service Worker utama rajutan                          */
/*                                                                       */
/* Sumber kebenaran (source of truth) untuk id_token pengguna.           */
/* Token disimpan DI SINI sebagai variabel memori SW supaya bertahan     */
/* antar halaman di sesi browser yang sama, lalu diinvalidasi tegas:     */
/*   - SET_TOKEN   → simpan token + masa berlaku (Strategi 1)            */
/*   - GET_TOKEN   → kirim balik token tersimpan (via MessageChannel)    */
/*   - CLEAR_TOKEN → hanguskan token (Strategi 2 / logout)               */
/*                                                                       */
/* Catatan: variabel SW bisa mati saat SW di-`terminate` browser;        */
/* jadinya halaman juga menyimpan cadangan ringan di sessionStorage.     */
/* ===================================================================== */

/** Token aktif yang dipegang Service Worker. */
let accessToken = null;
/** Waktu kedaluwarsa (epoch ms); 0 = tidak punya masa berlaku. */
let tokenExpiresAt = 0;

/** Pengganti 15 menit bila klien tidak mengirim expiresAt. */
const FALLBACK_VALIDITY_MS = 15 * 60 * 1000;

/** Invalidasi otomatis bila token sudah lewat masa berlakunya. */
function invalidateIfExpired() {
  if (tokenExpiresAt > 0 && Date.now() >= tokenExpiresAt) {
    accessToken = null;
    tokenExpiresAt = 0;
  }
}

self.addEventListener("install", (event) => {
  // Langsung aktif tanpa menunggu semua tab lama ditutup.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Segera kendalikan semua klien yang sudah terbuka.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0]; // untuk membalas GET_TOKEN

  switch (data.type) {
    case "SET_TOKEN": {
      if (!data.token) {
        accessToken = null;
        tokenExpiresAt = 0;
      } else {
        const expRaw = Number(data.expiresAt);
        const exp = Number.isFinite(expRaw) && expRaw > 0 ? expRaw : Date.now() + FALLBACK_VALIDITY_MS;
        accessToken = data.token;
        tokenExpiresAt = exp;
      }
      if (port) port.postMessage({ type: "SET_TOKEN", ok: true });
      break;
    }

    case "CLEAR_TOKEN": {
      accessToken = null;
      tokenExpiresAt = 0;
      if (port) port.postMessage({ type: "CLEAR_TOKEN", ok: true });
      break;
    }

    case "GET_TOKEN": {
      invalidateIfExpired();
      if (port) port.postMessage({ type: "GET_TOKEN", token: accessToken, expiresAt: tokenExpiresAt });
      break;
    }
  }
});

// Invalidasi otomatis pada setiap aktivitas jaringan (Strategi 1).
self.addEventListener("fetch", (event) => {
  invalidateIfExpired();
  // Request diteruskan apa adanya; token tidak dipakai header di sini —
  // id_token dikirim ke Apps Script Orkestrator lewat body fetch halaman.
});