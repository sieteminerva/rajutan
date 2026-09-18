import type { iNodeContent } from "../lib/interface";

export const GeneratorPageContent: iNodeContent = {
  "#app": {
    attrs: { id: "app" },
    onCreated: (root: HTMLElement, _renderFn: any, builderFn: any) => {
      const colorTheme = builderFn("color-theme");
      root.append(colorTheme)
    },
  },
};