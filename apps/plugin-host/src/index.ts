/**
 * @nexus/plugin-host — Processo de execução de plugins
 *
 * Processo Node.js de longa duração (não serverless), responsável por
 * descobrir, carregar e executar os plugins/integrações do Nexus
 * (packages/plugins/*) — coisas como MQTT, varredura de rede, Docker,
 * Proxmox, Home Assistant, que precisam de conexões persistentes e não
 * cabem no ciclo de vida de route handlers do Next.js.
 *
 * Comunica-se com apps/web e com @nexus/infrastructure através dos
 * contratos de @nexus/plugins-sdk e @nexus/application.
 *
 * Nenhuma funcionalidade foi implementada ainda — apenas a estrutura de pastas.
 */

export {};
