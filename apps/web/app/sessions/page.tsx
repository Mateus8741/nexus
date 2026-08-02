"use client";

import { AdminTable } from "@/components/admin/admin-table";
import { authClient } from "@/lib/auth-client";

export default function SessionsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Sessions</h1>
        <button
          type="button"
          className="rounded border border-border px-3 py-1.5 text-sm"
          onClick={() => void authClient.signOut().then(() => (window.location.href = "/login"))}
        >
          Logout
        </button>
      </div>
      <AdminTable
        title="Current session"
        queryKey="sessions"
        path="/sessions"
        columns={[
          { key: "id", label: "Session ID" },
          { key: "expiresAt", label: "Expires" },
          { key: "ipAddress", label: "IP" },
          { key: "userAgent", label: "User agent" },
        ]}
      />
    </div>
  );
}
