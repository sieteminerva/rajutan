import type { iBuilderConfig, iBuilderRegistry, iElementProperty } from "@aio-ui/core";
import { Builder } from "@aio-ui/base";
import { InputAttributeBuilder, InputBuilder, INPUT_MODULE_DEFINITIONS, type iBasicInputNode, type InputType } from "@aio-ui/input";
import { DragNDropService } from "./FormEditor.dragNdrop";
import type { iActionProperty } from "../types";

/** 🎛️ The control shapes the property editors render (`@field>input|select|textarea`). */
type iFieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** 🧾 Property attrs that are real `iBasicInputNode` fields (the rest become DOM attributes). */
const INPUT_NODE_KEYS = new Set([
  "placeholder", "value", "rows", "cols", "range", "info", "position", "label", "name", "title",
]);

/** 🔘 …and the ones that node carries as booleans. */
const BOOLEAN_INPUT_KEYS = new Set(["required", "disabled", "readonly", "multiple", "checked"]);

export type FormEditorElementType =
  | "@form-editor"

  | "@form-editor>input"
  | "@form-editor>button"
  | "@form-editor>move"
  | "@form-editor>copy"
  | "@form-editor>edit"
  | "@form-editor>duplicate"
  | "@form-editor>expand"

  | "@form-editor>canvas"
  | "@form-editor>canvas>settings"
  | "@form-editor>canvas>configurator"
  | "@form-editor>canvas>configurator>actions"
  | "@form-editor>canvas>output"
  | "@form-editor>canvas>submit"
  ;

export interface iFormEditorConfig extends iBuilderConfig<FormEditorElementType> { }


export class FormEditorBuilder extends Builder<FormEditorElementType, iFormEditorConfig> {
  builderId: keyof iBuilderRegistry = "form-editor";
  name: keyof iBuilderRegistry = "form-editor";
  stylesheet: string = "./FormEditor.css";

  #properties = new WeakMap<HTMLFormElement, AbortController>();
  /** 🧹 Abort controller for the picker listener (destroy()). */
  #abort = new AbortController();
  /** 📥 `form#canvas` (the output form) — every committed payload is appended here. */
  #output: HTMLFormElement | null = null;
  /** 🎛️ `form.form.configurator` — `outputActions().edit` puts the payload's properties HERE. */
  #configurator: HTMLFormElement | null = null;
  /** ✏️ Card under edit — the next commit REPLACES it instead of appending a twin. */
  #editing: HTMLElement | null = null;
  /** 🖐️ Reorder engine for the output cards (one instance per editor). */
  #dnd = new DragNDropService();
  /** 🆔 Monotonic suffix so repeated inserts of one type never share an id. */
  #seq = 0;
  // engine: FormBuilder = null;

  constructor(config: Partial<iFormEditorConfig>) {
    super();

    const defaultSelectors: Record<FormEditorElementType, iElementProperty> = {
      "@form-editor": { tagName: "section" },

      "@form-editor>input": { tagName: "div", className: "field" },
      "@form-editor>button": { tagName: "button", attrs: { type: "button" } },

      "@form-editor>move": { tagName: "button", attrs: { type: "button" }, className: "move", icon: "three dots horizontal icon", wrapper: ".controls[position='left']" },
      "@form-editor>copy": { tagName: "button", attrs: { type: "button" }, className: "copy" },
      "@form-editor>edit": { tagName: "button", attrs: { type: "button" }, className: "edit", icon: "edit icon" },
      "@form-editor>duplicate": { tagName: "button", attrs: { type: "button" }, className: "duplicate", icon: "copy icon" },
      "@form-editor>expand": { tagName: "button", attrs: { type: "button" }, className: "expand", icon: "expand arrow icon" },

      "@form-editor>canvas": { tagName: "div", className: "form canvas" },
      "@form-editor>canvas>settings": { tagName: "form", className: "form settings" },
      "@form-editor>canvas>configurator": { tagName: "details", className: "accordion", wrapper: "form.form.configurator" },
      "@form-editor>canvas>configurator>actions": { tagName: "div", className: "field actions", wrapper: "summary" },
      "@form-editor>canvas>output": { tagName: "form", id: "canvas", className: "form output" },
      "@form-editor>canvas>submit": { tagName: "button", textContent: "Build", attrs: { type: "submit" }, className: "submit", icon: "checkmark circle icon", wrapper: ".buttons.set" },

    }

    const defaultConfig: Required<iFormEditorConfig> = {
      selectors: defaultSelectors,
      themeId: "default",
      namespace: "",
      emit: null,
    }

    this.config = this.resolveConfig(defaultConfig, config);
  }


  public prepare(_content: any, _config?: Required<iFormEditorConfig> | undefined): HTMLElement | Record<string, any | HTMLElement> {
    const editor = this.render("@form-editor")!;

    // 🧩 The canvas is the ONLY thing this builder renders up front — the
    // configurator lives inside it.
    return editor;
  }


  protected template(typeKey: FormEditorElementType, el: HTMLElement, payload?: any, props?: iActionProperty): void {
    switch (typeKey) {
      case "@form-editor":
        const canvas = this.render("@form-editor>canvas")!
        el.append(canvas);
        break;

      case "@form-editor>canvas":
        const canvasId = Math.random().toString(36).substring(7);
        const settings = this.render("@form-editor>canvas>settings")!;
        const configurator = this.render("@form-editor>canvas>configurator", { id: canvasId })!;
        const output = this.render("@form-editor>canvas>output")!;
        const submit = this.render("@form-editor>canvas>submit")!;

        el.append(settings, configurator.__outer, output, submit.__outer);
        break;

      case "@form-editor>canvas>settings":

        const label = this.render("@form-editor>input", { type: "text", title: "form id" })!
        const useLabel = this.render("@form-editor>input", { type: "checkbox", title: "use label", config: { position: "left" } })!

        el.append(label, useLabel)
        break;

      case "@form-editor>canvas>configurator":
        const cfgId = payload?.id
        el.__outer.id = cfgId;
        const cfgSummary = document.createElement("summary");
        const cfgActions = this.render("@form-editor>canvas>configurator>actions", { id: cfgId })!;
        cfgSummary.append(cfgActions.__outer);
        const insertButton = this.render("@form-editor>button", { className: "submit insert", textContent: "insert" })!;
        insertButton.setAttribute("form", cfgId);
        (insertButton as HTMLButtonElement).type = "submit"
        el.append(cfgSummary, insertButton);
        el.style.marginBottom = "0";
        break;

      case "@form-editor>canvas>configurator>actions":
        // A builder instantiated directly owns its module set: the registry cannot
        // supply it, so the definitions go in the constructor.
        const cfgAction = new InputBuilder({ modules: INPUT_MODULE_DEFINITIONS }).create({
          // The field node is `content`; builder behaviour stays a constructor concern.
          content: {
            type: "dropdown",
            id: payload?.id,
            placeholder: "Select input type",
            value: "text",
            config: {
              // The dropdown module owns its own options and callback (`config.dropdown`).
              dropdown: {
                options: Object.keys(InputAttributeBuilder.inputs),
                // 🎚️ The dropdown owns its value state — every pick rebuilds the
                //    properties HERE (the bubbling `change` is suppressed whenever
                //    the state already matches, e.g. right after `edit` mirrored a
                //    payload type onto the carrier input).
                onSelect: (_label: string, id: string | null) => {
                  if (!id || !(id in InputAttributeBuilder.inputs)) return;
                  const form = el.closest("form.form.configurator") as HTMLFormElement | null;
                  if (!form) return;
                  const block = form.querySelector<HTMLDetailsElement>("details.accordion");
                  if (block?.dataset.inputType === id) return;
                  this._buildProperties(form, id as InputType);
                },
              },
              actions: [{
                type: "custom",
                icon: "expand arrow",
                title: "expand",

                onClick: (_event: Event, payload: any) => {
                  const details = payload.parentElement.closest("details") as HTMLDetailsElement;

                  console.log("action!! Expand", payload, details.open);
                  if (!details.open) details.open = true;
                  else details.open = false;
                }
              }]
            }
          }
        })

        el.append(cfgAction);
        break;

      case "@form-editor>canvas>output":
        // 📥 Booted EMPTY — `initialize()` captures this form and appends every
        //    committed payload into it (see `_wirePropertyForm`'s submit branch).
        break;

      case "@form-editor>canvas>submit":

        break;

      case "@form-editor>button":

        if (payload.className) el.className = `button ` + payload.className;
        if (payload.textContent) el.textContent = payload.textContent;

        break;


      case "@form-editor>input":
        const inputInstance = new InputBuilder();
        let fieldEl: HTMLElement;
        if (payload.isAction) {
          // 🎴 ONE isolated factory — edit/duplicate/delete/move as closures
          //    over THIS card + its payload (no separate `this._edit` methods).
          const acts = this.outputActions(el, payload as iBasicInputNode);
          const actions = [
            { type: "edit", onClick: () => acts.edit() },
            { type: "add", onClick: () => acts.duplicate() },
            { type: "delete", label: "", onClick: () => acts.delete() },
          ];
          // 🧾 Keep the payload's `config.attributes` AND forward
          //    `disableDefault`, so InputControls' default switch stays off.
          fieldEl = inputInstance.create({ ...payload, config: { ...payload.config, actions, disableDefault: true } });

          const move = this.render("@form-editor>move")!;
          fieldEl.prepend(move.__outer);
          acts.move(move as HTMLButtonElement);
          // 🧱 `.block` is the drag service's hit-test key — `#moveDropzone`
          //    filters the container's children by it. Without it the list is
          //    always empty, the dropzone pins to the END of the form, and
          //    reordering only ever "falls forward" (never backwards).
          el.classList.add("actions", "output", "block");
        } else {
          fieldEl = inputInstance.create(payload);
        }

        el.setAttribute("form", payload.id);
        el.replaceChildren(...fieldEl.childNodes);
        break;

      case "@form-editor>move":
        el.title = `Click to ${props?.className}` as string;
        const iMove = document.createElement("i");
        iMove.className = props?.icon as string;

        el.append(iMove);
        break;

    }
  }


  public initialize(root?: HTMLElement, _payload?: any, _context?: any): void {
    if (!root) return;

    const configurator = root.querySelector<HTMLFormElement>("form.form.configurator");
    this.#output = root.querySelector<HTMLFormElement>("form#canvas");
    this.#configurator = configurator;
    if (!configurator) return;

    this._buildProperties(configurator, "text");

    // 🖐️ `form#canvas` is the drag container — every card joins it through
    //    `outputActions().move` (bindBlock + bindHandle on its handle).
    if (this.#output) this.#dnd.bindContainer(this.#output);

    // 🎚️ TYPE PICKER — the dropdown rides inside the block's `summary`, while the
    //    generated property controls are stamped AFTER it. A bubbling `change`
    //    still inside the summary can only be the picker asking for a fresh
    //    property payload (`FormEditor_x._wireSummary` wired this same branch).
    const summary = configurator.querySelector("summary");
    const picker = summary?.querySelector<HTMLInputElement>("input[type='hidden']") ?? null;

    configurator.addEventListener("change", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !summary || !summary.contains(target)) return;
      if (target !== picker && !(target instanceof HTMLSelectElement)) return;

      const selected = (target instanceof HTMLSelectElement ? target.value : picker?.value) || "";
      if (!selected || !(selected in InputAttributeBuilder.inputs)) return;

      const block = configurator.querySelector<HTMLDetailsElement>("details.accordion")!;
      block.open = true;
      if (block?.dataset.inputType === selected) return;

      this._buildProperties(configurator, selected as InputType);
    }, { signal: this.#abort.signal });
  }

  /** 🧹 Release the picker listener; the per-form property listeners die with their form. */
  public destroy(typeKey?: FormEditorElementType): void {
    this.#abort.abort();
    this.#dnd.destroy();
    super.destroy(typeKey);
  }


  protected _buildProperties(targetForm: HTMLFormElement, selectedValue: InputType): void {
    if (!targetForm) return;
    const block = targetForm.querySelector<HTMLDetailsElement>("details.accordion");
    if (!block) return;
    // 📂 Leave `block.open` untouched — picking a type rebuilds the properties
    //    live while the details stays open (it only closes on commit/insert).
    block.dataset.inputType = selectedValue;

    targetForm.action = "submit";
    targetForm.method = "post";

    // 🧹 Every rebuild starts clean — the property fields (and the group
    //    container `_groupCheckboxes` wrapped them in) are generated data, so
    //    only the picker summary and the insert button survive the round.
    const summary = block.querySelector("summary");
    const insertButton = this.load("@form-editor>button");
    Array.from(block.children).forEach((child) => {
      if (child === summary || child === insertButton) return;
      child.remove();
    });

    const templates = InputAttributeBuilder.create([{ type: selectedValue }]);
    const selectedTemplates: HTMLElement[] = [];

    for (const key in templates[0]) {
      if (!Object.hasOwn(templates[0], key)) continue;

      const element = templates[0][key];
      // console.log(element)
      if (element.hasOwnProperty("template")) {
        selectedTemplates.push(element?.template);
      }
    }

    // 🏷️ Per-block id namespace — two blocks of the same type must not share
    // `id`/`for` pairs, or every label would focus the FIRST block's field.
    this._stampFields(selectedTemplates, `${selectedValue}-${targetForm.id}`);

    summary?.after(...selectedTemplates);

    this._groupCheckboxes(block);

    if (insertButton && !block.contains(insertButton)) {
      insertButton.setAttribute("form", targetForm.id);
      block.append(insertButton);
    }

    this._wirePropertyForm(targetForm, block, selectedValue);
  }

  protected _wirePropertyForm(targetForm: HTMLFormElement, block: HTMLDetailsElement, selectedValue: InputType): void {
    this.#properties.get(targetForm)?.abort();
    const controller = new AbortController();
    this.#properties.set(targetForm, controller);

    const { signal } = controller;

    targetForm.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement)?.closest?.("button.insert[type='submit']") as HTMLButtonElement | null;
      if (!button) return;
      if (!block?.contains(button) && button.getAttribute("form") !== targetForm?.id) return;
      event.preventDefault();
      if (!targetForm.checkValidity()) {
        return;
      }

      targetForm.requestSubmit(button);
    }, { signal });

    targetForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const output = this.#output;
      if (!output) return;

      // ✅ COMMIT — the configurator's schema becomes a built input in
      //    `form#canvas` (`FormEditor_x._commitBlock`: payload → stash →
      //    close → emit; the block-preview swap becomes a card replace/append).
      const payload = this._toPayload(block, targetForm, selectedValue);

      // ✏️ After `outputActions().edit`, this commit REPLACES that card — the
      //    payload's properties travelled to the configurator, the card stays.
      const source = this.#editing;
      this.#editing = null;

      block.__payload = payload;


      // build the input — keep the payload's schema (config.attributes) and
      // force `disableDefault` so the factory owns every control click.
      const actionPayload = { ...payload, isAction: true, config: { ...payload.config, disableDefault: true } };
      const built = this.render("@form-editor>input", actionPayload)!;
      this.#applyPayloadValue(built, payload);

      if (source?.isConnected) source.replaceWith(built);
      else output.appendChild(built);

      if (this.config.emit) {
        this.config.emit("elementChanged", { builder: this.builderId, type: selectedValue, element: built, data: payload });
      }
    }, { signal });
  }

  /**
   * 🎴 OUTPUT ACTIONS — the whole action bar of a committed card as ONE isolated
   * factory (nothing leaks onto the builder as `this._edit`-style methods).
   * Each closure captures the card element + its payload:
   *
   * - `edit`      → puts the payload's TYPE + properties ONTO the configurator
   *                 form (`form.form.configurator`) — unlike FormEditor_x,
   *                 which edited the block in place. The next insert REPLACES
   *                 this card (see `#editing`).
   * - `duplicate` → re-renders the payload with a fresh id right after the card.
   * - `delete`    → releases the drag bindings and removes the card.
   * - `move`      → joins the card + its handle to the canvas drag circuit.
   */
  protected outputActions(element: HTMLElement, payload: iBasicInputNode) {
    return {
      edit: () => {
        const configurator = this.#configurator;
        if (!configurator) return;

        // 📥 Mirror the payload's type on the picker (display only — the dropdown
        //    keeps its own state; `onSelect` re-syncs it on the next real pick).
        const type = (payload.type ?? "text") as InputType;
        const summary = configurator.querySelector("summary");
        const carrier = summary?.querySelector<HTMLInputElement>("input[type='hidden']");
        const display = summary?.querySelector<HTMLInputElement>("input:not([type='hidden'])");
        if (carrier) carrier.value = type;
        if (display) display.value = type; // the picker's option labels ARE the type keys

        this._buildProperties(configurator, type);
        this.#fillProperties(configurator, payload);

        // ✏️ The next insert = an UPDATE of this card.
        this.#editing = element;
        const block = configurator.querySelector<HTMLDetailsElement>("details.accordion");
        if (block) block.open = true;
        configurator.scrollIntoView({ behavior: "smooth", block: "nearest" });
      },

      duplicate: () => {
        // 🆔 fresh id — `#seq` keeps repeated duplicates apart in `form#canvas`.
        const clone: iBasicInputNode = {
          ...payload,
          id: `${payload.type ?? "text"}-${payload.formId ?? ""}-${++this.#seq}`,
          config: { ...payload.config, attributes: [...(payload.config?.attributes ?? [])] },
        };
        const copy = this.render("@form-editor>input", {
          ...clone,
          isAction: true,
          config: { ...clone.config, disableDefault: true },
        })!;
        element.after(copy);
        this.#applyPayloadValue(copy, clone);

        if (this.config.emit) {
          this.config.emit("elementChanged", { builder: this.builderId, type: clone.type, element: copy, data: clone });
        }
        return copy;
      },

      delete: () => {
        this.#dnd.releaseIf(element);
        if (this.#editing === element) this.#editing = null;
        element.remove();

        if (this.config.emit) {
          this.config.emit("elementChanged", { builder: this.builderId, type: payload.type, element: null, data: payload });
        }
      },

      move: (handle: HTMLButtonElement) => {
        // 🖐️ card + handle join the drag circuit (DragNDropService on `form#canvas`).
        this.#dnd.bindBlock(element);
        this.#dnd.bindHandle(handle, element);
      },
    };
  }

  /**
   * 🧾 FORM → PAYLOAD — the configurator's schema becomes an `iBasicInputNode`:
   * attributes that are real input fields stay at the top level, every other one
   * (min/max/step/accept/data-…) becomes an entry of `config.attributes`, which is
   * exactly what `InputBuilder` stamps onto the control.
   */
  protected _toPayload(block: HTMLDetailsElement, form: HTMLFormElement, selectedValue: InputType): iBasicInputNode {
    // 🆔 The configurator is one reusable palette — every commit needs a fresh
    //    id, or a second insert of the same type would collide in `form#canvas`.
    const payload: iBasicInputNode = {
      type: selectedValue,
      id: `${selectedValue}-${form.id}-${++this.#seq}`,
      formId: form.id,
      config: {},
    };
    const target = payload as Record<string, any>;
    const attributes: Array<{ name: string; value: string }> = [];
    const submitted = new FormData(form);
    const summary = block.querySelector("summary");

    form.querySelectorAll<iFieldControl>("input, select, textarea").forEach((control) => {
      // 🎚️ The type picker rides in the summary — its carrier only mirrors the
      //    current input type, never a property of the payload.
      if (summary?.contains(control)) return;

      const attr = this.#attrNameOf(control.name, selectedValue);
      if (!attr) return;

      // 🔘 The property toggles are checkboxes: payload booleans are real
      // `iBasicInputNode` fields, while the `data-*` flags only mean something
      // when ON (FileUploader reads them as plain strings — a literal "false"
      // would still be truthy), so an unchecked toggle emits nothing.
      if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
        if (BOOLEAN_INPUT_KEYS.has(attr)) target[attr] = control.checked;
        else if (control.checked) attributes.push({ name: attr, value: "true" });
        return;
      }

      const value = String(submitted.get(control.name) ?? control.value ?? "");

      if (BOOLEAN_INPUT_KEYS.has(attr)) {
        target[attr] = value === "true";
        return;
      }

      if (INPUT_NODE_KEYS.has(attr)) {
        // Clearing an editor must clear the field, never keep a stale value.
        if (value === "") delete target[attr];
        else target[attr] = value;
        return;
      }

      if (value !== "") attributes.push({ name: attr, value });
    });

    payload.config = { ...payload.config, attributes };
    return payload;
  }

  /** 🏷️ `number-placeholder` → `placeholder` (property controls are `<type>-<attr>`). */
  #attrNameOf(name: string, selectedValue: InputType | string): string {
    const prefix = `${selectedValue}-`;
    return name.startsWith(prefix) ? name.slice(prefix.length) : name;
  }

  /** 📥 EDIT → CONFIGURATOR — reflect a committed payload back onto the property controls. */
  #fillProperties(form: HTMLFormElement, payload: iBasicInputNode): void {
    const summary = form.querySelector("summary");
    const flat = this.#flattenPayload(payload);
    const type = payload.type ?? "text";

    form.querySelectorAll<iFieldControl>("input, select, textarea").forEach((control) => {
      // 🎚️ the picker mirrors the current type — never a payload property.
      if (summary?.contains(control)) return;

      const attr = this.#attrNameOf(control.name, type);
      if (!attr || !flat.has(attr)) return;
      const value = flat.get(attr)!;

      if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
        control.checked = value === true || value === "true" || value === "on";
        return;
      }
      control.value = String(value);
    });
  }

  /** 🔀 top-level node fields + `config.attributes` → one flat attr → value map. */
  #flattenPayload(payload: iBasicInputNode): Map<string, string | number | boolean> {
    const flat = new Map<string, string | number | boolean>();

    Object.entries(payload).forEach(([key, value]) => {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return;
      flat.set(key, value);
    });
    payload.config?.attributes?.forEach(({ name, value }) => flat.set(name, value));

    return flat;
  }

  /** 🧾 `value`/`checked` are the caller's job in InputBuilder — reflect them in the built node. */
  #applyPayloadValue(built: HTMLElement, payload: iBasicInputNode): void {
    if (payload.value !== undefined && payload.value !== null && payload.value !== "") {
      const control = built.querySelector<iFieldControl>(
        "input:not([type='file']):not([type='checkbox']):not([type='radio']), select, textarea"
      );
      if (control) control.value = String(payload.value);
    }

    const toggle = built.querySelector<HTMLInputElement>("input[type='checkbox'], input[type='radio']");
    if (toggle && payload.checked !== undefined) toggle.checked = Boolean(payload.checked);
  }

  /**
   * 🏷️ Give the generated controls a block-unique id and re-aim every label bound
   * to them. One field may render SEVERAL labels for the same control (checkbox
   * does) and `_groupCheckboxes()` later drops one child — so re-aim them all.
   */
  private _stampFields(fields: HTMLElement[], prefix: string): void {
    fields.forEach((field) => {
      const labels = Array.from(field.querySelectorAll<HTMLLabelElement>("label[for]"));

      field.querySelectorAll<HTMLElement>("input[id], select[id], textarea[id]").forEach((control) => {
        const previousId = control.id;
        if (!previousId) return;

        control.id = `${prefix}-${previousId}`;
        labels.forEach((label) => {
          if (label.htmlFor === previousId) label.setAttribute("for", control.id);
        });
      });
    });
  }

  _groupCheckboxes(formEl: HTMLElement) {
    if (!(formEl instanceof HTMLElement)) return formEl;

    const fieldSelector = ".field:has(input[type='checkbox'])";
    const containerClassName = "field group";

    const fields = formEl.querySelectorAll(fieldSelector);
    if (!fields.length) return formEl;

    const container = document.createElement("div");
    container.className = containerClassName;
    container.dataset.display = 'inline';

    fields.forEach((field) => {
      field.firstElementChild?.remove();
      container.appendChild(field);
      const cb = field.firstElementChild;
      if (cb instanceof HTMLDivElement) cb.style.marginTop = "1em";
    });

    formEl.insertBefore(container, formEl.querySelector("button.insert"));

    return formEl;
  }

}