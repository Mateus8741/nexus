"use client";

import type { CapabilityFieldSchema, ResolvedDeviceAction } from "@nexus/domain";
import { fieldPrimitiveType } from "@nexus/domain";
import { Slider } from "@nexus/ui/components/slider";
import { Switch } from "@nexus/ui/components/switch";
import { Check, Loader2, Send } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";

import { runDeviceAction } from "@/lib/actions/device-actions";

interface DeviceActionFormProps {
  deviceId: string;
  action: ResolvedDeviceAction;
  onDone?: () => void;
}

type FieldValue = string | number | boolean;

/** True quando o schema é um HSV (h/s/v numéricos) — ganha o seletor de cor em vez de 3 sliders soltos. */
export function isHsvAction(action: ResolvedDeviceAction): boolean {
  const keys = Object.keys(action.payloadSchema ?? {});
  return ["h", "s", "v"].every((key) => keys.includes(key));
}

function hsvCss(h: number, s: number, v: number): string {
  // HSV → HSL só para pré-visualizar no CSS.
  const sat = s / 100;
  const val = v / 100;
  const l = val * (1 - sat / 2);
  const sl = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l);
  return `hsl(${h} ${Math.round(sl * 100)}% ${Math.round(l * 100)}%)`;
}

function initialValue(schema: CapabilityFieldSchema): FieldValue {
  const type = fieldPrimitiveType(schema);
  if (type === "boolean") return false;
  if (type === "number") return typeof schema === "string" ? 0 : ((schema as { min?: number }).min ?? 0);
  return "";
}

/**
 * Formulário genérico para qualquer DeviceAction com `payloadSchema`: um
 * controle por campo (slider quando há faixa, select quando há opções,
 * switch para boolean, input livre no resto) e um seletor de cor quando o
 * schema é HSV. Nenhuma menção a fabricante — só segue o schema que o
 * plugin registrou.
 */
export function DeviceActionForm({ deviceId, action, onDone }: DeviceActionFormProps) {
  const schema = action.payloadSchema ?? {};
  const fields = Object.entries(schema);
  const hsv = isHsvAction(action);

  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(fields.map(([field, def]) => [field, initialValue(def)])),
  );
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  function setField(field: string, value: FieldValue) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await runDeviceAction(deviceId, { type: action.actionType, payload: values });
      setFeedback({
        ok: result.success,
        message: result.success ? "Enviado" : (result.error ?? "Falhou."),
      });
      if (result.success) onDone?.();
    });
  }

  const h = Number(values.h ?? 0);
  const s = Number(values.s ?? 100);
  const v = Number(values.v ?? 100);

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 px-3 pt-1 pb-3">
      {hsv ? (
        <div className="flex items-center gap-3">
          <span
            className="size-10 shrink-0 rounded-xl border border-white/15 shadow-inner"
            style={{ background: hsvCss(h, s, v) }}
            aria-hidden
          />
          <div className="flex flex-1 flex-col gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-[0.65rem] text-muted-foreground">Matiz · {h}°</span>
              <input
                type="range"
                min={0}
                max={360}
                value={h}
                onChange={(e) => setField("h", Number(e.target.value))}
                className="hue-range h-2 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
                }}
              />
            </label>
          </div>
        </div>
      ) : null}

      {fields
        .filter(([field]) => !(hsv && field === "h"))
        .map(([field, def]) => {
          const type = fieldPrimitiveType(def);
          const detail = typeof def === "string" ? undefined : def;
          const label =
            field === "s" && hsv ? "Saturação" : field === "v" && hsv ? "Brilho" : field;

          if (type === "number" && detail && "min" in detail && detail.max !== undefined) {
            const value = Number(values[field] ?? detail.min ?? 0);
            return (
              <label key={field} className="flex flex-col gap-0.5">
                <span className="flex justify-between text-[0.65rem] text-muted-foreground">
                  <span className="capitalize">{label}</span>
                  <span className="tabular-nums text-foreground/80">
                    {value}
                    {detail.unit ?? ""}
                  </span>
                </span>
                <Slider
                  min={detail.min ?? 0}
                  max={detail.max}
                  step={detail.step ?? 1}
                  value={value}
                  onValueChange={(next) => setField(field, next as number)}
                  disabled={isPending}
                />
              </label>
            );
          }

          if (type === "boolean") {
            return (
              <label key={field} className="flex items-center justify-between text-xs">
                <span className="capitalize text-muted-foreground">{label}</span>
                <Switch
                  checked={Boolean(values[field])}
                  onCheckedChange={(checked) => setField(field, checked)}
                />
              </label>
            );
          }

          if (type === "string" && detail && "options" in detail && detail.options?.length) {
            return (
              <label key={field} className="flex flex-col gap-1">
                <span className="text-[0.65rem] text-muted-foreground capitalize">{label}</span>
                <select
                  value={String(values[field] ?? "")}
                  onChange={(e) => setField(field, e.target.value)}
                  className="field"
                >
                  <option value="">Selecionar…</option>
                  {detail.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          return (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-[0.65rem] text-muted-foreground capitalize">{label}</span>
              <input
                type={type === "number" ? "number" : "text"}
                value={String(values[field] ?? "")}
                onChange={(e) =>
                  setField(field, type === "number" ? Number(e.target.value) : e.target.value)
                }
                className="field"
                placeholder={field === "code" ? "ex.: switch_led" : undefined}
              />
            </label>
          );
        })}

      <div className="flex items-center justify-between gap-2">
        <span
          className={
            feedback?.ok ? "text-[0.7rem] text-emerald-400" : "text-[0.7rem] text-red-400"
          }
        >
          {feedback?.message}
        </span>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-foreground transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : feedback?.ok ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <Send className="size-3.5" />
          )}
          Aplicar
        </button>
      </div>
    </form>
  );
}
