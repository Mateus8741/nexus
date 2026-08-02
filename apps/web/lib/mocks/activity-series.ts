/**
 * Série temporal mockada para o gráfico de atividade do Dashboard.
 * Determinística (sem Math.random()) de propósito — assim o Server
 * Component que a importa e o gráfico client-side sempre renderizam o
 * mesmo valor, sem risco de mismatch de hidratação.
 */
export interface ActivityPoint {
  readonly hour: string;
  readonly events: number;
}

export const mockActivitySeries: ActivityPoint[] = Array.from({ length: 24 }, (_, hour) => ({
  hour: `${String(hour).padStart(2, "0")}:00`,
  events: 4 + Math.round(3 * Math.sin(hour / 3)) + (hour % 4),
}));
