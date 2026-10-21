---
title: "Nexus redesign: web motion + Nexus Desktop (Electron agent + widget)"
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 2, tokens: 88494 }
touches:
  - bun.lock
---

## Decided
- Split work into two disjoint-scope agents: web (apps/web, packages/ui) and desktop (apps/desktop, apps/agent-windows). Deps (`motion` in web, new apps/desktop workspace with electron/electron-builder/esbuild) were installed up front by one session so parallel agents don't fight over bun.lock.
- Desktop = Electron app embedding the agent (reused from apps/agent-windows, made cross-platform) plus a tray/menu-bar widget. Widget talks to Core from the main process with an API key (Bearer nxk_) to avoid CORS; GET /devices, POST /devices/:id/actions.
- Installers via electron-builder: NSIS .exe and .dmg (arm64+x64). Scenes (Bright/Cozy/Movie/Night/Away) are client-side presets over power-control turn_on/turn_off (+ lock for PCs).

## Tried and ruled out
- Renaming apps/agent-windows to a generic agent package: too invasive (bun.lock, plugin names); wrapped it instead.

## Watch out
- No wine/makensis on this Mac: building the Windows .exe from macOS may need signAndEditExecutable:false or fail on network downloads.
- Installers are unsigned (Gatekeeper/SmartScreen warnings).
- apps/agent-windows/dist/*.exe is committed despite .gitignore.
