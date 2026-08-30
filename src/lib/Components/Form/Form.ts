import type { iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";
import { MessageBuilder, type iMessageContent } from "../Message/Message";
import { TableBuilder } from "../Table/Table";
import { FileUploader } from "./FileUploader";
import { type iCascadeEventDetail, type iCascadeState, FormCascadeHandler } from "./Handlers/Cascade";
import { IdAddressBuilder } from "./IdAddress/id-address-builder";
import { InputBuilder } from "./Input";

export type FormElementType =
  | "@container"
  | "@form"
  | "@form>group"
  | "@form>group>legend"
  | "@form>group>desc"
  | "@form>actions"
  | "@form>actions>submit"
  | "@form>actions>submit-group"
  | "@form>footer"
  | "@form>buttons-set";

export interface iFormConfig extends iBuilderConfig<FormElementType> {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  method?: "get" | "post";
  action?: string;
  className?: string;
  submitButton?: boolean;
  buttonText?: string;
  buttonClass?: string;
  resetOnSubmit?: boolean;
  resetOnComplete?: boolean;
  createEventListener?: boolean;
  minHeight?: string;
  multistep?: boolean;
  cascading?: boolean; // show or build input or group based on condition from input value before. it will looking "condition" property 
  onCascade?: null | ((detail: iCascadeEventDetail) => void); // listener kustom setiap kaskade mount/unmount/gate
  footer?: HTMLElement | string | null;
  onSubmit?: null | Function;
}

export class FormBuilder extends Builder<FormElementType, iFormConfig> {
  readonly builderId: keyof iBuilderRegistry = "form";
  readonly name: keyof iBuilderRegistry = "form";
  readonly stylesheet: string = "./Form.css";

  private submitButtonId: string | undefined = undefined;

  #inputs: any[] = [];

  // 🌊 Satu-satunya state cascade: form aktif + proxy nilai reaktif + flag batching.
  // Sisanya (placeholder & descriptor item tertahan) tetap hidup di Builder.#nodes.
  #cascadeState: iCascadeState | null = null;

  constructor(config: Partial<iFormConfig> = {}) {
    super();

    const defaultSelectors = {
      "@container": { tagName: "div", className: "form-widget-wrapper" },
      "@form": { tagName: "form", className: "native form" },
      "@form>group": { tagName: "fieldset", className: "form-group" },
      "@form>group>legend": { tagName: "legend", className: "group-title" },
      "@form>group>desc": { tagName: "p", className: "group-desc" },
      "@form>actions": { tagName: "div", className: "form-actions" },
      "@form>actions>submit": { tagName: "button", className: "submit", type: "submit" as "submit" },
      "@form>actions>submit-group": { tagName: "button", className: "submit", type: "button" as "button" },
      "@form>footer": { tagName: "div", className: "form-footer" },
      "@form>buttons-set": { tagName: "div", className: "buttons set" }
    };

    const defaultConfig: Required<iFormConfig> = {
      id: "",
      name: "",
      title: "",
      description: "",
      method: "post",
      action: "submit",
      className: "",
      submitButton: true,
      buttonText: "Submit",
      buttonClass: "",
      resetOnSubmit: false,
      resetOnComplete: true,
      createEventListener: true,
      minHeight: "400px",
      footer: null,
      themeId: "default",
      selectors: defaultSelectors,
      multistep: false,
      cascading: false,
      onCascade: null,
      namespace: null,
      emit: null,
      onSubmit: (_data: any) => { },
    };
    this.config = this.resolveConfig(defaultConfig, config);
  }

  /**
   * REFACTOR TOTAL: Merakit Form menggunakan struktur iBasicNode[] murni
   */
  public prepare(inputs: Array<any | HTMLElement | string> | any, _config: Partial<iFormConfig> = {}): HTMLElement {
    // Unwrap builder wrapper: { builder: "form", content: [...] } → [...fields]
    // console.log("FORMS", inputs)
    // console.log("config", _config)
    if (inputs && typeof inputs === "object" && !Array.isArray(inputs) && inputs.content !== undefined) {
      inputs = inputs.content;
    }
    this.#inputs = Array.isArray(inputs) ? inputs : [inputs];

    // 🌊 Reset satu-satunya saku state cascade (siklus hidup baru per prepare)
    this.#cascadeState = null;

    // const wrapper = this.render("@container", inputs);

    const form = this.render("@form", inputs) as HTMLFormElement;
    const formId = form.id;
    const isCascading = this.config.cascading === true;

    // Iterasi dan transformasikan setiap input secara murni
    for (const [index, input] of Object.entries(this.#inputs)) {

      if (input instanceof HTMLElement) {
        const btn = this.scanForSubmitButton(input, formId);
        if (btn) {
          this.submitButtonId = btn.id || this.submitButtonId;
          form.append(btn);
        } else {
          form.append(input);
        }
      }

      // ==========================================
      // KASUS B: Input berupa Raw HTML String
      // ==========================================
      else if (typeof input === "string") {
        const btn = this.scanForSubmitButton(input, formId);
        // console.log("founded!!!!!", foundId)
        if (btn) {
          this.submitButtonId = btn.id;
          form.appendChild(btn)
        } else {
          form.insertAdjacentHTML("beforeend", input as any);
        }
        // Masukkan langsung string HTML-nya agar di-parse alami oleh DOMRenderer
      }

      // ==========================================
      // KASUS C: Input berupa Group Node (<fieldset>)
      // ==========================================
      else if (input && typeof input === "object" && "group" in input) {
        // 🌊 CASCADE: group pembawa .condition ditahan — placeholder <template>
        // ditanam di posisinya, dibangun sungguhan saat kondisinya terpenuhi
        if (isCascading && FormCascadeHandler.isCascadeItem(input)) {
          this._handleCascade(form, "hold", { item: input, parent: form, path: String(index) });
          continue;
        }

        const fieldset = this.renderGroup(input, formId, isCascading ? String(index) : undefined);
        if (input.id) fieldset.id = input.id;
        if (input.className) fieldset.className = fieldset.className + " " + input.className;
        if (_config.multistep) {
          if (fieldset) {
            fieldset.dataset.index = index;
            if (Number(index) === 0) fieldset.classList.add("active")
          };
          const last = Number(index) === (this.#inputs.length - 1);
          const buttons = this.render("@form>buttons-set", { index, isLast: last, formId })!;
          fieldset.appendChild(buttons)
        }
        // console.log("group", fieldset, this.#inputs.length)
        form.appendChild(fieldset);
      }

      // ==========================================
      // KASUS D: Input berupa Parameter Objek Basic Tunggal
      // ==========================================
      else {
        // 🌊 CASCADE: input tunggal pembawa .condition juga ditahan seperti group
        if (isCascading && FormCascadeHandler.isCascadeItem(input)) {
          this._handleCascade(form, "hold", { item: input, parent: form, path: String(index) });
          continue;
        }

        // InputBuilder.prepare() mengelola isRoot dan melahirkan <div class="field"> murni
        const inputEl = new InputBuilder({ formId: formId } as any).create(input);
        form.append(inputEl as any);
      }

    };

    // 🌊 CASCADE: evaluasi kondisi awal (item bernilai preset bisa langsung lahir)
    if (isCascading) this._handleCascade(form, "sync");

    if (!this.submitButtonId && this.config.submitButton && !this.config.multistep) {
      const defaultSubmitBtn = this.render("@form>actions>submit", { isGroupBtn: false, formId }) as HTMLButtonElement;
      this.submitButtonId = defaultSubmitBtn.id;
      form.append(defaultSubmitBtn)
    }

    if (this.config.footer) {
      if (this.config.footer instanceof HTMLElement) {
        form.appendChild(this.config.footer);
      } else {
        const footerEl = this.render("@form>footer", this.config.footer) as HTMLElement;
        form.appendChild(footerEl);
      }
    }

    // if (wrapper && form) wrapper.appendChild(form);

    // console.log(form)
    return form as HTMLElement;
  }

  /**
   * Recursively renders a group (fieldset) and its child inputs or sub-groups.
   * Param `cascade` opsional: saat aktif, anak-anak group yang membawa `.condition`
   * ditahan ke registry kaskade alih-alih langsung dirender.
   */
  private renderGroup(groupInput: any, formId: string, cascadePath?: string): HTMLElement {
    const fieldset = this.render("@form>group", groupInput) as HTMLElement;

    const cascadeActive = this.config.cascading === true && cascadePath !== undefined;

    if (groupInput.group && Array.isArray(groupInput.group)) {
      groupInput.group.forEach((innerInput: any, _index: number) => {
        // console.log(hasTable, index)

        // 🌊 CASCADE: item anak pembawa .condition ditahan — placeholder <template>
        // ditanam di posisinya (terdaftar otomatis di #nodes) lalu rendering dilewati
        if (cascadeActive && FormCascadeHandler.isCascadeItem(innerInput)) {
          this._handleCascade(null, "hold", { item: innerInput, parent: fieldset, path: `${cascadePath}.group.${_index}` });
          return;
        }

        // Case 1: Raw HTML String
        if (typeof innerInput === "string") {
          const btn = this.scanForSubmitButton(innerInput, formId);
          // console.log("AAA", btn)
          if (btn) this.submitButtonId = btn.id;
          fieldset.insertAdjacentHTML("beforeend", innerInput as any);
          const s = fieldset.querySelector("[type='submit']")
          if (s) s.id = this.submitButtonId!;
        }
        // Case 2: Nested Group Object -> RECURSE!
        else if (innerInput && typeof innerInput === "object" && "group" in innerInput) {
          const nestedFieldset = this.renderGroup(innerInput, formId, cascadeActive ? `${cascadePath}.group.${_index}` : undefined);
          if (innerInput.id) nestedFieldset.id = innerInput.id;
          if (innerInput.table !== undefined) {
            console.log(innerInput.table.content)
            const groupSubmitBtn = this.render("@form>actions>submit-group", { isGroupBtn: false, groupId: innerInput.id }) as HTMLButtonElement;
            const table = new TableBuilder()
            const tableEl = table.create(innerInput.table.content)

            if (innerInput.table.id) tableEl.id = innerInput.table.id;

            groupSubmitBtn.onclick = (e) => {
              e.preventDefault();
              const is = (nestedFieldset as HTMLFieldSetElement).elements
              // console.log(is)
              const groupValues = [];
              for (const element of (is as any)) {
                if (!element) break;
                if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
                  if ((element as HTMLInputElement).checked) {
                    groupValues.push(element.value);
                  }
                } else {
                  groupValues.push((element as HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement).value);
                  // data[element.name] = element.value;
                }
              }
              table.addRow(groupValues as any[])
            }
            // console.log(tableEl)
            nestedFieldset.append(groupSubmitBtn, tableEl);
          }

          fieldset.appendChild(nestedFieldset);

        }
        // Case 3: Regular Input Item or DOM Element
        else {
          const inputEl = innerInput instanceof HTMLElement
            ? innerInput
            : new InputBuilder({ formId: formId } as any).create(innerInput);

          const btn = this.scanForSubmitButton(inputEl, formId);
          if (btn) this.submitButtonId = btn.id;

          fieldset.append(inputEl as any);
        }
      });
    }

    // Handle submit button per group level if specified
    if (groupInput.submitButton) {
      const submitBtn = this.render("@form>actions>submit", { isGroupBtn: true, formId }) as HTMLButtonElement;
      this.submitButtonId = submitBtn.id;
      fieldset.appendChild(submitBtn);
    }

    return fieldset;
  }

  // ==================================================================
  // 🌊 CASCADING ENGINE — seluruh fitur cascade dalam SATU method.
  // "hold"  : prepare menemukan item .condition → tanam placeholder <template>
  //           (otomatis terdaftar di Builder.#nodes via render(), payload =
  //           descriptor aslinya) tepat di posisi skema-nya sebagai anchor.
  // "bridge": semai nilai awal kontrol DOM ke state reaktif + kaitkan event
  //           input/change — setiap penulisan nilai memicu set-trap proxy.
  // "sync"  : evaluasi kondisi → tukar placeholder <-> elemen asli → gerbang
  //           multistep (disable next + pesan MessageBuilder).
  // ==================================================================
  private _handleCascade(
    form: HTMLFormElement | null,
    phase: "hold" | "sync" | "bridge",
    context?: { item: any; parent: HTMLElement; path: string }
  ): void {
    // Satu saku state untuk seluruh engine; dibuat malas pada pemanggilan pertama
    const state = (this.#cascadeState ??= { form: null as unknown as HTMLFormElement, values: null as unknown as Record<string, any>, queued: false, inputs: this.#inputs });
    if (!state.values) {
      state.values = this.setProxy("cascade", {}, () => {
        // Setiap penulisan nilai pada proxy memicu evaluasi — dibatch satu microtask
        if (!state.queued && state.form) {
          state.queued = true;
          queueMicrotask(() => {
            state.queued = false;
            this._handleCascade(state.form, "sync");
          });
        }
      });
    }

    // ---- HOLD: tahan item berkondisi; placeholder <template> mengisi posisinya
    if (phase === "hold" && context) {
      const key = `cascade:${context.path}`;
      (this.config.selectors as any)[key] = { tagName: "template" };
      const placeholder = this.render(key as FormElementType, context.item) as HTMLElement;
      placeholder.dataset.cascade = context.path;
      context.parent.appendChild(placeholder);
      return;
    }

    if (!form) return;
    state.form = form;

    const emit = (action: iCascadeEventDetail["action"], element: HTMLElement | null, item: any, path: string) => {
      const detail: iCascadeEventDetail = {
        action,
        key: path,
        element,
        descriptor: item ?? null,
        condition: FormCascadeHandler.normalizeCondition(item?.condition ?? {}),
        state: { ...state.values }
      };
      if (typeof this.config.onCascade === "function") {
        try { this.config.onCascade(detail); } catch (error) { console.warn("[Form Cascade] onCascade listener error:", error); }
      }
      if (typeof this.config.emit === "function") {
        try { this.config.emit("elementChanged", { builder: this.builderId, type: "@form", element, data: detail }); } catch { /* emit opsional */ }
      }
      form.dispatchEvent(new CustomEvent("formCascade", { bubbles: true, detail }));
    };

    // ---- BRIDGE: semai nilai awal kontrol DOM, lalu dengarkan perubahan user
    if (phase === "bridge") {
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[name], select[name], textarea[name]")
        .forEach((el) => { state.values[el.name || el.id] = FormCascadeHandler.readControlValue(form, el); });
      const onValueChange = (event: Event) => {
        const target = event.target as HTMLInputElement | null;
        if (target && (target.name || target.id)) state.values[target.name || target.id] = FormCascadeHandler.readControlValue(form, target);
      };
      form.addEventListener("input", onValueChange);
      form.addEventListener("change", onValueChange);
    }

    // ---- SYNC: evaluasi kondisi, tukar placeholder <-> elemen, lalu gerbang multistep
    const resolve = (field: string) => FormCascadeHandler.resolveFieldValue(state, field);
    const mount = (item: any, path: string, placeholder: HTMLElement): HTMLElement | null => {
      let el: HTMLElement | null = null;
      if (item && typeof item === "object" && "group" in item) {
        el = this.renderGroup(item, form.id, path);
        if (el) {
          if (item.id) el.id = item.id;
          if (item.className) el.className = `${el.className} ${item.className}`.trim();
          // Multistep: step yang baru lahir tetap butuh nomor langkah + tombol navigasi
          if (this.config.multistep && !path.includes(".")) {
            el.dataset.index = path;
            const buttons = this.render("@form>buttons-set", { index: Number(path), isLast: Number(path) === this.#inputs.length - 1, formId: form.id });
            if (buttons) el.appendChild(buttons);
          }
        }
      } else {
        el = new InputBuilder({ formId: form.id } as any).create(item) as HTMLElement;
      }
      if (!el) return null;
      el.dataset.cascade = path;
      placeholder.replaceWith(el);
      return el;
    };

    let changed = false;
    let pass = 0;
    do {
      changed = false;
      FormCascadeHandler.walkInputs(state.inputs, "", (item, path) => {
        if (!FormCascadeHandler.isCascadeItem(item)) return; // bukan kandidat → terus turuni anak-anaknya
        const placeholder = this.load(`cascade:${path}` as FormElementType);
        if (!(placeholder instanceof HTMLElement)) return false; // group di atasnya masih ditahan
        const mounted = form.querySelector<HTMLElement>(`[data-cascade="${CSS.escape(path)}"]:not(template)`);
        if (FormCascadeHandler.conditionMet(FormCascadeHandler.normalizeCondition(item.condition), resolve, state.values)) {
          if (!mounted) {
            const el = mount(item, path, placeholder);
            if (el) { changed = true; emit("mount", el, item, path); }
          }
        } else if (mounted) {
          mounted.replaceWith(placeholder);
          changed = true;
          emit("unmount", mounted, item, path);
        }
        return Boolean(mounted); // group kaskade dituruni hanya saat sedang terpasang
      });
      pass++;
    } while (changed && pass < 10); // ulang sebentar untuk kaskade berantai

    // Gerbang multistep: kunci tombol next bila langkah berikutnya masih ditahan kondisi
    if (this.config.multistep) {
      form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-index]").forEach((fieldset) => {
        const nextButton = fieldset.querySelector<HTMLButtonElement>(".buttons.set > button.next");
        if (!nextButton) return;
        const nextPath = String(Number(fieldset.dataset.index) + 1);
        const nextItem = this.#inputs[Number(nextPath)];
        const nextHeld = this.load(`cascade:${nextPath}` as FormElementType) instanceof HTMLElement;
        const nextMounted = form.querySelector(`[data-cascade="${CSS.escape(nextPath)}"]:not(template)`);
        const blocked = nextHeld && !nextMounted && FormCascadeHandler.isCascadeItem(nextItem) &&
          !FormCascadeHandler.conditionMet(FormCascadeHandler.normalizeCondition(nextItem.condition), resolve, state.values);

        if (blocked) {
          const guidance = FormCascadeHandler.describeBlock(nextItem);
          nextButton.disabled = true;
          nextButton.title = guidance;
          if (!nextButton.hasAttribute("data-cascade-blocked")) { // atribut = penanda transisi, pesan tak diulang
            nextButton.setAttribute("data-cascade-blocked", "");
            FormCascadeHandler.showGateMessage(form, guidance);
            emit("blocked", nextButton, nextItem, nextPath);
          }
        } else if (nextButton.hasAttribute("data-cascade-blocked")) {
          nextButton.disabled = false;
          nextButton.removeAttribute("data-cascade-blocked");
          nextButton.removeAttribute("title");
          emit("unblocked", nextButton, nextItem, nextPath);
        }
      });
    }
  }

  /** Set nilai field secara programatik — memantik evaluasi kaskade lewat proxy reaktif */
  public setCascadeValue(field: string, value: any): void {
    const state = this.#cascadeState;
    if (state?.values) state.values[String(field)] = value;
  }

  public initialize(formElement: HTMLFormElement): void {
    if (formElement && this.config.createEventListener) {
      this.attachFormListener(formElement);
    }

    // 🌊 CASCADE BRIDGE: semai nilai DOM ke proxy reaktif + evaluasi kondisi awal
    if (formElement && this.config.cascading) {
      this._handleCascade(formElement, "bridge");
    }

    // console.log(`[Form Engine v2] Form ID "${formElement?.id}" successfully compiled with active listeners.`);
  }


  protected template(typeKey: FormElementType, el: HTMLElement, payload?: any): void {
    switch (typeKey) {
      case "@container":
        el.style.minHeight = this.config.minHeight;
        break;

      case "@form": {
        // console.log(this.config)
        const form = el as HTMLFormElement;
        const randomSuffix = Math.random().toString(36).substring(7);
        form.id = this.config.id ? `form-${this.config.id}`.replace(/\s+/g, "-") : `form-${randomSuffix}`;
        form.className = `${this.config.className} ${this.config.multistep ? "multistep" : ""} ${form.className || ""}`.trim();
        form.method = this.config.method;
        if (this.config.action) form.action = this.config.action;
        break;
      }

      case "@form>group": {
        if (payload?.class) el.className = `${el.className} ${payload.class}`.trim();

        const legendText = payload?.legend || payload?.title;
        if (legendText) {
          const legend = document.createElement("legend"); // Element internal pendukung kaku
          legend.className = "group-title";
          legend.textContent = String(legendText);
          el.appendChild(legend);
        }

        if (payload?.description) {
          const desc = document.createElement("p");
          desc.className = "group-desc";
          desc.textContent = String(payload.description);
          el.appendChild(desc);
        }
        break;
      }

      case "@form>actions>submit": {
        const btn = el as HTMLButtonElement;
        btn.className = `${this.config.buttonClass} ${btn.className || ""}`.trim();
        btn.type = "submit";
        btn.textContent = this.config.buttonText;

        const sIcon = document.createElement("i");
        sIcon.className = "icon checkmark";
        btn.appendChild(sIcon)

        if (payload?.isGroupBtn) {
          btn.id = payload.formId ? `btn-${payload.formId}` : `btn-group-${Math.random().toString(36).substring(7)}`;
        } else {
          btn.id = `btn-${payload?.formId || "default"}`;
          // btn.style.marginTop = "1rem";
          // btn.style.padding = "1rem";
          // btn.style.float = "right";
        }
        break;
      }

      case "@form>actions>submit-group": {
        const btn = el as HTMLButtonElement;
        btn.className = `${this.config.buttonClass} ${btn.className || ""}`.trim();
        btn.type = "button";
        btn.textContent = "Submit Item";

        const sIcon = document.createElement("i");
        sIcon.className = "icon checkmark";
        btn.appendChild(sIcon)

        if (payload?.isGroupBtn) {
          btn.id = payload.groupId ? `btn-${payload.groupId}` : `btn-group-${Math.random().toString(36).substring(7)}`;
        } else {
          btn.id = `btn-${payload?.groupId || "default"}`;
          // btn.style.marginTop = "1rem";
          // btn.style.padding = "1rem";
          // btn.style.float = "right";
        }
        break;
      }

      case "@form>buttons-set": {

        const next = document.createElement("button");
        next.className = "next"
        next.type = "button";
        const nIcon = document.createElement("i");
        nIcon.className = "icon arrow right";
        next.textContent = "next";
        next.appendChild(nIcon);

        const back = document.createElement("button");
        back.className = "back"
        back.type = "button";
        const bIcon = document.createElement("i");
        bIcon.className = "icon arrow left";
        back.textContent = "back";
        back.prepend(bIcon);
        // console.log({ payload })
        if (Number(payload.index) === 0) {
          el.append(next);
        } else if (payload.isLast) {
          const submit = this.render("@form>actions>submit") as HTMLButtonElement;
          el.append(back, submit)
        } else {
          el.append(back, next)
        }
        break;
      }

      case "@form>footer":
        el.textContent = typeof payload === "string" ? payload : (payload?.text || "");
        break;
    }
  }


  public unmount(): void {
    this.#cascadeState = null;
    this.destroy(); // Bersihkan saku memori Map privat!
  }

  private _handleMultiStep(form: HTMLFormElement): void {
    let currentStep = 0;

    // Fieldset di-query ulang setiap saat — langkah hasil kaskade bisa lahir
    // kapan saja di tengah perjalanan (fieldset[data-index] hanya milik step utama).
    const getSteps = (): HTMLFieldSetElement[] =>
      Array.from(form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-index]"))
        .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));

    // Fungsi untuk memperbarui tampilan step
    function showStep(stepIndex: number) {
      const steps = getSteps();
      for (const fieldset of steps) {
        const currentIndex = Number(fieldset.dataset.index)
        if (currentIndex === stepIndex) {
          fieldset.classList.add("active");
          const position = steps.indexOf(fieldset);
          if (position < steps.length - 1) steps[position + 1].setAttribute("animate", "next");
          if (position > 0) steps[position - 1].setAttribute("animate", "back")
        } else {
          fieldset.classList.remove("active");
        }
      }
    }

    // Inisialisasi: Tampilkan step pertama (index 0)
    showStep(currentStep);

    // Delegasi klik di level form — tombol next/back milik step hasil kaskade
    // yang baru lahir otomatis ikut tertangkap tanpa perlu re-bind manual.
    form.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button") as HTMLButtonElement | null;
      if (!button || !button.closest(".buttons.set")) return;
      const isNext = button.classList.contains("next");
      const isBack = button.classList.contains("back");
      if (!isNext && !isBack) return;

      event.preventDefault();

      if (isNext) {
        const steps = getSteps();
        const currentFieldset = steps.find((fieldset) => Number(fieldset.dataset.index) === currentStep);
        if (currentFieldset && !currentFieldset.checkValidity()) {
          currentFieldset.reportValidity();
          return;
        }

        // Maju hanya jika step berikutnya memang sudah ada di DOM
        const nextFieldset = steps.find((fieldset) => Number(fieldset.dataset.index) === currentStep + 1);
        if (nextFieldset) {
          currentStep++;
          showStep(currentStep);
        }
      } else if (currentStep > 0) {
        const steps = getSteps();
        const previousFieldset = steps.filter((fieldset) => Number(fieldset.dataset.index) < currentStep).pop();
        if (previousFieldset) {
          currentStep = Number(previousFieldset.dataset.index);
          showStep(currentStep);
        }
      }
    });
  }
  /**
   * Logika Listener asinkronus (FileUploader, Event submit, CustomEvent) tetap aman terisolasi di sini
   */

  /* 
  * // TODO 
  * // Tambahkan baris evakuasi ini di dalam CustomEvent formSubmit Anda:
  * detail: {
  *   formId: form.id,
  *   data: dataWithFiles,
  *   complete: (success: boolean, messageConfig: any, resetForm: boolean) => {
  *     toggleLoadingState(success);
  *     this.createMessage(form, success, messageConfig);
  *     if (resetForm || this.config.resetOnComplete) {
  *       form.reset();
  *       if (IdAddress && typeof IdAddress.destroy === "function") IdAddress.destroy();
  *       if (table && typeof table.destroy === "function") table.destroy();
  *     }
  *   },
  *   // Ketika fungsi reset dipanggil dari luar (misal saat unmount komponen)
  *   reset: () => {
  *     form.reset();
  *     if (IdAddress && typeof IdAddress.destroy === "function") IdAddress.destroy();
  *     if (table && typeof table.destroy === "function") table.destroy();
  *     
  *     // Laporkan ke Service Worker untuk hanguskan token secara instan demi keamanan multi-user
  *     if (navigator.serviceWorker.controller) {
  *       navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_TOKEN' });
  *     }
  *   }
  * }
  * 
  */
  private attachFormListener(form: HTMLFormElement): void {
    // console.log("Form Listeners Attached")
    let table: any = null;
    let IdAddress = null;
    if (typeof FileUploader !== "undefined" && typeof FileUploader.initAll === "function") {
      FileUploader.initAll(form);
      const csvInput = form.querySelector("input[type='file'][data-uploader-csv]");
      csvInput?.addEventListener("change", async (_e: any) => {
        // 1. Cari dan hapus tabel lama terlebih dahulu jika sudah ada (supaya tidak menumpuk)
        const existingTable = form.querySelector('.table-container');
        if (existingTable) {
          existingTable.remove();
        }

        // 3. Jika file ada, lanjutkan proses pembuatan tabel seperti biasa
        const tableData = await FileUploader.parseCSVToTable(form.id);

        if (TableBuilder !== undefined && typeof TableBuilder === "function") {
          table = new TableBuilder({
            renderAsCard: false,
            autoFreezeAt: 1
          })

          // 2. Cek apakah file kosong (artinya pengguna me-remove file)
          if (!(csvInput as HTMLInputElement).files || (csvInput as HTMLInputElement).files?.length === 0) {
            table.destroy();
            return; // Berhenti di sini, jangan buat tabel baru
          }

          // 4. Tambahkan class penanda agar mudah dicari dan dihapus nanti
          const tableEl = table.create(tableData);

          (csvInput.parentElement as HTMLElement)?.insertAdjacentElement('afterend', tableEl);
        }

      });
    }

    if (form.querySelectorAll("[data-level]").length > 1) {
      const DEPLOYMENT_ID = "AKfycbwjQ_iNQClJuyf5z1ZlJcJ-j6LEnINfvbBmjBFlE4T3X4dVAoxF_GzUCCv6TXZ_apfhpA";
      const API_URL = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;
      IdAddress = new IdAddressBuilder({
        container: form,
        url: API_URL,
        geocode: false,
      });
      IdAddress.init()
    }

    const toggleLoadingState = (success: boolean) => {
      form.classList.remove("loading");
      form.querySelectorAll(".field").forEach((f) => f.classList.remove("error"));
      if (!success) {
        form.querySelectorAll(".field").forEach((f) => f.classList.add("error"));
      }
    };

    if (this.config.multistep) this._handleMultiStep(form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      form.classList.add("loading");
      const formData = new FormData(form);
      const data = Object.fromEntries(formData as any);

      let files = {};
      if (typeof FileUploader !== "undefined" && typeof FileUploader.getFilesForGoogleDrive === "function") {
        files = await FileUploader.getFilesForGoogleDrive(form.id);
      }
      // if (typeof FileUploader !== "undefined" && typeof FileUploader.getFiles === "function") {
      //   files = await FileUploader.getFiles(form.id);
      // }
      if (IdAddress && IdAddress.detail) {
        // console.log("detail:", IdAddress.detail)
        Object.keys(IdAddress.detail).forEach((inputKey) => {
          if (inputKey.endsWith("_name")) {
            const outputKey = inputKey.replace("_name", "");
            if (outputKey in data) {
              data[outputKey] = String((IdAddress.detail as any)[inputKey]).toLowerCase();
            }
          }
        });
      }

      const dataWithFiles = Object.keys(files).length > 0 ? Object.assign({}, data, files) : data;
      if (table) dataWithFiles.product = table.toJson();
      console.log({ dataWithFiles })
      form.dispatchEvent(
        new CustomEvent("formSubmit", {
          bubbles: true,
          detail: {
            formId: form.id,
            data: dataWithFiles,
            complete: (success: boolean, messageConfig: any, resetForm: boolean) => {

              toggleLoadingState(success);
              this.createMessage(form, success, messageConfig);
              if (resetForm || this.config.resetOnComplete) form.reset();
            },
            reset: () => form.reset()
          }
        }));
    });

    if (this.submitButtonId) {
      const button = this.load("@form>actions>submit") as HTMLButtonElement;

      if (button) {
        button.addEventListener("click", (e) => {
          e.preventDefault();
          form.requestSubmit(button);
        });
      }
    }

  }

  private createMessage(form: HTMLFormElement, success: boolean, messageConfig: iMessageContent) {
    // Jika server atau router mengirimkan konfigurasi konten pesan status
    if (messageConfig && typeof MessageBuilder !== "undefined") {

      // Lahirkan notifikasi instan menggunakan engine terisolasi Anda!
      // Target kontainer diset dinamis menempel di atas form, atau default body jika kosong
      const toast = new MessageBuilder({
        id: `msg-${form.id}`, // Id unik berbasis form agar anti-menumpuk kembung
        element: form,        // Selipkan pesan tepat di lantai teratas boks form terkait
        duration: success ? 4000 : 6000 // Beri waktu membaca lebih lama jika status error
      });

      // Memicu kompilasi DOM 5-Fase secara otonom
      toast.prepare({
        header: messageConfig.header || (success ? "Operasi Sukses!" : "Terjadi Kendala"),
        message: messageConfig.message || "Data Anda telah diproses oleh orkestrator.",
        type: messageConfig.type || (success ? "success" : "error"),
        icon: messageConfig.icon || (success ? "checkmark circle icon" : "icon error")
      });

      // Amankan fungsi interaktivitas click silang internal tombol close
      toast.initialize();
    } else {
      return;
    }
  }


  /**
   * Helper internal untuk memindai string HTML mentah atau element hidup 
   * guna mencari tombol submit yang sudah ada (untuk link ID)
   */
  private scanForSubmitButton(input: any, formId: string): HTMLButtonElement | null {
    if (!input) return null;
    let btn: HTMLButtonElement | null = null;

    if (input instanceof HTMLButtonElement) {
      btn = input.type === "submit" ? input : input.querySelector("button[type=submit], input[type=submit]");
    } else if (typeof input === "string") {
      console.log("found string submit button")
      const wrapper = document.createElement("div");
      wrapper.insertAdjacentHTML("beforeend", input.trim());
      btn = wrapper.querySelector("button[type=submit], input[type=submit]");
    }

    if (btn) {
      if (!btn.id) btn.id = `btn-${formId}`;
      btn.setAttribute("form", formId);
      return btn;
    }
    return null;
  }
}


