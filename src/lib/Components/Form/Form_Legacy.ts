import type { iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";
import { MessageBuilder } from "../Message/Message";
import { TableBuilder } from "../Table/Table";
import { FileUploader } from "./FileUploader";
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
  cascading?: boolean; // shpw input or group based on condition from input value before it and will looking "condition"
  footer?: HTMLElement | string | null;
  onSubmit?: null | Function;
}

export class FormBuilder extends Builder<FormElementType, iFormConfig> {
  readonly builderId: keyof iBuilderRegistry = "form";
  readonly name: keyof iBuilderRegistry = "form";
  readonly stylesheet: string = "./Form.css";

  private submitButtonId: string | undefined = undefined;

  #inputs: any[] = [];

  constructor(config: Partial<iFormConfig> = {}) {
    super();

    const defaultSelectors = {
      "@container": { tagName: "div", className: "form-widget-wrapper" },
      "@form": { tagName: "form", className: "native form" },
      "@form>group": { tagName: "fieldset", className: "form-group" },
      "@form>group>legend": { tagName: "legend", className: "group-title" },
      "@form>group>desc": { tagName: "p", className: "group-desc" },
      "@form>actions": { tagName: "div", className: "form-actions" },
      "@form>actions>submit": { tagName: "button", className: "button primary", type: "submit" as "submit" },
      "@form>actions>submit-group": { tagName: "button", className: "button primary", type: "button" as "button" },
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
      buttonClass: "button primary",
      resetOnSubmit: false,
      resetOnComplete: true,
      createEventListener: true,
      minHeight: "400px",
      footer: null,
      themeId: "default",
      selectors: defaultSelectors,
      multistep: false,
      cascading: false,
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

    // const wrapper = this.render("@container", inputs);

    const form = this.render("@form", inputs) as HTMLFormElement;
    const formId = form.id;

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
        const fieldset = this.renderGroup(input, formId);
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
        // InputBuilder.prepare() mengelola isRoot dan melahirkan <div class="field"> murni
        const inputEl = new InputBuilder({ formId: formId } as any).create(input);
        // if (this.config.submitButton) {
        //   const btn = this.scanForSubmitButton(inputEl, formId)
        //   if (btn) {
        //     this.submitButtonId = btn.id || this.submitButtonId
        //     form.append(btn);
        //   };
        // }

        form.append(inputEl as any);
      }

    };

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
   */
  private renderGroup(groupInput: any, formId: string): HTMLElement {
    const fieldset = this.render("@form>group", groupInput) as HTMLElement;

    if (groupInput.group && Array.isArray(groupInput.group)) {
      groupInput.group.forEach((innerInput: any, _index: number) => {
        // console.log(hasTable, index)

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
          const nestedFieldset = this.renderGroup(innerInput, formId);
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
        break;
      }

      case "@form>actions>submit": {
        const btn = el as HTMLButtonElement;
        btn.className = `${this.config.buttonClass} ${btn.className || ""}`.trim();
        btn.type = "submit";
        btn.textContent = this.config.buttonText;

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
          submit.id = "btn-" + payload.formId
          submit.className = "submit";
          const sIcon = document.createElement("i");
          sIcon.className = "icon checkmark";
          submit.appendChild(sIcon)
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
    // Jalankan ritual pencabutan listener kustom jika disematkan esok sore
    this.destroy(); // Bersihkan saku memori Map privat!
  }

  private _handleMultiStep(form: HTMLFormElement): void {
    const fieldsets = Array.from(form.querySelectorAll("fieldset"));
    let currentStep = 0;

    // Fungsi untuk memperbarui tampilan step
    function showStep(stepIndex: number) {
      for (const fieldset of fieldsets) {
        const currentIndex = Number(fieldset.dataset.index)
        if (currentIndex === stepIndex) {
          fieldset.classList.add("active");
          if (currentIndex < (fieldsets.length - 1)) fieldsets[currentIndex + 1].setAttribute("animate", "next");
          if (currentIndex > 0) fieldsets[currentIndex - 1].setAttribute("animate", "back")
        } else {
          fieldset.classList.remove("active");
        }

      }
    }

    // Inisialisasi: Tampilkan step pertama (index 0)
    showStep(currentStep);

    // Listener hanya dipasang pada tombol navigasi yang dibuat oleh
    // FormBuilder. Tombol dari widget lain di dalam form tidak ikut tertangkap.
    form.querySelectorAll<HTMLButtonElement>(".buttons.set > .next, .buttons.set > .back")
      .forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();

          if (button.classList.contains("next")) {
            const currentFieldset = fieldsets[currentStep];
            if (currentFieldset && !currentFieldset.checkValidity()) {
              currentFieldset.reportValidity();
              return;
            }

            if (currentStep < fieldsets.length - 1) {
              currentStep++;
              showStep(currentStep);
            }
          } else if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
          }
        });
      });
  }
  /**
   * Logika Listener asinkronus (FileUploader, Event submit, CustomEvent) tetap aman terisolasi di sini
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
              }
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
