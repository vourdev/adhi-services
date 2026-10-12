import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bioSegments } from "@/lib/bio-links";

describe("links in the bio", () => {
  test("a portfolio address becomes a link shown without https://", () => {
    assert.deepEqual(
      bioSegments(
        "Bekasi, Indonesia.\nPortfolio: https://muhammadadhi.vour.dev"
      ),
      [
        { kind: "text", text: "Bekasi, Indonesia.\nPortfolio: " },
        {
          kind: "link",
          href: "https://muhammadadhi.vour.dev/",
          label: "muhammadadhi.vour.dev",
        },
      ]
    );
  });

  test("sentence punctuation stays outside the link; paths and queries stay inside", () => {
    assert.deepEqual(bioSegments("Lihat https://example.dev/karya?tab=web."), [
      { kind: "text", text: "Lihat " },
      {
        kind: "link",
        href: "https://example.dev/karya?tab=web",
        label: "example.dev/karya?tab=web",
      },
      { kind: "text", text: "." },
    ]);
  });

  test("text without http(s) addresses is left alone", () => {
    assert.deepEqual(bioSegments("Email saya: a@b.co, web: example.dev"), [
      { kind: "text", text: "Email saya: a@b.co, web: example.dev" },
    ]);
    assert.deepEqual(bioSegments("javascript:alert(1) ftp://x.y"), [
      { kind: "text", text: "javascript:alert(1) ftp://x.y" },
    ]);
    assert.deepEqual(bioSegments(""), []);
  });
});
