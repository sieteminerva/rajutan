import type { iBuilderRegistry, iNodeContent } from './lib/interface';
import { ComponentRegistry } from './lib/Modules/ComponentRegistry';
import { DOMRenderer } from './lib/Modules/DOMRenderer';
import { AnimationsService } from './lib/Modules/Animations/Animations';
import { HashRouter, type iRouteState } from './lib/Modules/HashRouter';
import { installThemeBridge, CANVAS_MOUNT_SELECTOR, markPreviewRoot } from './lib/Components/Editor/Editor.preview';
import { EventEmitter } from './lib/Modules/EventEmitter';
import { HomepageContent } from './content/home';
import { BlogPageContent } from './content/blog';
import { BuildPageContent } from './content/wizard';
import { ResultPageContent } from './content/result';

import './lib/Styles/variables.css';
import './lib/Styles/typography.css';
import './lib/Styles/components.css';
import './lib/Styles/layout.css';
import './lib/Styles/icon.css';
import './style.css';


import formResult from './payload.json';
import { GeneratorPageContent } from './content/generator';
import { EditorPageContent } from './content/editor';
import { FormPageContent } from './content/form';


function toTable(obj: any, keyName: string) {
  return {
    header: Object.keys(obj[keyName][0]),
    body: obj[keyName].map((v: any) => {
      return Object.values(v)
    })
  }
}

toTable(formResult, 'detail-product');

// 🔐 Daftarkan Service Worker supaya id_token disimpan di variabel SW.
// BASE_URL mengikuti base vite ("/rajutan/") agar cocok dengan scope GitHub Pages.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const base = import.meta.env.BASE_URL || '/';
  const swUrl = `${base}sw.js`;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(swUrl, { scope: base })
      .then((reg) => console.log('[SW] registrasi aktif, scope:', reg.scope))
      .catch((err) => console.warn('[SW] registrasi gagal:', err));
  });
}

/** Peta rute → konten halaman. Unknown/`home` selalu jatuh ke HomepageContent. */
function pageContentFor(route: string): iNodeContent {
  const key = route.trim().toLowerCase().replace(/^#|\/+$/g, '') || 'home';
  // 🚫 Preview guard (last line of defense): the preview iframe boots the
  // whole app — resolving `editor` here would nest an editor inside the
  // preview iframe. Bounce to home (router guards normally catch this first,
  // but programmatic renderPage calls bypass the router).
  try {
    if (key === 'editor' && window.self !== window.top) {
      console.warn('[Preview] Route "editor" is blocked in preview — serving home.');
      return HomepageContent;
    }
  } catch {
    return HomepageContent;
  }
  switch (key) {
    case 'build': return BuildPageContent;
    case 'result': return ResultPageContent;
    case 'blog': return BlogPageContent;
    case 'generator': return GeneratorPageContent;
    case 'editor': return EditorPageContent;
    case 'form': return FormPageContent;
    // 🖼 Live-preview canvas: an empty mount root; ColorThemeBuilder pushes
    // builder output here via the bridge (RENDER_BUILDER, see ColorTheme.preview.ts).
    case 'canvas': return { "#app": { attrs: { id: "app", "data-canvas": "" } } };
    default: return HomepageContent;
  }
}

// Infrastruktur bersama (dibangun sekali di bootstrap)
let renderer: DOMRenderer;
let animation: AnimationsService;
let components: ComponentRegistry;
let buildBuilderFn: (name: keyof iBuilderRegistry, data: any) => HTMLElement | null;
let renderFn: (node: any) => HTMLElement | null;
let currentRoot: HTMLElement | null = null;
let renderSequence = 0;

function buildersForRoute(route: string): string[] {
  switch (route.trim().toLowerCase().replace(/^#|\/+$/g, '')) {
    case 'build': return ['form', 'table'];
    case 'blog': return ['article'];
    case 'generator': return ['form', 'color-theme'];
    case 'editor': return ['form', 'color-theme', 'editor'];
    case 'form': return ['form', 'form-editor'];
    // Canvas builders are preloaded on demand by the bridge's renderBuilder hook.
    case 'canvas': return [];
    default: return [];
  }
}

/** Render satu halaman (rute) ke dalam #app — mengganti akar sebelumnya. */
export async function renderPage(route: string): Promise<void> {
  const sequence = ++renderSequence;
  await components.preloadComponents(buildersForRoute(route), []);
  if (sequence !== renderSequence) return;

  const page = pageContentFor(route);
  const tree = renderer.render(page, renderFn, buildBuilderFn);
  if (currentRoot && currentRoot.isConnected) {
    currentRoot.replaceWith(tree);
  } else {
    const app = document.getElementById('app');
    if (app) app.replaceWith(tree);
  }
  currentRoot = tree;
  // The bridge tags #app with `editor-mode` at boot, but renderPage() swaps
  // the root via replaceWith() — re-tag so the preview class survives every
  // route render (no-op on the top-level editor page).
  markPreviewRoot(tree);
  animation.init();
}

/** Pasang HashRouter + jalankan render awal sesuai hash URL. */
function bootRouting(): void {
  const router = new HashRouter(
    "home",
    "default",
    ["home", "build", "result", "blog", "generator", "editor", "form", "canvas"],
    (state: iRouteState) => renderPage(state.route)
  );

  // Render pertama mengikuti posisi hash saat ini.
  renderPage(router.parseUrlHash().route);

  // Ekspos ke konsol untuk debugging manual: `window.__router.navigate('build')`
  (globalThis as any).__router = router;
}

async function start(container: HTMLElement) {
  // registerServiceWorker();
  // 🖼 Live-preview bridge: this app instance accepts token + builder pushes
  // from a ColorThemeBuilder parent iframe (see ColorTheme.preview.ts).
  installThemeBridge({
    renderBuilder: async (builderId, schema) => {
      await components.preloadComponents([builderId], []);
      const element = buildBuilderFn(builderId as keyof iBuilderRegistry, schema);
      const canvas = document.querySelector(CANVAS_MOUNT_SELECTOR);
      if (element && canvas) canvas.replaceChildren(element);
    },
  });
  // @ts-ignore
  const emitter = new EventEmitter();
  animation = new AnimationsService();
  components = new ComponentRegistry()
    .register("form", (data: any) => {
      return {
        path: "lib/Components/Form/Form.ts",
        stylesheet: "lib/Components/Form/Form.css", // alternative style definition also didn't loaded
        config: Object.assign({}, data?.config || {}, { emit: (event: any, payload: any) => emitter.emit(event, payload as any) }),
        schema: data?.schema !== undefined ? data.schema : (data?.content !== undefined ? data.content : data),
      };
    })

    .register("table", (data: any) => {
      return {
        path: "lib/Components/Table/Table.ts",
        stylesheet: "lib/Components/Table/Table.css", // alternative style definition also didn't loaded
        config: data?.config,
        schema: data?.schema !== undefined ? data.schema : (data?.content !== undefined ? data.content : data),
      };
    })

    .register("article", (data: any) => {
      return {
        path: "lib/Components/Article/Article.ts",
        stylesheet: "lib/Components/Article/Article.css", // alternative style definition also didn't loaded
        config: data?.config,
        schema: data?.schema !== undefined ? data.schema : (data?.content !== undefined ? data.content : data),
      };
    })

    .register("color-theme", (data: any) => {
      return {
        path: "lib/Components/Editor/ColorTheme/ColorTheme.ts",
        stylesheet: "lib/Components/Editor/ColorTheme/ColorTheme.css", // alternative style definition also didn't loaded
        config: data?.config,
        schema: data?.schema !== undefined ? data.schema : (data?.content !== undefined ? data.content : data),
      };
    })

    .register("editor", (data: any) => {
      return {
        path: "lib/Components/Editor/Editor.ts",
        stylesheet: "lib/Components/Editor/Editor.css", // alternative style definition also didn't loaded
        config: data?.config,
        schema: data?.schema !== undefined ? data.schema : (data?.content !== undefined ? data.content : data),
      };
    })
    .register("form-editor", (data: any) => {
      return {
        path: "lib/Components/Form/FormEditor/FormEditor.ts",
        stylesheet: "lib/Components/Form/FormEditor/FormEditor.css", // alternative style definition also didn't loaded
        config: data?.config,
        schema: data?.schema !== undefined ? data.schema : (data?.content !== undefined ? data.content : data),
      };
    })

  renderer = new DOMRenderer();
  renderFn = (node) => renderer.render(node, undefined, undefined);
  buildBuilderFn = (name, data) => components.build(name, data);

  bootRouting();

  // `container` (asli #app dari index.html) akan diganti renderPage — pastikan
  // referensi akar awal mengarah ke sana bila hash kosong.
  if (!currentRoot && container) currentRoot = container;
}

const app = document.querySelector<HTMLDivElement>('#app')
if (app) {
  // `<script type="module">` sudah deferred → DOM & document.head sudah ada,
  // jadi ini hanya jaring pengaman bila entry dieksekusi lebih awal
  // (mis. di-inline / kondisi parses lucu) supaya #app & document.head pasti siap.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { start(app).catch(console.error) })
  } else {
    start(app).catch(console.error)
  }
}