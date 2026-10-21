"use client";

import type { CapabilityDefinition, Device, DeviceEvent } from "@nexus/domain";
import {
  Activity,
  AlertCircle,
  Boxes,
  CheckCircle2,
  Cpu,
  Download,
  Lightbulb,
  Power,
  Puzzle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActivityChart } from "@/components/dashboard/activity-chart";
import { ClimateTile } from "@/components/dashboard/climate-tile";
import { ComputerTile } from "@/components/dashboard/computer-tile";
import type { DeviceHandlers } from "@/components/dashboard/device-handlers";
import { DeviceTile } from "@/components/dashboard/device-tile";
import { EventFeed } from "@/components/dashboard/event-feed";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { ProviderOverview } from "@/components/dashboard/provider-overview";
import { SpaceTabs } from "@/components/dashboard/space-tabs";
import { StatsStrip } from "@/components/dashboard/stats-strip";
import { CountUp } from "@/components/motion/count-up";
import { FadeUp, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { Spotlight } from "@/components/motion/spotlight";
import { IsoRoom } from "@/components/scenes/iso-room";
import { SceneBar } from "@/components/scenes/scene-bar";
import { runDeviceAction } from "@/lib/actions/device-actions";
import { getScene, planPower, type SceneId, type SceneStep } from "@/lib/devices/scenes";
import {
  buildCapabilityRegistry,
  buildDeviceViews,
  type DevicePatches,
  type DeviceView,
  powerActionFor,
} from "@/lib/devices/view";
import { mockActivitySeries } from "@/lib/mocks/activity-series";
import type { PluginSummaryDto, ProviderSummaryDto, SpaceDto } from "@/lib/nexus-client";
import { SCENE_EVENT } from "@/lib/ui-events";
import { useClientValue } from "@/lib/use-client-value";

interface DashboardViewProps {
  readonly devices: Device[];
  readonly spaces: SpaceDto[];
  readonly capabilities: CapabilityDefinition[];
  readonly events: DeviceEvent[];
  readonly providers: ProviderSummaryDto[];
  readonly plugins: PluginSummaryDto[];
  readonly demo: boolean;
}

interface Notice {
  readonly id: number;
  readonly text: string;
  readonly ok: boolean;
}

const UNASSIGNED = "none";
const NO_PATCHES: DevicePatches = {};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Painel principal: dono do estado otimista (patches), das cenas e do filtro
 * por ambiente. Server Components fornecem os dados reais; refresh ao vivo
 * a cada 10s (LiveRefresh) e logo após cada ação.
 */
export function DashboardView({
  devices,
  spaces,
  capabilities,
  events,
  providers,
  plugins,
  demo,
}: DashboardViewProps) {
  const router = useRouter();
  const registry = useMemo(() => buildCapabilityRegistry(capabilities), [capabilities]);
  // Patches otimistas valem só para o snapshot de `devices` em que foram feitos:
  // dados novos do servidor são a verdade (no demo, os patches são o único estado).
  const [patchState, setPatchState] = useState<{ source: Device[]; map: DevicePatches }>({
    source: devices,
    map: {},
  });
  const patches = demo || patchState.source === devices ? patchState.map : NO_PATCHES;
  const [scene, setScene] = useState<SceneId | null>(null);
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const hello = useClientValue(greeting, "Olá");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const views = useMemo(
    () => buildDeviceViews(devices, registry, patches),
    [devices, registry, patches],
  );
  const spaceById = useMemo(() => new Map(spaces.map((space) => [space.id, space.name])), [spaces]);
  const spaceLabel = useCallback(
    (device: Device) => (device.spaceId ? (spaceById.get(device.spaceId) ?? "Outros") : undefined),
    [spaceById],
  );
  const deviceName = useCallback(
    (id: string) => devices.find((device) => device.id === id)?.name ?? id,
    [devices],
  );

  const tabs = useMemo(() => {
    const used = new Set(views.map((view) => view.device.spaceId ?? UNASSIGNED));
    const list = spaces
      .filter((space) => used.has(space.id))
      .map((space) => ({ id: space.id, label: space.name }));
    if (used.has(UNASSIGNED) && list.length > 0)
      list.push({ id: UNASSIGNED, label: "Sem ambiente" });
    return [{ id: "all", label: "Tudo" }, ...list];
  }, [views, spaces]);
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "all";

  const scoped = useMemo(
    () =>
      activeTab === "all"
        ? views
        : views.filter((view) => (view.device.spaceId ?? UNASSIGNED) === activeTab),
    [views, activeTab],
  );

  const toast = useCallback(
    (text: string, ok = true) => setNotice({ id: Date.now(), text, ok }),
    [],
  );

  const scheduleRefresh = useCallback(() => {
    if (demo) return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 1500);
  }, [demo, router]);

  const updatePatches = useCallback(
    (update: (draft: Record<string, DevicePatches[string]>) => void) => {
      setPatchState((current) => {
        const draft = { ...(demo || current.source === devices ? current.map : NO_PATCHES) };
        update(draft);
        return { source: devices, map: draft };
      });
    },
    [demo, devices],
  );

  const patchDevice = useCallback(
    (id: string, patch: DevicePatches[string] | null) =>
      updatePatches((draft) => {
        if (patch) draft[id] = { ...draft[id], ...patch };
        else delete draft[id];
      }),
    [updatePatches],
  );

  const send = useCallback(
    async (deviceId: string, type: string, payload?: Record<string, unknown>) => {
      const result = await runDeviceAction(deviceId, { type, payload });
      if (!result.success) toast(result.error ?? "A ação falhou.", false);
      else scheduleRefresh();
      return result.success;
    },
    [scheduleRefresh, toast],
  );

  const handlers: DeviceHandlers = {
    onPower: (view, on) => {
      const type = powerActionFor(view, on);
      if (!type) return;
      setScene(null);
      patchDevice(view.device.id, { on });
      void send(view.device.id, type).then((ok) => {
        if (!ok) patchDevice(view.device.id, { on: !on });
      });
    },
    onTarget: (view, field, actionType, value) => {
      patchDevice(view.device.id, { target: value });
      const timers = targetTimers.current;
      const previous = timers.get(view.device.id);
      if (previous) clearTimeout(previous);
      timers.set(
        view.device.id,
        setTimeout(() => void send(view.device.id, actionType, { [field]: value }), 500),
      );
    },
    onAction: (view, actionType) => {
      void send(view.device.id, actionType).then(
        (ok) => ok && toast(`Comando enviado a ${view.device.name}.`),
      );
    },
  };

  const applySteps = useCallback(
    async (steps: SceneStep[], label: string) => {
      if (steps.length === 0) {
        toast("Nada para mudar — tudo já está assim.");
        return;
      }
      setBusy(true);
      updatePatches((draft) => {
        for (const step of steps)
          if (step.patch) draft[step.deviceId] = { ...draft[step.deviceId], ...step.patch };
      });
      const results = await Promise.all(
        steps.map(async (step, index) => {
          await new Promise((resolve) => setTimeout(resolve, index * 90));
          const ok = await send(step.deviceId, step.actionType);
          if (!ok && step.patch) patchDevice(step.deviceId, { on: !step.patch.on });
          return ok;
        }),
      );
      setBusy(false);
      const failed = results.filter((ok) => !ok).length;
      if (failed === 0)
        toast(`${label} · ${steps.length} ${steps.length === 1 ? "ação" : "ações"}`);
    },
    [patchDevice, send, toast, updatePatches],
  );

  const runScene = useCallback(
    (id: SceneId, scope: readonly DeviceView[]) => {
      const definition = getScene(id);
      setScene(id);
      void applySteps(definition.plan(scope), `Cena ${definition.label}`);
    },
    [applySteps],
  );

  // Command palette → cena (escopo: casa inteira).
  const sceneRef = useRef<(id: SceneId) => void>(() => {});
  useEffect(() => {
    sceneRef.current = (id) => runScene(id, views);
  });
  useEffect(() => {
    const listener = (event: Event) => sceneRef.current((event as CustomEvent<SceneId>).detail);
    window.addEventListener(SCENE_EVENT, listener);
    return () => window.removeEventListener(SCENE_EVENT, listener);
  }, []);

  // ---- métricas ----
  const lights = views.filter((view) => view.category === "light" && view.online);
  const lightsOn = lights.filter((view) => view.isOn).length;
  const computersOnline = views.filter(
    (view) => view.category === "computer" && view.online,
  ).length;
  const acOn = views.some((view) => view.category === "climate" && view.online && view.isOn);
  const online = views.filter((view) => view.online).length;
  const powerable = scoped.filter((view) => view.supportsPower && view.online);
  const poweredOn = powerable.filter((view) => view.isOn).length;
  const sceneDef = scene ? getScene(scene) : null;

  const groups = useMemo(() => {
    if (activeTab !== "all" || tabs.length <= 2)
      return [{ id: activeTab, label: undefined as string | undefined, items: scoped }];
    const order = tabs.slice(1);
    return order
      .map((item) => ({
        id: item.id,
        label: item.label,
        items: scoped.filter((view) => (view.device.spaceId ?? UNASSIGNED) === item.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeTab, scoped, tabs]);

  const statusLine =
    lights.length === 0
      ? "Nenhuma luz conectada"
      : lightsOn === 0
        ? "Nenhuma luz ligada"
        : `${lightsOn} ${lightsOn === 1 ? "luz ligada" : "luzes ligadas"}`;

  return (
    <div className="flex flex-col gap-8">
      <LiveRefresh enabled={!demo} />

      {/* ---------- Hero ---------- */}
      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <FadeUp className="flex flex-col gap-5">
          <div>
            <p className="text-sm text-muted-foreground">{hello} 👋</p>
            <h1 className="text-gradient mt-1 text-4xl font-semibold tracking-tight md:text-5xl">
              Seu ambiente
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm">
              <Lightbulb
                className={lightsOn > 0 ? "size-4 text-amber-300" : "size-4 text-muted-foreground"}
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={statusLine}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {statusLine}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              {online}/{views.length} online
            </span>
            {sceneDef && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glow-ring rounded-full bg-glow/15 px-3.5 py-1.5 text-sm"
              >
                Cena · {sceneDef.label}
              </motion.span>
            )}
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Controle luzes, clima e computadores de todos os seus ambientes num só lugar. Use{" "}
            <kbd className="rounded-md border border-white/10 px-1.5 text-xs">⌘K</kbd> para navegar
            rápido.
          </p>
          {demo && (
            <Link
              href="/?demo=0"
              className="w-fit text-xs text-glow underline-offset-4 hover:underline"
            >
              Modo demonstração ativo · sair
            </Link>
          )}
        </FadeUp>
        <FadeUp delay={0.1}>
          <IsoRoom
            lightsOn={lightsOn}
            lightsTotal={lights.length}
            computersOnline={computersOnline}
            acOn={acOn}
            tint={sceneDef?.tint}
            ambient={sceneDef?.ambient}
          />
        </FadeUp>
      </section>

      <SceneBar active={scene} busy={busy} onSelect={(id) => runScene(id, scoped)} />

      <StatsStrip
        stats={[
          { label: "Online", value: online, icon: Cpu, hint: `de ${views.length} dispositivos` },
          {
            label: "Ligados",
            value: views.filter((v) => v.supportsPower && v.isOn).length,
            icon: Power,
            hint: "luzes, tomadas e clima",
          },
          { label: "Integrações", value: providers.length, icon: Boxes },
          { label: "Plugins", value: plugins.length, icon: Puzzle },
        ]}
      />

      {/* ---------- Dispositivos ---------- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SpaceTabs tabs={tabs} value={activeTab} onChange={setTab} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-medium">
              {activeTab === "all"
                ? "Casa inteira"
                : (tabs.find((t) => t.id === activeTab)?.label ?? "")}
            </span>
            <span className="text-muted-foreground">
              {" · "}
              <CountUp value={poweredOn} /> de {powerable.length} ligados
            </span>
          </div>
          <div className="flex gap-2">
            {(
              [
                ["Ligar tudo", true],
                ["Desligar tudo", false],
              ] as const
            ).map(([label, want]) => (
              <motion.button
                key={label}
                type="button"
                disabled={busy || powerable.length === 0}
                whileTap={{ scale: 0.94 }}
                whileHover={{ y: -1 }}
                onClick={() => {
                  setScene(null);
                  void applySteps(planPower(scoped, want), label);
                }}
                className="glass rounded-full px-4 py-1.5 text-sm outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              >
                {label}
              </motion.button>
            ))}
          </div>
        </div>

        {views.length === 0 ? (
          <Spotlight className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Download className="size-8 text-glow" />
            <h2 className="text-lg font-medium">Nenhum dispositivo conectado ainda</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Instale o Nexus Desktop nos seus computadores ou conecte uma integração (Tuya, LG
              ThinQ) para vê-los aqui.
            </p>
            <Link
              href="/downloads"
              className="mt-1 rounded-full bg-gradient-to-r from-glow to-glow-2 px-5 py-2 text-sm font-medium text-background transition-transform hover:scale-105"
            >
              Baixar o Nexus Desktop
            </Link>
          </Spotlight>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-3">
              {group.label && (
                <h2 className="px-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </h2>
              )}
              <RevealGroup
                key={`${activeTab}-${group.id}`}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {[...group.items]
                  .sort(
                    (a, b) => Number(b.category === "climate") - Number(a.category === "climate"),
                  )
                  .map((view) => (
                    <RevealItem
                      key={view.device.id}
                      className={view.category === "climate" ? "col-span-full" : undefined}
                    >
                      {view.category === "climate" ? (
                        <ClimateTile
                          view={view}
                          patches={patches}
                          spaceName={activeTab === "all" ? undefined : spaceLabel(view.device)}
                          onPower={handlers.onPower}
                          onTarget={handlers.onTarget}
                        />
                      ) : view.category === "computer" ? (
                        <ComputerTile
                          view={view}
                          spaceName={activeTab === "all" ? undefined : spaceLabel(view.device)}
                          onAction={handlers.onAction}
                        />
                      ) : (
                        <DeviceTile
                          view={view}
                          spaceName={activeTab === "all" ? undefined : spaceLabel(view.device)}
                          onPower={handlers.onPower}
                        />
                      )}
                    </RevealItem>
                  ))}
              </RevealGroup>
            </div>
          ))
        )}
      </section>

      {/* ---------- Atividade ---------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Spotlight className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4 text-glow" /> Atividade (24h)
            </h2>
            <span className="text-xs text-muted-foreground">eventos por hora</span>
          </div>
          <ActivityChart data={mockActivitySeries} />
        </Spotlight>
        <Spotlight className="p-5">
          <h2 className="mb-4 text-sm font-medium">Integrações</h2>
          <ProviderOverview providers={providers} devices={devices} />
        </Spotlight>
      </section>

      <Spotlight className="p-5">
        <h2 className="mb-3 text-sm font-medium">Atividade recente</h2>
        <EventFeed events={events} deviceName={deviceName} />
      </Spotlight>

      {/* ---------- Toast ---------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <AnimatePresence>
          {notice && (
            <motion.div
              key={notice.id}
              role="status"
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="glass glow-ring pointer-events-auto flex items-center gap-2.5 rounded-full px-5 py-3 text-sm"
            >
              {notice.ok ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <AlertCircle className="size-4 text-destructive" />
              )}
              {notice.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
