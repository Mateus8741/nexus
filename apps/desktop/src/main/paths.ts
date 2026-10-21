import path from "node:path";

import { app } from "electron";

/** `dist/main/main.js` → raiz do app empacotado (contém dist/ e assets/). */
export const APP_ROOT = app.getAppPath();

export const preloadPath = path.join(APP_ROOT, "dist", "preload", "preload.js");
export const rendererFile = (name: "widget" | "settings"): string =>
  path.join(APP_ROOT, "dist", "renderer", name, "index.html");
export const assetPath = (...segments: string[]): string => path.join(APP_ROOT, "assets", ...segments);
