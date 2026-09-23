import type { iActionProperty, iBuilderConfig, iBuilderRegistry } from "../../../interface";
import { Builder } from "../../Base";
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
import { ColorThemePresets, type iColorThemePreset } from "./ColorTheme.presets";
import { THEME_TOKENS_EVENT, type iThemeTokensDetail } from "../Editor.preview";

export type ColorThemeElementType =
  | "@colorizer"

  | "@colorizer>header"
  | "@colorizer>title"
  | "@colorizer>description"
  | "@colorizer>mode"
  | "@colorizer>preset"

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


export interface iColorThemeConfig extends iBuilderConfig<ColorThemeElementType> {
  primary: string; // Default primary color
  accent: string; // Default accent color,
  styles: String | Function; // Default css variables,
  mode: "light" | "dark"
  disableValidation?: boolean | undefined;
  validations?: Record<string, ThemeValidationRule>;
  items?: Record<string, ThemeItemConfig>;
  textContent?: Record<string, string>;
  presets?: iColorThemePreset[];
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


type iColorizerState = {
  bases: BaseColors;
  mode: ThemeMode;
  mixer: MixerSettings;
  overrides: ThemeOverrides;
  preset: string;
};



export class ColorThemeBuilder extends Builder<ColorThemeElementType, iColorThemeConfig> {
  readonly builderId: keyof iBuilderRegistry = "color-theme";
  readonly name: keyof iBuilderRegistry = "color-theme";
  readonly stylesheet: string = "./ColorTheme.css";

  /** 🧩 Reactive state, built lazily on first access: `create()` reaches it
   *  through prepare(), an attach()-only builder reaches it through its
   *  template/initialize — either way it is ALWAYS the proxy (never a plain
   *  object), so watchEffect/bindState work on both paths. */
  #reactiveState: iColorizerState | null = null;
  get #state(): iColorizerState {
    return (this.#reactiveState ??= this.setProxy("@colorizer", {
      bases: { primary: this.config.primary, accent: this.config.accent },
      mode: this.config.mode,
      mixer: { ...ColorThemeEngine.DEFAULT_MIXER },
      preset: "gum",
      overrides: Object.fromEntries(
        Object.entries(this.config.items ?? DEFAULT_THEME_ITEMS).map(([key, value]) => [key, { ...value.default }])
      ),
    })) as iColorizerState;
  }

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
      "@colorizer>mode": { tagName: "div", className: "switch control", wrapper: ".field" },
      "@colorizer>preset": { tagName: "button", className: "controls save", attrs: { "data-position": "right" }, wrapper: ".field.actions" },

      "@colorizer>configurator": { tagName: "aside", className: "configurator" },
      "@colorizer>configurator>picker": { tagName: "input", attrs: { type: "color" }, className: "picker", wrapper: ".field" },
      "@colorizer>configurator>colors": { tagName: "div", className: "strip", wrapper: ".scales" },
      "@colorizer>configurator>mixer": { tagName: "div", className: "mixer" },
      "@colorizer>configurator>mixer>item": { tagName: "div", className: "mixer-item" },
      "@colorizer>configurator>mixer>slider": { tagName: "input", attrs: { type: "range" }, wrapper: ".field" },
      "@colorizer>configurator>mixer>selector": { tagName: "select", wrapper: ".field" },

      "@colorizer>output": { tagName: "aside", className: "output" },
      "@colorizer>output>report": { tagName: "div", className: "report-item" },
      "@colorizer>output>codeblock": { tagName: "pre", className: "codeblock" },
      "@colorizer>output>copy": { tagName: "button", className: "copy" },
      "@colorizer>output>reset": { tagName: "button", className: "reset" },

    }

    const defaultConfig: Required<iColorThemeConfig> = {
      themeId: "default",
      namespace: "",
      emit: null,
      selectors: defaultSelector,
      styles: () => { },
      // specific to color theme
      primary: ColorThemeEngine.DEFAULT_BASES.primary,
      accent: ColorThemeEngine.DEFAULT_BASES.accent,
      mode: "dark",
      disableValidation: config?.disableValidation ?? false,
      validations: { ...DEFAULT_VALIDATIONS, ...(config?.validations ?? {}) },
      items: { ...DEFAULT_THEME_ITEMS, ...(config?.items ?? {}) },
      textContent: { ...DEFAULT_TEXT_CONTENT, ...(config?.textContent ?? {}) },
      presets: [...ColorThemePresets, ...(config?.presets ?? [])],
    }

    this.config = this.resolveConfig(defaultConfig, config)
  }

  public prepare(_content: any, _config?: Required<iBuilderConfig<ColorThemeElementType>> | undefined): HTMLElement | Record<string, any | HTMLElement> {
    const theme = this.deriveTheme();
    // Token vars are applied reactively inside template("@colorizer").
    // Only the "whole component" entry builds this root: a parent that wants
    // individual keys uses attach() instead, and then create()/prepare() never
    // run at all.
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

      case "@colorizer>preset":
        const sPreset = this.render("@colorizer>configurator>mixer>selector", {
          // ⚠️ No data-bind/name here: preset selection is a COMMAND (applies
          // derived state in applyPreset), not a plain value binding. Binding
          // it would add a second change listener that double-writes
          // `state.preset`. `name: ""` avoids the render helper's `?? "select"`
          // default, which would bind to a bogus `state.select` path.
          value: this.#state.preset,
          name: "preset",
          // bind: "preset",
          control: "preset",
          ariaLabel: "preset selector",
          title: "select preset color",
          placeholder: "Select Presets",
          options: this.config.presets
        })!;

        const floppyIcon = document.createElement("i");
        floppyIcon.className = "floppy disk icon"
        el.title = "Click to Save the Preset"
        el.appendChild(floppyIcon);
        el.__outer.prepend(sPreset.__inner);
        break;

      case "@colorizer>configurator":
        const titleCfg = this.render("@colorizer>title", this.config.textContent?.configurator ?? DEFAULT_TEXT_CONTENT.configurator)!;
        const column = document.createElement("div");
        column.className = "column color-picker";

        const preset = this.render("@colorizer>preset")!;

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

        column.append(preset?.__outer, pickerContainer, ramps.__outer, palette.__outer)

        const mixerContainer = document.createElement("div");
        const lcm = document.createElement("h5");
        lcm.className = "title";
        lcm.textContent = this.config.textContent?.mixerTitle ?? DEFAULT_TEXT_CONTENT.mixerTitle;

        mixerContainer.prepend(lcm);
        mixerContainer.className = "column color-mixer";

        const sharedMixer = this.render("@colorizer>configurator>mixer", { label: "shared" })!;
        sharedMixer.dataset.mixer = "shared";
        mixerContainer.appendChild(sharedMixer);

        for (const i of Object.keys(this.config.items ?? DEFAULT_THEME_ITEMS)) {
          const item = this.render("@colorizer>configurator>mixer>item", { label: i })!;
          mixerContainer.appendChild(item);
        }

        el.append(titleCfg, column, mixerContainer);
        break;

      case "@colorizer>output":
        const titleReport = this.render("@colorizer>title", this.config.textContent?.reportTitle ?? DEFAULT_TEXT_CONTENT.reportTitle)!;
        const reportContainer = document.createElement("div")
        reportContainer.className = "report";

        // `payload` is whatever attach() brought in; when the key is built without
        // one (or through create()), derive it from the builder's own state.
        const theme = payload ?? this.deriveTheme();
        for (const report of ColorThemeEngine.evaluate(theme)) {
          reportContainer.append(this.render("@colorizer>output>report", report)!)
        }

        const titleGen = this.render("@colorizer>title", this.config.textContent?.codeTitle ?? DEFAULT_TEXT_CONTENT.codeTitle)!;
        const codeblock = this.render("@colorizer>output>codeblock")!;

        const actions = document.createElement("div");
        actions.className = "actions";
        const copy = this.render("@colorizer>output>copy")!;
        const reset = this.render("@colorizer>output>reset")!;
        actions.append(copy, reset)

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

        const sliderKnob = document.createElement("div");
        sliderKnob.className = "slider";
        sliderKnob.dataset.shape = "round";

        el.append(checkbox, sliderKnob);
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

        const modeSelect = this.render("@colorizer>configurator>mixer>selector", {
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
        }) as HTMLSelectElement;

        modeSelect.name = "mode";
        el.append(sharedLabel, modeSelect.__outer);
        break;

      case "@colorizer>configurator>mixer>item":

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

        const amountControl = this.render("@colorizer>configurator>mixer>slider", {
          value: fallback,
          min: 0,
          max: 100,
          bind: `overrides.${payload.label}.amount`,
          ariaLabel: `${payload.label} mix amount`,
          title: "Mix amount — how much of the source color survives the mix",
          outputSuffix: "%",
          control: "amount",
        }) as HTMLInputElement;

        const shiftControl = this.render("@colorizer>configurator>mixer>slider", {
          value: fallbackHue,
          min: -MIX_SHIFT_LIMIT,
          max: MIX_SHIFT_LIMIT,
          bind: `overrides.${payload.label}.shift`,
          ariaLabel: `${payload.label} hue rotation`,
          title: "Hue rotation — rotates the source color's hue before mixing",
          outputSuffix: "°",
          control: "shift",
        }) as HTMLInputElement;

        const targetControl = this.render("@colorizer>configurator>mixer>selector", {
          value: fallbackTarget,
          bind: `overrides.${payload.label}.target`,
          control: "target",
          ariaLabel: `${payload.label} mix counterpart`,
          title: "Counterpart — what the source color blends into",
          options: Object.fromEntries(
            Object.entries(MIX_TARGET_OPTIONS).map(([key, option]) => [key, { label: option.label, title: option.title }])
          ),
        }) as HTMLSelectElement

        targetControl.dataset.control = "target";

        el.append(itemLabel, targetControl.__outer, amountControl.__outer, shiftControl.__outer);
        break;


      case "@colorizer>output>report":

        const val = document.createElement("strong");
        val.textContent = `${payload.ok ? "✓" : "✗"} ${payload.ratio.toFixed(2)}:1`;
        val.className = `${payload.ok ? "allowed" : "unallowed"}`;

        const desc = this.render("@colorizer>description", payload.label)!;
        desc.className = "hint"
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

      case "@colorizer>configurator>mixer>slider":
        const range = el as HTMLInputElement;
        range.type = "range";
        range.min = String(payload.min ?? 0);
        range.max = String(payload.max ?? 100);
        range.step = String(payload.step ?? 1);
        range.value = String(payload.value ?? 0);
        range.name = payload.name ?? "range";
        range.dataset.bind = payload.bind ?? "";
        range.dataset.control = payload.control ?? "range";
        range.ariaLabel = payload.ariaLabel ?? "mixer slider";
        range.title = payload.title ?? "mixer slider";

        const output = document.createElement("output");
        output.dataset.control = `${payload.control}-value`;
        output.value = `${payload.value}${payload.outputSuffix ?? ""}`;
        output.textContent = `${payload.value}${payload.outputSuffix ?? ""}`;

        el.__outer.append(output);

        // 🎞 The min → value entrance animation lives in
        // ColorThemeKit.syncMixerControls (runs inside the reactive sync
        // effect), so preset applies get animated too — not just first render.

        break;


      case "@colorizer>configurator>mixer>selector":
        const select = el as HTMLSelectElement;
        if (payload.name) select.name = payload.name ?? "select";
        if (payload.bind) select.dataset.bind = payload.bind ?? "";
        if (payload.control) select.dataset.control = payload.control ?? "select";
        if (payload.ariaLabel) select.ariaLabel = payload.ariaLabel ?? "mixer selector";
        if (payload.title) select.title = payload.title ?? "mixer selector";

        if (payload.placeholder) {
          const placeholderEl = document.createElement("option");
          placeholderEl.textContent = payload.placeholder;
          placeholderEl.value = "";
          placeholderEl.disabled = true;
          placeholderEl.selected = true;
          select.append(placeholderEl)
        }

        const options = payload.options ?? {};
        const entries = Array.isArray(options)
          ? options.map((option: iColorThemePreset) => [option.label, { label: option.label, title: option.label }] as const)
          : Object.entries(options) as Array<[string, { label: string; title: string }]>;

        for (const [key, option] of entries) {
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

    const existingIndex = this.config.presets.findIndex((preset) => preset.label === label);
    const presets = existingIndex >= 0
      ? this.config.presets.map((preset, index) => index === existingIndex ? snapshot : preset)
      : [...this.config.presets, snapshot];
    this.setConfig({ presets: presets });
    return snapshot;
  }

  /**
   * Broadcast the derived tokens on `window` (THEME_TOKENS_EVENT). The
   * Editor builder listens and forwards them into the preview iframe —
   * this builder stays decoupled from any preview mechanics.
   */
  #broadcastTokens(theme: DerivedTheme): void {
    window.dispatchEvent(new CustomEvent<iThemeTokensDetail>(THEME_TOKENS_EVENT, {
      detail: { tokens: theme.tokens, mode: this.#state.mode },
    }));
  }

  private applyPreset(label: string): void {
    const preset = this.config.presets.find((item) => item.label === label);
    if (!preset) return;

    this.#state.preset = preset.label;
    this.#state.bases.primary = preset.primary;
    this.#state.bases.accent = preset.accent;
    this.#state.mode = preset.mode;
    this.#state.mixer = { ...preset.mixer };

    const items = this.config.items ?? DEFAULT_THEME_ITEMS;
    for (const [key, value] of Object.entries(items)) {
      this.#state.overrides[key] = { ...((preset.overrides[key]) ?? value.default) };
    }
  }

  private deriveTheme(): DerivedTheme {
    return ColorThemeEngine.colorSchema(this.#state.bases, this.#state.mode, this.#state.overrides, this.#state.mixer);
  }

  /** State → UI for ONE wiring scope (the builder root or a projected panel). */
  private sync(scope: HTMLElement, theme: DerivedTheme): void {
    // Tokens are NOT stamped per-panel — they are inherited resources, painted
    // once on a single host by #paintTokens(). Panels (and everything under
    // them) read the `--app-*` values through the cascade instead.
    const codeEl = scope.querySelector<HTMLElement>("code");
    if (codeEl) {
      codeEl.textContent = ColorThemeEngine.toCssText(theme.tokens, this.#state.mode, this.#state.bases);
    }

    ColorThemeKit.syncReport(scope, theme);
    ColorThemeKit.syncThemeStrips(scope, theme, this.config.items ?? DEFAULT_THEME_ITEMS);
    ColorThemeKit.syncMixerSettings(scope, this.#state.mixer);
    ColorThemeKit.syncMixerControls(scope, this.#state.overrides);
    ColorThemeKit.syncBaseColorPickers(scope, this.#state.bases);
    ColorThemeKit.syncPresetOptions(scope, this.#state.preset, this.config.presets);

    if (!this.config.disableValidation) {
      ColorThemeKit.syncHarmonyNotice(scope, this.#state.overrides);
      ColorThemeKit.syncBaseColorWarning(scope, this.#state.bases, this.#state.mode, this.config.validations ?? DEFAULT_VALIDATIONS, theme);
    }

    ColorThemeKit.syncModeControl(scope, this.#state.mode);
  }

  /**
   * 🎨 TOKEN HOST — tokens are painted on exactly ONE element: the caller's
   * root when this builder is slotted into it (the shared ancestor of every
   * attached panel, so `@editor` chrome and all panels inherit the cascade),
   * or this builder's own root when it owns the page standalone. Without this,
   * each attached scope would carry its own duplicated inline token set.
   */
  #paintTokens(theme: DerivedTheme): void {
    const itself = this.rootElement ?? null;
    const ownRootKey = Object.keys(this.hierarchy.get())[0] as ColorThemeElementType | undefined;
    const ownRoot = ownRootKey ? this.load(ownRootKey) : null;
    const host = itself ?? ownRoot;
    if (!host) return;
    for (const [key, value] of Object.entries(theme.tokens)) {
      host.style.setProperty(key, value);
    }
    host.style.colorScheme = this.#state.mode;
  }

  /**
   * initialize() is called PER SCOPE — never "for everything at once":
   *
   * - create() hands over the root element;
   * - every attach() hands over the single key it just projected.
   *
   * So the builder wires exactly what its caller asked for, and three layers
   * keep that from duplicating anything:
   *
   * 1. input → state: `bindState(scope)` covers only that scope, and
   *    BuilderProxy.bind refreshes an already-bound control instead of stacking
   *    a second listener on it.
   * 2. state → UI: ONE reactive effect per instance. It loops `scopes()` at run
   *    time (the base's list: root + every attached key), so a key attached
   *    later is repainted from the same state without a second effect.
   * 3. bulk actions: attempted on every pass, wired once per node.
   *
   * Because all attached keys belong to the same instance, they share `#state`:
   * the mode toggle drives the configurator strips and the output report through
   * that one effect — no cross-builder wiring, no duplicate bindings.
   */
  public initialize(root?: HTMLElement): void {
    if (!root) return;

    this.bindState(root, this.#state);
    this.sync(root, this.deriveTheme());
    this.#paintTokens(this.deriveTheme());

    if (!this.#unwatch.length) {
      this.#unwatch.push(this.proxyRuntime.watchEffect(() => {
        const theme = this.deriveTheme();
        // Tokens are painted on ONE host (caller's root, else my own root) —
        // never per attached scope. Panels inherit them via the cascade.
        this.#paintTokens(theme);
        this.#broadcastTokens(theme);
        for (const scope of this.scopes()) this.sync(scope, theme);
      }));
    }

    this.initializeActions();
  }

  /**
   * Copy / Reset / Save + preset select.
   * Nodes are resolved through the node store (typeKey) and the wiring scopes,
   * so wiring never depends on which DOM scope holds them; `@colorizer>output`
   * may also be attached after the other keys, hence the per-node guard.
   */
  private initializeActions(): void {
    const opts = { signal: this.#abort.signal };
    const wire = (node: HTMLElement | null, type: string, onAction: () => void): void => {
      if (!node || node.dataset.wired) return;
      node.dataset.wired = "true";
      node.addEventListener(type, onAction, opts);
    };
    const copyBtn = this.load("@colorizer>output>copy") as HTMLButtonElement | null;
    const resetBtn = this.load("@colorizer>output>reset") as HTMLButtonElement | null;
    const saveBtn = this.load("@colorizer>preset") as HTMLButtonElement | null;
    const codeEl = this.load("@colorizer>output>codeblock")?.querySelector("code");
    // The mixer re-uses this typeKey for several selects, so the preset control
    // is found by its hook across every wiring scope.
    const presetSelect = this.scopes().reduce<HTMLSelectElement | null>(
      (found, scope) => found ?? scope.querySelector<HTMLSelectElement>("select[data-control='preset']"),
      null,
    );

    wire(copyBtn, "click", async () => {
      try {
        await navigator.clipboard.writeText(codeEl?.textContent || "");
        copyBtn!.textContent = "Copied ✓";
      } catch {
        copyBtn!.textContent = "Copy failed";
      }
      setTimeout(() => (copyBtn!.textContent = "Copy CSS"), 1500);
    });

    wire(resetBtn, "click", () => {
      // 🔁 Just mutate the reactive state — every effect re-runs on its own.
      this.#state.bases.primary = this.config.primary;
      this.#state.bases.accent = this.config.accent;
      this.#state.mode = this.config.mode;
      this.#state.mixer = { ...ColorThemeEngine.DEFAULT_MIXER };
      this.#state.preset = "";

      for (const [key, value] of Object.entries(this.config.items ?? DEFAULT_THEME_ITEMS)) {
        this.#state.overrides[key] = { ...value.default };
      }
    });

    wire(presetSelect, "change", () => {
      this.applyPreset(presetSelect!.value);
    });

    wire(saveBtn, "click", () => {
      const label = window.prompt("Preset name", `preset-${this.config.presets.length + 1}`) ?? `preset-${Date.now()}`;
      const preset = this.createPreset(label.trim() || `preset-${Date.now()}`);
      // 🔔 Writing `state.preset` notifies the sync effect, which rebuilds the
      // select's options (syncPresetOptions) — no manual DOM sync here.
      this.#state.preset = preset.label;
      console.log(JSON.stringify(this.config.presets[this.config.presets.length - 1], null, 2));
      (saveBtn?.firstElementChild as HTMLElement).className = `checkmark circle icon`;
      setTimeout(() => ((saveBtn?.firstElementChild as HTMLElement).className = "floppy disk icon"), 1500);
    });
  }

  public destroy(): void {
    for (const unwatch of this.#unwatch) unwatch();
    this.#unwatch.length = 0;
    this.#abort.abort();
  }
}
