/**
 * App-local builder types.
 *
 * The editor family (`editor`, `color-theme`, `form-editor`) is not a framework package:
 * it lives in the app until it earns a package of its own. `@aio-ui/core` publishes
 * `iElementProperty` but not the action shape these builders annotate, so the app keeps it
 * here instead of vendoring the whole legacy `interface.ts`.
 */
import type { iElementProperty } from "@aio-ui/core";

/** One clickable element property (button, link, icon button). */
export interface iActionProperty extends iElementProperty {
  label?: string;
  href?: string;
  src?: string;
  isActive?: boolean;
  isRoot?: boolean;
  onClick?: (event: MouseEvent) => void;
}
