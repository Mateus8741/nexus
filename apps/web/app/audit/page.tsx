"use client";

import { AdminTable } from "@/components/admin/admin-table";

export default function AuditPage() {
  return (
    <AdminTable
      title="Audit Logs"
      queryKey="audit"
      path="/audit?limit=100"
      columns={[
        { key: "recordedAt", label: "When" },
        { key: "action", label: "Action" },
        { key: "actorType", label: "Actor type" },
        { key: "actorId", label: "Actor" },
        { key: "outcome", label: "Outcome" },
        { key: "ip", label: "IP" },
        { key: "metadata", label: "Metadata" },
      ]}
    />
  );
}
