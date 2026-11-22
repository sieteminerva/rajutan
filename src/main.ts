/**
 * Rajutan — the client app (wizard, editor, result).
 *
 * Everything mandatory is declared once, here: the module slots, the registry with its
 * components, the route table (content + preload plan), and the one menu bar. Rendering,
 * routing, preloading, menu activation and teardown belong to `AioApp`; this file does not
 * wire them by hand.
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
  type iBasicNode,
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
import { menuFor } from "./content/nav";
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

/**
 * One table for the whole route contract: content and preload plan.
 *
 * `requires` is the same field `iPageDefinition` carries, so a generated app and this one
 * describe a route the same way. Where the key came from matters: `requires` is for a
 * builder called inside `onCreated` (invisible to the node collector, so nothing else
 * would preload it); a node's own `builder` is collected from the page tree.
 */
interface iRoute {
  route: string;
  content: iPageContent;
  requires: string[];
}

/**
 * Routes in menubar order. Keys are normalised by the app (trim, no `#`, lower case).
 *
 * A route that resolves to a missing entry fails on a cold load.
 */
const routes: iRoute[] = [
  { route: "home", content: HomepageContent, requires: [] },
  { route: "build", content: BuildPageContent, requires: ["form", "table"] },
  { route: "result", content: ResultPageContent, requires: [] },
  { route: "blog", content: BlogPageContent, requires: ["article"] },
  { route: "generator", content: GeneratorPageContent, requires: ["form", "color-theme"] },
  { route: "editor", content: EditorPageContent, requires: ["form", "color-theme", "editor"] },
  { route: "form", content: FormPageContent, requires: ["form", "form-editor"] },
  { route: "canvas", content: CanvasPageContent, requires: [] },
];

const pages: Record<string, iPageContent> = Object.fromEntries(
  routes.map(({ route, content }) => [route, content]),
);

/**
 * Per-route behaviour, applied to every page:
 *
 * - `editor` is blocked inside the preview iframe (it would nest an editor inside an
 *   editor); the guard runs before preload, which is cheaper than rendering then bouncing;
 * - a freshly rendered root is re-tagged as preview, because the app swaps the page root
 *   on every navigation.
 */
class RajutanPage implements iPageController {
  readonly #route: string;

  constructor(_config: unknown, context: iPageContext) {
    this.#route = context.route;
  }

  onPrepare(context: iPageContext): iPageContent | void {
    if (context.route === "editor" && isPreviewDocument()) return HomepageContent;
  }

  /**
   * The bar is built here, per render, not authored into each page tree: one list in
   * `nav.ts`, one active entry, and no page can drift from the others.
   */
  attachMenu(): iBasicNode {
    return menuFor(this.#route);
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
    // The menu slot is filled once; `attachMenu()` rebuilds it per route.
    source: { pages, menu: menuFor("home") },
  })
    .registerModule(registry)
    .registerModule(HashRouter)
    .registerModule(DOMRenderer)
    .registerModule(AppStorage, { driver: globalThis.localStorage })
    .registerModule(AnimationsService)
    .registerModule(ThemeRenderer, { themes: [new DefaultTheme(), new CyberpunkTheme()] })
    .registerModule(emitter);

  // One declarative pass: the definition owns the route + preload plan, the class owns
  // the behaviour. Registering both keeps the preload plan out of `registerModule`.
  for (const { route, requires } of routes) {
    app.registerPage({ route, requires }).registerPage(route, RajutanPage);
  }

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
