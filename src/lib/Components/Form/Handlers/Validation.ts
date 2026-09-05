// ======================================================================
// 🧾 FORM VALIDATION HANDLER — satu-satunya jalur terpusat untuk:
//  1. Validasi NATIVE (required, pattern, type, dll.) — saat submit / next.
//  2. Validasi KASKADE (kondisi) — saat tombol "next" terkunci karena
//     sebuah condition belum terpenuhi (gate engine Cascade.ts).
//
// Setiap laporan (report) melakukan 3 hal sekaligus:
//  a) emit("formValidation", detail)  → lewat config.emit (EventEmitter global)
//  b) dispatch CustomEvent("formValidation") di <form> → mudah ditangkap content.ts
//  c) showMessage(...) → langsung menampilkan info memakai FormBuilder.createMessage
//
// Dengan begitu, semua "kenapa form tidak bisa lanjut?" berpusat di satu metode.
// ======================================================================

import type { iMessageContent } from "../../Message/Message";
import type { iFormCondition } from "./Cascade";

export interface iInvalidField {
  name?: string;
  id?: string;
  type?: string;
  label?: string;
  message?: string;
}

export type FormValidationReason = "native" | "cascade";

export interface iFormValidationDetail {
  formId: string;
  builder?: string;
  reason: FormValidationReason;
  valid: boolean;
  /** index langkah multistep yang sedang divalidasi (opsional) */
  step?: number;
  message: string;
  fields?: iInvalidField[];
  condition?: iFormCondition | null;
  path?: string;
  data?: any;
}

export interface FormValidationOptions {
  builder?: string;
  emit?: (event: string, payload: any) => void;
  showMessage?: (content: iMessageContent) => void;
}

/** Info gerbang kaskade yang dikirim engine Cascade → handler ini. */
export interface CascadeBlockedInfo {
  form: HTMLFormElement;
  guidance: string;
  condition: iFormCondition | null;
  step: number;
  path?: string;
}

export class FormValidationHandler {
  private options: FormValidationOptions;

  constructor(options: FormValidationOptions = {}) {
    this.options = options;
  }

  /** Ambil label ramah-manusia dari sebuah kontrol (label[for] → .field label → id/name/type). */
  private static resolveLabel(
    scope: ParentNode,
    el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ): string {
    const name = el.name || "";
    if (name) {
      const labelled = scope.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(name)}"]`);
      const text = labelled?.textContent?.trim();
      if (text) return text;
    }
    const wrapping = el.closest?.(".field, .ui-action-field");
    const wrapLabel = wrapping?.querySelector("label")?.textContent?.trim();
    if (wrapLabel) return wrapLabel;
    return el.id || name || el.type || "field";
  }

  /**
   * Kumpulkan field yang gagal validasi native. Bila `step` diberikan,
   * pemindaian dibatasi ke fieldset langkah itu saja (multistep) — langkah
   * lain yang tersembunyi/tidak aktif tidak ikut dipertimbangkan.
   */
  static collectInvalidFields(form: HTMLFormElement, step?: number): iInvalidField[] {
    const scope: ParentNode =
      step !== undefined ? (form.querySelector<HTMLElement>(`fieldset[data-index="${step}"]`) ?? form) : form;

    const fields: iInvalidField[] = [];
    scope
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input[name], select[name], textarea[name], input:not([name])",
      )
      .forEach((el) => {
        if (el.disabled || el.validity.valid) return;
        fields.push({
          name: el.name || undefined,
          id: el.id || undefined,
          type: el.type || el.tagName.toLowerCase(),
          label: this.resolveLabel(scope, el),
          message: el.validationMessage || "Isian ini belum diisi / tidak valid.",
        });
      });
    return fields;
  }

  /** Bangun detail untuk validasi NATIVE (submit / next). */
  buildNativeDetail(form: HTMLFormElement, step?: number): iFormValidationDetail {
    const fields = FormValidationHandler.collectInvalidFields(form, step);
    const first = fields[0];
    const message = first
      ? `${first.label ? `"${first.label}" — ` : ""}${first.message || "Isian belum valid."}`
      : "Pastikan seluruh isian wajib telah diisi dengan benar.";
    return {
      formId: form.id,
      builder: this.options.builder,
      reason: "native",
      valid: fields.length === 0,
      step,
      message,
      fields,
    };
  }

  /** Bangun detail untuk gerbang KASKADE (tombol next terkunci kondisi). */
  buildCascadeDetail(info: CascadeBlockedInfo): iFormValidationDetail {
    return {
      formId: info.form.id,
      builder: this.options.builder,
      reason: "cascade",
      valid: false,
      step: info.step,
      message: info.guidance || "Lengkapi isian sebelumnya untuk membuka langkah berikutnya.",
      condition: info.condition,
      path: info.path,
    };
  }

  /** Jalur terpusat tunggal: emit + CustomEvent di form + tampilkan toast. */
  report(detail: iFormValidationDetail, form?: HTMLFormElement): iFormValidationDetail {
    // a) Emit global lewat config.emit (EventEmitter di main.ts).
    if (typeof this.options.emit === "function") {
      try {
        this.options.emit("formValidation", detail);
      } catch (error) {
        console.warn("[Form Validation] emit failed:", error);
      }
    }

    // b) CustomEvent di <form> agar content.ts cukup addEventListener — sama seperti formSubmit.
    if (form) {
      try {
        form.dispatchEvent(new CustomEvent("formValidation", { bubbles: true, detail }));
      } catch (error) {
        console.warn("[Form Validation] dispatch failed:", error);
      }
    }

    // c) Tampilkan info langsung memakai createMessage host.
    if (typeof this.options.showMessage === "function") {
      try {
        this.options.showMessage({
          header: detail.reason === "cascade" ? "Selangkah Lagi" : "Periksa Kembali",
          message: detail.message,
          type: detail.reason === "cascade" ? "warning" : "error",
          icon: detail.reason === "cascade" ? "notification icon" : "icon error",
        });
      } catch (error) {
        console.warn("[Form Validation] showMessage failed:", error);
      }
    }

    return detail;
  }

  /** Lapor validasi NATIVE: kumpulkan field tak valid & pusatkan ke report(). */
  reportNative(form: HTMLFormElement, step?: number): iFormValidationDetail {
    return this.report(this.buildNativeDetail(form, step), form);
  }

  /** Lapor gerbang KASKADE: tombol next terkunci karena sebuah condition belum terpenuhi. */
  reportCascadeBlocked(info: CascadeBlockedInfo): iFormValidationDetail {
    return this.report(this.buildCascadeDetail(info), info.form);
  }
}