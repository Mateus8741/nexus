/**
 * @nexus/application — Camada de Aplicação
 *
 * Orquestra entidades e regras de @nexus/domain para cumprir casos de uso
 * concretos (ex.: "conectar um DeviceProvider ao DeviceRegistry", "registrar
 * dispositivo", "criar ambiente", "disparar automação").
 *
 * Regra de dependência: pode depender de @nexus/domain, mas NUNCA de
 * @nexus/infrastructure nem de qualquer framework. Esta camada define os
 * "ports" que a infraestrutura deve implementar (ex.: EventBus, Clock,
 * PluginRegistry) — a implementação concreta é injetada de fora.
 */

export {
  type DeviceDto,
  fromDeviceDto,
  toDeviceDto,
} from "./dto/device-dto";
export {
  type DeviceEventDto,
  fromDeviceEventDto,
  toDeviceEventDto,
} from "./dto/device-event-dto";
export {
  type DeviceStateDto,
  fromDeviceStateDto,
  toDeviceStateDto,
} from "./dto/device-state-dto";
export { AttachDeviceProviderUseCase } from "./use-cases/attach-device-provider";
