/** npm run db:migrate — applies pending migrations from db/migrations. */
import { getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";

runMigrations(getDb())
  .then(() => console.log("✓ Migrasi selesai"))
  .catch((error: unknown) => {
    console.error("✗", error instanceof Error ? error.message : error);
    process.exit(1);
  });
