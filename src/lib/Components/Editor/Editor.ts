import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";
// 🧩 The theme builder is instantiated BY THIS builder (no ComponentRegistry
// entry needed), so its module — and its stylesheet — ride along with the
// editor chunk instead of being lazily loaded by path.
import { ColorThemeBuilder } from "./ColorTheme/ColorTheme";
import "./ColorTheme/ColorTheme.css";
// 🧩 Same deal as the theme builder: the form editor is instantiated BY THIS
// builder (no ComponentRegistry entry needed), so its module — and its
// stylesheet — ride along with the editor chunk too.
import { FormEditorBuilder } from "../Form/FormEditor/FormEditor";
import "../Form/FormEditor/FormEditor.css";

import {
  THEME_BRIDGE_EVENT,
  THEME_TOKENS_EVENT,
  type iThemeBridgeMessage,
  type iThemeTokensDetail,
} from "./Editor.preview";

export type EditorElementType =
  | "@editor"
  | "@editor>preview"
  | "@editor>menu-top"
  | "@editor>menu-left"
  | "@editor>menu-right"
  | "@editor>color-configurator"
  | "@editor>color-report"
  | "@editor>form-editor"
  | "@editor>menu-top>mode"
  | "@editor>trigger"
  ;

export interface iEditorConfig extends iBuilderConfig<EditorElementType> {
  slots: Partial<Record<EditorElementType, string>>
  /** Initial route the preview iframe loads — navigation afterwards is the page's own. */
  route?: string;
}

export class EditorBuilder extends Builder<EditorElementType, iEditorConfig> {
  builderId = "editor" as keyof iBuilderRegistry;
  name = "editor" as keyof iBuilderRegistry;
  stylesheet: string = "./Editor.css";

  /** Latest theme broadcast (kept for re-push after iframe reloads). */
  #tokens: iThemeTokensDetail | undefined;
  /** Abort controller for cleaning up event listeners on destroy. */
  #abort = new AbortController();
  /** Unwatch functions for the reactive root sync registered in initialize(). */
  #unwatch: Array<() => void> = [];
  /** 🧩 The theme builder this editor instantiates and owns (see prepare()). */
  #colorizer?: ColorThemeBuilder;
  /** 🧩 The form builder this editor instantiates and owns (see prepare()). */
  #formBuilder?: FormEditorBuilder;

  constructor(config: Partial<iEditorConfig>) {
    super();
    const defaultSelectors = {
      "@editor": { tagName: "main", className: "editor" },
      "@editor>preview": { tagName: "iframe", className: "display" },
      "@editor>menu-top": { tagName: "nav", className: "menu top" },
      "@editor>menu-left": { tagName: "aside", className: "menu left" },
      "@editor>menu-right": { tagName: "aside", className: "menu right" },

      "@editor>trigger": { tagName: "button", className: "trigger" },
      // elements for slot
      "@editor>menu-top>mode": { tagName: "template", attrs: { style: "display: none" } },
      "@editor>color-configurator": { tagName: "template", attrs: { style: "display: none" } },
      "@editor>color-report": { tagName: "template", attrs: { style: "display: none" } },
      "@editor>form-editor": { tagName: "template", attrs: { style: "display: none" } }
    };

    const defaultConfig: Required<iEditorConfig> = {
      themeId: "default",
      namespace: "",
      emit: null,
      selectors: defaultSelectors,
      slots: {
        "@editor>color-configurator": "color-configurator",
        "@editor>color-report": "color-report",
        "@editor>menu-top>mode": "color-mode",
        // 🖐️ The left-menu `form-builder` trigger toggles the projected form
        // editor — slotKey must match that trigger's class name.
        "@editor>form-editor": "form-builder",
      },
      route: "home",
    }

    this.config = this.resolveConfig(defaultConfig, config);
  }

  public prepare(_content: any, _config?: Required<iEditorConfig> | undefined): HTMLElement | Record<string, any | HTMLElement> {
    const root = this.render("@editor")!;

    // 🧩 CHILD INSTANTIATED HERE — nothing is registered anywhere: this builder
    // owns its theme builder, and that builder's prepare() projects its own
    // `@colorizer>configurator` panel into the `color-configurator` slot declared
    // in this builder's config.slots. The child's own root is not mounted — the
    // editor only wants its control panel, the output is the preview iframe
    // (re-themed live through THEME_TOKENS_EVENT).
    this.#colorizer = new ColorThemeBuilder({ themeId: this.config.themeId });
    this.#colorizer
      .attach("@colorizer>configurator", "color-configurator")
      .attach("@colorizer>output", "color-report")
      .attach("@colorizer>mode", "color-mode");

    // 🧩 …and the very same deal for the form editor: instantiated here (so
    // this builder is its caller), its WHOLE `@form-editor>canvas` root (the
    // `section`-wrapped `form.canvas`) projected into the `form-builder` slot.
    // attach() welds the receptacle's `hidden` class + `data-slot` onto the
    // mounted root, then runs the child's initialize() scoped to it — no
    // registry entry, no separate mount.
    this.#formBuilder = new FormEditorBuilder({});
    this.#formBuilder.attach("@form-editor>canvas", "form-builder");

    return root;
  }

  protected template(typeKey: EditorElementType, el: HTMLElement, payload?: any, _props?: iActionProperty): void {
    switch (typeKey) {
      case "@editor":
        const menuTop = this.render("@editor>menu-top")!;
        const preview = this.render("@editor>preview")!;
        const menuLeft = this.render("@editor>menu-left")!;
        const menuRight = this.render("@editor>menu-right")!;
        const colorConfigurator = this.render("@editor>color-configurator")!;
        colorConfigurator.className = "hidden";
        const formEditor = this.render("@editor>form-editor")!;
        formEditor.className = "hidden";

        const colorReport = this.render("@editor>color-report")!;
        colorReport.className = "hidden";

        el.append(menuTop, colorConfigurator, formEditor, preview, menuLeft, menuRight, colorReport)
        break;

      case "@editor>preview":
        // `el` is the iframe (selector maps preview → iframe). The page inside
        // owns its own navigation from here on — every internal nav click is
        // handled by its own HashRouter (in editor mode: replaceState, no
        // storage writes). Route switches reload the document, wiping pushed
        // tokens — re-forward the latest broadcast once the fresh document
        // (and its receiver) is ready.
        const frame = el as HTMLIFrameElement;
        const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
        frame.src = `${window.location.origin}${base}#${this.config.route}?editor=true`;
        frame.addEventListener("load", () => {
          this.#pushTokens();
        }, { signal: this.#abort.signal });
        break;

      case "@editor>menu-top":

        const modeSwitcher = this.render("@editor>menu-top>mode")!;

        // Reserved for editor chrome (workspace actions, view toggles…).

        el.append(modeSwitcher);
        break;

      case "@editor>menu-left":
        const colorConfiguratorTrigger = this.render("@editor>trigger", { className: "color-configurator", icon: "editor mixer" })!;
        const colorReportTrigger = this.render("@editor>trigger", { className: "color-report", icon: "editor report" })!;
        const treeStructureTrigger = this.render("@editor>trigger", { className: "tree-structure", icon: "tree structure" })!;
        const formBuilderTrigger = this.render("@editor>trigger", { className: "form-builder", icon: "editor form" })!;
        const componentBuilderTrigger = this.render("@editor>trigger", { className: "component-builder", icon: "editor component" })!;
        el.append(colorConfiguratorTrigger, colorReportTrigger, treeStructureTrigger, formBuilderTrigger, componentBuilderTrigger);
        break;

      case "@editor>menu-right":

        break;

      case "@editor>trigger":
        if (payload.className) {
          el.classList.add(payload.className);
          el.title = `Click to open the ${payload.className.split("-").join(" ")}`
        }
        if (payload.icon) {
          const i = document.createElement("i");
          i.className = `${payload.icon} icon`;
          el.append(i);
        }
        if (payload.textContent) {
          el.textContent = payload.textContent;
        }
        break;

    }
  }

  /**
   * The decoupling channel: theme builders broadcast derived tokens on
   * `window` (THEME_TOKENS_EVENT); this editor forwards them into the
   * iframe as THEME_BRIDGE_EVENT. No direct references between the builders.
   */
  public initialize(root?: HTMLElement): void {
    if (!root) return;

    const triggers = root.querySelectorAll("button.trigger");

    window.addEventListener(THEME_TOKENS_EVENT, ((event: CustomEvent<iThemeTokensDetail>) => {
      // Remember the latest broadcast so iframe reloads can re-push it.
      this.#tokens = event.detail;
      this.#pushTokens();
    }) as EventListener, { signal: this.#abort.signal });

    const triggerMap = ["color-configurator", "color-report", "form-builder"]

    for (const btn of triggers) {
      triggerMap.forEach((n: string) => {
        if (btn.classList.contains(n)) {
          btn.addEventListener("click", () => {
            root.querySelector(`[data-slot='${n}']`)?.classList.toggle("hidden");
          })
        }
      })

      if (btn.classList.contains("report")) {
        btn.addEventListener("click", () => {
          root.querySelector("[data-slot='color-report']")?.classList.toggle("hidden");
        })
      }
    }
  }

  /** Forward the latest theme tokens into the iframe's real document. */
  #pushTokens(): void {
    if (!this.#tokens) return;
    const frame = this.load("@editor>preview") as HTMLIFrameElement | undefined;
    frame?.contentWindow?.postMessage(
      { type: THEME_BRIDGE_EVENT, tokens: this.#tokens.tokens, mode: this.#tokens.mode } satisfies iThemeBridgeMessage,
      window.location.origin,
    );
  }

  public destroy(): void {
    for (const unwatch of this.#unwatch) unwatch();
    this.#unwatch.length = 0;
    this.#abort.abort();
    // 🧩 I created the theme builder, so I tear it down (it hands this builder's
    // slot receptacle back on its way out).
    this.#colorizer?.destroy();
    // 🖐️ Same ownership for the form editor.
    this.#formBuilder?.destroy();
  }
}