// Painel de controle (port de house-control ui/panel.js): cabeçalho, cenas, cômodos, tiles de
// dispositivos e as folhas de detalhe de uma luz ou de um AC. Os dados vêm do Nexus (DeviceView);
// cada controle só aparece se o dispositivo declara a capability correspondente.
import * as THREE from "three";

import { categorize, isOn } from "../../shared/devices";
import type { ActionOutcome, ActionRequest, DeviceView, SpaceView } from "../../shared/types";
import { buildPanel, type Panel as GenericControls } from "./controls";
import { MODE_COLORS } from "./home/ac";
import type { FocusTarget, HoverHit, PickTarget } from "./home/world";
import type { Plan } from "./home/plan";
import { icon } from "./icons";
import {
  acCaps,
  acColor,
  acModeKey,
  acState,
  type AcOption,
  type AcPatch,
  type Binding,
  fixtureHint,
  hasSheet,
  isLamp,
  lampCaps,
  lightCss,
  type LightPatch,
  lightState,
  tileKind,
} from "./model";
import { clamp, createColorPad, createSlider, h, openMenu } from "./ui";

const SWATCHES = ["#ff5a4f", "#ff9a3c", "#ffd84a", "#5fe08a", "#42d6e8", "#4f8dff", "#8b5cff", "#ff5fc4"];
const TEMP_GRADIENT = "linear-gradient(90deg, #2f7df6 0%, #58b4f5 34%, #f3e2c0 62%, #f6a54a 82%, #f0762c 100%)";
const DIM_GRADIENT = "linear-gradient(90deg, #4a4f5e 0%, #b9a98c 45%, #ffe2b0 100%)";
const KELVIN_GRADIENT = "linear-gradient(90deg, #ff9438 0%, #ffbd7a 30%, #ffe2c2 62%, #dfe9ff 100%)";
const NAVY = new THREE.Color("#17274f");

const tmp = new THREE.Color();
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const label = (v: string): string => cap(v.replace(/[_-]+/g, " "));

export interface PanelHost {
  plan: Plan;
  devices(): DeviceView[];
  spaces(): SpaceView[];
  binding(): Binding;
  scene(): string | undefined;
  /** Texto de estado vazio (não configurado / sem conexão); undefined = lista normal. */
  empty(): { title: string; text: string; action?: string; onAction?: () => void } | undefined;
  title(): string;
  setLight(id: string, patch: LightPatch): void;
  toggleLight(id: string): void;
  setAC(id: string, patch: AcPatch): void;
  bulk(on: boolean, spaceId: string): void;
  toggleEverything(): void;
  runScene(id: string): void;
  run(request: ActionRequest): Promise<ActionOutcome>;
  openMenu(anchor: HTMLElement): void;
  focus(target: FocusTarget): void;
}

interface Tile {
  el: HTMLElement;
  kind: "light" | "ac" | "other";
  id: string;
  update(d: DeviceView): void;
}

type Sheet = { kind: "light" | "ac" | "other"; id: string };
interface SheetView {
  nodes: Node[];
  update(d: DeviceView): void;
}

export function createPanel(root: HTMLElement, host: PanelHost) {
  const ui: { room: string; sheet: Sheet | null } = { room: "all", sheet: null };
  let sheetView: SheetView | null = null;
  const tiles = new Map<string, Tile>();
  let lastLayout = "";

  const spaceName = (d: DeviceView): string => host.spaces().find((s) => s.id === d.spaceId)?.name ?? "General";
  const byId = (id: string): DeviceView | undefined => host.devices().find((d) => d.id === id);
  const tileDevices = (): DeviceView[] => host.devices().filter((d) => tileKind(d) !== undefined);
  const inScope = (d: DeviceView): boolean => ui.room === "all" || (ui.room === "__none" ? !d.spaceId : d.spaceId === ui.room);

  /* ---------- esqueleto ---------- */

  const canvas = h<"canvas">("canvas", { tabindex: -1 });
  const tooltip = h("div.tooltip");
  const homeName = h("div.home-name", host.title());
  const homeSub = h("div.home-sub");
  const power = h("button.round.power", { title: "Everything on / off", "aria-label": "Toggle everything", onclick: () => host.toggleEverything() }, icon("power", 21, 2.2));
  const gear = h("button.round", { title: "Menu", "aria-label": "Menu", onclick: () => host.openMenu(gear) }, icon("settings", 17));

  const scenes = h("div.scenes");
  const rooms = h("div.rooms");
  const listTitle = h("span.title");
  const grid = h("div.grid");
  const panel = h(
    "section.panel",
    scenes,
    rooms,
    h("div.list-head", listTitle, h("button.pill", { onclick: () => host.bulk(true, ui.room) }, "All on"), h("button.pill", { onclick: () => host.bulk(false, ui.room) }, "All off")),
    h("div.devices", grid),
  );
  const sheet = h("section.sheet.hidden");
  sheet.inert = true;
  const toastEl = h("div.panel-toast");

  const clip = h(
    "div.card-clip",
    h("div.stage", canvas),
    h("div.tint"),
    h("header.top", h("div.home", h("div.home-badge", icon("home", 17)), h("div", homeName, homeSub)), gear, power),
    tooltip,
    panel,
    sheet,
    toastEl,
  );
  const card = h("div.card.booting", clip);
  root.replaceChildren(card);

  /* ---------- cenas ---------- */

  const sceneButtons = new Map<string, HTMLElement>();
  for (const s of host.plan.scenes) {
    const b = h("button.scene", { onclick: () => host.runScene(s.id) }, icon(s.icon, 19), s.name);
    sceneButtons.set(s.id, b);
    scenes.append(b);
  }
  if (!host.plan.scenes.length) scenes.style.display = "none";

  /* ---------- cômodos ---------- */

  const roomButtons = new Map<string, { b: HTMLElement; count: HTMLElement }>();
  let roomSig = "";

  function renderRooms(): void {
    const spaces = host.spaces().filter((s) => tileDevices().some((d) => d.spaceId === s.id));
    const entries = [{ id: "all", name: "All" }, ...spaces.map((s) => ({ id: s.id, name: s.name }))];
    if (spaces.length > 0 && tileDevices().some((d) => !d.spaceId)) entries.push({ id: "__none", name: "General" });
    if (!entries.some((e) => e.id === ui.room)) ui.room = "all";
    const sig = entries.map((e) => `${e.id}:${e.name}`).join("|");
    if (sig !== roomSig) {
      roomSig = sig;
      roomButtons.clear();
      rooms.replaceChildren(
        ...entries.map((r) => {
          const count = h("span.count.zero", "0");
          const b = h("button.room", { onclick: () => selectRoom(r.id) }, r.name, count);
          roomButtons.set(r.id, { b, count });
          return b;
        }),
      );
    }
  }

  function focusTarget(id: string): FocusTarget {
    const planRoom = host.binding().room.get(id);
    return id === "all" || !planRoom ? null : { kind: "room", id: planRoom };
  }

  function selectRoom(id: string): void {
    if (ui.room === id) id = "all";
    ui.room = id;
    layoutTiles(true);
    update();
    roomButtons.get(id)?.b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    host.focus(focusTarget(id));
  }

  /* ---------- tiles ---------- */

  function iconFor(d: DeviceView): string {
    if (tileKind(d) === "other") return categorize(d) === "computer" ? "laptop" : "sparkles";
    if (!isLamp(d)) return "plug";
    const hint = fixtureHint(d.name);
    return hint ?? "bulb";
  }

  function lightTile(d0: DeviceView): Tile {
    const id = d0.id;
    const sub = h("div.tile-sub");
    const more = h(
      "button.tile-more",
      {
        "aria-label": `${d0.name} settings`,
        onclick: (e: Event) => {
          e.stopPropagation();
          openSheet({ kind: "light", id });
        },
      },
      icon("sliders", 15),
    );
    const bubble = h("div.bubble", icon(iconFor(d0), 19));
    const name = h("div.tile-name", d0.name);
    const el = h("div.tile", { role: "button", tabindex: 0, "aria-label": d0.name }, bubble, h("div.tile-text", name, sub), more, h("div.tile-level"));

    // Toque alterna; arrastar na horizontal regula o brilho (estilo HomeKit).
    let gesture: { x: number; y: number; start: number; moved: boolean } | null = null;
    el.addEventListener("pointerdown", (ev) => {
      const d = byId(id);
      if (!d || (ev.target as HTMLElement).closest(".tile-more") || ev.button !== 0) return;
      el.setPointerCapture(ev.pointerId);
      const s = lightState(d);
      gesture = { x: ev.clientX, y: ev.clientY, start: s.on ? s.brightness : 0, moved: false };
      el.classList.add("pressed");
    });
    el.addEventListener("pointermove", (ev) => {
      const d = byId(id);
      if (!gesture || !d) return;
      const dx = ev.clientX - gesture.x;
      if (!gesture.moved && lampCaps(d).brightness && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(ev.clientY - gesture.y)) {
        gesture.moved = true;
        el.classList.add("dragging");
      }
      if (gesture.moved) {
        const b = clamp(gesture.start + dx / el.clientWidth, 0, 1);
        host.setLight(id, b < 0.04 ? { on: false } : { on: true, brightness: b });
      }
    });
    const finish = (ev: PointerEvent): void => {
      if (!gesture) return;
      const tapped = !gesture.moved && ev.type === "pointerup";
      gesture = null;
      el.classList.remove("pressed", "dragging");
      if (tapped) host.toggleLight(id);
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    el.addEventListener("keydown", (ev) => {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        host.toggleLight(id);
      }
    });

    return {
      el,
      kind: "light",
      id,
      update(d) {
        const s = lightState(d);
        const caps = lampCaps(d);
        const offline = d.status === "offline";
        el.classList.toggle("on", s.on);
        el.classList.toggle("offline", offline);
        el.classList.toggle("dimmable", caps.brightness);
        more.hidden = !hasSheet(caps);
        if (name.textContent !== d.name) name.textContent = d.name;
        el.style.setProperty("--c", lightCss(s));
        el.style.setProperty("--level", s.on ? String(s.brightness) : "0");
        const status = offline ? "Offline" : s.on ? (caps.brightness ? `${Math.round(s.brightness * 100)}%` : "On") : "Off";
        sub.textContent = ui.room === "all" ? `${status} · ${spaceName(d)}` : status;
      },
    };
  }

  function acTile(d0: DeviceView): Tile {
    const id = d0.id;
    const sub = h("div.tile-sub");
    const value = h("div.value");
    const bubble = h("div.bubble");
    const step = (delta: number) => (e: Event) => {
      e.stopPropagation();
      const d = byId(id);
      if (d) host.setAC(id, { on: true, target: acState(d).target + delta });
    };
    const stepper = h(
      "div.stepper",
      h("button", { "aria-label": "Cooler", onclick: step(-1) }, icon("minus", 15, 2.2)),
      value,
      h("button", { "aria-label": "Warmer", onclick: step(1) }, icon("plus", 15, 2.2)),
    );
    const name = h("div.tile-name", d0.name);
    const miniPower = h(
      "button.mini-power",
      {
        "aria-label": `${d0.name} power`,
        onclick: (e: Event) => {
          e.stopPropagation();
          const d = byId(id);
          if (d) host.setAC(id, { on: !isOn(d) });
        },
      },
      icon("power", 16, 2.2),
    );
    const el = h("div.tile.ac", { role: "button", tabindex: 0, "aria-label": d0.name, onclick: () => openSheet({ kind: "ac", id }) }, bubble, h("div.tile-text", name, sub), stepper, miniPower);
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") openSheet({ kind: "ac", id });
    });
    let shownMode = "";
    return {
      el,
      kind: "ac",
      id,
      update(d) {
        const s = acState(d);
        const caps = acCaps(d);
        const modeKey = acModeKey(s.mode);
        el.classList.toggle("on", s.on);
        el.classList.toggle("offline", d.status === "offline");
        el.style.setProperty("--c", acColor(s));
        stepper.hidden = !caps.target;
        miniPower.hidden = !caps.power;
        if (name.textContent !== d.name) name.textContent = d.name;
        if (shownMode !== modeKey) {
          bubble.replaceChildren(icon(modeKey, 19));
          shownMode = modeKey;
        }
        value.textContent = `${Math.round(s.target)}°`;
        const state = d.status === "offline" ? "Offline" : s.on ? (s.mode ? label(s.mode) : "On") : "Off";
        sub.textContent = s.roomTemp !== undefined ? `${state} · Room ${s.roomTemp.toFixed(1)}°` : state;
      },
    };
  }

  function otherTile(d0: DeviceView): Tile {
    const id = d0.id;
    const sub = h("div.tile-sub");
    const name = h("div.tile-name", d0.name);
    const el = h("div.tile.other", { role: "button", tabindex: 0, "aria-label": d0.name, onclick: () => openSheet({ kind: "other", id }) }, h("div.bubble", icon(iconFor(d0), 19)), h("div.tile-text", name, sub));
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openSheet({ kind: "other", id });
      }
    });
    return {
      el,
      kind: "other",
      id,
      update(d) {
        el.classList.toggle("offline", d.status === "offline");
        if (name.textContent !== d.name) name.textContent = d.name;
        sub.textContent = `${d.status === "offline" ? "Offline" : d.status === "online" ? "Online" : "Unknown"} · ${spaceName(d)}`;
      },
    };
  }

  function ensureTile(d: DeviceView): Tile | undefined {
    const kind = tileKind(d);
    if (!kind) return undefined;
    let t = tiles.get(d.id);
    if (t && t.kind !== kind) {
      t.el.remove();
      tiles.delete(d.id);
      t = undefined;
    }
    if (!t) {
      t = kind === "ac" ? acTile(d) : kind === "light" ? lightTile(d) : otherTile(d);
      tiles.set(d.id, t);
    }
    return t;
  }

  function layoutTiles(reset = false): void {
    const empty = host.empty();
    const devices = tileDevices();
    const scoped = devices.filter(inScope);
    const groups = new Map<string, DeviceView[]>();
    const order: { key: string; name: string }[] = [];
    for (const d of scoped) {
      const key = d.spaceId ?? "__none";
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push({ key, name: spaceName(d) });
      }
      groups.get(key)?.push(d);
    }
    const spaceOrder = host.spaces().map((s) => s.id);
    order.sort((a, b) => (spaceOrder.indexOf(a.key) + 1 || 999) - (spaceOrder.indexOf(b.key) + 1 || 999));

    const signature = `${ui.room}|${empty?.title ?? ""}|` + order.map((g) => `${g.key}:${g.name}:${(groups.get(g.key) ?? []).map((d) => `${d.id}${tileKind(d)}`).join(",")}`).join("|");
    if (signature === lastLayout && !reset) return;
    lastLayout = signature;

    if (empty) {
      const box = h("div.empty", h("div.empty-orb", icon("sparkles", 24)), h("h3", empty.title), h("p", empty.text));
      if (empty.action) box.append(h("button.cta", { onclick: empty.onAction }, empty.action));
      grid.replaceChildren(box);
      return;
    }
    if (scoped.length === 0) {
      grid.replaceChildren(h("div.group-label", "No devices in this room yet"));
      return;
    }

    const nodes: Node[] = [];
    let i = 0;
    const add = (t: Tile): void => {
      t.el.style.setProperty("--i", String(i++));
      nodes.push(t.el);
    };
    for (const g of order) {
      const list = groups.get(g.key) ?? [];
      if (ui.room === "all") nodes.push(h("div.group-label", g.name));
      const ts = list.map(ensureTile).filter((t): t is Tile => t !== undefined);
      ts.filter((t) => t.kind === "ac").forEach(add);
      ts.filter((t) => t.kind === "light").forEach(add);
      ts.filter((t) => t.kind === "other").forEach(add);
    }
    grid.replaceChildren(...nodes);
    grid.parentElement?.scrollTo({ top: 0 });
  }

  /* ---------- folhas ---------- */

  function openSheet(target: Sheet): void {
    const d = byId(target.id);
    if (!d) return;
    ui.sheet = target;
    sheetView = target.kind === "ac" ? acSheet(d) : target.kind === "light" ? lightSheet(d) : otherSheet(d);
    sheet.replaceChildren(...sheetView.nodes);
    panel.classList.add("hidden");
    sheet.classList.remove("hidden");
    panel.inert = true;
    sheet.inert = false;
    card.classList.add("detail");
    hideTooltip();
    const planId = target.kind === "ac" ? host.binding().ac.get(target.id) : undefined;
    host.focus(planId ? { kind: "ac", id: planId } : focusTarget(d.spaceId ?? ""));
    update();
  }

  function closeSheet(): boolean {
    if (!ui.sheet) return false;
    ui.sheet = null;
    sheetView = null;
    sheet.classList.add("hidden");
    panel.classList.remove("hidden");
    panel.inert = false;
    sheet.inert = true;
    card.classList.remove("detail");
    host.focus(focusTarget(ui.room));
    update();
    return true;
  }

  function sheetHead(name: string, sub: Node, powerBtn?: Node): HTMLElement {
    return h("div.sheet-head", h("button.round", { "aria-label": "Back", onclick: closeSheet }, icon("back", 19, 2.2)), h("div.sheet-title", h("div.sheet-name", name), sub), powerBtn);
  }

  function bigNumber(unit: string) {
    const num = h("span.num");
    const el = h("div.big", num, h("small", unit));
    let shown: number | string | null = null;
    return {
      el,
      set(value: number | string, off: boolean): void {
        el.classList.toggle("off", off);
        if (value === shown) return;
        if (shown !== null && typeof value === "number" && typeof shown === "number") {
          num.classList.remove("tick-up", "tick-down");
          void num.offsetWidth;
          num.classList.add(value > shown ? "tick-up" : "tick-down");
        }
        num.textContent = String(value);
        shown = value;
      },
    };
  }

  function acSheet(d0: DeviceView): SheetView {
    const id = d0.id;
    const dev = (): DeviceView => byId(id) ?? d0;
    const set = (patch: AcPatch): void => host.setAC(id, patch);
    const caps0 = acCaps(d0);
    const sub = h("div.sheet-sub");
    const powerBtn = h("button.round.power", { "aria-label": "Power", onclick: () => set({ on: !isOn(dev()) }) }, icon("power", 21, 2.2));
    const big = bigNumber("°C");
    const eco = h("button.toggle-chip", { onclick: () => set({ eco: !acState(dev()).eco }) }, icon("leaf", 17), "Eco Mode", h("span.switch"));
    const slider = createSlider({
      min: caps0.min,
      max: caps0.max,
      value: acState(d0).target,
      gradient: TEMP_GRADIENT,
      labels: [`${caps0.min}°`, `${caps0.max}°`],
      onInput: (v) => set({ on: true, target: v }),
    });
    const sliderRow = h(
      "div.slider-row",
      h("button.round", { "aria-label": "Cooler", onclick: () => set({ on: true, target: acState(dev()).target - 1 }) }, icon("minus", 18, 2.2)),
      slider.el,
      h("button.round", { "aria-label": "Warmer", onclick: () => set({ on: true, target: acState(dev()).target + 1 }) }, icon("plus", 18, 2.2)),
    );

    const option = (key: "mode" | "fan" | "swing", title: string, fixedIcon: string | null) => {
      const value = h("div.option-value");
      let holder: Element = h("span");
      const options = (): AcOption | undefined => acCaps(dev())[key];
      const current = (): string | undefined => acState(dev())[key];
      const el = h(
        "button.option",
        {
          onclick: () => {
            const o = options();
            if (!o) return;
            el.classList.add("open");
            openMenu(
              clip,
              el,
              o.values.map((v) => ({
                label: label(v),
                selected: current() === v,
                icon: current() === v ? icon("check", 16, 2.4) : null,
                action: () => set({ [key]: v, ...(key === "mode" ? { on: true } : {}) }),
              })),
              { onClose: () => el.classList.remove("open") },
            );
          },
        },
        holder,
        h("span.corner", icon("down", 15, 2.2)),
        h("div.option-label", title),
        value,
      );
      let shown = "";
      return {
        el,
        available: (): boolean => Boolean(options()),
        update(): void {
          const c = current();
          value.textContent = c ? label(c) : "—";
          const ic = fixedIcon ?? acModeKey(c);
          if (shown !== ic) {
            const next = icon(ic, 24, 1.6);
            holder.replaceWith(next);
            holder = next;
            shown = ic;
          }
        },
      };
    };
    const mode = option("mode", "Mode", null);
    const fan = option("fan", "Fan speed", "fan");
    const swing = option("swing", "Airflow", "wind");
    const sleepValue = h("div.option-value");
    const sleep = h("button.option", { onclick: () => set({ sleep: !acState(dev()).sleep }) }, icon("moon", 24, 1.6), h("span.corner.dot"), h("div.option-label", "Sleep"), sleepValue);
    const options = h("div.options", mode.el, fan.el, sleep, swing.el);

    return {
      nodes: [sheetHead(d0.name, sub, caps0.power ? powerBtn : undefined), h("div.readout", big.el, eco), sliderRow, options],
      update(d) {
        const a = acState(d);
        const c = acCaps(d);
        // Um AC real só mostra os controles para os quais tem função.
        const shown: [HTMLElement, boolean][] = [
          [mode.el, mode.available()],
          [fan.el, fan.available()],
          [sleep, Boolean(c.sleep)],
          [swing.el, swing.available()],
        ];
        for (const [el, on] of shown) el.hidden = !on;
        eco.hidden = !c.eco;
        sliderRow.hidden = !c.target;
        options.hidden = !shown.some(([, on]) => on);
        options.style.gridTemplateColumns = `repeat(${shown.filter(([, on]) => on).length || 1}, 1fr)`;
        powerBtn.classList.toggle("on", a.on);
        const color = acColor(a);
        sub.replaceChildren(
          icon("thermo", 14),
          ...(a.roomTemp !== undefined ? ["Room ", h("b", `${a.roomTemp.toFixed(1)}°C`)] : [d.status === "offline" ? "Offline" : ""]),
          h("span.live", { style: { background: a.on ? color : "rgba(255,255,255,.25)", boxShadow: a.on ? `0 0 8px ${color}` : "none" } }),
        );
        big.set(c.target ? Math.round(a.target) : a.roomTemp !== undefined ? Math.round(a.roomTemp) : "–", !a.on);
        slider.set(a.target);
        eco.classList.toggle("on", a.eco);
        mode.update();
        fan.update();
        swing.update();
        sleep.classList.toggle("active", a.sleep);
        sleepValue.textContent = a.sleep ? "On" : "Off";
      },
    };
  }

  function lightSheet(d0: DeviceView): SheetView {
    const id = d0.id;
    const dev = (): DeviceView => byId(id) ?? d0;
    const set = (patch: LightPatch): void => host.setLight(id, patch);
    const caps = lampCaps(d0);
    const sub = h("div.sheet-sub");
    const powerBtn = h("button.round.power", { "aria-label": "Power", onclick: () => host.toggleLight(id) }, icon("power", 21, 2.2));
    const big = bigNumber("%");
    const nodes: Node[] = [sheetHead(d0.name, sub, powerBtn), h("div.readout", big.el)];
    const sliders: { brightness?: ReturnType<typeof createSlider>; temp?: ReturnType<typeof createSlider> } = {};

    if (caps.brightness) {
      sliders.brightness = createSlider({
        min: 5,
        max: 100,
        value: Math.round(lightState(d0).brightness * 100),
        gradient: DIM_GRADIENT,
        onInput: (v) => set({ on: true, brightness: v / 100 }),
      });
      nodes.push(
        h(
          "div.slider-row",
          h("button.round", { "aria-label": "Dimmer", onclick: () => set({ on: true, brightness: lightState(dev()).brightness - 0.1 }) }, icon("dim", 18)),
          sliders.brightness.el,
          h("button.round", { "aria-label": "Brighter", onclick: () => set({ on: true, brightness: lightState(dev()).brightness + 0.1 }) }, icon("bright", 18)),
        ),
      );
    }
    let kelvinLabel: HTMLElement | null = null;
    if (caps.temp) {
      kelvinLabel = h("span");
      sliders.temp = createSlider({ min: 2200, max: 6500, step: 100, value: lightState(d0).temp, gradient: KELVIN_GRADIENT, compact: true, onInput: (v) => set({ on: true, temp: v }) });
      nodes.push(h("div.field-label", h("span", "Colour temperature"), kelvinLabel), h("div.slider-row", sliders.temp.el));
    }
    let swatches: HTMLElement[] = [];
    let pad: ReturnType<typeof createColorPad> | null = null;
    let colorLabel: HTMLElement | null = null;
    if (caps.color) {
      colorLabel = h("span");
      pad = createColorPad({ value: lightState(d0).color, onInput: (c) => set({ on: true, color: c }) });
      swatches = SWATCHES.map((c) => h("button.swatch", { "aria-label": `Colour ${c}`, vars: { "--sw": c }, onclick: () => set({ on: true, color: c }) }));
      nodes.push(h("div.field-label", h("span", "Colour"), colorLabel), pad.el, h("div.swatches", swatches));
    } else {
      const linked = host.binding().light.has(id);
      nodes.push(
        h(
          "div.sheet-note",
          icon(iconFor(d0), 20),
          `${spaceName(d0)} · ${caps.brightness ? "drag across the light tile to dim it, or " : ""}${linked ? "click the lamp in the 3D view to toggle." : "tap the tile to toggle."}`,
        ),
      );
    }

    return {
      nodes,
      update(d) {
        const l = lightState(d);
        powerBtn.classList.toggle("on", l.on);
        sub.replaceChildren(spaceName(d), " · ", h("b", d.status === "offline" ? "Offline" : l.on ? "On" : "Off"));
        big.set(caps.brightness ? Math.round(l.brightness * 100) : l.on ? 100 : 0, !l.on);
        sliders.brightness?.set(Math.round(l.brightness * 100));
        sliders.temp?.set(l.temp);
        if (kelvinLabel) kelvinLabel.textContent = l.color ? "—" : `${Math.round(l.temp / 100) * 100} K`;
        swatches.forEach((el, i) => el.classList.toggle("selected", l.color?.toLowerCase() === SWATCHES[i]));
        pad?.set(l.color);
        if (colorLabel) colorLabel.textContent = l.color ? l.color.toUpperCase() : "White";
      },
    };
  }

  /** Dispositivos sem luz/AC (PCs, etc.): ações específicas que o Core declara, no mesmo visual. */
  function otherSheet(d0: DeviceView): SheetView {
    const sub = h("div.sheet-sub");
    const controls: GenericControls = buildPanel(d0, { run: (r) => host.run(r) });
    const lock = d0.actions.includes("lock")
      ? h("button.big-action", { onclick: () => void host.run({ deviceId: d0.id, type: "lock" }) }, icon("lock", 20), "Lock now")
      : null;
    return {
      nodes: [sheetHead(d0.name, sub), h("div.other-body", lock, controls.el)],
      update(d) {
        sub.replaceChildren(spaceName(d), " · ", h("b", d.status === "offline" ? "Offline" : "Online"));
        controls.update(d);
      },
    };
  }

  /* ---------- tooltip ---------- */

  function hideTooltip(): void {
    tooltip.classList.remove("show");
  }

  function deviceOfPlan(kind: "light" | "ac", planId: string): DeviceView | undefined {
    const map = kind === "light" ? host.binding().light : host.binding().ac;
    for (const [deviceId, pid] of map) if (pid === planId) return byId(deviceId);
    return undefined;
  }

  function showTooltip(hit: HoverHit): void {
    if (!hit || hit.kind === "room") return hideTooltip();
    const planName = (hit.kind === "light" ? host.plan.lights.find((l) => l.id === hit.id) : host.plan.acs.find((a) => a.id === hit.id))?.name ?? hit.id;
    const d = deviceOfPlan(hit.kind, hit.id);
    let name = planName;
    let status = "Not linked";
    let on = false;
    let color = "";
    if (d && hit.kind === "light") {
      const s = lightState(d);
      name = d.name;
      on = s.on;
      status = s.on ? (lampCaps(d).brightness ? `${Math.round(s.brightness * 100)}%` : "On") : "Off";
      color = lightCss(s);
    } else if (d) {
      const s = acState(d);
      name = d.name;
      on = s.on;
      status = s.on ? `${s.mode ? label(s.mode) : "On"} ${Math.round(s.target)}°` : "Off";
      color = acColor(s);
    }
    tooltip.replaceChildren(h("i.dot"), name, h("span", status));
    tooltip.classList.toggle("on", on);
    tooltip.style.setProperty("--dot", color);
    tooltip.style.left = `${clamp(hit.x, 70, card.clientWidth - 70)}px`;
    tooltip.style.top = `${Math.max(64, hit.y)}px`;
    tooltip.classList.add("show");
  }

  /* ---------- estado derivado ---------- */

  function mood(devices: DeviceView[]): THREE.Color {
    const open = ui.sheet ? byId(ui.sheet.id) : undefined;
    if (ui.sheet?.kind === "ac" && open) {
      const a = acState(open);
      const c = acCaps(open);
      if (!a.on) return NAVY.clone().multiplyScalar(0.8);
      const key = acModeKey(a.mode);
      if (key === "cool" || key === "heat" || key === "auto") {
        const t = clamp((a.target - c.min) / (c.max - c.min), 0, 1);
        return tmp.set("#1c4fc0").lerp(new THREE.Color("#8a3d12"), t).clone();
      }
      return new THREE.Color(MODE_COLORS[key]).multiplyScalar(0.38);
    }
    const sum = new THREE.Color(0, 0, 0);
    let weight = 0;
    for (const d of devices) {
      if (!isLamp(d) || tileKind(d) !== "light") continue;
      const s = lightState(d);
      if (!s.on) continue;
      const w = lampCaps(d).brightness ? s.brightness : 1;
      tmp.set(lightCss(s));
      sum.r += tmp.r * w;
      sum.g += tmp.g * w;
      sum.b += tmp.b * w;
      weight += w;
    }
    if (!weight) return NAVY.clone();
    sum.multiplyScalar(0.42 / weight);
    return NAVY.clone().lerp(sum, clamp(weight / 3.5, 0.25, 0.8));
  }

  function update(): void {
    homeName.textContent = host.title();
    renderRooms();
    layoutTiles();
    const devices = host.devices();
    const lamps = devices.filter((d) => tileKind(d) === "light" && isLamp(d));
    const lampsOn = lamps.filter(isOn);
    const acsOn = devices.filter((d) => tileKind(d) === "ac" && isOn(d));
    const anyOn = lampsOn.length > 0 || acsOn.length > 0;

    homeSub.replaceChildren(
      h("span.live", { style: anyOn ? {} : { background: "rgba(255,255,255,.25)", boxShadow: "none" } }),
      h("b", lampsOn.length ? `${lampsOn.length} of ${lamps.length}` : "No"),
      lamps.length ? " lights on" : " lights",
      acsOn.length && acCaps(acsOn[0] as DeviceView).target ? ` · AC ${Math.round(acState(acsOn[0] as DeviceView).target)}°` : "",
    );
    power.classList.toggle("on", anyOn);

    const active = host.scene();
    for (const [id, b] of sceneButtons) b.classList.toggle("active", active === id);

    for (const [id, { b, count }] of roomButtons) {
      b.classList.toggle("active", ui.room === id);
      const n = lampsOn.filter((d) => id === "all" || (id === "__none" ? !d.spaceId : d.spaceId === id)).length;
      count.textContent = String(n);
      count.classList.toggle("zero", n === 0 || id === "all");
    }

    const scoped = lamps.filter(inScope);
    const scopedOn = scoped.filter(isOn).length;
    listTitle.replaceChildren(
      h("b", ui.room === "all" ? "Whole home" : (host.spaces().find((s) => s.id === ui.room)?.name ?? "General")),
      ` · ${scopedOn} of ${scoped.length} on`,
    );

    for (const t of tiles.values()) {
      const d = byId(t.id);
      if (d) t.update(d);
    }
    const open = ui.sheet ? byId(ui.sheet.id) : undefined;
    if (ui.sheet && !open) closeSheet();
    else if (open) sheetView?.update(open);
    card.style.setProperty("--mood", `#${mood(devices).getHexString()}`);
  }

  layoutTiles();
  update();

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    canvas,
    card,
    update,
    showTooltip,
    openSheet,
    closeSheet,
    selectRoom,
    attach(): void {
      card.classList.remove("booting");
    },
    /** Alvo vindo do 3D: lâmpada -> dispositivo; AC -> folha; cômodo -> aba. */
    pick(target: PickTarget): void {
      if (target.kind === "light") {
        const d = deviceOfPlan("light", target.id);
        if (d) host.toggleLight(d.id);
        else this.toast("This lamp in the 3D model is not linked to a Nexus device.");
      } else if (target.kind === "ac") {
        const d = deviceOfPlan("ac", target.id);
        if (d) openSheet({ kind: "ac", id: d.id });
        else this.toast("This AC in the 3D model is not linked to a Nexus device.");
      } else {
        const space = [...host.binding().room].find(([, planRoom]) => planRoom === target.id)?.[0];
        if (space && roomButtons.has(space)) selectRoom(space);
      }
    },
    toast(text: string, bad = false): void {
      toastEl.textContent = text;
      toastEl.classList.toggle("info", !bad);
      toastEl.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), bad ? 5200 : 2600);
    },
    get room(): string {
      return ui.room;
    },
    anchorMenu: clip,
  };
}

export type HomePanel = ReturnType<typeof createPanel>;
