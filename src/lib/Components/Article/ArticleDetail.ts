import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { ArticleSubModule } from "./ArticleBase";

export type ArticleDetailElementType =
  | "@article>detail"
  | "@article>detail>cover"
  | "@article>detail>header"
  | "@article>detail>title"
  | "@article>detail>meta"
  | "@article>detail>body";

export interface iArticleDetailConfig extends iBuilderConfig<ArticleDetailElementType> {
  showBack?: boolean;
}

/** Config default detail — dipegang & dapat di-override dari controller. */
export const DEFAULT_ARTICLE_DETAIL_CONFIG: Required<iArticleDetailConfig> = {
  themeId: "default",
  namespace: null,
  emit: () => { },
  selectors: {
    "@article>detail": { tagName: "article", className: "detail" },
    "@article>detail>cover": { tagName: "figure", className: "cover" },
    "@article>detail>header": { tagName: "header", className: "header" },
    "@article>detail>title": { tagName: "h1", className: "title" },
    "@article>detail>meta": { tagName: "div", className: "meta" },
    "@article>detail>body": { tagName: "div", className: "body" },
  },
  showBack: false,
};

export class ArticleDetailBuilder extends ArticleSubModule<ArticleDetailElementType> {
  builderId = "article:detail" as keyof iBuilderRegistry;
  name = "article:detail" as keyof iBuilderRegistry;
  stylesheet: string = "";
  readonly rootKey: ArticleDetailElementType = "@article>detail";

  readonly config: Required<iArticleDetailConfig>;

  constructor(userConfig: Partial<iArticleDetailConfig> = {}) {
    super();
    this.config = this.mergeConfig(DEFAULT_ARTICLE_DETAIL_CONFIG, userConfig);
  }

  get selectors(): Record<ArticleDetailElementType, iActionProperty> {
    return this.config.selectors as Record<ArticleDetailElementType, iActionProperty>;
  }

  protected template(typeKey: ArticleDetailElementType, el: HTMLElement, payload?: any, _props?: iActionProperty): void {
    if (!payload) return;

    switch (typeKey) {
      case "@article>detail": {
        if (payload.largeCover || payload.thumbnail) {
          const cover = this.render("@article>detail>cover", payload.largeCover || payload.imageUrl);
          if (cover) el.appendChild(cover);
        }
        const header = this.render("@article>detail>header", payload);
        if (header) el.appendChild(header);
        const body = this.render("@article>detail>body", payload.body);
        if (body) el.appendChild(body);
        break;
      }

      case "@article>detail>cover": {
        const img = document.createElement("img");
        img.className = "cover";
        img.src = encodeURI(payload);
        el.appendChild(img);
        break;
      }

      case "@article>detail>header":
        const title = this.render("@article>detail>title", payload.title)!
        if (title) el.appendChild(title);
        const meta = this.render("@article>detail>meta", { date: payload.date, author: payload.author })!
        if (meta) el.appendChild(meta);
        break;

      case "@article>detail>title":
        el.textContent = payload || "Untitled Article";
        break;

      case "@article>detail>meta":
        el.insertAdjacentHTML("afterbegin", `
          <span class="author">Oleh: <strong>${payload.author || "Admin"}</strong></span>
          <span class="divider">•</span>
          <span class="date">${payload.date || "Baru saja"}</span>
        `.trim());
        break;

      case "@article>detail>body":
        el.insertAdjacentHTML("afterbegin", payload)
        break;
    }
  }
}
