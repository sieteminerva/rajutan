import type { MixerSettings, ThemeMode, ThemeOverrides } from "./ColorTheme.engine";

export interface iColorThemePreset {
  label: string;
  primary: string;
  accent: string;
  mode: ThemeMode;
  mixer: MixerSettings;
  overrides: ThemeOverrides;
}

export const ColorThemePresets: iColorThemePreset[] = [
  {
    "label": "preset-1",
    "primary": "#925408",
    "accent": "#b47828",
    "mode": "light",
    "mixer": {
      "mode": "oklch"
    },
    "overrides": {
      "hover": {
        "amount": 80,
        "shift": 0,
        "target": "auto"
      },
      "strong": {
        "amount": 85,
        "shift": 0,
        "target": "auto"
      },
      "text": {
        "amount": 75,
        "shift": 0,
        "target": "auto"
      },
      "subtle": {
        "amount": 12,
        "shift": 0,
        "target": "auto"
      },
      "border": {
        "amount": 30,
        "shift": 0,
        "target": "auto"
      }
    }
  },
  {
    "label": "preset-2",
    "primary": "#53afc6",
    "accent": "#d747b0",
    "mode": "light",
    "mixer": {
      "mode": "oklch"
    },
    "overrides": {
      "hover": {
        "amount": 80,
        "shift": 0,
        "target": "auto"
      },
      "strong": {
        "amount": 85,
        "shift": 0,
        "target": "auto"
      },
      "text": {
        "amount": 75,
        "shift": 0,
        "target": "auto"
      },
      "subtle": {
        "amount": 12,
        "shift": 0,
        "target": "auto"
      },
      "border": {
        "amount": 30,
        "shift": 0,
        "target": "auto"
      }
    }
  },
  {
    "label": "preset-6",
    "primary": "#35b64a",
    "accent": "#489339",
    "mode": "light",
    "mixer": {
      "mode": "oklch"
    },
    "overrides": {
      "hover": {
        "amount": 80,
        "shift": 0,
        "target": "auto"
      },
      "strong": {
        "amount": 85,
        "shift": 0,
        "target": "auto"
      },
      "text": {
        "amount": 75,
        "shift": 0,
        "target": "auto"
      },
      "subtle": {
        "amount": 12,
        "shift": 0,
        "target": "auto"
      },
      "border": {
        "amount": 30,
        "shift": 0,
        "target": "auto"
      }
    }
  }

]