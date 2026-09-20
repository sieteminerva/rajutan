/* ================================================================
   🎨 THEME GENERATOR ENGINE — pure derivation module.
   Extracted from the generator prototype (src/content/generator.ts).
   Input  : 2 base colors + mode + per-mixer overrides
   Output : DerivedTheme { tokens (export/live, var()-referencing),
             preview (inlined, Canvas2D-parseable), probes }
   The ColorTheme builder is only a UI shell around this module.
   ================================================================ */

export type ThemeMode = "light" | "dark";
export type BaseColors = { primary: string; accent: string };
export type MixSpace = "oklch" | "oklab" | "srgb" | "hsl";

/**
 * Interpolation mode = color space (+ optional hue path).
 * `hsl`/`oklch` are POLAR, so they also take a `<hue-interpolation-method>`;
 * `oklab`/`srgb` are rectangular and must not get one. `-advanced` modes travel
 * the long way round the hue wheel — the only thing that looks different when
 * the two operands sit at nearly the same hue.
 */
export type MixMode = MixSpace | "oklch-advanced" | "hsl-advanced";

/** What a mix blends INTO — the knob that makes a mode actually observable. */
export type MixTarget = "auto" | "tint" | "shade" | "alpha" | "accent" | "primary" | "complement";

/**
 * Mixer-wide settings — ONE interpolation mode + counterpart shared by the whole
 * mixer group, so every derived color is produced consistently. The
 * `@colorizer>configurator>mixer` element owns these; each
 * `…>mixer>item` owns only its own amount + hue.
 */
export type MixerSettings = { mode: MixMode };
/**
 * Per-item mixer override:
 * - `amount` — how much of the source color survives the mix (0–100).
 * - `shift`  — hue rotation (degrees) applied to the *source* color before
 *              mixing. It is emitted as CSS relative color syntax chained to the
 *              base var, so a rotated variant stays derived from
 *              `--app-primary-color` / `--app-accent-color`.
 */
export type MixOverride = { amount: number; shift: number; target: MixTarget };
export type ThemeOverrides = Record<string, MixOverride>;
export type RGBA = [number, number, number, number];
type LightnessDeltaRule = { min?: number; max?: number; minContrast?: number };

export type DerivedTheme = {
  /** Export/live tokens — `color-mix()` expressions referencing the base vars. */
  tokens: Record<string, string>;
  /** Same tokens inlined for Canvas2D/WCAG math: no `var()`, no relative colors. */
  preview: Record<string, string>;
  /** Solid stand-ins for composite values (gradients) so WCAG math can probe them. */
  probes: { page: string; surface: string; primary: string };
};

const rgbaCache = new Map<string, RGBA>();
const ROTATION_RE = /hsl\(from (.+?) calc\(h ([+-]) ([\d.]+)\) s l \/ alpha\)/g;

export class ColorThemeEngine {
  static readonly MIX_MODES: readonly MixMode[] = ["oklch", "oklch-advanced", "oklab", "srgb", "hsl", "hsl-advanced"];
  static readonly MIX_TARGETS: readonly MixTarget[] = ["auto", "tint", "shade", "alpha", "accent", "primary", "complement"];
  static readonly DEFAULT_MIXER: MixerSettings = { mode: "oklch" };
  static readonly DEFAULT_BASES: BaseColors = { primary: "#925408", accent: "#b47828" };
  static readonly RAMP_STOPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;

  static readonly colorCtx = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    return canvas.getContext("2d")!;
  })();

  static clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
  }
  /**
   * Coerce a numeric control value to a finite number.
   * Range inputs are bound through the generic proxy, which hands over the raw
   * `el.value` **string** — and `h + "-120"` silently becomes string
   * concatenation → `NaN`. Every numeric override therefore goes through here.
   */
  static toNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Parse any CSS color (hex, rgb, oklch, color-mix, …) → [r, g, b, a] (0–255, a 0–1).
   * Cached: the render+readback is a GPU→CPU sync, and the same handful of colors
   * repeats across the swatch groups and the WCAG report.
   */
  static toRgba(css: string): RGBA {
    const cached = rgbaCache.get(css);
    if (cached) return cached;

    const normalized = css.replace(/color-mix\(\s*in\s+([a-z]+)\s+advanced\s+hue\s*,/i, "color-mix(in $1,");

    // A canvas has no element context, so `var()` cannot resolve — assigning it
    // silently KEEPS the previous fillStyle and would report a stale color.
    // Reject it (and anything CSS itself rejects) as the black sentinel.
    let rgba: RGBA = [0, 0, 0, 1];
    if (!css.includes("var(") && CSS.supports("color", normalized)) {
      ColorThemeEngine.colorCtx.clearRect(0, 0, 1, 1);
      // Reset first: an unparseable assignment is IGNORED by the canvas, so
      // without this the previous fillStyle would be read back — one bad value
      // would silently repaint every later "unparseable" color instead of black.
      ColorThemeEngine.colorCtx.fillStyle = "#000000";
      ColorThemeEngine.colorCtx.fillStyle = normalized;
      ColorThemeEngine.colorCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ColorThemeEngine.colorCtx.getImageData(0, 0, 1, 1).data;
      // Alpha is stored premultiplied → channels can be ±1 off after readback.
      rgba = [r, g, b, a / 255];
    } else {
      console.warn("[ThemeGenerator] unparseable color, treated as black:", css);
    }

    rgbaCache.set(css, rgba);
    return rgba;
  }
  /** Flatten a translucent color over its background (source-over). */
  static over(fg: RGBA, bg: RGBA): RGBA {
    const a = fg[3] + bg[3] * (1 - fg[3]);
    if (a <= 0) return [0, 0, 0, 1];
    const ch = (i: 0 | 1 | 2) => (fg[i] * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / a;
    return [ch(0), ch(1), ch(2), a];
  }

  static rgbOf(c: RGBA): string {
    return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
  }

  static luminance([r, g, b]: RGBA): number {
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  // /** Signed relative lightness delta between two colors; negative means the accent is darker than the primary. */
  // static relativeLightnessDelta(primary: string, accent: string): number {
  //   const p = ColorThemeEngine.luminance(ColorThemeEngine.toRgba(primary));
  //   const a = ColorThemeEngine.luminance(ColorThemeEngine.toRgba(accent));
  //   return a - p;
  // }
  // /** Signed relative lightness delta as percent points; easier to expose in config. */
  // static relativeLightnessDeltaPercent(primary: string, accent: string): number {
  //   return ColorThemeEngine.relativeLightnessDelta(primary, accent) * 100;
  // }
  // /** Accept new percent limits (`12`) and old fractional limits (`0.12`). */
  // static normalizeLightnessDeltaLimit(value: number | undefined, fallback: number): number {
  //   if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  //   return Math.abs(value) <= 1 ? value * 100 : value;
  // }
  /** Human-readable note for how the accent differs from the primary in overall lightness. */
  static describeLightnessDelta(
    primary: string,
    accent: string,
    mode: ThemeMode = "light",
    rule?: LightnessDeltaRule,
    theme?: DerivedTheme // Parameter rahasia yang super valid
  ): string {
    // 1. HITUNG LUMINANCE MENTAH (Untuk informasi delta persen)
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };

    const pRgba = ColorThemeEngine.toRgba(primary);
    const aRgba = ColorThemeEngine.toRgba(accent);

    const pLum = 0.2126 * lin(pRgba[0]) + 0.7152 * lin(pRgba[1]) + 0.0722 * lin(pRgba[2]);
    const aLum = 0.2126 * lin(aRgba[0]) + 0.7152 * lin(aRgba[1]) + 0.0722 * lin(aRgba[2]);

    const delta = (aLum - pLum) * 100;
    const absDelta = Math.abs(delta);

    // 2. PENGECEKAN KONTRAS NYATA (Hakim Absolut menggunakan data Theme Probes)
    const minContrast = rule?.minContrast ?? 3;

    if (theme) {
      // Mengukur kontras warna accent nyata terhadap background/surface yang dihasilkan di layar
      const accentOnSurface = ColorThemeEngine.contrast(accent, theme.probes.surface);
      const accentOnPage = ColorThemeEngine.contrast(accent, theme.probes.page);
      const lowestRealContrast = Math.min(accentOnSurface, accentOnPage);

      // Jika di layar asli ternyata warnanya samar/buta, langsung tembak warning aksesibilitas
      if (lowestRealContrast < minContrast) {
        return `⚠️ Accent color fails readability on generated background (${lowestRealContrast.toFixed(2)}:1, minimum ${minContrast}:1).`;
      }
    }

    // 3. LOGIKA TOLERANSI DELTA PERSEN (Anti Over-Sensitive)
    const normalize = (val: number | undefined, fallback: number) => {
      if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
      return Math.abs(val) <= 1 ? val * 100 : val;
    };

    // Jika ada objek theme dan kontras layarnya aman, kita buat batas delta sangat longgar (±60%)
    // karena visual aslinya terbukti readable di atas surface web hasil generator.
    const isThemeSafe = theme ? true : false;
    const minAllowed = isThemeSafe ? -60 : normalize(rule?.min, mode === "dark" ? -15 : -20);
    const maxAllowed = isThemeSafe ? 60 : normalize(rule?.max, mode === "dark" ? 25 : 20);

    // 4. EVALUASI
    if (delta < minAllowed) {
      return `⚠️ Accent color is too dark against primary by ${absDelta.toFixed(1)}%.`;
    }
    if (delta > maxAllowed) {
      return `⚠️ Accent color is too light against primary by ${absDelta.toFixed(1)}%.`;
    }

    if (delta > 0) return `Accent color is lighter than primary by ${absDelta.toFixed(1)}%.`;
    if (delta < 0) return `Accent color is darker than primary by ${absDelta.toFixed(1)}%.`;
    return "Accent matches the primary lightness.";
  }

  /** WCAG contrast ratio of fg (composited over bg) against bg. */
  static contrast(fg: string | RGBA, bg: string | RGBA): number {
    const bgRgba = typeof bg === "string" ? ColorThemeEngine.toRgba(bg) : bg;
    const fgRgba = ColorThemeEngine.over(typeof fg === "string" ? ColorThemeEngine.toRgba(fg) : fg, bgRgba);
    const l1 = ColorThemeEngine.luminance(fgRgba);
    const l2 = ColorThemeEngine.luminance(bgRgba);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  }
  /**
   * Does this color carry a usable *hue*? Greys/white/black have no meaningful
   * hue (their HSL saturation is 0), so hue rotation is skipped for them.
   * Threshold is an 8-bit channel spread (~2% saturation).
   */
  static isChromatic(css: string): boolean {
    const [r, g, b] = ColorThemeEngine.toRgba(css);
    return Math.max(r, g, b) - Math.min(r, g, b) > 4;
  }

  /**
   * CSS form of a hue rotation — keeps the origin as a live `var()` reference, so
   * a derived token always follows `--app-primary-color` / `--app-accent-color`:
   * `hsl(from <var(--…)> calc(h + N) s l / alpha)`.
   *
   * ⚠️ The hue keyword of `hsl()` is a *number*, so it must be `calc(h + N)` and
   * never `calc(h + Ndeg)`. Relative color syntax needs Chrome 119+ /
   * Firefox 128+ / Safari 16.4+; the JS mirror `rotateHue` below keeps the
   * swatch + WCAG math working regardless (see `colorSchema`'s `preview`).
   */
  static rotateHueCss(css: string, shift: number): string {
    const delta = ColorThemeEngine.toNumber(shift, 0);
    if (!delta) return css;
    const op = delta > 0 ? "+" : "-";
    return `hsl(from ${css} calc(h ${op} ${Math.abs(delta)}) s l / alpha)`;
  }

  /**
   * Rotate a color's hue, keeping its saturation/lightness/alpha, as an
   * `rgb(...)` literal (JS mirror of `rotateHueCss`).
   * Used for the Canvas2D-parseable copy — a canvas can resolve neither `var()`
   * nor relative color syntax. Returns `<c>` untouched when the shift is neutral
   * or the source is achromatic (no meaningful hue to rotate).
   */
  static rotateHue(css: string, shift: number, chromatic = true): string {
    const delta = ColorThemeEngine.toNumber(shift, 0);
    if (!delta || !chromatic) return css;

    const [r, g, b, a] = ColorThemeEngine.toRgba(css);
    const [h, s, l] = this.rgbToHsl(r, g, b);
    const rotated = ((h + delta) % 360 + 360) % 360;
    const [nr, ng, nb] = this.hslToRgb(rotated, s, l);

    return a >= 1 ? ColorThemeEngine.rgbOf([nr, ng, nb, 1]) : `rgb(${nr} ${ng} ${nb} / ${a.toFixed(3)})`;
  }

  /**
   * Derive the full `--app-*` token block from 2 base colors.
   * Mixing happens in `oklch`/`oklab` so ramps stay on-hue and perceptually even.
   * Derived tokens reference `var(--app-primary-color)` / `var(--app-accent-color)`,
   * so the exported block stays internally consistent (tweak base → ramp follows).
   *
   * `mixer` is group-wide (ONE mode + counterpart for every named mix, so all
   * derived colors are produced consistently), while `overrides` holds the
   * per-item amount + hue.
   */
  static colorSchema(
    bases: BaseColors,
    mode: ThemeMode,
    overrides: ThemeOverrides = {},
    mixer: MixerSettings = ColorThemeEngine.DEFAULT_MIXER,
  ): DerivedTheme {
    const P = "var(--app-primary-color)";
    const A = "var(--app-accent-color)";
    const dark = mode === "dark";

    // Base var → its literal color, so a hue rotation can be computed in JS.
    // Rotating the `var()` reference instead would be unreadable by the color
    // parser (canvas has no element context) and would silently become black.
    const baseOf: Record<string, string> = { [P]: bases.primary, [A]: bases.accent };

    /**
     * `oklch-advanced` → `in oklch advanced hue`; `oklch` → `in oklch`.
     * The hue path is POLAR-only, and the mode list never pairs it with the
     * rectangular spaces (`in oklab advanced hue` would be dropped by the engine).
     */
    /**
     * `oklch-advanced` → `in oklch advanced hue`; `oklch` → `in oklch`.
     * The hue path is POLAR-only, and the mode list never pairs it with the
     * rectangular spaces (`in oklab advanced hue` would be dropped by the engine).
     * Unknown values (stale state, hand-written config) fall back to the default
     * instead of emitting an invalid `color-mix()`.
     */
    const interpolationOf = (value?: MixMode) => {
      const current = ColorThemeEngine.MIX_MODES.includes(value as MixMode)
        ? (value as MixMode)
        : ColorThemeEngine.DEFAULT_MIXER.mode;
      const [space, path] = current.split("-");
      return `in ${space}${path === "advanced" ? " longer hue" : ""}`;
    };

    /**
     * Resolve what the source blends into. `auto` = the operand this token was
     * designed with; everything else is the user's choice. A chromatic
     * counterpart (`accent`/`primary`/`complement`) is what makes the modes
     * distinguishable — mixing into a neutral collapses oklab/oklch/srgb to
     * almost the same color.
     */
    const targetOf = (value: MixTarget | undefined, designed: string, color: string) => {
      const target = ColorThemeEngine.MIX_TARGETS.includes(value as MixTarget) ? (value as MixTarget) : "auto";
      switch (target) {
        case "tint": return "white";
        case "shade": return "black";
        case "alpha": return "transparent";
        case "primary": return P;
        case "accent": return A;
        // Opposite hue, still chained to the source var. (A separate wrapper, not
        // a nested one, so the JS preview can resolve each on its own.)
        case "complement": {
          const base = baseOf[color];
          return base && ColorThemeEngine.isChromatic(base) ? ColorThemeEngine.rotateHueCss(color, 180) : designed;
        }
        default: return designed;
      }
    };

    const mixOf = (color: string, pct: number, into: string, name?: string) => {
      const override = name ? overrides[name] : undefined;
      // Range inputs bind strings, so never trust the raw override values.
      const amount = ColorThemeEngine.toNumber(override?.amount, pct);
      // Hue rotation is a PRE-transform of the source color, so it is applied
      // *before* the `color-mix()` interpolation and is therefore independent of
      // the mix space. It is emitted as CSS relative color syntax so the token
      // keeps referencing the base var (a tweak to --app-primary-color still
      // propagates to every rotated variant). Achromatic bases are skipped —
      // their hue is `none`, which would make `calc(none + N)` invalid.
      const shift = ColorThemeEngine.toNumber(override?.shift, 0);
      const base = baseOf[color];
      const source = shift && base && ColorThemeEngine.isChromatic(base)
        ? ColorThemeEngine.rotateHueCss(color, shift)
        : color;
      const counterpart = targetOf(override?.target ?? "auto", into, color);
      return `color-mix(${interpolationOf(mixer.mode)}, ${source} ${ColorThemeEngine.clamp01(amount / 100) * 100}%, ${counterpart})`;
    };

    const mix = (pct: number, into: string, name?: string) => mixOf(P, pct, into, name);

    // Page background + surface stops are captured as plain colors first, so the
    // contrast report can probe real values instead of an unparseable gradient.
    const pageTop = dark ? mix(12, "#201913") : mix(3, "#fdfbf7");
    const pageMid = dark ? mix(9, "#14100b") : mix(6, "#f6f1e8");
    const pageBottom = dark ? mix(6, "#0c0907") : mix(9, "#efe7d8");
    const surface = dark ? mix(8, "#1c1611") : mix(3, "#ffffff");
    const surfacePanel = dark ? mix(8, "#1c1611") : mix(4, "#ffffff");

    const tokens: Record<string, string> = {
      "--app-primary-color": bases.primary,
      "--app-accent-color": bases.accent,
      "--app-primary-hover": dark ? mix(80, "white", "hover") : mix(80, "black", "hover"),
      "--app-accent-strong": mixOf(A, 85, dark ? "white" : "black", "strong"),
      "--app-accent-subtle": mixOf(A, 12, "transparent", "subtle"),
      "--app-text-color": dark ? mix(6, "#f3ede2", "text") : mix(8, "#2c251e", "text"),
      "--app-text-heading-color": dark ? mix(4, "#fff9f0") : mix(10, "#1a140e"),

      // Primary ramp 50–900 (tints toward white, shades toward black)
      "--app-primary-50": mix(12, "white"),
      "--app-primary-100": mix(22, "white"),
      "--app-primary-200": mix(35, "white"),
      "--app-primary-300": mix(50, "white"),
      "--app-primary-400": mix(72, "white"),
      "--app-primary-500": P,
      "--app-primary-600": mix(84, "black"),
      "--app-primary-700": mix(70, "black"),
      "--app-primary-800": mix(52, "black"),
      "--app-primary-900": mix(32, "black"),

      // Neutrals — the warm cast comes from mixing the primary hue into grey/ink
      "--app-page-background": dark
        ? `radial-gradient(circle at 50% 0%, ${pageTop} 0%, ${pageMid} 60%, ${pageBottom} 100%)`
        : `linear-gradient(175deg, ${pageTop} 0%, ${pageMid} 45%, ${pageBottom} 100%)`,
      "--app-surface-background-color": `color-mix(in oklab, ${surfacePanel} ${dark ? 78 : 82}%, transparent)`,
      "--app-surface-strong": surface,
      "--app-surface-muted": `color-mix(in oklab, ${mix(8, "#f4eee2")} ${dark ? 62 : 80}%, transparent)`,
      "--app-text-accent-color": dark ? mix(24, "#cfc5b8") : mix(30, "#6e5f51"),
      "--app-border-color": mix(dark ? 34 : 30, "transparent", "border"),
      "--app-border-focus": bases.primary,
      "--app-shadow-soft": `0 12px 35px -8px color-mix(in oklab, ${dark ? mixOf(P, 60, "#000000") : mixOf(P, 60, "#5c3c14")} 8%, transparent)`,
      "--app-shadow-elevated": `0 20px 48px -10px color-mix(in oklab, ${dark ? mixOf(P, 60, "#000000") : mixOf(P, 60, "#5c3c14")} 16%, transparent)`,
    };

    /**
     * Canvas2D (our color parser) has no element context, so `var()` cannot be
     * substituted — it would silently fall back to the sentinel black and every
     * derived swatch/contrast reading would be wrong. Inline the two base colors
     * for the JS-side copy used by the swatches + WCAG report. Only these two
     * vars are ever referenced, so a literal replace is exact.
     */
    const inline = (value: string) =>
      value
        .replaceAll("var(--app-primary-color)", bases.primary)
        .replaceAll("var(--app-accent-color)", bases.accent);

    /**
     * …and relative color syntax is not something a canvas will resolve either,
     * so the JS-side copy resolves the hue rotation numerically on the already
     * inlined origin. Tokens keep the `var()`-chained CSS form; only this
     * preview/probe copy becomes a literal.
     */
    const resolveRotations = (value: string) =>
      inline(value).replace(ROTATION_RE, (_match, color: string, op: string, degrees: string) =>
        ColorThemeEngine.rotateHue(color, (op === "-" ? -1 : 1) * Number(degrees)),
      );

    const preview: Record<string, string> = {};
    for (const [key, value] of Object.entries(tokens)) preview[key] = resolveRotations(value);

    return {
      tokens,
      preview,
      probes: { page: resolveRotations(pageBottom), surface: resolveRotations(surface), primary: bases.primary },
    };
  }

  /**
   * Serialize the token map in variables.css export format.
   * Selector mirrors the real file: light → `:root`, dark → `:root[data-mode="dark"]`.
   */
  static toCssText(tokens: Record<string, string>, mode: ThemeMode, bases: BaseColors): string {
    const selector = mode === "dark" ? ':root[data-mode="dark"]' : ":root";
    const head =
      `/* Generated by Rajutan Color Theme Generator — ${mode} mode\n` +
      `   bases: primary ${bases.primary} · accent ${bases.accent}\n` +
      `   every other token is derived from those two with color-mix() */\n` +
      `${selector} {\n`;
    const body = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join("\n");
    return head + body + "\n}\n";
  }

  static evaluate(theme: DerivedTheme) {
    const primaryRgba = ColorThemeEngine.toRgba(theme.probes.primary);
    const primaryLuminance = ColorThemeEngine.luminance(primaryRgba);
    const dynamicButtonText = primaryLuminance > 0.179 ? "rgb(44 37 30)" : "#ffffff";

    const rows: Array<[string, string | RGBA, RGBA, number]> = [
      ["Body text on surface", theme.preview["--app-text-color"], ColorThemeEngine.toRgba(theme.probes.surface), 4.5],
      ["Heading on page background", theme.preview["--app-text-heading-color"], ColorThemeEngine.toRgba(theme.probes.page), 4.5],
      ["Muted text on surface", theme.preview["--app-text-accent-color"], ColorThemeEngine.toRgba(theme.probes.surface), 4.5],
      ["Primary on surface (UI)", theme.preview["--app-primary-color"], ColorThemeEngine.toRgba(theme.probes.surface), 3],
      ["Accent on surface (UI)", theme.preview["--app-accent-color"], ColorThemeEngine.toRgba(theme.probes.surface), 3],
      ["White label on primary (button)", dynamicButtonText, primaryRgba, 4.5],
    ];

    return rows.map(([label, foreground, background, min]) => {
      const ratio = ColorThemeEngine.contrast(foreground, background);
      return { label, ratio, ok: ratio >= min, min };
    });
  }

  /**
   * sRGB 0–255 → HSL (h 0–360, s/l 0–100) — the same space CSS's `hsl()` uses.
   */
  private static rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (!d) return [0, 0, l * 100];

    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return [h, s * 100, l * 100];
  }
  /** HSL (h 0–360, s/l 0–100) → sRGB 0–255. */
  private static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const sn = s / 100;
    const ln = l / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ln - c / 2;
    // `|| 0` guards h === 360 (6 % 6 = 0 already) and any NaN hue.
    const segment = (Math.floor(h / 60) % 6) || 0;
    const [pr, pg, pb] = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][segment];
    return [pr, pg, pb].map((v) => Math.round((v + m) * 255)) as [number, number, number];
  }
}
