// ================================================================
// WIZARD — halaman build wizard (rute #/build)
// ================================================================

import type { iNodeContent } from "../lib/interface";
import { buildStore, mockBuildResult, navigate } from "../lib/Modules/BuildStore";
import type { BuildApiResponse } from "../lib/Modules/BuildStore";

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
      placeholder: "dirimu..",
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
  downloadTemplateLink.download = filename.split(".")[0];
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
      // condition: { field: "web-name", filled: true },
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
function mountWizard(container: HTMLElement, builderFn: any): void {
  const form = builderFn("form", wizard);
  if (!form) return;

  form.addEventListener("change", (e: any) => {
    const formEl = e.target.form as HTMLFormElement;
    const csvTemplateLink = formEl?.querySelector("#csv-template") as HTMLAnchorElement | null;
    if (!csvTemplateLink) return;
    csvTemplateLink.href = `docs/${e.target.value}.csv`;
    csvTemplateLink.download = `${e.target.value}.csv`;
  });

  form.addEventListener("formSubmit", async (e: any) => {
    const detail = e.detail;
    console.log("formSubmit", detail.data);

    // TODO: ganti dengan fetch() sungguhan ke Apps Script Orkestrator.
    // Respons server selalu terbungkus { status, meta, data } — data berisi detail.
    const response: BuildApiResponse = await mockBuildResult();

    // Simpan respons terakhir supaya halaman `result` bisa membacanya.
    buildStore.response = response;

    // Redirect ke halaman hasil: menampilkan sheet/repo/live + panduan.
    navigate("result");
  });

  form.addEventListener("formValidation", (e: any) => {
    const validation = e.detail;
    console.log("[Form Validation]", validation.reason, validation.message, validation);
  });

  container.appendChild(form);
  // Setelah form terpasang, pindahkan tombol Mulai/nav agar kembali ke build:
  document.getElementById("start")?.classList.remove("button", "small");
}
export const BuildPageContent: iNodeContent =
{
  "#app": {
    content: {
      "nav": {
        attrs: { "class": "top" },
        content: {
          ".brand": { attrs: { href: "#home" }, content: "Rajutan", onCreated: (el: HTMLElement) => el.addEventListener("click", () => navigate("home")) },
          ".navigations": {
            "a.item#build-home": { attrs: { href: "#home" }, content: "Beranda", onCreated: (el: HTMLElement) => el.addEventListener("click", () => navigate("home")) },
          },
        }
      },
      "main": {
        content: {
          "section#build": {
            content: {
              "h3.title": {
                attrs: { "animation": "fade-in", "animated-once": "true" },
                content: "Rakit Website Anda"
              },
              "p.description": {
                content: "Jawab beberapa pertanyaan lalu kami merajutnya menjadi website yang hidup — data, kode, dan hak miliknya langsung jadi milik Anda."
              },
              "#wizard": {
                onCreated: (el: HTMLElement, _renderFn: any, builderFn: any) => {
                  mountWizard(el, builderFn);
                }
              }
            }
          }
        }
      }
    }
  }
}
