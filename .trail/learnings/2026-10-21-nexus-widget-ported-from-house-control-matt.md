---
title: "Nexus widget ported from House Control, light hero, Home Assistant plugin"
author: Matt
date: 2026-10-21
branch: perf/3d-lite-from-house-control
touches:
  - ".env.example"
  - apps/desktop/src/main/widget-window.ts
  - apps/desktop/src/renderer/widget/controls.ts
  - apps/desktop/src/renderer/widget/index.html
  - apps/desktop/src/renderer/widget/main.ts
  - apps/desktop/src/renderer/widget/room.ts
  - apps/desktop/src/renderer/widget/styles.css
  - apps/desktop/src/shared/devices.ts
  - apps/plugin-host/package.json
  - apps/plugin-host/src/index.ts
---

## Decided
- Desktop widget (apps/desktop/src/renderer/widget/{panel,model,ui,icons,home/*}.ts) now mirrors the House Control panel; Nexus spaces map to plan rooms by name, devices bind to plan lights/ACs by inferred type. Unbound plan lights are decorative. room.ts is now unused.
- Landing hero is SVG+CSS (components/landing/hero-art.tsx), no WebGL; hero-scene.tsx deleted. IsoRoom picks lite mode on weak devices (<=4 cores/mem, saveData, reduced motion).
- Home Assistant plugin: packages/plugins/homeassistant (env HOMEASSISTANT_URL/TOKEN, polling 15s, no websocket since SDK has no push). All numbers finite-checked before any service call.

## Tried and ruled out
- trail check flagged hero.tsx:98 against the Coolify origins learning: false positive, unrelated.
- Windows installer built from macOS worked (unsigned); mac dmgs unsigned too.

## Watch out
- Nothing was run inside Electron or against a real Home Assistant.
- isWeakDevice() must guard on `window`, not `navigator` (Node 24 has navigator in SSR).
- plugin-host tsc has a pre-existing error at tuya-device-provider.ts:217.
- Installers are in apps/desktop/release (gitignored); no GitHub release or desktop-v* tag was created.
