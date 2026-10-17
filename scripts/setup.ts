/**
 * npm run setup
 *
 * Applies database migrations, then creates the owner account and profile
 * if none exists yet. Values come from .env.local (ADMIN_EMAIL,
 * ADMIN_PASSWORD, ADMIN_NAME, ADMIN_USERNAME) or are asked interactively.
 * Safe to run again: it only migrates when the owner already exists.
 */
import { getClient, getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { databaseConfig, siteUrl } from "@/lib/env";
import { passwordSchema, usernameSchema } from "@/lib/validation";
import { createOwner, hasOwner } from "@/server/setup";
import * as z from "zod";

import { ask, askHidden } from "./prompt";

async function main() {
  const db = getDb();
  const { url } = databaseConfig();
  if (url.startsWith("file:")) {
    await getClient().execute("PRAGMA journal_mode = WAL");
  }
  await runMigrations(db);
  console.log(
    `✓ Migrasi database selesai (${url.startsWith("file:") ? url : "remote"})`
  );

  if (await hasOwner(db)) {
    console.log("✓ Akun pemilik sudah ada. Tidak ada yang diubah.");
    return;
  }

  const email = z
    .email("Email tidak valid.")
    .parse(
      (process.env.ADMIN_EMAIL ?? (await ask("Email admin")))
        .trim()
        .toLowerCase()
    );
  const name = (
    process.env.ADMIN_NAME ?? (await ask("Nama tampilan", "Adhi Nugroho"))
  ).trim();
  const username = usernameSchema.parse(
    process.env.ADMIN_USERNAME ?? (await ask("Username profil", "adhinugroho"))
  );

  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    password = await askHidden("Password (min. 10 karakter, huruf dan angka)");
    const confirm = await askHidden("Ulangi password");
    if (password !== confirm) throw new Error("Password tidak sama.");
  }
  passwordSchema.parse(password);

  const starterContent = process.env.SETUP_STARTER_CONTENT !== "false";
  const { profile } = await createOwner(
    db,
    { email, password, name, username },
    { starterContent }
  );

  console.log(`✓ Akun pemilik dibuat: ${email}`);
  console.log(`  Profil publik : ${siteUrl()}/${profile.username}`);
  console.log(`  Dashboard     : ${siteUrl()}/admin`);
  if (process.env.ADMIN_PASSWORD) {
    console.log("  Hapus ADMIN_PASSWORD dari .env.local setelah ini.");
  }
}

main().catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    console.error(`✗ ${error.issues.map((issue) => issue.message).join(" ")}`);
  } else {
    console.error("✗", error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
