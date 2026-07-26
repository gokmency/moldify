import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const standalone = resolve(process.cwd(), ".next/standalone");
const server = resolve(standalone, "server.js");

if (!existsSync(server)) {
  throw new Error("Standalone output is missing. Run npm run build first.");
}

process.chdir(standalone);
await import(pathToFileURL(server).href);
