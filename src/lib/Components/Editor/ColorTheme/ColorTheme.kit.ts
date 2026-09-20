import type { BaseColors } from "./ColorTheme.engine";
import {
  ColorThemeEngine,
  type DerivedTheme,
  type MixerSettings,
  type MixTarget,
  type ThemeMode,
  type ThemeOverrides,
} from "./ColorTheme.engine";
import type { iColorThemePreset } from "./ColorTheme.presets";

export type ThemeValidationRule = { min?: number; max?: number; minContrast?: number };
export type ThemeItemConfig = { variable: string; default: { amount: number; shift: number; target: MixTarget } };

export const DEFAULT_THEME_ITEMS: Record<string, ThemeItemConfig> = {
  hover: { variable: "--app-primary-hover", default: { amount: 80, shift: 0, target: "auto" } },
  strong: { variable: "--app-accent-strong", default: { amount: 85, shift: 0, target: "auto" } },
  text: { variable: "--app-text-color", default: { amount: 75, shift: 0, target: "auto" } },
  subtle: { variable: "--app-accent-subtle", default: { amount: 12, shift: 0, target: "auto" } },
  border: { variable: "--app-border-color", default: { amount: 30, shift: 0, target: "auto" } },
};

export const DEFAULT_VALIDATIONS: Record<string, ThemeValidationRule> = {
  // Signed percent delta: negative = accent darker than primary, positive = accent lighter.
  // `minContrast` is a hard readability guard for accent against the generated backgrounds.
  relativeLightnessDelta: { min: -20, max: 20, minContrast: 2 },
};

export class ColorThemeKit {
  static syncThemeStrips(
    root: HTMLElement,
    theme: DerivedTheme,
    items: Record<string, ThemeItemConfig> = DEFAULT_THEME_ITEMS,
  ): void {
    const rampsStrip = root.querySelector<HTMLElement>(".ramps .strip");
    const paletteStrip = root.querySelector<HTMLElement>(".palette .strip");

    if (rampsStrip) {
      const { preview, probes } = theme;
      const surfaceRgba = ColorThemeEngine.toRgba(probes.surface);
      const entries = ColorThemeEngine.RAMP_STOPS.map((step) => [step, preview[`--app-primary-${step}`]] as [string, string]);
      const existing = Array.from(rampsStrip.children) as HTMLElement[];
      const nextEntries = entries.map(([label, value]) => {
        const flat = ColorThemeEngine.over(ColorThemeEngine.toRgba(value), surfaceRgba);
        return {
          label,
          flat,
          textColor: ColorThemeEngine.contrast("#ffffff", flat) >= 3.2 ? "#ffffff" : "#1a140e",
          title: `ramps · ${label} → ${value}`,
        };
      });

      for (let i = 0; i < Math.max(existing.length, nextEntries.length); i++) {
        let current = existing[i];
        const item = nextEntries[i];

        if (!current && item) {
          current = document.createElement("span");
          rampsStrip.append(current);
        }

        if (current && item) {
          current.textContent = item.label;
          current.style.background = ColorThemeEngine.rgbOf(item.flat);
          current.style.color = item.textColor;
          current.title = item.title;
        }

        if (current && !item) {
          current.remove();
        }
      }
    }

    if (paletteStrip) {
      const { preview, probes } = theme;
      const surfaceRgba = ColorThemeEngine.toRgba(probes.surface);
      const entries = Object.entries(items).map(([label, item]) => [label, preview[item.variable]] as [string, string]);
      const existing = Array.from(paletteStrip.children) as HTMLElement[];
      const nextEntries = entries.map(([label, value]) => {
        const flat = ColorThemeEngine.over(ColorThemeEngine.toRgba(value), surfaceRgba);
        return {
          label,
          flat,
          textColor: ColorThemeEngine.contrast("#ffffff", flat) >= 3.2 ? "#ffffff" : "#1a140e",
          title: `palette · ${label} → ${value}`,
        };
      });

      for (let i = 0; i < Math.max(existing.length, nextEntries.length); i++) {
        let current = existing[i];
        const item = nextEntries[i];

        if (!current && item) {
          current = document.createElement("span");
          paletteStrip.append(current);
        }

        if (current && item) {
          current.textContent = item.label;
          current.style.background = ColorThemeEngine.rgbOf(item.flat);
          current.style.color = item.textColor;
          current.title = item.title;
        }

        if (current && !item) {
          current.remove();
        }
      }
    }
  }

  static syncModeControl(root: HTMLElement, mode: ThemeMode): void {
    const modeInput = root.querySelector<HTMLInputElement>("input[name='mode']");
    if (modeInput) modeInput.checked = mode === "dark";

    const modeLabel = root.querySelector<HTMLLabelElement>(".toggle-switch label");
    if (modeLabel) modeLabel.textContent = mode;
  }

  static syncBaseColorPickers(root: HTMLElement, bases: BaseColors): void {
    const primary = root.querySelector<HTMLInputElement>("input[data-slot='primary']");
    const accent = root.querySelector<HTMLInputElement>("input[data-slot='accent']");

    if (primary && primary.value !== bases.primary) primary.value = bases.primary;
    if (accent && accent.value !== bases.accent) accent.value = bases.accent;
  }

  static syncBaseColorWarning(
    root: HTMLElement,
    bases: BaseColors,
    mode: ThemeMode,
    validations: Record<string, ThemeValidationRule> = DEFAULT_VALIDATIONS,
    theme?: DerivedTheme,
  ): void {
    const picker = root.querySelector<HTMLElement>(".field.group");
    if (!picker) return;

    // 1. Ambil rule dari konfigurasi framework
    const rule =
      validations["relativeLightnessDelta"] ??
      validations["primaryAccentLightness"] ??
      validations["accentPrimaryLightness"] ??
      validations["baseLightnessDelta"] ??
      DEFAULT_VALIDATIONS.relativeLightnessDelta;

    const existing = picker.querySelector<HTMLElement>(".warning");

    // 2. Langsung panggil metode tunggal baru dari engine
    // Metode ini mengembalikan teks deskripsi JIKA lolos, atau teks peringatan JIKA melanggar.
    const message = ColorThemeEngine.describeLightnessDelta(bases.primary, bases.accent, mode, rule, theme);

    // 3. Deteksi apakah statusnya melanggar aturan (out of range / low contrast)
    // Trik cerdas: Jika string teks diawali kata "⚠️" atau "Accent color is too", berarti statusnya ERROR/WARNING.
    const isOutOfRange = message.includes("too") || message.includes("⚠️");

    // 4. Update DOM secara efisien
    if (!isOutOfRange) {
      existing?.remove();
      return;
    }

    const next = existing ?? document.createElement("small");
    next.className = "warning";
    next.textContent = message; // Langsung pakai pesan presisi yang dihasilkan engine
    next.title = "Keep the accent within the configured lightness band so it stays related to the primary color without becoming too faint on the background.";

    if (!existing) picker.appendChild(next);
  }

  /**
   * State → UI for the preset select, called from the reactive `sync()` effect
   * (same family as syncModeControl / syncMixerControls). Idempotent: options
   * are only rebuilt when the label set actually changed; the selection always
   * follows state — empty/unknown resets to the placeholder (this is what
   * makes the Reset button visually reset the select).
   */
  static syncPresetOptions(root: HTMLElement, selectedPreset: string, presets: iColorThemePreset[]): void {
    const select = root.querySelector<HTMLSelectElement>("select[data-control='preset']");
    if (!select) return;

    const labels = presets.map((preset) => preset.label);
    const existing = Array.from(select.options)
      .filter((option) => option.value !== "")
      .map((option) => option.value);
    const unchanged = existing.length === labels.length && labels.every((label, index) => label === existing[index]);

    if (!unchanged) {
      const placeholder = select.querySelector<HTMLOptionElement>("option[value='']");
      const placeholderClone = placeholder?.cloneNode(true) as HTMLOptionElement | null;

      select.replaceChildren();
      if (placeholderClone) select.append(placeholderClone);

      for (const preset of presets) {
        const option = document.createElement("option");
        for (const prop of ["value", "label", "title"]) {
          (option as any)[prop] = preset.label;
        }
        select.append(option);
      }
    }

    // State is the single source of truth — never read the DOM as fallback.
    select.value = presets.some((preset) => preset.label === selectedPreset) ? selectedPreset : "";
  }


  static syncHarmonyNotice(root: HTMLElement, overrides: ThemeOverrides): void {
    const mixers = root.querySelectorAll<HTMLElement>(".mixer-item[data-mixer]");

    mixers.forEach((mixer) => {
      const name = mixer.dataset.mixer!;
      const entry = overrides[name];
      if (!entry) return;

      const amount = Number(entry.amount ?? 50);
      const shift = Number(entry.shift ?? 0);
      const existing = mixer.querySelector<HTMLElement>(".warning");

      const absShift = Math.abs(shift);
      const amountBias = Math.abs(amount - 50);
      const severeAmount = amount < 12 || amount > 88;
      const severeShift = absShift > 90;
      const combinedRisk = amountBias > 28 && absShift > 48;

      const flags: string[] = [];
      if (severeAmount) {
        flags.push(`${amount}% mix`);
      }
      if (severeShift) {
        flags.push(`${shift}° hue shift`);
      }
      if (combinedRisk && !severeAmount && !severeShift) {
        flags.push(`mix ${amount}% + ${shift}°`);
      }

      if (!flags.length) {
        existing?.remove();
        return;
      }

      const next = existing ?? document.createElement("small");
      const label = mixer.querySelector("label");
      next.className = "warning";
      next.textContent = `${label?.textContent.toUpperCase()} color is out of "Color harmony": ${flags.join(" • ")}`;
      next.title = "This pair of controls is pushing the mix far from the usual harmony band. It may be intentional, but it is likely to look less natural.";

      if (!existing) {
        mixer.appendChild(next);
      }
    });
  }

  static syncReport(root: HTMLElement, theme: DerivedTheme): void {
    const reportRoot = root.querySelector<HTMLElement>(".report");
    if (!reportRoot) return;

    const rows = ColorThemeEngine.evaluate(theme);
    const existing = Array.from(reportRoot.querySelectorAll<HTMLElement>(".report-item"));

    for (let i = 0; i < Math.max(existing.length, rows.length); i++) {
      let current = existing[i];
      const row = rows[i];

      if (!current && row) {
        current = document.createElement("div");
        current.className = "report-item";
        reportRoot.append(current);
      }

      if (current && row) {
        const ratioEl = current.querySelector<HTMLElement>("strong") ?? document.createElement("strong");
        const descEl = current.querySelector<HTMLElement>("p.hint") ?? document.createElement("p");
        const minEl = current.querySelector<HTMLElement>("span") ?? document.createElement("span");

        ratioEl.textContent = `${row.ok ? "✓" : "✗"} ${row.ratio.toFixed(2)}:1`;
        ratioEl.className = row.ok ? "allowed" : "unallowed";
        descEl.textContent = row.label;
        descEl.className = "hint";
        minEl.textContent = `${row.min}:1`;

        if (!ratioEl.parentElement) current.append(ratioEl, descEl, minEl);
        else {
          if (!current.contains(ratioEl)) current.append(ratioEl);
          if (!current.contains(descEl)) current.append(descEl);
          if (!current.contains(minEl)) current.append(minEl);
        }
      }

      if (current && !row) {
        current.remove();
      }
    }
  }

  /**
   * Mixer GROUP controls (mode + counterpart) are shared by every item, so they
   * live on the mixer element itself — this is what keeps the derived output
   * consistent across the items.
   */
  static syncMixerSettings(root: HTMLElement, mixer: MixerSettings): void {
    const group = root.querySelector<HTMLElement>(".mixer[data-mixer='shared']");
    if (!group) return;

    const mode = group.querySelector<HTMLSelectElement>("select[data-control='mode']");
    if (mode) mode.value = mixer.mode ?? ColorThemeEngine.DEFAULT_MIXER.mode;
  }

  /** 🎞 One animation token per slider — newer syncs supersede stale frames. */
  static #sliderAnimations = new WeakMap<HTMLInputElement, number>();
  /** Sliders that already ran (or skipped) their entrance animation. */
  static #animatedSliders = new WeakMap<HTMLInputElement, boolean>();

  /**
   * Ramps a mixer slider from its `min` up to the target value. Called from
   * the reactive `sync()` effect (via syncMixerControls), so it also animates
   * programmatic changes (e.g. preset apply) — but never fights the user:
   * a focused slider (being dragged / keyboard-stepped) is written directly.
   */
  static #animateSlider(input: HTMLInputElement, target: number): void {
    // User is interacting with this slider — write directly, skip the ramp.
    if (document.activeElement === input) {
      this.#animatedSliders.set(input, true);
      input.value = String(target);
      return;
    }

    const firstRun = !this.#animatedSliders.get(input);
    const changed = Number(input.value) !== target;
    if (!firstRun && !changed) return; // repeat syncs with no change: no-op
    this.#animatedSliders.set(input, true);

    // Supersede any running animation on this slider.
    const token = (this.#sliderAnimations.get(input) ?? 0) + 1;
    this.#sliderAnimations.set(input, token);

    const from = Number(input.min) || 0;
    const step = Number.parseFloat(input.step) || 1;
    // Kecepatan naik — semakin besar jaraknya, semakin cepat animasinya.
    const increment = (target - from) / 10 || 1;

    requestAnimationFrame(() => {
      // Delay kecil agar browser sempat menggambar frame posisi awal (min).
      setTimeout(() => {
        let current = from;

        const stepAnimate = () => {
          if (this.#sliderAnimations.get(input) !== token) return; // superseded
          if (document.activeElement === input) { // user grabbed it mid-ramp
            input.value = String(target);
            return;
          }

          if (current < target) {
            current = Math.min(target, current + increment);
            // Bulatkan sesuai step jika diperlukan.
            input.value = String(Math.round(current / step) * step);
            requestAnimationFrame(stepAnimate);
          } else {
            input.value = String(target);
          }
        };
        stepAnimate();
      }, 50);
    });
  }

  /** Per-ITEM controls: amount + hue sliders and their read-outs. */
  static syncMixerControls(root: HTMLElement, overrides: ThemeOverrides): void {
    const mixers = root.querySelectorAll<HTMLElement>(".mixer-item[data-mixer]");
    mixers.forEach((mixer) => {
      const name = mixer.dataset.mixer!;
      const entry = overrides[name];
      if (!entry) return;

      const amount = mixer.querySelector<HTMLInputElement>("input[data-control='amount']");
      const output = mixer.querySelector<HTMLOutputElement>("output[data-control='amount-value']");
      const shift = mixer.querySelector<HTMLInputElement>("input[data-control='shift']");
      const shiftOutput = mixer.querySelector<HTMLOutputElement>("output[data-control='shift-value']");
      const target = mixer.querySelector<HTMLSelectElement>("select[data-control='target']");

      // Read-outs always show the final value; only the slider position ramps.
      if (output) {
        output.value = `${entry.amount}%`;
        output.textContent = `${entry.amount}%`;
      }
      if (shiftOutput) {
        shiftOutput.value = `${entry.shift ?? 0}°`;
        shiftOutput.textContent = `${entry.shift ?? 0}°`;
      }

      if (amount) ColorThemeKit.#animateSlider(amount, Number(entry.amount ?? 0));
      if (shift) ColorThemeKit.#animateSlider(shift, Number(entry.shift ?? 0));

      if (target) target.value = (entry.target ?? "auto") as string;
    });
  }
}
