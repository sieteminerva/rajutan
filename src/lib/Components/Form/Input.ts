import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";
import { DropdownBuilder, type iDropdownConfig, type iDropdownContent } from "./Dropdown";
import { InputControlsBuilder, type InputControlsElementType } from "./InputControls";

export type InputType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "dropdown"
  | "actions"
  | "checkbox"
  | "radio"
  | "range"
  | "date"
  | "time"
  | "datetime-local"
  | "file"
  | "color"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "hidden";

export interface iBasicSelectOption {
  value?: string;
  label?: string;
  icon?: string;
}

export type InputElementType =
  | "@field"
  | "@field>label"
  | "@field>input"
  | "@field>textarea"
  | "@field>select"
  | "@field>select>option"
  | "@field>checkbox"
  | "@field>radio"
  | "@field>file"
  | "@field>info";

export type iActionType = "add" | "remove" | "delete" | "save" | "edit" | "copy" | "search" | "custom";

export interface iInputActionDefinition {
  type: iActionType;
  selector?: Record<InputControlsElementType, iActionProperty>;
  label?: string;
  icon?: string;
  onClick: iInputActionHandler;
}

export interface iInputActionContext {
  parentElement: HTMLElement;
  input: iBasicInputNode;
  action: iActionType;
  button: HTMLButtonElement;
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  value: string;
  event: MouseEvent;
  result?: unknown;
}

export type iInputActionHandler = (parentElement: HTMLElement, context: iInputActionContext) => void;

export interface iBasicInputConfig {
  attributes?: Array<{ name: string; value: string }>;
  style?: string;
  field?: string;
  className?: string;
  options?: Array<string | iBasicSelectOption>;
  position?: "left" | "right";
  icon?: string;
  content?: string | Record<string, unknown>;
  actions?: iInputActionDefinition[] | Partial<Record<iActionType, Omit<iInputActionDefinition, "type">>> | null;
  actionMode?: string;
  wide?: number | null;
  useLabel?: boolean;
  view?: string;
  thumbnail?: boolean;
  maxUpload?: number;
  maxFileSize?: number;
  groupUnallowed?: boolean;
  createEventListener?: boolean;
  popover?: string | HTMLElement | undefined;
  display?: "block" | "inline";
  dropdown?: Partial<iDropdownConfig>;
}

export interface iBasicInputNode extends iBuilderConfig<InputElementType> {
  type?: InputType;
  id?: string;
  formId?: string | null;
  name?: string;
  title?: string;
  placeholder?: string;
  value?: any;
  rows?: number;
  cols?: number;
  multiple?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  checked?: boolean;
  range?: string;
  info?: string;
  position?: "top" | "left" | "right" | "bottom";
  config?: iBasicInputConfig;
  onValueChange?: (form: any, e: Event) => {}
}

export class InputBuilder extends Builder<InputElementType> {
  readonly builderId: keyof iBuilderRegistry = "input";
  readonly name: keyof iBuilderRegistry = "input";
  readonly stylesheet: string = "";

  #input: iBasicInputNode = {};

  constructor(config: Partial<iBuilderConfig<InputElementType>> = {}) {
    super();

    const defaultSelectors = {
      "@field": { tagName: "div", className: "field" },
      "@field>label": { tagName: "label" },
      "@field>input": { tagName: "input" },
      "@field>textarea": { tagName: "textarea" },
      "@field>select": { tagName: "select" },
      "@field>select>option": { tagName: "option" },
      "@field>checkbox": { tagName: "input", type: "checkbox" as InputType, wrapper: ".control" },
      "@field>radio": { tagName: "input", type: "radio" as InputType },
      "@field>file": { tagName: "input", type: "file" as InputType },
      "@field>info": { tagName: "small", className: "info" }
    };

    const defaultConfig: Required<iBuilderConfig<InputElementType>> = {
      themeId: "default",
      selectors: defaultSelectors as any,
      namespace: null,
      emit: () => { },
    };

    this.config = this.resolveConfig(defaultConfig, config);

  }

  private resolvePayload(inputObj: iBasicInputNode) {
    // Generate ID unik generik untuk keperluan atribut 'id' dan 'for' pada label
    const elementId = this._sanitizeId(inputObj.id || inputObj.title || `input-${Math.random().toString(36).slice(2, 10)}`);

    const defaultPayload: iBasicInputNode = {
      type: "text",
      id: elementId,
      title: "",
      placeholder: "",
      rows: 3,
      multiple: false,
      disabled: false,
      readonly: false,
      required: false,
      checked: false,
      config: {
        attributes: [],
        style: "",
        className: "",
        options: [],
        useLabel: true,
        display: undefined,
        createEventListener: false,
        popover: undefined,
        actions: undefined
      }
    };

    const inputPayload = { ...defaultPayload, ...inputObj, config: { ...defaultPayload.config, ...inputObj.config } };

    if (!inputPayload.placeholder && inputPayload.title) {
      inputPayload.placeholder = (inputPayload.type === "select" || inputPayload.type === "textarea") ? `Pilih ${inputPayload.title}` : `Isi ${inputPayload.title}`;
    }
    if (Array.isArray(inputObj.config?.options)) {
      inputPayload.config.options = inputObj.config.options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
    }
    return inputPayload;
  }



  public prepare(inputObj: Partial<iBasicInputNode>, _config?: Required<iBuilderConfig<InputElementType>> | undefined): HTMLElement | Record<string, any | HTMLElement> {

    this.#input = this.resolvePayload(inputObj);

    const cfg = this.#input.config;

    const wrapper = this.render("@field", this.#input)!;

    if (this.#input.title && this.#input.config?.useLabel && this.#input.type !== "dropdown") {
      const label = this.render("@field>label", { text: this.#input.title, position: this.#input.position, id: this.#input.id })!
      wrapper?.appendChild(label);
    }

    let inputEl: HTMLInputElement | HTMLSelectElement | HTMLElement;

    switch (this.#input.type) {
      case "textarea":
        inputEl = this.render("@field>textarea", this.#input)!;
        break;

      case "select":
        inputEl = this.render("@field>select", this.#input)!;
        break;

      case "dropdown":
        inputEl = this._renderDropdown(this.#input);
        break;

      case "checkbox":
        wrapper.classList.add("toggle-switch");
        inputEl = this.render("@field>checkbox", this.#input)!;
        break;

      case "radio":
        inputEl = this.render("@field>radio", this.#input)!;
        break;

      case "file":
        inputEl = this.render("@field>file", this.#input)!;
        break;

      default:
        // Default untuk jenis text, number, email, password, dll.
        inputEl = this.render("@field>input", this.#input)!;
        if ((this.#input.type === "text" || this.#input.type === "number") && (this.#input.config?.className === "loading")) {
          inputEl.classList.add("loading");
        }
        break;
    }

    if (inputEl) {
      this.applyAttributes(inputEl, this.#input);

      if (this.#input.type === "dropdown" && inputEl.classList.contains("field")) {
        inputEl.classList.forEach((className) => {
          if (className !== "field") wrapper.classList.add(className);
        });
        Object.entries(inputEl.dataset).forEach(([key, value]) => {
          wrapper.dataset[key] = value;
        });
        wrapper.append(...Array.from(inputEl.childNodes));
      }
    }

    // C. Render Info Tambahan di bagian bawah jika ada
    if (this.#input.info) {
      const info = this.render("@field>info", this.#input.info)!;
      wrapper.appendChild(info);
    }


    inputEl.__outer ? wrapper.appendChild(inputEl.__outer) : wrapper.appendChild(inputEl);

    if (cfg?.actions && inputEl) {
      const actions = this._renderActions(wrapper, this.#input);
      wrapper.classList.add("actions");
      wrapper.appendChild(actions)
    }

    // D. OTOMATIS PASANG POPOVER GENERIK JIKA TERSEDIA DI CONFIG
    if (cfg?.popover && inputEl) {
      this._attachGenericPopover(inputEl, cfg.popover);
    }


    return wrapper!;
  }


  protected template(typeKey: InputElementType, el: HTMLElement, payload?: any): void {
    if (!payload) return;

    const cfg = payload.config; // ini merujuk ke 'payload' utuh yang dioper dari case @field

    switch (typeKey) {
      case "@field":
        // console.log(el)
        // Gaya kelas & atribut kosmetik wrapper utama
        if (payload?.className && payload?.className !== "loading") {
          el.classList.add(...payload.className.split(" ").filter(Boolean));
        }

        if (payload?.display) el.dataset.display = cfg.display;
        break;

      case "@field>label":
        el.setAttribute("for", payload.id);
        el.textContent = payload.text;
        if (payload.position) el.setAttribute("data-position", payload.position)
        break;

      case "@field>checkbox":
        (el as HTMLInputElement).type = "checkbox";
        const slider = document.createElement("div");
        slider.className = "slider";
        slider.setAttribute("data-shape", "round")
        el.__outer.appendChild(slider);
        break;

      case "@field>input":
        (el as HTMLInputElement).type = payload.type || "text";
        (el as HTMLInputElement).autocomplete = "off";
        break;

      case "@field>textarea":
        (el as HTMLTextAreaElement).rows = payload.rows;
        break;

      case "@field>select":
        if (cfg?.className === "loading") el.classList.add("loading");
        // Buat baris placeholder awal untuk select
        const placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        placeholderOpt.textContent = payload.placeholder || "Pilih Opsi...";
        placeholderOpt.disabled = true;
        placeholderOpt.selected = true;
        el.appendChild(placeholderOpt);

        // Render barisan opsi anak secara rekursif/looping
        const options = (cfg?.options || []) as any[];
        for (const option of options) {
          const optionEl = this.render("@field>select>option", { option, parentValue: payload.value })!;
          el.appendChild(optionEl);
          if (placeholderOpt.selected && optionEl.hasAttribute("selected")) {
            placeholderOpt.selected = false;
          }
        }
        break;

      case "@field>radio":
        (el as HTMLInputElement).type = payload.type;
        (el as HTMLInputElement).checked = true;
        break;

      case "@field>file":
        (el as HTMLInputElement).type = "file";
        el.setAttribute("data-uploader", "");
        el.setAttribute("data-view", `${cfg?.view || "list"}`);
        el.setAttribute("data-render-thumbnail", `${cfg?.thumbnail ?? "true"}`);
        break;

      case "@field>select>option":
        const option = el as HTMLOptionElement;
        option.value = payload.option.value;
        option.textContent = payload.option.label;
        if (payload.parentValue !== undefined && String(payload.option.value) === String(payload.parentValue)) {
          option.setAttribute("selected", "selected");
        }
        break;

      case "@field>info":
        el.textContent = payload;
        break;
    }
  }

  public initialize(_el?: HTMLElement, _payload?: any, _context?: any): void {
    if (this.#input.config?.popover) {
      if (this.#input.config?.popover instanceof HTMLElement) {
        _el?.appendChild(this.#input.config?.popover);
      }
      else if (typeof this.#input.config?.popover === "string") {
        _el?.insertAdjacentHTML("beforeend", this.#input.config?.popover);
      }
    }
  }

  private applyAttributes(el: HTMLInputElement | HTMLSelectElement | HTMLElement, payload: any) {
    const cfg = payload.config;

    el.id = payload.id;
    (el as HTMLInputElement).name = payload.name ? String(payload.name) : payload.id;

    // Injeksi spesifikasi atribut HTML standar
    if (payload.placeholder) el.setAttribute("placeholder", String(payload.placeholder));
    if (payload.disabled) el.setAttribute("disabled", "");
    if (payload.readonly) el.setAttribute("readonly", "readonly");
    if (payload.required) el.setAttribute("required", "");
    // Tancapkan custom inline attributes bawaan array schema Anda (jika ada)
    if (cfg?.attributes && Array.isArray(cfg.attributes)) {
      cfg.attributes.forEach((attr: any) => {
        if (attr?.name) {
          if (typeof attr.value === "function" && (attr.name as string).startsWith("on")) {
            (el as any)[attr.name as string] = attr.value;
          } else {
            el.setAttribute(attr.name, attr.value);
          }
        }
      });
    }

  }


  private _renderDropdown(payload: any): HTMLElement {
    const cfg = payload.config;

    const options = (cfg?.options || []).map((option: any) => {
      if (typeof option === "string") {
        return { id: option, label: option };
      }
      return { id: option.value, label: option.label };
    });

    const dropdownPayload: iDropdownContent = {
      id: payload.id,
      title: payload.title,
      placeholder: payload.placeholder,
      value: payload.value,
      options,
      name: payload.name || payload.id,
      attributes: cfg?.attributes || [],
    };

    const dropdownBuilder = new DropdownBuilder({
      ...cfg?.dropdown,
      themeId: this.config.themeId || "default",
      namespace: this.config.namespace,
      emit: this.config.emit,
    });

    const dropdownElement = dropdownBuilder.create(dropdownPayload, {
      apiUrl: cfg?.apiUrl || null,
      debounceDelay: cfg?.debounceDelay,
      style: cfg?.style || "select",
      min: cfg?.min,
      max: cfg?.max,
      isMultiple: cfg?.isMultiple,
      onSelect: cfg?.onSelect,
      onMultiChange: cfg?.onMultiChange,
    });

    // Fix the wrapper class to avoid nested .field inside InputBuilder's .field
    // Set the name on hidden input for form submission
    const hidden = dropdownElement.querySelector("input[type='hidden']") as HTMLInputElement;
    if (hidden) {
      if (payload.id) {
        hidden.setAttribute("name", payload.name || payload.id);
      }
    }

    return dropdownElement;
  }

  private _renderActions(parentElement: HTMLElement, payload: any): HTMLElement {
    const cfg = payload.config;
    const configuredActions = cfg.actions || [];
    const actions = Array.isArray(configuredActions)
      ? configuredActions
      : Object.entries(configuredActions).map(([type, action]) => ({
        ...(action as object),
        type,
      }));

    const controlsBuilder = new InputControlsBuilder(this.config as any).create({
      content: {
        parentElement,
        position: cfg.position || "right",
        actions,
        input: payload,
      }
    });

    return controlsBuilder;
  }

  private _attachGenericPopover(inputEl: HTMLElement, popoverTarget: string | HTMLElement): void {
    let popoverEl: HTMLElement;

    if (typeof popoverTarget === "string") {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = popoverTarget.trim();
      popoverEl = tempDiv.firstElementChild as HTMLElement;
    } else {
      popoverEl = popoverTarget;
    }

    if (!popoverEl) return;

    if (!popoverEl.hasAttribute("popover")) {
      popoverEl.setAttribute("popover", "manual");
    }

    const inputId = inputEl.id;
    if (inputId) {
      // Pasang atribut anchor="ID_INPUT" secara langsung pada popover
      const uniqueAnchorName = `--anchor-${inputId}`;
      inputEl.style.setProperty("anchor-name", uniqueAnchorName);
      popoverEl.style.setProperty("position-anchor", uniqueAnchorName);
      // popoverEl.setAttribute("anchor", inputId);
    }

    // Selipkan popover tepat setelah input utama di dalam struktur DOM wrapper
    inputEl.insertAdjacentElement("afterend", popoverEl);

    // Event buka saat fokus masuk ke input utama
    inputEl.addEventListener("focus", () => {
      if (typeof HTMLElement.prototype.showPopover === "function") {
        popoverEl.showPopover();
      }
    });

    // Event tutup pintar saat keluar fokus
    inputEl.addEventListener("blur", (e: FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;

      if (popoverEl.contains(relatedTarget)) {
        const handleInnerBlur = (innerEvent: FocusEvent) => {
          const nextFocus = innerEvent.relatedTarget as HTMLElement;

          if (!popoverEl.contains(nextFocus) && nextFocus !== inputEl) {
            // Auto sinkronisasi nilai komponen dalam popover ke input utama
            const innerField = popoverEl.querySelector("textarea, input, select") as HTMLInputElement | HTMLTextAreaElement;
            if (innerField && "value" in inputEl) {
              (inputEl as any).value = innerField.value;
              inputEl.dispatchEvent(new Event("input", { bubbles: true }));
              inputEl.dispatchEvent(new Event("change", { bubbles: true }));
            }

            if (typeof HTMLElement.prototype.hidePopover === "function") {
              popoverEl.hidePopover();
            }
            popoverEl.removeEventListener("blur", handleInnerBlur, true);
          }
        };

        popoverEl.addEventListener("blur", handleInnerBlur, true);
        return;
      }

      if (typeof HTMLElement.prototype.hidePopover === "function") {
        popoverEl.hidePopover();
      }
    });
  }

  private _sanitizeId(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

}
