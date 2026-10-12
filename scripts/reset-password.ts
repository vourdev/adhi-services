/**
 * npm run admin:password
 *
 * Sets a new password for the owner account and signs out every session.
 * Use it when the password is lost; it needs access to the database.
 */
import { getDb } from "@/db/client";
import { passwordSchema } from "@/lib/validation";
import { resetPassword } from "@/server/setup";

import { ask, askHidden } from "./prompt";

async function main() {
  const email = (await ask("Email akun")).toLowerCase();
  const password = await askHidden("Password baru");
  const confirm = await askHidden("Ulangi password baru");
  if (password !== confirm) throw new Error("Password tidak sama.");
  passwordSchema.parse(password);
  if (!(await resetPassword(getDb(), email, password)))
    throw new Error("Akun tidak ditemukan.");
  console.log("✓ Password diganti. Semua sesi login sudah dikeluarkan.");
}

main().catch((error: unknown) => {
  console.error("✗", error instanceof Error ? error.message : error);
  process.exit(1);
});
