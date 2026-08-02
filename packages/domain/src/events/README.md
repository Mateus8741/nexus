# events

Eventos de domínio (ex.: `DispositivoConectado`, `EspacoCriado`, `AutomacaoDisparada`) emitidos quando o estado de uma entidade muda.

Consumidos pela camada de aplicação e, futuramente, por plugins através do `@nexus/plugins-sdk`.

Implementado até aqui: `device-event.ts` — `DeviceEvent`, união discriminada de `device.connected`, `device.disconnected`, `device.state-changed`, `device.action-executed` e `device.error`.
