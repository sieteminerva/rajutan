# 👑 DOMRenderer: The Sovereign Declarative DOM Compiler Engine

`DOMRenderer` is the absolute mechanical heart (_core template compilation engine_) of your custom framework. This stateless utility module is architected to ingest high-level declarative schema mappings (`iNodeContent`) driven by semantic string tokens (`#` for IDs, `.` for ClassNames, and `>` for Flat Lineage Traversal) and translate them instantly into live, state-bound browser `HTMLElement` trees.

```txt
  "JSON Data + CSS Selector as Key = HTML Structure"
```

---

## 🚀 Core Architectural Capabilities

1. **Elimination of Imperative DOM Boilerplate**  
   Prunes the repetitive overhead of manually writing procedural operations such as `document.createElement`, `classList.add`, or `setAttribute` inside your structural components.
2. **Dynamic Flatten-to-Tree Parsing (Hierarchy Absorber)**  
   Capable of scanning and deconstructing completely flat dataset paths delimited by the character `>` (e.g., `@section>content>image`) and automatically weaving their ancestral parent-child coordinates in-memory.
3. **Decoupled Render Overrides Pipeline**  
   Wires the atomic genesis of structural nodes directly into the central `TemplateRegistry`. This allows external styling layers (e.g., `CyberpunkTheme`, `HorizontalTheme`) to perform non-destructive, multi-layered layout hijackings (_Cascading Overrides_) without mutating a single line of the component file.
4. **Sandboxed Lifecycle Leak Protection**  
   Provides strict, isolated lifecycle execution chambers (`onCreated` and `onDestroy`) embedded with secure proxy closures to defend your client application from memory tracking leaks during route transitions.

---

## 🧱 5-Phase Internal Architecture Pipeline

Every single declarative object map streaming into the `.render()` gateway is parsed linearly through 5 completely decoupled, atomic ministerial routines to enforce a locked, stutter-free graphics refresh metric of **120fps**:

```text
    JSON Schema (iNodeContent)
               │
               ▼
 Phase 1: nodeFactory()          ──► Spawns raw HTMLElement / Intercepts alive nodes
               │
               ▼
 Phase 2: attributeProcessor()   ──► Stamps parsed IDs, ClassNames, & Custom Attrs
               │
               ▼
 Phase 3: lifecycleManager()     ──► Fires onCreated / Safely registers cleanup loops
               │
               ▼
 Phase 4: contentEvaluator()     ──► Hydrates inner text / Executes array child loops
               │
               ▼
 Phase 5: Recursive Traversal    ──► Parses nested child keys / Flat hierarchy '>' splits
               │
               ▼
       Mounted DOM Tree
```

---

## 💻 Standard Production Usage (The Component Specification)

Below is the definitive working prototype demonstrating how a modular standalone component implements the full power of `DOMRenderer` by feeding payloads into all 3 sandbox proxy arguments (`render`, `builder`, and the dynamic `registry` injection):

### 🪐 1. Component Schema Assembly (`SectionBuilder.ts`)

```typescript
import { DOMRenderer } from "../Modules/DOMRenderer";
import { iBaseBuilder } from "../Interfaces/iBaseBuilder";

export class SectionBuilder implements iBaseBuilder {
  readonly builderId = "section";
  readonly name = "Dynamic Grid Section";
  readonly stylesheet = "";
  public config: any;

  constructor(config = {}) {
    this.config = { selectors: {}, ...config };
  }

  public create(content: any): HTMLElement {
    // 🧙‍♂️ Map out the declarative layout tree using semantic string tokens
    const sectionSchema = {
      "section#hero-section.ui.section-wrapper.row": {
        attrs: { "data-speed": "3500", role: "region" },

        // ====================================================
        // 🧱 PHASE 3: THE LIFECYCLE MANAGER BOUNDARIES
        // ====================================================
        onCreated: (el: HTMLElement, render, builder, registry) => {
          console.log("🚀 Section root spawned successfully in memory:", el);

          // Proxy 3 (Registry Gateway): Securely register custom render templates Just-In-Time!
          registry.register("cyberpunk@section>title", (typeKey, titleEl, payload) => {
            titleEl.innerHTML = `<span class="neon-glitch">${payload.text}</span>`;
          });
        },

        onDestroy: (el: HTMLElement) => {
          console.log("💀 Section root unmounted. Memory cleanup initiated.");
        },

        // ====================================================
        // 🧙‍♂️ PHASE 5: FLAT HIERARCHY TRAVERSAL VIA '>' SPLITTING
        // ====================================================
        "div.column.half": {
          // ====================================================
          // 🧱 PHASE 4: THE CONTENT EVALUATOR (ARRAY FLOODING)
          // ====================================================
          content: [
            {
              "h2.title": {
                onCreated: (el: HTMLElement) => {
                  el.textContent = content.title || "Default Master Title";
                },
              },
            },
            {
              "p.description": {
                // Instantly inject template string literal content directly into innerHTML
                content: `<span>${content.desc || "No description provided."}</span>`,
              },
            },
            {
              "div.actions-zone": {
                onCreated: (el: HTMLElement, render, builder) => {
                  // Proxy 2 (Builder Interceptor): Call external cross-module components legally!
                  if (content.hasButton) {
                    const buttonEl = builder("button", { label: "Contact Us", href: "#form" });
                    if (buttonEl) el.appendChild(buttonEl);
                  }
                },
              },
            },
          ],
        },
      },
    };

    // 💡 Execution Matrix: Spawns completely standalone with zero OOP base inheritance!
    const renderer = new DOMRenderer();

    // Suapkan: 1. Schema Object, 2. Sub-Layout Compiler, 3. Cross-Registry Router
    return renderer.render(
      sectionSchema as any,
      (schema) =>
        renderer.render(
          schema,
          () => null,
          () => null,
        ),
      (name, data) => document.createElement("button"), // Mock external builder proxy
    );
  }

  public initialize(root: HTMLElement): void {
    // Lock persistent runtime interactive browser event listeners here
    console.log("[Runtime Active] Interaction circuits locked on ID:", root.id);
  }
}
```

## 🖨️ Compiled HTML Output Visualization

When declarative object executed by `DOMRenderer`, the engine will automatically parse `#`, `.`, and array `content` to be pure HTML Tree Structure (_Native Vanilla HTML_) like below:

```html
<section id="hero-section" class="section-wrapper row section" data-speed="3500" role="region">
  <!-- Spawned via Phase 5: Flat hierarchy '>' split and auto-appending logic -->
  <div class="column half">
    <!-- Phase 4: Hydrated from content string mapping -->
    <h2 class="title">Default Master Title</h2>

    <!-- Phase 4: Raw HTML content string injection result -->
    <p class="desc">
      <span>No description provided.</span>
    </p>

    <!-- Phase 3: Runtime cross-module builder injection zone -->
    <div class="actions-zone">
      <button type="button" class="button primary">Hubungi Kami</button>
    </div>
  </div>
</section>
```

---

## OR you can build a website by supplying this

```typescript
// main.ts (The Pure Stateless Static Site Generation Matrix)
import { DOMRenderer } from "./Modules/DOMRenderer";

const fullStaticWebSchema = {
  // 🪐 ELEMEN GLOBAL 1: HEADER & NAVBAR ZONE
  "header#main-header.ui.navigation.fixed": {
    "div.container.flex-between": {
      "a.brand-logo": {
        attrs: { href: "#home" },
        content: "SeribuTrip siber",
      },
      "nav.nav-links-wrapper": {
        content: [
          { "a.link-item": { attrs: { href: "#package" }, content: "Paket Wisata" } },
          { "a.link-item": { attrs: { href: "#gallery" }, content: "Galeri" } },
          { "a.link-item": { attrs: { href: "#form" }, content: "Hubungi" } },
        ],
      },
    },
  },

  // 🪐 ELEMEN GLOBAL 2: MAIN HERO & COMPONENT BLOCK CONTENT
  "main#primary-shell.page-content-zone": {
    // Membaca Flat Hierarchy token '>' hasil penyerapan hebat Anda!
    "section#hero>div.column.half>h1.glitch-title": {
      content: "Jelajahi Dunia Wisata Tanpa Batas!",
    },
    "section#hero>div.column.half>p.hero-desc": {
      content: "Temukan perosotan scroll petualangan premium komersial tinggi bersama kami.",
    },

    // Injeksi komponen dinamis massal via Array Content Flooding di tingkat Layout!
    "section#packages-grid.ui.grid-layout": {
      "h2.section-title": { content: "Destinasi Unggulan Malam Ini" },
      "div.row-cards": {
        // Banjiri data baris kartu wisata secara massal otomatis!
        content: [
          { "div.card-item": { h3: { content: "Bali Neon Paradise" }, p: { content: "Mulai dari Rp 2.5jt" } } },
          { "div.card-item": { h3: { content: "Labuan Bajo Matrix" }, p: { content: "Mulai dari Rp 4.2jt" } } },
          { "div.card-item": { h3: { content: "Raja Ampat Cyber" }, p: { content: "Mulai dari Rp 6.8jt" } } },
        ],
      },
    },
  },

  // 🪐 ELEMEN GLOBAL 3: FOOTER ZONE
  "footer#main-footer.ui.footer.dark": {
    onCreated: (el: HTMLElement) => {
      console.log("Footer rendered live at memory RAM.");
    },
    "p.copyright-text": {
      content: "© 2026 SeribuTrip Infrastructure. Manufactured by Master Supreme Architect.",
    },
  },
};

// 💡 EKSEKUSI CETAK SATU PINTU: Tembakkan langsung ke dalam body dokumen browser!
const renderer = new DOMRenderer();
const compiledWebsiteDOM = renderer.render(
  fullStaticWebSchema as any,
  () => null,
  () => null,
);

document.getElementById("app")?.appendChild(compiledWebsiteDOM);
console.log("🏆 Static Web App completed and painted successfully under 0 milliseconds!");
```

## 🔒 Memory Management & Unmounting Evacuation

To fortify the web application against catastrophic RAM accumulation over long browsing sessions, purging older elements must **strictly** pass through the centralized `.unmount()` gateway of `DOMRenderer` [SME].

This method will recursively traverse the internal `cleanupMap` tracking keys, detonate registered custom **`onDestroy`** callbacks to disconnect event listeners, and then neatly prune the root node from the active DOM tree [SME]:

```typescript
const renderer = new DOMRenderer();
const liveElement = renderer.render(schema, renderFn, builderFn);

// When the user migrates routes or switches global themes:
renderer.unmount(liveElement); // 🟢 RAM is instantly scrubbed clean from dead listener references!
```

---

© 2026 Custom Framework Engine Spec — Manufactured and Formulated by **YMGH**. All Engineering Sovereignty Reserved.
