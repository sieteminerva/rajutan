// import { TableBuilder } from "./lib/Components/Table/Table";
import type { iNodeContent } from "./lib/interface";
// import { AuthService } from "./lib/Modules/AuthService";

function createPopover(content: { info: string, placeholder: string }) {
  const popover = document.createElement("div");
  popover.className = "input-popover";
  popover.popover = "manual";

  const input = document.createElement("textarea");
  input.placeholder = content.placeholder;

  const label = document.createElement("label");
  label.className = "info";
  label.textContent = content.info;

  popover.append(input, label)

  return popover;
}

const selectors = { "@field>label": { tagName: "label", attrs: { "animation": "typewriter", "animation-chain": "true", "animated-once": "true" } } }

const IntroSet = {
  id: "intro-set",
  group: [
    // `<span class="label" animation="typewriter" animation-chain="true">Kategory website yang ingin kamu buat dan tunjukkan kepada dunia adalah website</span>`,
    {
      type: "select",
      id: "web-type",
      title: "Kategory website yang ingin kamu buat dan tunjukkan kepada dunia adalah website",
      placeholder: "berjenis apa?",
      config: {
        selectors,
        options: [
          { value: "blog", label: "Catatan Cerita / Blog" },
          { value: "ecommerce", label: "Toko Online / E-Commerce" },
          { value: "profile", label: "Profil Pribadi" },
          { value: "news", label: "Warta & Berita" },
          { value: "portfolio", label: "Portofolio" },
          { value: "gallery", label: "Galeri Visual" }
        ],
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
          // {
          //   name: "onchange", value: (e: Event) => {
          //     console.log("wow its changed!", (e.target as any).value)
          //     console.log("parentElement!", (e.target as any).closest("fieldset"))
          //   }
          // }
        ]
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">Kamu akan meluncurkannya dengan alamat nama digital</span>`,
    {
      type: "text",
      id: "web-name",
      condition: { field: "web-type", filled: true },
      title: "Kamu akan meluncurkannya dengan alamat nama digital",
      placeholder: "namapilihanmu.com",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ],
        popover: createPopover({
          info: "Alamat unik ini akan menjadi pintu gerbang utama orang-orang menemukan tokomu.",
          placeholder: "Contoh: rona-rajutan.com atau kriya-kayu.id"
        })
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">Apa alasan singkat dibalik kenapa kamu ingin membuat website ini, dan beritahu alasan kenapa orang lain harus mendatangi dan jangan sampai melewatkan website mu ini</span>`,
    {
      type: "textarea",
      id: "web-reason",
      condition: { field: "web-name", filled: true },
      title: "Apa alasan singkat dibalik kenapa kamu ingin membuat website ini, dan beritahu alasan kenapa orang lain harus mendatangi dan jangan sampai melewatkan website mu ini",
      placeholder: "Ceritakan alasan atau mimpi besar di balik karyamu...",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ],
        popover: createPopover({
          info: "Tuliskan satu kalimat pemikat (Hero Headline) yang akan langsung dibaca pengunjung pertama kali.",
          placeholder: "Contoh: Membawa kehangatan anyaman tradisi ke ruang modern minimalis."
        })
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">Situs web ini dirancang secara personal, dan dirajut oleh</span>`,
    {
      type: "text",
      id: "web-author",
      condition: { field: "web-reason", filled: true },
      title: "Situs web ini dirancang secara personal, dan dirajut oleh",
      placeholder: "dirimu...",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ],
        popover: createPopover({
          info: "Kamu bebas menuliskan nama lengkapmu, nama panggilan, atau nama studio usahamu.",
          placeholder: "Beri tahu dunia siapa pemilik sah karya ini."
        })
      }
    },
  ]
}


function createDownloadLink(filename: string = "address.csv") {

  const downloadTemplateLink = document.createElement("a") as HTMLAnchorElement;

  downloadTemplateLink.href = `docs/${filename}`;
  downloadTemplateLink.download = filename;
  downloadTemplateLink.textContent = "download template"
  downloadTemplateLink.className = "link download small"
  downloadTemplateLink.id = "csv-template";

  const downloadIcon = document.createElement("i");
  downloadIcon.className = "icon download file";
  downloadTemplateLink.appendChild(downloadIcon);

  downloadTemplateLink.setAttribute("animation", "fade-in")
  downloadTemplateLink.setAttribute("animation-chain", "true")

  return downloadTemplateLink;

}


const DetailSetShop = {
  id: "ecommerce-detail-set",
  // condition: { field: "web-type", filled: true },
  group: [
    // `<span class="label" animation="typewriter" animation-chain="true">Untuk mengisi seluruh isi etalase data tokonya secara instan, silakan unggah baris berkas CSV</span>`,
    {
      type: "file",
      id: "detail-product",
      condition: { field: "web-name", filled: true },
      title: "Untuk mengisi seluruh isi etalase data tokonya secara instan, silakan unggah baris berkas CSV",
      placeholder: "Pilih file template .csv data...",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
          { name: "data-max-upload", value: 1 },
          { name: "accept", value: ".csv, text/csv, .json, text/json" },
          { name: "data-uploader-csv", value: "true" }
        ],
      }
    },
    createDownloadLink()
  ]
}


const ContactSet = {
  id: "contact-set",
  group: [
    // `<span class="label" animation="typewriter" animation-chain="true">Jika ada pengunjung atau calon pembeli yang ingin menyapa melalu surat elektronik mereka akan ditermia di</span>`,
    {
      type: "email",
      id: "contact-email",
      condition: { field: "detail-product", filled: true },
      title: "Jika ada pengunjung atau calon pembeli yang ingin menyapa melalu surat elektronik mereka akan diterima di",
      placeholder: "alamat email aktifmu",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ],
        popover: createPopover({
          placeholder: "contoh ruang.karya@indonesia.com",
          info: "Alamat email akan dicantumkan sebagai contact di website."
        })
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">Seluruh hak cipta dan kepemilikan operasional website ini bernaung di bawah</span>`,
    {
      type: "text",
      id: "contact-company",
      condition: { field: "contact-email", filled: true },
      title: "Seluruh hak cipta dan kepemilikan operasional website ini bernaung di bawah",
      placeholder: "nama badan usaha / studionya",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ],
        popover: createPopover({
          placeholder: "contoh PT.Ruang Karya",
          info: "Nama perusahaan juga akan dicantumkan di website"
        })
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">Dan sebagai penanda identitas visual yang khas, mari sematkan gambar logo usahamu</span>`,
    {
      type: "file",
      id: "contact-logo",
      condition: { field: "contact-company", filled: true },
      title: "Dan sebagai penanda identitas visual yang khas, mari sematkan gambar logo usahamu",
      placeholder: "unggah logo tokomu disini...",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
          { name: "data-max-upload", value: 1 },
        ],
        view: "thumbnails"
      }
    },
  ]
}

const AddressSet = {
  id: "address-set",
  // condition: { field: "contact-company", filled: true },
  group: [
    // `<span class="label" animation="typewriter" animation-chain="true">Pusat workshop atau rumah tempat kerja mu ini beralamat di</span>`,
    {
      type: "textarea",
      id: "address-jalan",
      // condition: { field: "logo", filled: true },
      title: "Pusat workshop atau rumah tempat kerja mu ini beralamat di",
      placeholder: "Tuliskan nama jalan, nomor rumah, atau ruko usahamu...",
      config: {
        selectors,
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ],
        popover: createPopover({
          info: "Alamat fisik ini akan memandu sistem peta direktori untuk mempromosikan lokasi workshop-mu.",
          placeholder: "Contoh: Jl. Tenun Ikat No. 12B, RT 02/RW 04"
        })
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">Tepatnya, wilayah tersebut berada di cakupan wilayah</span>`,
    {
      type: "select",
      id: "address-propinsi",
      // condition: { field: "jalan", filled: true },
      title: "Tepatnya, wilayah tersebut berada di cakupan wilayah",
      placeholder: "pilih provinsi   ",
      config: {
        className: "loading",
        selectors,
        attributes: [
          { name: "data-level", value: "propinsi" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ]
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">pada wilayah administrasi daerah</span>`,
    {
      type: "select",
      id: "address-kota",
      // condition: { field: "jalan", filled: true },
      title: "pada wilayah administrasi daerah",
      placeholder: "pilih kota/kabupaten   ",
      config: {
        selectors,
        attributes: [
          { name: "data-level", value: "kota" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ]
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">meluas ke area wilayah tingkat</span>`,
    {
      type: "select",
      id: "address-kecamatan",
      // condition: { field: "jalan", filled: true },
      title: "meluas ke area wilayah tingkat",
      placeholder: "pilih kecamatan   ",
      config: {
        selectors,
        attributes: [
          { name: "data-level", value: "kecamatan" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ]
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">hingga menyentuh batas terkecil di</span>`,
    {
      type: "select",
      id: "address-kelurahan",
      // condition: { field: "jalan", filled: true },
      title: "hingga menyentuh batas terkecil di",
      placeholder: "pilih kelurahan   ",
      config: {
        selectors,
        attributes: [
          { name: "data-level", value: "kelurahan" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ]
      }
    },
    // `<span class="label" animation="typewriter" animation-chain="true">dengan penguncian kode pos resmi</span>`,
    {
      type: "text",
      id: "address-kodepos",
      // condition: { field: "jalan", filled: true },
      title: "dengan penguncian kode pos resmi",
      placeholder: "kodepos",
      config: {
        selectors,
        attributes: [
          { name: "data-level", value: "kodepos" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "animated-once", value: "true" },
        ]
      }
    },
  ]
}

const ConfirmationSet = {
  id: "confirmation-set",
  group: [

    `<div animation="typewriter" animation-chain="true" animated-once="true">
      <span>
        Menakjubkan! Anda sudah sampai sejauh ini, dan ini membuktikan seberapa besar keseriusan anda
        untuk membangun halaman pribadi anda sendiri.
      </span>
      <br>
      <span>
        Sebelum system kami mewujudkan impian anda, kami membutuhkan konfirmasi dari anda bahwa data yang anda isikan 
        benar adanya. 
        </span><br>
        <span style="font-style:italic; color: var(--input-label-color)">
        Tidak ditujukan untuk melakukan tindak kejahatan siber, tindak kriminal atau tindak kejahatan melawan hukum lainnya.
        Tidak terkait dengan perjudian online, serta berisi konten yang mengandung pornografi.
        </span>
        <br>
      <span>
        Apabila dikemudian hari ditemukan konten yang mengandung hal-hal yang disebutkan sebelumnya, 
        dan apabila konten tersebut mempunyai akibat hukum setelahnya 
      </span>
      <span style="font-style:italic; color: var(--input-label-color)">
      itu sepenuhnya menjadi tanggung jawab anda. 
      </span>
      <span>
        kami akan segera menghapus website tersebut, serta apabila diperlukan
        kami akan patuh membantu menyelesaikan perkara hukum akibat konten tersebut. 
      </span>
      </div><br>`,

    `<div animation="typewriter" animation-chain="true">
        Silahkan periksa kembali seluruh konten yang telah anda isi.
        Jika sudah yakin silahkan berikan persetujuan anda lalu submit.
        System kami akan merajut data tersebut kedalam website yang nyata
      </div><br>`
    ,
    {
      type: "checkbox",
      id: "confirmation",
      // condition: { field: "kodepos", filled: true },
      title: "Saya setuju dan bertanggung jawab sepenuhnya atas konten tersebut",
      position: "left",
      config: {
        selectors: {
          "@field": {
            tagName: "div",
            className: "field",
            attrs: { "animation": "fade-in", "animation-chain": "true", "animeted-once": "true" }
          }
        },
        style: "toggle",

      }
    }
  ]
}

const formConfig = {
  id: "wizardo",
  multistep: true,
  cascading: true, // 🌊 setiap input dirantai condition ke input sebelumnya
  autoDisableNextStep: true,
  selectors: {
    "@form>group": { tagName: "fieldset", className: "inline-style" },
  },
  // submitButton: false,
};

let isEditing = false;
// @ts-ignore
const TestSet = {
  id: "test-set",
  group: [
    {
      type: "text",
      id: "test-1",
      title: "Test Text",
      placeholder: "Isi apa aja",
      config: {
        actions: [
          {
            type: "copy",
            label: "copy",
            onClick: (_e: Event, payload: any) => {
              console.log("action!! COPY", payload)
            }
          },
          {
            type: "delete",
            label: "delete",
            onClick: (_e: Event, payload: any) => {
              console.log("action!! delete", payload)
            }
          },
          {
            type: "add",
            label: "new",
            onClick: (_e: Event, payload: any) => {
              console.log("action!! ADD", payload)
            }
          },
          {
            type: "edit",
            label: "edit",
            onClick: (_e: Event, payload: any) => {
              isEditing = !isEditing;
              console.log("action!! EDIT", `isEditing: ${isEditing}`, payload)
            }
          }
        ]
      }
    },
    {
      type: "select",
      id: "test-2",
      title: "Test Text",
      placeholder: "Isi apa aja",
      config: {
        options: [
          "A", "B", "C", "D"
        ],
        actions: [
          {
            type: "copy",
            label: "copy",
            onClick: (_e: Event, payload: any) => {
              console.log("action!! COPY", payload)
            }
          },
          {
            type: "delete",
            label: "delete",
            onClick: (_e: Event, payload: any) => {
              console.log("action!! delete", payload)
            }
          },
          {
            type: "add",
            label: "new",
            onClick: (_e: Event, payload: any) => {
              console.log("action!! ADD", payload)
            }
          },
          {
            type: "edit",
            label: "edit",
            onClick: (_e: Event, payload: any) => {
              isEditing = !isEditing;
              console.log("action!! EDIT", `isEditing: ${isEditing}`, payload)
            }
          }
        ]
      }
    }
  ]
}

const formContent = [
  // TestSet,
  IntroSet,
  DetailSetShop,
  ContactSet,
  AddressSet,
  ConfirmationSet,
]

const wizard = {
  config: formConfig,
  schema: formContent
}

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
  const existing = document.querySelector<HTMLFormElement>(".form.multistep, form.form");
  if (existing?.isConnected) {
    existing.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const start = document.getElementById("start") as HTMLButtonElement | null;
  if (start) {
    start.click();
    return;
  }
  document.getElementById("home")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        "p.description": { content: "Empat langkah, satu tombol, dan website impian Anda lahir dalam hitungan menit." },
        ".steps": {
          content: [
            { ".step": { ".step-num": { content: "1" }, "h5": { content: "Ceritakan Bisnis Anda" }, "p": { content: "Isi wizard berbahasa manusia — jenis website, alamat digital, kisah, produk, dan kontak Anda. Tanpa kode." } } },
            { ".step": { ".step-num": { content: "2" }, "h5": { content: "Kami Merajutnya" }, "p": { content: "Gemini mengubah masukan Anda menjadi konten nyata: hero, cerita merek, etalase produk, hingga kontak, siap dipublikasikan." } } },
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

/* For Developing Form */
export const HomepageContent1: iNodeContent =
{
  "#app": {
    content: {
      ".row$1": {
        onCreated(el: HTMLElement, _renderFn: any, _builderFn: any) {
          const form = _builderFn("form", wizard);

          el.appendChild(form);
        }
      }
    }
  }
}

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
                    onCreated: (el: HTMLElement, _renderFn: any, builderFn: any) => {
                      el.addEventListener("click", () => {
                        console.log("start clicked")
                        const form = builderFn("form", wizard)
                        form?.addEventListener("change", (e: any) => {
                          const formEl = e.target.form as HTMLFormElement;
                          const csvTemplateLink = formEl.querySelector("#csv-template") as HTMLAnchorElement;
                          const filename = `${e.target.value}.csv`
                          csvTemplateLink.href = `docs/${filename}`;
                          csvTemplateLink.download = filename;
                        })
                        form?.addEventListener("formSubmit", async (e: any) => {
                          const detail = e.detail;

                          // 🔐 Wajib autentikasi Google sebelum data dikirim.
                          // Bila belum login, tampilkan halaman login Google lalu ambil id_token.
                          /* if (!(await AuthService.isAuthenticated())) {
                            const token = await AuthService.redirectToLogin();
                            if (!token) {
                              detail.complete(false, {
                                header: "Login Diperlukan",
                                message: "Silakan masuk dengan akun Google untuk melanjutkan pembuatan websitemu.",
                                type: "warning",
                                icon: "user circle icon",
                              });
                              return; // batalkan submit sampai pengguna benar-benar login
                            }
                            console.log("[AuthService] id_token diterima:", token);
                          } */

                          console.log("AAA", e.detail)
                          detail.complete(true, true)
                        })

                        // 🧾 Tangkap validasi terpusat (native & kaskade) dari FormBuilder.
                        // Detail: { reason: "native" | "cascade", valid, message, step, fields?, condition? }.
                        // Toast sudah otomatis dibuka FormBuilder via createMessage — di sini
                        // cukup bereaksi (analitik, fokus field, dsb.).
                        form?.addEventListener("formValidation", (e: any) => {
                          const validation = e.detail;
                          console.log("[Form Validation]", validation.reason, validation.message, validation);
                        })
                        el.parentElement?.replaceChildren(form)
                      }, { once: true })
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



export function simpleCascade(form: HTMLFormElement) {
  form?.addEventListener("change", (e: any) => {
    console.log("form Changed:", e.target.form)
    const detailMap = new Map<string, HTMLFieldSetElement>()
    const formEl = e.target.form as HTMLFormElement;
    for (const f of (formEl.querySelectorAll("fieldset") as any)) {
      if (!f.id.includes("detail")) {
        continue;
      }
      if (f.id.includes("detail")) {
        detailMap.set(f.id, f);
        f.remove()
      }
    }
    if (detailMap.has(e.target.value + "-detail-set")) {
      console.log(e.target.closest("fieldset"));
      e.target.closest("fieldset").after(detailMap.get(e.target.value + "-detail-set")!)
      // formEl.insertBefore(detailMap.get(e.target.value + "-detail-set")!, e.target.closest("fieldset"))
    }
  })
}


export const TablePageContent =
{
  builder: "table",
  config: {
    size: "small" as any,
    type: "celled" as any,
    editable: true,
    autoNumbering: true,
    pageSize: 10,
    sortable: true,
    selectable: true,
    // disableSubRow: true,
    headerOptions: {
      textAlign: "center",
    },
    bodyOptions: [
      {},
      { textAlign: "center", format: "number" },
      { format: "currency", currency: "IDR", locale: "id-ID", textAlign: "right" },
      {
        format: "currency",
        currency: "IDR",
        locale: "id-ID",
        textAlign: "right",
        formula: "=price * quantity", // will search header with text defined
      },
    ],
    footerOptions: {
      color: "gray",
      textAlign: "center",
      renderTotal: ["quantity", "total"],
    },
  },
  content: {
    // header: ["specifications", "quantity", "price", "total"],
    header: [
      { text: "specifications" },
      { text: "quantity", group: "details" },
      { text: "price", group: "details", options: { textAlign: "right" } },
      { text: "total", group: "details", options: { textAlign: "right" } },
    ],
    body: [
      ["art paper 125gsm", { text: 300, options: { textAlign: "left" } }, 1300, null],
      ["art carton 210gsm", 500, 2100, null],
      ["art paper 125gsm", 300, 1300, null],
      ["art carton 210gsm", 500, 2100, null],
      ["art paper 125gsm", 300, 1300, null],
      ["art carton 210gsm", 500, 2100, null],
      ["art paper 125gsm", 300, 1300, null],
      ["art paper 125gsm", 300, 1300, null],
      ["art carton 210gsm", 500, 2100, null],
      [{ text: "art carton 210gsm", options: { color: "red" } }, 500, 2100, null],
      ["art paper 125gsm", 300, 1300, null],
      ["art carton 210gsm", 500, 2100, null],
      ["art paper 125gsm", 300, { text: 1300, options: { textAlign: "left" } }, null],
      ["art carton 210gsm", 500, 2100, null],
      ["art paper 125gsm", 300, 1300, null],
      ["art carton 210gsm", 500, 2100, null],
    ],
    // footer: footerTemplate,
  }
}

