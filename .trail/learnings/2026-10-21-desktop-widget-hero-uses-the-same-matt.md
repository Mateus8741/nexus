---
title: Desktop widget hero uses the same three.js 3D room as web
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 12, tokens: 171667 }
touches:
  - apps/web/components/scenes/iso-room.tsx
  - apps/web/package.json
  - bun.lock
  - apps/desktop/src/renderer/widget/room.ts
---

## Decided
- apps/desktop/src/renderer/widget/room.ts is now a vanilla three.js port of the web IsoRoom (apps/web/components/scenes/iso-room.tsx); same layout, colors, lights. main.ts calls buildRoom() then mountRoom(.room) and updateRoom(lit, cool) as before.
- RoomId maps to bulbs: kitchen=living pendant, living=dining pendant+floor lamp, bedroom=bed pendant+nightstand lamps, dining=office pendant.
- three is a devDependency of @nexus/desktop (esbuild bundles it into the widget main.js, ~1.2MB).

## Tried and ruled out
- Sharing one scene module between web (R3F) and desktop: skipped to avoid refactoring the approved web scene; the two files are duplicates, so edits to the room must be made in both.

## Watch out
- Verified only with a standalone esbuild bundle in a browser, not inside Electron.
- The fit-camera padding (1.05) and the 1.35x void shadow plane were tuned on web to avoid clipping and a dark rectangle; keep them.
