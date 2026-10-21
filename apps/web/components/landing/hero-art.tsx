"use client";

import { useEffect, useRef } from "react";

/**
 * Arte do hero: ilhas flutuantes em SVG isométrico, animadas só com
 * transform/opacity via CSS. Sem canvas/WebGL, sem filter:blur.
 */

const CSS = `
.ha-float{animation:ha-float 7s ease-in-out infinite}
.ha-pulse{animation:ha-pulse 5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.ha-ring{animation:ha-ring 6s ease-in-out infinite}
.ha-twinkle{animation:ha-twinkle 4s ease-in-out infinite}
.ha-air{animation:ha-air 2.6s ease-in infinite;opacity:0}
.ha-orbit{offset-rotate:0deg;animation:ha-orbit 14s linear infinite}
.ha-led{animation:ha-twinkle 2.4s ease-in-out infinite}
@keyframes ha-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes ha-pulse{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.14);opacity:1}}
@keyframes ha-ring{0%,100%{opacity:.35}50%{opacity:.75}}
@keyframes ha-twinkle{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes ha-air{0%{transform:translateY(0);opacity:0}20%{opacity:.8}100%{transform:translateY(46px);opacity:0}}
@keyframes ha-orbit{from{offset-distance:0%}to{offset-distance:100%}}
.ha-paused *{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.ha-art *{animation:none!important}.ha-art .ha-air{opacity:.5}}
`;

const STARS =
  "radial-gradient(1px 1px at 12% 18%,#c9d4ff,transparent),radial-gradient(1px 1px at 28% 72%,#c9d4ff,transparent),radial-gradient(1.5px 1.5px at 44% 12%,#fff,transparent),radial-gradient(1px 1px at 58% 84%,#c9d4ff,transparent),radial-gradient(1px 1px at 71% 30%,#fff,transparent),radial-gradient(1.5px 1.5px at 86% 66%,#c9d4ff,transparent),radial-gradient(1px 1px at 93% 14%,#fff,transparent),radial-gradient(1px 1px at 5% 52%,#c9d4ff,transparent),radial-gradient(1px 1px at 37% 44%,#fff,transparent),radial-gradient(1px 1px at 79% 90%,#c9d4ff,transparent),radial-gradient(1px 1px at 64% 8%,#c9d4ff,transparent),radial-gradient(1px 1px at 20% 92%,#fff,transparent)";

/** Laje isométrica flutuante centrada em (x, y) (centro da face superior). */
function Slab({ x, y, tone = "top" }: { x: number; y: number; tone?: string }) {
  return (
    <g>
      <path
        d={`M${x - 100} ${y}L${x} ${y + 50}L${x} ${y + 74}L${x - 100} ${y + 24}Z`}
        fill="url(#ha-left)"
      />
      <path
        d={`M${x + 100} ${y}L${x} ${y + 50}L${x} ${y + 74}L${x + 100} ${y + 24}Z`}
        fill="url(#ha-right)"
      />
      <path
        d={`M${x - 100} ${y}L${x} ${y - 50}L${x + 100} ${y}L${x} ${y + 50}Z`}
        fill={`url(#ha-${tone})`}
      />
      <path
        d={`M${x - 100} ${y}L${x} ${y + 50}L${x + 100} ${y}`}
        fill="none"
        stroke="#8fa4ff"
        strokeOpacity=".35"
      />
      <path
        d={`M${x - 60} ${y + 62}L${x} ${y + 74}L${x + 60} ${y + 62}L${x} ${y + 134}Z`}
        fill="#181a38"
        opacity={0.9}
      />
    </g>
  );
}

function Island({
  x,
  y,
  delay,
  tone,
  children,
}: {
  x: number;
  y: number;
  delay: number;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <g className="ha-float" style={{ animationDelay: `${delay}s` }}>
      <Slab x={x} y={y} tone={tone} />
      {children}
    </g>
  );
}

function Art() {
  return (
    <svg
      viewBox="0 0 800 640"
      className="ha-art h-full w-full"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <defs>
        <linearGradient id="ha-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a3770" />
          <stop offset="1" stopColor="#262552" />
        </linearGradient>
        <linearGradient id="ha-top2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b2f6a" />
          <stop offset="1" stopColor="#2a2150" />
        </linearGradient>
        <linearGradient id="ha-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#201f46" />
          <stop offset="1" stopColor="#12132c" />
        </linearGradient>
        <linearGradient id="ha-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#181a3a" />
          <stop offset="1" stopColor="#0d0e22" />
        </linearGradient>
        <linearGradient id="ha-link" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7fa2ff" stopOpacity=".5" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity=".15" />
        </linearGradient>
        <radialGradient id="ha-warm">
          <stop offset="0" stopColor="#ffbf73" stopOpacity=".7" />
          <stop offset=".4" stopColor="#ffbf73" stopOpacity=".2" />
          <stop offset="1" stopColor="#ffbf73" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-cool">
          <stop offset="0" stopColor="#7fa2ff" stopOpacity=".6" />
          <stop offset=".45" stopColor="#7fa2ff" stopOpacity=".15" />
          <stop offset="1" stopColor="#7fa2ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-violet">
          <stop offset="0" stopColor="#a78bfa" stopOpacity=".75" />
          <stop offset=".4" stopColor="#a78bfa" stopOpacity=".22" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-green">
          <stop offset="0" stopColor="#5dffa5" stopOpacity=".6" />
          <stop offset="1" stopColor="#5dffa5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-orb" cx=".38" cy=".32" r=".8">
          <stop offset="0" stopColor="#eef1ff" />
          <stop offset=".5" stopColor="#b9c6ff" />
          <stop offset="1" stopColor="#7c6ae0" />
        </radialGradient>
        <linearGradient id="ha-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bcd0ff" />
          <stop offset="1" stopColor="#6f93f0" />
        </linearGradient>
      </defs>

      {/* linhas de conexão do núcleo às ilhas */}
      <g stroke="url(#ha-link)" strokeWidth="1.2" fill="none" strokeDasharray="3 6">
        <line x1="400" y1="300" x2="190" y2="240" />
        <line x1="400" y1="300" x2="610" y2="210" />
        <line x1="400" y1="300" x2="400" y2="120" />
        <line x1="400" y1="300" x2="350" y2="470" />
      </g>

      {/* pontos de brilho */}
      <g fill="#c9d4ff">
        <circle className="ha-twinkle" cx="90" cy="120" r="1.8" />
        <circle className="ha-twinkle" cx="700" cy="90" r="1.6" style={{ animationDelay: "-1s" }} />
        <circle
          className="ha-twinkle"
          cx="540"
          cy="520"
          r="1.8"
          style={{ animationDelay: "-2s" }}
        />
        <circle
          className="ha-twinkle"
          cx="230"
          cy="560"
          r="1.5"
          style={{ animationDelay: "-3s" }}
        />
        <circle
          className="ha-twinkle"
          cx="740"
          cy="400"
          r="1.7"
          style={{ animationDelay: "-1.5s" }}
        />
        <circle
          className="ha-twinkle"
          cx="300"
          cy="60"
          r="1.5"
          style={{ animationDelay: "-2.5s" }}
        />
      </g>
      <g fill="#ffbf73">
        <circle className="ha-twinkle" cx="140" cy="400" r="2" style={{ animationDelay: "-.5s" }} />
        <circle
          className="ha-twinkle"
          cx="660"
          cy="320"
          r="2"
          style={{ animationDelay: "-2.2s" }}
        />
        <circle
          className="ha-twinkle"
          cx="470"
          cy="40"
          r="1.8"
          style={{ animationDelay: "-3.2s" }}
        />
      </g>

      {/* núcleo: orbe + anéis */}
      <g>
        <circle className="ha-pulse" cx="400" cy="300" r="120" fill="url(#ha-violet)" />
        <g transform="rotate(-18 400 300)" fill="none">
          <ellipse
            className="ha-ring"
            cx="400"
            cy="300"
            rx="120"
            ry="36"
            stroke="#7fa2ff"
            strokeWidth="1.3"
          />
          <ellipse
            className="ha-ring"
            cx="400"
            cy="300"
            rx="156"
            ry="48"
            stroke="#a78bfa"
            strokeWidth="1.1"
            style={{ animationDelay: "-3s" }}
          />
          <circle
            className="ha-orbit"
            r="4"
            fill="#dfe6ff"
            style={{ offsetPath: "path('M520 300A120 36 0 1 1 280 300A120 36 0 1 1 520 300')" }}
          />
        </g>
        <circle cx="400" cy="300" r="34" fill="url(#ha-orb)" />
      </g>

      {/* ilha da lâmpada */}
      <Island x={190} y={260} delay={0}>
        <circle className="ha-pulse" cx="190" cy="184" r="96" fill="url(#ha-warm)" />
        <ellipse cx="190" cy="262" rx="30" ry="12" fill="#3f4d8c" />
        <rect x="187" y="206" width="6" height="58" fill="#d6d9ee" />
        <path d="M168 206L212 206L202 168L178 168Z" fill="#ffd9a0" />
        <path d="M168 206L190 214L212 206L190 198Z" fill="#fff0d2" />
      </Island>

      {/* ilha do monitor */}
      <Island x={610} y={230} delay={2} tone="top2">
        <circle
          className="ha-pulse"
          cx="610"
          cy="190"
          r="100"
          fill="url(#ha-cool)"
          style={{ animationDelay: "-2s" }}
        />
        <path d="M588 224L632 224L626 234L594 234Z" fill="#aeb3cf" />
        <rect x="607" y="204" width="6" height="22" fill="#aeb3cf" />
        <polygon points="552,140 668,176 668,236 552,200" fill="#0f1322" />
        <polygon points="558,147 662,181 662,229 558,195" fill="url(#ha-screen)" />
        <polygon points="568,160 628,179 628,184 568,165" fill="#fff" opacity=".45" />
        <polygon points="568,172 612,186 612,190 568,176" fill="#fff" opacity=".3" />
      </Island>

      {/* ilha do ar-condicionado */}
      <Island x={400} y={100} delay={4}>
        <rect x="330" y="30" width="140" height="42" rx="12" fill="#f1f2fa" />
        <rect x="330" y="30" width="140" height="42" rx="12" fill="#c8cde8" opacity=".3" />
        <rect x="342" y="62" width="116" height="3" rx="1.5" fill="#9aa0c8" />
        <circle className="ha-led" cx="446" cy="46" r="3" fill="#7dffb0" />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle
            key={i}
            className="ha-air"
            cx={352 + i * 24}
            cy="76"
            r="3"
            fill="#bfe6ff"
            style={{ animationDelay: `${-i * 0.5}s` }}
          />
        ))}
      </Island>

      {/* ilha do hub */}
      <Island x={350} y={450} delay={6} tone="top2">
        <circle
          className="ha-pulse"
          cx="350"
          cy="418"
          r="70"
          fill="url(#ha-green)"
          style={{ animationDelay: "-1s" }}
        />
        <polygon points="350,372 392,393 350,414 308,393" fill="#fbfbff" />
        <polygon points="308,393 350,414 350,456 308,435" fill="#d7daee" />
        <polygon points="392,393 350,414 350,456 392,435" fill="#b6bbdc" />
        <circle className="ha-led" cx="350" cy="393" r="5" fill="#5dffa5" />
        <circle cx="350" cy="393" r="9" fill="none" stroke="#5dffa5" strokeOpacity=".5" />
      </Island>
    </svg>
  );
}

/** Cena do hero. `active=false` pausa as animações; parallax só com mouse. */
export default function HeroArt({
  active,
  reducedMotion,
}: {
  readonly active: boolean;
  readonly reducedMotion: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el || reducedMotion) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    };
    const move = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -24;
      ty = (e.clientY / window.innerHeight - 0.5) * -16;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  return (
    <div className={`absolute inset-0 ${active ? "" : "ha-paused"}`} aria-hidden="true">
      <style>{CSS}</style>
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: STARS }} />
      <div className="absolute inset-y-0 left-1/2 w-[min(150vw,900px)] -translate-x-1/2 lg:left-auto lg:right-[-4%] lg:w-[min(62vw,900px)] lg:translate-x-0">
        <div
          ref={wrap}
          className="flex h-full items-center transition-transform duration-500 ease-out"
        >
          <Art />
        </div>
      </div>
    </div>
  );
}
