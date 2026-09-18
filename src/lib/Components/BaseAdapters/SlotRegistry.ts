/**
 * 🧩 SLOT REGISTRY — attach/detach slotting, extracted from `Builder`.
 *
 * A slot is a named container key (e.g. "@article>list") registered in the
 * builder's node store. `attach()` welds a child element into the resolved
 * holder element and records it; `detach()` removes the recorded child from
 * the DOM and forgets it.
 *
 * The registry does not own the node store — it resolves holders through the
 * `resolveHolder` callback supplied by the owning builder, so the slotting
 * concern stays decoupled from the storage shape.
 */
export type SlotHolderResolver = (slotKey: string) => HTMLElement | null | undefined;

export class SlotRegistry {
  /** slot key → child element that was attached through this registry. */
  #slots = new Map<string, HTMLElement>();
  #resolveHolder: SlotHolderResolver;

  constructor(resolveHolder: SlotHolderResolver) {
    this.#resolveHolder = resolveHolder;
  }

  /**
   * 📎 ATTACH — weld `child` into the holder resolved for `slotKey` and record
   * it for later `detach()`. The child is registered even when no holder
   * exists yet, so a later detach still cleans it up.
   */
  public attach(slotKey: string, child: HTMLElement | null | undefined): void {
    if (!child) return;
    const holder = this.#resolveHolder(slotKey);
    if (holder) holder.appendChild(child);
    this.#slots.set(slotKey, child);
  }

  /** 🧷 DETACH — remove the child recorded for `slotKey` from its DOM parent. */
  public detach(slotKey: string): void {
    const child = this.#slots.get(slotKey);
    if (child && child.parentNode) child.parentNode.removeChild(child);
    this.#slots.delete(slotKey);
  }

  /** The child currently attached to `slotKey`, if any. */
  public get(slotKey: string): HTMLElement | null {
    return this.#slots.get(slotKey) ?? null;
  }

  public has(slotKey: string): boolean {
    return this.#slots.has(slotKey);
  }

  /** Release every recorded slot reference (used by builder `destroy()`). */
  public clear(): void {
    this.#slots.clear();
  }
}