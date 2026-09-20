import type { iNodeContent } from "../lib/interface";

export const EditorPageContent: iNodeContent = {
  "#app": {
    attrs: { id: "app" },
    onCreated: (root: HTMLElement, _renderFn: any, builderFn: any) => {
      // 🧩 The editor instantiates its own theme builder (see Editor.prepare()),
      // so the page only ever asks for the editor — nothing to register.
      const editor = builderFn("editor");
      if (editor) root.append(editor);
    },
  },
};