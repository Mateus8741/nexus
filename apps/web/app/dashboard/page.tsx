import { DashboardView } from "@/components/dashboard/dashboard-view";
import { isDemoMode } from "@/lib/demo/mode";
import {
  fetchCapabilities,
  fetchDevices,
  fetchEvents,
  fetchPlugins,
  fetchProviders,
  fetchSpaces,
} from "@/lib/nexus-client";

/**
 * Dashboard — Server Component assíncrono que busca dados reais do
 * plugin-host (ou fixtures, em modo demo) e entrega ao DashboardView, que
 * cuida de interação, cenas e animação. Se o Core estiver offline o client
 * devolve listas vazias — a página nunca quebra.
 */
export default async function Home() {
  const [devices, events, plugins, providers, capabilities, spaces, demo] = await Promise.all([
    fetchDevices(),
    fetchEvents(),
    fetchPlugins(),
    fetchProviders(),
    fetchCapabilities(),
    fetchSpaces(),
    isDemoMode(),
  ]);

  return (
    <DashboardView
      devices={devices}
      events={events}
      plugins={plugins}
      providers={providers}
      capabilities={capabilities}
      spaces={spaces}
      demo={demo}
    />
  );
}
