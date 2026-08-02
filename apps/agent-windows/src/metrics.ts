import fs from "node:fs";
import os from "node:os";

import type { AgentMetricsSnapshot } from "@nexus/agent-protocol";

/**
 * Coleta as métricas mínimas pedidas nesta etapa. CPU/RAM/disco são
 * percentuais agregados — nada de granularidade por núcleo, processo ou
 * partição ainda (fica para um próximo passo).
 */
export async function collectMetrics(): Promise<AgentMetricsSnapshot> {
  const [cpuUsagePercent, diskUsagePercent] = await Promise.all([
    sampleCpuUsagePercent(),
    sampleDiskUsagePercent(),
  ]);

  return {
    cpuUsagePercent,
    ramUsagePercent: sampleRamUsagePercent(),
    diskUsagePercent,
    uptimeSeconds: Math.round(os.uptime()),
  };
}

function sampleRamUsagePercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return round(((total - free) / total) * 100);
}

/**
 * Estimativa por amostragem: duas leituras de os.cpus() com um pequeno
 * intervalo entre elas. Não é um valor "instantâneo" de verdade (isso
 * exigiria um contador nativo do SO) — é a mesma técnica usada por
 * praticamente qualquer ferramenta de monitoramento cross-platform simples.
 */
function sampleCpuUsagePercent(sampleWindowMs = 200): Promise<number> {
  const start = readCpuTimes();
  return new Promise((resolve) => {
    setTimeout(() => {
      const end = readCpuTimes();
      const idleDelta = end.idle - start.idle;
      const totalDelta = end.total - start.total;
      const usage = totalDelta === 0 ? 0 : (1 - idleDelta / totalDelta) * 100;
      resolve(round(Math.max(0, Math.min(100, usage))));
    }, sampleWindowMs);
  });
}

function readCpuTimes(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
  }
  return { idle, total };
}

/**
 * Melhor esforço via fs.statfsSync no diretório raiz (C:\ no Windows).
 * Enumeração por drive (C:\, D:\, ...) é um próximo passo — aqui só
 * validamos que a métrica chega e é exibível ponta a ponta.
 */
async function sampleDiskUsagePercent(): Promise<number> {
  try {
    const rootPath = process.platform === "win32" ? "C:\\" : "/";
    const stats = fs.statfsSync(rootPath);
    const total = stats.blocks * stats.bsize;
    if (total === 0) return 0;
    const free = stats.bfree * stats.bsize;
    return round(((total - free) / total) * 100);
  } catch {
    return 0;
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
