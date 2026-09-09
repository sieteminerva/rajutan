import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";
import { ArticleItemBuilder, type iArticleItemConfig } from "./ArticleItem";
import { ArticleDetailBuilder, type iArticleDetailConfig } from "./ArticleDetail";
import { ArticleControlsBuilder, type iArticleControlsConfig } from "./ArticleControls";
import { ArticleAsideBuilder, type iArticleAsideConfig } from "./ArticleAside";
import {
  DEFAULT_ARTICLE_SLOTS,
  type ArticleComponentKey,
  type iArticleSlotSpec
} from "./ArticleSlot";

export type ArticleModuleElementType =
  | "@container"
  | "@article>list"
  | "@article>pagination";

export interface iArticleConfig extends iBuilderConfig<ArticleModuleElementType> {
  navigate: (slug: any, themeId: string) => void;
  slots?: iArticleSlotSpec[];
  /** Komposisi config sub-builder (item/detail/controls/aside). */
  sub?: Partial<iArticleModuleSubConfigs>;
}

/** Config nested untuk tiap sub-builder — diubah dari satu tempat di controller. */
export interface iArticleModuleSubConfigs {
  item: iArticleItemConfig;
  detail: iArticleDetailConfig;
  controls: iArticleControlsConfig;
  aside: iArticleAsideConfig;
}

export class ArticleController extends Builder<ArticleModuleElementType, iArticleConfig> {
  readonly builderId: keyof iBuilderRegistry = "article";
  readonly name: keyof iBuilderRegistry = "article";
  stylesheet: string = "./Article.css";

  // State internal modul
  private currentRawServerResponse: any = null;
  private slots: iArticleSlotSpec[] = DEFAULT_ARTICLE_SLOTS;
  private subConfig: Partial<iArticleModuleSubConfigs> = {};

  // 👶 SUB-BUILDERS — dimiliki & di-integrasikan ke storage SAMA dgn controller.
  private itemBuilder!: ArticleItemBuilder;
  private detailBuilder!: ArticleDetailBuilder;
  private controlsBuilder!: ArticleControlsBuilder;
  private asideBuilder!: ArticleAsideBuilder;

  /** Simpan list view saat detail aktif, agar bisa dikembalikan via tombol back. */
  private listElement: HTMLElement | null = null;

  constructor(config: Partial<iArticleConfig> = {}) {
    super();
    const defaultSelectors = {
      "@container": { tagName: "section", className: "article" },
      "@article:article": { tagName: "div", className: "content" },
    };
    const defaultConfig: Required<iArticleConfig> = {
      themeId: "default",
      selectors: defaultSelectors,
      namespace: null,
      slots: [],
      sub: {},
      emit: () => { },
      navigate: () => { },
    };
    this.config = this.resolveConfig(defaultConfig, config);
    this.slots = this.config.slots?.length ? this.config.slots : DEFAULT_ARTICLE_SLOTS;
    this.subConfig = this.config.sub || {};

    // 🔗 Bangun & INTEGRATE sub-builders → mereka berbagi `this.storage`.
    const emit = this.config.emit ?? undefined;
    this.itemBuilder = new ArticleItemBuilder({ ...(this.subConfig.item || {}), emit } as Partial<iArticleItemConfig>);
    this.detailBuilder = new ArticleDetailBuilder({ ...(this.subConfig.detail || {}), emit } as Partial<iArticleDetailConfig>);
    this.controlsBuilder = new ArticleControlsBuilder({ ...(this.subConfig.controls || {}), emit } as Partial<iArticleControlsConfig>);
    const asideCfg: Partial<iArticleAsideConfig> = this.subConfig.aside || {};
    this.asideBuilder = new ArticleAsideBuilder({
      ...asideCfg,
      emit,
      // recommendation default di-on → aside dipenampen (block rekomendasi).
      recommendation: asideCfg.recommendation ?? 5,
    });
    // 🤝 REGISTER: sub-builder menerima host (induk) → render lewat storage induk.
    this.register(this.itemBuilder, this.detailBuilder, this.controlsBuilder, this.asideBuilder);
  }

  /** Ambil sub-builder sesuai kunci slot (diintegrasi-kan, berbagi storage). */
  private subBuilderFor(key: ArticleComponentKey) {
    switch (key) {
      case "item": return this.itemBuilder;
      case "detail": return this.detailBuilder;
      case "controls": return this.controlsBuilder;
      case "aside": return this.asideBuilder;
      default: return null;
    }
  }

  // =====================================================================
  // 👑 CONTROLLER — membaca slot config, membangun holder `data-slot`,
  // mendelegasikan tiap sub-view ke sub-component masing-masing.
  // =====================================================================

  public prepare(serverResponse: any): HTMLElement {
    this.currentRawServerResponse = serverResponse?.content || serverResponse || {};

    const container = this.render("@container", this.currentRawServerResponse) as HTMLElement;

    // 1. Group slot per role agar "list" bisa menampung banyak "item"
    const listSlotSpec = this.slots.find((s) => s.builder === "item");
    const remaining = this.slots.filter((s) => s.builder !== "item");

    // 2. Bangun tiap slot (selain list) — sub-builder terintegrasi berbagi storage.
    for (const spec of remaining) {
      const builder = this.subBuilderFor(spec.builder);
      if (!builder) continue;
      const payload = { ...this.currentRawServerResponse, ...(spec.props || {}) };
      // aside butuh count → recommendation (di-set dari config/fitur)
      const child = builder.build(payload) as HTMLElement;
      if (child) {
        child.dataset.slot = spec.slot;
        this.attach(spec.slot, child);
      }
    }

    // 3. LIST: tampung item[] via itemBuilder terintegrasi.
    if (listSlotSpec) {
      const grid = document.createElement("div");
      grid.className = "row";
      grid.dataset.slot = listSlotSpec.slot;
      grid.dataset.display = this.config.sub.item?.view || "list";

      const articles = Array.isArray(this.currentRawServerResponse?.data)
        ? this.currentRawServerResponse.data
        : [];
      articles.forEach((article: any) => {
        const item = this.itemBuilder.build(article) as HTMLElement;
        (item as any)._articleSlugToken = article.slug;
        grid.appendChild(item);
      });

      // Suntikkan referensi grid agar detail bisa kembali ke sini
      grid.dataset.listHost = "true";
      this.attach(listSlotSpec.slot, grid);
    }

    // 4. Pasang interaksi terpusat (klik kartu → detail, back → list)
    this.bindInteractions(container, listSlotSpec);

    return container;
  }

  // =====================================================================
  // 🎮 INTERAKSI TERPUSAT — controller memegang seluruh event delegation.
  // Sub-component tetap "bodoh"; controller yang memutuskan pindah view.
  // =====================================================================

  /** Pasang click delegation pada container modul. */
  private bindInteractions(container: HTMLElement, listSlotSpec?: iArticleSlotSpec): void {
    container.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLElement;

      // A. Klik kartu artikel → tampilkan detail view
      // TODO replace to fragile depend on class
      const card = target.closest(".item") as HTMLElement | null;
      if (card && listSlotSpec) {
        const article = (card as any)._articlePayload;
        if (article) {
          this.showDetail(container, listSlotSpec, article);
          return;
        }
      }

      // A2. Klik item rekomendasi aside → tampilkan detail view juga
      // TODO replace to fragile depend on class depend on this.load("selectorKey") is more predictable
      const asideItem = target.closest(".aside") as HTMLElement | null;
      if (asideItem) {
        const article = (asideItem as any)._articlePayload;
        if (article) {
          this.showDetail(container, listSlotSpec, article);
          return;
        }
      }

      // B. Klik tombol kembali → tampilkan kembali list view
      //    (tombol dari controls: data-slot="back-navigation",
      //     atau tombol bawaan detail: .btn-back)
      //  TODO replace to fragile depend on class depend on this.load("selectorKey") is more predictable
      const backBtn = target.closest('[data-slot="back-navigation"], button.back') as HTMLElement | null;
      if (backBtn) {
        this.showList(container);
        return;
      }

      // C. Klik tombol pagination HATEOAS → emit elementChanged
      // TODO replace to fragile depend on class depend on this.load("selectorKey") is more predictable
      const pageBtn = target.closest(".item") as HTMLElement | null;
      if (pageBtn?.dataset.url) {
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
  private showDetail(container: HTMLElement, listSlotSpec?: iArticleSlotSpec, article: any = null): void {
    // Detail mungkin sudah terbuka (mis. klik rekomendasi aside saat membaca).
    // TODO replace to fragile depend on class depend on this.load("selectorKey") is more predictable
    const currentDetail = container.querySelector("article.detail") as HTMLElement | null;

    if (!currentDetail) {
      const grid = container.querySelector('[data-slot="' + (listSlotSpec?.slot ?? "list") + '"]') as HTMLElement | null;
      if (!grid) return;

      // Simpan list view agar bisa dikembalikan persis apa adanya.
      this.listElement = grid;
    }

    const detail = this.detailBuilder.build(article);

    // Perbarui URL hash secara pasif memakai format kanonik router:
    // #route/slug?theme=... (tanpa trigger render ulang)
    if (article.slug) {
      history.pushState({ slug: article.slug }, "", this.buildSlugHash(article.slug));
    }

    if (currentDetail) currentDetail.replaceWith(detail); // detail → detail
    else this.listElement!.replaceWith(detail);            // list → detail
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

  protected template(_typeKey: ArticleModuleElementType, _el: HTMLElement, _payload?: any, _props?: iActionProperty): void {
    // Komposisi dilakukan di prepare() lewat sistem slot — bukan di sini.
  }

  public initialize(_el?: HTMLElement, _payload?: any, _context?: any): void {
    // Interaksi sudah terpasang otomatis di prepare() lewat bindInteractions().
  }
}