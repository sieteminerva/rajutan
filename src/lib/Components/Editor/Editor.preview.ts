/**
 * ColorTheme.preview — the live-preview bridge (both protocol halves).
 *
 * The ColorThemeBuilder embeds the real app in a same-origin <iframe>. Two
 * one-way messages cross the boundary; both are received by the app inside
 * the frame (installed in main.ts via installThemeBridge):
 *
 * 1. APPLY_THEME_TOKENS — the derived `--app-*` token map + mode. Because
 *    every page paints itself from `:root` CSS variables (variables.css),
 *    applying them to `documentElement` re-themes the whole real route
 *    live — no DOM manifest, no second renderer inside the frame.
 *
 * 2. RENDER_BUILDER — a builder id + schema (e.g. the Form editor's
 *    document). The frame builds it with its OWN real builder via the
 *    ComponentRegistry and mounts it into the `[data-canvas]` root of the
 *    dedicated `canvas` route. The sender owns the schema as source of
 *    truth; the preview is a faithful build of it.
 */

// ======================================================================
// PROTOCOL
// ======================================================================

export const THEME_BRIDGE_EVENT = "APPLY_THEME_TOKENS";
export const RENDER_BUILDER_EVENT = "RENDER_BUILDER";
/**
 * Same-document broadcast channel: a theme builder dispatches this CustomEvent
 * on `window` whenever its derived tokens change; the Editor builder listens
 * and forwards the payload into the preview iframe as THEME_BRIDGE_EVENT.
 * Keeps the two builders decoupled (no direct references between them).
 */
export const THEME_TOKENS_EVENT = "editor:theme-tokens";
/** Root element (attribute selector) inside the iframe that builder output mounts into. */
export const CANVAS_MOUNT_SELECTOR = "[data-canvas]";

export interface iThemeBridgeMessage {
  type: typeof THEME_BRIDGE_EVENT;
  tokens: Record<string, string>;
  mode: "light" | "dark";
}

/** Detail payload of the THEME_TOKENS_EVENT CustomEvent. */
export interface iThemeTokensDetail {
  tokens: Record<string, string>;
  mode: "light" | "dark";
}

export interface iRenderBuilderMessage {
  type: typeof RENDER_BUILDER_EVENT;
  builderId: string;
  /** Builder schema/config — the same shape pageContentFor() feeds builders. */
  schema: unknown;
}

export type iBridgeMessage = iThemeBridgeMessage | iRenderBuilderMessage;

export interface iThemeBridgeOptions {
  /**
   * Async builder hook (wire only in the canvas-capable app shell): preload
   * + build the requested builder and mount it into the canvas root.
   */
  renderBuilder?: (builderId: string, schema: unknown) => Promise<void> | void;
}

// ======================================================================
// RECEIVER — installed in every app instance (outer page + iframe)
// ======================================================================

/**
 * Per-root ledger of every custom property the bridge has applied, so
 * `resetThemeBridge()` can restore the exact pre-bridge state (stylesheet
 * values are untouched — we only ever add/remove inline props).
 */
const appliedTokens = new Map<HTMLElement, Set<string>>();

/**
 * Where tokens may be applied, chosen by document role:
 * - Embedded document (the preview iframe) → `documentElement` is fine:
 *   the whole document is disposable and wiped on every route reload.
 * - Top-level page (the editor itself) → NEVER touch `:root`. Scope to the
 *   `[data-canvas]` mount root only. This makes pollution of the editor
 *   page structurally impossible, not just unlikely.
 */
function bridgeTarget(): HTMLElement | null {
  try {
    if (window.self !== window.top) return document.documentElement;
  } catch {
    // Cross-origin access to window.top can throw — treat as embedded.
    return document.documentElement;
  }
  return document.querySelector<HTMLElement>(CANVAS_MOUNT_SELECTOR);
}

function applyTokens(root: HTMLElement, tokens: Record<string, string>): void {
  let ledger = appliedTokens.get(root);
  if (!ledger) {
    ledger = new Set();
    appliedTokens.set(root, ledger);
  }
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== "string") continue;
    root.style.setProperty(key, value);
    ledger.add(key);
  }
}

/**
 * Revert every token the bridge ever applied to its roots and clear the
 * mirrored mode. Restores the document to its pre-bridge state exactly.
 */
export function resetThemeBridge(): void {
  for (const [root, ledger] of appliedTokens) {
    for (const key of ledger) root.style.removeProperty(key);
    ledger.clear();
  }
  const target = bridgeTarget();
  if (target) {
    target.style.removeProperty("color-scheme");
    delete (target as HTMLElement).dataset.mode;
  }
}

export function installThemeBridge(options: iThemeBridgeOptions = {}): void {
  window.addEventListener("message", (event) => {
    // Same-origin only: the preview iframe is the app itself.
    if (event.origin !== window.location.origin) return;

    const data = event.data as iBridgeMessage | undefined;
    if (typeof data !== "object" || data === null || typeof (data as any).type !== "string") return;

    switch (data.type) {
      case THEME_BRIDGE_EVENT: {
        const theme = data as iThemeBridgeMessage;
        if (typeof theme.tokens !== "object" || !theme.tokens) return;

        const target = bridgeTarget();
        if (!target) {
          console.warn("[ThemeBridge] No canvas root in a top-level document — theme tokens ignored.");
          return;
        }

        applyTokens(target, theme.tokens);

        // Mirror the mode so `[data-mode="dark"]` blocks in variables.css engage.
        const mode = theme.mode === "dark" ? "dark" : "light";
        target.dataset.mode = mode;
        target.style.colorScheme = mode;
        break;
      }

      case RENDER_BUILDER_EVENT: {
        const render = data as iRenderBuilderMessage;
        if (typeof render.builderId !== "string" || !render.builderId) return;
        options.renderBuilder?.(render.builderId, render.schema);
        break;
      }
    }
  });
}
