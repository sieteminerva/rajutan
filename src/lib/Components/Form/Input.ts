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
    const wrapper = this.render("@field", this.#input);

    return wrapper!;
  }

  protected template(typeKey: InputElementType, el: HTMLElement, payload?: any): void {
    if (!payload) return;

    // Generate ID unik generik untuk keperluan atribut 'id' dan 'for' pada label
    const elementId = this._sanitizeId(payload.id || payload.title || `input-${Math.random().toString(36).slice(2, 10)}`);

    switch (typeKey) {
      case "@field": {
        // Gaya kelas & atribut kosmetik wrapper utama
        if (payload.config?.className && payload.config?.className !== "loading") {
          el.classList.add(...payload.config.className.split(" ").filter(Boolean));
        }

        if (payload.config?.display) el.dataset.display = payload.config.display;

        // A. Render Label jika dikonfigurasi
        if (payload.title && payload.config?.useLabel) {
          const label = this.render("@field>label", { id: elementId, text: payload.title })!;
          el.appendChild(label);
        }

        // B. Render Elemen Input Inti berdasarkan tipe datanya
        let mainInputNode: HTMLElement | null = null;
        const targetType = payload.type || "text";

        if (targetType === "textarea") {
          mainInputNode = this.render("@field>textarea", { id: elementId, config: payload })!;
        } else if (targetType === "select") {
          mainInputNode = this.render("@field>select", { id: elementId, config: payload })!;
        } else if (targetType === "checkbox") {
          mainInputNode = this.render("@field>checkbox", { id: elementId, config: payload })!;
        } else if (targetType === "radio") {
          mainInputNode = this.render("@field>radio", { id: elementId, config: payload })!;
        } else if (targetType === "file") {
          mainInputNode = this.render("@field>file", { id: elementId, config: payload })!;
        } else {
          // Default untuk jenis text, number, email, password, dll.
          mainInputNode = this.render("@field>input", { id: elementId, config: payload })!;
        }

        if (mainInputNode) el.appendChild(mainInputNode);

        // C. Render Info Tambahan di bagian bawah jika ada
        if (payload.info) {
          const info = this.render("@field>info", payload)!;
          el.appendChild(info);
        }

        if ((targetType === "text" || targetType === "number") && (payload.config?.className === "loading")) {
          el.classList.add("loading");
        }

        // D. OTOMATIS PASANG POPOVER GENERIK JIKA TERSEDIA DI CONFIG
        if (payload.config?.popover && mainInputNode) {
          this._attachGenericPopover(mainInputNode, payload.config.popover);
        }
        break;
      }

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
        const cfg = payload.config; // ini merujuk ke 'payload' utuh yang dioper dari case @field

        input.id = payload.id;
        input.name = cfg.name ? String(cfg.name) : payload.id;

        // Injeksi spesifikasi atribut HTML standar
        if (cfg.placeholder) el.setAttribute("placeholder", String(cfg.placeholder));
        if (cfg.disabled) el.setAttribute("disabled", "");
        if (cfg.readonly) el.setAttribute("readonly", "readonly");
        if (cfg.required) el.setAttribute("required", "");

        // Aturan khusus per tipe elemen
        if (typeKey === "@field>input") {
          input.type = cfg.type || "text";

        }
        if (typeKey === "@field>textarea" && cfg.rows) {
          (el as HTMLTextAreaElement).rows = cfg.rows;
        }
        if (typeKey === "@field>file") {
          (el as HTMLInputElement).type = "file";
          el.setAttribute("data-uploader", "");
          el.setAttribute("data-view", `${cfg.config?.view || "list"}`);
          el.setAttribute("data-render-thumbnail", `${cfg.config?.thumbnail ?? "true"}`);
        }
        if ((typeKey === "@field>checkbox" || typeKey === "@field>radio") && cfg.checked) {
          (el as HTMLInputElement).checked = true;
        }

        if (typeKey === "@field>select") {
          if (cfg.config?.className === "loading") input.classList.add("loading");

          // Buat baris placeholder awal untuk select
          const placeholderOpt = document.createElement("option");
          placeholderOpt.value = "";
          placeholderOpt.textContent = cfg.placeholder || "Pilih Opsi...";
          placeholderOpt.disabled = true;
          placeholderOpt.selected = true;
          el.appendChild(placeholderOpt);

          // Render barisan opsi anak secara rekursif/looping
          const options = (cfg.config?.options || []) as any[];
          for (const opt of options) {
            const optionEl = this.render("@field>select>option", { opt, parentValue: cfg.value })!;
            el.appendChild(optionEl);
            if (placeholderOpt.selected && optionEl.hasAttribute("selected")) {
              placeholderOpt.selected = false;
            }
          }

        }

        // Tancapkan custom inline attributes bawaan array schema Anda (jika ada)
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
        break;
      }

      case "@field>select>option": {
        const option = el as HTMLOptionElement;
        option.value = payload.opt.value;
        option.textContent = payload.opt.label;
        if (payload.parentValue !== undefined && String(payload.opt.value) === String(payload.parentValue)) {
          option.setAttribute("selected", "selected");
        }
        break;
      }

      case "@field>info":
        el.textContent = payload.info;
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
      config: { attributes: [], style: "", className: "", options: [], useLabel: true, display: undefined, createEventListener: false, popover: undefined }
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
