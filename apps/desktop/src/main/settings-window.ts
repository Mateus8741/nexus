import { BrowserWindow } from "electron";

import { preloadPath, rendererFile } from "./paths";

let instance: BrowserWindow | undefined;

export function openSettingsWindow(): BrowserWindow {
  if (instance && !instance.isDestroyed()) {
    instance.show();
    instance.focus();
    return instance;
  }
  const mac = process.platform === "darwin";
  instance = new BrowserWindow({
    width: 540,
    height: 720,
    minWidth: 480,
    minHeight: 620,
    title: "Nexus — Configurações",
    backgroundColor: "#070b17",
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: mac ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: { preload: preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  instance.setMenuBarVisibility(false);
  void instance.loadFile(rendererFile("settings"));
  instance.once("ready-to-show", () => instance?.show());
  instance.on("closed", () => {
    instance = undefined;
  });
  return instance;
}

export function closeSettingsWindow(): void {
  if (instance && !instance.isDestroyed()) instance.close();
}
