# @nexus/plugin-host

Processo Node.js de longa duração que carrega e executa os plugins do Nexus (`packages/plugins/*`). Existe separado de `apps/web` porque integrações como MQTT, varredura de rede e watchers de Docker/Proxmox precisam manter conexões e estado vivos — algo que não cabe bem no modelo serverless/route-handler do Next.js.

É o composition root do sistema: o único lugar que instancia implementações concretas (`InMemoryDeviceRegistry`, `WebSocketAgentGateway`, `@nexus/plugin-windows`, `@nexus/plugin-tuya`, `@nexus/plugin-lg-thinq`) e as conecta através das abstrações (`PluginRegistry`, `DeviceRegistry`, `AgentGateway`, `AttachDeviceProviderUseCase`).

## Plugins embutidos

- **`@nexus/plugin-windows`** — computadores Windows via Agent remoto (WebSocket + pareamento). Sempre ativo.
- **`@nexus/plugin-tuya`** — dispositivos Tuya/Smart Life (tomadas, interruptores, sensores) via Tuya Cloud API, com polling periódico. Opcional: só ativa se `TUYA_ACCESS_ID` e `TUYA_ACCESS_SECRET` estiverem definidos e houver ao menos uma conta (via `TUYA_UID` legada ou `provider_accounts` no Postgres). Sem rede local nem Local Key — funciona com o Core hospedado onde for.
- **`@nexus/plugin-lg-thinq`** — ares-condicionados LG via a API oficial "ThinQ Connect" (Personal Access Token), com polling periódico. Opcional: só ativa se `LGTHINQ_ACCESS_TOKEN`, `LGTHINQ_CLIENT_ID` e `LGTHINQ_COUNTRY_CODE` estiverem definidos (ver `.env.example`). Um PAT é de uma única conta LG — hoje só dá pra conectar uma conta por deploy.

```
bun run --filter @nexus/plugin-host dev
```

Sobe um único servidor em `http://localhost:4700` (configurável via `PORT` ou `NEXUS_HTTP_PORT`) servindo, na MESMA porta: a API HTTP somente-leitura do Dashboard (`/health`, `/devices`, `/events`, `/plugins`, `/providers`) e o WebSocket que aguarda conexões de Agents (ex.: `apps/agent-windows`), via upgrade HTTP→WebSocket anexado ao mesmo `http.Server` (ver `WebSocketAgentGateway` em `@nexus/infrastructure`). Uma porta só, de propósito — necessário para caber atrás de um reverse proxy por domínio único (ex.: Coolify/Traefik — ver ARCHITECTURE.md seção 16). Sem autenticação nesta etapa — ver ARCHITECTURE.md.

Deploy em produção via Docker: ver `Dockerfile` neste diretório e ARCHITECTURE.md seção 16 (build context deve ser a raiz do monorepo).
