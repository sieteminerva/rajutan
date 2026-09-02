// import { TableBuilder } from "./lib/Components/Table/Table";
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
    `<span class="label" animation="typewriter" animation-chain="true">Kategory website yang ingin kamu buat dan tunjukkan kepada dunia adalah website</span>`,
    {
      type: "select",
      id: "web-type",
      // title: "Kategory website yang ingin kamu buat dan tunjukkan kepada dunia adalah website",
      placeholder: "berjenis apa?",
      config: {
        selectors: {
          "@field": {
            tagName: "div",
            className: "field",
            attrs: { "animation": "fade-in", "animation-chain": "true" }
          }
        },
        options: [
          { value: "blog", label: "Catatan Cerita / Blog" },
          { value: "ecommerce", label: "Toko Online / E-Commerce" },
          { value: "profile", label: "Profil Pribadi" },
          { value: "news", label: "Warta & Berita" },
          { value: "portfolio", label: "Portofolio" },
          { value: "gallery", label: "Galeri Visual" }
        ],
        attributes: [
          // {
          //   name: "onchange", value: (e: Event) => {
          //     console.log("wow its changed!", (e.target as any).value)
          //     console.log("parentElement!", (e.target as any).closest("fieldset"))
          //   }
          // }
        ]
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">Kamu akan meluncurkannya dengan alamat nama digital</span>`,
    {
      type: "text",
      id: "web-name",
      // title: "Kamu akan meluncurkannya dengan alamat nama digital",
      placeholder: "namapilihanmu.com",
      config: {
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
        ],
        popover: createPopover({
          info: "Alamat unik ini akan menjadi pintu gerbang utama orang-orang menemukan tokomu.",
          placeholder: "Contoh: rona-rajutan.com atau kriya-kayu.id"
        })
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">Apa alasan singkat dibalik kenapa kamu ingin membuat website ini, dan beritahu alasan kenapa orang lain harus mendatangi dan jangan sampai melewatkan website mu ini</span>`,
    {
      type: "textarea",
      id: "web-reason",
      // title: "Apa alasan singkat dibalik kenapa kamu ingin membuat website ini, dan beritahu alasan kenapa orang lain harus mendatangi dan jangan sampai melewatkan website mu ini",
      placeholder: "Ceritakan alasan atau mimpi besar di balik karyamu...",
      config: {
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
        ],
        popover: createPopover({
          info: "Tuliskan satu kalimat pemikat (Hero Headline) yang akan langsung dibaca pengunjung pertama kali.",
          placeholder: "Contoh: Membawa kehangatan anyaman tradisi ke ruang modern minimalis."
        })
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">Situs web ini dirancang secara personal, dan dirajut oleh</span>`,
    {
      type: "text",
      id: "web-author",
      // title: "Situs web ini dirancang secara personal, dan dirajut oleh",
      placeholder: "dirimu...",
      config: {
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
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
  // condition: { field: "web-type", equals: "ecommerce" },
  group: [
    `<span class="label" animation="typewriter" animation-chain="true">Untuk mengisi seluruh isi etalase data tokonya secara instan, silakan unggah baris berkas CSV</span>`,
    {
      type: "file",
      id: "product",
      // title: "Untuk mengisi seluruh isi etalase data tokonya secara instan, silakan unggah baris berkas CSV",
      placeholder: "Pilih file template .csv data...",
      config: {
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
          { name: "data-max-upload", value: 1 },
          { name: "accept", value: ".csv, text/csv, .json, text/json" },
          { name: "data-uploader-csv", value: "true" }
        ],
      }
    },
    createDownloadLink()
  ]
}

// const DetailSetGallery = {
//   id: "gallery-detail-set",
//   // condition: { field: "web-type", equals: "gallery" },
//   group: [
//     {
//       type: "file",
//       id: "gallery",
//       title: "Untuk mengisi seluruh isi etalase data gallery nya secara instan, silakan unggah baris berkas CSV",
//       placeholder: "Pilih file template .csv data...",
//       config: {
//         attributes: [
//           { name: "data-max-upload", value: 1 },
//           { name: "accept", value: ".csv, text/csv, .json, text/json" },
//           { name: "data-uploader-csv", value: "true" }
//         ],
//       }
//     },
//     createDownloadLink("gallery.csv")
//   ]
// }

const ContactSet = {
  id: "contact-set",
  group: [
    `<span class="label" animation="typewriter" animation-chain="true">Jika ada pengunjung atau calon pembeli yang ingin menyapa melalu surat elektronik mereka akan ditermia di</span>`,
    {
      type: "email",
      id: "email",
      // title: "Jika ada pengunjung atau calon pembeli yang ingin menyapa melalu surat elektronik mereka akan ditermia di",
      placeholder: "alamat email aktifmu",
      config: {
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
        ],
        popover: createPopover({
          placeholder: "contoh ruang.karya@indonesia.com",
          info: "Alamat email akan dicantumkan sebagai contact di website."
        })
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">Seluruh hak cipta dan kepemilikan operasional website ini bernaung di bawah</span>`,
    {
      type: "text",
      id: "company",
      // title: "Seluruh hak cipta dan kepemilikan operasional website ini bernaung di bawah",
      placeholder: "nama badan usaha / studionya",
      config: {
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
        ],
        popover: createPopover({
          placeholder: "contoh PT.Ruang Karya",
          info: "Nama perusahaan juga akan dicantumkan di website"
        })
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">Dan sebagai penanda identitas visual yang khas, mari sematkan gambar logo usahamu</span>`,
    {
      type: "file",
      id: "logo",
      // title: "Dan sebagai penanda identitas visual yang khas, mari sematkan gambar logo usahamu",
      placeholder: "unggah logo tokomu disini...",
      config: {
        attributes: [
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
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
    `<span class="label" animation="typewriter" animation-chain="true">Pusat workshop atau rumah tempat kerja mu ini beralamat di</span>`,
    {
      type: "textarea",
      id: "jalan",
      // title: "Pusat workshop atau rumah tempat kerja mu ini beralamat di",
      placeholder: "Tuliskan nama jalan, nomor rumah, atau ruko usahamu...",
      config: {
        popover: createPopover({
          info: "Alamat fisik ini akan memandu sistem peta direktori untuk mempromosikan lokasi workshop-mu.",
          placeholder: "Contoh: Jl. Tenun Ikat No. 12B, RT 02/RW 04"
        })
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">Tepatnya, wilayah tersebut berada di cakupan wilayah</span>`,
    {
      type: "select",
      // title: "Tepatnya, wilayah tersebut berada di cakupan wilayah",
      placeholder: "pilih provinsi...",
      config: {
        className: "loading",
        attributes: [
          { name: "data-level", value: "propinsi" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" }
        ]
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">pada wilayah administrasi daerah</span>`,
    {
      type: "select",
      // title: "pada wilayah administrasi daerah",
      placeholder: "pilih kota/kabupaten...",
      config: {
        attributes: [
          { name: "data-level", value: "kota" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" }
        ]
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">meluas ke area wilayah tingkat</span>`,
    {
      type: "select",
      // title: "meluas ke area wilayah tingkat",
      placeholder: "pilih kecamatan...",
      config: {
        attributes: [
          { name: "data-level", value: "kecamatan" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
        ]
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">hingga menyentuh batas terkecil di</span>`,
    {
      type: "select",
      // title: "hingga menyentuh batas terkecil di",
      placeholder: "pilih kelurahan...",
      config: {
        attributes: [
          { name: "data-level", value: "kelurahan" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" }
        ]
      }
    },
    `<span class="label" animation="typewriter" animation-chain="true">dengan penguncian kode pos resmi</span>`,
    {
      type: "text",
      title: "dengan penguncian kode pos resmi",
      placeholder: "kodepos",
      config: {
        attributes: [
          { name: "data-level", value: "kodepos" },
          { name: "animation", value: "fade-in" },
          { name: "animation-chain", value: "true" },
        ]
      }
    },
  ]
}

const ConfirmationSet = {
  id: "confirmation-set",
  group: [

    `<div animation="typewriter" animation-chain="true">
      <span>
        Menakjubkan! Anda sudah sampai sejauh ini, dan ini membuktikan seberapa besar keseriusan anda
        untuk membangun halaman pribadi anda sendiri.
      </span>
      <span>
        Sebelum system kami mewujudkan impian anda, kami membutuhkan konfirmasi dari anda bahwa data yang anda isikan 
        benar, tidak ditujukan untuk melakukan kejahatan siber, tindak kriminal atau kejahatan untuk melawan hukum lainnya, 
        tidak terkait dengan perjudian online, serta berisi konten yang mengandung pornografi.
      </span>
      <span>
        Apabila dikemudian hari ditemukan konten yang mengandung hal-hal yang disebutkan sebelumnya, 
        dan apabila konten tersebut mempunyai akibat hukum setelahnya itu sepenuhnya menjadi
        tanggung jawab anda. kami akan segera menghapus website tersebut, dan apabila diperlukan
        kami akan patuh membantu menyelesaikan perkara hukum akibat konten tersebut. 
      </span>
      <span>
        Silahkan periksa kembali seluruh konten yang telah anda isi.
        Jika sudah yakin silahkan berikan persetujuan anda lalu submit.
        System kami akan merajut data tersebut kedalam website yang nyata
      </span>
     </div>`
    ,
    {
      type: "checkbox",
      title: "setuju",
      position: "left",
      config: {
        style: "toggle"
      }
    }
  ]
}

const formConfig = {
  id: "wizardo",
  multistep: true,
  // cascading: true,
  selectors: {
    "@form>group": { tagName: "fieldset", className: "inline-style" },
  },
  // submitButton: false,
};

const formContent = [
  IntroSet,
  DetailSetShop,
  // DetailSetGallery,
  ContactSet,
  AddressSet,
  ConfirmationSet,
]

const wizard = {
  config: formConfig,
  schema: formContent
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
              //       attrs: { "animation": "fade-in", "animation-chain": "true" },
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
              //           form?.addEventListener("change", (e: any) => {
              //             const formEl = e.target.form as HTMLFormElement;
              //             const csvTemplateLink = formEl.querySelector("#csv-template") as HTMLAnchorElement;
              //             const filename = `${e.target.value}.csv`
              //             csvTemplateLink.href = `docs/${filename}`;
              //             csvTemplateLink.download = filename;
              //           })
              //           form?.addEventListener("formSubmit", (e: any) => {
              //             const detail = e.detail;
              //             console.log("AAA", e.detail)
              //             detail.complete(true, true)
              //           })
              //           el.parentElement?.replaceChildren(form)
              //         }, { once: true })
              //       }
              //     }
              //   },
              // },
              ".row$2": {

                onCreated: (el: HTMLElement, _renderFn: any, builderFn: any) => {
                  const form = builderFn("form", wizard)
                  form?.addEventListener("change", (e: any) => {
                    const formEl = e.target.form as HTMLFormElement;
                    const csvTemplateLink = formEl.querySelector("#csv-template") as HTMLAnchorElement;
                    const filename = `${e.target.value}.csv`
                    csvTemplateLink.href = `docs/${filename}`;
                    csvTemplateLink.download = filename;
                  })

                  form?.addEventListener("formSubmit", (e: any) => {
                    const detail = e.detail;
                    detail.complete(true, true)
                  })
                  el.append(form)
                }

              },
              // ".rows$3": {
              //   onCreated: (el: HTMLElement, _renderFn: any, _builderFn: any) => {
              //     const table = new TableBuilder(TablePageContent.config as any);
              //     const tableEl = table.create(TablePageContent.content)!
              //     el.append(tableEl);
              //   }
              // }
            }
          }
        }
      }
    }
  }
}



export function simpleCascade(form: HTMLFormElement) {
  form?.addEventListener("change", (e: any) => {
    console.log("form Changed:", e.target.form)
    const detailMap = new Map<string, HTMLFieldSetElement>()
    const formEl = e.target.form as HTMLFormElement;
    for (const f of formEl.querySelectorAll("fieldset")) {
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


