import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../../interface";
import { Builder } from "../../Base";
import { InputAttributeBuilder } from "../Attribute";
import { InputBuilder, type iBasicInputNode, type iInputActionDefinition, type InputType } from "../Input";
import { DragNDropService } from "./FormEditor.dragNdrop";

export type FormEditorElementType =
  | "@form-editor"
  | "@form-editor>canvas"
  | "@form-editor>details"
  | "@form-editor>structure"
  | "@form-editor>buttons"
  | "@form-editor>block"
  | "@form-editor>block>output"
  | "@form-editor>block>input"
  | "@form-editor>block>form"
  | "@form-editor>block>submit"
  | "@form-editor>actions>move"
  | "@form-editor>actions>expand"
  ;

export interface iFormEditorConfig extends iBuilderConfig<FormEditorElementType> { }

/** 🎛️ The control shapes the property editors render (`@field>input|select|textarea`). */
type iFieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** 🧾 Property attrs that are real `iBasicInputNode` fields (the rest become DOM attributes). */
const INPUT_NODE_KEYS = new Set([
  "placeholder", "value", "rows", "cols", "range", "info", "position", "label", "name", "title",
]);

/** 🔘 …and the ones that node carries as booleans. */
const BOOLEAN_INPUT_KEYS = new Set(["required", "disabled", "readonly", "multiple", "checked"]);

export class FormEditorBuilder extends Builder<FormEditorElementType, iFormEditorConfig> {
  builderId: keyof iBuilderRegistry = "form-editor";
  name: keyof iBuilderRegistry = "form-editor";
  stylesheet: string = "./FormEditor.css";

  /** 🖐️ Drag & drop service — arming, ghost, dropzone and the delegated container channel live there, not here. */
  #dnd = new DragNDropService();
  /** 🧩 Blocks whose own listeners are wired — edit `<details>` and output preview alike. */
  #wired = new WeakSet<HTMLElement>();
  /** 🧩 Control roots wired so far (summary OR preview) — a mode switch mounts a brand new one. */
  #summaries = new WeakSet<HTMLElement>();
  /** 🧨 One controller per property form: a rebuild aborts instead of stacking. */
  #properties = new WeakMap<HTMLFormElement, AbortController>();
  /** 🧹 Abort controller for the picker/edit/build-button listeners (destroy()). */
  #abort = new AbortController();

  // engine: FormBuilder = null;

  constructor(config: Partial<iFormEditorConfig>) {
    super();
    const defaultSelectors = {
      "@form-editor": { tagName: "section" },
      "@form-editor>canvas": { tagName: "form", className: "form canvas" },
      "@form-editor>details": { tagName: "fieldset", className: "details" },
      "@form-editor>structure": { tagName: "fieldset", className: "structures" },
      "@form-editor>buttons": { tagName: "fieldset", className: "buttons set" },
      "@form-editor>block": { tagName: "details", className: "block" },
      "@form-editor>block>input": { wrapper: "summary" },
      "@form-editor>block>output": { tagName: "div", className: "block" },
      "@form-editor>block>form": { tagName: "form", className: "form base-property" },
      "@form-editor>block>submit": { tagName: "button", attrs: { type: "submit" }, className: "submit", icon: "checkmark circle icon" },
      "@form-editor>actions>move": { tagName: "button", attrs: { type: "button" }, className: "move", icon: "three dots horizontal icon", wrapper: ".controls[position='left']" },
      "@form-editor>actions>expand": { tagName: "button", attrs: { type: "button" }, className: "expand", icon: "expand arrow icon" }
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
    const editor = this.render("@form-editor>canvas")?.__outer!;

    return editor;
  }

  protected template(typeKey: FormEditorElementType, el: HTMLElement, payload?: any, props?: iActionProperty): void {
    switch (typeKey) {
      case "@form-editor>canvas":
        const details = this.render("@form-editor>details")!;
        const structure = this.render("@form-editor>structure")!;
        const block = this.render("@form-editor>block")!;
        structure.append(block)
        const buttons = this.render("@form-editor>buttons")!;
        // el.dataset.mode = "dark";
        // el.draggable = true;
        el.append(details, structure, buttons);
        break;

      case "@form-editor>buttons":
        // const cancel = document.createElement("button");
        // cancel.className = "cancel"
        // cancel.type = "button";
        // const nIcon = document.createElement("i");
        // nIcon.className = "icon arrow right";
        // cancel.textContent = "cancel";
        // cancel.appendChild(nIcon);

        const submitS = document.createElement("button");
        submitS.className = "submit"
        submitS.type = "button";
        const bIcon = document.createElement("i");
        bIcon.className = "icon checkmark";
        submitS.textContent = "build";
        submitS.prepend(bIcon);
        el.style.justifyContent = "center";
        el.append(/* cancel, */ submitS)
        break;

      case "@form-editor>details":
        const inputId = new InputBuilder().create({ type: "text", label: "form id" })
        el.append(inputId)
        break;

      case "@form-editor>block":
        // 🏷️ A REBUILT block passes its original id back (payload.id) so the form/label
        // ids survive the output → edit round-trip; a first render rolls a fresh one.
        const blockId = payload?.id || Math.random().toString(36).substring(7);
        // (el as HTMLDetailsElement).open = false;
        el.setAttribute("form", blockId)

        const a = this.render("@form-editor>block>input", { id: blockId })!;
        const f = this.render("@form-editor>block>form", { id: blockId })!;
        el.append(a.__outer, f);
        break;

      case "@form-editor>block>form":
        el.id = payload.id;
        const submit = this.render("@form-editor>block>submit", { id: payload.id })!;
        el.append(submit!)
        break;

      case "@form-editor>block>submit":
        el.setAttribute("form", payload.id)
        el.id = "submitter-" + payload.id;
        const i = document.createElement("i");
        i.className = props?.icon as string;
        (el as HTMLButtonElement).type = "submit";
        el.textContent = "Save"

        el.appendChild(i)

        break;

      case "@form-editor>actions>move":
      case "@form-editor>actions>expand":
        el.title = `Click to ${props?.className}` as string;
        const iMove = document.createElement("i");
        iMove.className = props?.icon as string;

        el.append(iMove);
        break;

      case "@form-editor>block>output":
        const output = new InputBuilder().create(payload);

        const buttonEdit = document.createElement("button");
        buttonEdit.className = "output edit";
        buttonEdit.type = "button";
        buttonEdit.title = "Click to edit this input";
        const iEdit = document.createElement("i");
        iEdit.className = "icon edit";
        buttonEdit.append(iEdit);

        // 🖐️ The built block must stay draggable — `_wireSummary()` binds this
        // handle exactly like the one of the picker summary.
        const moveOutput = this.render("@form-editor>actions>move")!;

        el.replaceChildren(moveOutput.__outer, output, buttonEdit)

        break;

      case "@form-editor>block>input":
        const inputInstance = new InputBuilder()
        const actions = {
          type: "select",
          // 🏷️ One id per block — a shared one collides as soon as a block is duplicated.
          id: `input-type-${payload.id}`,
          title: "Test Text",
          placeholder: "Select Input Type",
          config: {
            disableDefault: true,
            useLabel: false,
            options: Object.keys(InputAttributeBuilder.inputs),
            actions: [
              {
                type: "add",
                label: "",
                onClick: (_e: Event, payload: any) => {
                  console.log("action!! ADD", payload)
                  this._duplicate(payload.parentElement, payload.input)
                }
              },
              {
                type: "delete",
                label: "",
                onClick: (_e: Event, payload: any) => {
                  console.log("action!! delete", payload)
                  this._delete(payload.parentElement);
                }
              },
              {
                type: "custom",
                icon: "expand arrow",
                title: "expand",
                onClick: (_e: Event, payload: any) => {

                  const details = payload.parentElement.closest("details") as HTMLDetailsElement;

                  console.log("action!! Expand", payload, details.open);
                  if (!details.open) details.open = true;
                  else details.open = false;
                  // details.open = !details.open;
                }
              }

            ]
          }
        }
        const input = inputInstance.create(actions);
        const move = this.render("@form-editor>actions>move")!;

        input.prepend(move.__outer)
        input.setAttribute("form", payload.id);
        el.__outer.replaceChildren(input);
        break;
    }
  }

  /**
   * 🧩 INITIALIZE — the editor is a LIST of blocks, so every listener is bound
   * PER BLOCK (`_wireBlock`) and the container only carries the delegated drag
   * channel. Nothing here is reached through `this.load()`: that registry knows
   * only the LAST rendered node, which is exactly why a duplicated block used to
   * inherit nothing but the source's handlers.
   */
  public initialize(root?: HTMLElement, _payload?: any, _context?: any): void {
    if (!root) return;

    // prepare() hands over the `section` wrapper; stay tolerant when the canvas
    // itself (or a bare mount node) arrives instead.
    const canvas = (root.matches?.("form.canvas") ? root : root.querySelector<HTMLElement>("form.canvas"))
      ?? (root.firstElementChild as HTMLElement | null);
    if (!canvas) return;

    const container = canvas.querySelector<HTMLElement>("fieldset.structures");
    const { signal } = this.#abort;

    // 🖐️ DRAG CHANNEL — delegated to the service: one pair of listeners on the
    // container (blocks appended later reorder through them) plus the global
    // safety net that never lets a block stay armed.
    this.#dnd.bindContainer(container);

    // 🧩 Every block already in the tree (the one prepare() rendered) is wired
    // exactly like the ones `_duplicate()` appends afterwards.
    canvas.querySelectorAll<HTMLElement>("details.block, [data-mode='output'].block").forEach((block) => this._wireBlock(block));

    // 🏗️ BUILD — flatten every block's property form into one schema.
    canvas.querySelector<HTMLButtonElement>("fieldset.buttons button.submit")
      ?.addEventListener("click", () => this._build(canvas), { signal });
  }

  /**
   * 🔌 WIRE ONE BLOCK — move handle, drag lifecycle and type picker for THIS
   * block only. Called for the block rendered during prepare() and for every
   * duplicate, so one block can never steal (or lose) another block's handlers.
   */
  protected _wireBlock(block: HTMLElement): void {
    if (this.#wired.has(block)) return;
    this.#wired.add(block);
    block.dataset.mode ||= "input";

    // 🖐️ DRAG LIFECYCLE — delegated to the service, once per block; the
    // summary only contributes the handle (via `_wireSummary` → `bindHandle`).
    this.#dnd.bindBlock(block);

    this._wireSummary(block);
  }

  /**
   * 🔌 WIRE ONE BLOCK'S CONTROLS — move handle, type picker and edit button of
   * whichever root is CURRENTLY mounted: the picker `<summary>` (edit mode) or
   * the output preview element itself (output mode — the whole `<details>` was
   * swapped for it on commit). Committing or re-editing mounts brand new nodes,
   * so this runs per root (`#summaries` keeps it single-shot) and never reaches
   * into `this.load()`, which would keep pointing at the last one.
   */
  protected _wireSummary(block: HTMLElement): void {
    // 🧩 Edit mode keeps the controls inside `<summary>`; output mode has NO
    // summary at all — the preview element IS the control root.
    const root: HTMLElement | null = block instanceof HTMLDetailsElement
      ? block.querySelector<HTMLElement>(":scope > summary")
      : block;
    if (!root || this.#summaries.has(root)) return;
    this.#summaries.add(root);

    const { signal } = this.#abort;

    // 🖐️ MOVE — present in BOTH modes; arms only its own block. The service
    // drops the `draggable` flag again on mouseup/dragend, never permanent.
    const handle = root.querySelector<HTMLButtonElement>('.controls[position="left"] > button.move');
    if (handle) this.#dnd.bindHandle(handle, block);

    // 🎛️ TYPE PICKER — edit mode only: the built output lives outside `.actions`,
    // so picking a type can never be confused with interacting with the preview.
    const picker = root.querySelector<HTMLSelectElement>(".field.actions > select");
    picker?.addEventListener("change", () => {
      if (block instanceof HTMLDetailsElement) this._buildProperties(block, picker.value as InputType);
    }, { signal });

    // ✏️ EDIT — output mode only: swap the preview back for a WHOLE freshly
    // rendered `@form-editor>block>` carrying this block's payload.
    root.querySelector<HTMLButtonElement>("button.edit")?.addEventListener("click", (event) => {
      event.preventDefault();
      this._renderInput(block as HTMLDetailsElement);
    }, { signal });
  }

  /**
   * 🎛️ REBUILD A BLOCK — swap `form.base-property`'s body for the attribute
   * editors of the picked type, re-stamp their ids for THIS block and hand the
   * form over to `_wirePropertyForm()`.
   */
  protected _buildProperties(block: HTMLDetailsElement, selectedValue: InputType): void {
    const targetForm = block.querySelector<HTMLFormElement>("form.base-property");
    if (!targetForm) return;

    block.open = false;
    block.dataset.inputType = selectedValue;

    targetForm.action = "submit";
    targetForm.method = "post";

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

    targetForm.replaceChildren(...selectedTemplates);
    this._groupCheckboxes(targetForm);

    const b = this.render("@form-editor>block>submit", { id: targetForm.id })!;
    b.setAttribute("form", targetForm.id);

    if (!targetForm.contains(b)) {
      targetForm.append(b);
    }

    this._wirePropertyForm(targetForm, selectedValue);
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

  /**
   * 🔌 FORM SCOPE — click/submit handling for ONE block's property form. The
   * previous controller is aborted first, so picking another type rewires the
   * form instead of stacking a second set of listeners on the same element.
   */
  protected _wirePropertyForm(targetForm: HTMLFormElement, selectedValue: InputType): void {
    this.#properties.get(targetForm)?.abort();
    const controller = new AbortController();
    this.#properties.set(targetForm, controller);

    const { signal } = controller;
    const canvas = targetForm.closest<HTMLFormElement>("form.canvas");

    targetForm.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement)?.closest?.("button[type=submit], input[type=submit]") as HTMLButtonElement | null;
      if (!button) return;
      if (!canvas?.contains(button) && button.getAttribute("form") !== canvas?.id) return;
      event.preventDefault();
      if (!targetForm.checkValidity()) {
        return;
      }
      targetForm.requestSubmit(button);
    }, { signal });

    targetForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const block = targetForm.closest<HTMLDetailsElement>("details.block");
      if (!block) return;

      // ✅ COMMIT — the form's schema becomes the block's input node.
      this._commitBlock(block, targetForm, selectedValue);
    }, { signal });
  }

  /**
   * ✅ COMMIT A BLOCK — read the property form (`_toPayload`), stash the built
   * node on the block and swap its summary for the OUTPUT template (the fresh
   * `InputBuilder` result + an edit button). From here on the block is a small
   * preview of the real input while the form stays behind the edit button.
   */
  protected _commitBlock(block: HTMLDetailsElement, form: HTMLFormElement, selectedValue: InputType): iBasicInputNode {
    const payload = this._toPayload(block, form, selectedValue);

    block.__payload = payload;
    block.open = false;

    const preview = this._renderOutput(block, payload) ?? block;

    if (this.config.emit) {
      this.config.emit("elementChanged", { builder: this.builderId, type: selectedValue, element: preview, data: payload });
    }

    return payload;
  }

  /**
   * 🖼️ OUTPUT MODE — swap the WHOLE `<details>` for `@form-editor>block>output`
   * (move handle + built input + edit button). Identity travels over — payload,
   * picked type and form id — so `_build()` still finds the committed node and
   * the edit button can rebuild the block with the same ids. `InputBuilder`
   * deliberately leaves `value`/`checked` to its caller, so the preview gets
   * them re-applied here.
   * @returns the live preview element (the replacement for `block`).
   */
  protected _renderOutput(block: HTMLDetailsElement, payload: iBasicInputNode): HTMLElement | undefined {
    const preview = this.render("@form-editor>block>output", payload) as HTMLElement | undefined;
    if (!preview) return;

    // 🧬 Carry the block's identity onto its replacement — the `<details>` is gone.
    preview.__payload = payload;
    preview.dataset.mode = "output";
    if (block.dataset.inputType) preview.dataset.inputType = block.dataset.inputType;
    const formId = block.getAttribute("form");
    if (formId) preview.setAttribute("form", formId);

    block.replaceWith(preview);
    this.#applyPayloadValue(preview, payload);

    // 🔌 Wire the LIVE node — drag lifecycle, move handle and the edit button.
    // Must run AFTER `dataset.mode` so `_wireBlock`'s `||= "input"` keeps "output".
    this._wireBlock(preview);

    return preview;
  }

  /**
   * ✏️ EDIT MODE — the preview hands us its whole element: render a BRAND NEW
   * `@form-editor>block>` (picker summary + property form) re-stamped with this
   * block's id, swap it in for the preview, then refill it from the carried
   * payload: the picker comes back with the same type selected and every
   * property editor refilled, so output → edit → output round-trips cleanly.
   */
  protected _renderInput(preview: HTMLElement, payload?: iBasicInputNode): void {
    const current = (payload ?? preview.__payload) as iBasicInputNode | undefined;

    // 🏷️ Keep the original form/label ids — `id` rides LAST in the spread so the
    // compound payload id ("text-abc") can never leak into the raw block id.
    const blockId = preview.getAttribute("form") || current?.formId || undefined;
    const block = this.render("@form-editor>block", { ...(current ?? {}), id: blockId }) as HTMLDetailsElement | undefined;
    if (!block) return;

    preview.replaceWith(block);
    block.__payload = current;
    this._wireBlock(block);

    // ♻️ Restore the block's own state: picked type + its property values.
    const picker = block.querySelector<HTMLSelectElement>(".field.actions > select");
    if (picker && current?.type) picker.value = current.type;

    if (current?.type) {
      this._buildProperties(block, current.type);
      this._fillPropertyForm(block, current);
      block.open = true;
    }
  }

  /**
   * 🧾 FORM → PAYLOAD — the property form's schema becomes an `iBasicInputNode`:
   * attributes that are real input fields stay at the top level, every other one
   * (min/max/step/accept/data-…) becomes an entry of `config.attributes`, which is
   * exactly what `InputBuilder` stamps onto the control.
   */
  protected _toPayload(block: HTMLElement, form: HTMLFormElement, selectedValue: InputType): iBasicInputNode {
    const previous = block.__payload as iBasicInputNode | undefined;
    const payload: iBasicInputNode = {
      ...(previous ?? {}),
      type: selectedValue,
      id: `${selectedValue}-${block.getAttribute("form") ?? form.id}`,
      formId: form.id,
      config: { ...previous?.config },
    };
    const target = payload as Record<string, any>;
    const attributes: Array<{ name: string; value: string }> = [];
    const submitted = new FormData(form);

    form.querySelectorAll<iFieldControl>("input, select, textarea").forEach((control) => {
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

  /** 🧾 Flatten a payload to `attribute → value` (top-level keys + `config.attributes`). */
  #flattenPayload(payload: iBasicInputNode): Map<string, unknown> {
    const flat = new Map<string, unknown>();

    Object.entries(payload).forEach(([key, value]) => {
      if (key === "config" || value === undefined) return;
      flat.set(key, value);
    });

    (payload.config?.attributes ?? []).forEach((attribute) => flat.set(attribute.name, attribute.value));

    return flat;
  }

  /** ♻️ Push a payload back into the block's freshly built property editors. */
  protected _fillPropertyForm(block: HTMLDetailsElement, payload: iBasicInputNode): void {
    const form = block.querySelector<HTMLFormElement>("form.base-property");
    if (!form) return;

    const flat = this.#flattenPayload(payload);

    form.querySelectorAll<iFieldControl>("input, select, textarea").forEach((control) => {
      const attr = this.#attrNameOf(control.name, payload.type ?? "text");
      if (!attr || !flat.has(attr)) return;

      const value = flat.get(attr);

      if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
        control.checked = value === true || value === "true" || value === "on";
        return;
      }

      control.value = value === undefined || value === null ? "" : String(value);
    });
  }

  /** 🧾 `value`/`checked` are the caller's job in InputBuilder — reflect them in the preview. */
  #applyPayloadValue(summary: HTMLElement, payload: iBasicInputNode): void {
    if (payload.value !== undefined && payload.value !== null && payload.value !== "") {
      const control = summary.querySelector<iFieldControl>(
        "input:not([type='file']):not([type='checkbox']):not([type='radio']), select, textarea"
      );
      if (control) control.value = String(payload.value);
    }

    const toggle = summary.querySelector<HTMLInputElement>("input[type='checkbox'], input[type='radio']");
    if (toggle && payload.checked !== undefined) toggle.checked = Boolean(payload.checked);
  }





  /**
   * 🏗️ BUILD — collect one `iBasicInputNode` per block: the committed payload
   * when the block has one, otherwise the property form read as-is. This is the
   * array a caller hands to the Form / Google-Sheets pipeline.
   */
  protected _build(canvas: HTMLElement): void {
    const schema = Array.from(canvas.querySelectorAll<HTMLElement>("details.block, .block[data-mode='output']")).map((block) => {
      const committed = block.__payload as iBasicInputNode | undefined;
      if (committed) return committed;

      const form = block.querySelector<HTMLFormElement>("form.base-property");
      const type = (block.dataset.inputType ?? "text") as InputType;

      return form ? this._toPayload(block, form, type) : { type };
    });

    console.log("form schema", schema);
  }



  _groupCheckboxes(formEl: HTMLFormElement) {
    if (!(formEl instanceof HTMLFormElement)) return formEl;

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

    formEl.append(container);
    formEl.style.background = "transparent";
    return formEl;
  }

  /**
   * 🧬 DUPLICATE — mount a fresh block right after the block whose handle was
   * pressed, then WIRE IT (`_wireBlock`). Its configuration travels over from the
   * source (picked type + property values, or its committed node) but never its
   * listeners: each block owns its own handle, picker and property form.
   */
  protected _duplicate(parentElement: HTMLElement, _actions: iInputActionDefinition[]): void {
    const source = parentElement.closest<HTMLDetailsElement>("details.block");
    const container = source?.closest<HTMLElement>("fieldset.structures");
    if (!source || !container) return;

    const inputSet = this.render("@form-editor>block") as HTMLDetailsElement | undefined;
    if (!inputSet) return;

    source.after(inputSet);
    this._wireBlock(inputSet);

    // A committed source hands over its built node, so the copy is born in the
    // same mode; an open source only carries its draft over.
    const committed = this._copyConfiguration(source, inputSet);
    inputSet.open = !committed;
    inputSet.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /**
   * 🧬 Carry the source block onto its duplicate. Returns `true` when the copy was
   * born committed (output mode) — i.e. the source already held a built node.
   */
  private _copyConfiguration(source: HTMLDetailsElement, duplicate: HTMLDetailsElement): boolean {
    const sourcepayload = source.__payload as iBasicInputNode | undefined;

    if (source.dataset.mode === "output" && sourcepayload?.type) {
      const clone: iBasicInputNode = {
        ...sourcepayload,
        // 🏷️ New block, new identity: form binding + ids must never be shared.
        id: `${sourcepayload.type}-${duplicate.getAttribute("form") ?? ""}`,
        formId: duplicate.querySelector<HTMLFormElement>("form.base-property")?.id ?? sourcepayload.formId,
      };

      duplicate.__payload = clone;
      this._renderOutput(duplicate, clone);
      return true;
    }

    const selectedValue = source.dataset.inputType as InputType | undefined;
    if (!selectedValue) return false;

    const picker = duplicate.querySelector<HTMLSelectElement>(".field.actions > select");
    if (picker) picker.value = selectedValue;

    this._buildProperties(duplicate, selectedValue);

    const sourceForm = source.querySelector<HTMLFormElement>("form.base-property");
    const duplicateForm = duplicate.querySelector<HTMLFormElement>("form.base-property");
    if (!sourceForm || !duplicateForm) return false;

    duplicateForm.querySelectorAll<iFieldControl>("input, select, textarea").forEach((control) => {
      if (!control.name) return;
      const sourceControl = sourceForm.querySelector<iFieldControl>(`[name="${control.name}"]`);
      if (!sourceControl) return;

      if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
        control.checked = sourceControl instanceof HTMLInputElement && sourceControl.checked;
      } else {
        control.value = sourceControl.value;
      }
    });

    return false;
  }

  protected _delete(parentElement: HTMLElement): boolean {
    const details = parentElement.closest<HTMLDetailsElement>("details.block")
      ?? parentElement.closest<HTMLDetailsElement>("details");
    if (!details) return false;

    this.#dnd.releaseIf(details);

    const form = details.querySelector<HTMLFormElement>("form.base-property");
    if (form) {
      this.#properties.get(form)?.abort();
      this.#properties.delete(form);
    }

    details.remove();
    return true;
  }

  /**
   * Lifecycle: tear down the drag channel (its own service controller), drop
   * every listener bound through this instance's AbortController, then hand
   * DOM/registry teardown to Builder.
   */
  public destroy(typeKey?: FormEditorElementType): void {
    this.#dnd.destroy();
    this.#abort.abort();
    super.destroy(typeKey);
  }
}