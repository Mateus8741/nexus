import { app, Menu, nativeImage, Tray } from "electron";

import { assetPath } from "./paths";
import type { WidgetWindow } from "./widget-window";

export interface TrayActions {
  openSettings(): void;
  quit(): void;
}

export function createTray(widget: WidgetWindow, actions: TrayActions): { tray: Tray; refreshMenu(): void } {
  const mac = process.platform === "darwin";
  const image = nativeImage.createFromPath(assetPath(mac ? "trayTemplate.png" : "tray.png"));
  if (mac) image.setTemplateImage(true);

  const tray = new Tray(image);
  tray.setToolTip("Nexus");

  const buildMenu = (): Menu =>
    Menu.buildFromTemplate([
      { label: "Abrir widget", click: () => widget.show(tray.getBounds()) },
      {
        label: "Fixar na área de trabalho",
        type: "checkbox",
        checked: widget.isPinned(),
        click: (item) => widget.setPinned(item.checked),
      },
      { type: "separator" },
      { label: "Configurações…", click: actions.openSettings },
      { type: "separator" },
      { label: `Nexus ${app.getVersion()}`, enabled: false },
      { label: "Sair", click: actions.quit },
    ]);

  tray.on("click", () => widget.toggle(tray.getBounds()));
  tray.on("right-click", () => tray.popUpContextMenu(buildMenu()));

  return { tray, refreshMenu: () => undefined };
}
