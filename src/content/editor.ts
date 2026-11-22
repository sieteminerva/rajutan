import type { iNodeContent } from "@aio-ui/core";
import { HomepageContent } from "./home";

export const EditorPageContent: iNodeContent = {
  ".page": {
    onCreated: (root: HTMLElement, _renderFn: any, builderFn: any) => {
      // 🧩 The editor instantiates its own theme builder (see Editor.prepare()),
      // so the page only ever asks for the editor — nothing to register.
      // 🌳 The tree composer edits the very same schema the preview renders, so
      // the homepage content is handed to the editor here.
      const editor = builderFn("editor", HomepageContent);
      if (editor) root.append(editor);
    },
  },
};