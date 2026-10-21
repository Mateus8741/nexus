/**
 * Gera os PNGs de assets/ e build/ usando o próprio Electron para rasterizar
 * SVG (sem dependências nativas):   bunx electron scripts/make-icons.cjs
 * electron-builder converte build/icon.png em .icns/.ico automaticamente.
 */
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const HOME = '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>';
const glyph = (stroke, w) => `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${HOME}</g>`;

const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b8dff"/><stop offset="1" stop-color="#8d5bff"/></linearGradient>
<radialGradient id="s" cx=".3" cy=".2" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect x="64" y="64" width="896" height="896" rx="210" fill="url(#g)"/><rect x="64" y="64" width="896" height="896" rx="210" fill="url(#s)"/>
<g transform="translate(176 176) scale(28.4)">${glyph("#fff", 1.5)}</g>
</svg>`;

const trayMono = (px) => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">${glyph("#000", 2)}</svg>`;
const trayColor = (px) => `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">${glyph("#8fb0ff", 2)}</svg>`;

const dmgBg = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="400" viewBox="0 0 660 400">
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1330"/><stop offset="1" stop-color="#060a1a"/></linearGradient>
<radialGradient id="o" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#4a6cff" stop-opacity=".35"/><stop offset="1" stop-color="#4a6cff" stop-opacity="0"/></radialGradient></defs>
<rect width="660" height="400" fill="url(#b)"/><rect width="660" height="400" fill="url(#o)"/>
<text x="330" y="62" text-anchor="middle" font-family="-apple-system,Helvetica" font-size="22" font-weight="600" fill="#eaf0ff">Arraste o Nexus para Aplicativos</text>
<path d="M265 200h130m-18-14 18 14-18 14" fill="none" stroke="#6ea2ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/></svg>`;

let shared;
async function render(svg, w, h, out) {
  const win = shared ?? (shared = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } }));
  const page = `<html><body style="margin:0;background:transparent;overflow:hidden"><div style="width:${w}px;height:${h}px">${svg.replace("<svg ", `<svg width="${w}" height="${h}" `)}</div></body></html>`;
  const tmp = path.join(require("node:os").tmpdir(), `nexus-icon-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmp, page);
  await win.loadFile(tmp);
  fs.rmSync(tmp, { force: true });
  await new Promise((r) => setTimeout(r, 200));
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, (img.getSize().width === w ? img : img.resize({ width: w, height: h, quality: "best" })).toPNG());
  console.log("•", path.relative(root, out));
}

app.whenReady().then(async () => {
  app.dock?.hide();
  await render(appIcon, 1024, 1024, path.join(root, "build/icon.png"));
  await render(appIcon, 512, 512, path.join(root, "assets/icon.png"));
  await render(trayMono(22), 22, 22, path.join(root, "assets/trayTemplate.png"));
  await render(trayMono(44), 44, 44, path.join(root, "assets/trayTemplate@2x.png"));
  await render(trayColor(32), 32, 32, path.join(root, "assets/tray.png"));
  await render(dmgBg, 660, 400, path.join(root, "build/dmg-background.png"));
  app.quit();
});
