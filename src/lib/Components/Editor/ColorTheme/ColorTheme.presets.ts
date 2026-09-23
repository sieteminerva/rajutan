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
    "label": "chocolaris",
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
    "label": "gum",
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
    "label": "green-bliss",
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
  },
  {
    "label": "Pomegrade",
    "primary": "#f0a8d9",
    "accent": "#75c44a",
    "mode": "dark",
    "mixer": {
      "mode": "oklch-advanced"
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
    "label": "Violaris",
    "primary": "#82489d",
    "accent": "#9a7fc3",
    "mode": "light",
    "mixer": {
      "mode": "hsl"
    },
    "overrides": {
      "hover": {
        "amount": 63,
        "shift": 2,
        "target": "accent"
      },
      "strong": {
        "amount": 75,
        "shift": 0,
        "target": "auto"
      },
      "text": {
        "amount": 76,
        "shift": -13,
        "target": "auto"
      },
      "subtle": {
        "amount": 39,
        "shift": 23,
        "target": "auto"
      },
      "border": {
        "amount": 22,
        "shift": -80,
        "target": "alpha"
      }
    }
  },


]