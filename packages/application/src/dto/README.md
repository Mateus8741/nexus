# dto

Data Transfer Objects usados nas fronteiras da aplicação — o formato de entrada/saída dos casos de uso, desacoplado das entidades de domínio.

- `device-state-dto.ts` / `device-dto.ts` / `device-event-dto.ts` — versões JSON-safe de `DeviceState`/`Device`/`DeviceEvent` (`Date` vira `string` ISO), com `to*Dto`/`from*Dto` em cada um. Usados por `apps/plugin-host` (serializa o `DeviceRegistry` numa API HTTP) e por `apps/web` (desserializa de volta para os mesmos tipos de `@nexus/domain` que os componentes do Dashboard já esperavam).
