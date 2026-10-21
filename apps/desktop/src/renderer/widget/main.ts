import {
  applyOptimistic,
  canPower,
  categorize,
  currentTemperature,
  isOn,
  planScene,
  powerRequest,
  SCENES,
  type SceneId,
  targetTemperature,
} from "../../shared/devices";
import type { ActionOutcome, ActionRequest, AgentStatus, DeviceView, NexusBridge, Snapshot } from "../../shared/types";
import { icon } from "../shared/icons";
import { buildPanel, type Panel } from "./controls";
import { buildRoom, type RoomId, updateRoom } from "./room";

declare global {
  interface Window {
    nexus: NexusBridge;
  }
}

const api = window.nexus;
const app = document.getElementById("app") as HTMLElement;

/* ------------------------------------------------------------------ state */

let snapshot: Snapshot | undefined;
let agentStatus: AgentStatus = { state: "disabled" };
let tab = "all";
let pinned = false;
let activeScene: SceneId | undefined = readScene();
const overrides = new Map<string, { device: DeviceView; until: number }>();
const tempTimers = new Map<string, ReturnType<typeof setTimeout>>();
const cards = new Map<string, HTMLElement>();
const panels = new Map<string, Panel>();
const openCards = new Set<string>();
let visibleIds = new Set<string>();

function readScene(): SceneId | undefined {
  try {
    return (localStorage.getItem("scene") as SceneId | null) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeScene(scene: SceneId | undefined): void {
  activeScene = scene;
  try {
    if (scene) localStorage.setItem("scene", scene);
    else localStorage.removeItem("scene");
  } catch {
    /* storage indisponível: só perde a persistência */
  }
}

/* ---------------------------------------------------------------- helpers */

function html<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, inner = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  node.innerHTML = inner;
  return node;
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

function spaceName(device: DeviceView): string {
  return snapshot?.spaces.find((s) => s.id === device.spaceId)?.name ?? "Geral";
}

const controllable = (d: DeviceView): boolean => {
  const c = categorize(d);
  return (c === "light" || c === "switch" || c === "climate") && canPower(d);
};

function tabDevices(devices: DeviceView[]): DeviceView[] {
  if (tab === "all") return devices;
  if (tab === "__none") return devices.filter((d) => !d.spaceId);
  return devices.filter((d) => d.spaceId === tab);
}

function roomFor(name: string): RoomId | undefined {
  const n = name.toLowerCase();
  if (/sala|living|estar/.test(n)) return "living";
  if (/cozinha|kitchen/.test(n)) return "kitchen";
  if (/quarto|bed|suíte|suite/.test(n)) return "bedroom";
  if (/jantar|dining|varanda/.test(n)) return "dining";
  return undefined;
}

const fmtTemp = (n: number): string => n.toFixed(1).replace(".", ",");

/* ------------------------------------------------------------------ shell */

app.innerHTML = `
  <header class="head">
    <div class="brand"><span class="brand-tile">${icon("home", 20)}</span>
      <div class="brand-meta"><div class="title" id="title">Nexus</div><div class="status" id="status"><i class="dot"></i><span>—</span></div></div>
    </div>
    <div class="head-actions">
      <button class="round" id="pin" title="Fixar na área de trabalho" aria-label="Fixar na área de trabalho">${icon("pin", 17)}</button>
      <button class="round" id="settings" title="Configurações" aria-label="Configurações">${icon("sliders", 17)}</button>
      <button class="round big" id="alloff" title="Desligar tudo" aria-label="Desligar tudo">${icon("power", 20)}</button>
    </div>
  </header>
  <section class="hero" id="hero"><div class="hero-inner" id="hero-inner">${buildRoom()}</div></section>
  <nav class="scenes" id="scenes"></nav>
  <nav class="tabs" id="tabs"></nav>
  <div class="summary"><div class="sum-text" id="sum"></div>
    <div class="sum-btns"><button class="pill" id="allon">Ligar</button><button class="pill" id="alloff2">Desligar</button></div></div>
  <main class="list" id="list"></main>
  <footer class="foot"><span id="conn" class="conn"></span><span id="agent" class="agent"></span></footer>
  <div class="toast" id="toast" role="status"></div>
`;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const roomEl = $("hero-inner").querySelector("svg") as SVGElement;

for (const scene of SCENES) {
  const btn = html("button", "scene", `<span class="scene-ico">${icon(scene.icon, 20)}</span><span>${scene.label}</span>`);
  btn.dataset.scene = scene.id;
  btn.addEventListener("click", () => runScene(scene.id, btn));
  $("scenes").append(btn);
}

/* -------------------------------------------------------------- rendering */

function render(): void {
  const devices = effectiveDevices();
  renderHeader(devices);
  renderRoom(devices);
  renderTabs(devices);
  renderSummary(devices);
  renderList(devices);
  renderFooter();
  for (const btn of $("scenes").children) btn.classList.toggle("active", (btn as HTMLElement).dataset.scene === activeScene);
}

function renderHeader(devices: DeviceView[]): void {
  $("title").textContent = snapshot?.environmentName ?? "Nexus";
  const lightsOn = devices.filter((d) => categorize(d) === "light" && isOn(d)).length;
  const status = $("status");
  status.classList.toggle("lit", lightsOn > 0);
  const label = lightsOn === 0 ? "<b>Nenhuma</b> luz acesa" : `<b>${lightsOn}</b> ${lightsOn === 1 ? "luz acesa" : "luzes acesas"}`;
  const span = status.querySelector("span") as HTMLElement;
  if (span.innerHTML !== label) span.innerHTML = label;
}

function renderRoom(devices: DeviceView[]): void {
  const lit: Record<RoomId, number> = { living: 0, kitchen: 0, bedroom: 0, dining: 0 };
  const counts: Record<RoomId, { on: number; total: number }> = {
    living: { on: 0, total: 0 },
    kitchen: { on: 0, total: 0 },
    bedroom: { on: 0, total: 0 },
    dining: { on: 0, total: 0 },
  };
  let globalOn = 0;
  let globalTotal = 0;
  for (const d of devices) {
    const c = categorize(d);
    if (c !== "light" && c !== "switch") continue;
    globalTotal++;
    if (isOn(d)) globalOn++;
    const room = roomFor(spaceName(d));
    if (room) {
      counts[room].total++;
      if (isOn(d)) counts[room].on++;
    }
  }
  const anyMapped = Object.values(counts).some((c) => c.total > 0);
  for (const room of Object.keys(lit) as RoomId[]) {
    lit[room] = anyMapped
      ? counts[room].total
        ? counts[room].on / counts[room].total
        : 0
      : globalTotal
        ? globalOn / globalTotal
        : 0;
  }
  updateRoom(roomEl, lit, devices.some((d) => categorize(d) === "climate" && isOn(d)));
}

function renderTabs(devices: DeviceView[]): void {
  const host = $("tabs");
  const spaces = (snapshot?.spaces ?? []).filter((s) => devices.some((d) => d.spaceId === s.id));
  const entries: { id: string; label: string }[] = [{ id: "all", label: "Tudo" }, ...spaces.map((s) => ({ id: s.id, label: s.name }))];
  if (devices.some((d) => !d.spaceId) && spaces.length > 0) entries.push({ id: "__none", label: "Geral" });
  if (!entries.some((e) => e.id === tab)) tab = "all";

  const signature = entries.map((e) => e.id).join("|");
  if (host.dataset.sig !== signature) {
    host.dataset.sig = signature;
    host.replaceChildren(
      ...entries.map((e, i) => {
        const chip = html("button", "chip", e.label);
        chip.dataset.tab = e.id;
        chip.style.setProperty("--i", String(i));
        chip.addEventListener("click", () => {
          tab = e.id;
          render();
        });
        return chip;
      }),
    );
  }
  for (const chip of host.children) chip.classList.toggle("active", (chip as HTMLElement).dataset.tab === tab);
}

function renderSummary(devices: DeviceView[]): void {
  const scoped = tabDevices(devices).filter(controllable);
  const on = scoped.filter(isOn).length;
  const name = tab === "all" ? "Casa toda" : (tabLabel() ?? "Ambiente");
  const text = `${name} · <b>${on}</b> de ${scoped.length} ligados`;
  const sum = $("sum");
  if (sum.innerHTML !== text) {
    sum.innerHTML = text;
    sum.classList.remove("tick");
    void sum.offsetWidth;
    sum.classList.add("tick");
  }
}

function tabLabel(): string | undefined {
  return (document.querySelector(`.chip[data-tab="${CSS.escape(tab)}"]`) as HTMLElement | null)?.textContent ?? undefined;
}

function iconFor(device: DeviceView): string {
  switch (categorize(device)) {
    case "climate":
      return "snow";
    case "computer":
      return "monitor";
    case "switch":
      return "plug";
    case "light":
      return /teto|ceiling|pendente|pendant/i.test(device.name) ? "ceiling" : /backlight|fita|strip|tv/i.test(device.name) ? "sparkle" : "bulb";
    default:
      return "sparkle";
  }
}

function createCard(device: DeviceView): HTMLElement {
  const category = categorize(device);
  const card = html("div", `card cat-${category}`);
  card.dataset.id = device.id;
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.innerHTML = `<span class="tile">${icon(iconFor(device), 20)}</span>
    <span class="meta"><span class="name"></span><span class="sub"></span></span>`;

  if (category === "climate") {
    const stepper = html(
      "span",
      "stepper",
      `<button class="step" data-d="-1" aria-label="Diminuir">${icon("minus", 16)}</button><span class="temp"></span><button class="step" data-d="1" aria-label="Aumentar">${icon("plus", 16)}</button>`,
    );
    stepper.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".step");
      if (!btn) return;
      e.stopPropagation();
      adjustTemperature(device.id, Number(btn.dataset.d));
    });
    const power = html("button", "power", icon("power", 18));
    power.setAttribute("aria-label", "Ligar/desligar");
    card.append(stepper, power);
  } else if (category === "computer") {
    card.append(html("span", "power lock", icon("lock", 17)));
  }

  const more = html("button", "more", icon("chevron", 16));
  more.setAttribute("aria-label", "Mais controles");
  more.setAttribute("aria-expanded", "false");
  more.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !openCards.has(device.id);
    if (open) openCards.add(device.id);
    else openCards.delete(device.id);
    card.classList.toggle("open", open);
    more.setAttribute("aria-expanded", String(open));
    if (open && !panels.has(device.id)) {
      const current = effectiveDevices().find((d) => d.id === device.id) ?? device;
      const panel = buildPanel(current, { run: runOne });
      panels.set(device.id, panel);
      card.append(panel.el);
    }
  });
  card.append(more);

  const activate = (): void => {
    const current = effectiveDevices().find((d) => d.id === device.id);
    if (!current) return;
    if (categorize(current) === "computer") void send([{ deviceId: current.id, type: "lock" }], "Bloqueando…");
    else toggle(current);
  };
  card.addEventListener("click", activate);
  card.addEventListener("keydown", (e) => {
    if (e.target !== card) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
  card.addEventListener("pointerdown", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--rx", `${e.clientX - r.left}px`);
    card.style.setProperty("--ry", `${e.clientY - r.top}px`);
  });
  return card;
}

function updateCard(card: HTMLElement, device: DeviceView): void {
  const category = categorize(device);
  const on = isOn(device);
  card.classList.toggle("on", on && category !== "computer");
  card.classList.toggle("offline", device.status === "offline");
  panels.get(device.id)?.update(device);
  const name = card.querySelector(".name") as HTMLElement;
  if (name.textContent !== device.name) name.textContent = device.name;

  let sub: string;
  if (device.status === "offline") sub = `Offline · ${spaceName(device)}`;
  else if (category === "computer") sub = `Online · ${spaceName(device)}`;
  else if (category === "climate") {
    const room = currentTemperature(device);
    sub = `${on ? "Ligado" : "Desligado"}${room !== undefined ? ` · ${fmtTemp(room)}°` : ""}`;
  } else sub = `${on ? "Ligado" : "Desligado"} · ${spaceName(device)}`;
  const subEl = card.querySelector(".sub") as HTMLElement;
  if (subEl.textContent !== sub) subEl.textContent = sub;

  if (category === "climate") {
    const target = targetTemperature(device);
    (card.querySelector(".temp") as HTMLElement).textContent = target !== undefined ? `${Math.round(target)}°` : "—";
    (card.querySelector(".power") as HTMLElement).classList.toggle("on", on);
  }
}

let lastLayout = "";

function renderList(devices: DeviceView[]): void {
  const list = $("list");
  const scoped = tabDevices(devices).filter((d) => categorize(d) !== "sensor");

  if (snapshot?.mode === "unconfigured") return renderEmpty(list, "Conecte ao seu Core", "Informe a URL do Core e uma API key para ver seus dispositivos.", "Abrir configurações");
  if (snapshot?.connection === "error" && devices.length === 0) return renderEmpty(list, "Sem conexão com o Core", snapshot.error ?? "Verifique a URL e a rede.", "Tentar novamente", () => void api.refresh());
  if (scoped.length === 0) return renderEmpty(list, "Nenhum dispositivo", "Adicione integrações no Dashboard para vê-los aqui.");

  list.querySelector(".empty")?.remove();

  const groups = new Map<string, DeviceView[]>();
  const order: string[] = [];
  for (const device of scoped) {
    const key = spaceName(device);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(device);
  }

  const nextVisible = new Set(scoped.map((d) => d.id));
  for (const device of scoped) {
    let card = cards.get(device.id);
    if (!card) {
      card = createCard(device);
      cards.set(device.id, card);
    }
    updateCard(card, device);
  }

  // Só remonta o DOM quando a estrutura muda: trocar os cards de lugar a cada
  // polling cancela cliques em andamento (mousedown/up em elemento reparentado).
  // Os cards só podem ser movidos para as novas seções quando elas vão ser
  // montadas — senão ficam órfãos em grids descartados e a lista "some".
  const layout = order.map((key) => `${key}:${(groups.get(key) ?? []).map((d) => d.id).join(",")}`).join("|");
  if (layout !== lastLayout || list.querySelector(".group") === null) {
    lastLayout = layout;
    let enterIndex = 0;
    const sections: HTMLElement[] = [];
    for (const key of order) {
      const section = html("section", "group");
      section.append(html("h3", "group-title", key));
      const grid = html("div", "grid");
      for (const device of groups.get(key) ?? []) {
        const card = cards.get(device.id) as HTMLElement;
        if (!visibleIds.has(device.id)) {
          card.classList.remove("enter");
          void card.offsetWidth;
          card.style.setProperty("--e", String(enterIndex++));
          card.classList.add("enter");
        }
        grid.append(card);
      }
      section.append(grid);
      sections.push(section);
    }
    list.replaceChildren(...sections);
  }
  visibleIds = nextVisible;
}

function renderEmpty(list: HTMLElement, title: string, text: string, action?: string, onAction?: () => void): void {
  visibleIds = new Set();
  const box = html("div", "empty", `<div class="empty-orb">${icon("sparkle", 26)}</div><h3>${title}</h3><p>${text}</p>`);
  if (action) {
    const btn = html("button", "cta", action);
    btn.addEventListener("click", onAction ?? (() => api.openSettings()));
    box.append(btn);
  }
  list.replaceChildren(box);
}

function renderFooter(): void {
  const conn = $("conn");
  const s = snapshot;
  const text =
    s?.mode === "demo" ? "Modo demonstração" : s?.mode === "unconfigured" ? "Não configurado" : s?.connection === "ok" ? "Conectado ao Core" : s?.connection === "error" ? "Sem conexão" : "Conectando…";
  conn.className = `conn ${s?.mode === "demo" || s?.connection === "ok" ? "ok" : s?.connection === "error" ? "bad" : ""}`;
  conn.innerHTML = `<i class="dot"></i>${text}`;

  const labels: Record<AgentStatus["state"], string> = {
    disabled: "Agent desligado",
    starting: "Agent iniciando…",
    pending: "Agent aguardando aprovação",
    online: "Este PC · online",
    offline: "Agent offline",
    rejected: "Agent rejeitado",
  };
  const agent = $("agent");
  agent.textContent = labels[agentStatus.state];
  agent.title = agentStatus.detail ?? "";
  agent.dataset.state = agentStatus.state;
}

/* ---------------------------------------------------------------- actions */

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string, bad = false): void {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("bad", bad);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), bad ? 6000 : 2200);
}

function applyLocal(request: ActionRequest): void {
  const base = effectiveDevices().find((d) => d.id === request.deviceId);
  if (!base) return;
  overrides.set(base.id, { device: applyOptimistic(base, request.type, request.payload), until: Date.now() + 3500 });
}

async function runOne(request: ActionRequest): Promise<ActionOutcome> {
  const [outcome] = await api.runActions([request]);
  const result = outcome ?? { deviceId: request.deviceId, success: false, error: "Sem resposta." };
  if (!result.success) toast(result.error ?? "Falha ao executar a ação.", true);
  return result;
}

async function send(requests: ActionRequest[], message?: string): Promise<void> {
  if (requests.length === 0) return;
  for (const r of requests) applyLocal(r);
  render();
  if (message) toast(message);
  const outcomes = await api.runActions(requests);
  const failed = outcomes.filter((o) => !o.success);
  if (failed.length > 0) {
    for (const f of failed) overrides.delete(f.deviceId);
    toast(failed[0]?.error ?? "Falha ao executar a ação.", true);
    render();
  }
}

function toggle(device: DeviceView): void {
  if (device.status === "offline") return toast(`${device.name} está offline`, true);
  const request = powerRequest(device, !isOn(device));
  if (!request) return;
  writeScene(undefined);
  void send([request]);
}

function adjustTemperature(id: string, delta: number): void {
  const device = effectiveDevices().find((d) => d.id === id);
  if (!device) return;
  const next = Math.min(30, Math.max(16, Math.round(targetTemperature(device) ?? 24) + delta));
  applyLocal({ deviceId: id, type: "set-target-temperature", payload: { value: next } });
  render();
  clearTimeout(tempTimers.get(id));
  tempTimers.set(
    id,
    setTimeout(() => void api.runActions([{ deviceId: id, type: "set-target-temperature", payload: { value: next } }]), 450),
  );
}

function bulk(on: boolean): void {
  const scoped = tabDevices(effectiveDevices()).filter(controllable);
  const requests = scoped
    .filter((d) => isOn(d) !== on)
    .map((d) => powerRequest(d, on))
    .filter((r): r is ActionRequest => r !== undefined);
  writeScene(undefined);
  if (requests.length === 0) return toast(on ? "Tudo já está ligado" : "Tudo já está desligado");
  void send(requests, on ? "Ligando tudo…" : "Desligando tudo…");
}

function runScene(id: SceneId, button: HTMLElement): void {
  const requests = planScene(id, effectiveDevices());
  const label = SCENES.find((s) => s.id === id)?.label ?? id;
  button.classList.remove("burst");
  void button.offsetWidth;
  button.classList.add("burst");
  writeScene(id);
  if (requests.length === 0) {
    render();
    return toast(`Cena ${label} já aplicada`);
  }
  void send(requests, `Cena ${label} · ${requests.length} ${requests.length === 1 ? "ação" : "ações"}`);
}

/* ------------------------------------------------------------------ wiring */

$("pin").addEventListener("click", () => void api.setPinned(!pinned));
$("settings").addEventListener("click", () => api.openSettings());
$("alloff").addEventListener("click", () => {
  const everything = effectiveDevices().filter(controllable).filter(isOn);
  const requests = everything.map((d) => powerRequest(d, false)).filter((r): r is ActionRequest => r !== undefined);
  writeScene(undefined);
  void send(requests, requests.length ? "Desligando tudo…" : "Tudo já está desligado");
});
$("allon").addEventListener("click", () => bulk(true));
$("alloff2").addEventListener("click", () => bulk(false));

function setPinnedUi(value: boolean): void {
  pinned = value;
  $("pin").classList.toggle("active", value);
  $("pin").title = value ? "Soltar (voltar para a bandeja)" : "Fixar na área de trabalho";
  app.classList.toggle("is-pinned", value);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pinned) api.hideWidget();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  app.classList.remove("enter");
  void app.offsetWidth;
  app.classList.add("enter");
  void api.refresh();
});

// Parallax leve da cena conforme o ponteiro.
const hero = $("hero");
hero.addEventListener("pointermove", (e) => {
  const r = hero.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  hero.style.setProperty("--tx", `${(x * 10).toFixed(2)}px`);
  hero.style.setProperty("--ty", `${(y * 6).toFixed(2)}px`);
  hero.style.setProperty("--rot", `${(x * 2).toFixed(2)}deg`);
});
hero.addEventListener("pointerleave", () => {
  hero.style.setProperty("--tx", "0px");
  hero.style.setProperty("--ty", "0px");
  hero.style.setProperty("--rot", "0deg");
});

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
  renderFooter();
});
api.onPinned(setPinnedUi);

void (async () => {
  const [s, a, config] = await Promise.all([api.getSnapshot(), api.getAgentStatus(), api.getConfig()]);
  snapshot = s;
  agentStatus = a;
  setPinnedUi(config.pinned);
  app.classList.add("enter");
  render();
})();
