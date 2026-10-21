import { BrowserWindow, type Rectangle, screen } from "electron";

import { IPC } from "../shared/types";
import { preloadPath, rendererFile } from "./paths";
import type { ConfigStore } from "./store";

export const WIDGET_WIDTH = 380;
export const WIDGET_HEIGHT = 660;
/** Margem transparente ao redor do painel, para a sombra CSS não ser cortada. */
const PAD = 14;

/**
 * Janela do widget. Dois modos:
 *  - popover: ancorada ao ícone da bandeja, some ao perder o foco;
 *  - fixado ("Fixar na área de trabalho"): fica visível, arrastável, posição salva.
 */
export class WidgetWindow {
  readonly window: BrowserWindow;
  private pinned: boolean;
  private lastHiddenAt = 0;

  constructor(private readonly store: ConfigStore, private readonly onPinned: (pinned: boolean) => void) {
    this.pinned = store.get(false).pinned;
    this.window = new BrowserWindow({
      width: WIDGET_WIDTH + PAD * 2,
      height: WIDGET_HEIGHT + PAD * 2,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      hasShadow: false,
      skipTaskbar: true,
      alwaysOnTop: !this.pinned,
      backgroundColor: "#00000000",
      title: "Nexus",
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    if (process.platform === "darwin") this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    void this.window.loadFile(rendererFile("widget"));

    this.window.on("blur", () => {
      if (this.pinned || process.env.NEXUS_DESKTOP_SCREENSHOT) return;
      this.hide();
    });
    this.window.on("moved", () => {
      if (!this.pinned) return;
      const [x, y] = this.window.getPosition();
      if (x !== undefined && y !== undefined) this.store.setWidgetPosition({ x, y });
    });
    this.window.on("close", (event) => {
      event.preventDefault();
      this.window.hide();
    });
  }

  isPinned(): boolean {
    return this.pinned;
  }

  isVisible(): boolean {
    return this.window.isVisible();
  }

  setPinned(pinned: boolean): void {
    this.pinned = pinned;
    this.store.setPinned(pinned);
    this.window.setAlwaysOnTop(!pinned);
    this.window.setMovable(true);
    this.window.webContents.send(IPC.pinned, pinned);
    this.onPinned(pinned);
    if (pinned) {
      this.moveToPinnedPosition();
      this.window.show();
    }
  }

  hide(): void {
    if (!this.window.isVisible()) return;
    this.lastHiddenAt = Date.now();
    this.window.hide();
  }

  /** Clique no ícone: alterna. Ignora o clique que acabou de causar o blur→hide. */
  toggle(trayBounds?: Rectangle): void {
    if (this.window.isVisible() && !this.pinned) {
      this.hide();
      return;
    }
    if (!this.window.isVisible() && Date.now() - this.lastHiddenAt < 250) return;
    this.show(trayBounds);
  }

  show(trayBounds?: Rectangle): void {
    if (this.pinned) this.moveToPinnedPosition();
    else this.anchorTo(trayBounds);
    this.window.show();
    this.window.focus();
  }

  private moveToPinnedPosition(): void {
    const saved = this.store.widgetPosition;
    if (saved) {
      this.window.setPosition(saved.x, saved.y);
      return;
    }
    const { workArea } = screen.getPrimaryDisplay();
    this.window.setPosition(workArea.x + workArea.width - this.window.getBounds().width - 12, workArea.y + 24);
  }

  private anchorTo(trayBounds?: Rectangle): void {
    const { width, height } = this.window.getBounds();
    const point = trayBounds
      ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y + trayBounds.height / 2 }
      : screen.getCursorScreenPoint();
    const { workArea } = screen.getDisplayNearestPoint(point);

    let x: number;
    let y: number;
    if (process.platform === "darwin" && trayBounds) {
      x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2);
      y = Math.round(trayBounds.y + trayBounds.height - PAD / 2);
    } else {
      // Windows/Linux: canto inferior direito, acima da barra de tarefas.
      x = workArea.x + workArea.width - width + PAD - 8;
      y = workArea.y + workArea.height - height + PAD - 8;
    }
    x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width));
    y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height));
    this.window.setPosition(x, y);
  }
}
