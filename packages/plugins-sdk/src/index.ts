/**
 * @nexus/plugins-sdk — Contrato Público de Plugins
 *
 * Define a interface que qualquer plugin/integração (MQTT, Docker, Proxmox,
 * Home Assistant, câmeras, sensores, etc.) deve implementar para rodar dentro
 * do Nexus, o schema de manifesto/capacidades, a máquina de estados do ciclo
 * de vida, e os dois mecanismos que o host usa para gerenciar plugins:
 * PluginRegistry (rastreia identidade/estado) e PluginLoader (valida e
 * registra candidatos vindos de qualquer PluginSource).
 *
 * Este pacote é o "kernel API" da plataforma: nenhum plugin — nem os
 * mantidos pelo próprio time do Nexus — tem acesso a nada além do que está
 * exposto aqui. Isso é o que garante "nenhum fabricante possui tratamento
 * especial" (ver PROJECT.md).
 *
 * Zero dependências de outros pacotes do monorepo, de propósito: este SDK
 * precisa poder ser usado (e testado) sozinho, sem puxar @nexus/domain,
 * @nexus/application ou qualquer framework junto.
 *
 * Consumido por apps/plugin-host (que descobre e executa plugins) e por
 * cada pacote em packages/plugins/* — o primeiro sendo @nexus/plugin-windows.
 */

export * from "./contracts";
export * from "./errors";
export { definePlugin } from "./factory";
export * from "./lifecycle";
export type { LoadRejection, LoadResult, PluginCandidate, PluginSource } from "./loader";
export { PluginLoader } from "./loader";
export type { PluginRegistryEvent, PluginRegistryListener, RegisteredPlugin } from "./registry";
export { PluginRegistry } from "./registry";
