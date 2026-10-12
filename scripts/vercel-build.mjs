/**
 * Vercel build (npm run vercel-build). Production deploys refuse to build
 * without a hosted database, apply pending migrations to it, then build.
 * Preview deploys only build, so a branch can never change the live schema.
 */
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  if (!url || url.startsWith("file:")) {
    console.error(
      "✗ No hosted database for production. Connect Turso to the project (TURSO_DATABASE_URL) first."
    );
    process.exit(1);
  }
  run("npm run db:migrate");
}
run("next build");
