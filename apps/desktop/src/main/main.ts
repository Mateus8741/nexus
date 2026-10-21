import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { IPC, type SaveConfigInput } from "../shared/types";

// O Agent resolve token/agent-id lendo NEXUS_AGENT_HOME a cada chamada; apontar
// para userData mantém tudo do app num só lugar (e desinstalável).
process.env.NEXUS_AGENT_HOME ??= path.join(app.getPath("userData"), "agent");

import { AgentService } from "./agent-service";
import { CoreClient, testConnection, toHttpUrl } from "./core-client";
import { closeSettingsWindow, openSettingsWindow } from "./settings-window";
import { ConfigStore } from "./store";
import { createTray } from "./tray";
import { WidgetWindow } from "./widget-window";

const DEMO = process.env.NEXUS_DESKTOP_DEMO === "1";

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let widget: WidgetWindow | undefined;

app.on("second-instance", () => widget?.show());
// App de bandeja: fechar janelas não encerra o processo.
app.on("window-all-closed", () => undefined);

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.hide();
  app.setName("Nexus");

  const store = new ConfigStore();
  const core = new CoreClient();
  const agent = new AgentService();

  const backendFor = () => {
    const config = store.get(DEMO);
    const apiKey = store.getApiKey();
    const mode = DEMO ? "demo" : store.isConfigured() ? "live" : "unconfigured";
    return { mode, baseUrl: toHttpUrl(config.coreUrl), apiKey, environmentName: config.environmentName } as const;
  };

  const applyConfig = (): void => {
    const config = store.get(DEMO);
    core.configure(backendFor());
    app.setLoginItemSettings({ openAtLogin: config.launchAtLogin, openAsHidden: true });
    void agent.apply({
      enabled: config.runAgent && !DEMO,
      coreUrl: config.coreUrl,
      deviceName: config.deviceName || os.hostname(),
    });
  };

  widget = new WidgetWindow(store, () => undefined);
  const tray = createTray(widget, { openSettings: openSettingsWindow, quit: () => app.quit() });

  core.on("snapshot", (snapshot) => widget?.window.webContents.send(IPC.snapshot, snapshot));
  agent.on("status", (status) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC.agentStatus, status);
  });

  ipcMain.handle(IPC.getSnapshot, () => core.snapshot());
  ipcMain.handle(IPC.refresh, () => core.refresh());
  ipcMain.handle(IPC.runActions, (_e, requests) => core.runActions(requests));
  ipcMain.handle(IPC.getConfig, () => store.get(DEMO));
  ipcMain.handle(IPC.saveConfig, (_e, input: SaveConfigInput) => {
    store.save(input);
    applyConfig();
    return store.get(DEMO);
  });
  ipcMain.handle(IPC.testConnection, (_e, coreUrl: string, apiKey?: string) =>
    testConnection(coreUrl, apiKey?.trim() || store.getApiKey() || ""),
  );
  ipcMain.handle(IPC.getAgentStatus, () => agent.getStatus());
  ipcMain.handle(IPC.setPinned, (_e, pinned: boolean) => {
    widget?.setPinned(pinned);
    return pinned;
  });
  ipcMain.handle(IPC.getVersion, () => app.getVersion());
  ipcMain.on(IPC.hideWidget, () => widget?.hide());
  ipcMain.on(IPC.openSettings, () => {
    widget?.hide();
    openSettingsWindow();
  });
  ipcMain.on(IPC.closeSettings, closeSettingsWindow);
  ipcMain.on(IPC.quit, () => app.quit());

  applyConfig();

  const shotPath = process.env.NEXUS_DESKTOP_SCREENSHOT;
  if (shotPath) void captureScreens(shotPath);

  const startedHidden = process.argv.includes("--hidden") || app.getLoginItemSettings().wasOpenedAsHidden;
  if (!DEMO && !store.isConfigured()) openSettingsWindow();
  else if (widget.isPinned()) widget.show();
  else if (DEMO || !startedHidden) setTimeout(() => widget?.show(tray.tray.getBounds()), 400);
});

/** Dev aid: NEXUS_DESKTOP_SCREENSHOT=/caminho/widget.png grava widget + configurações e encerra. */
async function captureScreens(file: string): Promise<void> {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await wait(2800);
  if (widget) {
    fs.writeFileSync(file, (await widget.window.webContents.capturePage()).toPNG());
    await widget.window.webContents.executeJavaScript(
      `document.querySelector('[data-scene="cozy"]').click(); document.querySelector('.card.cat-climate').click();`,
    );
    await wait(1800);
    fs.writeFileSync(file.replace(/\.png$/, "-cozy.png"), (await widget.window.webContents.capturePage()).toPNG());
    widget.window.hide();
  }
  const settings = openSettingsWindow();
  await wait(1800);
  fs.writeFileSync(file.replace(/\.png$/, "-settings.png"), (await settings.webContents.capturePage()).toPNG());
  app.quit();
}

app.on("before-quit", () => {
  widget?.window.removeAllListeners("close");
});
