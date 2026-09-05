import { HomepageContent } from './content';
import type { iBuilderRegistry } from './lib/interface';
import { ComponentRegistry } from '../draft/ComponentRegistry2';
import { DOMRenderer } from './lib/Modules/DOMRenderer';
import { AnimationsService } from './lib/Modules/Animations/Animations';

import './lib/Styles/variables.css';
import './lib/Styles/typography.css';
import './lib/Styles/components.css';
import './lib/Styles/layout.css';
import './lib/Styles/icon.css';
import './style.css';
import { EventEmitter } from './lib/Modules/EventEmitter';

// 🔐 Daftarkan Service Worker supaya id_token disimpan di variabel SW.
// BASE_URL mengikuti base vite ("/rajutan/") agar cocok dengan scope GitHub Pages.
function registerServiceWorker() {
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

async function start(container: HTMLElement) {
  registerServiceWorker();
  // @ts-ignore
  const emitter = new EventEmitter();
  const animation = new AnimationsService();
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

  const renderer = new DOMRenderer();
  const DomTree = renderer.render(
    HomepageContent,
    (node) => renderer.render(node, undefined, undefined),
    (name: keyof iBuilderRegistry, data: any) => components.build(name, data)
  )
  container.replaceWith(DomTree);
  animation.init()
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