// ================================================================
// RESULT — ringkasan situs yang sudah jadi (rute #/result)
// ================================================================

import type { iNodeContent } from "../lib/interface";
import { buildStore, navigate } from "../lib/Modules/BuildStore";
import type { SiteBuildResult } from "../lib/Modules/BuildStore";

function buildResultLinks(data: SiteBuildResult | null, container: HTMLElement): HTMLElement {
  // console.log({ data })
  // const container = document.createElement("section");

  if (!data) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.innerHTML = `<p>Belum ada hasil build di sesi ini. <a href="#build">Mulai buat websitemu</a>.</p>`;
    container.appendChild(empty);
  } else {

    const assets: Array<{ icon: string; label: string; title: string; url: string }> = [];
    if (data.live) assets.push({ icon: "weburl", label: "Situs Anda Live", ...data.live });
    if (data.sheet) assets.push({ icon: "google logo", label: "Google Sheets", ...data.sheet });
    if (data.repo) assets.push({ icon: "github logo", label: "Repositori GitHub", ...data.repo });

    const detail = document.createElement("div");
    detail.className = "details row";

    assets.forEach((asset) => {
      const item = document.createElement("div");
      item.className = "item"

      const icon = document.createElement("i");
      icon.className = `icon ${asset.icon}`;

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = asset.label;

      const link = document.createElement("a");
      link.className = "link";
      link.href = asset.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = asset.title;

      item.append(icon, label, link);
      detail.appendChild(item);
    });

    container.appendChild(detail);

    // Panduan selanjutnya
    if (data.guide && data.guide.length > 0) {
      const guideWrap = document.createElement("div");
      guideWrap.className = "guide row";
      const heading = document.createElement("h3");
      heading.textContent = "Langkah Selanjutnya";
      guideWrap.appendChild(heading);

      data.guide.forEach((step) => {
        const item = document.createElement("div");
        item.className = "item";
        const title = document.createElement("strong");
        title.textContent = step.title;
        const body = document.createElement("p");
        body.textContent = step.body;
        item.append(title, body);
        if (step.cta) {
          const cta = document.createElement("a");
          cta.href = step.cta.href;
          cta.target = "_blank";
          cta.rel = "noopener noreferrer";
          cta.className = "link small";
          cta.textContent = step.cta.label;
          item.appendChild(cta);
        }
        guideWrap.appendChild(item);
      });

      container.appendChild(guideWrap);
    }
  }

  return container;

}

export const ResultPageContent: iNodeContent =
{
  "#app": {
    content: {
      "nav": {
        content: {
          ".brand": { attrs: { href: "#home" }, content: "Rajutan", onCreated: (el: HTMLElement) => el.addEventListener("click", () => navigate("home")) },
          ".navigations": {
            "a.item#result-home": { attrs: { href: "#home" }, content: "Beranda", onCreated: (el: HTMLElement) => el.addEventListener("click", () => navigate("home")) },
            "a.item#result-build": { attrs: { href: "#build" }, content: "Buat Lagi", onCreated: (el: HTMLElement) => el.addEventListener("click", () => navigate("build")) },
          },
        }
      },
      "main#result": {
        content: {
          "header": {
            content: {
              "h3.title": {
                content: "Situs Anda Berhasil Dirajut 🎉"
              },
              "p.description": {
                content: (buildStore.response?.data?.message) || "Selamat! Semua aset penting kini berpindah ke akun Anda."
              }
            },
          },
          "section#assets": {
            onCreated: (el: HTMLElement) => {
              buildResultLinks(buildStore.response?.data ?? null, el)
            }
          }
        }
      }
    }
  }
}
