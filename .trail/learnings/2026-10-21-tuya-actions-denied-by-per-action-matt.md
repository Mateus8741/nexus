---
title: Tuya actions denied by per-action permissions; widget/web advanced controls
author: Matt
date: 2026-10-21
branch: main
cost: { minutes: 6, tokens: 190319 }
touches:
  - packages/application/src/use-cases/execute-device-action.ts
  - packages/plugins/tuya/src/tuya-device-provider.ts
  - apps/web/components/dashboard/device-action-form.tsx
  - apps/web/components/dashboard/device-controls.tsx
  - apps/desktop/src/renderer/widget/controls.ts
---

## Decided
Web "Avançado" panel redesigned (glass rows, sliders, HSV picker as quick control, properties grid). Desktop widget got an expandable per-card panel (apps/desktop/src/renderer/widget/controls.ts) fed by GET /capabilities resolved in core-client.ts. Tuya set-color now sends colour_data HSV as an object, not a JSON string.

## Tried and ruled out
Relaxing ExecuteDeviceActionUseCase so only seeded `action.*` permissions are gated: blocked by the auto-mode classifier as a security weakening, so NOT applied; needs the user's explicit decision.

## Watch out
Likely root cause of "can't control Tuya devices": ExecuteDeviceActionUseCase requires `action.<type>` (turn_on, set-color, set-brightness, set-datapoint...) but PERMISSION_KEYS/role seeds only have shutdown/restart/lock/executeCommand, so every non-Owner is denied (Owner short-circuits). Not confirmed against a live host (plugin-host not running locally); also check Tuya cloud API subscriptions if Owner still fails.
