"use client";

import type { ResolvedDeviceAction } from "@nexus/domain";
import { Button } from "@nexus/ui/components/button";
import { type FormEvent, useState, useTransition } from "react";

import { runDeviceAction } from "@/lib/actions/device-actions";

interface DeviceActionFormProps {
  deviceId: string;
  action: ResolvedDeviceAction;
  onClose: () => void;
}

type FieldType = "string" | "number" | "boolean";

/**
 * Formulário genérico para qualquer DeviceAction cujo `payloadSchema` tenha
 * pelo menos um campo (ex.: `set-color` do plugin Tuya, com `{ h, s, v }`).
 *
 * Deliberadamente sem qualquer menção a Tuya, Windows ou qualquer outro
 * fabricante/plugin: renderiza um input por campo do schema (number/
 * string/boolean) e monta o payload na hora de enviar. Isso é o que faz um
 * plugin novo, com uma action nova, funcionar na UI sem tocar em nenhum
 * componente — só registrar a Capability com o `payloadSchema` certo (ver
 * packages/plugins/*).
 *
 * `executeCommand` (Windows) continua com sua própria UI de terminal
 * (device-command-terminal.tsx) — exceção de UX deliberada, não de domínio.
 */
export function DeviceActionForm({ deviceId, action, onClose }: DeviceActionFormProps) {
  const schema = action.payloadSchema ?? {};
  const fields = Object.entries(schema) as ReadonlyArray<[string, FieldType]>;

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(([field]) => [field, ""])),
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [field, type] of fields) {
      const raw = values[field] ?? "";
      if (type === "number") {
        payload[field] = raw.trim().length > 0 ? Number(raw) : undefined;
      } else if (type === "boolean") {
        payload[field] = raw === "true";
      } else {
        payload[field] = raw;
      }
    }
    return payload;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setFeedback(null);

    startTransition(async () => {
      const result = await runDeviceAction(deviceId, {
        type: action.actionType,
        payload: buildPayload(),
      });
      setFeedback({
        ok: result.success,
        message: result.success ? "Executado." : (result.error ?? "Falhou."),
      });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-1.5 flex w-[min(100%,20rem)] flex-col gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground">
          {action.label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-5 px-1.5"
          onClick={onClose}
          aria-label="Fechar formulário"
        >
          Fechar
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {fields.map(([field, type]) => (
          <label key={field} className="flex flex-col gap-0.5 text-[0.65rem] text-muted-foreground">
            {field}
            {type === "boolean" ? (
              <select
                value={values[field] ?? "false"}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
                className="w-20 rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            ) : (
              <input
                type={type === "number" ? "number" : "text"}
                value={values[field] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
                className="w-20 rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
              />
            )}
          </label>
        ))}

        <Button type="submit" variant="outline" size="xs" disabled={isPending}>
          {isPending ? "Enviando..." : "Enviar"}
        </Button>
      </div>

      {feedback ? (
        <span
          className={feedback.ok ? "text-[0.65rem] text-emerald-500" : "text-[0.65rem] text-red-500"}
        >
          {feedback.message}
        </span>
      ) : null}
    </form>
  );
}
