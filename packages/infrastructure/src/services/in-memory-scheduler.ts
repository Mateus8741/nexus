import type { ScheduledJob, Scheduler, ScheduleTrigger } from "@nexus/domain";

/**
 * Implementação concreta de Scheduler (@nexus/domain) usando
 * `setTimeout`/`setInterval`. Só a infraestrutura de agendamento — nenhuma
 * automação real é executada por este pacote (ver ARCHITECTURE.md,
 * "Scheduler" — "ainda não implementar automações").
 */
export class InMemoryScheduler implements Scheduler {
  private readonly handles = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly jobs = new Map<string, ScheduledJob>();
  private nextId = 1;

  schedule(trigger: ScheduleTrigger, callback: () => void): ScheduledJob {
    const id = `job-${this.nextId++}`;
    const job: ScheduledJob = { id, trigger };

    const handle =
      trigger.kind === "once"
        ? setTimeout(callback, trigger.delayMs)
        : setInterval(callback, trigger.everyMs);

    this.handles.set(id, handle);
    this.jobs.set(id, job);
    return job;
  }

  cancel(jobId: string): void {
    const handle = this.handles.get(jobId);
    if (handle) {
      clearTimeout(handle);
      clearInterval(handle);
    }
    this.handles.delete(jobId);
    this.jobs.delete(jobId);
  }

  list(): readonly ScheduledJob[] {
    return Array.from(this.jobs.values());
  }
}
