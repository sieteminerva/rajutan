// ======================================================================
// 🌊 CASCADE HELPERS — fungsi murni di luar class agar FormBuilder tetap
// ramping. Semua state hidup di #cascadeState + Builder.#nodes (placeholder).
// ======================================================================

import { MessageBuilder } from "../../Message/Message";
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
  action: "mount" | "unmount" | "blocked" | "unblocked";
  key: string;                            // posisi skema item, mis. "2" atau "2.group.1"
  element: HTMLElement | null;            // elemen hasil mount, atau tombol next saat blocked
  descriptor: any;                        // deskriptor input/group asli pembawa .condition
  condition: iFormCondition;
  state: Record<string, any>;             // snapshot nilai form saat itu
}

export type iCascadeState = {
  form: HTMLFormElement;
  values: Record<string, any>;
  queued: boolean;
  inputs: any[];
};

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

  /** Urutan lookup nilai: state reaktif → kontrol DOM → descriptor skema */
  static resolveFieldValue(state: iCascadeState, field: string): any {
    if (field in state.values) return state.values[field];
    const control = state.form?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      `[name="${CSS.escape(field)}"], #${CSS.escape(field)}`
    );
    if (control) return this.readControlValue(state.form, control);
    return this.findSchemaValue(state.inputs, field);
  }

  /** Susun kalimat bimbingan dari isi kondisi (atau pakai condition.message kustom) */
  static describeBlock(item: any): string {
    const condition = this.normalizeCondition(item?.condition);
    if (condition.message) return condition.message;

    const fields = condition.field ? ([] as any[]).concat(condition.field as any).map(String).join(", ") : "isian terkait";
    let expectation = "terisi (tidak boleh kosong)";
    if (condition.equals !== undefined) expectation = `bernilai "${String(condition.equals)}"`;
    else if (condition.in !== undefined) expectation = `bernilai salah satu dari: ${([] as any[]).concat(condition.in as any).join(", ")}`;
    else if (condition.notEquals !== undefined) expectation = `TIDAK bernilai "${String(condition.notEquals)}"`;
    else if (condition.notIn !== undefined) expectation = `bukan salah satu dari: ${([] as any[]).concat(condition.notIn as any).join(", ")}`;

    return `Lengkapi isian berikut agar langkah berikutnya dapat dibuka — ${fields}: ${expectation}.`;
  }

  /** Pesan bimbingan via MessageBuilder; id unik per form agar pesan lama tergantikan */
  static showGateMessage(form: HTMLFormElement, message: string): void {
    if (typeof MessageBuilder === "undefined") return;
    const show = () => {
      try {
        const toast = new MessageBuilder({ id: `msg-cascade-${form.id || "form"}`, element: form, duration: 6000 });
        toast.prepare({ header: "Langkah Berikutnya Terkunci", message, type: "warning", icon: "warning circle icon" });
        toast.initialize();
      } catch (error) {
        console.warn("[Form Cascade] failed to show gate message:", error);
      }
    };
    // create() mengembalikan form sebelum caller meng-append-nya ke dokumen —
    // tunggu sampai benar-benar menempel agar toast tidak lahir-mati sia-sia.
    if (form.isConnected) { show(); return; }
    let tries = 0;
    const waitAttach = () => {
      if (form.isConnected) show();
      else if (tries++ < 60) requestAnimationFrame(waitAttach);
    };
    requestAnimationFrame(waitAttach);
  }

}