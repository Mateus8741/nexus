"use client";

import type { DeviceAttributeValue, ResolvedDeviceAction } from "@nexus/domain";
import { fieldPrimitiveType } from "@nexus/domain";
import { Button } from "@nexus/ui/components/button";
import { Slider } from "@nexus/ui/components/slider";
import { Switch } from "@nexus/ui/components/switch";
import { ChevronDown, ChevronRight, Loader2, SlidersHorizontal, Terminal } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { DeviceActionForm, isHsvAction } from "@/components/dashboard/device-action-form";
import { DeviceCommandTerminal } from "@/components/dashboard/device-command-terminal";
import { runDeviceAction } from "@/lib/actions/device-actions";
import { guessPowerState } from "@/lib/devices/view";

interface DeviceControlsProps {
  readonly deviceId: string;
  readonly actions: readonly ResolvedDeviceAction[];
  readonly attributes: Readonly<Record<string, DeviceAttributeValue>>;
  /** Esconde o switch de energia (quando o card já tem o seu). */
  readonly hidePower?: boolean;
  /** Já começa com os detalhes ("Avançado") abertos. */
  readonly defaultOpen?: boolean;
}

interface QuickControl {
  readonly key: string;
  readonly kind: "slider" | "select" | "boolean";
  readonly action: ResolvedDeviceAction;
  readonly field: string;
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly options?: readonly string[];
}

interface Classified {
  readonly power?: {
    readonly turnOn?: ResolvedDeviceAction;
    readonly turnOff?: ResolvedDeviceAction;
    readonly toggle?: ResolvedDeviceAction;
  };
  readonly quick: readonly QuickControl[];
  readonly advanced: readonly ResolvedDeviceAction[];
  readonly commandAction?: ResolvedDeviceAction;
  readonly color?: ResolvedDeviceAction;
}

/**
 * Agrupa a lista plana de ResolvedDeviceAction em controles prontos pra UI:
 * turn_on/turn_off/toggle virem UM switch (não três botões), ações de um
 * campo só com faixa/opções virem slider/select, e o resto (multi-campo,
 * ou marcado `advanced`) cai em "Avançado". Puramente de apresentação —
 * nenhuma decisão aqui é sobre o que o dispositivo PODE fazer.
 */
function classify(actions: readonly ResolvedDeviceAction[]): Classified {
  const power: {
    turnOn?: ResolvedDeviceAction;
    turnOff?: ResolvedDeviceAction;
    toggle?: ResolvedDeviceAction;
  } = {};
  const quick: QuickControl[] = [];
  const advanced: ResolvedDeviceAction[] = [];
  let commandAction: ResolvedDeviceAction | undefined;
  let color: ResolvedDeviceAction | undefined;
  let hasPower = false;

  for (const action of actions) {
    if (action.actionType === "executeCommand") {
      commandAction = action;
      continue;
    }
    if (action.actionType === "turn_on") {
      power.turnOn = action;
      hasPower = true;
      continue;
    }
    if (action.actionType === "turn_off") {
      power.turnOff = action;
      hasPower = true;
      continue;
    }
    if (action.actionType === "toggle") {
      power.toggle = action;
      hasPower = true;
      continue;
    }
    if (isHsvAction(action)) {
      color = action;
      continue;
    }
    if (action.advanced) {
      advanced.push(action);
      continue;
    }

    const fields = Object.entries(action.payloadSchema ?? {});
    if (fields.length === 1) {
      const [field, schema] = fields[0]!;
      const type = fieldPrimitiveType(schema);
      const detail = typeof schema === "string" ? undefined : schema;

      if (
        type === "number" &&
        detail &&
        "min" in detail &&
        detail.min !== undefined &&
        detail.max !== undefined
      ) {
        quick.push({
          key: `${action.capabilityKey}-${action.actionType}`,
          kind: "slider",
          action,
          field,
          label: action.label,
          min: detail.min,
          max: detail.max,
          step: detail.step ?? 1,
          unit: detail.unit,
        });
        continue;
      }
      if (
        type === "string" &&
        detail &&
        "options" in detail &&
        detail.options &&
        detail.options.length > 0
      ) {
        quick.push({
          key: `${action.capabilityKey}-${action.actionType}`,
          kind: "select",
          action,
          field,
          label: action.label,
          options: detail.options,
        });
        continue;
      }
      if (type === "boolean") {
        quick.push({
          key: `${action.capabilityKey}-${action.actionType}`,
          kind: "boolean",
          action,
          field,
          label: action.label,
        });
        continue;
      }
    }

    // Multi-campo (ex.: set-color com h/s/v) ou campo livre sem faixa/opção
    // declarada — não cabe num controle simples, então vira formulário
    // genérico dentro de "Avançado" em vez de poluir a área principal.
    advanced.push(action);
  }

  return { power: hasPower ? power : undefined, quick, advanced, commandAction, color };
}

function prettifyAttributeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function DeviceControls({
  deviceId,
  actions,
  attributes,
  hidePower,
  defaultOpen,
}: DeviceControlsProps) {
  const classified = useMemo(() => classify(actions), [actions]);
  const [isPending, startTransition] = useTransition();
  const [powerOn, setPowerOn] = useState(() => guessPowerState(attributes));
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(defaultOpen));
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [openFormActionType, setOpenFormActionType] = useState<string | null>(null);

  const attributeEntries = Object.entries(attributes);
  const hasAdvancedContent = classified.advanced.length > 0 || Boolean(classified.commandAction);

  function run(action: ResolvedDeviceAction, payload?: Record<string, unknown>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await runDeviceAction(deviceId, { type: action.actionType, payload });
      setFeedback(result.success ? null : (result.error ?? "Falhou."));
    });
  }

  function handlePowerToggle(next: boolean) {
    setPowerOn(next);
    const power = classified.power;
    if (!power) return;
    const directAction = next ? power.turnOn : power.turnOff;
    if (directAction) {
      run(directAction);
    } else if (power.toggle) {
      run(power.toggle);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {classified.power && !hidePower ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">{powerOn ? "Ligado" : "Desligado"}</span>
          <div className="flex items-center gap-2">
            {isPending ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
            <Switch checked={powerOn} onCheckedChange={handlePowerToggle} disabled={isPending} />
          </div>
        </div>
      ) : null}

      {classified.quick.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {classified.quick.map((control) => (
            <div key={control.key} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{control.label}</span>
              {control.kind === "slider" ? (
                <div className="flex items-center gap-2.5">
                  <Slider
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={sliderValues[control.key] ?? control.min ?? 0}
                    onValueChange={(value) =>
                      setSliderValues((current) => ({ ...current, [control.key]: value }))
                    }
                    onValueCommitted={(value) => run(control.action, { [control.field]: value })}
                    disabled={isPending}
                  />
                  <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                    {sliderValues[control.key] ?? control.min ?? 0}
                    {control.unit ?? ""}
                  </span>
                </div>
              ) : control.kind === "select" ? (
                <select
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
                  disabled={isPending}
                  defaultValue=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    run(control.action, { [control.field]: event.target.value });
                  }}
                >
                  <option value="" disabled>
                    Selecionar...
                  </option>
                  {control.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <Switch
                  disabled={isPending}
                  onCheckedChange={(checked) => run(control.action, { [control.field]: checked })}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      {feedback ? <span className="text-xs text-red-500">{feedback}</span> : null}

      {classified.color ? (
        <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] pt-2.5">
          <span className="px-3 text-xs text-muted-foreground">Cor</span>
          <DeviceActionForm deviceId={deviceId} action={classified.color} />
        </div>
      ) : null}

      {hasAdvancedContent || attributeEntries.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="flex-1 text-left">Avançado</span>
            <ChevronDown
              className={`size-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {detailsOpen ? (
            <div className="flex flex-col gap-2 border-t border-white/10 p-2">
              {classified.advanced.map((action) => {
                const open = openFormActionType === action.actionType;
                return (
                  <div
                    key={`${action.capabilityKey}-${action.actionType}`}
                    className="overflow-hidden rounded-lg bg-white/[0.04]"
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenFormActionType(open ? null : action.actionType)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-white/[0.05]"
                    >
                      {action.label}
                      <ChevronRight
                        className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
                      />
                    </button>
                    {open ? (
                      <DeviceActionForm
                        deviceId={deviceId}
                        action={action}
                        onDone={() => setOpenFormActionType(null)}
                      />
                    ) : null}
                  </div>
                );
              })}

              {classified.commandAction ? (
                <div className="overflow-hidden rounded-lg bg-white/[0.04]">
                  <button
                    type="button"
                    aria-expanded={terminalOpen}
                    onClick={() => setTerminalOpen((open) => !open)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-white/[0.05]"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="size-3.5 text-muted-foreground" />
                      {classified.commandAction.label}
                    </span>
                    <ChevronRight
                      className={`size-3.5 text-muted-foreground transition-transform ${terminalOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  {terminalOpen ? (
                    <div className="p-2 pt-0">
                      <DeviceCommandTerminal
                        deviceId={deviceId}
                        onClose={() => setTerminalOpen(false)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {attributeEntries.length > 0 ? (
                <div className="pt-1">
                  <span className="px-1 text-[0.6rem] font-semibold tracking-[0.14em] text-muted-foreground/70 uppercase">
                    Propriedades
                  </span>
                  <dl className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {attributeEntries.map(([key, value]) => (
                      <div key={key} className="min-w-0 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                        <dt className="truncate text-[0.65rem] text-muted-foreground">
                          {prettifyAttributeKey(key)}
                        </dt>
                        <dd className="mt-0.5 font-mono text-[0.72rem] break-all text-foreground/90">
                          {String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {classified.quick.length === 0 && !classified.power && !classified.color && !hasAdvancedContent ? (
        <span className="text-xs text-muted-foreground">Sem ações disponíveis.</span>
      ) : null}
    </div>
  );
}
