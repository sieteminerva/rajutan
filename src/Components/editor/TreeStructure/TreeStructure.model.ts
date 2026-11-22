import type { iNodeContent } from "@aio-ui/core";

/**
 * 🌳 ONE NODE OF THE EDITABLE TREE — a live, addressable view over ONE key of the
 * declarative `iNodeContent` schema (`"section#home"`, `"h2.title"`, `".row$1"`,
 * …). The node keeps the ORIGINAL key, its `value` payload (the object hanging
 * under that key — `content`, `attrs`, `onCreated`, `builder`, downstream child
 * keys), and the children this key owns.
 *
 * A model is a FLAT address book (`id → node`) plus a `parent`/`children` web, so
 * every mutation (`move`, `remove`, `add`) is a pointer swap an O(1) map lookup
 * apart — never a walk of the raw schema.
 */
export interface iTreeNode {
  /** 🆔 Stable handle minted by the model — survives re-parenting (never a schema key). */
  readonly id: string;
  /** 🏷️ The schema key this node came from. */
  key: string;
  /** 📦 The payload OBJECT beneath the key (shared by reference with the source schema). */
  value: Record<string, any>;
  /** 🌿 Ordered children — their order is the rendered order, hence the schema's order. */
  children: iTreeNode[];
  /** 🪢 Owning node, or null at the root. */
  parent: iTreeNode | null;
}

/** 🔢 Reserved schema keys that are payload metadata, never child tree keys. */
const RESERVED_KEYS = new Set([
  "content", "onCreated", "onDestroy", "builder", "attrs", "attributes",
  "isRoot", "isArray", "config", "selectors", "options",
]);

/** 🏷️ Keys whose value is a plain object payload, not a nested key group. */
const isNestedGroup = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !(value instanceof HTMLElement) && !Array.isArray(value);

/**
 * 🌳 TREE MODEL — the pure, DOM-free core of the tree composer. It ingests a
 * declarative `iNodeContent` schema, exposes it as an addressable `iTreeNode`
 * graph, and serializes edits back into a fresh schema object.
 *
 * Two schema dialects are absorbed transparently:
 *  - **String-keyed** (`{ "section#home": { content: {...} } }`) — the dialect
 *    the app's `*Content` variables use in practice.
 *  - **Array content** (`content: [ { ".trust.card": {...} }, … ]`) — each array
 *    item becomes a sibling node whose key is its own single key. Array order is
 *    preserved on the way out.
 *
 * The model never touches the DOM and never mutates its source; `toContent()`
 * BUILDS a new schema (sharing leaf payload objects by reference) that the
 * composer's preview/renderer can consume directly.
 */
export class TreeModel {
  /** 🆔 ROOT — an invisible container whose `children` are the top-level key groups. */
  public readonly root: iTreeNode;
  /** 🗺️ FLAT ADDRESS BOOK — `id → node` for O(1) apply/lookup during a drop. */
  #index = new Map<string, iTreeNode>();
  /** 🔢 Monotonic id source — ids are opaque handles, never reused. */
  #seq = 0;

  constructor(content?: iNodeContent | null) {
    this.root = this.#mint("[root]", {});
    this.root.parent = null;
    if (content) this.hydrate(content);
  }

  /** 🔢 Mint a node for `key`/`value` and file it in the address book (parent set by caller). */
  #mint(key: string, value: Record<string, any>): iTreeNode {
    const node: iTreeNode = {
      id: `n${++this.#seq}`,
      key,
      value,
      children: [],
      parent: null,
    };
    this.#index.set(node.id, node);
    return node;
  }

  /** 📥 INGEST — rebuild the whole tree from a schema (safe to call again to reset). */
  public hydrate(content: iNodeContent): void {
    this.root.children = [];
    this.#index.clear();
    this.#index.set(this.root.id, this.root);
    this.#absorb(content as Record<string, any>, this.root);
  }

  /** 🧬 ABSORB — turn one schema record into children of `parent`, preserving order. */
  #absorb(schema: Record<string, any>, parent: iTreeNode): void {
    if (!schema || typeof schema !== "object") return;

    for (const [key, value] of Object.entries(schema)) {
      if (!value || typeof value !== "object") continue;

      // 🌿 ARRAY payload: the whole array is one group (order preserved on emit).
      if (Array.isArray(value)) {
        parent.children.push(this.#mint(`${key}[]`, { content: value }));
        continue;
      }

      const node = this.#mint(key, value as Record<string, any>);
      node.parent = parent;
      parent.children.push(node);

      // 🌿 NESTED `content` group: recurse into its keys.
      const content = (value as Record<string, any>).content;
      if (isNestedGroup(content)) {
        this.#absorb(content as Record<string, any>, node);
      }

      // 🌿 DOWNSTREAM keys (DOMRenderer's Phase 5 dialect: any non-reserved key
      //    whose value is an object literal is itself a child key group).
      const downstream: Record<string, any> = {};
      for (const [childKey, childValue] of Object.entries(value as Record<string, any>)) {
        if (RESERVED_KEYS.has(childKey)) continue;
        if (!isNestedGroup(childValue)) continue;
        downstream[childKey] = childValue;
      }
      if (Object.keys(downstream).length) this.#absorb(downstream, node);
    }
  }
  /** 🔎 Address-book lookup — the O(1) gate every mutation starts from. */
  public get(id: string): iTreeNode | undefined {
    return this.#index.get(id);
  }

  /** 🧭 Depth-first walk over every node (root included), in render order. */
  public walk(from: iTreeNode = this.root, visit?: (node: iTreeNode, depth: number) => void): iTreeNode[] {
    const out: iTreeNode[] = [];
    const step = (node: iTreeNode, depth: number) => {
      out.push(node);
      visit?.(node, depth);
      node.children.forEach((child) => step(child, depth + 1));
    };
    step(from, 0);
    return out;
  }

  /** 🚫 TRUE when `candidate` sits inside `node` — a drag may never drop into its own descendant. */
  public isDescendant(node: iTreeNode, candidate: iTreeNode): boolean {
    for (let cursor = candidate.parent; cursor; cursor = cursor.parent) {
      if (cursor === node) return true;
    }
    return false;
  }

  /**
   * 🔀 MOVE — re-parent `id` in front of `beforeId`, or append to `parentId` when
   * `beforeId` is omitted. Refuses illegal targets (self, own descendant, unknown
   * ids) so the DOM can never desync from the model. Returns the moved node, or
   * null when the request was rejected.
   */
  public move(id: string, parentId: string, beforeId?: string | null): iTreeNode | null {
    const node = this.get(id);
    const parent = this.get(parentId);
    if (!node || !parent) return null;
    if (node === this.root || node === parent) return null;
    if (this.isDescendant(node, parent)) return null;

    const from = node.parent;
    if (!from) return null;

    const oldIndex = from.children.indexOf(node);
    if (oldIndex >= 0) from.children.splice(oldIndex, 1);

    const before = beforeId ? this.get(beforeId) : null;
    const at = before && before.parent === parent ? parent.children.indexOf(before) : -1;

    if (at >= 0) parent.children.splice(at, 0, node);
    else parent.children.push(node);

    node.parent = parent;
    return node;
  }

  /** 🗑️ REMOVE — detach `id` (with its whole subtree) from its parent. */
  public remove(id: string): iTreeNode | null {
    const node = this.get(id);
    if (!node || node === this.root || !node.parent) return null;

    const index = node.parent.children.indexOf(node);
    if (index >= 0) node.parent.children.splice(index, 1);

    // 🧹 Drop the node AND its descendants from the address book (no stale handles).
    this.walk(node).forEach((stale) => this.#index.delete(stale.id));

    node.parent = null;
    return node;
  }

  /**
   * ➕ ADD — insert a brand-new node under `parentId` before `beforeId` (or last),
   * minted from a caller-supplied `key`/`value`. Used by the composer's "add"
   * affordance to drop a fresh empty group in place.
   */
  public add(parentId: string, key: string, value: Record<string, any> = {}, beforeId?: string | null): iTreeNode | null {
    const parent = this.get(parentId);
    if (!parent) return null;

    const node = this.#mint(key, value);
    node.parent = parent;

    const before = beforeId ? this.get(beforeId) : null;
    const at = before && before.parent === parent ? parent.children.indexOf(before) : -1;

    if (at >= 0) parent.children.splice(at, 0, node);
    else parent.children.push(node);

    return node;
  }

  /**
   * 📤 SERIALIZE — emit a fresh `iNodeContent` schema mirroring the CURRENT tree
   * order/ownership. Child nodes write into their parent's `content` slot; array
   * groups emit back as arrays. Leaf payload objects are shared by reference, so
   * `onCreated`, `attrs`, `builder`, … survive the round-trip untouched.
   */
  public toContent(): iNodeContent {
    return this.#emitChildren(this.root) as iNodeContent;
  }

  /** 🧬 EMIT — one group per child, in order; array groups collapse back to arrays. */
  #emitChildren(parent: iTreeNode): Record<string, any> {
    const out: Record<string, any> = {};

    for (const child of parent.children) {
      const childContent = this.#emitChildren(child);

      // 🌿 ARRAY group: restore a real array, replacing the shipped-in array item.
      if (child.key.endsWith("[]")) {
        const name = child.key.slice(0, -2);
        const items = child.value.content;
        out[name] = Array.isArray(items) ? items : [];
        continue;
      }

      const value = child.value;
      if (Object.keys(childContent).length) {
        value.content = childContent;
      }
      out[child.key] = value;
    }

    return out;
  }
}
