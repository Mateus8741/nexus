import { createNexusAuthClient } from "@nexus/auth/client";

const baseURL = process.env.NEXT_PUBLIC_NEXUS_CORE_URL ?? "http://localhost:4700";

export const authClient = createNexusAuthClient(baseURL);
