import { rmSync } from "node:fs";
import { join } from "node:path";

const targets = [".next", "tsconfig.tsbuildinfo"].map((target) => join(process.cwd(), target));

for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
}

console.log("Removed .next and TypeScript incremental cache.");
