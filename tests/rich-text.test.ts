import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isRichText, plainTextToHtml, richTextToPlain } from "@/lib/rich-text";
import { sanitizeRichText } from "@/server/rich-text";

describe("product description HTML", () => {
  test("scripts, handlers, images and unsafe links are removed", () => {
    const clean = sanitizeRichText(
      '<p onclick="steal()">Halo <a href="javascript:alert(1)">klik</a><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://x"></iframe></p>'
    );
    assert.equal(clean, "<p>Halo klik</p>");
  });

  test("links open in a new tab without passing the page along", () => {
    assert.equal(
      sanitizeRichText(
        '<p><a href="https://contoh.id" target="_self" rel="opener">Contoh</a></p>'
      ),
      '<p><a href="https://contoh.id" target="_blank" rel="nofollow noopener noreferrer">Contoh</a></p>'
    );
  });

  test("what the toolbar makes survives; pasted variants are normalised", () => {
    assert.equal(
      sanitizeRichText(
        "<h1>Judul</h1><p><b>tebal</b> <i>miring</i> <u>garis</u> <del>coret</del></p><ul><li><p>satu</p></li></ul><blockquote><p>kutip</p></blockquote>"
      ),
      "<h2>Judul</h2><p><strong>tebal</strong> <em>miring</em> <u>garis</u> <s>coret</s></p><ul><li><p>satu</p></li></ul><blockquote><p>kutip</p></blockquote>"
    );
  });

  test("an emptied editor stores nothing", () => {
    assert.equal(sanitizeRichText("<p></p>"), "");
    assert.equal(sanitizeRichText("   "), "");
    assert.equal(
      sanitizeRichText("<p></p><p>Isi</p><p><br></p><p></p>"),
      "<p>Isi</p>"
    );
  });

  test("old plain-text descriptions become paragraphs and lists", () => {
    assert.equal(isRichText("Halo\n- a"), false);
    assert.equal(
      plainTextToHtml(
        "Yang Anda dapat:\n- Source code\n- Panduan <deploy>\n\nSelesai."
      ),
      "<p>Yang Anda dapat:</p><ul><li><p>Source code</p></li><li><p>Panduan &lt;deploy&gt;</p></li></ul><p>Selesai.</p>"
    );
    assert.equal(
      sanitizeRichText("Dua baris\nteks"),
      "<p>Dua baris<br />teks</p>"
    );
  });

  test("the plain version reads as text for meta descriptions", () => {
    assert.equal(
      richTextToPlain(
        "<h2>Fitur</h2><ul><li><p>Cepat &amp; ringan</p></li></ul>"
      ),
      "Fitur Cepat & ringan"
    );
  });
});
