"use client";

import { cn } from "@nexus/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Spotlight } from "@/components/motion/spotlight";
import { PageHeader } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";

interface AdminTableProps<T> {
  readonly title: string;
  readonly description?: string;
  readonly queryKey: string;
  readonly path: string;
  readonly columns: readonly { readonly key: string; readonly label: string }[];
  readonly renderActions?: (row: T, reload: () => void) => ReactNode;
  /** Esconde o cabeçalho de página (quando a página já renderiza o seu). */
  readonly bare?: boolean;
}

const GOOD = new Set(["approved", "success", "active", "online", "true"]);
const BAD = new Set(["revoked", "denied", "failure", "failed", "rejected"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

function Pill({ value }: { value: string }) {
  const tone = GOOD.has(value)
    ? "bg-emerald-400/15 text-emerald-300"
    : BAD.has(value)
      ? "bg-red-400/15 text-red-300"
      : "bg-white/10 text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{value}</span>
  );
}

function Cell({ column, value }: { column: string; value: unknown }) {
  if (value == null || value === "") return <span className="text-muted-foreground/50">—</span>;
  if (typeof value === "boolean") return <Pill value={String(value)} />;
  if (typeof value === "string") {
    if (/^(status|outcome)$/i.test(column)) return <Pill value={value} />;
    if (ISO_DATE.test(value)) {
      const date = new Date(value);
      return (
        <time dateTime={value} className="whitespace-nowrap text-muted-foreground">
          {date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </time>
      );
    }
    if (/id$|prefix|key$/i.test(column))
      return <code className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-xs">{value}</code>;
    return <span>{value}</span>;
  }
  if (typeof value === "number") return <span className="tabular-nums">{value}</span>;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return (
      <span className="flex max-w-xs flex-wrap gap-1">
        {value.slice(0, 6).map((item) => (
          <span key={item} className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[0.65rem]">
            {item}
          </span>
        ))}
        {value.length > 6 && (
          <span className="text-xs text-muted-foreground">+{value.length - 6}</span>
        )}
      </span>
    );
  }
  return (
    <code className="block max-w-xs truncate font-mono text-xs text-muted-foreground">
      {JSON.stringify(value)}
    </code>
  );
}

export function AdminTable<T extends Record<string, unknown>>({
  title,
  description,
  queryKey,
  path,
  columns,
  renderActions,
  bare,
}: AdminTableProps<T>) {
  const query = useQuery({
    queryKey: [queryKey],
    queryFn: () => apiFetch<T[]>(path),
  });
  const rows = query.data ?? [];

  return (
    <section className="flex flex-col gap-5">
      {!bare && (
        <PageHeader title={title} description={description}>
          <button
            type="button"
            onClick={() => void query.refetch()}
            aria-label="Atualizar"
            className="glass rounded-xl p-2.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} />
          </button>
        </PageHeader>
      )}

      <Spotlight className="overflow-hidden p-0">
        {query.error ? (
          <div className="flex items-center gap-3 p-6 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {(query.error as Error).message}
          </div>
        ) : query.isLoading ? (
          <div className="flex flex-col gap-3 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-9 rounded-lg" style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-sm text-muted-foreground">
            <Inbox className="size-7 opacity-60" />
            Nada por aqui ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {columns.map((col) => (
                    <th key={col.key} className="px-5 py-3.5 font-medium">
                      {col.label}
                    </th>
                  ))}
                  {renderActions ? (
                    <th className="px-5 py-3.5 text-right font-medium">Ações</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <motion.tr
                    key={String(row.id ?? index)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: index * 0.04,
                      type: "spring",
                      stiffness: 280,
                      damping: 26,
                    }}
                    className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.04]"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-3.5 align-middle">
                        <Cell column={col.key} value={row[col.key]} />
                      </td>
                    ))}
                    {renderActions ? (
                      <td className="px-5 py-3.5 text-right">
                        {renderActions(row, () => void query.refetch())}
                      </td>
                    ) : null}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Spotlight>
    </section>
  );
}

export function useApiMutation(path: string, method: "POST" | "DELETE" = "POST") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body?: unknown) =>
      apiFetch(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => client.invalidateQueries(),
  });
}
