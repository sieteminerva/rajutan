## 1. Bagaimana Cara Memakai Google Identity Services (GIS)?

Anda cukup memasang skrip GIS di HTML sisi klien, memunculkan tombol login otomatis, lalu mengirimkan token enkripsi (id_token) yang didapat ke backend Google Apps Script Orkestrator untuk diverifikasi menggunakan API Google tokeninfo.

## Sisi Klien (Frontend)

Salin kode berikut dan pasang di halaman HTML Anda untuk menangani masuk log (login):

<!-- Muat pustaka resmi Google GIS -->
<script src="https://google.com" async defer></script>
<!-- Kontainer Tombol Google Sign-In -->
<div id="g_id_onload"
     data-client_id="MASUKKAN_CLIENT_ID_CONSOL_://googleusercontent.com"
     data-callback="handleCredentialResponse"
     data-auto_prompt="false">
</div>
<div class="g_id_signin" data-type="standard" data-size="large" data-theme="outline"></div>

<script>
  let userJwtToken = null;

  // Fungsi callback setelah pengguna sukses login dengan Google
  function handleCredentialResponse(response) {
    userJwtToken = response.credential; // Ini adalah JWT id_token dari Google
    
    // Dekode payload JWT secara native untuk mengambil info user jika dibutuhkan di UI
    const payload = JSON.parse(atob(userJwtToken.split('.')[1]));
    console.log("Logged in sebagai:", payload.email);
    
    // Sekarang Anda bisa memunculkan form profil CMS Anda
  }

  // Contoh fungsi kirim data ke Apps Script Orkestrator Pusat
  async function submitCmsForm(profileData) {
    if (!userJwtToken) return alert("Silakan login dahulu!");

    const response = await fetch("URL_APPS_SCRIPT_ORKESTRATOR_ANDA/exec", {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        id_token: userJwtToken, // Dikirim untuk divalidasi server pusat
        profile: profileData
      })
    });
    const result = await response.json();
    console.log("CMS Baru Siap:", result);
  }
</script>

## Sisi Backend (Apps Script Orkestrator Pusat - Code.gs)

Di sisi Apps Script, Anda wajib memvalidasi token tersebut ke API Google untuk mencegah pemalsuan identitas. Sesuai cetak biru di halaman 12 dokumen PDF Anda:

```ts
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const idToken = payload.id_token;
    const clientProfile = payload.profile;

    // 1. Validasi Token JWT langsung ke endpoint resmi Google
    const googleUser = getGoogleUserProfile(idToken);
    if (!googleUser) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "error",
          message: "Unauthorized: Token Tidak Valid",
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const emailKlien = googleUser.email; // Email asli pengguna yang terverifikasi aman

    // 2. Lanjutkan proses: Duplikasi Master Sheet, Suntik Data, Automated Deploy, Transfer Owner
    // ... jalankan sisa logika automation Anda di sini ...
  } catch (err) {
    // Return error handler
  }
}
// Fungsi verifikasi token OIDC Googlefunction getGoogleUserProfile(token) {
if (!token) return null;
try {
  const url = `https://googleapis.com{token}`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return response.getResponseCode() === 200 ? JSON.parse(response.getContentText()) : null;
} catch (e) {
  return null;
}
```

---

## 2. Apakah Bisa Dideploy di GitHub Pages Beserta Service Worker-nya?

Bisa, sangat bisa. GitHub Pages menyediakan protokol HTTPS secara gratis, yang merupakan syarat mutlak bagi Service Worker untuk dapat aktif dan berjalan di browser pengguna.
Namun, karena Anda menggunakan GitHub Pages, ada satu aturan ketat terkait Scope (Cakupan Jalur URL) yang harus Anda perhatikan:

- Masalah Sub-folder: URL default GitHub Pages biasanya menggunakan format sub-folder proyek: https://github.io.
- Dampaknya pada Service Worker: Jika file sw.js Anda taruh begitu saja, dia hanya akan memiliki otoritas mengintersep file di dalam sub-folder tersebut.

## Solusi Pengaturan Deployment di GitHub Pages:

1.  Pastikan Anda menaruh file sw.js di root (folder paling luar) repositori GitHub Anda.
2.  Saat mendaftarkan Service Worker di file app.js utama Anda, sertakan opsi scope yang mengarah tepat ke sub-folder repositori Anda agar browser tidak memblokirnya:

```ts
if ("serviceWorker" in navigator) {
  // Tentukan path relatif yang tepat ke repositori GitHub Pages Anda
  navigator.serviceWorker
    .register("/nama-repositori/sw.js", { scope: "/nama-repositori/" })
    .then((reg) => console.log("Service Worker aktif di GitHub Pages, scope:", reg.scope))
    .catch((err) => console.error("Pendaftaran SW Gagal:", err));
}
```

---

## 3. Mengapa Desain ini Sangat Bagus untuk Masa Depan Aplikasi Anda?

Dengan mengombinasikan Google GIS (Autentikasi), Apps Script (Orkestrator), dan GitHub Pages (Frontend + Service Worker), Anda berhasil membangun SaaS PWA tanpa biaya server sama sekali.
Melalui mekanisme Self-Detach (pemutusan akses mandiri) seperti di halaman 7 PDF:

1.  Server pusat Anda menduplikasi sheet master.
2.  Mengisi konten.
3.  Mentransfer hak milik (ownership) dokumen langsung ke email Google Drive milik pengguna.
4.  Mencabut diri Anda sendiri dari akses dokumen tersebut (removeEditor).

Hasilnya, seluruh biaya kuota transaksi API di masa depan (/exec) akan ditanggung langsung secara adil oleh akun Google masing-masing klien Anda sendiri, bukan oleh Anda.
Jika Anda siap menyusun kode orkestrasinya, beri tahu saya:

Benar sekali, analisis Anda 100% akurat! Jika dua pengguna menggunakan satu browser di perangkat yang sama secara bergantian, Service Worker (beserta variabel memori di dalamnya) akan selalu aktif dan tetap hidup. Browser tidak tahu kalau manusianya sudah berganti di depan layar, kecuali kita sendiri sebagai developer yang membuat mekanisme invalidation (pembatalan/pembersihan) secara eksplisit.
Tanpa adanya invalidation, User 2 bisa secara tidak sengaja mengirimkan data menggunakan token milik User 1 yang masih tertinggal di memori Service Worker.

---

## 🔄 Bagaimana Siklus Hidupnya Jika Bergantian User?

1.  User 1 Datang: Login dengan Google → Token masuk ke memori Service Worker → Bisa akses form CMS.
2.  User 1 Pergi (Tanpa Logout): Hanya menutup tab atau mematikan layar laptop. Service Worker masuk ke mode idle (tidur), tetapi variabel tokennya tidak hilang.
3.  User 2 Datang: Membuka browser yang sama. Karena Service Worker lama masih mengontrol domain tersebut, variabel token User 1 masih ada di sana.

## Oleh karena itu, membuat sistem Invalidation adalah hukumnya wajib.

## 🛡️ 3 Strategi Invalidation yang Bisa Anda Pilih

Karena Anda membangun semuanya secara native (tanpa library), Anda memiliki kontrol penuh untuk menerapkan salah satu dari 3 strategi invalidation berikut:

## Strategi 1: Token Invalidation Berbasis Waktu (Expiring Token)

Jangan biarkan token aktif selamanya di memori Service Worker. Tambahkan properti timestamp kedaluwarsa. Jadi, meskipun User 1 lupa klik logout, token akan mati sendiri dalam beberapa menit.
Di dalam Service Worker (sw.js):

```ts
let accessToken = null;let tokenExpiresAt = 0; // Waktu kedaluwarsa dalam milidetik

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET*TOKEN') {
  accessToken = event.data.token;
  // Set token hanya berlaku selama 15 menit (900.000 ms) dari sekarang
  tokenExpiresAt = Date.now() + (15 * 60 \_ 1000);
  }
});

self.addEventListener('fetch', (event) => {
// Cek apakah token sudah kedaluwarsa saat ada request jaringan
  if (Date.now() > tokenExpiresAt) {
  accessToken = null; // OTOMATIS INVALIDASI (Hapus Token)
  }

// Lanjutkan intersep API jika token masih valid...
});
```

## Strategi 2: Invalidation Total Saat Tombol Logout Ditekan (Sangat Direkomendasikan)

Setiap kali ada aktivitas keluar akun, bersihkan semua ruang penyimpanan browser termasuk Service Worker dan IndexedDB agar perangkat kembali suci sebelum digunakan orang lain.
Di halaman web utama (app.js):

```ts
async function handleUserLogout() {
  // 1. Invalidasi token di Service Worker
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_TOKEN" });
  }

  // 2. Hapus pendaftaran Service Worker agar browser benar-built bersih
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (let reg of registrations) {
    await reg.unregister();
  }

  // 3. Hapus database IndexedDB lokal (jika ada data CMS tersimpan)
  await indexedDB.deleteDatabase("TokoOnline");

  // 4. Trigger logout dari Google Identity Service (GIS)
  google.accounts.id.disableAutoSelect();

  // 5. Refresh halaman agar semua state JavaScript reset ke awal
  window.location.reload();
}
```

## Strategi 3: Invalidation Menggunakan Sesi Unik per Login (State Validation)

## Setiap kali halaman utama dimuat ulang atau dibuka kembali, halaman utama wajib mengirimkan "Sinyal Pemeriksaan Status" ke Service Worker untuk memastikan apakah user yang sedang aktif di layar HTML sama dengan token yang dipegang oleh Service Worker. Jika berbeda (atau di HTML tidak ada user aktif), Service Worker langsung menghapus token lama.

## 💡 Rekomendasi untuk Project SaaS Anda

Karena backend Anda menggunakan Google Apps Script Orkestrator yang memvalidasi JWT via tokeninfo (halaman 12 PDF), strategi terbaik Anda adalah mengombinasikan Strategi 1 dan Strategi 2.
Sebab, JWT (id_token) dari Google GIS sendiri secara bawaan sudah memiliki waktu kedaluwarsa dari Google (biasanya 1 jam). Jadi, meskipun Service Worker Anda tidak sengaja menyimpan token User 1, ketika token itu dipakai oleh User 2 setelah 1 jam, Apps Script Backend Anda akan otomatis menolaknya karena Google API menyatakan token tersebut sudah expired.
Bagaimana menurut Anda, apakah logika pembersihan menggunakan Strategi 2 (Unregister & Wipe) saat logout sudah cukup aman untuk alur aplikasi yang sedang Anda rancang?
