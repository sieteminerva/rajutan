// ======================================================================
// ArticleSlot — deklarasi slot registry untuk sistem "slotting" Article.
//
// Article.ts (CONTROLLER) membaca iArticleConfig.slots, membangun kontainer
// DOM dengan atribut data-slot, lalu men-delegasikan pembangunan setiap slot
// ke sub-builder ter-register (via host.render). File ini hanya isi kontrakt +
// slot default; factory instansiasi sub-builder hidup di ArticleController.
// ======================================================================

/** Tipe sub-component yang dapat mengisi sebuah slot. */
export type ArticleComponentKey = "item" | "detail" | "controls" | "aside";

/**
 * Definisi satu slot — diisi di iArticleConfig.slots.
 *
 * @param slot    nama slot → atribut `data-slot="${slot}"` pada kontainer.
 * @param builder sub-component mana yang mengisi slot ini.
 * @param view    mode tampilan (mis. kartu vs baris untuk "item").
 * @param count   berapa kali sub-component ini dibangun (mis. jumlah item aside).
 * @param props   properti runtime yang diteruskan ke sub-component.
 */
export interface iArticleSlotSpec {
  slot: string;
  builder: ArticleComponentKey;
  view?: "list" | "card";
  count?: number;
  props?: Record<string, unknown>;
}

/** Slot default bila iArticleConfig.slots tidak disediakan. */
export const DEFAULT_ARTICLE_SLOTS: iArticleSlotSpec[] = [
  { slot: "list", builder: "item", view: "card" },
  { slot: "controls", builder: "controls" },
  { slot: "aside", builder: "aside", count: 5 },
];

/** Bungkus hasil sub-component dalam elemen holder bermarkah data-slot. */
export function wrapSlotElement(slot: string, child: HTMLElement): HTMLElement {
  const holder = document.createElement("div");
  holder.dataset.slot = slot;
  holder.appendChild(child);
  return holder;
}