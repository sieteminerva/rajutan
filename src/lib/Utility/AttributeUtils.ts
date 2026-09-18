/**
 * 🧱 ATTRIBUTE UTILS — shared element-attribute stamping helpers.
 *
 * Extracted from the three places that duplicated the same logic:
 * • `Builder._applyNodeAttributes` (Base.ts)
 * • `DOMRenderer.attributeProcessor` (DOMRenderer.ts)
 * • `Input.applyAttributes` (Form/Input.ts)
 *
 * Two canonical shapes of declared attributes are supported everywhere:
 * 1. Dictionary (`attrs: { name: value, ... }`) — plain setAttribute.
 * 2. Array (`attributes: [{ name, value }, ...]`) — with the event-handler
 *    special case: a `function` value on an `on*` attribute is assigned as
 *    an element property (`el.onclick = fn`), not serialized via setAttribute.
 */

/** One declared attribute pair, e.g. `{ name: "onclick", value: fn }`. */
export interface iAttributeSpec {
  name: string;
  value: unknown;
}

/**
 * 🧩 APPLY ATTR DICTIONARY — stamp every `[name]: value` pair via setAttribute.
 * Values are stringified; `null`/`undefined` are skipped. Safe to call with
 * a missing dictionary (no-op).
 */
export function applyAttrDictionary(el: HTMLElement, attrs?: Record<string, unknown> | null): void {
  if (!attrs || typeof attrs !== "object") return;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    el.setAttribute(name, String(value));
  }
}

/**
 * 🧩 APPLY ATTRIBUTE LIST — stamp every `{ name, value }` pair.
 * Event-handler convention: `function` value + `on*` name → assigned as an
 * element property (live handler reference); anything else → setAttribute.
 */
export function applyAttributeList(el: HTMLElement, attributes?: iAttributeSpec[] | null): void {
  if (!Array.isArray(attributes)) return;
  for (const attr of attributes) {
    if (!attr || typeof attr !== "object" || !attr.name) continue;
    if (typeof attr.value === "function" && attr.name.startsWith("on")) {
      (el as any)[attr.name as string] = attr.value;
    } else {
      el.setAttribute(attr.name, attr.value as string);
    }
  }
}