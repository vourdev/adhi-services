import type { CSSProperties } from "react";
import * as z from "zod";

import {
  CARD_SHAPES,
  CARD_STYLES,
  type CardShape,
  type CardStyle,
  FONTS,
  THEME_PRESETS,
  type ThemePreset,
} from "./domain";

/** Hex (#rgb, #rrggbb, with or without alpha) or rgb()/rgba(). Nothing else reaches the inline style. */
const themeColor = z
  .string()
  .trim()
  .max(64)
  .regex(
    /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\))$/i
  );

/** https:// or a site path, without quotes, brackets or spaces that could break out of url(""). */
const themeImageUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^(?:https:\/\/|\/)[^\s"'()\\]+$/);

export const customThemeSchema = z.object({
  preset: z.enum(THEME_PRESETS),
  backgroundType: z.enum(["solid", "gradient", "image"]),
  backgroundColor: themeColor,
  gradientFrom: themeColor.optional(),
  gradientTo: themeColor.optional(),
  gradientAngle: z.number().int().min(0).max(360).optional(),
  backgroundImageUrl: themeImageUrl.optional(),
  backgroundBlur: z.number().min(0).max(40).optional(),
  textColor: themeColor,
  textMutedColor: themeColor,
  cardColor: themeColor,
  cardBorderColor: themeColor,
  cardBorderOpacity: z.number().min(0).max(1).optional(),
  accentColor: themeColor,
  accentTextColor: themeColor,
  fontFamily: z.enum(FONTS),
  cardShape: z.enum(CARD_SHAPES),
  cardStyle: z.enum(CARD_STYLES),
  textAlign: z.enum(["left", "center"]).optional(),
});

export type CustomThemeConfig = z.output<typeof customThemeSchema>;

export const DEFAULT_THEME_CONFIG: CustomThemeConfig = {
  preset: "default",
  backgroundType: "solid",
  backgroundColor: "#f4f4f5",
  textColor: "#09090b",
  textMutedColor: "#71717a",
  cardColor: "#ffffff",
  cardBorderColor: "#e4e4e7",
  cardBorderOpacity: 1,
  accentColor: "#2563eb",
  accentTextColor: "#ffffff",
  fontFamily: "Plus Jakarta Sans",
  cardShape: "smooth",
  cardStyle: "solid",
  textAlign: "left",
};

export const THEME_PRESET_CONFIGS: Record<
  Exclude<ThemePreset, "default" | "custom">,
  Partial<CustomThemeConfig>
> = {
  minimal: {
    preset: "minimal",
    backgroundType: "solid",
    backgroundColor: "#fafafa",
    textColor: "#18181b",
    textMutedColor: "#71717a",
    cardColor: "#ffffff",
    cardBorderColor: "#e4e4e7",
    accentColor: "#18181b",
    accentTextColor: "#fafafa",
    fontFamily: "Inter",
    cardShape: "rounded",
    cardStyle: "outline",
    textAlign: "left",
  },
  glassmorphism: {
    preset: "glassmorphism",
    backgroundType: "gradient",
    gradientFrom: "#0f172a",
    gradientTo: "#1e1b4b",
    gradientAngle: 135,
    backgroundColor: "#0f172a",
    textColor: "#f8fafc",
    textMutedColor: "#94a3b8",
    cardColor: "rgba(255, 255, 255, 0.08)",
    cardBorderColor: "rgba(255, 255, 255, 0.18)",
    accentColor: "#6366f1",
    accentTextColor: "#ffffff",
    fontFamily: "Outfit",
    cardShape: "smooth",
    cardStyle: "glass",
    textAlign: "left",
  },
  neon: {
    preset: "neon",
    backgroundType: "solid",
    backgroundColor: "#0a0a0c",
    textColor: "#ffffff",
    textMutedColor: "#a1a1aa",
    cardColor: "#141418",
    cardBorderColor: "#27272a",
    accentColor: "#10b981",
    accentTextColor: "#042f2e",
    fontFamily: "Space Grotesk",
    cardShape: "smooth",
    cardStyle: "shadow",
    textAlign: "left",
  },
  brutalist: {
    preset: "brutalist",
    backgroundType: "solid",
    backgroundColor: "#fef08a",
    textColor: "#000000",
    textMutedColor: "#262626",
    cardColor: "#ffffff",
    cardBorderColor: "#000000",
    accentColor: "#000000",
    accentTextColor: "#ffffff",
    fontFamily: "Space Grotesk",
    cardShape: "sharp",
    cardStyle: "neobrutalism",
    textAlign: "left",
  },
};

/**
 * Stored JSON to a full theme: missing keys take the defaults, then every
 * value is checked. Anything invalid (or not JSON) gives null, which renders
 * the standard look.
 */
export function parseCustomTheme(
  raw: string | null | undefined
): CustomThemeConfig | null {
  if (!raw || raw.length > 4000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return null;
  const result = customThemeSchema.safeParse({
    ...DEFAULT_THEME_CONFIG,
    ...parsed,
  });
  return result.success ? result.data : null;
}

export function shapeToBorderRadius(shape?: CardShape): string {
  switch (shape) {
    case "sharp":
      return "0px";
    case "rounded":
      return "8px";
    case "smooth":
      return "16px";
    case "extra":
      return "24px";
    case "pill":
      return "9999px";
    default:
      return "16px";
  }
}

export function cardStyleClasses(style?: CardStyle): string {
  switch (style) {
    case "glass":
      return "backdrop-blur-md bg-opacity-30 shadow-lg";
    case "outline":
      return "bg-transparent border-2 shadow-none";
    case "shadow":
      return "shadow-xl border";
    case "neobrutalism":
      return "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]";
    case "solid":
    default:
      return "shadow-[0_1px_2px_rgb(17_24_39/0.05)] border";
  }
}

export function themeToCssVariables(theme: CustomThemeConfig): CSSProperties {
  const vars: Record<string, string> = {
    "--p-fg": theme.textColor,
    "--p-muted": theme.textMutedColor,
    "--p-card": theme.cardColor,
    "--p-line": theme.cardBorderColor,
    "--p-accent": theme.accentColor,
    "--p-accent-fg": theme.accentTextColor,
  };

  if (theme.backgroundType === "solid") {
    vars["--p-bg"] = theme.backgroundColor;
    vars.background = theme.backgroundColor;
  } else if (theme.backgroundType === "gradient") {
    const from = theme.gradientFrom || theme.backgroundColor;
    const to = theme.gradientTo || "#000000";
    const angle = theme.gradientAngle ?? 135;
    vars["--p-bg"] = from;
    vars.background = `linear-gradient(${angle}deg, ${from}, ${to})`;
  } else if (theme.backgroundType === "image" && theme.backgroundImageUrl) {
    vars["--p-bg"] = theme.backgroundColor;
    vars.backgroundImage = `url("${theme.backgroundImageUrl}")`;
    vars.backgroundSize = "cover";
    vars.backgroundPosition = "center";
  }

  if (theme.fontFamily) {
    vars.fontFamily = `"${theme.fontFamily}", sans-serif`;
  }

  return vars as CSSProperties;
}
