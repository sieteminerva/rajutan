import type { iActionType, iBasicInputNode, iInputActionContext, iInputActionDefinition } from "./Input";
import type { iBuilderConfig, iElementProperty } from "../../interface";
import { Builder } from "../Base";

export type InputControlsElementType =
  | "@controls"       // Kontainer pembungkus input + tombol aksi (.ui.action.input)
  | "@controls>add"
  | "@controls>delete"
  | "@controls>save"
  | "@controls>edit"
  | "@controls>copy"
  | "@controls>custom" // Tombol aksi kustom sesuai kebutuhan bisnis

export interface iInputControlsConfig {

  // Posisi tombol aksi menempel di sisi mana
  position?: "left" | "right";
  // Daftar aksi tombol yang ingin dimunculkan disamping input
  actions: iInputActionDefinition[];
  input: iBasicInputNode;
}


export class InputControlsBuilder extends Builder<InputControlsElementType> {
  readonly builderId = "input-controls";
  readonly name = "input-controls";
  readonly stylesheet: string = "./inputControls.css";
  #editableState = new WeakMap<HTMLElement, { readonly: boolean; disabled: boolean }>();
  #duplicateIndices = new WeakMap<HTMLElement, Set<number>>();
  #duplicateRecords = new WeakMap<HTMLElement, { owner: HTMLElement; index: number }>();

  constructor(config: iBuilderConfig<InputControlsElementType>) { // Ubah jadi wajib memasukkan konfigurasi target targetFieldBuilder
    super();
    const defaultSelectors: Required<Record<InputControlsElementType, iElementProperty>> = {
      "@controls": { tagName: "div", className: "controls" },
      "@controls>add": { tagName: "button", className: "add", icon: "icon plus" },
      "@controls>delete": { tagName: "button", className: "delete", icon: "icon trash" },
      "@controls>save": { tagName: "button", className: "save", icon: "icon checkmark" },
      "@controls>edit": { tagName: "button", className: "edit", icon: "icon edit" },
      "@controls>copy": { tagName: "button", className: "copy", icon: "icon copy file" },
      "@controls>custom": { tagName: "button", className: "custom" },
    };

    const defaultConfig: Partial<iBuilderConfig<InputControlsElementType>> = {
      themeId: "default",
      namespace: null,
      selectors: defaultSelectors,
      emit: null,
    };

    this.config = this.resolveConfig(defaultConfig as any, config);
  }



  /**
   * 🧱 METODE PREPARE
   */
  public prepare(payload: any): HTMLElement {
    // console.log({ payload })
    const content = payload.content;

    const actions = content.actions;
    const position = content.position;
    const parentElement = content.parentElement;
    const input = content.input;
    // 1. Buat kontainer utama pembungkus .ui-action-field
    const container = this.render("@controls", position) as HTMLElement;
    container.__payload = { actions, parentElement, input };
    // console.log({ container })

    for (const action of actions) {
      const Templatekey = `@controls>${action.type}` as InputControlsElementType;
      const button = this.render(Templatekey, { parentElement, input, action })!;
      container.appendChild(button);
    }
    return container;
  }


  protected template(typeKey: InputControlsElementType, el: HTMLElement, payload?: any, props?: iElementProperty): void {
    switch (typeKey) {
      case "@controls":
        el.setAttribute("position", payload)
        break;

      default:
        const button = el as HTMLButtonElement;
        const { action } = payload;
        button.title = "Click to " + action.label
        if (action?.label) {
          button.textContent = action.label
        }

        if (props?.icon) {
          const icon = document.createElement("i");
          icon.className = props.icon;
          button.appendChild(icon);
        }
        button.__payload = payload;
        break;
    }

  }

  /**
   * 🧱 METODE INITIALIZE
   */
  public initialize(controls: HTMLElement, _payload?: any): void {
    if (!controls) return;

    const actions = (_payload?.content?.actions ?? controls.__payload?.actions ?? []) as iInputActionDefinition[];
    const parentElement = controls.__payload?.parentElement as HTMLElement | undefined;
    if (parentElement && actions.some((action) => action.type === "edit")) {
      this._setLocked(this._getControl(parentElement));
    }

    controls.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      this.bindButton(button, controls, actions);
    });
  }

  private bindButton(button: HTMLButtonElement, controls: HTMLElement, actions: iInputActionDefinition[]): void {
    button.onclick = async (event) => {
      event.preventDefault();

      const payload = button.__payload;
      const parentElement = payload?.parentElement as HTMLElement | undefined;
      const input = payload?.input as iBasicInputNode | undefined;
      const action = payload?.action as iInputActionDefinition | undefined;
      const element = parentElement?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input:not([type='button']):not([type='submit']):not([type='hidden']), select, textarea"
      ) ?? null;

      if (!parentElement || !input || !action) return;

      const context: iInputActionContext = {
        parentElement,
        input,
        action: action.type as iActionType,
        button,
        element,
        value: this._getValue(element),
        event,
      };

      switch (action.type) {
        case "copy":
          await this.copy(context.value);
          context.result = context.value;
          break;
        case "edit":
          context.result = this.edit(element);
          this.toggleEdit(button, controls, "save", actions);
          break;
        case "save":
          context.result = this.update(element);
          this.toggleEdit(button, controls, "edit", actions);
          break;
        case "add":
          context.result = this.duplicate(parentElement, actions);
          break;
        case "delete":
        case "remove":
          context.result = this.delete(parentElement);
          break;
      }

      this.emit(action.type as iActionType, context);
      action.onClick(parentElement, context);
    };
  }

  protected toggleEdit(
    currentButton: HTMLButtonElement,
    controls: HTMLElement,
    actionType: iActionType,
    actions: iInputActionDefinition[]
  ): void {
    const payload = currentButton.__payload;
    const nextAction = actions.find((action) => action.type === actionType) ?? {
      type: actionType,
      label: actionType,
      onClick: () => { },
    } satisfies iInputActionDefinition;
    const nextButton = this.render(`@controls>${actionType}` as InputControlsElementType, {
      parentElement: payload.parentElement,
      input: payload.input,
      action: nextAction,
    }) as HTMLButtonElement | undefined;
    if (!nextButton) return;

    currentButton.replaceWith(nextButton);
    this.bindButton(nextButton, controls, actions);
  }



  protected emit(action: iActionType, context: iInputActionContext): void {
    this.config.emit?.("elementChanged", {
      builder: this.builderId,
      type: "@controls",
      element: context.parentElement,
      data: { action, value: context.value, input: context.input, result: context.result },
    });
  }


  protected async copy(payload: string | HTMLElement | Object) {
    try {
      if (typeof payload === "string") {
        await navigator.clipboard.writeText(payload);
      }
      console.log("Teks berhasil disalin!");
    } catch (err) {
      console.error("Gagal menyalin teks: ", err);
    }
  }

  protected duplicate(parentElement: HTMLElement, actions: iInputActionDefinition[]): HTMLElement {
    const clone = parentElement.cloneNode(true) as HTMLElement;
    const owner = parentElement.parentElement ?? parentElement;
    const usedIndices = this._getDuplicateIndices(owner);
    const index = this._nextDuplicateIndex(parentElement, usedIndices);
    const suffix = `-${index}`;
    const labelSuffix = ` ${index}`;

    if (clone.id) clone.id += suffix;
    clone.querySelectorAll<HTMLElement>("[id]").forEach((element) => { element.id += suffix; });
    clone.querySelectorAll<HTMLLabelElement>("label").forEach((label) => {
      if (label.textContent?.trim()) label.textContent += labelSuffix;
    });
    clone.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea").forEach((element) => {
      if (element.name) element.name += suffix;
    });
    clone.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea").forEach((element) => {
      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) element.checked = false;
      else element.value = "";
    });
    parentElement.after(clone);
    usedIndices.add(index);
    this.#duplicateRecords.set(clone, { owner, index });

    const clonedControls = clone.querySelector<HTMLElement>(".controls");
    const sourceButtons = parentElement.querySelectorAll<HTMLButtonElement>(".controls button");
    clonedControls?.querySelectorAll<HTMLButtonElement>("button").forEach((button, index) => {
      const sourcePayload = sourceButtons[index]?.__payload;
      if (sourcePayload) {
        button.__payload = {
          ...sourcePayload,
          parentElement: clone,
        };
      }
    });
    if (clonedControls) {
      clonedControls.__payload = {
        actions,
        parentElement: clone,
        input: sourceButtons[0]?.__payload?.input,
      };
      this.initialize(clonedControls, { content: { actions } });
    }

    return clone;
  }

  protected delete(parentElement: HTMLElement): boolean {
    const duplicateRecord = this.#duplicateRecords.get(parentElement);
    if (duplicateRecord) {
      duplicateRecord.owner && this.#duplicateIndices.get(duplicateRecord.owner)?.delete(duplicateRecord.index);
      this.#duplicateRecords.delete(parentElement);
    }
    parentElement.remove();
    return true;
  }

  private _getDuplicateIndices(owner: HTMLElement): Set<number> {
    const existing = this.#duplicateIndices.get(owner);
    if (existing) return existing;

    const indices = new Set<number>();
    Array.from(owner.children).forEach((child) => {
      const id = (child as HTMLElement).id;
      if (!id) return;
      const parts = id.split("-");
      const lastPart = Number(parts[parts.length - 1]);
      if (Number.isInteger(lastPart) && lastPart >= 0) indices.add(lastPart);
    });
    this.#duplicateIndices.set(owner, indices);
    return indices;
  }

  private _nextDuplicateIndex(parentElement: HTMLElement, usedIndices: Set<number>): number {
    const parts = parentElement.id.split("-");
    const lastPart = Number(parts[parts.length - 1]);
    let index = Number.isInteger(lastPart) && lastPart >= 0 ? lastPart + 1 : 1;
    while (usedIndices.has(index)) index += 1;
    return index;
  }

  protected edit(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null): boolean {
    if (!element) return false;
    this.#editableState.set(element, { readonly: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.readOnly : false, disabled: element.disabled });
    element.disabled = false;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.readOnly = false;
    return true;
  }

  protected update(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null): boolean {
    if (!element) return false;
    const state = this.#editableState.get(element);
    if (state) {
      element.disabled = state.disabled;
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.readOnly = state.readonly;
      this.#editableState.delete(element);
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }


  private _getControl(parentElement: HTMLElement): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
    return parentElement.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input:not([type='button']):not([type='submit']):not([type='hidden']), select, textarea"
    );
  }

  private _setLocked(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null): void {
    if (!element) return;
    if (element instanceof HTMLSelectElement) {
      element.disabled = true;
    } else {
      element.readOnly = true;
    }
  }

  private _getValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null): string {
    return element?.value ?? "";
  }

}
