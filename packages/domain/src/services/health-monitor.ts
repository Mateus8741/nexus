/**
 * HealthMonitor — port de rastreamento de heartbeat/timeout. Existe para
 * que nenhum plugin precise implementar essa lógica individualmente (ver
 * ARCHITECTURE.md, "Health Service"): um provider chama
 * `heartbeat(deviceId, onTimeout)` a cada heartbeat/leitura recebida, e a
 * implementação concreta reseta um timer — se nenhum novo heartbeat
 * chegar dentro do timeout configurado, `onTimeout` é chamado.
 *
 * Deliberadamente NÃO conhece Device/DeviceRegistry: só sabe "avise-me se
 * ninguém chamar heartbeat de novo a tempo". Quem decide o que fazer
 * nesse caso (marcar offline, emitir um evento) continua sendo o
 * DeviceProvider — isso preserva o provider como única fonte da verdade
 * sobre seus próprios dispositivos (ele quem sincroniza com o
 * DeviceRegistry via AttachDeviceProviderUseCase, nunca o HealthMonitor
 * diretamente).
 *
 * Não substitui uma desconexão EXPLÍCITA que o provider já detectou por
 * outro meio (ex.: socket fechado) — o provider deve chamar
 * `stopTracking()` nesse caso, para não deixar um timer velho disparando
 * depois de o dispositivo já ter sido marcado offline por outro caminho.
 */
export interface HealthMonitor {
  /** (Re)inicia o timer de timeout para `deviceId`. Chamar de novo com o mesmo id reseta o timer (debounce) e substitui `onTimeout`. */
  heartbeat(deviceId: string, onTimeout: () => void): void;
  lastSeenAt(deviceId: string): Date | undefined;
  stopTracking(deviceId: string): void;
}
