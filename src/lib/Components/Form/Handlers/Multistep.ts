// ======================================================================
// 🪜 MULTISTEP ENGINE — seluruh logika wizard hidup di file ini.
// FormBuilder cukup: buat FormMultistepHandler(host), tahan step via
// hold(), lalu attach(form) sekali. Langkah TIDAK dirender saat
// prepare() — placeholder <template data-step> ditanam di posisinya,
// dan fieldset sungguhan baru dibangun tepat ketika tombol Next/Back
// menekannya (lazy mount). Evaluasi posisi aktif & gerbang validasi
// berjalan di dalam engine, tanpa membebani Form.ts.
// ======================================================================

import { FileUploader } from "../FileUploader";

/** Kontrak minimal yang wajib dipenuhi host (FormBuilder) agar engine bekerja */
export interface FormMultistepHost {
  builder: string;
  /** Daftar skema input penuh — penentu isLast untuk tombol navigasi */
  inputs: any[];
  /** Bangun <fieldset> dari deskriptor group (termasuk menahan anak ber-condition) */
  renderGroup(group: any, formId: string, path?: string): HTMLElement;
  /** Bangun tombol navigasi multistep untuk step yang baru dilahirkan */
  renderButtonsSet?(payload: { index: number; isLast: boolean; formId: string }): HTMLElement | null;
}

interface PendingStep {
  index: number;
  item: any;
  placeholder: HTMLElement;
}

export class FormMultistepHandler {
  private host: FormMultistepHost;
  private form: HTMLFormElement | null = null;
  private currentStep = 0;

  /** Step yang masih tertahan sebagai <template data-step> — belum lahir ke DOM */
  private pending = new Map<number, PendingStep>();
  private onClick: ((event: MouseEvent) => void) | null = null;

  constructor(host: FormMultistepHost) {
    this.host = host;
  }

  /** Tanam placeholder <template data-step> di posisi skema (dipanggil prepare) */
  hold(parent: HTMLElement, index: number, item: any): void {
    const placeholder = document.createElement("template");
    placeholder.dataset.step = String(index);
    this.pending.set(index, { index, item, placeholder });
    parent.appendChild(placeholder);
  }

  /** Aktifkan engine: lahirkan langkah awal + delegasi klik next/back di level form */
  attach(form: HTMLFormElement): void {
    this.form = form;
    this.onClick = (event) => this._handleClick(event);
    form.addEventListener("click", this.onClick);
    this.goTo(0);
  }

  private _handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const button = target?.closest?.("button") as HTMLButtonElement | null;
    if (!button || !button.closest(".buttons.set")) return;
    const isNext = button.classList.contains("next");
    const isBack = button.classList.contains("back");
    if (!isNext && !isBack) return;

    const form = this.form;
    if (!form) return;
    event.preventDefault();

    if (isNext) {
      // Gerbang validasi: langkah aktif harus sah sebelum boleh maju
      const currentFieldset = this._mountedFieldset(form, this.currentStep);
      if (currentFieldset && !currentFieldset.checkValidity()) {
        currentFieldset.reportValidity();
        return;
      }

      // Maju ke langkah TERDEKAT berikutnya — kaskade bisa menyisakan celah
      // (mis. step gallery belum terpenuhi), langkah tertahan ikut jadi kandidat.
      const nextIndex = this._candidateIndexes(form).find((index) => index > this.currentStep);
      if (nextIndex !== undefined) this.goTo(nextIndex);
    } else if (this.currentStep > 0) {
      const previousIndex = this._candidateIndexes(form).filter((index) => index < this.currentStep).pop();
      if (previousIndex !== undefined) this.goTo(previousIndex);
    }
  }


  /**
   * Kandidat langkah = fieldset yang sudah terpasang di DOM + langkah yang
   * masih tertahan sebagai placeholder. Langkah kaskade yang sedang ditahan
   * syaratnya (belum terpasang) otomatis bukan kandidat — persis paritas
   * dengan perilaku lama yang hanya melihat fieldset di DOM.
   */
  private _candidateIndexes(form: HTMLFormElement): number[] {
    const mounted = this._mountedSteps(form).map((fieldset) => Number(fieldset.dataset.index));
    return [...new Set([...mounted, ...this.pending.keys()])].sort((a, b) => a - b);
  }

  /**
   * Lahirkan fieldset langkah dari placeholder — SEKALI saja, lalu tetap
   * tinggal di DOM (class .active yang dipindah-pindah). Bila langkah sudah
   * terpasang (atau dipasang kaskade lebih dulu), kembalikan yang ada.
   */
  private _mount(form: HTMLFormElement, index: number): HTMLElement | null {
    const existing = this._mountedFieldset(form, index);
    if (existing) return existing;

    const entry = this.pending.get(index);
    if (!entry) return null;

    const group = entry.item;
    const fieldset = this.host.renderGroup(group, form.id);
    if (!fieldset) return null;

    if (group?.id) fieldset.id = group.id;
    if (group?.className) fieldset.className = `${fieldset.className} ${group.className}`.trim();
    fieldset.dataset.index = String(index);

    // Step yang baru lahir butuh nomor langkah + tombol navigasi
    const isLast = index === this.host.inputs.length - 1;
    const buttons = this.host.renderButtonsSet?.({ index, isLast, formId: form.id });
    if (buttons) fieldset.appendChild(buttons);

    // Hidupkan uploader (file input CSV dsb.) pada area yang baru lahir
    try {
      if (typeof FileUploader !== "undefined") FileUploader.initAll(fieldset);
    } catch (error) {
      console.warn("[Form Multistep] file uploader init failed:", error);
    }

    entry.placeholder.replaceWith(fieldset);
    this.pending.delete(index);
    return fieldset;
  }

  /** Aktifkan satu langkah: bangun bila masih placeholder, lalu set status aktif */
  public goTo(index: number): void {
    const form = this.form;
    if (!form) return;
    const fieldset = this._mount(form, index);
    if (!fieldset) return;
    this.currentStep = index;
    this._syncActive(form);
  }

  /**
   * Selaraskan class .active + arah animasi antar langkah yang terpasang.
   * Bila langkah aktif sedang di-unmount kaskade, gandol ke langkah terdekat
   * yang masih ada di DOM (dipanggil via host.refreshSteps dari Cascade).
   */
  public refresh(form?: HTMLFormElement): void {
    const target = form ?? this.form;
    if (!target) return;

    const mounted = this._mountedSteps(target);
    if (!mounted.length) return;

    const isCurrentMounted = mounted.some((fieldset) => Number(fieldset.dataset.index) === this.currentStep);
    if (!isCurrentMounted) {
      const fallback = mounted.filter((fieldset) => Number(fieldset.dataset.index) < this.currentStep).pop() ?? mounted[0];
      this.currentStep = Number(fallback.dataset.index);
    }

    this._syncActive(target);
  }

  private _syncActive(form: HTMLFormElement): void {
    const steps = this._mountedSteps(form);
    steps.forEach((fieldset, position) => {
      if (Number(fieldset.dataset.index) === this.currentStep) {
        fieldset.classList.add("active");
        if (position < steps.length - 1) steps[position + 1].setAttribute("animate", "next");
        if (position > 0) steps[position - 1].setAttribute("animate", "back");
      } else {
        fieldset.classList.remove("active");
      }
    });
  }

  /** Fieldset langkah utama yang terpasang, terurut berdasarkan nomor langkah */
  private _mountedSteps(form: HTMLFormElement): HTMLFieldSetElement[] {
    return Array.from(form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-index]"))
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
  }

  private _mountedFieldset(form: HTMLFormElement, index: number): HTMLFieldSetElement | null {
    return form.querySelector<HTMLFieldSetElement>(`fieldset[data-index="${index}"]`);
  }

  /** Lepas semua jejak: listener delegasi + daftar langkah tertahan */
  dispose(): void {
    if (this.form && this.onClick) {
      this.form.removeEventListener("click", this.onClick);
    }
    this.form = null;
    this.onClick = null;
    this.pending.clear();
  }
}
