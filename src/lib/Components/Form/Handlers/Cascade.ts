// ======================================================================
// 🌊 CASCADE ENGINE — seluruh logika kaskade hidup di file ini.
// FormBuilder cukup: buat FormCascade(host), tanam placeholder via hold(),
// lalu attach(form) sekali. Evaluasi, mount/unmount, gerbang tombol next,
// dan delegasi listener berjalan di dalam engine, tanpa membebani Form.ts.
// ======================================================================

import { FileUploader } from "../FileUploader";
import { InputBuilder } from "../Input";

/**
 * Aturan kaskade form: menentukan kapan sebuah input/group boleh "lahir" ke DOM.
 * Bisa berupa fungsi `(value, state) => boolean` atau objek deklaratif.
 *
 * @example
 * condition: { field: "web-type", equals: "ecommerce" }
 * condition: { field: ["email", "company"], filled: true, message: "Lengkapi kontak dulu" }
 * condition: (value, state) => value === "ecommerce"
 */
export interface iFormCondition {
  field?: string | string[];   // nama/id input "sebelum" yang menjadi sumber nilai
  equals?: any;                // nilai harus sama persis (perbandingan longgar via String())
  in?: any[];                  // nilai harus termasuk salah satu dari daftar
  notEquals?: any;             // nilai harus TIDAK sama
  notIn?: any[];               // nilai harus di luar daftar
  filled?: boolean;            // nilai harus terisi (tidak kosong)
  when?: (value: any, state: Record<string, any>) => boolean; // resolver kustom
  message?: string;            // pesan bimbingan saat gate multistep mengunci langkah
}

export interface iCascadeEventDetail {
  action: "mount" | "unmount";
  key: string;                            // posisi skema item, mis. "2" atau "2.group.1"
  element: HTMLElement | null;            // elemen yang di-mount / di-unmount
  descriptor: any;                        // deskriptor input/group asli pembawa .condition
  condition: iFormCondition;
  state: Record<string, any>;             // snapshot nilai form saat itu
}

export type iCascadeState = {
  form: HTMLFormElement;
  inputs: any[];
};

/** Kontrak minimal yang wajib dipenuhi host (FormBuilder) agar engine bekerja */
export interface FormCascadeHost {
  builder: string;
  inputs: any[];
  multistep: boolean;
  onCascade?: null | ((detail: iCascadeEventDetail) => void);
  emit?: any;
  /** Bangun <fieldset> dari deskriptor group (termasuk menahan anak ber-condition) */
  renderGroup(group: any, formId: string, path?: string): HTMLElement;
  /** Bangun tombol navigasi multistep untuk step yang baru lahir */
  renderButtonsSet?(payload: { index: number; isLast: boolean; formId: string }): HTMLElement | null;
  /** Perbaiki langkah aktif bila sebuah step di-unmount oleh kaskade */
  refreshSteps?(form: HTMLFormElement): void;
}

export class FormCascadeHandler {

  /** Objek skema pembawa .condition (bukan elemen DOM / string) */
  static isCascadeItem(item: any): boolean {
    return Boolean(item && typeof item === "object" && !(item instanceof Node) && item.condition != null);
  }

  /** Telusuri pohon skema; visit mengembalikan false untuk memangkas turunannya */
  static walkInputs(items: any[], prefix: string, visit: (item: any, path: string) => boolean | void): void {
    items?.forEach((item: any, i: number) => {
      if (!item || typeof item !== "object" || item instanceof Node) return;
      const path = `${prefix}${i}`;
      if (visit(item, path) !== false && Array.isArray(item.group)) {
        this.walkInputs(item.group, `${path}.group.`, visit);
      }
    });
  }

  static normalizeCondition(raw: any): iFormCondition {
    if (typeof raw === "function") return { when: raw } as iFormCondition;
    return (raw && typeof raw === "object" ? raw : {}) as iFormCondition;
  }

  static isEmptyValue(value: any): boolean {
    return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  }

  /** Nilai kontrol DOM selalu string — samakan boolean/angka dengan koersi terkendali */
  static looseEqual(a: any, b: any): boolean {
    if (a === b) return true;
    const truthy = (v: any) => v === true || v === "true" || v === 1 || v === "1" || v === "on";
    if (truthy(a) && truthy(b)) return true;
    return a != null && b != null && String(a) === String(b);
  }

  static matchRule(condition: iFormCondition, value: any): boolean {
    if (condition.filled) return !this.isEmptyValue(value);
    if (condition.in !== undefined) return ([] as any[]).concat(condition.in as any).some((v) => this.looseEqual(v, value));
    if (condition.notIn !== undefined) return !([] as any[]).concat(condition.notIn as any).some((v) => this.looseEqual(v, value));
    if (condition.notEquals !== undefined) return !this.looseEqual(condition.notEquals, value);
    if (condition.equals !== undefined) return this.looseEqual(condition.equals, value);
    return !this.isEmptyValue(value); // default: field terisi
  }

  static conditionMet(condition: iFormCondition, resolve: (field: string) => any, values: Record<string, any>): boolean {
    try {
      if (typeof condition.when === "function") {
        const fields = condition.field ? ([] as any[]).concat(condition.field as any) : [];
        return Boolean(condition.when(fields.length ? resolve(String(fields[0])) : undefined, values));
      }
      const fields = condition.field ? ([] as any[]).concat(condition.field as any).map(String) : [];
      if (!fields.length) return false; // tanpa field/when tidak ada yang bisa dipenuhi
      return fields.every((field) => this.matchRule(condition, resolve(field)));
    } catch (error) {
      console.warn("[Form Cascade] condition evaluation failed:", error);
      return false;
    }
  }

  /** Kumpulkan snapshot nilai semua kontrol DOM di dalam form */
  static collectValues(form: HTMLFormElement): Record<string, any> {
    const values: Record<string, any> = {};
    form?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[name], select[name], textarea[name]")
      .forEach((el) => { values[el.name || el.id] = this.readControlValue(form, el); });
    return values;
  }

  /** Baca nilai terkini sebuah kontrol (checkbox/radio/select-multiple/file disesuaikan) */
  static readControlValue(form: HTMLFormElement | null, el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): any {
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") return el.checked ? (el.value && el.value !== "on" ? el.value : true) : null;
      if (el.type === "radio") {
        const checked = form?.querySelector<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`);
        return checked ? checked.value : null;
      }
      if (el.type === "file") return el.files?.length || null;
      return el.value;
    }
    if (el instanceof HTMLSelectElement) {
      return el.multiple ? Array.from(el.selectedOptions).map((option) => option.value) : el.value;
    }
    return el.value;
  }

  /** Fallback terakhir: nilai preset dari descriptor skema */
  static findSchemaValue(items: any[], field: string): any {
    for (const item of items || []) {
      if (!item || typeof item !== "object" || item instanceof Node) continue;
      if ((item.name || item.id) === field) {
        if (item.type === "checkbox" || item.type === "radio") return item.checked ? (item.value ?? true) : null;
        return item.value;
      }
      const nested = this.findSchemaValue(item.group, field);
      if (nested !== undefined) return nested;
    }
    return undefined;
  }

  /** Urutan lookup nilai: kontrol DOM → descriptor skema */
  static resolveFieldValue(state: iCascadeState, field: string): any {
    const control = state.form?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      `[name="${CSS.escape(field)}"], #${CSS.escape(field)}`
    );
    if (control) return this.readControlValue(state.form, control);
    return this.findSchemaValue(state.inputs, field);
  }

}

// 🌊 ENGINE KASKADE — satu instance per form yang cascading:true.
// Placeholders hidup di Map privat engine (bukan Builder.#nodes) dan semua
// listener memakai delegasi di level form, sehingga step yang baru lahir
// otomatis terpantau tanpa re-bind manual.
export class FormCascade {
  private host: FormCascadeHost;
  private form: HTMLFormElement | null = null;
  private placeholders = new Map<string, HTMLElement>();
  private onChange: ((event: Event) => void) | null = null;

  constructor(host: FormCascadeHost) {
    this.host = host;
  }

  /** Tanam placeholder <template> di posisi skema (dipanggil prepare/renderGroup) */
  hold(parent: HTMLElement, path: string): void {
    const placeholder = document.createElement("template");
    placeholder.dataset.cascade = path;
    this.placeholders.set(path, placeholder);
    parent.appendChild(placeholder);
  }

  /** Aktifkan engine: delegasi input/change + sync + gate awal */
  attach(form: HTMLFormElement): void {
    this.form = form;
    this.onChange = () => this.sync();
    form.addEventListener("input", this.onChange);
    form.addEventListener("change", this.onChange);
    this.sync();
  }

  /** Set nilai programatik lalu picu evaluasi via event change */
  setValue(field: string, value: any): void {
    const form = this.form;
    if (!form) return;
    const control = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      `[name="${CSS.escape(field)}"], #${CSS.escape(field)}`
    );
    if (!control) return;
    control.value = String(value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Evaluasi kondisi → transisi placeholder <-> elemen asli, lalu perbarui gerbang */
  sync(): void {
    const form = this.form;
    if (!form) return;
    const values = FormCascadeHandler.collectValues(form);
    const resolve = (field: string) => FormCascadeHandler.resolveFieldValue({ form, inputs: this.host.inputs }, field);

    // Bangun elemen nyata dari deskriptor lalu tukar dengan placeholder-nya
    const mount = (item: any, path: string, placeholder: HTMLElement): HTMLElement | null => {
      let el: HTMLElement | null = null;
      if (item && typeof item === "object" && "group" in item) {
        el = this.host.renderGroup(item, form.id, path);
        if (el) {
          if (item.id) el.id = item.id;
          if (item.className) el.className = `${el.className} ${item.className}`.trim();
          // Step multistep yang baru lahir butuh nomor langkah + tombol navigasi
          if (this.host.multistep && !path.includes(".")) {
            el.dataset.index = path;
            const buttons = this.host.renderButtonsSet?.({
              index: Number(path),
              isLast: Number(path) === this.host.inputs.length - 1,
              formId: form.id,
            });
            if (buttons) el.appendChild(buttons);
          }
          // Hidupkan uploader (file input CSV dsb.) di area yang baru lahir
          try { if (typeof FileUploader !== "undefined") FileUploader.initAll(el); } catch (error) { console.warn("[Form Cascade] file uploader init failed:", error); }
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
      FormCascadeHandler.walkInputs(this.host.inputs, "", (item, path) => {
        if (!FormCascadeHandler.isCascadeItem(item)) return; // bukan kandidat → turuni anaknya
        const placeholder = this.placeholders.get(path);
        if (!(placeholder instanceof HTMLElement)) return false; // group di atasnya masih ditahan
        const mounted = form.querySelector<HTMLElement>(`[data-cascade="${CSS.escape(path)}"]:not(template)`);
        const met = FormCascadeHandler.conditionMet(FormCascadeHandler.normalizeCondition(item.condition), resolve, values);
        if (met) {
          if (!mounted) {
            const el = mount(item, path, placeholder);
            if (el) { changed = true; this.emit(form, "mount", el, item, path); }
          }
        } else if (mounted) {
          mounted.replaceWith(placeholder);
          changed = true;
          this.emit(form, "unmount", mounted, item, path);
        }
        return Boolean(mounted); // group kaskade hanya dituruni saat sedang terpasang
      });
      pass++;
    } while (changed && pass < 10); // ulang sebentar untuk kaskade berantai

    // Multistep: bila langkah aktif hilang karena unmount, kembali ke langkah terdekat
    if (this.host.multistep && changed) this.host.refreshSteps?.(form);

    // Gerbang next: tombol disabled bila langkah berikutnya masih terkunci kondisi
    this.gate(form);
  }

  /**
   * Gerbang kaskade sederhana: tombol "next" sebuah langkah dinonaktifkan bila
   * langkah berikutnya di skema adalah item kaskade yang syaratnya belum dipenuhi
   * (placeholder <template> masih tertahan). Begitu SATU cabang kaskade terpasang
   * (mis. ecommerce/galeri), cabang saudara yang tertahan tidak lagi mengunci.
   */
  gate(form?: HTMLFormElement): void {
    const target = form ?? this.form;
    if (!target || !this.host.multistep) return;

    const values = FormCascadeHandler.collectValues(target);
    const resolve = (field: string) => FormCascadeHandler.resolveFieldValue({ form: target, inputs: this.host.inputs }, field);
    // Cabang kaskade yang sedang terpasang → syarat telah dipenuhi satu di antaranya
    const branchChosen = !!target.querySelector("[data-cascade]:not(template)");

    target.querySelectorAll<HTMLFieldSetElement>("fieldset[data-index]").forEach((fieldset) => {
      const nextButton = fieldset.querySelector<HTMLButtonElement>(".buttons.set > button.next");
      if (!nextButton) return;

      const currentIndex = Number(fieldset.dataset.index);
      const nextItem = this.host.inputs[currentIndex + 1];
      let blocked = false;
      let guidance = "";

      if (FormCascadeHandler.isCascadeItem(nextItem)) {
        const nextPath = String(currentIndex + 1);
        const nextMounted = target.querySelector<HTMLElement>(`[data-cascade="${CSS.escape(nextPath)}"]:not(template)`);
        // Langkah berikutnya masih placeholder → kondisinya belum terpenuhi
        if (!nextMounted) {
          const met = FormCascadeHandler.conditionMet(FormCascadeHandler.normalizeCondition(nextItem.condition), resolve, values);
          blocked = !met && !branchChosen;
          if (blocked) {
            guidance = typeof nextItem.condition?.message === "string"
              ? nextItem.condition.message
              : "Lengkapi isian sebelumnya untuk membuka langkah berikutnya.";
          }
        }
      }

      nextButton.disabled = blocked;
      if (blocked) nextButton.title = guidance;
      else nextButton.removeAttribute("title");
    });
  }

  private emit(form: HTMLFormElement, action: iCascadeEventDetail["action"], element: HTMLElement | null, item: any, path: string): void {
    const detail: iCascadeEventDetail = {
      action,
      key: path,
      element,
      descriptor: item ?? null,
      condition: FormCascadeHandler.normalizeCondition(item?.condition ?? {}),
      state: FormCascadeHandler.collectValues(form),
    };
    if (typeof this.host.onCascade === "function") {
      try { this.host.onCascade(detail); } catch (error) { console.warn("[Form Cascade] onCascade listener error:", error); }
    }
    if (typeof this.host.emit === "function") {
      try { this.host.emit("elementChanged", { builder: this.host.builder, type: "@form", element, data: detail }); } catch { /* emit opsional */ }
    }
    form.dispatchEvent(new CustomEvent("formCascade", { bubbles: true, detail }));
  }

  /** Lepas semua jejak: listener delegasi + placeholder */
  dispose(): void {
    if (this.form && this.onChange) {
      this.form.removeEventListener("input", this.onChange);
      this.form.removeEventListener("change", this.onChange);
    }
    this.form = null;
    this.onChange = null;
    this.placeholders.clear();
  }
}
