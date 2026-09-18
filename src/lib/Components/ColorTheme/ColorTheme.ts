import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../interface";
import { Builder, } from "../Base";
import {
  ColorThemeKit,
  DEFAULT_THEME_ITEMS,
  DEFAULT_VALIDATIONS,
  type ThemeItemConfig,
  type ThemeValidationRule,
} from "./ColorTheme.kit";
import type { BaseColors } from "./ColorTheme.engine";
import {
  ColorThemeEngine,
  type DerivedTheme,
  type MixMode,
  type MixerSettings,
  type MixTarget,
  type ThemeMode,
  type ThemeOverrides,
} from "./ColorTheme.engine";

export type ColorThemeElementType =
  | "@colorizer"
  | "@colorizer>header"
  | "@colorizer>title"
  | "@colorizer>description"
  | "@colorizer>mode"

  | "@colorizer>configurator"
  | "@colorizer>configurator>picker"
  | "@colorizer>configurator>colors"
  | "@colorizer>configurator>mixer"
  | "@colorizer>configurator>mixer>item"

  | "@colorizer>output"
  | "@colorizer>output>report"
  | "@colorizer>output>codeblock"
  | "@colorizer>output>copy"
  | "@colorizer>output>reset"
  ;

export interface iColorThemeConfig extends iBuilderConfig<ColorThemeElementType> {
  primary: string; // Default primary color
  accent: string; // Default accent color,
  styles: String | Function; // Default css variables,
  mode: "light" | "dark"
  validations?: Record<string, ThemeValidationRule>;
  items?: Record<string, ThemeItemConfig>;
}

export interface iColorThemeContent {
  title?: string;
  description?: string;
}

/**
 * Mixer modes (presentation lives here, the engine only knows the values).
 * `advanced hue` is polar-only — it rotates the other way round the hue wheel,
 * which is the one thing that stays visible even when both bases share a hue.
 */
const MIX_MODE_OPTIONS: Record<MixMode, { label: string; title: string }> = {
  oklch: { label: "OKLCH", title: "Token default — the operand this token was designed with" },
  "oklch-advanced": { label: "OKLCH (Wide Range Hue)", title: "Blend into white" },
  oklab: { label: "OKLAB", title: "Blend into black" },
  srgb: { label: "SRGB", title: "Blend into transparent" },
  hsl: { label: "HSL", title: "Blend into var(--app-accent-color)" },
  "hsl-advanced": { label: "HSL (Wide Range Hue)", title: "Blend into var(--app-primary-color)" }
}

/** What the source blends into. The chromatic ones are what make modes differ. */
const MIX_TARGET_OPTIONS: Record<MixTarget, { label: string; title: string }> = {
  auto: { label: "auto", title: "Token default — the operand this token was designed with" },
  tint: { label: "tint", title: "Blend into white" },
  shade: { label: "shade", title: "Blend into black" },
  alpha: { label: "alpha", title: "Blend into transparent" },
  accent: { label: "accent", title: "Blend into var(--app-accent-color)" },
  primary: { label: "primary", title: "Blend into var(--app-primary-color)" },
  complement: { label: "rotate 180°", title: "Blend into the source hue rotated 180°" },
}

/**
 * Symmetric hue-rotation limit (degrees) for the mixer's 2nd slider.
 * −180…180 already covers the whole hue circle, so 0 stays the neutral middle.
 */
const MIX_SHIFT_LIMIT = 180;

export class ColorThemeBuilder extends Builder<ColorThemeElementType, iColorThemeConfig> {
  readonly builderId: keyof iBuilderRegistry = "color-theme";
  readonly name: keyof iBuilderRegistry = "color-theme";
  readonly stylesheet: string = "./ColorTheme.css";

  /** Reactive state: bases + mode + shared mixer settings + per-item overrides. */
  #state: { bases: BaseColors; mode: ThemeMode; mixer: MixerSettings; overrides: ThemeOverrides };
  /** Abort controller for cleaning up event listeners on destroy. */
  #abort = new AbortController();
  /** 🧲 Unwatch functions for the reactive root sync registered in initialize(). */
  #unwatch: Array<() => void> = [];

  constructor(config: Partial<iColorThemeConfig>) {
    super();
    const defaultSelector = {
      "@colorizer": { tagName: "main", className: "colorizer" },

      "@colorizer>header": { tagName: "section", className: "header" },
      "@colorizer>title": { tagName: "h3", className: "title" },
      "@colorizer>description": { tagName: "p", className: "description" },
      "@colorizer>mode": { tagName: "div", className: "control", wrapper: ".field.toggle-switch" },

      "@colorizer>configurator": { tagName: "section", className: "configurator" },
      "@colorizer>configurator>picker": { tagName: "input", attrs: { type: "color" }, className: "picker", wrapper: ".field" },
      "@colorizer>configurator>colors": { tagName: "div", className: "strip", wrapper: ".scales" },
      "@colorizer>configurator>mixer": { tagName: "div", className: "mixer" },
      "@colorizer>configurator>mixer>item": { tagName: "div", className: "mixer-item" },

      "@colorizer>output": { tagName: "section", className: "output" },
      "@colorizer>output>report": { tagName: "div", className: "report-item" },
      "@colorizer>output>codeblock": { tagName: "pre", className: "codeblock" },
      "@colorizer>output>copy": { tagName: "button", className: "copy" },
      "@colorizer>output>reset": { tagName: "button", className: "reset" }
    }

    const mergedConfig: Partial<iColorThemeConfig> = {
      ...config,
      validations: { ...DEFAULT_VALIDATIONS, ...(config?.validations ?? {}) },
      items: { ...DEFAULT_THEME_ITEMS, ...(config?.items ?? {}) },
    };

    const defaultConfig: Required<iColorThemeConfig> = {
      themeId: "default",
      namespace: "",
      emit: null,
      selectors: defaultSelector,
      primary: ColorThemeEngine.DEFAULT_BASES.primary,
      accent: ColorThemeEngine.DEFAULT_BASES.accent,
      styles: () => { },
      mode: "light",
      validations: { ...DEFAULT_VALIDATIONS },
      items: { ...DEFAULT_THEME_ITEMS },
    }

    this.config = this.resolveConfig(defaultConfig, mergedConfig)

    this.#state = {
      bases: { primary: this.config.primary, accent: this.config.accent },
      mode: this.config.mode,
      mixer: { ...ColorThemeEngine.DEFAULT_MIXER },
      overrides: Object.fromEntries(
        Object.entries(this.config.items).map(([key, value]) => [key, { ...value.default }])
      ),
    };
  }

  public prepare(_content: any, _config?: Required<iBuilderConfig<ColorThemeElementType>> | undefined): HTMLElement | Record<string, any | HTMLElement> {
    const resolvedItems = { ...DEFAULT_THEME_ITEMS, ...(this.config.items ?? {}) };
    this.#state = this.setProxy("@colorizer", {
      bases: { primary: this.config.primary, accent: this.config.accent },
      mode: this.config.mode,
      mixer: { ...ColorThemeEngine.DEFAULT_MIXER },
      overrides: Object.fromEntries(
        Object.entries(resolvedItems).map(([key, value]) => [key, { ...value.default }])
      ),
    });

    const theme = ColorThemeEngine.colorSchema(this.#state.bases, this.#state.mode, this.#state.overrides, this.#state.mixer);
    // Token vars are applied reactively inside template("@colorizer").
    return this.render("@colorizer", theme)!;
  }


  protected template(typeKey: ColorThemeElementType, el: HTMLElement, payload?: any, _props?: iActionProperty): void {
    switch (typeKey) {
      case "@colorizer":
        const header = this.render("@colorizer>header")!;
        const configurator = this.render("@colorizer>configurator", payload)!;
        const result = this.render("@colorizer>output", payload)!;
        el.append(header, configurator, result)
        break;

      case "@colorizer>header":
        const title = this.render("@colorizer>title")!;
        const description = this.render("@colorizer>description")!;
        const mode = this.render("@colorizer>mode")!;
        el.append(title, description, mode.__outer)
        break;

      case "@colorizer>configurator":
        const titleCfg = this.render("@colorizer>title", "Configurator")!;

        const pickerContainer = document.createElement("div");
        pickerContainer.className = "field group";
        pickerContainer.dataset.display = "inline";

        const primary = this.render("@colorizer>configurator>picker", { label: "Primary Color", slot: "primary", color: this.#state.bases.primary })!;
        const accent = this.render("@colorizer>configurator>picker", { label: "Accent Color", slot: "accent", color: this.#state.bases.accent })!;

        pickerContainer.append(primary.__outer, accent.__outer)

        const ramps = this.render("@colorizer>configurator>colors", {
          title: "ramps",
          theme: payload,
        })!;

        const palette = this.render("@colorizer>configurator>colors", {
          title: "palette",
          theme: payload,
        })!;

        const mixerContainer = document.createElement("div");
        const lcm = document.createElement("h5");
        lcm.className = "title";
        lcm.textContent = `Color Mixer`;

        mixerContainer.prepend(lcm);
        mixerContainer.className = "color-mixer";

        const sharedMixer = this.render("@colorizer>configurator>mixer", { label: "shared" })!;
        sharedMixer.dataset.mixer = "shared";
        mixerContainer.appendChild(sharedMixer);

        for (const i of Object.keys(this.config.items ?? DEFAULT_THEME_ITEMS)) {
          const item = this.render("@colorizer>configurator>mixer>item", { label: i })!;
          mixerContainer.appendChild(item);
        }

        el.append(titleCfg, pickerContainer, ramps.__outer, palette.__outer, mixerContainer);
        break;

      case "@colorizer>output":
        const titleReport = this.render("@colorizer>title", "WCAG Contrast Score")!;
        const reportContainer = document.createElement("div")
        reportContainer.className = "report";

        for (const report of ColorThemeEngine.evaluate(payload)) {
          reportContainer.append(this.render("@colorizer>output>report", report)!)
        }

        const titleGen = this.render("@colorizer>title", "Generated Token")!;
        const codeblock = this.render("@colorizer>output>codeblock")!;

        const actions = document.createElement("div");
        actions.className = "actions";
        const copy = this.render("@colorizer>output>copy")!;
        const reset = this.render("@colorizer>output>reset")!;
        actions.append(copy, reset)

        el.append(titleReport, reportContainer, titleGen, codeblock, actions);
        break;

      case "@colorizer>title":
        el.textContent = payload ?? "Color Theme Generator";
        break;


      case "@colorizer>description":
        el.textContent = payload ??
          "Pick two base colors — every other token is derived with color-mix() and checked for WCAG contrast.";
        break;

      case "@colorizer>mode":

        const l = document.createElement("label");
        l.textContent = "light";
        l.dataset.position = "left";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "mode";
        checkbox.dataset.bind = "mode";
        checkbox.dataset.trueValue = "dark";
        checkbox.dataset.falseValue = "light";
        checkbox.value = "dark";
        checkbox.checked = this.#state.mode === "dark";

        const slider2 = document.createElement("div");
        slider2.className = "slider";
        slider2.dataset.shape = "round";

        el.append(checkbox, slider2);
        el.__outer.append(l);

        break;

      case "@colorizer>configurator>picker":

        const lbl = document.createElement("label");
        lbl.textContent = payload.label;
        lbl.htmlFor = payload.slot;

        el.__outer.prepend(lbl)
        el.__outer.dataset.slot = payload.slot;
        el.id = payload.slot;
        (el as HTMLInputElement).value = payload.color;
        (el as HTMLInputElement).type = "color";
        (el as HTMLInputElement).name = payload.slot;
        (el as HTMLInputElement).dataset.bind = `bases.${payload.slot}`;
        el.dataset.slot = payload.slot;

        break;

      case "@colorizer>configurator>colors":

        const lc = document.createElement("h5");
        lc.className = "title";
        lc.textContent = `Color ${payload.title}`;

        el.__outer.prepend(lc);
        el.__outer.classList.add(payload.title);

        break;

      case "@colorizer>configurator>mixer":
        el.classList.add("mixer");
        el.dataset.mixer = "shared";

        const sharedLabel = document.createElement("label");
        sharedLabel.textContent = "Mix Mode";

        const sField = document.createElement("div");
        sField.className = "field";
        const modeSelect = document.createElement("select");
        modeSelect.dataset.control = "mode";
        modeSelect.ariaLabel = "interpolation mode";
        modeSelect.title = "Interpolation mode — color space and hue path";
        modeSelect.name = "mode";
        modeSelect.dataset.bind = "mixer.mode";

        for (const m in MIX_MODE_OPTIONS) {
          if (!Object.hasOwn(MIX_MODE_OPTIONS, m)) continue;
          const option = document.createElement("option");
          option.value = m;
          option.label = (MIX_MODE_OPTIONS as any)[m]["label"];
          option.title = m.includes("advanced")
            ? `${m} — polar hue path, travels the long way round the hue wheel`
            : `${m} — interpolation only, no hue path`;
          modeSelect.append(option);
        }

        sField.append(modeSelect);

        el.append(sharedLabel, sField);
        break;

      case "@colorizer>configurator>mixer>item":
        {
          const itemConfig = this.config.items?.[payload.label] ?? DEFAULT_THEME_ITEMS[payload.label] ?? {
            default: { amount: 50, shift: 0, target: "auto" }
          };
          const fallback = itemConfig.default.amount ?? 50;
          const fallbackHue = itemConfig.default.shift ?? 0;
          const fallbackTarget = itemConfig.default.target ?? "auto";

          el.classList.add("mixer-item");
          el.dataset.mixer = payload.label;

          const itemLabel = document.createElement("label");
          itemLabel.textContent = payload.label;

          const itemField = document.createElement("div");
          itemField.className = "field";
          const slider = document.createElement("input");
          slider.type = "range";
          slider.dataset.control = "amount";
          slider.min = "0";
          slider.max = "100";
          slider.step = "1";
          slider.dataset.bind = `overrides.${payload.label}.amount`;
          slider.value = String(fallback);
          slider.ariaLabel = `${payload.label} mix amount`;
          slider.title = "Mix amount — how much of the source color survives the mix";

          const itemOutput = document.createElement("output");
          itemOutput.dataset.control = 'value';
          itemOutput.value = `${fallback}%`;
          itemOutput.textContent = `${fallback}%`;
          itemField.append(slider, itemOutput);

          const itemShiftField = document.createElement("div");
          itemShiftField.className = "field";
          const hueSlider = document.createElement("input");
          hueSlider.type = "range";
          hueSlider.dataset.control = "shift";
          hueSlider.min = String(-MIX_SHIFT_LIMIT);
          hueSlider.max = String(MIX_SHIFT_LIMIT);
          hueSlider.step = "1";
          hueSlider.dataset.bind = `overrides.${payload.label}.shift`;
          hueSlider.value = String(fallbackHue);
          hueSlider.ariaLabel = `${payload.label} hue rotation`;
          hueSlider.title = "Hue rotation — rotates the source color's hue before mixing";

          const hueOutput = document.createElement("output");
          hueOutput.dataset.control = 'shift-value';
          hueOutput.value = `${fallbackHue}°`;
          hueOutput.textContent = `${fallbackHue}°`;
          itemShiftField.append(hueSlider, hueOutput);

          const itemTargetField = document.createElement("div");
          itemTargetField.className = "field";
          const targetSelect = document.createElement("select");
          targetSelect.dataset.control = "target";
          targetSelect.ariaLabel = `${payload.label} mix counterpart`;
          targetSelect.title = "Counterpart — what the source color blends into";
          targetSelect.dataset.bind = `overrides.${payload.label}.target`;

          for (const t in MIX_TARGET_OPTIONS) {
            if (!Object.hasOwn(MIX_TARGET_OPTIONS, t)) continue;
            const option = document.createElement("option");
            option.value = t;
            option.label = (MIX_TARGET_OPTIONS as any)[t]["label"];
            option.title = (MIX_TARGET_OPTIONS as any)[t]["title"];
            option.selected = t === fallbackTarget;
            targetSelect.append(option);
          }

          itemTargetField.append(targetSelect);

          el.append(itemLabel, itemTargetField, itemField, itemShiftField);
          break;
        }

      case "@colorizer>output>report":

        const val = document.createElement("strong");
        val.textContent = `${payload.ok ? "✓" : "✗"} ${payload.ratio.toFixed(2)}:1`;
        val.className = `${payload.ok ? "allowed" : "unallowed"}`;

        const desc = this.render("@colorizer>description", payload.label)!;

        const val2 = document.createElement("span");
        val2.textContent = `${payload.min}:1`

        el.append(val, desc, val2)
        break;

      case "@colorizer>output>codeblock":

        const code = document.createElement("code");
        el.appendChild(code);
        break;

      case "@colorizer>output>copy":
        el.textContent = "Copy CSS";
        break;

      case "@colorizer>output>reset":
        el.textContent = "Reset";
        break;
    }
  }

  private deriveTheme(): DerivedTheme {
    return ColorThemeEngine.colorSchema(this.#state.bases, this.#state.mode, this.#state.overrides, this.#state.mixer);
  }

  private sync(root: HTMLElement): void {
    const theme = this.deriveTheme();

    for (const [key, value] of Object.entries(theme.tokens)) {
      root.style.setProperty(key, value);
    }

    const codeEl = root.querySelector<HTMLElement>("code");
    if (codeEl) {
      codeEl.textContent = ColorThemeEngine.toCssText(theme.tokens, this.#state.mode, this.#state.bases);
    }

    ColorThemeKit.syncReport(root, theme);
    ColorThemeKit.syncThemeStrips(root, theme, this.config.items ?? DEFAULT_THEME_ITEMS);
    ColorThemeKit.syncMixerSettings(root, this.#state.mixer);
    ColorThemeKit.syncMixerControls(root, this.#state.overrides);
    ColorThemeKit.syncHarmonyNotice(root, this.#state.overrides);
    ColorThemeKit.syncBaseColorWarning(root, this.#state.bases, this.config.validations ?? DEFAULT_VALIDATIONS, theme);
    ColorThemeKit.syncModeControl(root, this.#state.mode);
  }

  /**
   * Everything state → UI is already wired by template() effects.
   * initialize() only wires user input → state (bind) + buttons.
   */
  public initialize(root?: HTMLElement): void {
    if (!root) return;

    this.bindState(root, this.#state);
    this.#unwatch.push(this.proxyRuntime.watchEffect(() => this.sync(root)));
    this.initializeActions(root);
  }

  /** Copy / Reset buttons. */
  private initializeActions(root: HTMLElement): void {
    const copyBtn = root.querySelector<HTMLButtonElement>("button.copy")!;
    const resetBtn = root.querySelector<HTMLButtonElement>("button.reset")!;
    const codeEl = this.load("@colorizer>output>codeblock")?.querySelector("code");
    const opts = { signal: this.#abort.signal };

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeEl?.textContent || "");
        copyBtn.textContent = "Copied ✓";
      } catch {
        copyBtn.textContent = "Copy failed";
      }
      setTimeout(() => (copyBtn.textContent = "Copy CSS"), 1500);
    }, opts);

    resetBtn.addEventListener("click", () => {
      // 🔁 Just mutate the reactive state — every effect re-runs on its own.
      this.#state.bases.primary = this.config.primary;
      this.#state.bases.accent = this.config.accent;
      this.#state.mode = this.config.mode;
      this.#state.mixer = { ...ColorThemeEngine.DEFAULT_MIXER };

      for (const [key, value] of Object.entries(this.config.items ?? DEFAULT_THEME_ITEMS)) {
        this.#state.overrides[key] = { ...value.default };
      }
    }, opts);
  }

  public destroy(): void {
    for (const unwatch of this.#unwatch) unwatch();
    this.#unwatch.length = 0;
    this.#abort.abort();
  }
}
