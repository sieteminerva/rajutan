import type { iNodeContent } from "@aio-ui/core";

export const FormPageContent: iNodeContent = {
  "#app": {
    attrs: { id: "app" },
    onCreated: (root: HTMLElement, _renderFn: any, builderFn: any) => {
      const formEditor = builderFn("form-editor");

      root.append(formEditor)
    },
  },
};