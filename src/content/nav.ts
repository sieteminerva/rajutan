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
import type { iNodeContent } from "@aio-ui/core";

/** One link in the bar. */
export interface NavLink {
  label: string;
  href: string;
  /** `button` promotes the entry to the CTA group. */
  className?: string;
}

/** Routes the hash router owns. */
const ROUTES = new Set(["home", "build", "result", "blog", "generator", "editor", "form", "canvas"]);

/**
 * Lets the router own route links, and turns an in-page anchor (`#how`) into a smooth
 * scroll on the current page. The old hand-written bar did the same with listeners.
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

/**
 * Builds a menu node for the top position.
 *
 * @param links - Navigation entries, in order.
 * @param actions - CTA entries (`className: "button"`), appended after the links.
 * @returns A content node whose `builder` is `menu`.
 */
export function topMenu(links: NavLink[], actions: NavLink[] = []): iNodeContent {
  return {
    "div#top-menu": {
      builder: "menu",
      // The component owns the element: without this the built bar is appended into the
      // host instead of replacing it, and the host is what ends up in the page.
      isRoot: true,
      config: { position: "top", onNavigate },
      content: {
        brand: { label: "Rajutan", href: "#home" },
        navigations: links,
        actions,
      },
    },
  };
}
