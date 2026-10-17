import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import type { Database } from "@/db/client";
import { parseCustomTheme, themeToCssVariables } from "@/lib/custom-theme";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/server/platform-settings";

import { createTestDb } from "./helpers/db";

let db: Database;
let cleanup: () => void;

before(async () => {
  ({ db, cleanup } = await createTestDb());
});

after(() => {
  cleanup();
});

describe("site settings", () => {
  test("brand and contact settings", async () => {
    const defaultSettings = await getPlatformSettings(db);
    assert.equal(defaultSettings.brandName, "Adhi Web Services");

    const updateRes = await updatePlatformSettings(db, {
      brandName: "Adhi Bio Platform",
      brandTagline: "Platform Link Bio & Toko Digital",
    });
    assert.equal(updateRes.ok, true);

    const updated = await getPlatformSettings(db);
    assert.equal(updated.brandName, "Adhi Bio Platform");
    assert.equal(updated.brandTagline, "Platform Link Bio & Toko Digital");

    await updatePlatformSettings(db, {
      brandName: "Adhi Bio Platform",
      contactEmail: " halo@example.id ",
      contactPhone: "0812 3456 7890",
      businessAddress: "",
    });
    const withContact = await getPlatformSettings(db);
    assert.equal(withContact.contactEmail, "halo@example.id");
    assert.equal(withContact.contactPhone, "0812 3456 7890");
    assert.equal(withContact.businessAddress, null);

    // Saving the brand alone leaves the contact as it was.
    await updatePlatformSettings(db, { brandName: "Adhi Bio Platform" });
    assert.equal(
      (await getPlatformSettings(db)).contactEmail,
      "halo@example.id"
    );
  });

  test("ultra-customizer theme parser and CSS variables generator", () => {
    const jsonStr = JSON.stringify({
      preset: "custom",
      backgroundType: "gradient",
      gradientFrom: "#0f172a",
      gradientTo: "#1e1b4b",
      backgroundColor: "#0f172a",
      textColor: "#f8fafc",
      textMutedColor: "#94a3b8",
      cardColor: "rgba(255, 255, 255, 0.08)",
      cardBorderColor: "rgba(255, 255, 255, 0.18)",
    });
    const parsed = parseCustomTheme(jsonStr);
    assert.ok(parsed);
    assert.equal(parsed.backgroundType, "gradient");

    const cssVars = themeToCssVariables(parsed);
    assert.ok(cssVars);
    const record = cssVars as Record<string, string>;
    assert.ok(typeof record["--p-bg"] === "string");
    assert.ok(typeof record["--p-fg"] === "string");
    assert.ok(typeof record["--p-card"] === "string");
  });
});
