import type { iNodeContent } from "@aio-ui/core";

export const GeneratorPageContent: iNodeContent = {
  "#app": {
    attrs: { id: "app" },
    onCreated: (root: HTMLElement, _renderFn: any, builderFn: any) => {
      const colorTheme = builderFn("color-theme");
      root.append(colorTheme)
    },
  },
};