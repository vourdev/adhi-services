/**
 * Colour math for custom accent colours: WCAG contrast, and lightness
 * changes in OKLCH so a colour keeps its hue while it is darkened or
 * lightened. Pure functions; used on the server, in the browser and in tests.
 */

type Rgb = readonly [number, number, number];

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#abc", "abc" or "#AABBCC" to "#aabbcc"; anything else gives null. */
export function normalizeHex(value: string): string | null {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match?.[1]) return null;
  const digits = match[1].toLowerCase();
  return digits.length === 3
    ? `#${[...digits].map((digit) => digit + digit).join("")}`
    : `#${digits}`;
}

function toRgb(hex: string): Rgb {
  const value = normalizeHex(hex);
  if (!value) throw new Error(`Not a hex colour: ${hex}`);
  return [
    Number.parseInt(value.slice(1, 3), 16) / 255,
    Number.parseInt(value.slice(3, 5), 16) / 255,
    Number.parseInt(value.slice(5, 7), 16) / 255,
  ];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const fromLinear = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(toLinear) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

type Oklch = { l: number; c: number; h: number };

function toOklch(hex: string): Oklch {
  const [r, g, b] = toRgb(hex).map(toLinear) as unknown as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

/** Linear sRGB for an OKLCH colour; channels may fall outside 0..1. */
function oklchToLinear({ l: L, c, h }: Oklch): Rgb {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** The colour at lightness `l` with the same hue, losing chroma only where sRGB cannot show it. */
function withLightness(color: Oklch, l: number): string {
  let chroma = color.c;
  if (!inGamut(oklchToLinear({ ...color, l }))) {
    let low = 0;
    let high = color.c;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinear({ ...color, l, c: mid }))) low = mid;
      else high = mid;
    }
    chroma = low;
  }
  const linear = oklchToLinear({ ...color, l, c: chroma });
  return toHex(linear.map(fromLinear) as unknown as Rgb);
}

/** Lowest contrast of `hex` against any of `surfaces`. */
function worstContrast(hex: string, surfaces: readonly string[]): number {
  return Math.min(...surfaces.map((surface) => contrastRatio(hex, surface)));
}

/**
 * The closest colour to `hex`, same hue, that reaches `target` contrast
 * against every surface: darker for light surfaces, lighter for dark ones.
 * Returns `hex` unchanged when it already passes.
 */
export function ensureContrast(
  hex: string,
  surfaces: readonly string[],
  target: number,
  direction: "darken" | "lighten"
): string {
  const color = normalizeHex(hex);
  if (!color) throw new Error(`Not a hex colour: ${hex}`);
  if (worstContrast(color, surfaces) >= target) return color;
  const start = toOklch(color);
  // Search between the colour and black (or white) for the first passing lightness.
  let near = start.l;
  let far = direction === "darken" ? 0 : 1;
  for (let i = 0; i < 24; i++) {
    const mid = (near + far) / 2;
    if (worstContrast(withLightness(start, mid), surfaces) >= target) far = mid;
    else near = mid;
  }
  return withLightness(start, far);
}

const WHITE = "#ffffff";
// Dark enough that white or this always reaches 4.5:1 on any fill.
const INK = "#050505";

/** White or near-black, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, WHITE) >= contrastRatio(hex, INK) ? WHITE : INK;
}

/**
 * Page and card colours a custom accent is shown on, per mode, across all
 * presets (mirror of the --p-bg / --p-card values in app/globals.css).
 * Accent text must stay readable on each of them.
 */
export const LIGHT_SURFACES = ["#ffffff", "#f1f3f6", "#ffde59"] as const;
export const DARK_SURFACES = [
  "#0d1016",
  "#171b23",
  "#0d0d16",
  "#13131f",
  "#2a2550",
] as const;

export type AccentTokens = {
  /** Fill for buttons and the avatar placeholder. */
  fill: string;
  /** Text and icons on the fill. */
  onFill: string;
  /** Accent used as text or icon colour on the page and on cards. */
  text: string;
};

/**
 * Light and dark tokens for a custom accent. The fill is the chosen colour
 * (lifted in dark mode when it would disappear into the page, as the built-in
 * accents do); text uses a shade that passes WCAG AA (4.5:1).
 */
export function accentTokens(hex: string): {
  light: AccentTokens;
  dark: AccentTokens;
} {
  const color = normalizeHex(hex);
  if (!color) throw new Error(`Not a hex colour: ${hex}`);
  const darkFill = ensureContrast(color, DARK_SURFACES, 3, "lighten");
  return {
    light: {
      fill: color,
      onFill: readableOn(color),
      text: ensureContrast(color, LIGHT_SURFACES, 4.5, "darken"),
    },
    dark: {
      fill: darkFill,
      onFill: readableOn(darkFill),
      text: ensureContrast(color, DARK_SURFACES, 4.5, "lighten"),
    },
  };
}
