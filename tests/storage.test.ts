import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import sharp from "sharp";

import { blobStorageEnabled, databaseConfig } from "@/lib/env";
import {
  fileExtension,
  isProductFilePathname,
  safeFileName,
} from "@/lib/storage-keys";
import {
  deletePrivateFile,
  openPrivateFile,
  openPublicMedia,
  privateFileExists,
  saveImage,
  savePrivateFile,
} from "@/server/storage";

const UUID = "0b8f2c1e-3a4d-4e5f-8a9b-0c1d2e3f4a5b";

/** Sets env variables for one test and restores them afterwards. */
function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const saved = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("upload paths", () => {
  test("direct uploads may only create a new product file under files/", () => {
    assert.equal(isProductFilePathname(`files/${UUID}.zip`), true);
    assert.equal(isProductFilePathname(`files/${UUID}.pdf`), true);
    for (const bad of [
      `media/2026/${UUID}.webp`,
      `files/${UUID}.exe`,
      `files/${UUID}.ZIP`,
      `files/../${UUID}.zip`,
      `files/sub/${UUID}.zip`,
      `files/not-a-uuid.zip`,
      `/files/${UUID}.zip`,
      `files/${UUID}`,
    ])
      assert.equal(isProductFilePathname(bad), false, bad);
  });

  test("file names keep their extension and lose unsafe characters", () => {
    assert.equal(fileExtension("Template.ZIP"), ".zip");
    assert.equal(fileExtension("README"), "");
    assert.equal(
      safeFileName('My "best" <template>.zip', ".zip"),
      "My _best_ _template_.zip"
    );
    assert.equal(safeFileName("", ".pdf"), "produk.pdf");
  });
});

describe("environment", () => {
  test("the database falls back to the Turso integration's variables", () => {
    withEnv(
      {
        DATABASE_URL: undefined,
        DATABASE_AUTH_TOKEN: undefined,
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: "turso-token",
      },
      () =>
        assert.deepEqual(databaseConfig(), {
          url: "libsql://example.turso.io",
          authToken: "turso-token",
        })
    );
    withEnv(
      {
        DATABASE_URL: "file:./data/app.db",
        DATABASE_AUTH_TOKEN: undefined,
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: undefined,
      },
      () => assert.deepEqual(databaseConfig(), { url: "file:./data/app.db" })
    );
  });

  test("Blob storage switches on only when a store is connected", () => {
    withEnv(
      { BLOB_STORE_ID: undefined, BLOB_READ_WRITE_TOKEN: undefined },
      () => assert.equal(blobStorageEnabled(), false)
    );
    withEnv(
      { BLOB_STORE_ID: "store_abc", BLOB_READ_WRITE_TOKEN: undefined },
      () => assert.equal(blobStorageEnabled(), true)
    );
  });
});

describe("local disk storage", () => {
  let dir: string;
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "linkbio-storage-"));
    process.env.STORAGE_DIR = dir;
    delete process.env.BLOB_STORE_ID;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
  after(() => {
    delete process.env.STORAGE_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  test("images are re-encoded to WebP and served back by key", async () => {
    const png = await sharp({
      create: { width: 40, height: 20, channels: 3, background: "#2563eb" },
    })
      .png()
      .toBuffer();
    const saved = await saveImage(png, "cover");
    assert.match(saved.url, /^\/media\/\d{4}\/[0-9a-f-]{36}\.webp$/);
    const media = await openPublicMedia(saved.url.slice("/media/".length));
    assert.ok(media && media.size > 0);
    assert.equal(await openPublicMedia("../secret.webp"), null);
  });

  test("product files round-trip and can be deleted", async () => {
    const saved = await savePrivateFile(Buffer.from("isi file"), "Panduan.PDF");
    assert.match(saved.key, /^[0-9a-f-]{36}\.pdf$/);
    assert.equal(saved.name, "Panduan.PDF");
    assert.equal(await privateFileExists(saved.key), true);
    const file = await openPrivateFile(saved.key);
    assert.equal(file?.size, 8);
    await deletePrivateFile(saved.key);
    assert.equal(await privateFileExists(saved.key), false);
    await assert.rejects(
      savePrivateFile(Buffer.from("x"), "virus.exe"),
      /tidak didukung/
    );
  });
});
