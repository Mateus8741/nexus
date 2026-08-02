import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

interface AdminTableProps<T> {
  readonly title: string;
  readonly queryKey: string;
  readonly path: string;
  readonly columns: readonly { readonly key: string; readonly label: string }[];
  readonly renderActions?: (row: T, reload: () => void) => ReactNode;
}

export function AdminTable<T extends Record<string, unknown>>({
  title,
  queryKey,
  path,
  columns,
  renderActions,
}: AdminTableProps<T>) {
  const query = useQuery({
    queryKey: [queryKey],
    queryFn: () => apiFetch<T[]>(path),
  });

  return (
    <section className="space-y-3 p-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      {query.isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
      {query.error ? (
        <p className="text-sm text-red-400">{(query.error as Error).message}</p>
      ) : null}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium">
                  {col.label}
                </th>
              ))}
              {renderActions ? <th className="px-3 py-2">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row, index) => (
              <tr key={String(row.id ?? index)} className="border-t border-border">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 align-top">
                    {formatCell(row[col.key])}
                  </td>
                ))}
                {renderActions ? (
                  <td className="px-3 py-2">{renderActions(row, () => void query.refetch())}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
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
