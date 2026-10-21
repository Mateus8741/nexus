---
title: Desktop installers hosted on public GitHub Release; 3D scenes throttled
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 6, tokens: 41898 }
touches:
  - apps/web/components/downloads/downloads-view.tsx
  - apps/web/components/landing/hero-scene.tsx
  - apps/web/components/landing/hero.tsx
  - apps/web/components/landing/scenes-demo.tsx
  - apps/web/components/scenes/frame-driver.tsx
  - apps/web/components/scenes/iso-room.tsx
  - apps/web/components/layout/topbar.tsx
  - apps/web/components/layout/user-menu.tsx
  - package.json
---

## Decided
- /downloads links to https://github.com/Mateus8741/nexus/releases/download/desktop-v<VERSION>/<file>; default lives in components/downloads/downloads-view.tsx, overridable with NEXT_PUBLIC_NEXUS_DOWNLOAD_BASE_URL (check Coolify doesn't set it to something else). Repo was made public (secrets scan clean) so release assets are downloadable.
- 3D canvases use frameloop="demand" + FrameDriver (<=30fps) and pause offscreen/hidden tab (components/scenes/frame-driver.tsx). IsoRoom has a `lite` mode (no cast shadows) for the landing demo; hero scene falls back to static CSS on small/low-end devices.

## Tried and ruled out
- Serving installers from public/downloads/files: gitignored, so the deployed site had no files ("Failed - No file").
- GitHub Release on the private repo: assets are not publicly downloadable.

## Watch out
- Pushing a tag desktop-v* triggers the desktop-release workflow, which rebuilds and may overwrite release assets; cancel it if the manual assets are the known-good ones.
- To ship a new version: bump VERSION in downloads-view and desktop package.json, build with bun run dist, create release desktop-v<new> with the three files.
- The repo is public now: .env.example/docs mention the Postgres host IP; keep real secrets out.
