import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";

export type InputType =
  | "text"
  | "textarea"
  | "number"
  | "select"
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

export interface iBasicInputConfig {
  attributes?: Array<{ name: string; value: string }>;
  style?: string;
  field?: string;
  className?: string;
  options?: Array<string | iBasicSelectOption>;
  position?: "left" | "right";
  icon?: string;
  content?: string | Record<string, unknown>;
  actions?: { mode?: string } | Array<Record<"add|remove|edit|save", iActionProperty>> | null;
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
  config?: iBasicInputConfig;
}

export class InputBuilder3 extends Builder<InputElementType> {
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
      "@field>checkbox": { tagName: "input", type: "checkbox" as InputType },
      "@field>radio": { tagName: "input", type: "radio" as InputType },
      "@field>file": { tagName: "input", type: "file" as InputType },
      "@field>info": { tagName: "small", className: "info" }
    };

    const defaultConfig: Required<iBuilderConfig<InputElementType>> = {
      themeId: "default",
      selectors: defaultSelectors,
      namespace: null,
      emit: () => { }
    };

    this.config = this.resolveConfig(defaultConfig, config);

  }


  public prepare(inputObj: Partial<iBasicInputNode>, _config?: Required<iBuilderConfig<InputElementType>> | undefined): HTMLElement | Record<string, any | HTMLElement> {
    this.#input = this.resolvePayload(inputObj);
    const elementId = this._sanitizeId(this.#input.id || this.#input.title || `input-${Math.random().toString(36).slice(2, 10)}`);
    const wrapper = this.render("@field", this.#input);

    if (this.#input.title && this.#input.config?.useLabel) {
      const label = this.render("@field>label", { id: elementId, text: this.#input.title })!;
      wrapper?.appendChild(label);
    }

    switch (this.#input.type) {
      case "textarea": {
        const textarea = this.render("@field>textarea", { id: elementId, config: this.#input });
        wrapper?.appendChild(textarea!);
        break;
      }

      case "select": {
        const select = this.render("@field>select", { id: elementId, config: this.#input });
        if (this.#input.config?.className === "loading") select?.classList.add("loading");
        // Buat Baris Placeholder awal
        const placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        placeholderOpt.textContent = this.#input.placeholder || "Pilih Opsi...";
        placeholderOpt.disabled = true;
        placeholderOpt.selected = true;
        select?.appendChild(placeholderOpt);

        // Loop cetak barisan option standard bawaan Anda
        const options = (this.#input.config?.options || []) as any[];
        options.forEach(opt => {
          const optionEl = document.createElement("option");
          optionEl.value = opt.value;
          optionEl.textContent = opt.label;
          if (this.#input.value !== undefined && String(opt.value) === String(this.#input.value)) {
            optionEl.selected = true;
            placeholderOpt.selected = false;
          }
          select?.appendChild(optionEl);
        });

        wrapper?.appendChild(select!);
        break;
      }

      case "checkbox":
      case "radio": {
        const typeKey = this.#input.type === "checkbox" ? "@field>checkbox" : "@field>radio";
        const input = this.render(typeKey as any, { id: elementId, config: this.#input });
        wrapper?.appendChild(input!);
        break;
      }

      case "file": {
        // console.log(this.#input)
        const fileInput = this.render("@field>file", { id: elementId, config: this.#input }) as HTMLInputElement;
        fileInput.type = "file";
        wrapper?.appendChild(fileInput!);
        break;
      }

      // Default klan input text, number, email standard kaku
      default: {
        const input = this.render("@field>input", { id: elementId, config: this.#input });
        wrapper?.appendChild(input!);
        break;
      }
    }

    // Suntikkan teks petunjuk info kecil di lantai terbawah boks input wrapper
    if (this.#input.info) {
      const info = this.render("@field>info", this.#input);
      wrapper?.appendChild(info!);
    }

    return this.load("@field")!;
  }

  protected template(typeKey: InputElementType, el: HTMLElement, payload?: any): void {
    if (!payload) return;

    switch (typeKey) {
      case "@field":
        if (payload.config?.className && payload.config?.className !== "loading") el.classList.add(...payload.config.className.split(" ").filter(Boolean));
        if (payload.config?.display) el.dataset.display = payload.config.display;
        break;

      case "@field>label":
        el.setAttribute("for", payload.id);
        el.textContent = payload.text;
        break;

      case "@field>input":
      case "@field>textarea":
      case "@field>select":
      case "@field>checkbox":
      case "@field>radio":
      case "@field>file": {
        const input = el as any;
        const cfg = payload.config;

        input.id = payload.id;
        input.name = cfg.name ? String(cfg.name) : payload.id;

        if (cfg.placeholder) el.setAttribute("placeholder", String(cfg.placeholder));
        if (cfg.disabled) el.setAttribute("disabled", "");
        if (cfg.readonly) el.setAttribute("readonly", "readonly");
        if (cfg.required) el.setAttribute("required", "");
        // Tancapkan custom inline attributes kamus array sheets bawaan Anda
        if (cfg.config?.attributes && Array.isArray(cfg.config?.attributes)) {
          cfg.config.attributes.forEach((attr: any) => {
            if (attr?.name) {
              if (typeof attr.value === "function" && (attr.name as string).startsWith("on")) {
                (el as any)[attr.name as string] = attr.value;
              } else {
                el.setAttribute(attr.name, attr.value);
              }
            }

          });
        }

        if (typeKey === "@field>input") {
          input.type = cfg.type || "text";
        }

        if (typeKey === "@field>select") {
          if (cfg.className === "loading") input.classList.add("loading");
        }

        if (typeKey === "@field>textarea" && cfg.rows) (el as HTMLTextAreaElement).rows = cfg.rows;

        if ((typeKey === "@field>checkbox" || typeKey === "@field>radio") && cfg.checked) {
          (el as HTMLInputElement).checked = true;
        }

        if (typeKey === "@field>file") {
          el.setAttribute("data-uploader", "");
          el.setAttribute("data-view", `${cfg.config?.view || "list"}`);
          el.setAttribute("data-render-thumbnail", `${cfg.config?.thumbnail ?? "true"}`);
        }

        if (cfg.value !== undefined && typeKey !== "@field>select") {
          input.value = String(cfg.value);

        }

        break;
      }

      case "@field>info":
        el.textContent = payload.info || "";
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

  private resolvePayload(inputObj: Partial<iBasicInputNode>) {
    const defaultPayload: iBasicInputNode = {
      type: "text", id: "", title: "", placeholder: "", rows: 3,
      multiple: false, disabled: false, readonly: false, required: false, checked: false,
      config: { attributes: [], style: "", className: "", options: [], useLabel: true, display: "block", createEventListener: false, popover: undefined }
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

  private _sanitizeId(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

}
