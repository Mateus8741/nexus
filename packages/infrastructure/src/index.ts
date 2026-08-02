/**
 * @nexus/infrastructure — Camada de Infraestrutura
 *
 * Implementações concretas dos ports definidos em @nexus/domain e
 * @nexus/application: persistência, mensageria, adaptadores para sistemas
 * externos (Docker, Proxmox, Home Assistant, MQTT, etc.) e carregamento de
 * configuração.
 *
 * Regra de dependência: pode depender de @nexus/domain e @nexus/application.
 * É a única camada autorizada a depender de bibliotecas externas e detalhes
 * de infraestrutura (drivers de banco, SDKs de terceiros, protocolos de rede).
 *
 * Consumida por apps/web (via route handlers) e por apps/plugin-host.
 *
 * Nenhuma funcionalidade foi implementada ainda — apenas a estrutura de pastas.
 */

export {};
