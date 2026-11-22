import type { iBuilderConfig, iBuilderRegistry, iElementProperty, iNodeContent } from "@aio-ui/core";
import { Builder } from "@aio-ui/base";
import type { iActionProperty } from "../../types";
import { TreeModel, type iTreeNode } from "./TreeStructure.model";
import { TreeDragNDropService, TREE_CLASSES, type iTreeDropIntent } from "./TreeStructure.dragNdrop";

export type TreeStructureElementType =
  | "@tree"
  | "@tree>toolbar"
  | "@tree>toolbar>add"
  | "@tree>toolbar>reset"
  | "@tree>node"
  | "@tree>node>children"
  | "@tree>handle"
  | "@tree>action>remove"
  | "@tree>action>add"
  ;

export interface iTreeStructureConfig extends iBuilderConfig<TreeStructureElementType> {
  /** 🌳 The schema the composer edits. Defaults to an empty tree. */
  content?: iNodeContent | null;
  /** 🏷️ Key stamped onto a freshly-added group (toolbar "add" / row "add"). */
  newKey?: string;
  /** 🔊 Called after every mutation with the freshly-serialized schema. */
  onChange?: ((content: iNodeContent) => void) | null;
}

export class TreeStructureBuilder extends Builder<TreeStructureElementType, iTreeStructureConfig> {
  builderId = "tree-structure" as keyof iBuilderRegistry;
  name = "tree-structure" as keyof iBuilderRegistry;
  stylesheet: string = "./TreeStructure.css";

  /** 🌳 The single source of truth for this composer — parsed from config/content. */
  #model!: TreeModel;
  /** 🖐️ Reorder/nest engine; commits straight into the model (see #onDrop). */
  #dnd!: TreeDragNDropService;
  /** 🖐️ The tree root the DnD channel is delegated on (initialize()). */
  #root: HTMLElement | null = null;
  /** 📦 The schema as originally received — what #onReset() restores. */
  #source: iNodeContent | null = null;

  constructor(config: Partial<iTreeStructureConfig>) {
    super();

    const defaultSelectors: Record<TreeStructureElementType, iElementProperty> = {
      "@tree": { tagName: "div", className: "tree" },
      "@tree>toolbar": { tagName: "div", className: "tree-toolbar" },
      "@tree>toolbar>add": { tagName: "button", className: "tree-add", attrs: { type: "button" }, icon: "plus icon" },
      "@tree>toolbar>reset": { tagName: "button", className: "tree-reset", attrs: { type: "button" }, icon: "undo icon" },
      "@tree>node": { tagName: "div", className: "tree-row" },
      "@tree>node>children": { tagName: "div", className: "tree-children" },
      "@tree>handle": { tagName: "button", className: "tree-handle", attrs: { type: "button" } },
      "@tree>action>remove": { tagName: "button", className: "tree-action remove", attrs: { type: "button" }, icon: "trash icon" },
      "@tree>action>add": { tagName: "button", className: "tree-action add", attrs: { type: "button" }, icon: "plus icon" },
    }

    const defaultConfig: Required<iTreeStructureConfig> = {
      themeId: "default",
      namespace: "",
      emit: null,
      selectors: defaultSelectors,
      content: null,
      newKey: "section.new",
      onChange: null,
    };

    this.config = this.resolveConfig(defaultConfig, config)
  }


  public prepare(content: any, _config?: Required<iTreeStructureConfig> | undefined): HTMLElement | Record<string, any | HTMLElement> {
    // 🌳 Prefer content handed to create(); fall back to the config field so an
    // attach()-only mount (the Editor's path) still has a schema to edit.
    this.#ensure(content);
    return this.render("@tree")!;
  }


  protected template(typeKey: TreeStructureElementType, el: HTMLElement, _payload?: any, _props?: iActionProperty): void {
    switch (typeKey) {
      case "@tree":
        // 🥾 attach() renders keys WITHOUT calling prepare(), so the model/DnD are
        // booted lazily here — the one place every render path passes through.
        this.#ensure(undefined);
        this.#paint(el);
        break;

      default:
        break;
    }
  }


  public initialize(el?: HTMLElement, _payload?: any, _context?: any): void {
    if (!el) return;
    // 🖐️ The root is the drag channel — delegated once here (not in template, so
    // attach() and create() share the exact same wiring path).
    this.#root = el;
    this.#ensure(undefined);
    this.#dnd.bindContainer(el);
  }

  public destroy(typeKey?: TreeStructureElementType): void {
    this.#dnd?.destroy();
    super.destroy(typeKey);
  }

  /**
   * 🥾 ENSURE — boot the model + drag engine exactly once, from whichever entry
   * point fires first (`prepare()` on the create() path, `template()` on the
   * attach() path). Idempotent, so later calls are no-ops.
   */
  #ensure(content?: any): void {
    if (this.#model) return;

    const source = (content && typeof content === "object" ? content : this.config.content) as iNodeContent | null;
    this.#source = source;
    this.#model = new TreeModel(source);
    this.#dnd = new TreeDragNDropService((intent) => this.#onDrop(intent));
  }

  // =====================================================================
  // 🎨 RENDER — the model painted as rows
  // =====================================================================

  /**
   * 🎨 PAINT — (re)build the whole visible tree from `#model`. Called once by
   * template() and again after every mutation, so the DOM always mirrors the
   * model instead of drifting from it.
   */
  #paint(root: HTMLElement): void {
    const toolbar = this.render("@tree>toolbar")!;
    const addButton = this.render("@tree>toolbar>add")!;
    const resetButton = this.render("@tree>toolbar>reset")!;

    addButton.title = `Add a new "${this.config.newKey}" group`;
    resetButton.title = "Reset to the incoming content";
    addButton.addEventListener("click", () => this.#onAdd(this.#model.root.id));
    resetButton.addEventListener("click", () => this.#onReset());

    toolbar.append(addButton, resetButton);

    const list = document.createElement("div");
    list.className = TREE_CLASSES.children;
    list.dataset.treeRoot = "true";
    list.append(...this.#model.root.children.map((node) => this.#paintNode(node)));

    root.replaceChildren(toolbar, list);
  }

  /** 🌿 PAINT NODE — one row: handle + key + tally + actions, then nested children. */
  #paintNode(node: iTreeNode): HTMLElement {
    const row = this.render("@tree>node")!;
    row.dataset.nodeId = node.id;
    row.classList.add("tree-" + this.#kindOf(node));

    const handle = this.render("@tree>handle")!;
    handle.title = "Drag to reorder or nest";
    const grip = document.createElement("i");
    grip.className = "grip lines vertical icon";
    handle.append(grip);

    const key = document.createElement("code");
    key.className = "tree-key";
    key.textContent = this.#displayKey(node);

    const tally = document.createElement("span");
    tally.className = "tree-count";
    tally.textContent = `${node.children.length}`;

    const removeButton = this.render("@tree>action>remove")!;
    removeButton.title = "Remove this node";
    removeButton.addEventListener("click", () => this.#onRemove(node.id));

    const addChildButton = this.render("@tree>action>add")!;
    addChildButton.title = "Add a child group here";
    addChildButton.addEventListener("click", () => this.#onAdd(node.id));

    const actions = document.createElement("span");
    actions.className = "tree-actions";
    actions.append(addChildButton, removeButton);

    const head = document.createElement("div");
    head.className = "tree-head";
    head.append(handle, key, tally, actions);
    row.append(head);

    if (node.children.length) {
      const children = this.render("@tree>node>children")!;
      children.append(...node.children.map((child) => this.#paintNode(child)));
      row.append(children);
    }

    // 🖐️ Wire this row to the drag engine (idempotent per freshly-painted row).
    this.#dnd.bindRow(row);
    this.#dnd.bindHandle(handle, row);

    return row;
  }

  /** 🏷️ Show array groups as their bare name so "cards[]" reads as "cards". */
  #displayKey(node: iTreeNode): string {
    return node.key.endsWith("[]") ? node.key.slice(0, -2) : node.key;
  }

  /** 🔖 Classify a node for styling: array group / branch / leaf. */
  #kindOf(node: iTreeNode): "array" | "branch" | "leaf" {
    if (node.key.endsWith("[]")) return "array";
    return node.children.length ? "branch" : "leaf";
  }

  // =====================================================================
  // ✍️ MUTATIONS — model first, then re-paint + notify
  // =====================================================================

  /** 🖐️ Apply a resolved drop intent to the model (see TreeDragNDropService). */
  #onDrop(intent: iTreeDropIntent): void {
    const { draggedId, targetId, position } = intent;

    if (position === "inside" && targetId) {
      // 🌿 Nest as the target's LAST child.
      this.#model.move(draggedId, targetId, null);
    } else if (targetId) {
      // ⬆️⬇️ Sibling move: land in the target's own parent, before the target
      //    itself (before) or before its next sibling (after).
      const target = this.#model.get(targetId);
      const parent = target?.parent;
      if (parent && target) {
        const siblings = parent.children;
        const index = siblings.indexOf(target);
        const anchor = position === "before" ? target : siblings[index + 1];
        this.#model.move(draggedId, parent.id, anchor?.id ?? null);
      }
    }

    this.#refresh();
  }

  /** ➕ Add a fresh empty group under `parentId` (toolbar, or a row's own +). */
  #onAdd(parentId: string): void {
    const created = this.#model.add(parentId, this.config.newKey, { content: {} });
    this.#refresh();

    const row = created ? this.#root?.querySelector<HTMLElement>(`[data-node-id="${created.id}"]`) : null;
    row?.scrollIntoView({ block: "nearest" });
  }

  /** 🗑️ Remove a node (with its whole subtree) from the model. */
  #onRemove(id: string): void {
    const row = this.#root?.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
    if (row) this.#dnd.releaseIf(row);

    this.#model.remove(id);
    this.#refresh();
  }

  /** ♻️ Restore the tree to the originally-supplied schema. */
  #onReset(): void {
    this.#model.hydrate(this.#source ?? {});
    this.#refresh();
  }

  /**
   * 🔄 REFRESH — re-paint from the model, then broadcast the serialized schema.
   * One funnel for every mutation keeps the DOM, the model and the listener in
   * lockstep: no mutation path can forget to notify.
   */
  #refresh(): void {
    if (this.#root) this.#paint(this.#root);

    const content = this.#model.toContent();
    this.config.onChange?.(content);
    this.config.emit?.("elementChanged", {
      builder: this.builderId as keyof iBuilderRegistry,
      type: "@tree",
      element: this.#root,
      data: content,
    });
  }


  /** 📤 Public accessor — the current schema, for a caller that wants to read it back. */
  public get content(): iNodeContent {
    return this.#model.toContent();
  }
}