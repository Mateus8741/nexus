---
title: "Landing at / for everyone, dashboard moved to /dashboard"
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 2, tokens: 33800 }
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
- "/" is the public landing for visitors and logged-in users (app/page.tsx; LandingNav/Hero show "Abrir painel" when signed in). The panel lives at /dashboard (app/dashboard/page.tsx). Login redirects to /dashboard by default; nav, sidebar Brand and command palette point there.
- Middleware passes "/" through with x-nexus-bare=1 (no auth check); /dashboard unauthenticated redirects to /login?next=/dashboard. The earlier "/welcome" rewrite was removed.

## Tried and ruled out
- Rewriting "/" to /welcome for visitors only: confusing because logged-in users then never saw the landing and the dashboard URL was "/".

## Watch out
- Any new link to the panel must use /dashboard, not "/". Old bookmarks to "/" now show the landing.
- Do not run biome --write on whole folders: it reformats unrelated files.
