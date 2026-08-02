"use client";

import type { ResolvedDeviceAction } from "@nexus/domain";
import { Button } from "@nexus/ui/components/button";
import { useState, useTransition } from "react";

import { runDeviceAction } from "@/lib/actions/device-actions";

interface DeviceActionButtonsProps {
  deviceId: string;
  actions: readonly ResolvedDeviceAction[];
}

interface ActionFeedback {
  actionType: string;
  ok: boolean;
  message: string;
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
 */
export function DeviceActionButtons({ deviceId, actions }: DeviceActionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  function handleClick(action: ResolvedDeviceAction) {
    setFeedback(null);
    setPendingType(action.actionType);

    startTransition(async () => {
      const result = await runDeviceAction(deviceId, { type: action.actionType });
      setPendingType(null);
      setFeedback({
        actionType: action.actionType,
        ok: result.success,
        message: result.success ? "Executado." : (result.error ?? "Falhou."),
      });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        // Ações que exigem payload (ex.: executeCommand) ainda não têm um
        // formulário de coleta de parâmetros nesta interface — só desabilita
        // o botão em vez de dispará-la sem os dados necessários.
        const requiresPayload = Boolean(
          action.payloadSchema && Object.keys(action.payloadSchema).length > 0,
        );
        const isThisPending = isPending && pendingType === action.actionType;
        const actionFeedback = feedback?.actionType === action.actionType ? feedback : undefined;

        return (
          <div
            key={`${action.capabilityKey}-${action.actionType}`}
            className="flex flex-col items-start gap-0.5"
          >
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={requiresPayload || isThisPending}
              onClick={() => handleClick(action)}
              title={
                requiresPayload
                  ? "Ação requer parâmetros — ainda não suportado nesta interface."
                  : undefined
              }
            >
              {isThisPending ? "Executando..." : action.label}
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
  );
}
