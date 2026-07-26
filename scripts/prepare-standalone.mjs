import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const standalone = resolve(root, ".next/standalone");

if (!existsSync(resolve(standalone, "server.js"))) {
  throw new Error("Standalone output is missing. Run next build first.");
}

cpSync(resolve(root, "public"), resolve(standalone, "public"), {
  recursive: true,
});
cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), {
  recursive: true,
});
