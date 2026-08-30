import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder } from "../Base";

export type DropdownElementType =
  | "@dropdown"
  | "@dropdown>label"
  | "@dropdown>input"
  | "@dropdown>hidden" // Tambahan: untuk menyimpan ID asli terpilih layaknya <select>
  | "@dropdown>list"
  | "@dropdown>list>option"
  | "@dropdown>tags"
  | "@dropdown>tags>item"


export interface iDropdownOption {
  id: string | number;
  label: string;
}

export interface iDropdownConfig extends iBuilderConfig<DropdownElementType> {
  apiUrl?: string | null; // URL jika mengambil data dinamis
  debounceDelay?: number; // Waktu tunggu debounce dalam milidetik
  onSelect?: (value: string, id: string | null) => void; // Callback saat item dipilih
  min?: number; // Menggantikan hardcode keyword.length < 2
  max?: number; // Membatasi jumlah option yang dirender ke DOM
  isMultiple?: false;
  onMultiChange?: (a: any) => void
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
  readonly stylesheet: string = "./Dropdown.css";

  private listId: string;
  private debounceTimeout: any = null;

  // State reaktif utama komponen
  #state!: iDropdownState;

  constructor(config: Partial<iDropdownConfig>) {
    super();
    // Membuat ID unik agar input dan datalist saling terhubung dengan aman
    this.listId = `dl-${Math.random().toString(36).substr(2, 9)}`;

    const defaultSelector: Record<DropdownElementType, iActionProperty> = {
      "@dropdown": { tagName: "div", className: "field" },
      "@dropdown>label": { tagName: "label", className: "label" },
      "@dropdown>input": {
        tagName: "input",
        attrs: { type: "text", list: this.listId, autocomplete: "off", placeholder: "Type to search..." },
        className: "dropdown"
      },
      "@dropdown>hidden": { tagName: "input", attrs: { type: "hidden" } },
      "@dropdown>list": { tagName: "datalist", attrs: { id: this.listId }, className: "list" },
      "@dropdown>list>option": { tagName: "option", className: "item" },
      "@dropdown>tags": { tagName: "div", className: "tags" },
      "@dropdown>tags>item": { tagName: "span", className: "badge" }
    };

    const defaultConfig: Required<iDropdownConfig> = {
      themeId: "default",
      namespace: null,
      selectors: defaultSelector,
      emit: null,
      apiUrl: null,
      debounceDelay: 400,
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

        const hidden = this.render("@dropdown>hidden");
        const input = this.render("@dropdown>input");
        const datalist = this.render("@dropdown>list", payload?.options || []);
        const label = this.render("@dropdown>label")

        el.append(label!, input!, hidden!, datalist!);
        break;

      case "@dropdown>input":
        // Atribut dasar sudah di-handle oleh defaultSelector.attrs
        break;

      case "@dropdown>hidden":
        // Digunakan sebagai penampung nilai ID terpilih
        if (payload?.name) el.setAttribute("name", payload.name);
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
      case "@dropdown>tags":
        // Wadah kosong awal untuk menampung tag badge
        break;

      case "@dropdown>tags>item":
        // Payload: { id: "101", label: "Jakarta" }
        el.innerHTML = `${payload.label} <button type="button" class="remove-tag-btn" data-id="${payload.id}">&times;</button>`;
        break;
    }
  }

  public prepare(content: any, _config?: Required<iDropdownConfig> | undefined): HTMLElement {
    // Inisialisasi state awal sebelum dibungkus Proxy oleh framework Anda
    this.#state = {
      options: content?.options || [],
      selectedMultiItems: [],
      keyword: "",
      isLoading: false,
      value: ""
    };

    // Kembalikan element. Framework Anda akan membalut 'this.state' ke dalam Proxy 
    // sehingga jika properti di dalam `this.state` berubah, ia otomatis memicu sub-render.
    return this.render("@dropdown", this.#state) as HTMLElement;
  }

  public initialize(el?: HTMLElement, _payload?: any, _context?: any): void {
    if (!el) return;

    const input = el.querySelector("input[type='text']") as HTMLInputElement;
    const datalist = el.querySelector("datalist") as HTMLDataListElement;
    const tagsContainer = el.querySelector(".dropdown-tags-container") as HTMLDivElement;

    if (!input || !datalist || !tagsContainer) return;

    // 1. Listener saat mengetik (Sudah ada di kode sebelumnya)
    input.addEventListener("input", (_e) => {
      this.#state.keyword = input.value;
      this.handleSearch(input, datalist);
    });

    // 2. PROTEKSI NILAI TIDAK VALID (Strict Mode saat Blur)
    // Menjamin jika user mengetik asal, input akan otomatis bersih saat pindah fokus
    input.addEventListener("blur", () => {
      if (this.config.isMultiple) return; // Mode multiple tidak butuh ini karena input selalu dikosongkan setelah klik

      const currentText = input.value;
      if (currentText === "") {
        this.#state.value = "";
        if (this.config.onSelect) this.config.onSelect("", null);
        return;
      }

      // Cek apakah teks saat ini ada yang cocok dengan opsi di datalist
      const matchedOption = datalist.querySelector(`option[value="${CSS.escape(currentText)}"]`);

      if (!matchedOption) {
        // Jika tidak ada yang cocok, paksa reset ke kosong agar sinkron dengan ID database yang kosong
        input.value = "";
        this.#state.keyword = "";
        this.#state.value = "";
        if (this.config.onSelect) this.config.onSelect("", null);

        // Sinkronkan ulang datalist jika diperlukan
        this.#state.options = [];
        this.renderOptions(datalist);
      }
    });

    // 3. Listener hapus tag khusus multi-select (Sudah ada di kode sebelumnya)
    tagsContainer.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("remove-tag-btn")) {
        const idToRemove = target.getAttribute("data-id");
        this.removeTag(idToRemove);
        this.renderTags(tagsContainer);
      }
    });
  }

  private handleSearch(input: HTMLInputElement, datalist: HTMLDataListElement): void {
    const value = this.#state.keyword;
    const minLength = this.config.min ?? 2;

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

          if (this.config.onMultiChange) this.config.onMultiChange(this.#state.selectedMultiItems);
        }
        // Reset kolom pencarian
        input.value = "";
        this.#state.keyword = "";
        this.#state.options = [];
      } else {
        this.#state.value = selectedId;
        if (this.config.onSelect) this.config.onSelect(value, selectedId);
      }

      // Trigger render ulang bagian DOM yang terpengaruh perubahan state
      this.renderOptions(datalist);
      const tagsContainer = datalist.parentElement?.querySelector(".dropdown-tags-container") as HTMLDivElement;
      if (tagsContainer) this.renderTags(tagsContainer);
      return;
    }

    if (value.length < minLength) {
      this.#state.options = [];
      this.renderOptions(datalist);
      return;
    }

    if (!this.config.apiUrl) return;

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

  public renderOptions(datalistEl: HTMLDataListElement): void {
    datalistEl.innerHTML = ""; // Kosongkan container target saja
    // Jalankan partial template re-render menggunakan state terbaru
    this.template("@dropdown>list", datalistEl, this.#state.options);
  }

  public renderTags(tagsContainerEl: HTMLDivElement): void {
    tagsContainerEl.innerHTML = "";
    this.template("@dropdown>tags", tagsContainerEl, this.#state.value ? this.#state.selectedMultiItems : this.#state.selectedMultiItems);
  }

  private renderInputState(inputEl: HTMLInputElement): void {
    this.template("@dropdown>input", inputEl, { isLoading: this.#state.isLoading });
  }

  private removeTag(id: string | null): void {
    if (!id) return;
    this.#state.selectedMultiItems = this.#state.selectedMultiItems.filter(item => String(item.id) !== String(id));
    this.#state.value = this.#state.selectedMultiItems.map(item => item.id).join(",");

    if (this.config.onMultiChange) this.config.onMultiChange(this.#state.selectedMultiItems);
  }
}





