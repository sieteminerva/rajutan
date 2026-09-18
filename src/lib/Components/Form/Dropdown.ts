import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";

export type DropdownElementType =
  | "@dropdown"
  | "@dropdown>label"
  | "@dropdown>input"
  | "@dropdown>hidden" // Tambahan: untuk menyimpan ID asli terpilih layaknya <select>
  | "@dropdown>list"
  | "@dropdown>list>option"
  | "@dropdown>menu"
  | "@dropdown>menu>item"
  | "@dropdown>menu>empty"
  | "@dropdown>tags"
  | "@dropdown>tags>item"


export interface iDropdownOption {
  id: string | number;
  label: string;
}

export interface iDropdownConfig extends iBuilderConfig<DropdownElementType> {
  attributes?: Array<{ name: string; value: string }>;
  apiUrl?: string | null; // URL jika mengambil data dinamis
  debounceDelay?: number; // Waktu tunggu debounce dalam milidetik
  style?: string;
  onSelect?: (value: string, id: string | null) => void; // Callback saat item dipilih
  min?: number; // Menggantikan hardcode keyword.length < 2
  max?: number; // Membatasi jumlah option yang dirender ke DOM
  isMultiple?: boolean;
  onMultiChange?: (items: iDropdownOption[]) => void;
}

export interface iDropdownContent {
  id?: string;
  name?: string;
  title?: string;
  placeholder?: string;
  value?: string | number | null;
  options?: iDropdownOption[];
  attributes?: Array<{ name: string; value: string }>;
}

export interface iDropdownState {
  options: iDropdownOption[];
  selectedMultiItems: iDropdownOption[];
  keyword: string;
  isLoading: boolean;
  value: string; // Menyimpan value string untuk input tersembunyi (hidden)
}

export class DropdownBuilder extends Builder<DropdownElementType, iDropdownConfig> {
  readonly builderId: keyof iBuilderRegistry = "dropdown";
  readonly name: keyof iBuilderRegistry = "dropdown";
  readonly stylesheet: string = "";

  private listId: string;
  private debounceTimeout: any = null;
  // ‼️ Wadah sinyal pembatalan untuk SEMUA listener (global & lokal).
  // Dipanggil sekali di destroy() → semua addEventListener dengan sinyal ini otomatis dibersihkan,
  // mencegah kebocoran memori dari listener document/window yang masih menahan `this`.
  private abortController = new AbortController();

  // State reaktif utama komponen
  #state!: iDropdownState;

  constructor(config: Partial<iDropdownConfig>) {
    super();
    // Membuat ID unik agar input dan datalist saling terhubung dengan aman
    this.listId = `dl-${Math.random().toString(36).substr(2, 9)}`;

    const defaultSelector: Record<DropdownElementType, iActionProperty> = {
      "@dropdown": { tagName: "div", className: "dropdown" },
      "@dropdown>label": { tagName: "label", className: "label" },
      "@dropdown>input": {
        tagName: "input",
        attrs: { type: "text", list: this.listId, autocomplete: "off" }
      },
      "@dropdown>hidden": { tagName: "input", attrs: { type: "hidden" } },
      "@dropdown>list": { tagName: "datalist", attrs: { id: this.listId }, className: "list" },
      "@dropdown>list>option": { tagName: "option", className: "item" },
      "@dropdown>menu": { tagName: "div", className: "menu" },
      "@dropdown>menu>item": { tagName: "div", className: "item" },
      "@dropdown>menu>empty": { tagName: "div", className: "no-results" },
      "@dropdown>tags": { tagName: "div", className: "tags" },
      "@dropdown>tags>item": { tagName: "span", className: "badge" }
    };

    const defaultConfig: Required<iDropdownConfig> = {
      themeId: "default",
      namespace: null,
      selectors: defaultSelector,
      emit: null,
      attributes: [],
      apiUrl: null,
      debounceDelay: 400,
      style: "select",
      min: 3, // Menggantikan hardcode keyword.length < 2
      max: 10, // Membatasi jumlah option yang dirender ke DOM
      isMultiple: false,
      onMultiChange: (_a: any) => { },
      onSelect: () => { },
    };

    this.config = this.resolveConfig(defaultConfig, config);
  }


  protected template(typeKey: DropdownElementType, el: HTMLElement, payload?: any): void {
    switch (typeKey) {
      case "@dropdown":
        el.dataset.style = this.config.style || "select";
        // el.classList.add(`style-${this.config.style || "select"}`);

        const hidden = this.render("@dropdown>hidden", payload);
        const input = this.render("@dropdown>input", payload);
        const options = (this.config.style === "datalist")
          ? this.render("@dropdown>list", payload?.options || [])
          : this.render("@dropdown>menu", payload?.options || []);

        const tags = this.render("@dropdown>tags", payload?.selectedMultiItems || []);
        el.append(...[tags, input, hidden, options].filter(Boolean) as HTMLElement[]);

        break;

      case "@dropdown>input":
        if (payload?.id) el.id = String(payload.id);
        if (payload?.placeholder) el.setAttribute("placeholder", String(payload.placeholder));
        if (payload?.value != null) (el as HTMLInputElement).value = String(payload.value);
        el.ariaReadOnly = "true";
        // el.setAttribute("readonly", "true");
        // Dalam mode select tidak ada <datalist> sehingga atribut list harus dibuang
        if (this.config.style !== "datalist") el.removeAttribute("list");
        break;

      case "@dropdown>label":
        el.setAttribute("for", String(payload.id));
        el.textContent = payload.title || "";
        break;

      case "@dropdown>hidden":
        // Digunakan sebagai penampung nilai ID terpilih
        if (payload?.name) el.setAttribute("name", payload.name);
        if (payload?.id) el.id = `${payload.id}-value`;
        if (payload?.value != null) (el as HTMLInputElement).value = String(payload.value);
        this.applyAttributes(el, payload?.attributes || this.config.attributes);
        break;

      case "@dropdown>list":
        const limit = this.config.max || 10;
        const limitedPayload = payload.slice(0, limit);

        if (Array.isArray(payload)) {
          for (const itemData of limitedPayload) {
            const item = this.render("@dropdown>list>option", itemData);
            if (item) el.appendChild(item);
          }
        }
        break;

      case "@dropdown>list>option":
        // Payload berformat iDropdownOption: { id: "1", label: "Jakarta" }
        if (payload) {
          el.setAttribute("value", payload.label);
          el.setAttribute("data-id", String(payload.id));
        }
        break;

      case "@dropdown>menu":
        // Manajemen tampilan didelegasikan ke Popover API (top layer)
        // → bebas dari masalah z-index & clipping ancestor.
        if (this.config.style !== "datalist") {
          el.setAttribute("popover", "manual");
          el.setAttribute("role", "listbox");
        }
        if (Array.isArray(payload)) {
          const items = payload.slice(0, this.config.max || 10);
          for (const itemData of items) {
            const item = this.render("@dropdown>menu>item", itemData);
            if (item) el.appendChild(item);
          }
          // State kosong: tidak ada hasil yang cocok
          if (items.length === 0) {
            el.classList.add("empty");
            const empty = this.render("@dropdown>menu>empty", null);
            if (empty) el.appendChild(empty);
          } else {
            el.classList.remove("empty");
          }
        }
        break;

      case "@dropdown>menu>empty":
        el.setAttribute("role", "option");
        el.setAttribute("aria-disabled", "true");
        el.textContent = "Tidak ada hasil yang cocok";
        break;

      case "@dropdown>menu>item":
        // Payload berformat iDropdownOption: { id: "1", label: "Jakarta" }
        if (payload) {
          el.setAttribute("role", "option");
          el.setAttribute("data-id", String(payload.id));
          el.setAttribute("data-label", String(payload.label));
          el.textContent = payload.label;
        }
        break;
      case "@dropdown>tags":
        if (Array.isArray(payload)) {
          for (const item of payload) {
            const tag = this.render("@dropdown>tags>item", item);
            if (tag) el.appendChild(tag);
          }
        }
        break;

      case "@dropdown>tags>item":
        // Payload: { id: "101", label: "Jakarta" }
        el.innerHTML = `${payload.label} <button type="button" class="remove" data-id="${payload.id}">&times;</button>`;
        break;
    }
  }

  public prepare(content: any, _config?: Required<iDropdownConfig> | undefined): HTMLElement {
    // Inisialisasi state awal sebelum dibungkus Proxy oleh framework Anda
    this.#state = {
      options: Array.isArray(content?.options) ? content.options : [],
      selectedMultiItems: [],
      keyword: "",
      isLoading: false,
      value: ""
    };

    // Kembalikan element. Framework Anda akan membalut 'this.state' ke dalam Proxy 
    // sehingga jika properti di dalam `this.state` berubah, ia otomatis memicu sub-render.
    return this.render("@dropdown", { ...content, ...this.#state }) as HTMLElement;
  }

  public initialize(el?: HTMLElement, _payload?: any, _context?: any): void {
    if (!el) return;

    const style = el.dataset.style || "select";
    const input = el.querySelector("input[type='text']") as HTMLInputElement;
    const tagsContainer = el.querySelector(".tags") as HTMLDivElement;

    if (!input || !tagsContainer) return;

    const hidden = el.querySelector("input[type='hidden']") as HTMLInputElement | null;
    const notifyLevelChange = (value: any) => {
      (hidden as HTMLInputElement & { __onLevelChange?: (value: any) => void } | null)?.__onLevelChange?.(value);
    };

    if (style === "datalist") {
      this.initDatalistMode(el, input, tagsContainer, hidden, notifyLevelChange);
    } else {
      this.initSelectMode(el, input, tagsContainer, hidden, notifyLevelChange);
    }
  }

  // --- MODE: <datalist> (native; tidak bisa di-style penuh) ---
  private initDatalistMode(el: HTMLElement, input: HTMLInputElement, tagsContainer: HTMLDivElement, hidden: HTMLInputElement | null, notifyLevelChange: (value: any) => void): void {
    const datalist = el.querySelector("datalist") as HTMLDataListElement;
    if (!datalist) return;

    if (this.#state.options.length > 0) {
      datalist.dataset.options = JSON.stringify(this.#state.options);
    }

    // 1. Listener saat mengetik
    input.addEventListener("input", (_e) => {
      this.#state.keyword = input.value;
      this.handleSearch(input, datalist, hidden);
    }, { signal: this.abortController.signal });

    // 2. PROTEKSI NILAI TIDAK VALID (Strict Mode saat Blur)
    input.addEventListener("blur", () => {
      if (this.config.isMultiple) return;

      const currentText = input.value;
      if (currentText === "") {
        this.#state.value = "";
        const hid = input.closest(".dropdown")?.querySelector("input[type='hidden']") as HTMLInputElement | null;
        if (hid) hid.value = "";
        if (this.config.onSelect) this.config.onSelect("", null);
        notifyLevelChange(null);
        return;
      }

      const matchedOption = datalist.querySelector(`option[value="${CSS.escape(currentText)}"]`);

      if (!matchedOption) {
        input.value = "";
        this.#state.keyword = "";
        this.#state.value = "";
        const hid = input.closest(".dropdown")?.querySelector("input[type='hidden']") as HTMLInputElement | null;
        if (hid) hid.value = "";
        if (this.config.onSelect) this.config.onSelect("", null);
        notifyLevelChange(null);

        this.renderOptions(datalist);
      }
    }, { signal: this.abortController.signal });

    // 3. Listener hapus tag khusus multi-select
    tagsContainer.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("remove")) {
        const idToRemove = target.getAttribute("data-id");
        this.removeTag(idToRemove, tagsContainer);
        this.renderTags(tagsContainer);
      }
    }, { signal: this.abortController.signal });
  }

  // --- MODE: <select> (Semantic-UI style: div.menu > div.item) ---
  private initSelectMode(el: HTMLElement, input: HTMLInputElement, tagsContainer: HTMLDivElement, hidden: HTMLInputElement | null, notifyLevelChange: (value: any) => void): void {
    const menu = el.querySelector(".menu") as HTMLDivElement;
    if (!menu) return;

    if (this.#state.options.length > 0) {
      menu.dataset.options = JSON.stringify(this.#state.options);
    }

    // ‼️ InputBuilder memindahkan child dropdown ke wrapper miliknya, jadi `el`
    // (root @dropdown) menjadi TERLEPAS dari DOM. Selalu pakai parent HIDUP dari
    // menu sebagai batas luar klik — dihitung saat event berlangsung, bukan saat init.
    const box = () => menu.parentElement as HTMLElement | null;

    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", "false");

    // Anchor positioning unik per-instans (meniru pola Input.ts:492-499).
    // Nama anchor unik di-generate dari id input, agar beberapa dropdown di
    // halaman yang sama tidak saling berebut anchor `--ddown` generik.
    const anchorName = `--anchor-${input.id || this.listId}`;
    const control = input.closest(".dropdown") as HTMLElement | null;
    (control || input).style.setProperty("anchor-name", anchorName);
    menu.style.setProperty("position-anchor", anchorName);

    // 🔊 Popover API + CSS Anchor Positioning: menu dirender di top layer dan
    // menempel otomatis ke input via anchor-name → posisi/lebar dikelola CSS,
    // mengikuti scroll/resize tanpa listener tambahan.
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const open = () => {
      if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
      if (!menu.matches(":popover-open")) menu.showPopover();
      // Tambahkan .visible pada frame berikutnya agar animasi masuk terlihat
      requestAnimationFrame(() => menu.classList.add("visible"));
      input.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      menu.classList.remove("visible");
      input.setAttribute("aria-expanded", "false");
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (!menu.classList.contains("visible") && menu.matches(":popover-open")) {
          try { menu.hidePopover(); } catch { /* sudah tertutup */ }
        }
      }, 160);
    };
    const toggle = () => (menu.matches(":popover-open") ? close() : open());

    // Jaga input tetap fokus saat berinteraksi dengan menu
    menu.addEventListener("mousedown", (e) => e.preventDefault(), { signal: this.abortController.signal });

    // Klik input → buka/tutup (toggle), bukan reopen terus-menerus saat fokus
    input.addEventListener("click", toggle, { signal: this.abortController.signal });

    // Klik area field lain (label/tag/combo padding) → buka/tutup + fokus ke input
    document.addEventListener("click", (e) => {
      const boxEl = box();
      if (!boxEl || !boxEl.contains(e.target as Node)) return;
      const t = e.target as HTMLElement;
      if (t.closest(".item") || t === input) return;
      if (!t.closest(".remove")) { toggle(); input.focus(); }
    }, { signal: this.abortController.signal });

    // Tutup hanya jika interaksi (mousedown) terjadi DI LUAR box hidup
    document.addEventListener("mousedown", (e) => {
      const boxEl = box();
      if (boxEl && !boxEl.contains(e.target as Node)) close();
    }, { signal: this.abortController.signal });

    // Mengetik → buka menu + filter (lokal / API berdebounce)
    input.addEventListener("input", () => {
      this.#state.keyword = input.value;
      open();
      this.handleSelectSearch(menu, input);
    }, { signal: this.abortController.signal });

    // Pemilihan item
    menu.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(".item") as HTMLElement | null;
      if (!item) return;
      const id = String(item.getAttribute("data-id") ?? "");
      const label = item.getAttribute("data-label") || item.textContent || "";
      const items = menu.querySelectorAll(".item");
      items.forEach((opt: Element) => {
        if (this.config.isMultiple) {
          // Untuk Multi-Select: Cek apakah ID item ini ada di dalam array selectedMultiItems
          const optId = String(opt.getAttribute("data-id") ?? "");
          const isSelected = this.#state.selectedMultiItems.some(i => String(i.id) === optId) || opt === item;
          // Catatan: 'opt === item' ditambahkan agar item yang baru diklik langsung menyala sebelum render ulang
          opt.classList.toggle("selected", isSelected);
        } else {
          // Untuk Single-Select: Hanya item yang diklik yang mendapat kelas "selected"
          opt.classList.toggle("selected", opt === item);
        }
      });
      if (this.config.isMultiple) {
        const exists = this.#state.selectedMultiItems.some(i => String(i.id) === id);
        if (!exists) this.#state.selectedMultiItems.push({ id, label });
        this.#state.value = this.#state.selectedMultiItems.map(i => i.id).join(",");
        if (hidden) hidden.value = this.#state.value;
        if (this.config.onMultiChange) this.config.onMultiChange(this.#state.selectedMultiItems);
        input.value = "";
        this.#state.keyword = "";
        this.renderTags(tagsContainer);
        this.filterMenu(menu, "");
        input.focus();
      } else {
        this.#state.value = id;
        if (hidden) hidden.value = id;
        input.value = label;
        this.#state.keyword = "";
        if (this.config.onSelect) this.config.onSelect(label, id);
        notifyLevelChange({ id, label });
        close();
      }
    }, { signal: this.abortController.signal });

    // Hapus tag (multi-select): klik × pada badge → JANGAN membuka popover lagi
    tagsContainer.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("remove")) {
        const idToRemove = target.getAttribute("data-id");
        this.removeTag(idToRemove, tagsContainer);
        this.renderTags(tagsContainer);
        // Karena hidden kini bukan saudara tags di dalam kombo, update manual
        if (hidden) hidden.value = this.#state.value;
      }
    }, { signal: this.abortController.signal });

    // Keyboard: Enter memilih item pertama, Escape menutup
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Enter") {
        e.preventDefault();
        const first = menu.querySelector(".item") as HTMLElement | null;
        if (first) first.click();
      }
    }, { signal: this.abortController.signal });
  }

  // Pencarian + filter untuk mode select (lokal atau API debounce)
  private handleSelectSearch(menu: HTMLDivElement, input: HTMLInputElement): void {
    const value = input.value;

    if (!this.config.apiUrl) {
      this.filterMenu(menu, value);
      return;
    }

    // API dengan Debounce
    this.#state.isLoading = true;
    this.renderInputState(input);

    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`${this.config.apiUrl}?search=${encodeURIComponent(value)}`);
        const data: iDropdownOption[] = await response.json();
        const unselectedData = this.config.isMultiple
          ? data.filter(p => !this.#state.selectedMultiItems.some(item => String(item.id) === String(p.id)))
          : data;
        this.#state.options = unselectedData.slice(0, this.config.max || 10);
        this.renderOptions(menu);
      } catch (error) {
        console.error("DropdownBuilder Fetch Error:", error);
      } finally {
        this.#state.isLoading = false;
        this.renderInputState(input);
      }
    }, this.config.debounceDelay);
  }

  // Filter opsi lokal dari dataset.options, lalu render ulang menu
  private filterMenu(menu: HTMLDivElement, keyword: string): void {
    const serialized = menu.dataset.options;
    const source: iDropdownOption[] = serialized ? JSON.parse(serialized) : this.#state.options;
    const norm = keyword.trim().toLocaleLowerCase();
    this.#state.options = source
      .filter(option => option.label.toLocaleLowerCase().includes(norm))
      .slice(0, this.config.max || 10);
    this.renderOptions(menu);
  }

  private handleSearch(input: HTMLInputElement, datalist: HTMLDataListElement, hidden: HTMLInputElement | null): void {
    const value = this.#state.keyword;
    const minLength = this.config.min ?? 2;
    const level = hidden?.dataset.level || input.dataset.level;
    const notifyLevelChange = (selected: any) => {
      (hidden as HTMLInputElement & { __onLevelChange?: (value: any) => void } | null)?.__onLevelChange?.(selected);
    };

    // 1. Cek Match Terpilih
    const matchedOption = datalist.querySelector(`option[value="${CSS.escape(value)}"]`);

    if (matchedOption) {
      const selectedId = matchedOption.getAttribute("data-id") || "";

      if (this.config.isMultiple) {
        const alreadyExists = this.#state.selectedMultiItems.some(item => String(item.id) === String(selectedId));
        if (!alreadyExists) {
          // Cukup ubah datanya secara reaktif!
          this.#state.selectedMultiItems.push({ id: selectedId, label: value });
          this.#state.value = this.#state.selectedMultiItems.map(item => item.id).join(",");
          const hidden = input.closest(".dropdown")?.querySelector("input[type='hidden']") as HTMLInputElement | null;
          if (hidden) hidden.value = this.#state.value;

          if (this.config.onMultiChange) this.config.onMultiChange(this.#state.selectedMultiItems);
        }
        // Reset kolom pencarian
        input.value = "";
        this.#state.keyword = "";
        this.#state.options = [];
      } else {
        this.#state.value = selectedId;
        const hidden = input.closest(".dropdown")?.querySelector("input[type='hidden']") as HTMLInputElement | null;
        if (hidden) hidden.value = selectedId;
        if (this.config.onSelect) this.config.onSelect(value, selectedId);
        notifyLevelChange({
          [`${level}_id`]: selectedId,
          [`${level}_name`]: value,
        });
      }

      // Trigger render ulang bagian DOM yang terpengaruh perubahan state
      if (this.config.isMultiple) this.renderOptions(datalist);
      const tagsContainer = datalist.parentElement?.querySelector(".tags") as HTMLDivElement;
      if (tagsContainer) this.renderTags(tagsContainer);
      return;
    }

    if (value.length < minLength) {
      if (!this.config.apiUrl) this.renderLocalOptions(datalist, value);
      else {
        this.#state.options = [];
        this.renderOptions(datalist);
      }
      return;
    }

    if (!this.config.apiUrl) {
      this.renderLocalOptions(datalist, value);
      return;
    }

    // 2. Handle API dengan Debounce (Hanya mutasi data state)
    this.#state.isLoading = true;
    this.renderInputState(input);

    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`${this.config.apiUrl}?search=${encodeURIComponent(value)}`);
        const data: iDropdownOption[] = await response.json();

        // Filter out yang sudah di-select
        const unselectedData = data.filter(p =>
          !this.#state.selectedMultiItems.some(item => String(item.id) === String(p.id))
        );

        const maxLimit = this.config.max || 10;

        // MUTASI DATA: Mengubah array di state otomatis merubah payload yang mengalir
        this.#state.options = unselectedData.slice(0, maxLimit);

        // Panggil internal re-render khusus untuk element datalist saja
        this.renderOptions(datalist);

      } catch (error) {
        console.error("DropdownBuilder Fetch Error:", error);
      } finally {
        this.#state.isLoading = false;
        this.renderInputState(input);
      }
    }, this.config.debounceDelay);
  }

  // --- SUB RENDERING UTILITIES (Mengikuti Aturan Main Framework Anda) ---

  public renderOptions(listEl: HTMLElement): void {
    listEl.innerHTML = ""; // Kosongkan container target saja
    const typeKey = listEl.tagName === "DATALIST" ? "@dropdown>list" : "@dropdown>menu";
    // Jalankan partial template re-render menggunakan state terbaru
    this.template(typeKey, listEl, this.#state.options);
  }

  private renderLocalOptions(datalist: HTMLDataListElement, keyword: string): void {
    const serializedOptions = datalist.dataset.options;
    const sourceOptions: iDropdownOption[] = serializedOptions
      ? JSON.parse(serializedOptions)
      : this.#state.options;
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    this.#state.options = sourceOptions
      .filter(option => option.label.toLocaleLowerCase().includes(normalizedKeyword))
      .slice(0, this.config.max || 10);
    this.renderOptions(datalist);
  }

  public renderTags(tagsContainerEl: HTMLDivElement): void {
    tagsContainerEl.innerHTML = "";
    this.template("@dropdown>tags", tagsContainerEl, this.#state.selectedMultiItems);
  }

  private renderInputState(inputEl: HTMLInputElement): void {
    inputEl.classList.toggle("loading", this.#state.isLoading);
  }

  private removeTag(id: string | null, tagsContainer: HTMLDivElement): void {
    if (!id) return;
    this.#state.selectedMultiItems = this.#state.selectedMultiItems.filter(item => String(item.id) !== String(id));
    this.#state.value = this.#state.selectedMultiItems.map(item => item.id).join(",");
    const hidden = tagsContainer.closest(".dropdown")?.querySelector("input[type='hidden']") as HTMLInputElement | null;
    if (hidden) hidden.value = this.#state.value;

    if (this.config.onMultiChange) this.config.onMultiChange(this.#state.selectedMultiItems);
  }

  /**
   * Lifecycle: batalkan semua listener (via AbortController), bersihkan debounce,
   * lalu serahkan pembersihan DOM/registry ke induk Builder.
   */
  public destroy(typeKey?: DropdownElementType): void {
    this.abortController.abort();
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    super.destroy(typeKey);
  }

  private applyAttributes(el: HTMLElement, attributes: Array<{ name: string; value: string }>): void {
    for (const attribute of attributes) {
      if (!attribute?.name) continue;
      el.setAttribute(attribute.name, String(attribute.value ?? ""));
    }
  }
}





