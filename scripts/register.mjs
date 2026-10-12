// Lets `node` (tests and scripts) import the app's TypeScript modules directly.
// Node strips the types; this hook only resolves "@/..." and extensionless paths.
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
