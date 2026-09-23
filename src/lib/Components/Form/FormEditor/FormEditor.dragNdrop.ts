/**
 * 🖐️ DRAG & DROP SERVICE — every pointer/drag concern of the FormEditor lives
 * here: the delegated channel on the structures container, the per-block drag
 * lifecycle, the move handles that arm a block, and the `.dropzone` placeholder
 * that parks where the held block will land. The editor only calls the four
 * entry points — `bindContainer`, `bindBlock`, `bindHandle`, `releaseIf` — so
 * the held state never leaks out of this service.
 */
export class DragNDropService {
  /** 🖐️ Block armed by its move handle — null while idle. Either a `details.block` (edit mode) or the output preview element (output mode), because committing swaps the whole `<details>` for the `@form-editor>block>output` element, which then owns the move handle + edit button. */
  #armed: HTMLElement | null = null;
  /** 🖐️ Block actually being dragged — the scope `dragover` reorders. */
  #dragging: HTMLElement | null = null;
  /** 🎯 Drop placeholder: shows where the held block will land, only while dragging. */
  #dropzone: HTMLElement | null = null;
  /** 🧹 Abort controller for every listener this service binds (destroy()). */
  #abort = new AbortController();

  /**
   * 🖐️ DRAG CHANNEL — delegated once on the container, so blocks appended
   * later reorder through the very same pair of listeners. Nothing but the
   * `.dropzone` placeholder ever moves while the pointer travels; the held
   * block changes place only on drop. Bound together with the global safety
   * net: a block must NEVER stay armed — `details[draggable]` swallows text
   * selection and native drags inside its own inputs.
   */
  public bindContainer(container: HTMLElement | null): void {
    const { signal } = this.#abort;

    container?.addEventListener("dragover", (event) => {
      if (!container || !this.#dragging) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      this.#moveDropzone(container, event.clientY);
    }, { signal });

    container?.addEventListener("drop", (event) => {
      if (!this.#dragging) return;
      event.preventDefault();
      this.#commitDrop();
    }, { signal });

    // 🧯 Safety net: mouseup, an interrupted drag and a window blur all return
    // every flag to rest — armed or dragging, it never sticks.
    document.addEventListener("mouseup", () => this.#release(), { signal });
    document.addEventListener("dragend", () => this.#release(), { signal });
    window.addEventListener("blur", () => this.#release(), { signal });
  }

  /** 🖐️ DRAG LIFECYCLE — once per block; the summary only contributes the handle. */
  public bindBlock(block: HTMLElement): void {
    const { signal } = this.#abort;

    block.addEventListener("dragstart", (event) => {
      this.#dragging = block;
      block.classList.add("is-dragging");
      this.#openDropzone(block);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", block.getAttribute("form") ?? "block");
        // The handle can be the drag source — make the whole block the ghost.
        event.dataTransfer.setDragImage(block, 12, 12);
      }
    }, { signal });

    block.addEventListener("dragend", () => this.#release(), { signal });
  }

  /**
   * 🖐️ MOVE HANDLE — present in BOTH modes; arms only its own block. The `draggable`
   * flag is dropped again on mouseup/dragend (see #release), never permanent.
   */
  public bindHandle(handle: HTMLButtonElement, block: HTMLElement): void {
    const { signal } = this.#abort;

    // 🛡️ Browser-proof backstop: an always-draggable handle still starts the
    // drag where setting `draggable` during mousedown is too late.
    handle.draggable = true;
    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      block.draggable = true;
      this.#armed = block;
    }, { signal });
  }

  /** 🧹 Return THIS block's drag flags to rest — no-op when it holds none (delete path). */
  public releaseIf(block: HTMLElement): void {
    if (block === this.#armed || block === this.#dragging) this.#release();
  }

  /** 🧹 Lifecycle: release held state, then kill every listener this service bound. */
  public destroy(): void {
    this.#release();
    this.#abort.abort();
  }

  /** 🖐️ Return every drag flag to rest (idempotent, safe to call as often as needed). */
  #release(): void {
    for (const block of new Set([this.#armed, this.#dragging])) {
      if (!block) continue;
      block.draggable = false;
      block.classList.remove("is-dragging");
    }
    this.#armed = null;
    this.#dragging = null;
    this.#clearDropzone();
  }

  /** 🎯 Mount the placeholder in the held block's slot — the drag ghost then "leaves" it. */
  #openDropzone(block: HTMLElement): void {
    this.#clearDropzone();

    const zone = document.createElement("div");
    zone.className = "dropzone";
    block.after(zone);
    this.#dropzone = zone;
  }

  /**
   * 📐 Park the placeholder where the pointer's midpoint sits — either BEFORE or
   * AFTER the nearest sibling. The held block itself never moves during the drag,
   * so the list can not flicker or fight the pointer.
   */
  #moveDropzone(container: HTMLElement, pointerY: number): void {
    const zone = this.#dropzone;
    const dragging = this.#dragging;
    if (!zone || !dragging) return;

    const blocks = Array.from(container.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement
        && child !== dragging
        && child.classList.contains("block")
    );

    const hit = blocks.find((block) => {
      const rect = block.getBoundingClientRect();
      return pointerY < rect.top + rect.height / 2;
    });

    if (hit) {
      if (hit.previousElementSibling === zone) return; // already parked there
      container.insertBefore(zone, hit);
      return;
    }

    if (container.lastElementChild !== zone) container.appendChild(zone);
  }

  /** 📥 Drop: hand the held block the placeholder's exact slot, then clean up. */
  #commitDrop(): void {
    const dragging = this.#dragging;
    const zone = this.#dropzone;

    if (dragging && zone && zone.parentElement) {
      zone.parentElement.insertBefore(dragging, zone);
    }

    this.#release();
  }

  /** 🧹 Remove the placeholder (no-op while idle). */
  #clearDropzone(): void {
    this.#dropzone?.remove();
    this.#dropzone = null;
  }
}
