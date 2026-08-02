import { bigserial, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { devices, workspaces } from "./platform";

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    actorType: text("actor_type"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    deviceId: text("device_id").references(() => devices.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("events_occurred_at_idx").on(table.occurredAt),
    index("events_type_idx").on(table.type),
    index("events_workspace_idx").on(table.workspaceId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    action: text("action").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    outcome: text("outcome").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
  },
  (table) => [
    index("audit_logs_recorded_at_idx").on(table.recordedAt),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_workspace_idx").on(table.workspaceId),
  ],
);

export const notificationHistory = pgTable(
  "notification_history",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    channel: text("channel").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull(),
  },
  (table) => [index("notification_history_created_at_idx").on(table.createdAt)],
);

export const settings = pgTable(
  "settings",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.key] })],
);
