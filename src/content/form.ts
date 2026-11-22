import type { iNodeContent } from "@aio-ui/core";

export const FormPageContent: iNodeContent = {
  ".page": {
    onCreated: (root: HTMLElement, _renderFn: any, builderFn: any) => {
      const formEditor = builderFn("form-editor");

      root.append(formEditor)
    },
  },
};