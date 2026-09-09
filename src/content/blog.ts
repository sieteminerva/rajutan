// ================================================================
// BLOG — rute halaman artikel dengan mock data dari server (output.json)
// ================================================================

import type { iNodeContent } from "../lib/interface";
import { navigate } from "../lib/Modules/BuildStore";
import blogPayload from "./output.json";

// =====================================================================
// 🗞️ MOCK RESPONS SERVER (HATEOAS)
// =====================================================================
// Payload persis berbentuk respons Apps Script: { status, meta, data }.
// - `meta.links`  → pagination (self/first/prev/next/last)
// - `data[]`       → daftar kartu artikel ringkas
const ARTICLE_RESPONSE = blogPayload as any;


export const BlogPageContent: iNodeContent =
{
  "#app": {
    content: {
      "nav": {
        content: {
          ".brand": { attrs: { href: "#home" }, content: "Rajutan", onCreated: (el: HTMLElement) => el.addEventListener("click", () => navigate("home")) }
        },
        ".navigations": {
          "a.item#blog-home": { attrs: { href: "#home" }, content: "Beranda", onCreated: (el: HTMLElement) => el.addEventListener("click", () => navigate("home")) }
        },
      },
      "main#blog": {
        onCreated: (el: HTMLElement, _renderFn: any, builderFn: any) => {
          el.mount(builderFn("article", ARTICLE_RESPONSE));
        }
      }
    },
  },

}

