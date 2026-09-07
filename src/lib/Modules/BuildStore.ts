// ======================================================================
// BuildStore — jembatan data antar-halaman untuk alur pembangunan website.
//
// Pola respons server SELALU dibungkus:
//   { status, meta, data }
// `data` adalah kontainer seluruh detail hasil build (sheet, repo, live, guide).
// Berkas ini: (1) memegang respons terakhir, dan (2) menyediakan navigasi hash
// yang dipahami HashRouter — tanpa menciptakan siklus import dengan main.ts.
// ======================================================================

/** Detail situs yang sudah jadi — isi dari `data` pada pembungkus respons. */
export interface SiteBuildResult {
  sheet: { title: string; url: string } | null;
  repo: { title: string; url: string } | null;
  live: { title: string; url: string } | null;
  guide: Array<{ title: string; body: string; cta?: { label: string; href: string } }>;
  message?: string;
}

/** Bentuk pembungkus respons server yang selalu sama. */
export interface BuildApiResponse {
  status: "success" | "partial" | "error";
  meta: { currentPage: number; perPage: number; totalItems: number; totalPages: number; links: Record<string, string | null> };
  data: SiteBuildResult;
}

/** Toko respons build terakhir (module-level; dibaca halaman `result`). */
export const buildStore: { response: BuildApiResponse | null } = { response: null };

/** Navigasi hash sederhana — HashRouter di main.ts mendengarkan hashchange. */
export function navigate(path: string): void {
  const clean = path.trim().replace(/^#/, "").replace(/^\/+/, "") || "home";
  window.location.hash = clean;
}

/** Contoh respons server (data dipakai sebagai `<div class="data">` bila ada). */
export function mockBuildResult(): BuildApiResponse {
  const links = { first: "https://google.com", prev: null, self: "https://google.com", next: "https://google.com", last: "https://google.com" };
  return {
    status: "success",
    meta: { currentPage: 1, perPage: 5, totalItems: 25, totalPages: 5, links },
    data: {
      sheet: { title: "Basis Data Toko Anda", url: "https://docs.google.com/spreadsheets/d/EXAMPLE-SHEET" },
      repo: { title: "Repositori Kode", url: "https://github.com/YOU/rajutan-site-EXAMPLE" },
      live: { title: "Situs Anda", url: "https://YOURSITE.github.io" },
      guide: [
        { title: "Ubah konten lewat Google Sheets", body: "Buka spreadsheet di Drive Anda dan edit baris data — situs langsung membaca perubahannya." },
        { title: "Kelola pesanan & QRIS", body: "Transaksi masuk tercatat otomatis dan terhubung ke tombol WhatsApp Anda.", cta: { label: "Lihat panduan QRIS", href: "https://support.google.com" } },
        { title: "Pasang domain pribadi", body: "Arahkan DNS kustom Anda ke GitHub Pages agar situs tampil di nama domain sendiri." },
      ],
      message: "Situs Anda berhasil dirajut. Semua aset penting kini berpindah ke akun Anda.",
    },
  };
}