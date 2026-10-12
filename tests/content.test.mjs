import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname;

// Copy rules apply to everything a visitor or the owner can read.
const COPY_DIRS = ["app", "components", "lib", "server"];
const files = COPY_DIRS.flatMap((dir) =>
  readdirSync(join(root, dir), { recursive: true })
    .filter((name) => /\.(tsx?|css)$/.test(name) && !name.startsWith("ui/"))
    .map((name) => join(dir, name))
);
const read = (file) => readFileSync(join(root, file), "utf8");

test("no em dash or en dash in page copy", () => {
  for (const file of files) {
    const line = read(file)
      .split("\n")
      .find((text) => /[–—]/.test(text));
    assert.equal(line, undefined, `${file}: ${line?.trim()}`);
  }
});

// Drops /* */ and // comments so maintainer notes are not mistaken for copy.
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

test("copy never presents Adhi as an agency or invents clients", () => {
  const banned =
    /\b(klien kami|tim kami|agensi|agency|testimoni|terpercaya|garansi|dijamin|halaman pertama google)\b/i;
  for (const file of files) {
    const line = stripComments(read(file))
      .split("\n")
      .find((text) => banned.test(text));
    assert.equal(line, undefined, `${file}: ${line?.trim()}`);
  }
});

test("Vour appears only in the owner's own portfolio, GitHub and email", () => {
  for (const file of files) {
    for (const line of read(file).split("\n")) {
      const stripped = line
        .replace(/https:\/\/muhammadadhi\.vour\.dev\/?/g, "")
        // His GitHub account and CV email, shown because he asked for all his contacts.
        .replace(/https:\/\/github\.com\/vourdev/g, "")
        .replace(/(mailto:)?muhammadadhi@vour\.dev/g, "");
      assert.ok(!/vour/i.test(stripped), `${file}: ${line.trim()}`);
    }
  }
});

test("no phone or domain placeholders are left in the code", () => {
  // The number lives in the database (Settings) and the domain in SITE_URL.
  for (const file of files) {
    const text = read(file);
    assert.ok(
      !text.includes("WHATSAPP_NUMBER"),
      `${file} references a placeholder number`
    );
    assert.ok(
      !/["']SITE_URL["']\s*[,}]/.test(text),
      `${file} uses SITE_URL as a value`
    );
  }
});
