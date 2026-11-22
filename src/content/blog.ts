// ================================================================
// BLOG — rute halaman artikel dengan mock data dari server (output.json)
// ================================================================

import type { iNodeContent } from "@aio-ui/core";
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
  "main#blog.page": {
    onCreated: (el: HTMLElement, _renderFn: any, builderFn: any) => {
      el.mount(builderFn("article", ARTICLE_RESPONSE));
    }
  },

}

