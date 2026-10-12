import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  let target = specifier;
  if (specifier.startsWith("@/")) {
    target = new URL(specifier.slice(2), root).href;
  }

  const isPath =
    target.startsWith("file:") ||
    target.startsWith("./") ||
    target.startsWith("../");
  if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
    const base = target.startsWith("file:")
      ? target
      : new URL(target, context.parentURL).href;
    for (const suffix of [".ts", "/index.ts"]) {
      const candidate = base + suffix;
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate, context);
      }
    }
  }

  return nextResolve(target, context);
}
