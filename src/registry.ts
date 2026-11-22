/**
 * Registry wiring for Rajutan.
 *
 * The host owns the asset maps: `import.meta.glob` paths resolve relative to this app,
 * so a package can never declare them for us. Every entry is an explicit static
 * specifier, because Vite can only build a chunk for a literal import.
 *
 * Three builders are **app-local** (`editor`, `color-theme`, `form-editor`): they live in
 * `src/Components/` until they earn a package, and are registered exactly like a package
 * builder — path + stylesheet + named export.
 */
import type { ComponentRegistry, iComponentManifest, iComponentModuleRef } from "@aio-ui/core";
import { FORM_ADAPTER_MANIFEST } from "@aio-ui/form";

/** Component modules, keyed by the specifier a manifest names. */
export const componentAssets = {
  modules: {
    "@aio-ui/article": () => import("@aio-ui/article"),
    "@aio-ui/form": () => import("@aio-ui/form"),
    "@aio-ui/input": () => import("@aio-ui/input"),
    "@aio-ui/message": () => import("@aio-ui/message"),
    "@aio-ui/id-address": () => import("@aio-ui/id-address"),
    "@aio-ui/table": () => import("@aio-ui/table"),

    // Form sub-modules (`FORM_ADAPTER_MANIFEST`) and the input layer's adapters.
    "@aio-ui/form/validation-adapter": () => import("@aio-ui/form/validation-adapter"),
    "@aio-ui/form/cascade-adapter": () => import("@aio-ui/form/cascade-adapter"),
    "@aio-ui/form/multistep-adapter": () => import("@aio-ui/form/multistep-adapter"),
    "@aio-ui/form/calculation-adapter": () => import("@aio-ui/form/calculation-adapter"),
    "@aio-ui/input/dropdown": () => import("@aio-ui/input/dropdown"),
    "@aio-ui/input/file-uploader": () => import("@aio-ui/input/file-uploader"),
    "@aio-ui/input/controls": () => import("@aio-ui/input/controls"),
    "@aio-ui/input/picker": () => import("@aio-ui/input/picker"),

    // App-local builders.
    "src/Components/editor/Editor.ts": () => import("./Components/editor/Editor.ts"),
    "src/Components/color-theme/ColorTheme.ts": () => import("./Components/color-theme/ColorTheme.ts"),
    "src/Components/form-editor/FormEditor.ts": () => import("./Components/form-editor/FormEditor.ts"),
  } as Record<string, () => Promise<unknown>>,
  styles: {
    "@aio-ui/article/Article.css": () => import("@aio-ui/article/Article.css?inline"),
    "@aio-ui/form/Form.css": () => import("@aio-ui/form/Form.css?inline"),
    "@aio-ui/input/input.css": () => import("@aio-ui/input/input.css?inline"),
    "@aio-ui/input/dropdown.css": () => import("@aio-ui/input/dropdown.css?inline"),
    "@aio-ui/input/file-uploader.css": () => import("@aio-ui/input/file-uploader.css?inline"),
    "@aio-ui/input/controls.css": () => import("@aio-ui/input/controls.css?inline"),
    "@aio-ui/input/picker.css": () => import("@aio-ui/input/picker.css?inline"),
    "@aio-ui/message/Message.css": () => import("@aio-ui/message/Message.css?inline"),
    "@aio-ui/id-address/id-address.css": () => import("@aio-ui/id-address/id-address.css?inline"),
    "@aio-ui/table/Table.css": () => import("@aio-ui/table/Table.css?inline"),

    "src/Components/editor/Editor.css": () => import("./Components/editor/Editor.css?inline"),
    "src/Components/editor/TreeStructure/TreeStructure.css": () => import("./Components/editor/TreeStructure/TreeStructure.css?inline"),
    "src/Components/editor/ComponentComposer/ComponentComposer.css": () => import("./Components/editor/ComponentComposer/ComponentComposer.css?inline"),
    "src/Components/color-theme/ColorTheme.css": () => import("./Components/color-theme/ColorTheme.css?inline"),
    "src/Components/form-editor/FormEditor.css": () => import("./Components/form-editor/FormEditor.css?inline"),
  } as Record<string, () => Promise<unknown>>,
};

/** Manifest factory: path + sheet + named export, with optional sub-modules. */
function manifest(
  path: string,
  stylesheet: string | undefined,
  exportName: string,
  modules?: iComponentModuleRef[],
): () => iComponentManifest {
  return () => ({ path, stylesheet, export: exportName, ...(modules ? { modules } : {}) });
}

/**
 * The form's adapter stack: its own adapters plus the three owned by other packages.
 * The form never imports `table`, `message` or `id-address`; the host declares them.
 */
function formModules(): iComponentModuleRef[] {
  return [
    ...FORM_ADAPTER_MANIFEST,
    { id: "idAddress", path: "@aio-ui/id-address", export: "idAddressFormAdapter" },
    { id: "table", path: "@aio-ui/table", export: "tableFormAdapter" },
    { id: "message", path: "@aio-ui/message", export: "messageFormAdapter" },
  ];
}

/** Registers every builder this app can render. */
export function registerAll(registry: ComponentRegistry): ComponentRegistry {
  return registry
    .register("article", manifest("@aio-ui/article", "@aio-ui/article/Article.css", "ArticleBuilder"))
    .register("form", manifest("@aio-ui/form", "@aio-ui/form/Form.css", "FormBuilder", formModules()))
    .register("table", manifest("@aio-ui/table", "@aio-ui/table/Table.css", "TableBuilder"))
    .register(
      "editor",
      manifest("src/Components/editor/Editor.ts", "src/Components/editor/Editor.css", "EditorBuilder"),
    )
    .register(
      "color-theme",
      manifest(
        "src/Components/color-theme/ColorTheme.ts",
        "src/Components/color-theme/ColorTheme.css",
        "ColorThemeBuilder",
      ),
    )
    .register(
      "form-editor",
      manifest(
        "src/Components/form-editor/FormEditor.ts",
        "src/Components/form-editor/FormEditor.css",
        "FormEditorBuilder",
      ),
    );
}
