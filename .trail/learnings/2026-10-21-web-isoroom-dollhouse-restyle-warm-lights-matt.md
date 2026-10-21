---
title: "Web IsoRoom dollhouse restyle (warm lights, thick walls)"
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 2, tokens: 86545 }
touches:
  - apps/web/components/scenes/iso-room.tsx
---

## Decided
- The web hero room is apps/web/components/scenes/iso-room.tsx (SVG, helpers in iso.ts). The desktop widget has a separate one (apps/desktop/.../widget/room.ts).
- Restyled toward a "dollhouse" cutaway: wall thickness (T) and slab (SLAB) constants, low partitions as blocks, blurred contact shadows, light cones plus screen-blend bloom per lit pendant, and a blue night overlay that scales with (1 - lit fraction).
- Rounded furniture is faked with strokeLinejoin round and a stroke matching the face fill.

## Tried and ruled out
- Could not fetch the reference X video; worked from the screenshot only.
- Not verified on the authenticated dashboard, only on /login, which reuses the same scene.

## Watch out
- Painter's-algorithm sort in blocks() is by center sum; long thin partitions can mis-order against furniture if moved.
- mixBlendMode screen inside the brightness-filtered group depends on browser support.
