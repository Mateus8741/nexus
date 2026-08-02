# repositories

Interfaces (ports) usadas pela camada `@nexus/application` para persistir e consultar entidades, sem depender de nenhuma tecnologia concreta.

As implementações reais (Postgres, SQLite, cache, etc.) vivem em `@nexus/infrastructure` e satisfazem essas interfaces.

Implementado até aqui: `device-provider.ts` — `DeviceProvider`, o port que uma integração concreta (Home Assistant, MQTT, etc.) implementaria para expor seus dispositivos. Nenhuma implementação concreta mora aqui.
