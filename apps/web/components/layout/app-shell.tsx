"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { CommandPalette } from "./command-palette";
import { MobileSidebar } from "./mobile-sidebar";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

const AUTH_PATHS = ["/login", "/setup", "/cadastro", "/conta-criada"];

/** Composição do shell. Páginas de auth, a LP e páginas abertas a visitantes (`bare`) renderizam sem chrome. */
export function AppShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (bare || pathname === "/" || AUTH_PATHS.some((path) => pathname.startsWith(path))) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-svh w-full text-foreground">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((value) => !value)} />
      <MobileSidebar open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <CommandPalette />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
