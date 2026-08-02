/**
 * Métricas coletadas periodicamente pelo Agent. Lista mínima pedida nesta
 * etapa — CPU/RAM/disco são percentuais agregados (0-100), sem detalhe por
 * núcleo/partição/processo; isso é um "próximo passo" possível, não uma
 * limitação da arquitetura.
 */
export interface AgentMetricsSnapshot {
  readonly cpuUsagePercent: number;
  readonly ramUsagePercent: number;
  readonly diskUsagePercent: number;
  readonly uptimeSeconds: number;
}

/** Informações estáticas (não mudam a cada coleta) enviadas no `register`. */
export interface AgentSystemInfo {
  readonly hostname: string;
  readonly operatingSystem: {
    readonly name: string;
    readonly version: string;
  };
  readonly ipAddress: string | null;
}
