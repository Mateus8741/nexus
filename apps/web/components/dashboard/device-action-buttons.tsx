"use client";

import type { ResolvedDeviceAction } from "@nexus/domain";
import { Button } from "@nexus/ui/components/button";
import { useState, useTransition } from "react";

import { DeviceCommandTerminal } from "@/components/dashboard/device-command-terminal";
import { runDeviceAction } from "@/lib/actions/device-actions";

interface DeviceActionButtonsProps {
  deviceId: string;
  actions: readonly ResolvedDeviceAction[];
}

interface ActionFeedback {
  actionType: string;
  ok: boolean;
  message: string;
  output?: string;
}

function isExecuteCommandAction(action: ResolvedDeviceAction): boolean {
  return action.actionType === "executeCommand";
}

/**
 * Botões de ação por dispositivo — únicos elementos interativos de
 * device-table.tsx, por isso extraídos num Client Component à parte (o
 * restante da tabela continua um Server Component).
 *
 * `actions` já vem resolvido (device-table.tsx chama `resolveDeviceActions`
 * do @nexus/domain antes de passar pra cá): este componente não sabe nem
 * precisa saber o que é uma Capability, só renderiza rótulos e dispara a
 * Server Action correspondente. Nenhuma checagem de `device.kind` ou de
 * fabricante aqui — é só uma lista genérica de { actionType, label }.
 *
 * Exceção de UX (não de domínio): `executeCommand` abre um mini-terminal
 * em vez de um formulário genérico de payload, porque a interação esperada
 * é digitar comandos e ver a saída.
 */
export function DeviceActionButtons({ deviceId, actions }: DeviceActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function runAction(action: ResolvedDeviceAction) {
    setFeedback(null);
    setPendingType(action.actionType);

    startTransition(async () => {
      const result = await runDeviceAction(deviceId, { type: action.actionType });
      setPendingType(null);
      setFeedback({
        actionType: action.actionType,
        ok: result.success,
        message: result.success ? "Executado." : (result.error ?? "Falhou."),
        output: result.output,
      });
    });
  }

  function handleClick(action: ResolvedDeviceAction) {
    if (isExecuteCommandAction(action)) {
      setFeedback(null);
      setIsTerminalOpen((open) => !open);
      return;
    }

    runAction(action);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const isCommand = isExecuteCommandAction(action);
          const isThisPending = isPending && pendingType === action.actionType;
          const actionFeedback =
            !isCommand && feedback?.actionType === action.actionType ? feedback : undefined;

          return (
            <div
              key={`${action.capabilityKey}-${action.actionType}`}
              className="flex flex-col items-start gap-0.5"
            >
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isThisPending || (isPending && !isCommand)}
                aria-expanded={isCommand ? isTerminalOpen : undefined}
                onClick={() => handleClick(action)}
              >
                {isThisPending
                  ? "Executando..."
                  : isCommand && isTerminalOpen
                    ? "Fechar terminal"
                    : action.label}
              </Button>

              {actionFeedback ? (
                <span
                  className={
                    actionFeedback.ok
                      ? "text-[0.65rem] text-emerald-500"
                      : "text-[0.65rem] text-red-500"
                  }
                >
                  {actionFeedback.message}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {isTerminalOpen ? (
        <DeviceCommandTerminal deviceId={deviceId} onClose={() => setIsTerminalOpen(false)} />
      ) : null}
    </div>
  );
}
