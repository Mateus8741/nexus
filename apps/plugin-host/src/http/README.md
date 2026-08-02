# http

Servidor HTTP (`node:http` puro, sem framework) que expõe o estado do Core — devices, eventos, plugins, providers e capabilities — para outros processos, hoje só o Dashboard (`apps/web`) via `fetch` Node→Node, e recebe o único endpoint de escrita do processo (disparar uma ação num device). `server.ts` faz o roteamento manual das rotas:

- `GET /health`
- `GET /devices`
- `GET /events?limit=N` — via `AuditLog` (injetado de `apps/plugin-host/src/index.ts`), filtrado para só `DeviceEvent`.
- `GET /plugins`
- `GET /providers`
- `GET /capabilities`
- `POST /devices/:id/actions` — corpo `{ action: { type, payload? } }`, despachado via `ExecuteDeviceActionUseCase`.
