import { resolveActions } from "../../shared/devices";
import type { ActionOutcome, ActionRequest, DeviceView, FieldSchema, ResolvedAction } from "../../shared/types";
import { icon } from "../shared/icons";

export interface PanelHooks {
  run(request: ActionRequest): Promise<ActionOutcome>;
}

export interface Panel {
  readonly el: HTMLElement;
  update(device: DeviceView): void;
}

const POWER = new Set(["turn_on", "turn_off", "toggle"]);
/** O stepper do próprio card já cobre a temperatura. */
const HANDLED_ELSEWHERE = new Set(["set-target-temperature"]);

function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

const fieldType = (s: FieldSchema): "string" | "number" | "boolean" => (typeof s === "string" ? s : s.type);

const isHsv = (a: ResolvedAction): boolean => ["h", "s", "v"].every((k) => k in (a.payloadSchema ?? {}));

function hsvCss(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const l = val * (1 - sat / 2);
  const sl = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l);
  return `hsl(${h} ${Math.round(sl * 100)}% ${Math.round(l * 100)}%)`;
}

/** Lê o HSV atual do dispositivo (Tuya: `colour_data[_v2]` = {h,s,v}, faixa 0-255 ou 0-1000). */
function readHsv(device: DeviceView): { h: number; s: number; v: number } | undefined {
  for (const key of ["colour_data_v2", "colour_data"]) {
    const raw = device.attributes[key];
    if (typeof raw !== "string") continue;
    try {
      const parsed = JSON.parse(raw) as { h?: number; s?: number; v?: number };
      const max = key.endsWith("_v2") ? 1000 : 255;
      if (typeof parsed.h === "number" && typeof parsed.s === "number" && typeof parsed.v === "number")
        return { h: parsed.h, s: Math.round((parsed.s / max) * 100), v: Math.round((parsed.v / max) * 100) };
    } catch {
      /* valor não-JSON: ignora */
    }
  }
  return undefined;
}

/** Brilho / temperatura de cor atuais (Tuya reporta 0-1000 nas variantes _v2, 0-255 nas demais) em %. */
function readLevel(device: DeviceView, actionType: string): number | undefined {
  const codes = actionType === "set-brightness" ? ["bright_value_v2", "bright_value"] : actionType === "set-color-temperature" ? ["temp_value_v2", "temp_value"] : [];
  for (const code of codes) {
    const raw = device.attributes[code];
    if (typeof raw === "number") return Math.round((raw / (code.endsWith("_v2") ? 1000 : 255)) * 100);
  }
  return undefined;
}

const prettyKey = (key: string): string =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

/** Slider com rótulo + valor; devolve o <input> para quem precisar ler/escrever. */
function slider(label: string, min: number, max: number, step: number, unit: string, value: number, onCommit: (v: number) => void) {
  const row = node("label", "ctl");
  const head = node("span", "ctl-head");
  const name = node("span", "", label);
  const val = node("span", "ctl-val");
  head.append(name, val);
  const input = node("input", "range");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const show = (): void => {
    val.textContent = `${input.value}${unit}`;
    input.style.setProperty("--p", `${((Number(input.value) - min) / Math.max(1, max - min)) * 100}%`);
  };
  input.value = String(value);
  show();
  input.addEventListener("input", show);
  input.addEventListener("change", () => onCommit(Number(input.value)));
  row.append(head, input);
  return { row, input, show };
}

export function buildPanel(initial: DeviceView, hooks: PanelHooks): Panel {
  let device = initial;
  const root = node("div", "panel-controls");
  for (const type of ["click", "dblclick", "keydown", "pointerdown"]) root.addEventListener(type, (e) => e.stopPropagation());

  const memory = new Map<string, number>(); // último valor enviado por slider
  const syncers: Array<(d: DeviceView) => void> = [];

  const actions = resolveActions(device).filter((a) => !POWER.has(a.actionType) && !HANDLED_ELSEWHERE.has(a.actionType));
  const command = actions.find((a) => a.actionType === "executeCommand");
  const rest = actions.filter((a) => a !== command);
  const color = rest.find(isHsv);
  const advanced = rest.filter((a) => a !== color && a.advanced);
  const common = rest.filter((a) => a !== color && !a.advanced);

  const send = async (request: Omit<ActionRequest, "deviceId">, status?: HTMLElement): Promise<ActionOutcome> => {
    if (status) {
      status.className = "status";
      status.textContent = "Enviando…";
    }
    const outcome = await hooks.run({ deviceId: device.id, ...request });
    if (status) {
      status.className = `status ${outcome.success ? "ok" : "bad"}`;
      status.textContent = outcome.success ? "Enviado" : (outcome.error ?? "Falhou");
    }
    return outcome;
  };

  /* ---- ações simples + controles rápidos */
  const quick = node("div", "sec");
  const buttons = node("div", "chips-row");
  for (const action of common) {
    const fields = Object.entries(action.payloadSchema ?? {});
    if (fields.length === 0) {
      const btn = node("button", "act", action.label);
      btn.addEventListener("click", () => void hooks.run({ deviceId: device.id, type: action.actionType }));
      buttons.append(btn);
      continue;
    }
    if (fields.length === 1) {
      const [field, schema] = fields[0] as [string, FieldSchema];
      const type = fieldType(schema);
      const detail = typeof schema === "string" ? undefined : schema;
      if (type === "number" && detail && "max" in detail && detail.max !== undefined) {
        const key = `${action.actionType}`;
        const min = detail.min ?? 0;
        const s = slider(action.label, min, detail.max, detail.step ?? 1, detail.unit ?? "", memory.get(key) ?? readLevel(device, action.actionType) ?? min, (v) => {
          memory.set(key, v);
          void hooks.run({ deviceId: device.id, type: action.actionType, payload: { [field]: v } });
        });
        quick.append(s.row);
        continue;
      }
      if (type === "string" && detail && "options" in detail && detail.options?.length) {
        const row = node("label", "ctl");
        row.append(node("span", "ctl-head", action.label));
        const select = node("select", "field");
        select.append(new Option("Selecionar…", ""));
        for (const o of detail.options) select.append(new Option(o, o));
        select.addEventListener("change", () => {
          if (select.value) void hooks.run({ deviceId: device.id, type: action.actionType, payload: { [field]: select.value } });
        });
        row.append(select);
        quick.append(row);
        continue;
      }
      if (type === "boolean") {
        const row = node("label", "ctl ctl-switch");
        row.append(node("span", "", action.label));
        const box = node("input", "toggle");
        box.type = "checkbox";
        box.addEventListener("change", () => void hooks.run({ deviceId: device.id, type: action.actionType, payload: { [field]: box.checked } }));
        row.append(box);
        quick.append(row);
        continue;
      }
    }
    advanced.push(action); // multi-campo / campo livre → formulário em Avançado
  }
  if (buttons.childElementCount > 0) quick.prepend(buttons);
  if (quick.childElementCount > 0) root.append(quick);

  /* ---- cor (HSV) */
  if (color) {
    const sec = node("div", "sec color");
    sec.append(node("div", "sec-title", "Cor"));
    const body = node("div", "color-body");
    const swatch = node("span", "color-preview");
    const stack = node("div", "color-stack");
    let h = 0;
    let s = 100;
    let v = 100;
    const paint = (): void => {
      swatch.style.background = hsvCss(h, s, v);
    };
    const status = node("span", "status");
    const commit = (): void => void send({ type: color.actionType, payload: { h, s, v } }, status);
    const hue = slider("Matiz", 0, 360, 1, "°", h, (x) => ((h = x), paint(), commit()));
    hue.input.classList.add("hue");
    hue.input.addEventListener("input", () => ((h = Number(hue.input.value)), paint()));
    const sat = slider("Saturação", 0, 100, 1, "%", s, (x) => ((s = x), paint(), commit()));
    sat.input.addEventListener("input", () => ((s = Number(sat.input.value)), paint()));
    const val = slider("Brilho", 0, 100, 1, "%", v, (x) => ((v = x), paint(), commit()));
    val.input.addEventListener("input", () => ((v = Number(val.input.value)), paint()));
    paint();
    stack.append(hue.row, sat.row, val.row);
    body.append(swatch, stack);
    sec.append(body, status);
    root.append(sec);
    syncers.push((d) => {
      const current = readHsv(d);
      if (!current || root.contains(document.activeElement)) return;
      [h, s, v] = [current.h, current.s, current.v];
      hue.input.value = String(h);
      sat.input.value = String(s);
      val.input.value = String(v);
      hue.show();
      sat.show();
      val.show();
      paint();
    });
  }

  /* ---- Avançado */
  const hasProps = Object.keys(device.attributes).length > 0;
  if (advanced.length > 0 || command || hasProps) {
    const adv = node("div", "adv");
    const toggle = node("button", "adv-head");
    toggle.innerHTML = `${icon("sliders", 15)}<span>Avançado</span><span class="chev">${icon("chevron", 15)}</span>`;
    toggle.setAttribute("aria-expanded", "false");
    const body = node("div", "adv-body");
    toggle.addEventListener("click", () => {
      const open = adv.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    for (const action of advanced) body.append(buildActionRow(action));

    if (command) {
      const row = node("div", "row");
      const head = node("button", "row-head");
      head.innerHTML = `<span>${icon("terminal", 15)}${command.label}</span><span class="chev">${icon("chevron", 15)}</span>`;
      const inner = node("div", "row-body");
      const log = node("pre", "term");
      const form = node("form", "term-form");
      const input = node("input", "field");
      input.placeholder = "Comando…";
      input.spellcheck = false;
      const go = node("button", "act", "Executar");
      go.type = "submit";
      form.append(input, go);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        log.textContent += `$ ${text}\n`;
        void send({ type: command.actionType, payload: { command: text } }).then((o) => {
          log.textContent += `${o.output ?? (o.success ? "(sem saída)" : (o.error ?? "Falhou"))}\n`;
          log.scrollTop = log.scrollHeight;
        });
      });
      inner.append(log, form);
      row.append(head, inner);
      head.addEventListener("click", () => row.classList.toggle("open"));
      body.append(row);
    }

    const props = node("div", "props");
    const renderProps = (d: DeviceView): void => {
      const sig = JSON.stringify(d.attributes);
      if (props.dataset.sig === sig) return;
      props.dataset.sig = sig;
      props.replaceChildren(
        ...Object.entries(d.attributes).map(([k, val]) => {
          const cell = node("div", "prop");
          cell.append(node("span", "prop-k", prettyKey(k)), node("span", "prop-v", String(val)));
          return cell;
        }),
      );
    };
    if (hasProps) {
      body.append(node("div", "sec-title", "Propriedades"), props);
      renderProps(device);
      syncers.push(renderProps);
    }

    adv.append(toggle, body);
    root.append(adv);
  }

  function buildActionRow(action: ResolvedAction): HTMLElement {
    const row = node("div", "row");
    const head = node("button", "row-head");
    head.innerHTML = `<span>${action.label}</span><span class="chev">${icon("chevron", 15)}</span>`;
    head.addEventListener("click", () => row.classList.toggle("open"));
    const inner = node("form", "row-body");
    const payload: Record<string, string | number | boolean> = {};
    for (const [field, schema] of Object.entries(action.payloadSchema ?? {})) {
      const type = fieldType(schema);
      const detail = typeof schema === "string" ? undefined : schema;
      payload[field] = type === "boolean" ? false : type === "number" ? ((detail && "min" in detail ? detail.min : undefined) ?? 0) : "";
      if (type === "number" && detail && "max" in detail && detail.max !== undefined) {
        const s = slider(prettyKey(field), detail.min ?? 0, detail.max, detail.step ?? 1, detail.unit ?? "", Number(payload[field]), (v) => (payload[field] = v));
        s.input.addEventListener("input", () => (payload[field] = Number(s.input.value)));
        inner.append(s.row);
      } else if (type === "boolean") {
        const r = node("label", "ctl ctl-switch");
        r.append(node("span", "", prettyKey(field)));
        const box = node("input", "toggle");
        box.type = "checkbox";
        box.addEventListener("change", () => (payload[field] = box.checked));
        r.append(box);
        inner.append(r);
      } else if (type === "string" && detail && "options" in detail && detail.options?.length) {
        const r = node("label", "ctl");
        r.append(node("span", "ctl-head", prettyKey(field)));
        const select = node("select", "field");
        select.append(new Option("Selecionar…", ""));
        for (const o of detail.options) select.append(new Option(o, o));
        select.addEventListener("change", () => (payload[field] = select.value));
        r.append(select);
        inner.append(r);
      } else {
        const r = node("label", "ctl");
        r.append(node("span", "ctl-head", prettyKey(field)));
        const input = node("input", "field");
        input.type = type === "number" ? "number" : "text";
        input.placeholder = field === "code" ? "ex.: switch_led" : "";
        input.spellcheck = false;
        input.addEventListener("input", () => (payload[field] = type === "number" ? Number(input.value) : input.value));
        r.append(input);
        inner.append(r);
      }
    }
    const foot = node("div", "row-foot");
    const status = node("span", "status");
    const go = node("button", "act", "Aplicar");
    go.type = "submit";
    foot.append(status, go);
    inner.append(foot);
    inner.addEventListener("submit", (e) => {
      e.preventDefault();
      void send({ type: action.actionType, payload }, status);
    });
    row.append(head, inner);
    return row;
  }

  for (const sync of syncers) sync(device);

  return {
    el: root,
    update(next) {
      device = next;
      for (const sync of syncers) sync(next);
    },
  };
}
