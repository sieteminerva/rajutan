// ================================================================
// HOME — halaman presentasi (rute #/home)
// ================================================================

import type { iNodeContent } from "../lib/interface";
import { navigate } from "../lib/Modules/BuildStore";

// =====================================================================
// HELPERS LANDING — presentasi & memulai wizard
// =====================================================================

/** Gulir mulus ke sebuah anchor. */
function navScroll(selector: string): (e: Event) => void {
  return (e) => {
    e.preventDefault();
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (location.hash !== selector) history.replaceState(null, "", selector);
  };
}

/** Memulai pembangunan: jika form sudah ada → gulir ke sana; jika belum → picu tombol hero. */
function requestStart(): void {
  // Pindah ke halaman build (#/build) — wizard kini tinggal di halaman khusus.
  navigate("build");
}
// ── SECTION_SLOT ──

// =====================================================================
// 🤝 TRUST MOMENT — "apa yang lahir langsung di akun ANDA"
// =====================================================================
const TrustSection = {
  attrs: { "animation": "fade-in" },
  content: {
    ".shell": {
      content: {
        "h2.title": { content: "Website & Datanya — 100% Milik Anda Sejak Detik Pertama" },
        "p.description": { content: "Kami tidak menguasai website Anda. Begitu Anda menekan tombol rakit, setiap bagian penting lahir dan berpindah langsung ke akun pribadi Anda. Inilah yang menanti di tangan Anda:" },
        ".trust.grid": {
          content: [
            {
              ".trust.card": {
                "h5": { content: "📘 Basis Data Google Sheets" },
                "p": { content: "Sebuah spreadsheet direplikasi ke Google Drive pribadi Anda dan kepemilikannya ditransfer langsung ke akun Anda — tanpa akses lanjutan dari kami." }
              }
            },
            {
              ".trust.card": {
                "h5": { content: "📦 Repositori Kode di GitHub" },
                "p": { content: "Manifest dibuat, lalu repositori di-duplikasi ke akun GitHub Anda. Kode sumber sepenuhnya jadi milik Anda: siap diunduh, diubah, atau di-hosting ulang kapan saja." }
              }
            },
            {
              ".trust.card": {
                "h5": { content: "🌐 Live di GitHub Pages / Cloudflare" },
                "p": { content: "Website langsung di-deploy ke domain Anda di GitHub Pages atau Cloudflare — online untuk pengunjung, tanpa tagihan server bulanan." }
              }
            },
            {
              ".trust.card": {
                "h5": { content: "🔗 REST API Pribadi" },
                "p": { content: "Apps Script Orkestrator membangkitkan REST API untuk data Anda, terikat akun, sehingga panel kontrol dan toko berjalan di atas data milik Anda sendiri." }
              }
            },
          ]
        },
      }
    }
  }
};

// =====================================================================
// 🧭 CARA KERJA — empat langkah dari deskripsi menuju website live
// =====================================================================
const HowSection = {
  attrs: { "animation": "fade-in" },
  content: {
    ".shell": {
      content: {
        "h2.title": { content: "Cara Kerjanya" },
        "p.description": { content: "Empat langkah, satu tombol, dan website impian Anda lahir dalam sekejap." },
        ".steps": {
          content: [
            { ".step": { ".step-num": { content: "1" }, "h5": { content: "Ceritakan Bisnis Anda" }, "p": { content: "Isi wizard berbahasa manusia — jenis website, alamat digital, kisah, produk, dan kontak Anda. Tanpa kode." } } },
            { ".step": { ".step-num": { content: "2" }, "h5": { content: "Kami Merajutnya" }, "p": { content: "System pintar kami mengubah masukan Anda menjadi konten nyata: hero, cerita merek, etalase produk, hingga kontak, siap dipublikasikan." } } },
            { ".step": { ".step-num": { content: "3" }, "h5": { content: "Data Masuk ke Akun Anda" }, "p": { content: "Spreadsheet basis data dibuat di Drive Anda, lalu REST API dibangkitkan agar website bisa membaca & mengubah datanya sendiri." } } },
            { ".step": { ".step-num": { content: "4" }, "h5": { content: "Live & Sepenuhnya Milik Anda" }, "p": { content: "Repositori di-duplikasi ke GitHub, website di-deploy ke GitHub Pages/Cloudflare, dan hak milik 100% pindah ke tangan Anda." } } },
          ]
        },
      }
    }
  }
};

// ── SECTION_SLOT ──

// =====================================================================
// ⚙️ FITUR — dibuat untuk usaha kecil yang mandiri
// =====================================================================
const FeaturesSection = {
  attrs: { "animation": "fade-in" },
  content: {
    ".shell": {
      content: {
        "h2.title": { content: "Dibuat untuk Usaha Kecil yang Mandiri" },
        "p.description": { content: "Tak perlu dashboard rumit, tak perlu rekayasa pembayaran sendiri, dan tak perlu membayar server tiap bulan." },
        ".features.grid": {
          attrs: { "animation": "fade-in", "animation-chain": "true" },
          content: [
            {
              ".feature.card": {
                "h5": { content: "📋 Panel Kontrol via Google Sheets" },
                "p": { content: "Tak perlu pusing belajar dashboard admin yang asing. Ubah harga barang, update stok, atau tambah produk baru cukup mengetik dari aplikasi Google Sheets di ponsel Anda." }
              }
            },
            {
              ".feature.card": {
                "h5": { content: "💳 Otomatisasi QRIS & WhatsApp Care" },
                "p": { content: "Website Anda langsung terintegrasi dengan generator kode QRIS dinamis untuk pembayaran instan, serta tombol WhatsApp otomatis untuk mengunci pesanan pelanggan khas pasar lokal." }
              }
            },
            {
              ".feature.card": {
                "h5": { content: "🛡️ 100% Hak Milik & Rp0 Biaya Server" },
                "p": { content: "Melalui sistem Self-Detach, seluruh kepemilikan website dan basis data diserahkan total ke Google Drive Anda. Kami mencabut akses kami, menjamin privasi data, dan membebaskan Anda dari biaya bulanan." }
              }
            },
          ]
        },
      }
    }
  }
};

// =====================================================================
// ❓ TANYA JAWAB — meredam keraguan sebelum mulai
// =====================================================================
const FaqSection = {
  attrs: { "animation": "fade-in", style: "margin:auto;" },
  content: {
    ".shell": {
      content: {
        "h2.title": { content: "Pertanyaan yang Sering Muncul" },
        ".faq-list": {
          content: `
            <details open>
              <summary>Apakah saya perlu bisa coding?</summary>
              <p>Tidak sama sekali. Seluruh struktur dihasilkan dari bahasa manusia yang Anda tulis di wizard — kode lahir otomatis di belakang layar.</p>
            </details>
            <details>
              <summary>Berapa biaya server dan pemeliharaannya?</summary>
              <p>Rp0. Website di-hosting di GitHub Pages atau Cloudflare (gratis) dan basis data berada di Google Drive Anda sendiri. Tidak ada biaya operasional bulanan.</p>
            </details>
            <details>
              <summary>Kepemilikan website ada di tangan siapa?</summary>
              <p>100% Anda. Repositori di-duplikasi ke akun GitHub Anda dan spreadsheet dibuat di Drive Anda, lalu hak akses kami dicabut lewat sistem Self-Detach.</p>
            </details>
            <details>
              <summary>Bisakah saya mengubah konten setelah website jadi?</summary>
              <p>Ya. Spreadsheet di Drive Anda adalah panel kontrolnya — ubah data di Google Sheets dan website ikut berubah. Ingin website baru? Cukup isi wizard ulang.</p>
            </details>
            <details>
              <summary>Bagaimana dengan pembayaran QRIS?</summary>
              <p>Website langsung terintegrasi kode QRIS dinamis untuk pembayaran instan khas pasar lokal, plus notifikasi WhatsApp otomatis saat ada pesanan masuk.</p>
            </details>
          `
        },
      }
    }
  }
};

// ── SECTION_SLOT ──

// =====================================================================
// 🚀 CTA — ajakan terakhir kembali ke wizard
// =====================================================================
const CtaSection = {
  attrs: { "animation": "fade-in" },
  content: {
    ".shell": {
      content: {
        "h2.title": { content: "Saatnya Website Anda yang Sebenarnya" },
        "p.description": { content: "Jabarkan bisnis Anda dalam bahasa manusia, dan biarkan kami merajutnya menjadi website yang hidup, aman, dan seratus persen milik Anda." },
        "button.button.primary#cta-start": {
          content: "Rakit Website Saya",
          onCreated: (el: HTMLElement) => el.addEventListener("click", () => requestStart()),
        },
      }
    }
  }
};

// =====================================================================
// 🦶 FOOTER — penegasan terakhir kemandirian & kepemilikan
// =====================================================================
const FooterSection = {
  content: {
    ".inner": {
      content: {
        ".brand": { content: "Rajutan" },
        ".tagline": { content: "Merajut kemandirian digital untuk usaha kecil Indonesia. Tanpa biaya server, tanpa biaya operasional, dan 100% milik Anda." },
        ".legal": { content: "Website dan datanya sepenuhnya milik Anda. Dibangun di atas Google Workspace, GitHub, dan Cloudflare Anda sendiri." },
      }
    }
  }
};
export const HomepageContent: iNodeContent =
{
  "#app": {
    content: {
      "nav": {
        content: {
          ".brand": {
            attrs: { href: "#home" },
            content: "Rajutan",
            onCreated: (el: HTMLElement) => el.addEventListener("click", navScroll("#home")),
          },
          ".navigations": {
            "a.item#home-link": { attrs: { href: "#home" }, content: "Beranda", onCreated: (el: HTMLElement) => el.addEventListener("click", navScroll("#home")) },
            "a.item#how-link": { attrs: { href: "#how" }, content: "Cara Kerja", onCreated: (el: HTMLElement) => el.addEventListener("click", navScroll("#how")) },
            "a.item#features-link": { attrs: { href: "#features" }, content: "Fitur", onCreated: (el: HTMLElement) => el.addEventListener("click", navScroll("#features")) },
            "a.item#faq-link": { attrs: { href: "#faq" }, content: "Tanya Jawab", onCreated: (el: HTMLElement) => el.addEventListener("click", navScroll("#faq")) },
          },
          "button.button.primary#start-link": {
            content: "Mulai",
            onCreated: (el: HTMLElement) => el.addEventListener("click", () => requestStart()),
          },
        }
      },
      "main": {
        content: {
          "section#home": {
            content: {
              ".row$1": {
                content: {
                  "h3.title": {
                    attrs: { "animation": "fade-in", "animation-chain": "true", "animated-once": "true" },
                    content: "Rakit Website Modern dengan Bahasa Manusia"
                  },
                  ".description.natural": {
                    attrs: { "animation": "typewriter", "data-tw-rewrite": "true", "animation-chain": "true" },
                    content: `
                      <span>
                        Anda berada di tempat yang tepat jika saat ini mulai menyadari pentingnya website bagi eksistensi diri, merek dagang, maupun identitas usaha Anda. 
                        Kehadiran website kini telah menjadi kebutuhan dasar dalam menghadapi persaingan bisnis di era digital. 
                        Saat ini mungkin anda terbentur banyak rintangan dan telah melalui berbagai proses yang rumit bahkan sebelum website pertama anda berhasil diluncurkan.
                      </span>

                      <span>
                      Dan mungkin terbesit di benak anda sebuah pertanyaan..
                      </span>

                      <blockquote>

                      "Ada ga ya cara dimana saya tinggal menjabarkan website seperti apa yang akan dibuat lalu secara otomatis website itu dibentuk sesuai deskripsi saya?"

                      </blockquote>

                      <span>
                        Jika anda adalah orang tersebut, mungkin keluhan serta keresahan itulah yang terbisik sampai ke telinga kami.
                        yang mendorong hati kecil kami untuk merajut tautan ini.
                      </span>`
                  },

                  "h4.asking.question": {
                    attrs: { "animation": "fade-in", "animation-chain": "true", "animated-once": "true" },
                    content: "Siap memulai pembangunan website impian anda?"
                  },
                  "button#start.button.small": {
                    attrs: {
                      "animation": "text-scramble",
                      "animation-chain": "true",
                      "animated-once": "true"
                    },
                    content: "Mari Mulai",
                    onCreated: (el: HTMLElement) => {
                      el.addEventListener("click", () => requestStart());
                    }
                  }
                },
              },
              // (blok rujukan .row$2 dengan tabel lama dihapus — dipindah ke section terpisah)
            }
          },
          "section#trust": TrustSection,
          "section#how": HowSection,
          "section#features": FeaturesSection,
          "section#faq": FaqSection,
          "section#cta": CtaSection,
        },
      },
      "footer": FooterSection,
    }
  }
}
