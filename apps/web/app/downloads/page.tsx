import { headers } from "next/headers";

import { DownloadsView } from "@/components/downloads/downloads-view";

export const metadata = { title: "Downloads · Nexus" };

export default async function DownloadsPage() {
  const guest = (await headers()).get("x-nexus-bare") === "1";
  return <DownloadsView guest={guest} />;
}
