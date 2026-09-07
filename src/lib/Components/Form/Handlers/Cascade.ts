// ======================================================================
// 🌊 CASCADE ENGINE — seluruh logika kaskade hidup di file ini.
// FormBuilder cukup: buat FormCascade(host), tanam placeholder via hold(),
// lalu attach(form) sekali. Evaluasi, mount/unmount, gerbang tombol next,
// dan delegasi listener berjalan di dalam engine, tanpa membebani Form.ts.
// ======================================================================

import { FileUploader } from "../FileUploader";
import { InputBuilder } from "../Input";
import type { CascadeBlockedInfo } from "./Validation";

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
  /** Gerbang tombol next: null/undefined = ikuti cascading && multistep;
   * true = kunci selama ada kondisi belum terpenuhi; false = nonaktif. */
  autoDisableNextStep?: boolean;
  onCascade?: null | ((detail: iCascadeEventDetail) => void);
  emit?: any;
  /** Bangun <fieldset> dari deskriptor group (termasuk menahan anak ber-condition) */
  renderGroup(group: any, formId: string, path?: string): HTMLElement;
  /** Perbaiki langkah aktif bila sebuah step di-unmount oleh kaskade */
  refreshSteps?(form: HTMLFormElement): void;
  /** Laporkan tombol "next" terkunci karena sebuah condition belum terpenuhi */
  reportCascadeBlocked?(info: CascadeBlockedInfo): void;
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

  /** Peta nama/id field → index langkah multistep di skema (aturan gerbang masuk) */
  static collectFieldSteps(inputs: any[]): Map<string, number> {
    const map = new Map<string, number>();
    const visit = (item: any, step: number): void => {
      if (!item || typeof item !== "object" || item instanceof Node) return;
      const key = item.name ?? item.id;
      if (key) map.set(String(key), step);
      if (Array.isArray(item.group)) item.group.forEach((child: string | HTMLElement | any) => visit(child, step));
    };
    inputs.forEach((item, step) => visit(item, step));
    return map;
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
  private onPress: ((event: PointerEvent) => void) | null = null;

  // Info gerbang kaskade SAAT INI yang terkunci. Disimpan agar bisa dilaporkan
  // (toast) tepat ketika tombol next yang DISABLED ditekan — bukan otomatis
  // tiap kali masuk langkah terkunci / status berubah.
  private lastBlockedInfo: CascadeBlockedInfo | null = null;

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

    // 🧾 Deteksi penekanan tombol next yang DISABLED (terkunci kondisi).
    // Tombol disabled menelan event click, tapi pointerdown tetap meledak —
    // jadi di sini kita tangkap & laporkan gerbangnya. Ini titik TEPAT untuk
    // memunculkan toast, bukan setiap kali masuk langkah terkunci.
    this.onPress = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.("button.next") as HTMLButtonElement | null;
      if (!button || !button.disabled) return;
      this.reportBlocked(form);
    };
    form.addEventListener("pointerdown", this.onPress as EventListener);

    this.sync();
  }

  /** Laporkan gerbang terkunci SEKARANG (dipicu penekanan tombol disabled). */
  reportBlocked(form?: HTMLFormElement): void {
    const target = form ?? this.form;
    if (!target || !this.lastBlockedInfo) return;
    this.lastBlockedInfo = { ...this.lastBlockedInfo, form: target };
    try {
      this.host.reportCascadeBlocked?.(this.lastBlockedInfo);
    } catch (error) {
      console.warn("[Form Cascade] reportCascadeBlocked failed:", error);
    }
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
    const mount = (item: any, path: string, placeholder: HTMLElement): HTMLElement => {
      let el: HTMLElement | null = null;
      if (item && typeof item === "object" && "group" in item) {
        el = this.host.renderGroup(item, form.id, path);
        if (el) {
          if (item.id) el.id = item.id;
          if (item.className) el.className = `${el.className} ${item.className}`.trim();
          // Step multistep yang baru lahir cukup membawa nomor langkah —
          // tombol navigasi HIDUP DI LEVEL FORM sebagai satu set bersama
          // yang ditukar engine multistep pada setiap perpindahan langkah.
          if (this.host.multistep && !path.includes(".")) {
            el.dataset.index = path;
          }
          // Hidupkan uploader (file input CSV dsb.) di area yang baru lahir
          try { if (typeof FileUploader !== "undefined") FileUploader.initAll(el); } catch (error) { console.warn("[Form Cascade] file uploader init failed:", error); }
        }
      } else {
        el = new InputBuilder({ formId: form.id } as any).create(item) as HTMLElement;
        // Hidupkan uploader untuk item tunggal yang baru lahir dari kaskade
        // (mis. input file CSV yang dikondisikan) — item non-group tak pernah
        // masuk jalur group di atas.
        try { if (typeof FileUploader !== "undefined") FileUploader.initAll(el); } catch (error) { console.warn("[Form Cascade] file uploader init failed:", error); }
      }
      if (!el) {
        const label = item && (item.id || item.name || item.type);
        throw new Error(
          `[Form Cascade] Gagal membangun elemen kaskade pada path "${path}"` +
            (label ? ` untuk "${label}"` : "") +
            ". Pastikan selektor '@form>group' terkonfigurasi & InputBuilder mengembalikan elemen yang valid (render() mengembalikan undefined bila selektor tidak dikenal)."
        );
      }
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
            // mount() melempar Error bila pembangunan elemen gagal — tidak lagi ditelan.
            const el = mount(item, path, placeholder);
            changed = true;
            this.emit(form, "mount", el, item, path);
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
   * Gerbang kaskade (multistep) — dikendalikan `autoDisableNextStep`:
   * tombol "next" sebuah langkah dinonaktifkan selama masih ada kondisi kaskade
   * yang belum terpenuhi — baik kondisi manual pada group langkah itu sendiri,
   * maupun kondisi anak input di dalamnya (rantai fill-in).
   *
   * Aturan gerbang masuk: sebuah kondisi HANYA mengunci tombol next bila
   * field sumbernya berada di langkah ini ATAU sebelumnya (≤ langkah tempat
   * tombol itu berada). Kondisi yang seluruh field sumbernya masih di langkah
   * berikutnya BUKAN gerbang masuk — isian itu justru dikerjakan SETELAH
   * masuk ke langkah tersebut; ia akan mengunci tombol next langkah itu
   * sendiri nanti (sesuai aturan yang sama).
   */
  gate(form?: HTMLFormElement): void {
    const target = form ?? this.form;
    if (!target || !this.host.multistep) return;

    // Tombol next kini HIDUP DI LEVEL FORM — satu set bersama milik engine
    // multistep yang ditukar pada setiap perpindahan langkah. Gerbang cukup
    // mengunci/membuka set milik langkah AKTIF (fieldset.active).
    const nextButton = target.querySelector<HTMLButtonElement>(":scope > .buttons.set > button.next");
    if (!nextButton) return;

    const apply = (disabled: boolean, guidance: string): void => {
      nextButton.disabled = disabled;
      if (disabled) nextButton.title = guidance;
      else nextButton.removeAttribute("title");
    };

    if (!this.host.autoDisableNextStep) {
      // Mode nonaktif: pastikan tombol next aktif kembali (mis. saat runtime toggle)
      apply(false, "");
      return;
    }

    // Langkah aktif menentukan kondisi mana yang berhak mengunci next
    const activeFieldset = target.querySelector<HTMLFieldSetElement>("fieldset[data-index].active");
    if (!activeFieldset) return;
    const currentIndex = Number(activeFieldset.dataset.index);

    const values = FormCascadeHandler.collectValues(target);
    const resolve = (field: string) => FormCascadeHandler.resolveFieldValue({ form: target, inputs: this.host.inputs }, field);
    const fieldSteps = FormCascadeHandler.collectFieldSteps(this.host.inputs);
    // Cabang kaskade yang sedang terpasang → syarat telah dipenuhi satu di antaranya
    const branchChosen = !!target.querySelector("[data-cascade]:not(template)");

    let blocked = false;
    let guidance = "";
    let blockedCondition: iFormCondition | null = null;
    let blockedPath = "";

    // Telusuri skema dari langkah 0 s/d langkah berikutnya (N+1):
    // langkah yang sudah lewat ikut diperiksa — misalnya pengguna mengosongkan
    // isian lama, kondisi turunannya ikut mengunci lagi.
    FormCascadeHandler.walkInputs(
      this.host.inputs.slice(0, currentIndex + 2),
      "",
      (item, path) => {
        if (!FormCascadeHandler.isCascadeItem(item)) return; // bukan kandidat → turuni anaknya
        if (blocked) return false; // sudah terkunci → hentikan telusuran

        // "Gerbang masuk": lewati kondisi yang SELURUH field sumbernya masih
        // di langkah berikutnya (N+1) — isian itu dikerjakan di sana.
        const sourceFields = ([] as any[]).concat(item.condition?.field ?? []);
        const sourceSteps = sourceFields.map((f: any) => fieldSteps.get(String(f)) ?? -1);
        if (sourceSteps.length > 0 && sourceSteps.every((s) => s > currentIndex)) return; // bukan gerbang masuk; lanjut ke anaknya

        const met = FormCascadeHandler.conditionMet(FormCascadeHandler.normalizeCondition(item.condition), resolve, values);
        if (met) return; // terpenuhi → lanjut

        // Kondisi manual pada level group langkah: dilonggarkan bila cabang
        // saudara sudah terpilih (branchChosen) — perilaku multi-cabang asli
        // engine kaskade dipertahankan.
        if (Array.isArray(item.group) && branchChosen) return; // relaksasi cabang saudara

        blocked = true;
        blockedCondition = FormCascadeHandler.normalizeCondition(item.condition);
        blockedPath = path;
        guidance = typeof item.condition?.message === "string"
          ? item.condition.message
          : "Lengkapi isian sebelumnya untuk membuka langkah berikutnya.";
        return false;
      }
    );

    apply(blocked, guidance);

    // 🧾 Simpan info gerbang TERKUNCI agar bisa dilaporkan tepat saat tombol
    // next (disabled) DITEKAN — lihat attach()/reportBlocked(). TIDAK lagi
    // memancarkan toast otomatis setiap kali masuk langkah terkunci.
    if (blocked) {
      this.lastBlockedInfo = {
        form: target,
        guidance,
        condition: blockedCondition,
        step: currentIndex,
        path: blockedPath,
      };
    } else {
      this.lastBlockedInfo = null;
    }
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
    if (this.form) {
      if (this.onChange) {
        this.form.removeEventListener("input", this.onChange);
        this.form.removeEventListener("change", this.onChange);
      }
      if (this.onPress) {
        this.form.removeEventListener("pointerdown", this.onPress as EventListener);
      }
    }
    this.form = null;
    this.onChange = null;
    this.onPress = null;
    this.lastBlockedInfo = null;
    this.placeholders.clear();
  }
}
