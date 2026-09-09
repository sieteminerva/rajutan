import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { ArticleSubModule } from "./ArticleBase";

export type ArticleAsideElementType =
  | "@article>aside"
  | "@article>aside>title"
  | "@article>aside>block"
  | "@article>aside>item"
  | "@article>aside>item>thumbnail"
  | "@article>aside>item>header";

export interface iArticleAsideConfig extends iBuilderConfig<ArticleAsideElementType> {
  position: "left" | "right";
  recommendation: number | boolean;
  filter: boolean;
  items: number;
}

/** Config default aside — dipegang & dapat di-override dari controller. */
export const DEFAULT_ARTICLE_ASIDE_CONFIG: Required<iArticleAsideConfig> = {
  themeId: "default",
  namespace: null,
  emit: () => { },
  selectors: {
    "@article>aside": { tagName: "aside", className: "aside" },
    "@article>aside>block": { tagName: "div", className: "block recommendations" },
    "@article>aside>title": { tagName: "button", className: "title" },
    "@article>aside>item": { tagName: "header", className: "item" },
    "@article>aside>item>thumbnail": { tagName: "figure" },
    "@article>aside>item>header": { tagName: "header" },
  },
  position: "right",
  recommendation: 0,
  filter: false,
  items: 5,
};

export class ArticleAsideBuilder extends ArticleSubModule<ArticleAsideElementType> {
  builderId = "article:aside" as keyof iBuilderRegistry;
  name = "article:aside" as keyof iBuilderRegistry;
  stylesheet: string = "";
  readonly rootKey: ArticleAsideElementType = "@article>aside";

  readonly config: Required<iArticleAsideConfig>;

  constructor(userConfig: Partial<iArticleAsideConfig> = {}) {
    super();
    this.config = this.mergeConfig(DEFAULT_ARTICLE_ASIDE_CONFIG, userConfig);
  }

  get selectors(): Record<ArticleAsideElementType, iActionProperty> {
    return this.config.selectors as Record<ArticleAsideElementType, iActionProperty>;
  }

  protected template(typeKey: ArticleAsideElementType, el: HTMLElement, payload?: any, _props?: iActionProperty): void {
    switch (typeKey) {
      case "@article>aside":
        // Komposisi penuh aside dilakukan di sini.
        if (this.config.recommendation && Array.isArray(payload?.data)) {
          el.setAttribute("position", this.config.position || "left");
          const block = this.render("@article>aside>block", payload);
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
        const thumbnail = this.render("@article>aside>item>thumbnail", payload.thumbnail)!;
        const header = this.render("@article>aside>item>header", { title: payload.title, date: payload.date })!
        el.append(thumbnail, header)
        break;


      case "@article>aside>item>thumbnail":
        const thumb = document.createElement("img");
        thumb.src = payload || "";
        el.appendChild(thumb);
        break;


      case "@article>aside>item>header":
        const title = document.createElement("h4");
        title.textContent = payload?.title || "";
        el.appendChild(title);
        if (payload?.date) {
          const date = document.createElement("span");
          date.className = "meta";
          date.textContent = payload.date;
          el.appendChild(date);
        }
        break;

    }
  }
}
