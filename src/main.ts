/**
 * Rajutan — the client app (wizard, editor, result).
 *
 * Everything mandatory is declared once, here: the module slots, the registry with its
 * components, and the route → content map. Rendering, routing, preloading and teardown
 * belong to `AioApp`; this file no longer wires them by hand.
 *
 * Builders live in two places:
 * - packages (`article`, `form`, `table`) — loaded lazily through the registry;
 * - `src/Components/{editor,color-theme,form-editor}` — app-local builders, registered
 *   the same way a package is (see `registry.ts`).
 *
 * Stylesheets are host-linked, never imported by a builder: an import map rejects
 * `text/css` as a module, and the registry injects each component's sheet through the
 * asset map. The three app-local sheets are linked here because their builders are
 * instantiated directly by the editor, not resolved by the registry.
 */
import {
  AioApp,
  AppStorage,
  ComponentRegistry,
  DOMRenderer,
  type iComponentRoute,
  type iPageContent,
  type iPageContext,
  type iPageController,
  type iPageReadyContext,
} from "@aio-ui/core";
import { AnimationsService } from "@aio-ui/animations";
import { EventEmitter } from "@aio-ui/event-emitter";
import { HashRouter } from "@aio-ui/router";
import { ThemeRenderer } from "@aio-ui/theme";
import { CyberpunkTheme, DefaultTheme } from "@aio-ui/themes";

import "@aio-ui/styles/index.css";
import "@aio-ui/animations/Animations.css";
import "@aio-ui/input/input.css";
import "@aio-ui/input/controls.css";

import "./Components/editor/Editor.css";
import "./Components/color-theme/ColorTheme.css";
import "./Components/form-editor/FormEditor.css";
import "./style.css";

import {
  CANVAS_MOUNT_SELECTOR,
  installThemeBridge,
  isPreviewDocument,
  markPreviewRoot,
} from "./Components/editor/preview";
import { componentAssets, registerAll } from "./registry";
import { HomepageContent } from "./content/home";
import { BlogPageContent } from "./content/blog";
import { BuildPageContent } from "./content/wizard";
import { ResultPageContent } from "./content/result";
import { GeneratorPageContent } from "./content/generator";
import { EditorPageContent } from "./content/editor";
import { FormPageContent } from "./content/form";

/** Live-preview canvas: an empty mount root the theme bridge pushes builder output into. */
const CanvasPageContent: iPageContent = {
  "section#canvas": { attrs: { id: "canvas", "data-canvas": "" }, content: "" },
};

/** Route → content. Keys are normalised by the app (trim, no `#`, lower case). */
const pages: Record<string, iPageContent> = {
  home: HomepageContent,
  build: BuildPageContent,
  result: ResultPageContent,
  blog: BlogPageContent,
  generator: GeneratorPageContent,
  editor: EditorPageContent,
  form: FormPageContent,
  canvas: CanvasPageContent,
};

/**
 * What each route mounts, declared once.
 *
 * A node's `builder` names the component that node *is*; a builder called inside
 * `onCreated` is invisible to the node collector, so the plan is the only thing that
 * preloads it. A route that resolves to a missing entry fails on a cold load.
 */
const componentRoutes: iComponentRoute[] = [
  { route: "build", components: ["form", "table"] },
  { route: "blog", components: ["article"] },
  { route: "generator", components: ["form", "color-theme"] },
  { route: "editor", components: ["form", "color-theme", "editor"] },
  { route: "form", components: ["form", "form-editor"] },
  { route: "canvas", components: [] },
];

/**
 * Per-route behaviour, applied to every page:
 *
 * - `editor` is blocked inside the preview iframe (it would nest an editor inside an
 *   editor); the guard runs before preload, which is cheaper than rendering then bouncing;
 * - a freshly rendered root is re-tagged as preview, because the app swaps the page root
 *   on every navigation.
 */
class RajutanPage implements iPageController {
  onPrepare(context: iPageContext): iPageContent | void {
    if (context.route === "editor" && isPreviewDocument()) return HomepageContent;
  }

  onReady(context: iPageReadyContext): void {
    markPreviewRoot(context.shell);
  }
}

const container = document.querySelector<HTMLDivElement>("#app");

async function start(host: HTMLElement): Promise<void> {
  const registry = registerAll(new ComponentRegistry(componentAssets));
  const emitter = new EventEmitter();

  // 🖼 Live-preview bridge: this app instance accepts token + builder pushes from the
  // ColorThemeBuilder's iframe (see `src/Components/editor/preview.ts`).
  installThemeBridge({
    renderBuilder: async (builderId, schema) => {
      await registry.load([builderId]);
      const element = registry.build(builderId as never, schema);
      const canvas = document.querySelector(CANVAS_MOUNT_SELECTOR);
      if (element && canvas) canvas.replaceChildren(element);
    },
  });

  const app = new AioApp({
    container: host,
    defaultRoute: "home",
    debug: true,
    source: { pages },
  })
    .registerModule(registry, componentRoutes)
    .registerModule(HashRouter)
    .registerModule(DOMRenderer)
    .registerModule(AppStorage, { driver: globalThis.localStorage })
    .registerModule(AnimationsService)
    .registerModule(ThemeRenderer, { themes: [new DefaultTheme(), new CyberpunkTheme()] })
    .registerModule(emitter);

  for (const route of Object.keys(pages)) app.registerPage(route, RajutanPage);

  await app.render();

  // Debug handles for the console: `__app` and the bus components publish through.
  (globalThis as any).__app = app;
  (globalThis as any).__emitter = emitter;

  // A hash route is not a navigation the browser scrolls for us.
  window.addEventListener("hashchange", () => window.scrollTo({ top: 0, left: 0 }));
}

if (container) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      start(container).catch(console.error);
    });
  } else {
    start(container).catch(console.error);
  }
}
