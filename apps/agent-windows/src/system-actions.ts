import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * As 4 ações desta etapa. Injetada no WindowsAgent para que os testes (e o
 * smoke test deste passo) nunca precisem depender da implementação real.
 */
export interface SystemActions {
  shutdown(): Promise<void>;
  restart(): Promise<void>;
  lock(): Promise<void>;
  executeCommand(command: string): Promise<void>;
}

/** Implementação real — só deve rodar em Windows de verdade (ver createSystemActions). */
export class WindowsSystemActions implements SystemActions {
  async shutdown(): Promise<void> {
    await execAsync("shutdown /s /t 0");
  }

  async restart(): Promise<void> {
    await execAsync("shutdown /r /t 0");
  }

  async lock(): Promise<void> {
    await execAsync("rundll32.exe user32.dll,LockWorkStation");
  }

  async executeCommand(command: string): Promise<void> {
    await execAsync(command);
  }
}

/**
 * Usada quando o processo não está rodando em Windows (dev/teste — inclui
 * este ambiente de desenvolvimento). Nunca executa nada de verdade, só
 * simula sucesso: existe para permitir validar todo o resto da arquitetura
 * (registro, heartbeat, protocolo, correlação de ações por requestId) sem
 * arriscar desligar/reiniciar a máquina onde o Agent estiver rodando.
 */
export class SimulatedSystemActions implements SystemActions {
  async shutdown(): Promise<void> {}
  async restart(): Promise<void> {}
  async lock(): Promise<void> {}
  async executeCommand(): Promise<void> {}
}

export function createSystemActions(): SystemActions {
  return process.platform === "win32" ? new WindowsSystemActions() : new SimulatedSystemActions();
}
