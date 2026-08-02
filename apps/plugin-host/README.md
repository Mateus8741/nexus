# @nexus/plugin-host

Processo Node.js de longa duração que carrega e executa os plugins do Nexus (`packages/plugins/*`). Existe separado de `apps/web` porque integrações como MQTT, varredura de rede e watchers de Docker/Proxmox precisam manter conexões e estado vivos — algo que não cabe bem no modelo serverless/route-handler do Next.js.

É o composition root do sistema: o único lugar que instancia implementações concretas (`InMemoryDeviceRegistry`, `WebSocketAgentGateway`, `@nexus/plugin-windows`) e as conecta através das abstrações (`PluginRegistry`, `DeviceRegistry`, `AgentGateway`, `AttachDeviceProviderUseCase`).

```
bun run --filter @nexus/plugin-host dev
```

Sobe um único servidor em `http://localhost:4700` (configurável via `PORT` ou `NEXUS_HTTP_PORT`) servindo, na MESMA porta: a API HTTP somente-leitura do Dashboard (`/health`, `/devices`, `/events`, `/plugins`, `/providers`) e o WebSocket que aguarda conexões de Agents (ex.: `apps/agent-windows`), via upgrade HTTP→WebSocket anexado ao mesmo `http.Server` (ver `WebSocketAgentGateway` em `@nexus/infrastructure`). Uma porta só, de propósito — necessário para caber atrás de um reverse proxy por domínio único (ex.: Coolify/Traefik — ver ARCHITECTURE.md seção 16). Sem autenticação nesta etapa — ver ARCHITECTURE.md.

Deploy em produção via Docker: ver `Dockerfile` neste diretório e ARCHITECTURE.md seção 16 (build context deve ser a raiz do monorepo).
