import { isDemoClient } from "@/lib/demo/client";
import { demoAdminRows } from "@/lib/demo/data";

const CORE_URL = process.env.NEXT_PUBLIC_NEXUS_CORE_URL ?? "http://localhost:4700";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (isDemoClient()) {
    const key = path.split("?")[0] ?? path;
    if (!init?.method || init.method === "GET") return (demoAdminRows[key] ?? []) as T;
    return {} as T;
  }

  const response = await fetch(`${CORE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export { CORE_URL };
