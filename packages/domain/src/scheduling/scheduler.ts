/**
 * Gatilho de um agendamento. `"once"` dispara uma vez após `delayMs`;
 * `"interval"` dispara repetidamente a cada `everyMs`. Nenhuma expressão
 * cron nesta etapa — só o suficiente para validar a infraestrutura (ver
 * ARCHITECTURE.md, "Scheduler" — "ainda não implementar automações").
 */
export type ScheduleTrigger =
  | { readonly kind: "once"; readonly delayMs: number }
  | { readonly kind: "interval"; readonly everyMs: number };

export interface ScheduledJob {
  readonly id: string;
  readonly trigger: ScheduleTrigger;
}

/**
 * Scheduler — port de agendamento genérico. Não sabe nada sobre
 * automações/rotinas/scripts — é só a infraestrutura de "rodar isto em X
 * ms, ou a cada X ms", que um futuro serviço de Automações vai consumir.
 *
 * Implementação concreta: InMemoryScheduler, em @nexus/infrastructure.
 */
export interface Scheduler {
  schedule(trigger: ScheduleTrigger, callback: () => void): ScheduledJob;
  cancel(jobId: string): void;
  list(): readonly ScheduledJob[];
}
