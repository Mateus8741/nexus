# @nexus/plugin-host

Processo Node.js de longa duração que carrega e executa os plugins do Nexus (`packages/plugins/*`). Existe separado de `apps/web` porque integrações como MQTT, varredura de rede e watchers de Docker/Proxmox precisam manter conexões e estado vivos — algo que não cabe bem no modelo serverless/route-handler do Next.js.

É o composition root do sistema: o único lugar que instancia implementações concretas (`InMemoryDeviceRegistry`, `WebSocketAgentGateway`, `@nexus/plugin-windows`) e as conecta através das abstrações (`PluginRegistry`, `DeviceRegistry`, `AgentGateway`, `AttachDeviceProviderUseCase`).

```
bun run --filter @nexus/plugin-host dev
```

Sobe um servidor WebSocket em `ws://localhost:4600` (configurável via `NEXUS_AGENT_GATEWAY_PORT`) aguardando conexões de Agents (ex.: `apps/agent-windows`). Sem autenticação nesta etapa — ver ARCHITECTURE.md.
