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
  | "@colorizer>configurator>mixer>slider"
  | "@colorizer>configurator>mixer>selector"

  | "@colorizer>output"
  | "@colorizer>output>report"
  | "@colorizer>output>codeblock"
  | "@colorizer>output>copy"
  | "@colorizer>output>reset"
  | "@colorizer>output>save"
  ;

export interface iColorThemePreset {
  label: string;
  primary: string;
  accent: string;
  mode: ThemeMode;
  mixer: MixerSettings;
  overrides: ThemeOverrides;
}

export interface iColorThemeConfig extends iBuilderConfig<ColorThemeElementType> {
  primary: string; // Default primary color
  accent: string; // Default accent color,
  styles: String | Function; // Default css variables,
  mode: "light" | "dark"
  disableValidation?: boolean;
  validations?: Record<string, ThemeValidationRule>;
  items?: Record<string, ThemeItemConfig>;
  textContent?: Record<string, string>;
  presets?: Record<string, iColorThemePreset>;
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

export const DEFAULT_TEXT_CONTENT: Record<string, string> = {
  title: "Color Theme Generator",
  description: "Pick two base colors — every other token is derived with color-mix() and checked for WCAG contrast.",
  configurator: "Configurator",
  primaryLabel: "Primary Color",
  accentLabel: "Accent Color",
  rampsHeader: "primary color ramps",
  paletteHeader: "color palette",
  mixerTitle: "Color Mixer",
  reportTitle: "WCAG Contrast Score",
  codeTitle: "Generated Token",
  copy: "Copy CSS",
  reset: "Reset",
  save: "Save preset",
  modeLabel: "light",
};

export const DEFAULT_PRESETS: Record<string, iColorThemePreset> = {};

export class ColorThemeBuilder extends Builder<ColorThemeElementType, iColorThemeConfig> {
  readonly builderId: keyof iBuilderRegistry = "color-theme";
  readonly name: keyof iBuilderRegistry = "color-theme";
  readonly stylesheet: string = "./ColorTheme.css";

  /** Reactive state: bases + mode + shared mixer settings + per-item overrides. */
  #state: { bases: BaseColors; mode: ThemeMode; mixer: MixerSettings; overrides: ThemeOverrides };
  /** Preset store lives on the instance because Builder.config is frozen at runtime. */
  #presets: Record<string, iColorThemePreset>;
  /** Abort controller for cleaning up event listeners on destroy. */
  #abort = new AbortController();
  /** 🧲 Unwatch functions for the reactive root sync registered in initialize(). */
  #unwatch: Array<() => void> = [];

  constructor(config: Partial<iColorThemeConfig>) {
    super();
    const defaultSelector = {
      "@colorizer": { tagName: "main", className: "colorizer" },

      "@colorizer>header": { tagName: "section", className: "header" },
      "@colorizer>title": { tagName: "h4", className: "title" },
      "@colorizer>description": { tagName: "p", className: "description" },
      "@colorizer>mode": { tagName: "div", className: "control", wrapper: ".field.toggle-switch" },

      "@colorizer>configurator": { tagName: "section", className: "configurator" },
      "@colorizer>configurator>picker": { tagName: "input", attrs: { type: "color" }, className: "picker", wrapper: ".field" },
      "@colorizer>configurator>colors": { tagName: "div", className: "strip", wrapper: ".scales" },
      "@colorizer>configurator>mixer": { tagName: "div", className: "mixer" },
      "@colorizer>configurator>mixer>item": { tagName: "div", className: "mixer-item" },
      "@colorizer>configurator>mixer>slider": { tagName: "input", attrs: { type: "range" }, className: "mixer-slider", wrapper: ".field" },
      "@colorizer>configurator>mixer>selector": { tagName: "select", className: "mixer-selector", wrapper: ".field" },

      "@colorizer>output": { tagName: "section", className: "output" },
      "@colorizer>output>report": { tagName: "div", className: "report-item" },
      "@colorizer>output>codeblock": { tagName: "pre", className: "codeblock" },
      "@colorizer>output>copy": { tagName: "button", className: "copy" },
      "@colorizer>output>reset": { tagName: "button", className: "reset" },
      "@colorizer>output>save": { tagName: "button", className: "save" }
    }

    const mergedConfig: Partial<iColorThemeConfig> = {
      ...config,
      disableValidation: config?.disableValidation ?? false,
      validations: { ...DEFAULT_VALIDATIONS, ...(config?.validations ?? {}) },
      items: { ...DEFAULT_THEME_ITEMS, ...(config?.items ?? {}) },
      textContent: { ...DEFAULT_TEXT_CONTENT, ...(config?.textContent ?? {}) },
      presets: { ...DEFAULT_PRESETS, ...(config?.presets ?? {}) },
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
      disableValidation: false,
      validations: { ...DEFAULT_VALIDATIONS },
      items: { ...DEFAULT_THEME_ITEMS },
      textContent: { ...DEFAULT_TEXT_CONTENT },
      presets: { ...DEFAULT_PRESETS },
    }

    this.config = this.resolveConfig(defaultConfig, mergedConfig)
    this.#presets = { ...this.config.presets };

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
        const titleCfg = this.render("@colorizer>title", this.config.textContent?.configurator ?? DEFAULT_TEXT_CONTENT.configurator)!;

        const pickerContainer = document.createElement("div");
        pickerContainer.className = "field group";
        pickerContainer.dataset.display = "inline";

        const primary = this.render("@colorizer>configurator>picker", {
          label: this.config.textContent?.primaryLabel ?? DEFAULT_TEXT_CONTENT.primaryLabel,
          slot: "primary",
          color: this.#state.bases.primary,
        })!;
        const accent = this.render("@colorizer>configurator>picker", {
          label: this.config.textContent?.accentLabel ?? DEFAULT_TEXT_CONTENT.accentLabel,
          slot: "accent",
          color: this.#state.bases.accent,
        })!;

        pickerContainer.append(primary.__outer, accent.__outer)

        const ramps = this.render("@colorizer>configurator>colors", {
          title: "ramps",
          header: this.config.textContent?.rampsHeader ?? DEFAULT_TEXT_CONTENT.rampsHeader,
          theme: payload,
        })!;

        const palette = this.render("@colorizer>configurator>colors", {
          title: "palette",
          header: this.config.textContent?.paletteHeader ?? DEFAULT_TEXT_CONTENT.paletteHeader,
          theme: payload,
        })!;

        const mixerContainer = document.createElement("div");
        const lcm = document.createElement("h5");
        lcm.className = "title";
        lcm.textContent = this.config.textContent?.mixerTitle ?? DEFAULT_TEXT_CONTENT.mixerTitle;

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
        const titleReport = this.render("@colorizer>title", this.config.textContent?.reportTitle ?? DEFAULT_TEXT_CONTENT.reportTitle)!;
        const reportContainer = document.createElement("div")
        reportContainer.className = "report";

        for (const report of ColorThemeEngine.evaluate(payload)) {
          reportContainer.append(this.render("@colorizer>output>report", report)!)
        }

        const titleGen = this.render("@colorizer>title", this.config.textContent?.codeTitle ?? DEFAULT_TEXT_CONTENT.codeTitle)!;
        const codeblock = this.render("@colorizer>output>codeblock")!;

        const actions = document.createElement("div");
        actions.className = "actions";
        const copy = this.render("@colorizer>output>copy")!;
        const reset = this.render("@colorizer>output>reset")!;
        const save = this.render("@colorizer>output>save")!;
        actions.append(copy, reset, save)

        el.append(titleReport, reportContainer, titleGen, codeblock, actions);
        break;

      case "@colorizer>title":
        el.textContent = payload ?? this.config.textContent?.title ?? DEFAULT_TEXT_CONTENT.title;
        break;


      case "@colorizer>description":
        el.textContent = payload ?? this.config.textContent?.description ?? DEFAULT_TEXT_CONTENT.description;
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
        lc.textContent = payload.header;

        el.__outer.prepend(lc);
        el.__outer.classList.add(payload.title.split(" ").join(","));

        break;

      case "@colorizer>configurator>mixer":
        el.classList.add("mixer");
        el.dataset.mixer = "shared";

        const sharedLabel = document.createElement("label");
        sharedLabel.textContent = "Mix Mode";

        const { field: sField, select: modeSelect } = this.createSelectControl({
          value: this.#state.mixer.mode,
          bind: "mixer.mode",
          control: "mode",
          ariaLabel: "interpolation mode",
          title: "Interpolation mode — color space and hue path",
          options: Object.fromEntries(
            Object.entries(MIX_MODE_OPTIONS).map(([key, option]) => [key, {
              label: option.label,
              title: key.includes("advanced")
                ? `${key} — polar hue path, travels the long way round the hue wheel`
                : `${key} — interpolation only, no hue path`,
            }])
          ),
        });

        modeSelect.name = "mode";
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

          const amountControl = this.createRangeControl({
            value: fallback,
            min: 0,
            max: 100,
            bind: `overrides.${payload.label}.amount`,
            ariaLabel: `${payload.label} mix amount`,
            title: "Mix amount — how much of the source color survives the mix",
            outputSuffix: "%",
            control: "amount",
          });
          amountControl.input.dataset.control = "amount";

          const shiftControl = this.createRangeControl({
            value: fallbackHue,
            min: -MIX_SHIFT_LIMIT,
            max: MIX_SHIFT_LIMIT,
            bind: `overrides.${payload.label}.shift`,
            ariaLabel: `${payload.label} hue rotation`,
            title: "Hue rotation — rotates the source color's hue before mixing",
            outputSuffix: "°",
            control: "shift",
          });
          shiftControl.output.dataset.control = "shift-value";

          const targetControl = this.createSelectControl({
            value: fallbackTarget,
            bind: `overrides.${payload.label}.target`,
            control: "target",
            ariaLabel: `${payload.label} mix counterpart`,
            title: "Counterpart — what the source color blends into",
            options: Object.fromEntries(
              Object.entries(MIX_TARGET_OPTIONS).map(([key, option]) => [key, { label: option.label, title: option.title }])
            ),
          });
          targetControl.select.dataset.control = "target";

          el.append(itemLabel, targetControl.field, amountControl.field, shiftControl.field);
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
        el.textContent = this.config.textContent?.copy ?? DEFAULT_TEXT_CONTENT.copy;
        break;

      case "@colorizer>output>reset":
        el.textContent = this.config.textContent?.reset ?? DEFAULT_TEXT_CONTENT.reset;
        break;

      case "@colorizer>output>save":
        el.textContent = this.config.textContent?.save ?? DEFAULT_TEXT_CONTENT.save;
        break;

      case "@colorizer>configurator>mixer>slider": {
        const range = el as HTMLInputElement;
        range.type = "range";
        range.value = String(payload.value ?? 0);
        range.min = String(payload.min ?? 0);
        range.max = String(payload.max ?? 100);
        range.step = String(payload.step ?? 1);
        range.name = payload.name ?? "range";
        range.dataset.bind = payload.bind ?? "";
        range.dataset.control = payload.control ?? "range";
        range.ariaLabel = payload.ariaLabel ?? "mixer slider";
        range.title = payload.title ?? "mixer slider";
        break;
      }

      case "@colorizer>configurator>mixer>selector": {
        const select = el as HTMLSelectElement;
        select.name = payload.name ?? "select";
        select.dataset.bind = payload.bind ?? "";
        select.dataset.control = payload.control ?? "select";
        select.ariaLabel = payload.ariaLabel ?? "mixer selector";
        select.title = payload.title ?? "mixer selector";

        const options = (payload.options ?? {}) as Record<string, { label: string; title: string }>;
        for (const [key, option] of Object.entries(options)) {
          const optionEl = document.createElement("option");
          optionEl.value = key;
          optionEl.label = option.label;
          optionEl.title = option.title;
          optionEl.selected = key === payload.value;
          select.append(optionEl);
        }
        break;
      }
    }
  }

  private createRangeControl(config: {
    value: number;
    min: number;
    max: number;
    step?: number;
    bind: string;
    ariaLabel: string;
    title: string;
    outputSuffix?: string;
    control?: string;
  }): { field: HTMLDivElement; input: HTMLInputElement; output: HTMLOutputElement } {
    const field = document.createElement("div");
    field.className = "field";

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(config.min);
    input.max = String(config.max);
    input.step = String(config.step ?? 1);
    input.value = String(config.value);
    input.dataset.bind = config.bind;
    input.dataset.control = config.control ?? "range";
    input.ariaLabel = config.ariaLabel;
    input.title = config.title;

    const output = document.createElement("output");
    output.dataset.control = config.control ?? "value";
    output.value = `${config.value}${config.outputSuffix ?? ""}`;
    output.textContent = `${config.value}${config.outputSuffix ?? ""}`;

    field.append(input, output);

    requestAnimationFrame(() => {
      // Menggunakan setTimeout 50ms agar browser sempat menggambar frame posisi awal (min)
      setTimeout(() => {
        let current = config.min;
        const target = config.value;
        // Tentukan kecepatan naik (semakin besar angkanya, semakin cepat animasinya)
        const increment = (target - current) / 10 || 1;

        function stepAnimate() {
          if (current < target) {
            current = Math.min(target, current + increment);
            // Bulatkan sesuai step jika diperlukan (opsional)
            input.value = String(config.step ? Math.round(current / config.step) * config.step : Math.round(current));
            requestAnimationFrame(stepAnimate);
          }
        }
        stepAnimate();
      }, 50);
    });

    return { field, input, output };
  }

  private createSelectControl(config: {
    value: string;
    bind: string;
    options: Record<string, { label: string; title: string }>;
    ariaLabel: string;
    title: string;
    control?: string;
  }): { field: HTMLDivElement; select: HTMLSelectElement } {
    const field = document.createElement("div");
    field.className = "field";

    const select = document.createElement("select");
    select.dataset.bind = config.bind;
    select.dataset.control = config.control ?? "select";
    select.ariaLabel = config.ariaLabel;
    select.title = config.title;

    for (const [key, option] of Object.entries(config.options)) {
      const optionEl = document.createElement("option");
      optionEl.value = key;
      optionEl.label = option.label;
      optionEl.title = option.title;
      optionEl.selected = key === config.value;
      select.append(optionEl);
    }

    field.append(select);
    return { field, select };
  }

  public createPreset(label: string): iColorThemePreset {
    const snapshot = {
      label,
      primary: this.#state.bases.primary,
      accent: this.#state.bases.accent,
      mode: this.#state.mode,
      mixer: { ...this.#state.mixer },
      overrides: Object.fromEntries(
        Object.entries(this.#state.overrides).map(([key, value]) => [key, { ...value }]),
      ),
    };

    this.#presets = { ...this.#presets, [label]: snapshot };
    this.setConfig({ presets: this.#presets });
    console.log({ snapshot })
    return snapshot;
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

    if (!this.config.disableValidation) {
      ColorThemeKit.syncHarmonyNotice(root, this.#state.overrides);
      ColorThemeKit.syncBaseColorWarning(root, this.#state.bases, this.#state.mode, this.config.validations ?? DEFAULT_VALIDATIONS, theme);
    }

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
    const saveBtn = root.querySelector<HTMLButtonElement>("button.save")!;
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

    saveBtn.addEventListener("click", () => {
      const label = window.prompt("Preset name", `preset-${Object.keys(this.#presets).length + 1}`) ?? `preset-${Date.now()}`;
      const preset = this.createPreset(label.trim() || `preset-${Date.now()}`);
      saveBtn.textContent = `Saved: ${preset.label}`;
      setTimeout(() => (saveBtn.textContent = this.config.textContent?.save ?? DEFAULT_TEXT_CONTENT.save), 1500);
    }, opts);
  }

  public destroy(): void {
    for (const unwatch of this.#unwatch) unwatch();
    this.#unwatch.length = 0;
    this.#abort.abort();
  }
}
