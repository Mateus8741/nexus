import { applyOptimistic, isOn } from "../../shared/devices";
import type { ActionOutcome, ActionRequest, AgentStatus, DeviceView, NexusBridge, Snapshot, SpaceView } from "../../shared/types";
import { acState, acModeKey, acRequests, type AcPatch, bindDevices, isLamp, lightRequests, type LightPatch, lightVisual, sceneRequests, tileKind, type Binding } from "./model";
import { createWorld, type World } from "./home/world";
import { DEMO_PLAN } from "./home/demo-plan";
import { normalize } from "./home/plan";
import { icon } from "./icons";
import { createPanel } from "./panel";
import { openMenu } from "./ui";

declare global {
  interface Window {
    nexus: NexusBridge;
  }
}

const api = window.nexus;
const app = document.getElementById("app") as HTMLElement;
const plan = normalize(DEMO_PLAN);

/* ------------------------------------------------------------------ estado */

let snapshot: Snapshot | undefined;
let agentStatus: AgentStatus = { state: "disabled" };
let pinned = false;
let activeScene: string | undefined = readScene();
let binding: Binding = { light: new Map(), ac: new Map(), room: new Map() };
let bindingKey = "";
const overrides = new Map<string, { device: DeviceView; until: number }>();

function readScene(): string | undefined {
  try {
    return localStorage.getItem("scene") ?? undefined;
  } catch {
    return undefined;
  }
}

function writeScene(scene: string | undefined): void {
  activeScene = scene;
  try {
    if (scene) localStorage.setItem("scene", scene);
    else localStorage.removeItem("scene");
  } catch {
    /* storage indisponível: só perde a persistência */
  }
}

function effectiveDevices(): DeviceView[] {
  const now = Date.now();
  return (snapshot?.devices ?? []).map((device) => {
    const override = overrides.get(device.id);
    if (!override) return device;
    if (override.until < now) {
      overrides.delete(device.id);
      return device;
    }
    return override.device;
  });
}

const spaces = (): SpaceView[] => (snapshot?.spaces ?? []) as SpaceView[];
const deviceById = (id: string): DeviceView | undefined => effectiveDevices().find((d) => d.id === id);

function refreshBinding(): Binding {
  const devices = snapshot?.devices ?? [];
  const key = JSON.stringify([devices.map((d) => [d.id, d.name, d.spaceId, d.kind]), spaces().map((s) => [s.id, s.name])]);
  if (key !== bindingKey) {
    bindingKey = key;
    binding = bindDevices(devices, spaces(), plan);
  }
  return binding;
}

/* ------------------------------------------------------------------ ações */

function applyLocal(request: ActionRequest): void {
  const base = deviceById(request.deviceId);
  if (!base) return;
  overrides.set(base.id, { device: applyOptimistic(base, request.type, request.payload), until: Date.now() + 4000 });
}

const POWER = new Set(["turn_on", "turn_off", "toggle"]);
const pending = new Map<string, ActionRequest>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let lastFlush = 0;
let toggleSeq = 0;

/**
 * Um comando por dispositivo e tipo por vez: o que muda enquanto o anterior está em voo vira um único
 * envio seguinte. Arrastar um slider custa poucas requisições em vez de dezenas.
 */
function enqueue(requests: ActionRequest[]): void {
  for (const r of requests) {
    const key = r.type === "toggle" ? `${r.deviceId}|toggle|${toggleSeq++}` : `${r.deviceId}|${POWER.has(r.type) ? "power" : r.type}`;
    pending.set(key, r);
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flush(), Math.max(0, 260 - (Date.now() - lastFlush)));
}

async function flush(): Promise<void> {
  flushTimer = undefined;
  lastFlush = Date.now();
  const batch = [...pending.values()];
  pending.clear();
  // Ligar antes de regular: o Core executa cada lote em paralelo.
  const waves = [batch.filter((r) => POWER.has(r.type)), batch.filter((r) => !POWER.has(r.type))];
  for (const wave of waves) {
    if (wave.length === 0) continue;
    const outcomes = await api.runActions(wave);
    const failed = outcomes.filter((o) => !o.success);
    if (failed.length > 0) {
      for (const f of failed) overrides.delete(f.deviceId);
      panel.toast(`${deviceById(failed[0]?.deviceId ?? "")?.name ?? "Device"}: ${failed[0]?.error ?? "the change was refused"}`, true);
      render();
    }
  }
}

function commit(requests: ActionRequest[], message?: string): void {
  if (requests.length === 0) return;
  for (const r of requests) applyLocal(r);
  enqueue(requests);
  render();
  if (message) panel.toast(message);
}

async function run(request: ActionRequest): Promise<ActionOutcome> {
  const [outcome] = await api.runActions([request]);
  const result = outcome ?? { deviceId: request.deviceId, success: false, error: "No response." };
  if (!result.success) panel.toast(result.error ?? "The action failed.", true);
  return result;
}

function setLight(id: string, patch: LightPatch): void {
  const d = deviceById(id);
  if (!d) return;
  if (d.status === "offline") return panel.toast(`${d.name} is offline`, true);
  writeScene(undefined);
  commit(lightRequests(d, patch));
}

function setAC(id: string, patch: AcPatch): void {
  const d = deviceById(id);
  if (!d) return;
  if (d.status === "offline") return panel.toast(`${d.name} is offline`, true);
  commit(acRequests(d, patch));
}

function lampsIn(spaceId: string): DeviceView[] {
  return effectiveDevices().filter((d) => tileKind(d) === "light" && isLamp(d) && (spaceId === "all" || (spaceId === "__none" ? !d.spaceId : d.spaceId === spaceId)));
}

function bulk(on: boolean, spaceId: string): void {
  const requests = lampsIn(spaceId)
    .filter((d) => d.status !== "offline")
    .flatMap((d) => lightRequests(d, { on }));
  writeScene(undefined);
  if (requests.length === 0) {
    render();
    return panel.toast(on ? "Everything is already on" : "Everything is already off");
  }
  commit(requests);
}

function toggleEverything(): void {
  const devices = effectiveDevices();
  const anyOn = devices.some((d) => (tileKind(d) === "light" && isLamp(d) && isOn(d)) || (tileKind(d) === "ac" && isOn(d)));
  writeScene(undefined);
  const requests = devices
    .filter((d) => d.status !== "offline")
    .flatMap((d) => {
      const kind = tileKind(d);
      if (kind === "light" && isLamp(d)) return lightRequests(d, { on: !anyOn });
      // Ligar "tudo" acende as luzes; os ACs só são desligados (como no house-control).
      if (kind === "ac" && anyOn) return acRequests(d, { on: false });
      return [];
    });
  commit(requests, requests.length ? undefined : "Nothing to change");
}

function runScene(id: string): void {
  const requests = sceneRequests(id, effectiveDevices(), refreshBinding(), plan);
  const name = plan.scenes.find((s) => s.id === id)?.name ?? id;
  writeScene(id);
  if (requests.length === 0) {
    render();
    return panel.toast(`${name} is already set`);
  }
  commit(requests, `${name} · ${requests.length} ${requests.length === 1 ? "action" : "actions"}`);
}

/* ------------------------------------------------------------------ painel */

function emptyState() {
  if (snapshot?.mode === "unconfigured") return { title: "Connect to your Core", text: "Enter the Core URL and an API key to see your devices.", action: "Open settings", onAction: () => api.openSettings() };
  if (snapshot?.connection === "error" && (snapshot.devices.length ?? 0) === 0) return { title: "Can't reach the Core", text: snapshot.error ?? "Check the URL and the network.", action: "Try again", onAction: () => void api.refresh() };
  if (snapshot && snapshot.devices.filter((d) => tileKind(d)).length === 0) return { title: "No devices", text: "Add integrations in the Dashboard to see them here." };
  return undefined;
}

let world: World | undefined;

const panel = createPanel(app, {
  plan,
  devices: effectiveDevices,
  spaces,
  binding: refreshBinding,
  scene: () => activeScene,
  empty: emptyState,
  title: () => snapshot?.environmentName || plan.name,
  setLight,
  toggleLight(id) {
    const d = deviceById(id);
    if (!d) return;
    const planId = refreshBinding().light.get(id);
    if (planId) world?.bump(planId);
    setLight(id, { on: !isOn(d) });
  },
  setAC,
  bulk,
  toggleEverything,
  runScene,
  run,
  openMenu: (anchor) => openMenu(panel.anchorMenu, anchor, menuItems()),
  focus: (target) => world?.focus(target),
});

function menuItems() {
  const s = snapshot;
  const connection = s?.mode === "demo" ? "Demo mode" : s?.mode === "unconfigured" ? "Not configured" : s?.connection === "ok" ? "Connected to Core" : s?.connection === "error" ? "No connection" : "Connecting…";
  const agent: Record<AgentStatus["state"], string> = {
    disabled: "Agent off",
    starting: "Agent starting…",
    pending: "Agent awaiting approval",
    online: "This PC · online",
    offline: "Agent offline",
    rejected: "Agent rejected",
  };
  return [
    { label: connection, info: true },
    { label: agent[agentStatus.state], info: true },
    "-" as const,
    { label: pinned ? "Unpin (back to tray)" : "Pin to desktop", icon: pinned ? icon("check", 16, 2.4) : null, action: () => void api.setPinned(!pinned) },
    { label: "Refresh", action: () => void api.refresh() },
    { label: "Settings…", action: () => api.openSettings() },
    "-" as const,
    { label: "Quit Nexus", action: () => api.quit() },
  ];
}

/* ------------------------------------------------------------------ 3D */

const lastVisual = new Map<string, string>();

function syncWorld(): void {
  if (!world) return;
  const devices = effectiveDevices();
  const b = refreshBinding();
  const byDevice = new Map(devices.map((d) => [d.id, d]));
  const deviceFor = (map: Map<string, string>, planId: string): DeviceView | undefined => {
    for (const [deviceId, pid] of map) if (pid === planId) return byDevice.get(deviceId);
    return undefined;
  };
  // Vinculadas refletem o dispositivo; as demais (decorativas) ficam apagadas — nunca simulamos estado.
  for (const l of plan.lights) {
    const d = deviceFor(b.light, l.id);
    const visual = d ? lightVisual(d) : { level: 0, temp: 3000, color: null };
    const key = JSON.stringify(visual);
    if (lastVisual.get(l.id) === key) continue;
    lastVisual.set(l.id, key);
    world.setLight(l.id, visual);
  }
  for (const a of plan.acs) {
    const d = deviceFor(b.ac, a.id);
    const s = d ? acState(d) : undefined;
    const visual = { on: s?.on ?? false, mode: acModeKey(s?.mode), fan: s?.fan ?? "auto", swing: s?.swing ?? "swing", sleep: s?.sleep ?? false };
    const key = JSON.stringify(visual);
    if (lastVisual.get(a.id) === key) continue;
    lastVisual.set(a.id, key);
    world.setAC(a.id, visual);
  }
}

try {
  world = createWorld(panel.canvas, plan, {
    onHover: (hit) => panel.showTooltip(hit),
    onPick: (target) => {
      if (target) panel.pick(target);
    },
  });
  world.setInsets(62, 50);
  panel.attach();
} catch (error) {
  // Sem WebGL o painel continua útil: só o modelo 3D some.
  console.error(error);
  panel.card.classList.remove("booting");
  panel.card.classList.add("no-3d");
}

/* ------------------------------------------------------------------ render */

function render(): void {
  panel.update();
  syncWorld();
}

/* ------------------------------------------------------------------ eventos */

function setPinnedUi(value: boolean): void {
  pinned = value;
  app.classList.toggle("is-pinned", value);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panel.closeSheet() && !pinned) api.hideWidget();
});

const show = (): void => {
  world?.setRunning(true);
  world?.intro();
  void api.refresh();
};
const hide = (): void => world?.setRunning(false);
document.addEventListener("visibilitychange", () => (document.hidden ? hide() : show()));

// Re-render periódico só para expirar overrides otimistas.
setInterval(() => {
  if (overrides.size > 0) render();
}, 1000);

api.onSnapshot((next) => {
  const unchanged =
    snapshot !== undefined &&
    JSON.stringify([snapshot.mode, snapshot.connection, snapshot.error, snapshot.devices, snapshot.spaces, snapshot.environmentName]) ===
      JSON.stringify([next.mode, next.connection, next.error, next.devices, next.spaces, next.environmentName]);
  snapshot = next;
  if (!unchanged) render();
});
api.onAgentStatus((s) => {
  agentStatus = s;
});
api.onPinned(setPinnedUi);

window.addEventListener("beforeunload", () => world?.dispose());

void (async () => {
  const [s, a, config] = await Promise.all([api.getSnapshot(), api.getAgentStatus(), api.getConfig()]);
  snapshot = s;
  agentStatus = a;
  setPinnedUi(config.pinned);
  render();
  if (!document.hidden) {
    world?.setRunning(true);
    world?.intro();
  }
})();
