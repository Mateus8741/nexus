import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/** Limite para não estourar a mensagem WebSocket com dumps enormes. */
const MAX_OUTPUT_CHARS = 64_000;

/**
 * As 4 ações desta etapa. Injetada no WindowsAgent para que os testes (e o
 * smoke test deste passo) nunca precisem depender da implementação real.
 */
export interface SystemActions {
  shutdown(): Promise<void>;
  restart(): Promise<void>;
  lock(): Promise<void>;
  /** Resolve com a saída combinada (stdout + stderr). Rejeita se o exit code ≠ 0. */
  executeCommand(command: string): Promise<string>;
}

function combineOutput(stdout: string, stderr: string): string {
  const combined = [stdout, stderr]
    .map((part) => part.trimEnd())
    .filter((part) => part.length > 0)
    .join("\n");
  if (combined.length <= MAX_OUTPUT_CHARS) return combined;
  return `${combined.slice(0, MAX_OUTPUT_CHARS)}\n… [saída truncada]`;
}

function readExecStreams(error: unknown): { stdout: string; stderr: string } {
  if (!error || typeof error !== "object") return { stdout: "", stderr: "" };
  const record = error as { stdout?: unknown; stderr?: unknown };
  return {
    stdout: typeof record.stdout === "string" ? record.stdout : "",
    stderr: typeof record.stderr === "string" ? record.stderr : "",
  };
}

/** Erro de comando que ainda carrega a saída parcial capturada. */
export class CommandExecutionError extends Error {
  readonly output: string;

  constructor(message: string, output: string) {
    super(message);
    this.name = "CommandExecutionError";
    this.output = output;
  }
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

  async executeCommand(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, { encoding: "utf8", windowsHide: true });
      return combineOutput(stdout, stderr);
    } catch (error) {
      const streams = readExecStreams(error);
      const output = combineOutput(streams.stdout, streams.stderr);
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(message, output);
    }
  }
}

/** Implementação real para macOS (Nexus Desktop). */
export class MacSystemActions implements SystemActions {
  async shutdown(): Promise<void> {
    await execAsync(`osascript -e 'tell app "System Events" to shut down'`);
  }

  async restart(): Promise<void> {
    await execAsync(`osascript -e 'tell app "System Events" to restart'`);
  }

  async lock(): Promise<void> {
    await execAsync("pmset displaysleepnow");
  }

  async executeCommand(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, { encoding: "utf8" });
      return combineOutput(stdout, stderr);
    } catch (error) {
      const streams = readExecStreams(error);
      const output = combineOutput(streams.stdout, streams.stderr);
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(message, output);
    }
  }
}

/**
 * Usada quando o processo não está rodando em Windows nem macOS (dev/teste — inclui
 * este ambiente de desenvolvimento). Nunca executa nada de verdade, só
 * simula sucesso: existe para permitir validar todo o resto da arquitetura
 * (registro, heartbeat, protocolo, correlação de ações por requestId) sem
 * arriscar desligar/reiniciar a máquina onde o Agent estiver rodando.
 */
export class SimulatedSystemActions implements SystemActions {
  async shutdown(): Promise<void> {}
  async restart(): Promise<void> {}
  async lock(): Promise<void> {}
  async executeCommand(command: string): Promise<string> {
    return `[simulado] ${command}`;
  }
}

export function createSystemActions(): SystemActions {
  if (process.platform === "win32") return new WindowsSystemActions();
  if (process.platform === "darwin" && process.env.NEXUS_AGENT_SIMULATE !== "1") {
    return new MacSystemActions();
  }
  return new SimulatedSystemActions();
}
