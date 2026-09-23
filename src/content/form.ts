import type { iNodeContent } from "../lib/interface";

export const FormPageContent: iNodeContent = {
  "#app": {
    attrs: { id: "app" },
    onCreated: (root: HTMLElement, _renderFn: any, builderFn: any) => {
      const formEditor = builderFn("form-editor");

      root.append(formEditor)
    },
  },
};