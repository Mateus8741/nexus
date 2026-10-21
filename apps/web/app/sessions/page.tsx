"use client";

import { LogOut } from "lucide-react";

import { AdminTable } from "@/components/admin/admin-table";
import { ActionButton } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";

export default function SessionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ActionButton
          variant="ghost"
          onClick={() => void authClient.signOut().then(() => (window.location.href = "/login"))}
        >
          <LogOut className="size-4" /> Sair
        </ActionButton>
      </div>
      <AdminTable
        title="Sessões"
        description="Onde sua conta está conectada agora."
        queryKey="sessions"
        path="/sessions"
        columns={[
          { key: "id", label: "Sessão" },
          { key: "expiresAt", label: "Expira" },
          { key: "ipAddress", label: "IP" },
          { key: "userAgent", label: "Navegador" },
        ]}
      />
    </div>
  );
}
