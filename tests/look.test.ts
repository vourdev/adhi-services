import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  accentTokens,
  contrastRatio,
  DARK_SURFACES,
  LIGHT_SURFACES,
  luminance,
  normalizeHex,
} from "@/lib/color";
import {
  lookFromProfile,
  lookMode,
  PRESETS,
  surfaceAttributes,
  visitorLook,
} from "@/lib/profile-look";
import { profileInputSchema } from "@/lib/validation";

const PICKED = [
  "#ffff00",
  "#ffffff",
  "#000000",
  "#2ee6ff",
  "#ff90e8",
  "#c4b5fd",
  "#1d4fd8",
  "#7c3aed",
  "#22c55e",
  "#f97316",
  "#808080",
  "#0f172a",
];

describe("colour math", () => {
  test("hex colours are normalized and anything else is refused", () => {
    assert.equal(normalizeHex("#ABC"), "#aabbcc");
    assert.equal(normalizeHex("2563EB"), "#2563eb");
    for (const bad of ["", "#12", "#12345", "#1234567", "red", "#ggg000"])
      assert.equal(normalizeHex(bad), null, bad);
  });

  test("contrast follows WCAG", () => {
    assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
    assert.equal(contrastRatio("#777777", "#777777"), 1);
  });

  test("a picked accent keeps its colour and gets readable text shades", () => {
    for (const hex of PICKED) {
      const { light, dark } = accentTokens(hex);
      assert.equal(light.fill, hex, "buttons use the picked colour");
      assert.ok(contrastRatio(light.onFill, light.fill) >= 4.5, hex);
      assert.ok(contrastRatio(dark.onFill, dark.fill) >= 4.5, hex);
      for (const surface of LIGHT_SURFACES)
        assert.ok(
          contrastRatio(light.text, surface) >= 4.5,
          `${hex} on ${surface}`
        );
      for (const surface of DARK_SURFACES) {
        assert.ok(
          contrastRatio(dark.text, surface) >= 4.5,
          `${hex} on ${surface}`
        );
        assert.ok(
          contrastRatio(dark.fill, surface) >= 3,
          `${hex} fill on ${surface}`
        );
      }
    }
  });

  test("the page colours in the stylesheet are covered by the contrast check", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const surfaces = [
      ...css.matchAll(/--p-(?:bg|card):\s*(#[0-9a-f]{6})\b/gi),
    ].map((match) => match[1]!.toLowerCase());
    assert.ok(surfaces.length >= 8);
    for (const surface of new Set(surfaces)) {
      const light = luminance(surface) > 0.3;
      for (const hex of PICKED) {
        const tokens = accentTokens(hex);
        const text = light ? tokens.light.text : tokens.dark.text;
        assert.ok(
          contrastRatio(text, surface) >= 4.5,
          `${hex} text on ${surface}: add ${surface} to ${light ? "LIGHT" : "DARK"}_SURFACES`
        );
      }
    }
  });
});

describe("profile look", () => {
  test("unknown values fall back to the standard look", () => {
    assert.deepEqual(
      lookFromProfile({
        theme: "sepia",
        accent: "red",
        themePreset: "retro",
        fontFamily: "Comic Sans",
        cardShape: "blob",
        cardStyle: "3d",
      }),
      {
        theme: "system",
        accent: "blue",
        preset: "default",
        font: "Plus Jakarta Sans",
        cardShape: "smooth",
        cardStyle: "solid",
        customTheme: null,
      }
    );
  });

  test("on free, visitors get the standard look with the owner's accent and mode", () => {
    const look = visitorLook(
      {
        theme: "dark",
        accent: "#ff6600",
        themePreset: "neon",
        fontFamily: "Inter",
        cardShape: "pill",
        cardStyle: "glow",
      },
      false
    );
    assert.equal(look.preset, "default");
    assert.equal(look.font, "Plus Jakarta Sans");
    assert.equal(look.cardShape, "smooth");
    assert.equal(look.cardStyle, "solid");
    assert.equal(look.accent, "#ff6600");
    assert.equal(look.theme, "dark");
  });

  test("font, card shape and card style all reach the page", () => {
    const attributes = surfaceAttributes(
      lookFromProfile({
        theme: "light",
        accent: "violet",
        themePreset: "minimal",
        fontFamily: "Playfair Display",
        cardShape: "sharp",
        cardStyle: "neobrutalism",
      })
    );
    assert.equal(attributes["data-preset"], "minimal");
    assert.equal(attributes["data-card-shape"], "sharp");
    assert.equal(attributes["data-card-style"], "neobrutalism");
    assert.equal(attributes["data-accent"], "violet");
    assert.match(String(attributes.style.fontFamily), /var\(--font-playfair\)/);
  });

  test("dark and light presets override the light/dark setting; the others follow it", () => {
    assert.equal(
      lookMode(lookFromProfile({ theme: "light", themePreset: "neon" })),
      "dark"
    );
    assert.equal(
      lookMode(
        lookFromProfile({ theme: "light", themePreset: "glassmorphism" })
      ),
      "dark"
    );
    assert.equal(
      lookMode(lookFromProfile({ theme: "dark", themePreset: "brutalist" })),
      "light"
    );
    assert.equal(
      lookMode(lookFromProfile({ theme: "dark", themePreset: "minimal" })),
      "dark"
    );
    assert.equal(lookMode(lookFromProfile({ theme: "system" })), "system");
  });

  test("a picked accent becomes inline colour variables", () => {
    const attributes = surfaceAttributes(
      lookFromProfile({ accent: "#FFFF00" })
    );
    assert.equal(attributes["data-accent"], "custom");
    const style = attributes.style as Record<string, string>;
    assert.equal(style["--accent-light"], "#ffff00");
    assert.ok(contrastRatio(style["--accent-text-light"]!, "#ffffff") >= 4.5);
    assert.ok(contrastRatio(style["--accent-fg-light"]!, "#ffff00") >= 4.5);
  });

  test("every preset's defaults are valid profile settings", () => {
    for (const [preset, definition] of Object.entries(PRESETS)) {
      const parsed = profileInputSchema.safeParse({
        displayName: "Nama",
        theme: "system",
        accent: definition.accent,
        themePreset: preset,
        fontFamily: definition.font,
        cardShape: definition.cardShape,
        cardStyle: definition.cardStyle,
      });
      assert.ok(parsed.success, preset);
    }
  });

  test("the accent field takes a named accent or a hex colour, nothing else", () => {
    const parse = (accent: string) =>
      profileInputSchema.safeParse({
        displayName: "Nama",
        theme: "system",
        accent,
      });
    assert.equal(parse("rose").data?.accent, "rose");
    assert.equal(parse("#ABC").data?.accent, "#aabbcc");
    assert.equal(parse("2563eb").data?.accent, "#2563eb");
    for (const bad of [
      "red",
      "#12",
      "rgb(0, 0, 0)",
      "url(x)",
      "#ff0000; color: red",
    ])
      assert.equal(parse(bad).success, false, bad);
  });
});
