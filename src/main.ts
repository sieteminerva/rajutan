import type { iBuilderRegistry, iNodeContent } from './lib/interface';
import { ComponentRegistry } from './lib/Modules/ComponentRegistry';
import { DOMRenderer } from './lib/Modules/DOMRenderer';
import { AnimationsService } from './lib/Modules/Animations/Animations';
import { HashRouter, type iRouteState } from './lib/Modules/HashRouter';
import { HomepageContent } from './content/home';
import { BuildPageContent } from './content/wizard';
import { ResultPageContent } from './content/result';

import './lib/Styles/variables.css';
import './lib/Styles/typography.css';
import './lib/Styles/components.css';
import './lib/Styles/layout.css';
import './lib/Styles/icon.css';
import './style.css';
import { EventEmitter } from './lib/Modules/EventEmitter';

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
  switch (key) {
    case 'build': return BuildPageContent;
    case 'result': return ResultPageContent;
    default: return HomepageContent;
  }
}

// Infrastruktur bersama (dibangun sekali di bootstrap)
let renderer: DOMRenderer;
let animation: AnimationsService;
let buildBuilderFn: (name: keyof iBuilderRegistry, data: any) => HTMLElement | null;
let renderFn: (node: any) => HTMLElement | null;
let currentRoot: HTMLElement | null = null;

/** Render satu halaman (rute) ke dalam #app — mengganti akar sebelumnya. */
export function renderPage(route: string): void {
  const page = pageContentFor(route);
  const tree = renderer.render(page, renderFn, buildBuilderFn);
  if (currentRoot && currentRoot.isConnected) {
    currentRoot.replaceWith(tree);
  } else {
    const app = document.getElementById('app');
    if (app) app.replaceWith(tree);
  }
  currentRoot = tree;
  animation.init();
}

/** Pasang HashRouter + jalankan render awal sesuai hash URL. */
function bootRouting(): void {
  const router = new HashRouter(
    "home",
    "default",
    ["home", "build", "result"],
    (state: iRouteState) => renderPage(state.route)
  );

  // Render pertama mengikuti posisi hash saat ini.
  renderPage(router.parseUrlHash().route);

  // Ekspos ke konsol untuk debugging manual: `window.__router.navigate('build')`
  (globalThis as any).__router = router;
}

async function start(container: HTMLElement) {
  // registerServiceWorker();
  // @ts-ignore
  const emitter = new EventEmitter();
  animation = new AnimationsService();
  const components = new ComponentRegistry()
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

  await components.preloadComponents(["form", "table"], [])

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