import type { iBasicNode, iBuilderConfig, iElementProperty } from "../../interface";
import { Builder } from "../Base";

export type InputControlsElementType =
  | "@controls"       // Kontainer pembungkus input + tombol aksi (.ui.action.input)
  | "@controls>add"
  | "@controls>remove"
  | "@controls>save"
  | "@controls>edit"
  | "@controls>custom" // Tombol aksi kustom sesuai kebutuhan bisnis

export interface iInputControlsConfig extends iBuilderConfig<InputControlsElementType> {
  // Instance builder input utama yang mau ditempeli tombol (misal DropdownBuilder)
  targetFieldBuilder: Builder<any, any>;
  targetFieldContent: any;

  // Posisi tombol aksi menempel di sisi mana
  actionPosition?: "left" | "right";

  // Daftar aksi tombol yang ingin dimunculkan disamping input
  activeActions: { type: InputControlsElementType; label?: string; onClick: (inputValue: string, hiddenId?: string | null) => void }[];
}



/**
 * @example
 * ```ts
 * // 1. Buat instance DropdownBuilder (Target utama)
 * const kotaDropdown = new DropdownBuilder({
 *   apiUrl: "https://example.com",
 *   min: 2,
 *   max: 5
 * });
 * 
 * // 2. Bungkus Dropdown tersebut ke dalam InputControlsBuilder agar menjadi Action Input!
 * const kotaActionInput = new InputControlsBuilder({
 *   targetFieldBuilder: kotaDropdown, // Suntik builder dropdown kesini
 *   targetFieldContent: {
 *     name: "destination_id",
 *     options: []
 *   },
 *   actionPosition: "right", // Taruh tombol di sebelah kanan
 *   
 *   // TENTUKAN TOMBOL-TOMBOL AKSI DAN EVENT LOGIKANYA DISINI:
 *   activeActions: [
 *     {
 *       type: "@controls>save",
 *       label: "Simpan Rute",
 *       onClick: (text, id) => {
 *         alert(`Aksi Simpan! Kota: ${text} dengan ID Database: ${id}`);
 *       }
 *     },
 *     {
 *       type: "@controls>custom",
 *       label: "🔄 Reset",
 *       onClick: (text, id) => {
 *         console.log("Aksi kustom reset dipicu untuk nilai:", text);
 *       }
 *     }
 *   ]
 * });
 * 
 * // 3. Render ke DOM Bumi Layar Browser Anda
 * const rootElement = kotaActionInput.prepare(null);
 * document.getElementById("form-area")?.appendChild(rootElement);
 * 
 * // 4. Nyalakan sistem kawat Proxy & Event Listenernya!
 * kotaActionInput.initialize(rootElement);
 * 
 * ```
 */
export class InputControlsBuilder extends Builder<InputControlsElementType, iInputControlsConfig> {
  readonly builderId = "input-controls";
  readonly name = "input-controls";
  readonly stylesheet: string = "./inputControls.css";

  private targetElement!: HTMLElement;

  constructor(config: iInputControlsConfig) { // Ubah jadi wajib memasukkan konfigurasi target targetFieldBuilder
    super();
    const defaultSelectors: Required<Record<InputControlsElementType, iElementProperty>> = {
      "@controls": { tagName: "div", className: "ui-action-field" },
      "@controls>add": { tagName: "button", className: "control-btn add-btn", icon: "＋" },
      "@controls>remove": { tagName: "button", className: "control-btn remove-btn", icon: "🗑️" },
      "@controls>save": { tagName: "button", className: "control-btn save-btn", icon: "☑️" },
      "@controls>edit": { tagName: "button", className: "control-btn edit-btn", icon: "🖋️" },
      "@controls>custom": { tagName: "button", className: "control-btn custom-btn" },
    };

    const defaultConfig: Partial<iInputControlsConfig> = {
      themeId: "default",
      namespace: null,
      selectors: defaultSelectors,
      emit: null,
      actionPosition: "right"
    };

    this.config = this.resolveConfig(defaultConfig as any, config);
  }

  protected template(typeKey: InputControlsElementType, el: HTMLElement, payload?: any): void {
    if (typeKey === "@controls") {
      // Pastikan posisi tombol kiri atau kanan terpengaruh di CSS class
      el.classList.add(`action-${this.config.actionPosition}`);
    } else if (typeKey.startsWith("@controls>")) {
      // Pasang teks / label pada tombol aksi jika ada
      if (payload?.label) {
        el.innerText = payload.label;
      }
    }
  }

  /**
   * 🧱 METODE PREPARE
   */
  public prepare(content: any): HTMLElement {
    // 1. Buat kontainer utama pembungkus .ui-action-field
    const container = this.render("@controls", content) as HTMLElement;

    // 2. Render input utama (Bisa DropdownBuilder atau Input biasa) dari blueprint target
    this.targetElement = this.config.targetFieldBuilder.prepare(this.config.targetFieldContent) as HTMLElement;

    // 3. Render kumpulan tombol aksi yang diaktifkan user
    const actionButtons: HTMLElement[] = [];
    this.config.activeActions.forEach(actionSetup => {
      const btn = this.render(actionSetup.type, actionSetup);
      if (btn) {
        // Tempelkan metadata payload aksi ke dalam tombol untuk dibaca saat click event
        (btn as any)._actionSetup = actionSetup;
        actionButtons.push(btn);
      }
    });

    // 4. Susun struktur DOM berdasarkan posisi (Kiri / Kanan) mirip Semantic UI
    if (this.config.actionPosition === "left") {
      container.append(...actionButtons, this.targetElement);
    } else {
      container.append(this.targetElement, ...actionButtons);
    }

    return container;
  }

  /**
   * 🧱 METODE INITIALIZE
   */
  public initialize(element: HTMLElement, _content?: iBasicNode): void {
    // 1. Jalankan inisialisasi internal untuk target input builder di dalam saku
    this.config.targetFieldBuilder.initialize(this.targetElement);

    // 2. Ambil referensi elemen input teks untuk mengekstrak nilainya nanti saat tombol diklik
    const textInput = this.targetElement.querySelector("input[type='text']") as HTMLInputElement;
    const hiddenInput = this.targetElement.querySelector("input[type='hidden']") as HTMLInputElement;

    // 3. Ikat event listener klik ke seluruh tombol aksi yang ada di dalam wrapper ini
    const buttons = element.querySelectorAll(".control-btn");
    buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const actionSetup = (btn as any)._actionSetup;
        if (actionSetup && actionSetup.onClick) {
          // Eksekusi fungsi onClick dengan mengirimkan value text input dan ID tersembunyinya saat ini!
          actionSetup.onClick(textInput?.value || "", hiddenInput?.value || null);
        }
      });
    });
  }
}
