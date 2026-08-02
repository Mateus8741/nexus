import { cookies } from "next/headers";

const CORE_URL = process.env.NEXUS_PLUGIN_HOST_URL ?? "http://localhost:4700";

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(`${CORE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GET ${path} retornou ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getSetupStatus(): Promise<{ needsSetup: boolean }> {
  try {
    const response = await fetch(`${CORE_URL}/setup/status`, { cache: "no-store" });
    if (!response.ok) return { needsSetup: false };
    return (await response.json()) as { needsSetup: boolean };
  } catch {
    return { needsSetup: false };
  }
}

export async function getSessionMe(): Promise<{
  actor?: { type: string; id: string; workspaceId: string; roleKey?: string };
} | null> {
  try {
    return await serverApiFetch("/me");
  } catch {
    return null;
  }
}
