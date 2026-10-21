/**
 * Bundle do Nexus Desktop (esbuild) → dist/
 *  - dist/main/main.js          processo main (CJS; embute o Agent de @nexus/agent-windows e `ws`)
 *  - dist/preload/preload.js    ponte tipada (contextBridge)
 *  - dist/renderer/<janela>/    HTML + JS + CSS do widget e das configurações
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const at = (...p: string[]): string => path.join(root, ...p);

fs.rmSync(dist, { recursive: true, force: true });

const common = { bundle: true, sourcemap: false, logLevel: "info" as const };

await esbuild.build({
  ...common,
  entryPoints: [at("src/main/main.ts")],
  outfile: at("dist/main/main.js"),
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron", "bufferutil", "utf-8-validate"],
  minify: true,
});

await esbuild.build({
  ...common,
  entryPoints: [at("src/preload/preload.ts")],
  outfile: at("dist/preload/preload.js"),
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
});

for (const name of ["widget", "settings"] as const) {
  await esbuild.build({
    ...common,
    entryPoints: { main: at(`src/renderer/${name}/main.ts`), styles: at(`src/renderer/${name}/styles.css`) },
    outdir: at(`dist/renderer/${name}`),
    platform: "browser",
    format: "iife",
    target: "chrome130",
    minify: true,
  });
  fs.copyFileSync(at(`src/renderer/${name}/index.html`), at(`dist/renderer/${name}/index.html`));
}

console.log("✓ dist/ pronto");
