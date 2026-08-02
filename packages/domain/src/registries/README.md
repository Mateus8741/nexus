# registries

Interfaces de registries — mecanismos que rastreiam, em tempo real, a identidade e o estado atual de entidades vindas de múltiplas fontes (ex.: `DeviceRegistry` agregando dispositivos de vários `DeviceProvider`).

Diferente de `repositories/` (portas para persistir/consultar dados), um registry vive só em memória durante a execução e emite eventos quando algo muda. Aqui entra só a interface (contrato) — a implementação concreta é `InMemoryDeviceRegistry`, em `@nexus/infrastructure/persistence`.

`subscribe`/`notify` formam o lado "event bus" do contrato: `register`/`unregister`/`updateState` só mutam o estado conhecido; `notify` é quem publica um `DeviceEvent` para os assinantes — chamado por quem estiver sincronizando o registry com um `DeviceProvider` (`AttachDeviceProviderUseCase`, em `@nexus/application`), nunca pelo próprio registry internamente.
