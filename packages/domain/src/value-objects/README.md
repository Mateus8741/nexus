# value-objects

Objetos de valor imutáveis, sem identidade própria (ex.: endereço IP, coordenada de posição, status de conexão).

Dois objetos de valor com os mesmos atributos são considerados iguais.

Implementado até aqui: `device-state.ts` (`DeviceState`, `DeviceConnectionStatus`, `DeviceAttributeValue`) e `device-action.ts` (`DeviceAction`, `DeviceActionResult`).
