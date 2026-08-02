# use-cases

Casos de uso da aplicação.

Cada caso de uso orquestra entidades de `@nexus/domain` e ports definidos em `ports/`, sem conhecer a implementação concreta de infraestrutura.

- `attach-device-provider.ts` — `AttachDeviceProviderUseCase`, o primeiro caso de uso real: conecta qualquer `DeviceProvider` a um `DeviceRegistry` (registra os devices que ele já conhece, mantém sincronizado com os eventos que ele emitir depois). Genérico de propósito — Windows, Docker, Home Assistant e Tuya reaproveitam exatamente esta classe, sem alteração.
