---
title: "Public landing, external signup and open /downloads (web)"
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 17, tokens: 319164 }
touches:
  - apps/desktop/package.json
  - apps/desktop/src/renderer/widget/main.ts
  - apps/desktop/src/renderer/widget/room.ts
  - apps/desktop/src/renderer/widget/styles.css
  - bun.lock
  - apps/plugin-host/src/auth/resolve-actor.ts
---

## Decided
- Visitors (no session) see the landing at "/": middleware rewrites "/" to app/welcome when /me is 401 and sets request header x-nexus-bare=1; root layout reads it and renders AppShell bare (no sidebar). "/downloads" is semi-public with the same bare header (also bare when the core is offline).
- External signup is app/cadastro via authClient.signUp.email (Better Auth already allows it). New accounts have no membership, so /me is 401 and they land on /conta-criada; login-form checks /me after sign-in for the same redirect. Access to devices still needs an admin invite (Usuários).
- Landing lives in apps/web/components/landing (nav, R3F hero scene, sections) and reuses IsoRoom for the scenes demo; canvases mount only near the viewport.

## Tried and ruled out
- Backend changes: none needed; sign-up was already enabled (no disableSignUp).

## Watch out
- Production: the web origin must be in NEXUS_TRUSTED_ORIGINS or sign-up/login fail.
- Open sign-up lets anyone create (access-less) accounts; consider rate limits or disabling it if abused.
- Two WebGL canvases can exist at once (hero paused offscreen + scenes demo).
