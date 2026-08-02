# messaging

Implementações de mensageria/eventos (ex.: MQTT, filas internas, WebSocket) usadas para comunicação entre o núcleo e os plugins.

- `websocket-agent-gateway.ts` — `WebSocketAgentGateway`, implementação concreta de `AgentGateway` (`@nexus/plugins-sdk`) usando a lib `ws`. Aceita conexões de Agents remotos (ex.: `apps/agent-windows`) sem nenhuma autenticação nesta etapa — ver ARCHITECTURE.md.
