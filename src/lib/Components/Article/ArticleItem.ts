import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { ArticleSubModule } from "./ArticleBase";

export type ArticleItemElementType =
  | "@article>item"
  | "@article>item>thumb"
  | "@article>item>title"
  | "@article>item>meta"
  | "@article>item>caption";

export interface iArticleItemConfig extends iBuilderConfig<ArticleItemElementType> {
  view: "list" | "card";
  showThumb?: boolean;
  showMeta?: boolean;
}

/** Config default item — dipegang & dapat di-override dari controller. */
export const DEFAULT_ARTICLE_ITEM_CONFIG: Required<iArticleItemConfig> = {
  themeId: "default",
  namespace: null,
  emit: () => { },
  selectors: {
    "@article>item": { tagName: "article", className: "item" },
    "@article>item>thumb": { tagName: "figure", className: "thumbnail" },
    "@article>item>title": { tagName: "h3", className: "title" },
    "@article>item>meta": { tagName: "div", className: "meta" },
    "@article>item>caption": { tagName: "p", className: "caption" },
  },
  view: "list",
  showThumb: true,
  showMeta: true,
};

export class ArticleItemBuilder extends ArticleSubModule<ArticleItemElementType> {
  builderId = "article:item" as keyof iBuilderRegistry;
  name = "article:item" as keyof iBuilderRegistry;
  stylesheet: string = "";
  readonly rootKey: ArticleItemElementType = "@article>item";

  readonly config: Required<iArticleItemConfig>;

  constructor(userConfig: Partial<iArticleItemConfig> = {}) {
    super();
    this.config = this.mergeConfig(DEFAULT_ARTICLE_ITEM_CONFIG, userConfig);
  }

  get selectors(): Record<ArticleItemElementType, iActionProperty> {
    return this.config.selectors as Record<ArticleItemElementType, iActionProperty>;
  }

  /** Item kardu penting: stampa _articlePayload agar controller bisa baca slug. */
  public override build(content: any): HTMLElement {
    const root = super.build(content);
    (root as any)._articlePayload = content;
    return root;
  }

  protected template(typeKey: ArticleItemElementType, el: HTMLElement, payload?: any, _props?: iActionProperty): void {
    if (!payload && typeKey !== "@article>item") return;

    switch (typeKey) {
      case "@article>item": {
        if (this.config.showThumb && payload.thumbnail) {
          const thumb = this.render("@article>item>thumb", payload.thumbnail);
          if (thumb) el.appendChild(thumb);
        }
        const title = this.render("@article>item>title", payload.title);
        if (title) el.appendChild(title);
        const caption = this.render("@article>item>caption", payload.summary);
        if (caption) el.appendChild(caption);
        if (this.config.showMeta) {
          const meta = this.render("@article>item>meta", { author: payload.author, date: payload.date });
          if (meta) el.appendChild(meta);
        }
        break;
      }

      case "@article>item>thumb": {
        const img = document.createElement("img");
        img.src = encodeURI(payload);
        el.appendChild(img);
        break;
      }

      case "@article>item>title":
        el.textContent = payload || "Untitled";
        break;

      case "@article>item>meta": {
        const author = payload.author || "Admin";
        const date = payload.date || "";
        el.innerHTML = `<span class="meta-author">${author}</span>${date ? `<span class="meta-divider">•</span><span class="meta-date">${date}</span>` : ""}`;
        break;
      }

      case "@article>item>caption":
        el.textContent = payload || "";
        break;
    }
  }
}