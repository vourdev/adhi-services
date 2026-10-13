import {
  Inter,
  Outfit,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Poppins,
  Space_Grotesk,
} from "next/font/google";

/** The site font, preloaded on every page. */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Profile fonts a premium owner can pick (FONTS in lib/domain.ts). Not
// preloaded: a browser downloads one only when a page renders with it.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/** Declares every font's CSS variable (used by fontStack in lib/profile-look.ts); set on <html>. */
export const fontVariables = [
  jakarta,
  inter,
  poppins,
  outfit,
  spaceGrotesk,
  playfair,
]
  .map((font) => font.variable)
  .join(" ");
