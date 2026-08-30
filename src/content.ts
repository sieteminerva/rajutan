import type { iNodeContent } from "./lib/interface";

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

const IntroSet = {
  id: "intro-set",
  group: [
    {
      type: "select",
      id: "web-type",
      title: "Kategory website yang ingin kamu buat dan tunjukkan kepada dunia adalah website",
      placeholder: "berjenis apa?",
      config: {
        options: [
          { value: "blog", label: "Catatan Cerita / Blog" },
          { value: "ecommerce", label: "Toko Online / E-Commerce" },
          { value: "profile", label: "Profil Pribadi" },
          { value: "news", label: "Warta & Berita" },
          { value: "portfolio", label: "Galeri Portofolio" },
          { value: "gallery", label: "Etalase Visual" }
        ]
      }
    },
    {
      type: "text",
      id: "web-name",
      title: "Kamu akan meluncurkannya dengan alamat nama digital",
      placeholder: "namapilihanmu.com",
      config: {
        popover: createPopover({
          info: "Alamat unik ini akan menjadi pintu gerbang utama orang-orang menemukan tokomu.",
          placeholder: "Contoh: rona-rajutan.com atau kriya-kayu.id"
        })
      }
    },
    {
      type: "textarea",
      id: "web-reason",
      title: "Apa alasan singkat dibalik kenapa kamu ingin membuat website ini, dan beritahu alasan kenapa orang lain harus mendatangi dan jangan sampai melewatkan website mu ini",
      placeholder: "Ceritakan alasan atau mimpi besar di balik karyamu...",
      config: {
        popover: createPopover({
          info: "Tuliskan satu kalimat pemikat (Hero Headline) yang akan langsung dibaca pengunjung pertama kali.",
          placeholder: "Contoh: Membawa kehangatan anyaman tradisi ke ruang modern minimalis."
        })
      }
    },
    {
      type: "text",
      id: "web-author",
      title: "Situs web ini dirancang secara personal, dan dirajut oleh",
      placeholder: "dirimu...",
      config: {
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

  const downloadIcon = document.createElement("i");
  downloadIcon.className = "icon download file";
  downloadTemplateLink.appendChild(downloadIcon);

  return downloadTemplateLink;

}


const DetailSet = {
  id: "detail-set",
  group: [
    {
      type: "file",
      id: "product",
      title: "Untuk mengisi seluruh isi etalase datanya secara instan, silakan unggah baris berkas CSV",
      placeholder: "Pilih file template .csv data...",
      config: {
        attributes: [
          { name: "data-max-upload", value: 1 },
          { name: "accept", value: ".csv, text/csv" },
          { name: "data-uploader-csv", value: "true" }
        ],
        popover: createPopover({
          info: "Kami akan membaca isi teks CSV ini dan mengubahnya menjadi baris tabel interaktif di halaman berikutnya.",
          placeholder: "Mendukung format ekspor Excel standar (.csv)"
        })
      }
    },
    createDownloadLink()
  ]
}

const ContactSet = {
  id: "contact-set",
  group: [
    {
      type: "email",
      id: "email",
      title: "Jika ada pengunjung atau calon pembeli yang ingin menyapa melalu surat elektronik mereka akan ditermia di",
      placeholder: "alamat email aktifmu",
      config: {
        popover: createPopover({
          placeholder: "contoh ruang.karya@indonesia.com",
          info: "Alamat email akan dicantumkan sebagai contact di website."
        })
      }
    },
    {
      type: "text",
      id: "company",
      title: "Seluruh hak cipta dan kepemilikan operasional website ini bernaung di bawah",
      placeholder: "nama badan usaha / studionya",
      config: {
        popover: createPopover({
          placeholder: "contoh PT.Ruang Karya",
          info: "Nama perusahaan juga akan dicantumkan di website"
        })
      }
    },
    {
      type: "file",
      id: "logo",
      title: "Dan sebagai penanda identitas visual yang khas, mari sematkan gambar logo usahamu",
      placeholder: "unggah logo tokomu disini...",
      config: {
        attributes: [
          { name: "data-max-upload", value: 1 },
        ],
        view: "thumbnails"
      }
    },
  ]
}

const AddressSet = {
  id: "address-set",
  group: [
    {
      type: "textarea",
      id: "jalan",
      title: "Pusat workshop atau rumah tempat kerja mu ini beralamat di",
      placeholder: "Tuliskan nama jalan, nomor rumah, atau ruko usahamu...",
      config: {
        popover: createPopover({
          info: "Alamat fisik ini akan memandu sistem peta direktori untuk mempromosikan lokasi workshop-mu.",
          placeholder: "Contoh: Jl. Tenun Ikat No. 12B, RT 02/RW 04"
        })
      }
    },
    {
      type: "select",
      title: "Tepatnya, wilayah tersebut berada di cakupan wilayah",
      placeholder: "pilih provinsi...",
      config: { className: "loading", attributes: [{ name: "data-level", value: "propinsi" }] }
    },
    {
      type: "select",
      title: "pada wilayah administrasi daerah",
      placeholder: "pilih kota/kabupaten...",
      config: { attributes: [{ name: "data-level", value: "kota" }] }
    },
    {
      type: "select",
      title: "meluas ke area wilayah tingkat",
      placeholder: "pilih kecamatan...",
      config: { attributes: [{ name: "data-level", value: "kecamatan" }] }
    },
    {
      type: "select",
      title: "hingga menyentuh batas terkecil di",
      placeholder: "pilih kelurahan...",
      config: { attributes: [{ name: "data-level", value: "kelurahan" }] }
    },
    {
      type: "text",
      title: "dengan penguncian kode pos resmi",
      placeholder: "kodepos",
      config: { attributes: [{ name: "data-level", value: "kodepos" }] }
    },
  ]
}
const formConfig = {
  id: "wizardo",
  multistep: true,
  selectors: {
    "@form>group": { tagName: "fieldset", className: "inline-style" },
  },
  // submitButton: false,
};

const formContent = [
  IntroSet,
  DetailSet,
  ContactSet,
  AddressSet
]

const wizard = {
  config: formConfig,
  schema: formContent
}
// @ts-ignore
const x = {
  ".description.natural": {
    attrs: {
      "animation": "typewriter",
      "data-tw-rewrite": "true",
      "data-delay": "1200" // Pause membaca 1.2 detik sebelum menghapus teks
    },
    content: `
      <span>
        Anda sudah bekerja keras merajut karya, memahat kayu, atau menyeduh kopi terbaik. 
        Namun di era digital ini, mengapa Anda masih harus terbentur rumitnya kode pemrograman 
        dan mahalnya biaya sewa server bulanan hanya untuk memiliki sebuah toko online?
      </span>

      <span>
        Berjualan di marketplace besar pun kini tak lagi ramah. 
        Potongan komisi mencekik untung bersih Anda, dan produk Anda dipaksa 
        bakar iklan agar tidak tenggelam dari persaingan.
      </span>

      <blockquote>
        "Adakah cara di mana saya tinggal menceritakan bisnis saya, 
        lalu sebuah website e-commerce langsung terbentuk secara otomatis sesuai deskripsi saya?"
      </blockquote>

      <span>
        Keresahan Anda terbit sampai ke telinga kami. 
        Kami merajut platform ini untuk mengembalikan kemandirian penuh usaha Anda. 
        Website modern, siap terima bayaran QRIS otomatis, tanpa biaya operasional selamanya.
      </span>`
  },
  ".row$2.features-grid": {
    attrs: { "animation": "fade-in", "animation-chain": "true" },
    content: [
      {
        ".feature-card": {
          "h5": { content: "📋 Panel Kontrol via Google Sheets" },
          "p": { content: "Tak perlu pusing belajar dashboard admin yang asing. Ubah harga barang, update stok, atau tambah produk baru cukup mengetik dari aplikasi Google Sheets di ponsel Anda." }
        }
      },
      {
        ".feature-card": {
          "h5": { content: "💳 Otomatisasi QRIS & WhatsApp Care" },
          "p": { content: "Website Anda langsung terintegrasi dengan generator kode QRIS dinamis untuk pembayaran instan, serta tombol WhatsApp otomatis untuk mengunci pesanan pelanggan khas pasar lokal." }
        }
      },
      {
        ".feature-card": {
          "h5": { content: "🛡️ 100% Hak Milik & Rp0 Biaya Server" },
          "p": { content: "Melalui sistem Self-Detach, seluruh kepemilikan website dan basis data diserahkan total ke Google Drive Anda. Kami mencabut akses kami, menjamin privasi data, dan membebaskan Anda dari biaya bulanan." }
        }
      }
    ]
  }
}

export const HomepageContent: iNodeContent =
{
  "#app": {
    content: {
      "nav": {
        content: {
          ".navigations": {
            "a.item": {
              attrs: {
                href: "/#home"
              },
              content: "home"
            }
          }
        }
      },
      "main": {
        content: {
          "section#home": {
            content: {
              // ".row$1": {
              //   content: {
              //     "h3.title": {
              //       attrs: { "animation": "fade-in" },
              //       content: "Rakit Website Modern dengan Bahasa Manusia"
              //     },
              //     ".description.natural": {
              //       attrs: { "animation": "typewriter", "data-tw-rewrite": "true", "animation-chain": "true" },
              //       content: `
              //         <span>
              //           Anda berada di tempat yang tepat jika saat ini mulai menyadari pentingnya website bagi eksistensi diri, merek dagang, maupun identitas usaha Anda. 
              //           Kehadiran website kini telah menjadi kebutuhan dasar dalam menghadapi persaingan bisnis di era digital. 
              //           Saat ini mungkin anda terbentur banyak rintangan dan telah melalui berbagai proses yang rumit bahkan sebelum website pertama anda berhasil diluncurkan.
              //         </span>

              //         <span>
              //         dan mungkin terbesit di benak anda sebuah pertanyaan:
              //         </span>

              //         <blockquote>

              //         "Ada ga ya cara dimana saya tinggal menjabarkan website seperti apa yang akan dibuat lalu secara otomatis website itu dibentuk sesuai deskripsi saya?"

              //         </blockquote>

              //         <span>
              //           Jika anda salah satu orang tersebut mungkin keluhan serta keresahan itu yang terbisik sampai ke telinga kami, 
              //           dan mendorong hati kecil kami untuk merajut tautan ini.
              //         </span>`
              //     },

              //     "h4.asking.question": {
              //       attrs: { "animation": "fade-in", "animation-chain": "true" },
              //       content: "Siap memulai pembangunan website impian anda?"
              //     },
              //     "button#start.button.small": {
              //       attrs: {
              //         "animation": "text-scramble",
              //         "animation-chain": "true",
              //       },
              //       content: "Mari Mulai",
              //       onCreated: (el: HTMLElement, _renderFn: any, builderFn: any) => {
              //         el.addEventListener("click", () => {
              //           console.log("start clicked")
              //           const form = builderFn("form", wizard)
              //           form?.addEventListener("formSubmit", (e: any) => {
              //             const detail = e.detail;
              //             console.log("AAA", e.detail)
              //             detail.complete(true, true)
              //           })
              //           el.replaceWith(form)
              //         }, { once: true })
              //       }
              //     }
              //   },
              // },
              ".row$2": {

                onCreated: (el: HTMLElement, _renderFn: any, builderFn: any) => {
                  const form = builderFn("form", wizard)
                  form?.addEventListener("formSubmit", (e: any) => {
                    const detail = e.detail;
                    console.log("AAA", e.detail)
                    detail.complete(true, true)
                  })
                  el.append(form)
                }

              }
            }
          }
        }
      }
    }
  }
}



