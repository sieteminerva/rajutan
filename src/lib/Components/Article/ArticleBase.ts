// ======================================================================
// ArticleBase — kontrakt sub-builder modul Article (FRAME, bukan Builder).
//
// Sub-builder tidak lagi extends Builder. Alih-alih, ia isi kontrakt minimal
// (selectors + template + config) dan render lewat INDUK (host) — yang
// mengalirkan host.render(typeKey, payload, frame). Dengan pola FRAME ini:
//
//   ┌─────────────────────────────┐
//   │  ArticleController (Builder)│  ← pemilik storage & render()
//   └───────┬─────────────────────┘
//           │ .register(subA, subB, …)  → sub.host = this
//   ┌───────▼────────────┬─────────┐
//   │ ArticleItem (frame)│ Detail  │ … // selectors+template+config sendiri
//   └────────────────────┴─────────┘
//
// Frame render lewat host.render(k, p, frame) — node jadi berbagi storage
// induk tanpa sub ia sendiri jadi Builder.
// ======================================================================

import type { iActionProperty } from "../../interface";

/** Interface frame yang seorang sub-builder / harus diisi untuk render lewat induk. */
export interface iArticleSubModule<TType extends string = string> {
  /** Identitas sub-modul (untuk emit; pilihan). */
  builderId?: string;
  /** Root selector key — dirender ketika modul dibangun. */
  rootKey: TType;
  /** Pemetaan typeKey → selector, dipakai by host.render(k, p, frame). */
  selectors: Record<TType, iActionProperty>;
  /** Hook hidrasi per-typeKey. */
  template(typeKey: TType, el: HTMLElement, payload?: any, props?: iActionProperty): void;
  /** Referensi induk di-set lewat register(). */
  host?: any;
}

/**
 * 🛠️ ArtikelSubModule — basis bersama (NON-Builder) untuk setiap sub-builder.
 *
 * Ia bukan Builder: ia isi kontrakt FRAME + helper nyaman `render()` yang
 * meneroben lewat `host.render(typeKey, payload, this)`. Dengan demikian:
 *   - sub-builder tetap isi selectors+template+config sendiri;
 *   - node dibangun lewat host → storage induk → automatis berbagi;
 *   - no perlu extends Builder / tidak ada storage sendiri / tidak clear().
 */
export abstract class ArticleSubModule<TType extends string> {
  /** Root selector key — elemen puncak yang dirender oleh build(). */
  abstract readonly rootKey: TType;
  /** Identitas sub-modul — di-pakai untuk emit attrib (pilihan). */
  builderId?: string;

  /** Referensi induk (di-set lewat ArticleController.register()). */
  host: any = null;

  public setHost(host: any): this {
    this.host = host;
    return this;
  }

  /** Render satu node lewat induk, dengan frame=self → node ke storage induk. */
  protected render(typeKey: TType, payload?: any): HTMLElement | undefined {
    if (!this.host || typeof this.host.render !== "function") {
      console.warn(`[ArticleSubModule] "${this.rootKey}" belum di-register ke induk (host null).`);
      return undefined;
    }
    // 💡 Frame dengan template yang di-BIND ke `this` (sub-modul) — sehingga
    // template() bisa memakai this.config / this.render di dalamnya.
    const frame: iArticleSubModule<TType> = {
      builderId: this.builderId,
      rootKey: this.rootKey,
      selectors: this.selectors,
      template: (k: TType, e: HTMLElement, p?: any, s?: iActionProperty) => this.template(k, e, p, s),
    };
    return this.host.render(typeKey, payload, frame);
  }

  /** render elemen puncak `rootKey` + build (default: dia render root kontainer). */
  public build(content: any): HTMLElement {
    return this.render(this.rootKey, content) as HTMLElement;
  }

  /** Isi kontrakt `selectors` — getter yang diteruskan ke frame. */
  abstract get selectors(): Record<TType, iActionProperty>;
  /** Hook hidrasi per-typeKey (implemented oleh subclass). */
  protected abstract template(typeKey: TType, el: HTMLElement, payload?: any, props?: iActionProperty): void;

  /**
   * 🔧 Merge config default + user (mirror Builder.resolveConfig, tanpa Builder):
   * melakukan penggabungan shallow + deep-merge selectors.
   */
  protected mergeConfig<D>(defaultCfg: Required<D>, userCfg: Partial<D> = {}): Required<D> {
    const mergedSelectors = { ...((defaultCfg as any).selectors || {}) };
    if ((userCfg as any).selectors && typeof (userCfg as any).selectors === "object") {
      Object.entries((userCfg as any).selectors).forEach(([key, sel]) => {
        if (sel && typeof sel === "object") {
          (mergedSelectors as any)[key] = {
            ...((mergedSelectors as any)[key] || {}),
            ...(sel as any),
            attrs: {
              ...(((mergedSelectors as any)[key] || {}).attrs || {}),
              ...((sel as any).attrs || {}),
            },
          };
        }
      });
    }
    const merged = { ...defaultCfg, ...userCfg, selectors: mergedSelectors };
    if (!Object.keys(mergedSelectors).length) delete (merged as any).selectors;
    return merged as Required<D>;
  }
}