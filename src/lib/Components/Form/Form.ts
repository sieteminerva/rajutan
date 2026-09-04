import type { iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";
import { MessageBuilder, type iMessageContent } from "../Message/Message";
import { TableBuilder } from "../Table/Table";
import { FileUploader } from "./FileUploader";
import { FormCascade, type FormCascadeHost, type iCascadeEventDetail, FormCascadeHandler } from "./Handlers/Cascade";
import { FormMultistepHandler, type FormMultistepHost } from "./Handlers/Multistep";
import { IdAddressBuilder } from "./IdAddress/id-address-builder";
import { InputBuilder } from "./Input";
import "./Dropdown.css";
import "./inputControls.css";

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
  autoDisableNextStep?: boolean
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

  // 🌊 Engine kaskade: seluruh logika mount/unmount/gate hidup di Cascade.ts.
  // Form hanya berperan sebagai host (renderGroup, buttons-set, config).
  #cascade: FormCascade | null = null;

  // 🪜 Engine multistep: langkah ditahan sebagai placeholder dan baru
  // dilahirkan ke DOM saat tombol Next/Back menekannya (Multistep.ts).
  #multistep: FormMultistepHandler | null = null;

  // Inisialisasi komponen (uploader, IdAddress, dsb.) untuk step yang baru
  // lahir — engine memanggil ini lewat host hook onStepMount.
  #onStepMounted: ((fieldset: HTMLElement) => void) | null = null;

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
      autoDisableNextStep: false, // null = ikuti cascading && multistep
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

    // 🌊 Reset engine kaskade (siklus hidup baru per prepare)
    this.#cascade = null;
    this.#multistep = null;
    this.#onStepMounted = null;

    // const wrapper = this.render("@container", inputs);

    const form = this.render("@form", inputs) as HTMLFormElement;
    const formId = form.id;
    const isCascading = this.config.cascading === true;
    // 🌊 Engine kaskade dibangun bila cascading aktif — ATAU bila gerbang
    // next diminta eksplisit (autoDisableNextStep:true, mis. untuk kondisi眼
    // manual pada group schema tanpa cascading), agar gate() tetap berjalan.

    if (isCascading || this.config.autoDisableNextStep === true) this.#cascade = new FormCascade(this._buildCascadeHost());
    if (this.config.multistep) this.#multistep = new FormMultistepHandler(this._buildMultistepHost());

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
          this.#cascade?.hold(form, String(index));
          continue;
        }

        // 🪜 MULTISTEP: group pembawa langkah DITAHAN — placeholder <template>
        // ditanam di posisinya; fieldset sungguhan baru dibangun saat tombol
        // Next/Back menekannya (lihat FormMultistepHandler._mount).
        if (_config.multistep) {
          this.#multistep?.hold(form, Number(index), input);
          continue;
        }

        const fieldset = this.renderGroup(input, formId, isCascading ? String(index) : undefined);
        if (input.id) fieldset.id = input.id;
        if (input.className) fieldset.className = fieldset.className + " " + input.className;
        // console.log("group", fieldset, this.#inputs.length)
        form.appendChild(fieldset);
      }

      // ==========================================
      // KASUS D: Input berupa Parameter Objek Basic Tunggal
      // ==========================================
      else {
        // 🌊 CASCADE: input tunggal pembawa .condition juga ditahan seperti group
        if (isCascading && FormCascadeHandler.isCascadeItem(input)) {
          this.#cascade?.hold(form, String(index));
          continue;
        }

        // InputBuilder.prepare() mengelola isRoot dan melahirkan <div class="field"> murni
        const inputEl = new InputBuilder({ formId: formId } as any).create(input);
        form.append(inputEl as any);
      }

    };

    // 🌊 CASCADE: aktifkan engine — delegasi input/change, evaluasi kondisi awal,
    // dan gerbang tombol next langsung diset di sini. (Engine yang dibuat khusus
    // untuk autoDisableNextStep juga di-attach — tanpa attach, gate() tak pernah jalan.)
    if (isCascading || this.config.autoDisableNextStep === true) this.#cascade?.attach(form);

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
          this.#cascade?.hold(fieldset, `${cascadePath}.group.${_index}`);
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
  // 🌊 HOST CASCADE — Form hanya menyediakan "tangan" ke engine (Cascade.ts):
  // renderGroup untuk membangun fieldset, render buttons-set untuk step
  // multistep, dan refreshSteps untuk memperbaiki langkah aktif bila sebuah
  // step di-unmount oleh kaskade. Evaluasi/mount/unmount/gate ada di engine.
  // ==================================================================
  private _buildCascadeHost(): FormCascadeHost {
    return {
      builder: this.builderId,
      inputs: this.#inputs,
      multistep: this.config.multistep === true,
      // Gerbang next: null/undefined = ikuti cascading; true = paksa kunci;
      // false = nonaktif. (Lihat iFormConfig.autoDisableNextStep)
      autoDisableNextStep: this.config.autoDisableNextStep ?? (this.config.cascading === true && this.config.multistep === true),
      onCascade: typeof this.config.onCascade === "function" ? this.config.onCascade : null,
      emit: typeof this.config.emit === "function" ? this.config.emit : null,
      renderGroup: (group, formId, path) => this.renderGroup(group, formId, path),
      refreshSteps: (form) => this.#multistep?.refresh(form),
    };
  }

  // ==================================================================
  // 🪜 HOST MULTISTEP — Form hanya menyediakan "tangan" ke engine
  // (Multistep.ts): renderGroup untuk melahirkan fieldset langkah saat
  // tombol Next/Back menekannya, dan render buttons-set untuk navigasi.
  // Penomoran langkah, status .active, dan gerbang validasi ada di engine.
  // ==================================================================
  private _buildMultistepHost(): FormMultistepHost {
    return {
      builder: this.builderId,
      inputs: this.#inputs,
      renderGroup: (group, formId, path) => this.renderGroup(group, formId, path),
      renderButtonsSet: (payload) => this.render("@form>buttons-set", payload)!,
      onStepMount: (fieldset) => this.#onStepMounted?.(fieldset),
      // 🌊 Setiap perpindahan langkah melahirkan set tombol navigasi yang baru —
      // engine kaskade perlu menilai ulang gerbang next yang baru tersebut.
      onStepChange: () => this.#cascade?.gate(),
    };
  }

  /** Set nilai field secara programatik — engine memantik evaluasi via event change */
  public setCascadeValue(field: string, value: any): void {
    this.#cascade?.setValue(field, value);
  }
  /**
   * 🪜 Multistep: posisi langkah aktif, gerbang validasi, dan pelahirkan
   * fieldset langkah kini sepenuhnya dikelola engine FormMultistepHandler
   * (Handlers/Multistep.ts) — lihat _buildMultistepHost().
   */

  public initialize(formElement: HTMLFormElement): void {
    if (formElement && this.config.createEventListener) {
      this.attachFormListener(formElement);
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

        if (payload?.infos) {
          const list = document.createElement("ul");
          list.className = "group-infos";
          if (Array.isArray(payload.infos)) {
            for (const i of payload.infos) {
              const item = document.createElement("li")
              item.className = "item"
              item.textContent = String(i);
              list.appendChild(item);
            }
          }
          el.appendChild(list);
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
    this.#cascade?.dispose(); // Lepas listener delegasi + placeholder engine
    this.#cascade = null;
    this.#multistep?.dispose(); // Lepas listener delegasi + langkah tertahan
    this.#multistep = null;
    this.#onStepMounted = null;
    this.destroy();
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
    let IdAddress: any = null;
    // 🪜 Uploader dihidupkan MALAS dan IDEMPOTEN: FileUploader.initAll melewati
    // input yang sudah bertanda data-uploader-initialized, jadi aman dipanggil
    // berulang. Form biasa dihidupkan sekali di ekor metode ini (semua input
    // sudah ada di DOM sejak prepare); setiap step lazy multistep yang baru
    // lahir dihidupkan ulang lewat onStepMount di bawah.
    const ensureUploaders = (root: HTMLElement): void => {
      if (typeof FileUploader === "undefined" || typeof FileUploader.initAll !== "function") return;
      try { FileUploader.initAll(root); } catch (error) { console.warn("[Form] file uploader init failed:", error); }
    };

    if (typeof FileUploader !== "undefined" && typeof FileUploader.initAll === "function") {
      // Delegasi di level form — input file CSV dari step kaskade yang baru
      // lahir (ecommerce/gallery) ikut membangun tabel, bukan hanya yang awal.
      form.addEventListener("change", async (event: Event) => {
        const csvInput = (event.target as HTMLElement)?.closest?.("input[type='file'][data-uploader-csv]") as HTMLInputElement | null;
        if (!csvInput || !form.contains(csvInput)) return;

        // 1. Hapus tabel lama terlebih dahulu jika sudah ada (supaya tidak menumpuk)
        const existingTable = form.querySelector(".table-container");
        if (existingTable) existingTable.remove();

        // 2. File dihapus pengguna → jangan buat tabel baru
        if (!csvInput.files || csvInput.files.length === 0) {
          if (table && typeof table.destroy === "function") table.destroy();
          table = null;
          return;
        }

        // 3. Bangun tabel dari CSV yang baru dipilih
        const tableData = await FileUploader.parseCSVToTable(form.id);
        if (TableBuilder !== undefined && typeof TableBuilder === "function") {
          table = new TableBuilder({
            renderAsCard: false,
            autoFreezeAt: 0
          });

          const tableEl = table.create(tableData);
          (csvInput.parentElement as HTMLElement)?.insertAdjacentElement("afterend", tableEl);
        }
      });
    }

    // 🪜 IdAddress dibangun MALAS: pada form multistep, field [data-level] bisa
    // berada di step yang belum lahir (lazy mount) — pemeriksaan DOM saat init
    // belum tentu menemukannya. Cek ulang setiap kali sebuah step lahir.
    const ensureIdAddress = (): any => {
      if (IdAddress) return IdAddress;
      if (form.querySelectorAll("[data-level]").length <= 1) return null;
      const DEPLOYMENT_ID = "AKfycbwjQ_iNQClJuyf5z1ZlJcJ-j6LEnINfvbBmjBFlE4T3X4dVAoxF_GzUCCv6TXZ_apfhpA";
      const API_URL = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;
      IdAddress = new IdAddressBuilder({
        container: form,
        url: API_URL,
        geocode: false,
      });
      IdAddress.init();
      return IdAddress;
    };

    const toggleLoadingState = (success: boolean) => {
      form.classList.remove("loading");
      form.querySelectorAll(".field").forEach((f) => f.classList.remove("error"));
      if (!success) {
        form.querySelectorAll(".field").forEach((f) => f.classList.add("error"));
      }
    };

    // 🪜 Multistep: engine melahirkan langkah awal + memasang delegasi next/back.
    // Setiap fieldset step yang lahir (termasuk step 0) dihidupkan uploader-nya
    // dan memicu IdAddress bila [data-level] kini ada.
    this.#onStepMounted = (fieldset: HTMLElement) => {
      ensureUploaders(fieldset);
      ensureIdAddress();
      // 🌊 Kaskade: langkah yang baru lahir membawa placeholder anak
      // ber-condition (ditahan saat renderGroup) — evaluasi segera agar
      // yang kondisinya sudah terpenuhi langsung lahir, tanpa menunggu
      // event input/change berikutnya.
      this.#cascade?.sync();
    };
    this.#multistep?.attach(form);

    // 🪜 Form biasa (non-multistep): seluruh input sudah berada di DOM sejak
    // prepare — hidupkan uploader & IdAddress sekali di sini. Pada form
    // multistep, langkah masih tertahan sebagai <template> (tak terlihat
    // querySelector) sehingga pemindaian ini no-op; penggantinya adalah
    // onStepMount di atas yang mengiringi tiap kelahiran langkah.
    ensureUploaders(form);
    ensureIdAddress();

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
              // TODO reset / destroy table & idAddress if available
              toggleLoadingState(success);
              this.createMessage(form, success, messageConfig);
              if (resetForm || this.config.resetOnComplete) form.reset();
            },
            reset: () => form.reset()
          }
        }));
    });

    // Delegasi klik submit di level form — tombol submit yang lahir setelah
    // initialize (dari step kaskade) tetap hidup, tak perlu re-bind manual.
    form.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement)?.closest?.("button[type=submit], input[type=submit]") as HTMLButtonElement | null;
      if (!button) return;
      if (!form.contains(button) && button.getAttribute("form") !== form.id) return;
      event.preventDefault();
      form.requestSubmit(button);
    });

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


