"use client";

import { Button } from "@nexus/ui/components/button";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { runDeviceAction } from "@/lib/actions/device-actions";

interface DeviceCommandTerminalProps {
  deviceId: string;
  onClose: () => void;
}

interface TerminalEntry {
  id: string;
  kind: "command" | "output" | "error" | "status";
  text: string;
}

let entryCounter = 0;

function nextEntryId(): string {
  entryCounter += 1;
  return `term-${entryCounter}`;
}

/**
 * Mini-terminal remoto para `executeCommand`: prompt, histórico e saída
 * monoespaçada. Fica aberto entre comandos para permitir várias execuções
 * seguidas sem reabrir o painel.
 */
export function DeviceCommandTerminal({ deviceId, onClose }: DeviceCommandTerminalProps) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries, isPending]);

  function appendEntries(...next: Omit<TerminalEntry, "id">[]) {
    setEntries((current) => [
      ...current,
      ...next.map((entry) => ({ ...entry, id: nextEntryId() })),
    ]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = command.trim();
    if (trimmed.length === 0 || isPending) return;

    setCommand("");
    setHistory((current) => [...current, trimmed]);
    setHistoryIndex(null);
    appendEntries({ kind: "command", text: trimmed });

    startTransition(async () => {
      const result = await runDeviceAction(deviceId, {
        type: "executeCommand",
        payload: { command: trimmed },
      });

      if (result.output && result.output.length > 0) {
        appendEntries({
          kind: result.success ? "output" : "error",
          text: result.output,
        });
      }

      if (!result.success) {
        appendEntries({
          kind: "error",
          text: result.error ?? "Falha ao executar o comando.",
        });
      } else if (!result.output) {
        appendEntries({ kind: "status", text: "Concluído (sem saída)." });
      }

      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setCommand("");
        return;
      }
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex] ?? "");
    }
  }

  return (
    <div
      className="mt-1.5 w-[min(100%,28rem)] overflow-hidden rounded-lg border border-border bg-zinc-950 text-zinc-100 shadow-sm"
      role="region"
      aria-label="Terminal remoto"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
        <span className="font-mono text-[0.65rem] tracking-wide text-zinc-400">terminal</span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-5 px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={onClose}
          aria-label="Fechar terminal"
        >
          Fechar
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-56 min-h-28 overflow-y-auto px-2.5 py-2 font-mono text-[0.7rem] leading-relaxed"
        tabIndex={0}
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <p className="text-zinc-500">Digite um comando e pressione Enter.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="whitespace-pre-wrap break-words">
              {entry.kind === "command" ? (
                <p>
                  <span className="text-emerald-400">{"PS> "}</span>
                  <span className="text-zinc-100">{entry.text}</span>
                </p>
              ) : (
                <p
                  className={
                    entry.kind === "error"
                      ? "text-red-400"
                      : entry.kind === "status"
                        ? "text-zinc-500"
                        : "text-zinc-300"
                  }
                >
                  {entry.text}
                </p>
              )}
            </div>
          ))
        )}
        {isPending ? <p className="text-zinc-500">Executando...</p> : null}
      </div>

      <form
        className="flex items-center gap-1.5 border-t border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5"
        onSubmit={handleSubmit}
      >
        <span className="shrink-0 font-mono text-[0.7rem] text-emerald-400" aria-hidden>
          {"PS>"}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          spellCheck={false}
          autoComplete="off"
          aria-label="Comando"
          placeholder="comando..."
          className="min-w-0 flex-1 bg-transparent font-mono text-[0.7rem] text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
        />
      </form>
    </div>
  );
}
