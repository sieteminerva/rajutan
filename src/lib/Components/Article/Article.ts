import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { createImageError } from "../../Utility/DomUtils";
import { Builder } from "../Base";

export type ArticleElementType =
  | "@container"
  | "@article>list"
  | "@article>pagination"

  | "@article>figure"
  | "@article>header"
  | "@article>header>title"
  | "@article>header>meta"


  | "@article>item"
  | "@article>item>caption"

  | "@article>aside"
  | "@article>aside>title"
  | "@article>aside>block"
  | "@article>aside>item"

  | "@article>controls"
  | "@article>controls>back"
  | "@article>controls>next"
  | "@article>controls>pagination"
  | "@article>controls>pagination>item"
  | "@article>controls>filter"
  | "@article>controls>view"

  | "@article>detail"
  | "@article>detail>header"
  | "@article>detail>body"
  ;

export interface iArticleSlotSpec {
  slot: string;
  view?: "list" | "card";
  count?: number;
  props?: Record<string, unknown>;
}

export interface iArticleConfig extends iBuilderConfig<ArticleElementType> {
  navigate: (slug: any, themeId: string) => void;
  slots?: iArticleSlotSpec[];
  view?: "list" | "card";
  position?: "left" | "right";
  recommendation?: number | boolean;
  items?: number;
}

export class ArticleBuilder extends Builder<ArticleElementType, iArticleConfig> {
  readonly builderId: keyof iBuilderRegistry = "article";
  readonly name: keyof iBuilderRegistry = "article";
  stylesheet: string = "./Article.css";

  // State internal modul
  private currentRawServerResponse: any = null;
  private slotSpecs: iArticleSlotSpec[] = [];
  /** Simpan list view saat detail aktif, agar bisa dikembalikan via tombol back. */
  private listElement: HTMLElement | null = null;

  constructor(config: Partial<iArticleConfig> = {}) {
    super();
    const defaultSelectors: Record<ArticleElementType, iActionProperty> = {
      "@container": { tagName: "section", className: "article" },
      "@article>list": { tagName: "div", className: "row" },
      "@article>pagination": { tagName: "div", className: "pagination" },
      "@article>figure": { tagName: "figure", className: "media" },
      "@article>header": { tagName: "header", className: "item" },
      "@article>header>title": { tagName: "h3", className: "title" },
      "@article>header>meta": { tagName: "div", className: "meta" },

      "@article>item": { tagName: "article", className: "item" },
      "@article>item>caption": { tagName: "p", className: "caption" },

      "@article>aside": { tagName: "aside", className: "aside" },
      "@article>aside>block": { tagName: "div", className: "block recommendations" },
      "@article>aside>title": { tagName: "button", className: "title" },
      "@article>aside>item": { tagName: "a", className: "item" },

      "@article>controls": { tagName: "div", className: "controls" },
      "@article>controls>back": { tagName: "button", className: "back" },
      "@article>controls>next": { tagName: "button", className: "next" },
      "@article>controls>pagination": { tagName: "div", className: "pagination" },
      "@article>controls>pagination>item": { tagName: "button", className: "item" },
      "@article>controls>filter": { tagName: "h2", className: "filter" },
      "@article>controls>view": { tagName: "button", className: "view" },

      "@article>detail": { tagName: "article", className: "detail" },
      "@article>detail>header": { tagName: "header", className: "header" },
      "@article>detail>body": { tagName: "div", className: "body" },
    };

    const defaultConfig: Required<iArticleConfig> = {
      themeId: "default",
      selectors: defaultSelectors,
      namespace: null,
      slots: [],
      view: "card",
      position: "right",
      recommendation: 5,
      items: 5,
      navigate: () => { },
      emit: () => { },
    };

    this.config = this.resolveConfig(defaultConfig, config);
    this.slotSpecs = this.config.slots?.length ? this.config.slots : [
      { slot: "controls" },
      { slot: "list", view: "card" },
      { slot: "aside", count: this.config.items ?? 5 },
    ];
  }

  /**
   * 👑 COMPOSITION — membangun kontainer modul dan seluruh slot:
   * controls (back + pagination) → list grid (item[]) → aside (rekomendasi).
   * Interaksi terpasang via bindInteractions().
   */
  public prepare(content: any, _config?: Required<iArticleConfig>): HTMLElement {
    this.currentRawServerResponse = content?.content || content || {};

    const container = this.render("@container", this.currentRawServerResponse) as HTMLElement;

    const slotFor = (role: string): boolean => this.slotSpecs.length === 0 || this.slotSpecs.some((s) => s.slot === role);

    // ── 1. CONTROLS (back + pagination HATEOAS) ───────────────────────────
    if (slotFor("controls")) {
      const controls = this.render("@article>controls", this.currentRawServerResponse) as HTMLElement | undefined;
      if (controls) {
        controls.dataset.slot = "controls";
        const back = this.render("@article>controls>back", { label: "Kembali" }) as HTMLElement | undefined;
        if (back) {
          back.dataset.slot = "back-navigation";
          controls.appendChild(back);
        }
        const pagination = this.render("@article>controls>pagination", this.currentRawServerResponse) as HTMLElement | undefined;
        if (pagination) {
          pagination.dataset.slot = "pagination";
          controls.appendChild(pagination);
        }
        container.appendChild(controls);
      }
    }

    // ── 2. LIST — grid kartu artikel dari data[] ──────────────────────────
    if (slotFor("list")) {
      const grid = document.createElement("div");
      grid.className = "row";
      grid.dataset.slot = "list";
      grid.dataset.display = this.config.view || "card";

      const articles = Array.isArray(this.currentRawServerResponse?.data)
        ? this.currentRawServerResponse.data
        : [];
      articles.forEach((article: any) => {
        const item = this.render("@article>item", article) as HTMLElement | undefined;
        if (item) {
          (item as any)._articlePayload = article;
          (item as any)._articleSlugToken = article.slug;
          grid.appendChild(item);
        }
      });
      grid.dataset.listHost = "true";
      container.appendChild(grid);
    }

    // ── 3. ASIDE — rekomendasi dari data[] ────────────────────────────────
    if (this.config.recommendation && Array.isArray(this.currentRawServerResponse?.data)) {
      const aside = this.render("@article>aside", this.currentRawServerResponse) as HTMLElement | undefined;
      if (aside) {
        aside.dataset.slot = "aside";
        container.appendChild(aside);
      }
    }

    // ── 4. Pasang interaksi terpusat (klik kartu → detail, back → list) ───
    this.bindInteractions(container);

    return container;
  }

  // =====================================================================
  // 🎮 INTERAKSI TERPUSAT — controller memegang seluruh event delegation.
  // =====================================================================

  /** Pasang click delegation pada container modul. */
  private bindInteractions(container: HTMLElement): void {
    container.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLElement;

      // A. Klik kartu artikel (list) atau item rekomendasi (aside) → detail
      const card = target.closest('[data-slot="list"] .item, article.item, aside.aside .item') as HTMLElement | null;
      const article = card ? (card as any)._articlePayload : null;
      if (card && article) {
        this.showDetail(container, article);
        return;
      }

      // B. Klik tombol kembali → tampilkan kembali list view
      const backBtn = target.closest('[data-slot="back-navigation"], button.back') as HTMLElement | null;
      if (backBtn) {
        this.showList(container);
        return;
      }

      // C. Klik tombol pagination HATEOAS → emit elementChanged
      const pageBtn = target.closest(".pagination .item") as HTMLElement | null;
      if (pageBtn && pageBtn.dataset.url) {
        this.config.emit?.("elementChanged", {
          builder: this.builderId,
          type: "@article>pagination",
          element: pageBtn,
          data: { endpoint: pageBtn.dataset.url, module: this },
        } as any);
      }
    });
  }

  /** Tampilkan view detail untuk satu artikel (menggantikan list atau detail aktif). */
  private showDetail(container: HTMLElement, article: any = null): void {
    if (!article) return;

    const currentDetail = container.querySelector("article.detail") as HTMLElement | null;

    if (!currentDetail) {
      const grid = container.querySelector('[data-slot="list"]') as HTMLElement | null;
      if (!grid) return;
      // Simpan list view agar bisa dikembalikan persis apa adanya.
      this.listElement = grid;
    }

    const detail = this.render("@article>detail", article) as HTMLElement;
    if (!detail) return;
    detail.dataset.slot = "detail";

    // Perbarui URL hash secara pasif memakai format kanonik router:
    // #route/slug?theme=... (tanpa trigger render ulang)
    if (article.slug) {
      history.pushState({ slug: article.slug }, "", this.buildSlugHash(article.slug));
    }

    if (currentDetail) currentDetail.replaceWith(detail); // detail → detail
    else this.listElement!.replaceWith(detail);           // list → detail
  }

  /**
   * Bangun hash slug dengan format kanonik HashRouter:
   * #route/slug?theme=... — agar parseUrlHash() membacanya sebagai
   * fragment (bukan merusak query, seperti saat append mentah).
   */
  private buildSlugHash(slug: string): string {
    const raw = location.hash.replace(/^#/, "");
    const [pathPart, queryPart] = raw.split("?");
    const base = pathPart.split("/")[0] || "blog";
    return `#${base}/${encodeURIComponent(slug)}${queryPart ? `?${queryPart}` : ""}`;
  }

  /** Kembalikan ke list view. */
  private showList(container: HTMLElement): void {
    if (!this.listElement) return;
    const detail = container.querySelector("article.detail");
    if (detail) detail.replaceWith(this.listElement);

    // Bersihkan suffix slug dari hash: #blog/slug?theme=... → #blog?theme=...
    const raw = location.hash.replace(/^#/, "");
    if (raw.includes("/")) {
      const [pathPart, queryPart] = raw.split("?");
      const base = pathPart.split("/")[0];
      history.pushState({}, "", `#${base}${queryPart ? `?${queryPart}` : ""}`);
    }

    this.listElement = null;
  }

  protected template(typeKey: ArticleElementType, el: HTMLElement, payload?: any, _props?: iActionProperty): void {
    switch (typeKey) {
      case "@container":

        break;
      case "@article>figure":
        const image = document.createElement("img");
        image.src = encodeURI(payload);
        image.onerror = (_e: any) => {
          image.src = createImageError();
        };
        el.appendChild(image);

        break;

      case "@article>header":
        const titleX = this.render("@article>header>title", payload.title);
        if (titleX) el.appendChild(titleX);

        const metaX = this.render("@article>header>meta", { author: payload.author, date: payload.date });
        if (metaX) el.appendChild(metaX);

        break;

      case "@article>header>title":
        el.textContent = payload || "Untitled Article";
        break;

      case "@article>header>meta":
        if (payload.author) {
          el.insertAdjacentHTML("afterbegin", `
                  <span class="author">Oleh: <strong>${payload.author || "Admin"}</strong></span>
                  <span class="divider">•</span>
                  <span class="date">${payload.date || "Baru saja"}</span>
                `.trim());
        } else {
          el.insertAdjacentHTML("afterbegin", `
                  <span class="date">${payload.date || "Baru saja"}</span>
                `.trim());
        }
        break;

      case "@article>controls": {

        break;
      }

      case "@article>controls>back":
        const iconBack = document.createElement("i");
        iconBack.className = "icon arrow left";
        el.textContent = payload?.backLabel || payload?.label || "back";
        el.prepend(iconBack);
        break;

      case "@article>controls>next":
        const iconNext = document.createElement("i");
        iconNext.className = "icon arrow left";
        el.textContent = payload?.label || "next";
        el.append(iconNext);
        break;

      case "@article>controls>view":
        const iconDisplay = document.createElement("i");
        iconDisplay.className = "icon display list";
        el.title = payload?.label || "display list";
        el.append(iconDisplay);
        break;

      case "@article>controls>pagination":
        const links = payload?.meta?.links || payload?.links;
        if (!links) break;
        for (const [role, href] of Object.entries(links) as [string, string | null][]) {
          if (!href) continue;
          const item = this.render("@article>controls>pagination>item", { role, href }) as HTMLElement | undefined;
          if (item) el.appendChild(item);
        }
        break;


      case "@article>controls>pagination>item":
        el.textContent = String((payload?.role || "").toUpperCase());
        if (payload?.href) {
          el.dataset.role = payload.role;
          el.dataset.url = payload.href;
          (el as any)._hateoasServerUrl = payload.href;
        }
        if (payload?.active) el.classList.add("active-page");
        break;


      case "@article>controls>filter":
        el.textContent = payload?.filter || "";
        break;

      case "@article>item":
        if (payload.thumbnail) {
          const thumb = this.render("@article>figure", payload.thumbnail);
          thumb!.className = "thumbnail"
          if (thumb) el.appendChild(thumb);
        }

        const headerX = this.render("@article>header", { title: payload.title, author: payload.author, date: payload.date })!
        if (headerX) el.appendChild(headerX)

        const caption = this.render("@article>item>caption", payload.summary);
        if (caption) el.appendChild(caption);
        break;

      case "@article>item>caption":
        el.textContent = payload || "";
        break;

      case "@article>aside":
        // Komposisi penuh aside dilakukan di sini.
        if (this.config.recommendation && Array.isArray(payload?.data)) {
          el.setAttribute("position", this.config.position || "right");
          const title = this.render("@article>aside>title", { title: "Rekomendasi" }) as HTMLElement | undefined;
          if (title) el.appendChild(title);
          const block = this.render("@article>aside>block", payload) as HTMLElement | undefined;
          if (block) el.appendChild(block);
        }
        break;


      case "@article>aside>title":
        el.textContent = payload?.title || "Rekomendasi";
        break;

      case "@article>aside>block":
        const items = payload.data.slice(0, this.config.items ?? 5);
        items.forEach((item: any) => {
          const node = this.render("@article>aside>item", item);
          if (node) el.appendChild(node);
        });
        break;


      case "@article>aside>item":
        // Suntikkan payload agar controller bisa membukanya di detail view.
        (el as any)._articlePayload = payload;
        const thumbnail = this.render("@article>figure", payload.thumbnail)!;
        const h = this.render("@article>header", { title: payload.title, date: payload.date })!
        el.append(thumbnail, h)
        break;


      case "@article>detail":
        if (payload.largeCover || payload.thumbnail) {
          const cover = this.render("@article>figure", payload.largeCover || payload.imageUrl);
          cover!.className = "cover"
          if (cover) el.appendChild(cover);
        }
        const header = this.render("@article>header", payload);
        if (header) el.appendChild(header);
        const body = this.render("@article>detail>body", payload.body);
        if (body) el.appendChild(body);
        break;

      case "@article>detail>body":
        el.insertAdjacentHTML("afterbegin", payload)
        break;
    }
  }

  public initialize(_el?: HTMLElement, _payload?: any, _context?: any): void {
    // Interaksi sudah terpasang otomatis di prepare() lewat bindInteractions().
  }
}