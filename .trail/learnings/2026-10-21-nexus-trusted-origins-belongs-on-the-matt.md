---
title: "NEXUS_TRUSTED_ORIGINS belongs on the core, not the root .env"
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 5, tokens: 36266 }
touches:
  - apps/web/app/cadastro/page.tsx
  - apps/web/app/cadastro/signup-form.tsx
  - apps/web/app/conta-criada/conta-criada.tsx
  - apps/web/app/conta-criada/page.tsx
  - apps/web/app/downloads/page.tsx
  - apps/web/app/layout.tsx
  - apps/web/app/login/login-form.tsx
  - apps/web/app/welcome/page.tsx
  - apps/web/components/downloads/downloads-view.tsx
  - apps/web/components/landing/downloads-cta.tsx
---

## Decided
- NEXUS_TRUSTED_ORIGINS is read only by the plugin-host (Better Auth trustedOrigins in apps/plugin-host/src/index.ts). Login and signup from the web fail unless the browser origin is in that comma-separated list.
- The live value belongs on the core process (Coolify env for nexus-core). The local copy is apps/plugin-host/.env: https://nex.codewaveds.com.br,https://core.codewaveds.com.br (https, no trailing slash). The repo-root .env does not configure production.

## Tried and ruled out
- Leaving NEXUS_TRUSTED_ORIGINS empty in the root .env. An empty string is not nullish, so the localhost fallback in index.ts does not apply and trusted origins become [""].

## Watch out
- Confirm the same two origins are set on the Coolify core app. apps/plugin-host/.env is a local mirror, not the running server.
- BETTER_AUTH_URL and BETTER_AUTH_COOKIE_DOMAIN sit next to it on the core (https://core.codewaveds.com.br and codewaveds.com.br). The web app only needs NEXUS_PLUGIN_HOST_URL / NEXT_PUBLIC_NEXUS_CORE_URL.
