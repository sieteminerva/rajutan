## Here is the comprehensive and structured README.md file translated and refined in English, explaining the technical background, architecture, benefits, and usage of your custom BuilderRegistry.

## Builder Registry (Native CSS Module Scripts & Dynamic Lazy Loading)

This system is a component management architecture (Builder) based on modern Vanilla JavaScript/TypeScript. It runs natively in the browser without requiring a mandatory bundler setup (like Vite or Webpack).
The architecture takes advantage of the latest web ecosystem specifications—Import Attributes (CSS Module Scripts) and Constructable Stylesheets (document.adoptedStyleSheets)—to fetch and load JavaScript logic alongside CSS assets concurrently, asynchronously, and strictly on-demand (on-demand lazy loading).

---

## 💡 Technical Background & Native Mechanics## 1. The Issue with Traditional @import

Using traditional `@import` statements inside CSS files creates a sequential loading bottleneck which harms web performance. The browser must first download and parse the main CSS file before it can discover, fetch, and read secondary files one by one. This causes a blocking network chain that severely delays page rendering.

## 2. Modern Solution: CSS Module Scripts & Import Attributes

Components in this registry utilize the modern web Import Attributes specification:

```ts
import sheet from "./BuilderA.css" with { type: "css" };
```

When the browser executes this statement, it streams the CSS file in parallel on a background thread and parses it into a native JavaScript object called a `CSSStyleSheet` (Constructable Stylesheet).

## 3. Dynamic Parallel Fetching via Registry

When a consumer requests a component via `.get()`, the Registry triggers an asynchronous dynamic `import()` function for the JavaScript file and the CSS path concurrently using `Promise.all()`.
As soon as the CSS stream completes, it is seamlessly merged into the browser's global runtime layout via:

```ts
document.adoptedStyleSheets = [...document.adoptedStyleSheets, newSheet];
```

## This guarantees that all layout styles are evaluated by the browser engine before the new HTML elements hit the DOM tree, fully eradicating any Flash of Unstyled Content (FOUC).

## 🎯 Objectives & What the Registry Does

1.  Decoupling Orchestration: Isolates the global structural data rules (e.g., data payloads coming from a CMS) from the component initialization logic.
2.  On-Demand Dynamic Injection: Erases unnecessary bandwidth waste by only downloading a builder's script or styling payload if the current active web page explicitly renders that block.
3.  Style Encapsulation & Ordering: Governs the composition order of your active stylesheets, ensuring global design tokens or override rule sets (like index.css) always win specificity by sitting at the tail end of the cascade list.

---

## 🚀 Key Benefits

- ⚡ Maximum Performance (Perfect Code-Splitting): Keeps your primary landing bundle `(index.js)` incredibly lightweight. Visitors browsing a basic landing page never waste data bytes pre-fetching the heavy code blocks or styles of a /dashboard widget.
- 📦 Zero-Configuration Native Support: Runs out of the box directly inside modern browsers over any simple static development server, freeing you from maintaining complex bundler config boilerplate.
- ♻️ Isolated Dependencies (Clean Cleanup): Keeps scripts and stylesheets tightly paired inside their respective directories. Dropping a component's `.register()` string completely drops its network trail from your application layout.
- 🎛️ Multi-Format Versatility: Easily accommodates three distinct operational signatures concurrently (Synchronous, Asynchronous with granular control, and a flat Declarative Metadata structure).

---

## 🛠️ How to Use## 1. Recommended Project Structure

```txt
├── Builders/
│   ├── AccordionBuilder.ts
│   ├── AccordionBuilder.css
│   ├── CarouselBuilder.ts
│   └── CarouselBuilder.css
├── index.css          <-- Global variables / Theme override sheet
└── index.js           <-- Main entry point & component registration
```

## 2. Creating a Standardized Component (e.g., CarouselBuilder.ts)

Each builder component must expose a DOM rendering method, along with an optional static stylesheet attachment if you plan to rely on implicit fallback matching.

```ts
import sheet from "./CarouselBuilder.css" with { type: "css" };
export class CarouselBuilder {
  static stylesheet = sheet; // Extracted automatically by the registry if not defined manually
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  public create(schema: any): HTMLElement {
    const el = document.createElement("div");
    el.className = "carousel-container";
    el.innerHTML = `<h2>${schema.heading}</h2>`;
    return el;
  }
}
```

## 3. Registering Components at your Entry Point (index.js)

The Registry accepts all three architectural formats interchangeably based on your component setup requirements:

```ts
import { BuilderRegistry } from "./BuilderRegistry.ts";
import { MasonryBuilder } from "./Builders/MasonryBuilder.ts"; // Pre-imported for Style 1
const app = {
  component: new BuilderRegistry(),
};

app.component
  // 🔹 STYLE 1: Synchronous Old Way (Component class is pre-imported at the top)
  .register("masonry", (data) => new MasonryBuilder({ category: "category" }).create(data.content))

  // 🔹 STYLE 2: Configurable Async Way (Explicit parameter mapping and precise control over file endpoints)
  .register("accordion", async (data, load) => {
    const AccordionBuilder = await load({
      script: "./Builders/AccordionBuilder.ts",
      stylesheet: "./Builders/AccordionBuilder.css",
    });
    return AccordionBuilder.create({
      config: data.settings,
      schema: data.items,
    });
  })

  // 🔹 STYLE 3: Simple Declarative Way (Return metadata and let the Registry automate instantiation)
  .register("carousel", (data) => {
    return {
      path: "./Builders/CarouselBuilder.ts",
      stylesheet: "./Builders/CarouselBuilder.css",
      config: { loop: true, autoplay: true },
      schema: data.content,
    };
  })

  // 🔹 STYLE 4: CSS-Only Way (Useful for injecting standalone utility layouts or helper classes)
  .register("cool-style", async (data, load) => {
    await load({ stylesheet: "./path/to/cool-style.css" });
    return document.createElement("div"); // Returns an empty element so the execution cycle resolves safely
  });
```

## 4. Running the Main Application Render Loop

When parsing your page structure schema (such as a backend page layout payload), you interact with one unified, asynchronous `.get()` engine. The core execution loop remains clean and completely oblivious to network or parsing configurations.

```ts
async function renderPage(payloadFromCMS) {
  const container = document.getElementById("app");

  for (const block of payloadFromCMS.blocks) {
    if (app.component.has(block.type)) {
      // Asynchronously streams assets, pushes styles, resolves configurations, and outputs HTML
      const domElement = await app.component.get(block.type, block.data);

      if (domElement) {
        container.appendChild(domElement);
      }
    }
  }
}
```

---

## ⚙️ Environment Requirements

- Browser Ecosystem: `Chrome 91+`, `Edge 91+`, `Safari 16.4+`, `Firefox 113+` (Standard baseline criteria supporting native Import Attributes & Constructable Stylesheets).
- Local Development Note: Because this architecture relies on native ES Modules over the wire, running files via direct file path shortcuts `(file://)` will trigger CORS blocking. Spin up a basic local static development server using tools like npx serve . or python -m http.server to view your project.

---
