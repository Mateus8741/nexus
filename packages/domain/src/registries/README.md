# registries

Interfaces de registries — mecanismos que rastreiam, em tempo real, a identidade e o estado atual de entidades vindas de múltiplas fontes (ex.: `DeviceRegistry` agregando dispositivos de vários `DeviceProvider`).

Diferente de `repositories/` (portas para persistir/consultar dados), um registry vive só em memória durante a execução e emite eventos quando algo muda. Aqui entram só as interfaces (contratos) — a implementação concreta (ex.: um registry baseado em `Map`) fica para depois, em `@nexus/infrastructure` ou em `apps/plugin-host`.
