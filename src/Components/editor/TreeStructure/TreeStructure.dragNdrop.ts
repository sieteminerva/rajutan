/**
 * 🖐️ TREE DRAG & DROP SERVICE — every pointer/drag concern of the TreeStructure
 * composer lives here, mirroring the FormEditor's `DragNDropService` (delegated
 * channel, per-row lifecycle, `.dropzone` placeholder, global safety net) but
 * extended for a NESTED tree: the placeholder resolves to one of three semantic
 * intents — `before` a row, `after` a row, or `inside` a row's own child list.
 *
 * The service owns ONLY the drag flags and the placeholder element; it never
 * mutates the data model. On drop it reports the resolved intent through the
 * `onCommit` callback, and the builder applies it to the `TreeModel` (the single
 * source of truth). A rejected intent simply clears.
 */

/** 🎯 A resolved drop intent — where the held row means to land. */
export interface iTreeDropIntent {
  /** 🆔 Row being dragged. */
  draggedId: string;
  /** 🆔 Target row the pointer is hovering ("" for a root-level append). */
  targetId: string;
  /** 📐 Relation to the target: place before it, after it, or as its last child. */
  position: "before" | "after" | "inside";
}

/** 🏷️ Class names the service reads/writes — kept in one place so builder+CSS agree. */
export const TREE_CLASSES = {
  row: "tree-row",
  children: "tree-children",
  handle: "tree-handle",
  dropzone: "dropzone",
  dragging: "is-dragging",
} as const;

export class TreeDragNDropService {
  /** 🖐️ Row currently held (armed by its handle) — null while idle. */
  #armed: HTMLElement | null = null;
  /** 🖐️ Row actually being dragged — the one `dragover` re-parents. */
  #dragging: HTMLElement | null = null;
  /** 🎯 Placeholder that parks where the held row will land. */
  #dropzone: HTMLElement | null = null;
  /** 🌿 Child-list container the placeholder currently sits in (commit target). */
  #dropParent: HTMLElement | null = null;
  /** 📐 Position of the placeholder relative to `#dropRef`. */
  #dropPosition: iTreeDropIntent["position"] = "after";
  /** 🏷️ Row the pointer most recently hovered. */
  #dropTarget: HTMLElement | null = null;
  /** 🧹 Abort controller for every listener this service binds (destroy()). */
  #abort = new AbortController();
  /** 📥 Commit callback — the builder applies the intent to its `TreeModel`. */
  #onCommit: (intent: iTreeDropIntent) => void;

  constructor(onCommit: (intent: iTreeDropIntent) => void) {
    this.#onCommit = onCommit;
  }

  /** 🖐️ DRAG CHANNEL — delegated once on the tree root, so rows rebuilt later keep working. */
  public bindContainer(container: HTMLElement | null): void {
    const { signal } = this.#abort;

    container?.addEventListener("dragover", (event) => {
      if (!container || !this.#dragging) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      this.#resolveIntent(container, event.clientX, event.clientY);
    }, { signal });

    container?.addEventListener("drop", (event) => {
      if (!this.#dragging) return;
      event.preventDefault();
      this.#commit();
    }, { signal });

    // 🧯 Safety net: mouseup, an interrupted drag and a window blur all return
    // every flag to rest — armed or dragging, it never sticks.
    document.addEventListener("mouseup", () => this.#release(), { signal });
    document.addEventListener("dragend", () => this.#release(), { signal });
    window.addEventListener("blur", () => this.#release(), { signal });
  }

  /** 🖐️ DRAG LIFECYCLE — once per row; the row is the drag source, its handle arms it. */
  public bindRow(row: HTMLElement): void {
    const { signal } = this.#abort;

    row.addEventListener("dragstart", (event) => {
      this.#dragging = row;
      row.classList.add(TREE_CLASSES.dragging);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.dataset.nodeId ?? "tree-row");
        event.dataTransfer.setDragImage(row, 12, 12);
      }
    }, { signal });

    row.addEventListener("dragend", () => this.#release(), { signal });
  }

  /** 🖐️ MOVE HANDLE — arms only its own row; `draggable` is never left on the row. */
  public bindHandle(handle: HTMLElement, row: HTMLElement): void {
    const { signal } = this.#abort;

    handle.draggable = true;
    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      row.draggable = true;
      this.#armed = row;
    }, { signal });
  }

  /** 🧹 Return THIS row's drag flags to rest — no-op when it holds none (delete path). */
  public releaseIf(row: HTMLElement): void {
    if (row === this.#armed || row === this.#dragging) this.#release();
  }

  /** 🧹 Lifecycle: release held state, then kill every listener this service bound. */
  public destroy(): void {
    this.#release();
    this.#abort.abort();
  }

  /** 🖐️ Return every drag flag to rest (idempotent, safe to call as often as needed). */
  #release(): void {
    for (const row of new Set([this.#armed, this.#dragging])) {
      if (!row) continue;
      row.draggable = false;
      row.classList.remove(TREE_CLASSES.dragging);
    }
    this.#armed = null;
    this.#dragging = null;
    this.#dropTarget = null;
    this.#dropParent = null;
    this.#clearDropzone();
  }

  /** 🧹 Remove the placeholder (no-op while idle). */
  #clearDropzone(): void {
    this.#dropzone?.remove();
    this.#dropzone = null;
  }

  /** 🧷 Lazily mint the single placeholder element reused across a drag. */
  #ensureDropzone(): HTMLElement {
    if (!this.#dropzone) {
      const zone = document.createElement("div");
      zone.className = TREE_CLASSES.dropzone;
      this.#dropzone = zone;
    }
    return this.#dropzone;
  }

  /**
   * 📐 RESOLVE INTENT — pick the semantic relation of the pointer to the hovered
   * row: within the top band → `before`, bottom band → `after`, the middle band →
   * `inside` that row's own child list (nesting). The placeholder is parked at the
   * resolved slot so the user sees exactly where the drop lands. The dragged row
   * and its descendants are excluded, so a row can never nest into itself.
   */
  #resolveIntent(container: HTMLElement, pointerX: number, pointerY: number): void {
    const dragging = this.#dragging;
    if (!dragging) return;

    const rows = Array.from(container.querySelectorAll<HTMLElement>(`.${TREE_CLASSES.row}`)).filter(
      (row) => row !== dragging && !dragging.contains(row),
    );

    const hit = rows.find((row) => {
      const rect = row.getBoundingClientRect();
      return pointerY >= rect.top && pointerY <= rect.bottom && pointerX >= rect.left;
    }) ?? this.#nearestByY(rows, pointerY);

    const list = hit ? this.#childListOf(hit) : container;
    const zone = this.#ensureDropzone();

    if (!hit) {
      if (container.lastElementChild !== zone) container.appendChild(zone);
      this.#dropParent = container;
      this.#dropTarget = null;
      this.#dropPosition = "after";
      return;
    }

    const rect = hit.getBoundingClientRect();
    const ratio = (pointerY - rect.top) / Math.max(rect.height, 1);

    if (ratio < 0.3) {
      // ⬆️ BEFORE the hovered row, inside its own parent list.
      const parentList = hit.parentElement ?? list;
      parentList.insertBefore(zone, hit);
      this.#dropParent = parentList;
      this.#dropTarget = hit;
      this.#dropPosition = "before";
    } else if (ratio > 0.7) {
      // ⬇️ AFTER the hovered row, inside its own parent list.
      const parentList = hit.parentElement ?? list;
      parentList.insertBefore(zone, hit.nextElementSibling);
      this.#dropParent = parentList;
      this.#dropTarget = hit;
      this.#dropPosition = "after";
    } else {
      // 🌿 INSIDE the hovered row (nest as its last child).
      if (zone.parentElement !== list) list.appendChild(zone);
      this.#dropParent = list;
      this.#dropTarget = hit;
      this.#dropPosition = "inside";
    }
  }

  /** 🧭 Fall back to the closest row by vertical distance when the pointer is in a gap. */
  #nearestByY(rows: HTMLElement[], pointerY: number): HTMLElement | null {
    let best: HTMLElement | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const distance = Math.abs(pointerY - (rect.top + rect.height / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = row;
      }
    }
    return best;
  }

  /** 🌿 The row's own child-list container (minted on demand so every row can nest). */
  #childListOf(row: HTMLElement): HTMLElement {
    let list = row.querySelector<HTMLElement>(`:scope > .${TREE_CLASSES.children}`);
    if (!list) {
      list = document.createElement("div");
      list.className = TREE_CLASSES.children;
      row.appendChild(list);
    }
    return list;
  }

  /** 📥 Commit: report the resolved intent to the builder, then clean up. */
  #commit(): void {
    const dragging = this.#dragging;
    const target = this.#dropTarget;

    if (dragging?.dataset.nodeId && (target?.dataset.nodeId ?? this.#dropParent)) {
      this.#onCommit({
        draggedId: dragging.dataset.nodeId,
        targetId: target?.dataset.nodeId ?? "",
        position: this.#dropPosition,
      });
    }

    this.#release();
  }
}