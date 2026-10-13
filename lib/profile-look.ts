import type { CSSProperties } from "react";

import { accentTokens, normalizeHex } from "./color";
import { parseCustomTheme, themeToCssVariables } from "./custom-theme";
import {
  ACCENTS,
  CARD_SHAPES,
  CARD_STYLES,
  FONTS,
  PROFILE_THEMES,
  THEME_PRESETS,
  type Accent,
  type AccentHex,
  type AccentValue,
  type CardShape,
  type CardStyle,
  type FontOption,
  type ProfileTheme,
  type ThemePreset,
} from "./domain";
import { FREE_PROFILE_LOOK } from "./plan";

/**
 * How a profile's pages look: the public profile, product, checkout and
 * order pages, and the dashboard previews all render from this, so the
 * preview matches the page. The colours themselves live in app/globals.css,
 * keyed by the data-* attributes from surfaceAttributes().
 */
export type ProfileLook = {
  theme: ProfileTheme;
  accent: AccentValue;
  preset: ThemePreset;
  font: FontOption;
  cardShape: CardShape;
  cardStyle: CardStyle;
  /** Page colours for the "custom" preset (validated JSON); unused by the others. */
  customTheme: string | null;
};

export type PresetDefinition = {
  label: string;
  description: string;
  /** "follow" uses the profile's light/dark setting; the others always render in that mode. */
  mode: "follow" | "light" | "dark";
  /** What choosing the preset sets; each can be changed afterwards. */
  font: FontOption;
  cardShape: CardShape;
  cardStyle: CardStyle;
  accent: AccentValue;
};

export const PRESETS = {
  default: {
    label: "Standar",
    description: "Kartu putih di atas abu muda.",
    mode: "follow",
    font: "Plus Jakarta Sans",
    cardShape: "smooth",
    cardStyle: "solid",
    accent: "blue",
  },
  minimal: {
    label: "Minimal",
    description: "Putih bersih, garis tipis, hitam putih.",
    mode: "follow",
    font: "Inter",
    cardShape: "rounded",
    cardStyle: "outline",
    accent: "slate",
  },
  glassmorphism: {
    label: "Glassmorphism",
    description: "Kartu kaca buram di atas gradasi ungu.",
    mode: "dark",
    font: "Outfit",
    cardShape: "extra",
    cardStyle: "glass",
    accent: "#c4b5fd",
  },
  neon: {
    label: "Neon",
    description: "Latar hitam dengan kartu yang berpendar.",
    mode: "dark",
    font: "Space Grotesk",
    cardShape: "smooth",
    cardStyle: "glow",
    accent: "#2ee6ff",
  },
  brutalist: {
    label: "Neobrutalisme",
    description: "Kuning, garis hitam tebal, bayangan tegas.",
    mode: "light",
    font: "Space Grotesk",
    cardShape: "rounded",
    cardStyle: "neobrutalism",
    accent: "#ff90e8",
  },
} as const satisfies Record<Exclude<ThemePreset, "custom">, PresetDefinition>;

export type NamedPreset = keyof typeof PRESETS;

export const PRESET_ORDER: readonly NamedPreset[] = [
  "default",
  "minimal",
  "glassmorphism",
  "neon",
  "brutalist",
];

export const CARD_SHAPE_LABELS: Record<CardShape, string> = {
  sharp: "Tajam",
  rounded: "Halus",
  smooth: "Bulat",
  extra: "Ekstra",
  pill: "Kapsul",
};

export const CARD_STYLE_LABELS: Record<CardStyle, string> = {
  solid: "Solid",
  glass: "Kaca",
  outline: "Garis tepi",
  shadow: "Bayangan",
  neobrutalism: "Neobrutal",
  glow: "Pendar",
};

/** CSS variables declared by next/font in app/fonts.ts. */
const FONT_VARIABLES: Record<FontOption, string> = {
  "Plus Jakarta Sans": "--font-jakarta",
  Inter: "--font-inter",
  Poppins: "--font-poppins",
  Outfit: "--font-outfit",
  "Space Grotesk": "--font-space-grotesk",
  "Playfair Display": "--font-playfair",
};

export function fontStack(font: FontOption): string {
  const fallback =
    font === "Playfair Display"
      ? "ui-serif, Georgia, serif"
      : "ui-sans-serif, system-ui, sans-serif";
  return `var(${FONT_VARIABLES[font]}), ${fallback}`;
}

function pick<T extends string>(
  values: readonly T[],
  value: unknown,
  fallback: T
): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

export function isNamedAccent(value: string): value is Accent {
  return (ACCENTS as readonly string[]).includes(value);
}

/** Light-mode colour of each named accent (mirror of app/globals.css). */
export const NAMED_ACCENT_HEX: Record<Accent, string> = {
  blue: "#1d4fd8",
  emerald: "#047857",
  rose: "#be123c",
  amber: "#9c4508",
  violet: "#6d28d9",
  slate: "#0f172a",
};

/** The accent as one hex colour, for places without the stylesheet (emails). */
export function accentHex(value: unknown): string {
  const accent = normalizeAccent(value);
  return isNamedAccent(accent) ? NAMED_ACCENT_HEX[accent] : accent;
}

/** A stored accent as rendered: a named accent, a normalized hex, or blue for anything else. */
export function normalizeAccent(value: unknown): AccentValue {
  if (typeof value !== "string") return "blue";
  if (isNamedAccent(value)) return value;
  return (normalizeHex(value) as AccentHex | null) ?? "blue";
}

type LookFields = {
  theme?: string | null | undefined;
  accent?: string | null | undefined;
  themePreset?: string | null | undefined;
  customTheme?: string | null | undefined;
  fontFamily?: string | null | undefined;
  cardShape?: string | null | undefined;
  cardStyle?: string | null | undefined;
};

/** Stored profile fields to a look; unknown values fall back to the standard look. */
export function lookFromProfile(profile: LookFields): ProfileLook {
  return {
    theme: pick(PROFILE_THEMES, profile.theme, "system"),
    accent: normalizeAccent(profile.accent),
    preset: pick(THEME_PRESETS, profile.themePreset, "default"),
    font: pick(FONTS, profile.fontFamily, "Plus Jakarta Sans"),
    cardShape: pick(CARD_SHAPES, profile.cardShape, "smooth"),
    cardStyle: pick(CARD_STYLES, profile.cardStyle, "solid"),
    customTheme: profile.customTheme ?? null,
  };
}

/** The look visitors get: premium styling only while the owner has premium. */
export function visitorLook(
  profile: LookFields,
  premium: boolean
): ProfileLook {
  return lookFromProfile(
    premium ? profile : { ...profile, ...FREE_PROFILE_LOOK }
  );
}

/** Light or dark as rendered: some presets fix it, the others follow the profile's setting. */
export function lookMode(look: ProfileLook): ProfileTheme {
  const mode = look.preset === "custom" ? "follow" : PRESETS[look.preset].mode;
  return mode === "follow" ? look.theme : mode;
}

export type SurfaceAttributes = {
  "data-theme": ProfileTheme;
  "data-accent": Accent | "custom";
  "data-preset": ThemePreset;
  "data-card-shape": CardShape;
  "data-card-style": CardStyle;
  style: CSSProperties;
};

/** Attributes for a .profile-surface element; spread them onto it. */
export function surfaceAttributes(look: ProfileLook): SurfaceAttributes {
  const style: Record<string, string> = { fontFamily: fontStack(look.font) };
  let accent: Accent | "custom";
  if (isNamedAccent(look.accent)) {
    accent = look.accent;
  } else {
    accent = "custom";
    const { light, dark } = accentTokens(look.accent);
    Object.assign(style, {
      "--accent-light": light.fill,
      "--accent-fg-light": light.onFill,
      "--accent-text-light": light.text,
      "--accent-dark": dark.fill,
      "--accent-fg-dark": dark.onFill,
      "--accent-text-dark": dark.text,
    });
  }
  if (look.preset === "custom") {
    const theme = parseCustomTheme(look.customTheme);
    if (theme) Object.assign(style, themeToCssVariables(theme));
  }
  return {
    "data-theme": lookMode(look),
    "data-accent": accent,
    "data-preset": look.preset,
    "data-card-shape": look.cardShape,
    "data-card-style": look.cardStyle,
    style: style as CSSProperties,
  };
}
