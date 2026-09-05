// ======================================================================
// 🪜 MULTISTEP ENGINE — seluruh logika wizard hidup di file ini.
// FormBuilder cukup: buat FormMultistepHandler(host), tahan step via
// hold(), lalu attach(form) sekali. Langkah TIDAK dirender saat
// prepare() — placeholder <template data-step> ditanam di posisinya,
// dan fieldset sungguhan baru dibangun tepat ketika tombol Next/Back
// menekannya (lazy mount). Evaluasi posisi aktif & gerbang validasi
// berjalan di dalam engine, tanpa membebani Form.ts.
// ======================================================================

/** Kontrak minimal yang wajib dipenuhi host (FormBuilder) agar engine bekerja */
export interface FormMultistepHost {
  builder: string;
  /** Daftar skema input penuh — penentu isLast untuk tombol navigasi */
  inputs: any[];
  /** Bangun <fieldset> dari deskriptor group (termasuk menahan anak ber-condition) */
  renderGroup(group: any, formId: string, path?: string): HTMLElement;
  /** Bangun tombol navigasi multistep untuk step yang baru dilahirkan */
  renderButtonsSet?(payload: { index: number; isLast: boolean; formId: string }): HTMLElement | null;
  /** Beri tahu host saat fieldset step baru lahir ke DOM (lazy mount) —
   *  kesempatan menghidupkan uploader/IdAddress pada area yang baru lahir */
  onStepMount?(fieldset: HTMLElement): void;
  /** Beri tahu host setiap kali langkah aktif BERPINDAH (next/back/attach) —
   *  kesempatan engine kaskade menilai ulang gerbang tombol next yang baru */
  onStepChange?(index: number): void;
  /** Laporkan validasi native gagal saat menekan Next pada langkah `step` */
  reportNativeInvalid?(form: HTMLFormElement, step: number): void;
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
  /** Set tombol navigasi bersama yang saat ini menempel di level form */
  private navBar: HTMLElement | null = null;

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
        // 🧾 Laporkan validasi native langkah gagal ke jalur terpusat (emit + toast).
        try {
          this.host.reportNativeInvalid?.(form, this.currentStep);
        } catch (error) {
          console.warn("[Form Multistep] reportNativeInvalid failed:", error);
        }
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
  private _mount(form: HTMLFormElement, index: number): HTMLElement {
    const existing = this._mountedFieldset(form, index);
    if (existing) return existing;

    const entry = this.pending.get(index);
    if (!entry) {
      throw new Error(
        `[Form Multistep] Langkah ke-${index} tidak dikenal: tidak ada placeholder tertahan ` +
          "dan belum terpasang di DOM. Pastikan setiap langkah group diteruskan lewat hold() pada skema form."
      );
    }

    const group = entry.item;
    // Teruskan index sebagai cascadePath: bila cascading aktif, anak-anak
    // step yang membawa .condition ditahan sebagai placeholder kaskade
    // (path "N.group.j" konsisten dengan walkInputs pada skema).
    const fieldset = this.host.renderGroup(group, form.id, String(index));
    if (!fieldset) {
      const label = group && (group.id || group.title || group.legend);
      throw new Error(
        `[Form Multistep] Gagal membangun fieldset langkah ke-${index}` +
          (label ? ` untuk "${label}"` : "") +
          ". Pastikan selektor '@form>group' terkonfigurasi & renderGroup mengembalikan elemen (render() mengembalikan undefined bila selektor tidak dikenal)."
      );
    }

    if (group?.id) fieldset.id = group.id;
    if (group?.className) fieldset.className = `${fieldset.className} ${group.className}`.trim();
    fieldset.dataset.index = String(index);

    entry.placeholder.replaceWith(fieldset);
    this.pending.delete(index);

    // Beri tahu host — uploader/IdAddress pada area yang baru lahir
    // dihidupkan oleh Form (attachFormListener), bukan oleh engine ini.
    this.host.onStepMount?.(fieldset);
    return fieldset;
  }

  /** Aktifkan satu langkah: bangun bila masih placeholder, lalu set status aktif */
  public goTo(index: number): void {
    const form = this.form;
    if (!form) return;
    // _mount() melempar Error bila langkah tidak dikenal / gagal dibangun — tidak lagi ditelan.
    this._mount(form, index);
    // Arah animasi mengikuti arah perpindahan — paritas dengan fieldset tujuan
    // yang membawa attribute animate dari sinkronisasi sebelumnya.
    const direction: "next" | "back" | null =
      index === this.currentStep ? null : index > this.currentStep ? "next" : "back";
    this.currentStep = index;
    // Set navigasi ditukar di SETIAP perpindahan — bukan hanya saat fieldset
    // baru lahir. Inilah kunci tombol Back: langkah tujuan sudah lama terpasang
    // di DOM, tapi set-nya tetap wajib diganti (mis. kembali dari langkah
    // terakhir: back+submit harus kembali menjadi back+next).
    this._syncButtons(form, index, direction);
    this._syncActive(form);
    this.host.onStepChange?.(index);
  }

  /**
   * Tukar set tombol navigasi bersama yang HIDUP DI LEVEL FORM — dipanggil di
   * setiap perpindahan langkah (goTo/refresh), bukan hanya saat fieldset baru
   * lahir, agar arah navigasi (next/back/submit) selalu cocok dengan langkah.
   * Set membawa attribute paritas dengan fieldset langkah terkait (data-index
   * + animate) supaya bisa dianimasikan sinkron lewat CSS.
   */
  private _syncButtons(form: HTMLFormElement, index: number, direction?: "next" | "back" | null): void {
    const isLast = index === this.host.inputs.length - 1;
    const buttons = this.host.renderButtonsSet?.({ index, isLast, formId: form.id });
    if (!buttons) return;
    buttons.dataset.index = String(index);
    if (direction) buttons.setAttribute("animate", direction);
    if (this.navBar && this.navBar.isConnected) this.navBar.replaceWith(buttons);
    else form.appendChild(buttons);
    this.navBar = buttons;
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

    // Arah animasi fallback: langkah aktif di-unmount kaskade → gandol mundur
    let direction: "next" | "back" | null = null;
    const isCurrentMounted = mounted.some((fieldset) => Number(fieldset.dataset.index) === this.currentStep);
    if (!isCurrentMounted) {
      const fallback = mounted.filter((fieldset) => Number(fieldset.dataset.index) < this.currentStep).pop() ?? mounted[0];
      this.currentStep = Number(fallback.dataset.index);
      // Fieldset & nav yang masuk sama-sama membawa arah "back" agar animasinya koheren
      direction = "back";
      fallback.setAttribute("animate", "back");
    }

    this._syncButtons(target, this.currentStep, direction);
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
    this.navBar = null;
    this.pending.clear();
  }
}
