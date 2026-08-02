/**
 * @nexus/application — Camada de Aplicação
 *
 * Orquestra entidades e regras de @nexus/domain para cumprir casos de uso
 * concretos (ex.: "registrar dispositivo", "criar ambiente", "disparar automação").
 *
 * Regra de dependência: pode depender de @nexus/domain, mas NUNCA de
 * @nexus/infrastructure nem de qualquer framework. Esta camada define os
 * "ports" que a infraestrutura deve implementar (ex.: EventBus, Clock,
 * PluginRegistry) — a implementação concreta é injetada de fora.
 *
 * Nenhuma funcionalidade foi implementada ainda — apenas a estrutura de pastas.
 */

export {};
