import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

export default defineConfig({
  dialect: "turso",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: authToken ? { url, authToken } : { url },
  strict: true,
  verbose: true,
});
