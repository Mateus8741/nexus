# http

Servidor HTTP somente-leitura (`node:http` puro, sem framework) que expõe o estado do Core — devices, eventos, plugins e providers — para outros processos, hoje só o Dashboard (`apps/web`) via `fetch` Node→Node. `event-log.ts` guarda um histórico curto de `DeviceEvent` (o `DeviceRegistry` só mantém o snapshot vivo, não histórico); `server.ts` faz o roteamento manual das rotas.
