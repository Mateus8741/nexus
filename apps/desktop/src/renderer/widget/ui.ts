// Primitivas de UI (port de house-control ui/dom.js): hyperscript mínimo, slider "grosso" com
// gradiente, seletor de cor (matiz x saturação) e menu pop-up ancorado.

type Child = Node | string | number | false | null | undefined | Child[];
interface Props {
  vars?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
  [key: string]: unknown;
}

/** h('div.a.b', { onclick, vars: { '--x': '1' } }, ...filhos) */
export function h<K extends keyof HTMLElementTagNameMap = "div">(spec: string, props?: Props | Child, ...children: Child[]): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = spec.split(".");
  const el = document.createElement(tag || "div") as HTMLElementTagNameMap[K];
  if (classes.length) el.className = classes.join(" ");
  let attrs: Props | null = null;
  if (props && typeof props === "object" && !(props instanceof Node) && !Array.isArray(props)) attrs = props as Props;
  else if (props !== undefined && props !== null) children.unshift(props as Child);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "style") Object.assign(el.style, v);
    else if (k === "vars") for (const [name, val] of Object.entries(v as Record<string, string>)) el.style.setProperty(name, val);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of (children as Child[]).flat(Infinity as 1) as Child[]) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

export interface SliderOptions {
  min: number;
  max: number;
  step?: number;
  value: number;
  gradient: string;
  compact?: boolean;
  labels?: [string, string];
  onInput: (value: number) => void;
}

export interface Slider {
  el: HTMLElement;
  set(value: number): void;
}

/** Slider horizontal com preenchimento em gradiente revelado sob um polegar grande. */
export function createSlider({ min, max, step = 1, value, gradient, compact = false, labels, onInput }: SliderOptions): Slider {
  const fill = h("div.slider-fill");
  const thumb = h("div.slider-thumb");
  const track = h("div.slider-track", { vars: { "--gradient": gradient } }, fill, thumb);
  const el = h(`div.slider${compact ? ".compact" : ""}`, track, labels ? h("div.slider-scale", h("span", labels[0]), h("span", labels[1])) : null);

  let current = value;
  const paint = (): void => {
    el.style.setProperty("--p", String(clamp((current - min) / (max - min), 0, 1)));
  };
  const input = (next: number): void => {
    current = next;
    paint();
    onInput(current);
  };
  const observer = new ResizeObserver(() => el.style.setProperty("--track-w", `${track.clientWidth}px`));
  observer.observe(track);

  const fromEvent = (ev: PointerEvent): number => {
    const r = track.getBoundingClientRect();
    const size = r.height; // o polegar é quadrado
    const p = clamp((ev.clientX - r.left - size / 2) / (r.width - size), 0, 1);
    const raw = min + p * (max - min);
    return clamp(Math.round(raw / step) * step, min, max);
  };

  track.addEventListener("pointerdown", (ev) => {
    track.setPointerCapture(ev.pointerId);
    el.classList.add("dragging");
    const next = fromEvent(ev);
    if (next !== current) input(next);
  });
  track.addEventListener("pointermove", (ev) => {
    if (!el.classList.contains("dragging")) return;
    const next = fromEvent(ev);
    if (next !== current) input(next);
  });
  const end = (): void => el.classList.remove("dragging");
  track.addEventListener("pointerup", end);
  track.addEventListener("pointercancel", end);

  paint();
  return {
    el,
    set(v) {
      if (v !== current && !el.classList.contains("dragging")) {
        current = v;
        paint();
      }
    },
  };
}

export interface MenuItem {
  label: string;
  selected?: boolean;
  icon?: Node | null;
  /** Linha informativa (não clicável). */
  info?: boolean;
  action?: () => void;
}

/** Menu pop-up ancorado a um elemento; abre para cima, ou para baixo quando falta espaço. */
export function openMenu(host: HTMLElement, anchor: HTMLElement, items: (MenuItem | "-")[], { onClose }: { onClose?: () => void } = {}): () => void {
  const menu = h("div.menu");
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", onKey, true);
    menu.classList.add("closing");
    setTimeout(() => menu.remove(), 150);
    onClose?.();
  };
  const outside = (ev: Event): void => {
    if (menu.contains(ev.target as Node)) return;
    if (anchor.contains(ev.target as Node)) ev.stopPropagation(); // o clique que o reabriria
    close();
  };
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      close();
    }
  };

  for (const item of items) {
    if (item === "-") {
      menu.append(h("hr"));
      continue;
    }
    if (item.info) {
      menu.append(h("div.menu-info", item.label));
      continue;
    }
    menu.append(
      h(
        `button${item.selected ? ".selected" : ""}`,
        {
          onclick: () => {
            close();
            item.action?.();
          },
        },
        h("span", item.label),
        item.icon,
      ),
    );
  }

  host.append(menu);
  const hr = host.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const below = ar.top - hr.top < mh + 16;
  const left = clamp(ar.right - hr.left - mw, 10, hr.width - mw - 10);
  menu.style.left = `${left}px`;
  menu.style.top = below ? `${ar.bottom - hr.top + 8}px` : `${ar.top - hr.top - mh - 8}px`;
  const ox = clamp(((ar.left + ar.width / 2 - hr.left - left) / mw) * 100, 10, 90);
  menu.style.setProperty("--origin", `${ox}% ${below ? "0%" : "100%"}`);

  setTimeout(() => {
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
  return close;
}

/* ---------- cor ---------- */

export function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  const n = parseInt(String(hex).replace("#", ""), 16);
  if (Number.isNaN(n)) return null;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hue = 0;
  if (d > 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { h: hue, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex(hue: number, s: number, v = 1): string {
  const f = (k: number): string => {
    const x = (k + hue / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(x, 4 - x, 1))) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

// O matiz corre da esquerda para a direita; a saturação some em direção ao branco embaixo.
// O brilho não faz parte do seletor: o slider de brilho da lâmpada é dono dele.
const PAD_MIN_SAT = 0.12;

export interface ColorPad {
  el: HTMLElement;
  set(hex: string | null): void;
}

export function createColorPad({ value, onInput }: { value: string | null; onInput: (hex: string) => void }): ColorPad {
  const thumb = h("div.pad-thumb");
  const el = h("div.pad", { role: "slider", tabindex: 0, "aria-label": "Colour" }, thumb);
  let dragging = false;

  const place = (x: number, y: number, hex: string): void => {
    el.classList.remove("empty");
    thumb.style.left = `${x * 100}%`;
    thumb.style.top = `${y * 100}%`;
    thumb.style.background = hex;
  };
  const show = (hex: string | null): void => {
    const c = hex ? hexToHsv(hex) : null;
    if (!c) {
      el.classList.add("empty");
      return;
    }
    place(c.h / 360, clamp((1 - c.s) / (1 - PAD_MIN_SAT), 0, 1), hsvToHex(c.h, c.s, 1));
  };
  const commit = (x: number, y: number): void => {
    const hex = hsvToHex(Math.min(359.9, x * 360), 1 - y * (1 - PAD_MIN_SAT), 1);
    place(x, y, hex);
    onInput(hex);
  };
  const pick = (ev: PointerEvent): void => {
    const r = el.getBoundingClientRect();
    commit(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
  };

  el.addEventListener("pointerdown", (ev) => {
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {
      /* a captura é um luxo, não um requisito */
    }
    dragging = true;
    el.classList.add("dragging");
    pick(ev);
  });
  el.addEventListener("pointermove", (ev) => {
    if (dragging) pick(ev);
  });
  const end = (): void => {
    dragging = false;
    el.classList.remove("dragging");
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", (ev) => {
    const step = ({ ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] } as Record<string, [number, number]>)[ev.key];
    if (!step) return;
    ev.preventDefault();
    commit(clamp((parseFloat(thumb.style.left) || 0) / 100 + step[0], 0, 1), clamp((parseFloat(thumb.style.top) || 0) / 100 + step[1], 0, 1));
  });

  show(value);
  return {
    el,
    set(hex) {
      if (!dragging) show(hex);
    },
  };
}
