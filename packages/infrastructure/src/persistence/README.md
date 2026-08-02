# persistence

Implementações concretas de persistência (banco de dados, cache, registries em memória) que satisfazem as interfaces de repositório/registry definidas em `@nexus/domain`.

- `in-memory-device-registry.ts` — `InMemoryDeviceRegistry`, implementação em memória de `DeviceRegistry`. Quem liga um `DeviceProvider` a esta instância é `AttachDeviceProviderUseCase` (`@nexus/application`).
