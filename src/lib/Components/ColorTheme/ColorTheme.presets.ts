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

]