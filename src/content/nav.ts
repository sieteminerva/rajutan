/**
 * The app's top bar, shared by every page that shows one.
 *
 * It is the real `@aio-ui/menu` builder, not hand-authored markup: the builder owns the
 * `<nav class="nav">` shape the package stylesheet targets, so the bar is styled and
 * behaves exactly like the documented component (active route, brand, CTA action).
 *
 * `onNavigate` returns `false` on purpose — the default swallows every link that carries
 * an `href`, and this app is a hash router that must see the click itself.
 */
import type { iBasicNode } from "@aio-ui/core";

/** One link in the bar. */
export interface NavLink {
  label: string;
  href: string;
  /** Extra classes on the anchor; `button` promotes the entry to the CTA group. */
  className?: string;
  /** In-page anchor (`#how`): rendered only where that section exists — the home route. */
  section?: boolean;
}

/** Routes the hash router owns. */
const ROUTES = new Set(["home", "build", "result", "blog", "generator", "editor", "form", "canvas"]);

/**
 * The bar, declared once. Every page renders this list — a page never keeps its own copy,
 * so a new route is added here and nowhere else.
 */
const BAR: NavLink[] = [
  { label: "Beranda", href: "#home" },
  { label: "Cara Kerja", href: "#how", section: true },
  { label: "Fitur", href: "#features", section: true },
  { label: "Tanya Jawab", href: "#faq", section: true },
  { label: "Artikel", href: "#blog" },
  { label: "Form Editor", href: "#form" },
];

/** Route-only entries the shared bar cannot know: they exist because that page ends there. */
const EXTRAS: Record<string, NavLink[]> = {
  result: [{ label: "Buat Lagi", href: "#build" }],
};

/** CTA group, always last. */
const ACTIONS: NavLink[] = [{ label: "Live Editor", href: "#editor", className: "button" }];

/**
 * Lets the router own route links, and turns an in-page anchor (`#how`) into a smooth
 * scroll on the current page.
 */
function onNavigate(href?: string): boolean {
  if (!href) return true;

  const id = href.replace(/^#/, "").trim();
  if (!id || ROUTES.has(id.toLowerCase())) return false;

  const target = document.getElementById(id);
  if (!target) return false;

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/** Marks the entry whose route is live. The anchor owns the pill (`a.is-active` in Menu.css). */
function entry(link: NavLink, route: string): NavLink {
  const active = link.href.replace(/^#/, "").toLowerCase() === route;
  const className = [link.className, active ? "is-active" : ""].filter(Boolean).join(" ");

  // Rebuilt instead of spread: `section` is a build-time marker, not menu payload.
  return className
    ? { label: link.label, href: link.href, className }
    : { label: link.label, href: link.href };
}

/**
 * The top bar for one route.
 *
 * `attachMenu()` calls this on every render, which is why it returns a fresh node instead of
 * mutating `source.menu` — the source object is shared by every render pass.
 *
 * @param route - Normalised route the app is about to render.
 * @returns A menu node whose `builder` is `menu`, with the live route marked `is-active`.
 */
export function menuFor(route: string): iBasicNode {
  const navigations = [
    ...BAR.filter((link) => !link.section || route === "home"),
    ...(EXTRAS[route] ?? []),
  ].map((link) => entry(link, route));

  return {
    "div#top-menu": {
      builder: "menu",
      // The component owns the element: without this the built bar is appended into the
      // host instead of replacing it, and the host is what ends up in the page.
      isRoot: true,
      config: { position: "top", onNavigate },
      content: {
        brand: { label: "Rajutan", href: "#home" },
        navigations,
        actions: ACTIONS,
      },
    },
  };
}
