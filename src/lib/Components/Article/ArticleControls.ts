import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { ArticleSubModule } from "./ArticleBase";

export type ArticleControlsElementType =
  | "@article>controls"
  | "@article>controls>back"
  | "@article>controls>next"
  | "@article>controls>pagination"
  | "@article>controls>pagination>item"
  | "@article>controls>filter"
  | "@article>controls>view";

export interface iArticleControlsConfig extends iBuilderConfig<ArticleControlsElementType> {
  /** 🧩 PLACEMENT — komposisi deklaratif isi controls. */
  placement: Partial<Record<ArticleControlsElementType, string>>;
}

/** Config default controls — dipegang & dapat di-override dari controller. */
export const DEFAULT_ARTICLE_CONTROLS_CONFIG: Required<iArticleControlsConfig> = {
  themeId: "default",
  namespace: null,
  emit: () => { },
  selectors: {
    "@article>controls": { tagName: "div", className: "controls" },
    "@article>controls>back": { tagName: "button", className: "back" },
    "@article>controls>next": { tagName: "button", className: "next" },
    "@article>controls>pagination": { tagName: "div", className: "pagination" },
    "@article>controls>pagination>item": { tagName: "button", className: "item" },
    "@article>controls>filter": { tagName: "h2", className: "filter" },
    "@article>controls>view": { tagName: "button", className: "view" },
  },
  placement: {
    "@article>controls>back": "back-navigation",
    "@article>controls>pagination": "pagination",
  },
};

export class ArticleControlsBuilder extends ArticleSubModule<ArticleControlsElementType> {
  builderId = "article:controls" as keyof iBuilderRegistry;
  name = "article:controls" as keyof iBuilderRegistry;
  stylesheet: string = "";
  readonly rootKey: ArticleControlsElementType = "@article>controls";

  readonly config: Required<iArticleControlsConfig>;

  constructor(userConfig: Partial<iArticleControlsConfig> = {}) {
    super();
    this.config = this.mergeConfig(DEFAULT_ARTICLE_CONTROLS_CONFIG, userConfig);
  }

  get selectors(): Record<ArticleControlsElementType, iActionProperty> {
    return this.config.selectors as Record<ArticleControlsElementType, iActionProperty>;
  }

  protected template(typeKey: ArticleControlsElementType, el: HTMLElement, payload?: any, _props?: iActionProperty): void {
    switch (typeKey) {
      case "@article>controls": {
        for (const [key, slotName] of Object.entries(this.config.placement)) {
          const node = this.render(key as ArticleControlsElementType, payload) as HTMLElement | undefined;
          if (!node) continue;
          node.dataset.slot = slotName;
          el.appendChild(node);
        }
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
    }
  }
}
