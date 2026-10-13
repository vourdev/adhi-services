import type { CSSProperties } from "react";
import * as z from "zod";

import { CARD_SHAPES, CARD_STYLES, FONTS, THEME_PRESETS } from "./domain";

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

/**
 * Page colours of a "custom" theme as inline CSS variables. The accent, font
 * and card settings come from the profile's own fields, as with the presets.
 */
export function themeToCssVariables(theme: CustomThemeConfig): CSSProperties {
  const vars: Record<string, string> = {
    "--p-fg": theme.textColor,
    "--p-muted": theme.textMutedColor,
    "--p-card": theme.cardColor,
    "--p-line": theme.cardBorderColor,
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

  return vars as CSSProperties;
}
