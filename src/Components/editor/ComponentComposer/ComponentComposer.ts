import type { iBuilderConfig, iBuilderRegistry, iElementProperty } from "@aio-ui/core";
import { Builder } from "@aio-ui/base";
import type { iActionProperty } from "../../types";

export type ComponentComposerElementType =
  | "@composer"
  ;

export interface iComponentComposerConfig extends iBuilderConfig<ComponentComposerElementType> {

}

export class ComponentComposerBuilder extends Builder<ComponentComposerElementType, iComponentComposerConfig> {
  builderId = "component-composer" as keyof iBuilderRegistry;
  name = "component-composer" as keyof iBuilderRegistry;
  stylesheet: string = "./ComponentComposer.css";

  constructor(config: Partial<iComponentComposerConfig>) {
    super();

    const defaultSelectors: Record<ComponentComposerElementType, iElementProperty> = {
      "@composer": { className: "composer" }
    }

    const defaultConfig: Required<iComponentComposerConfig> = {
      themeId: "default",
      namespace: "",
      emit: null,
      selectors: defaultSelectors,
    };

    this.config = this.resolveConfig(defaultConfig, config)
  }


  public prepare(_content: any, _config?: Required<iComponentComposerConfig> | undefined): HTMLElement | Record<string, any | HTMLElement> {
    return this.render("@composer")!;
  }


  protected template(typeKey: ComponentComposerElementType, _el: HTMLElement, _payload?: any, _props?: iActionProperty): void {
    switch (typeKey) {
      case "@composer":

        break;

      default:
        break;
    }
  }


  public initialize(_el?: HTMLElement, _payload?: any, _context?: any): void {

  }
}