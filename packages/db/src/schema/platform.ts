import {
  boolean,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spaces = pgTable(
  "spaces",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("spaces_workspace_name_idx").on(table.workspaceId, table.name)],
);

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
});

export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    system: boolean("system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("roles_workspace_key_idx").on(table.workspaceId, table.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })],
);

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("memberships_workspace_user_idx").on(table.workspaceId, table.userId)],
);

export const devices = pgTable(
  "devices",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    spaceId: text("space_id").references(() => spaces.id, { onDelete: "set null" }),
    providerId: text("provider_id").notNull(),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    /**
     * Espelha `DeviceCapability[]` de @nexus/domain (`{ key, actions? }`) —
     * não redeclarado aqui como import porque @nexus/db não depende de
     * @nexus/domain (regra de camadas, ver ARCHITECTURE.md). Histórico: até
     * aqui essa coluna guardava só `string[]` (as keys), o que perdia
     * `actions` a cada hidratação — ver rowToDevice() em
     * postgres-device-repository.ts, que lida com linhas antigas nesse
     * formato antigo por compatibilidade.
     */
    capabilities: jsonb("capabilities")
      .$type<Array<{ key: string; actions?: string[] }>>()
      .notNull()
      .default([]),
    state: jsonb("state").$type<Record<string, unknown>>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("devices_provider_external_idx").on(table.providerId, table.externalId)],
);

export const agentRegistrations = pgTable(
  "agent_registrations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull().unique(),
    status: text("status").notNull(), // pending | approved | revoked
    tokenHash: text("token_hash"),
    previousTokenHash: text("previous_token_hash"),
    previousTokenExpiresAt: timestamp("previous_token_expires_at", { withTimezone: true }),
    publicKey: text("public_key"),
    lastIp: text("last_ip"),
    version: text("version"),
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
    providerHint: text("provider_hint"),
    name: text("name"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("agent_registrations_agent_id_idx").on(table.agentId)],
);

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plugins = pgTable(
  "plugins",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pluginKey: text("plugin_key").notNull(),
    version: text("version").notNull(),
    status: text("status").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("plugins_workspace_key_idx").on(table.workspaceId, table.pluginKey)],
);

export const capabilities = pgTable("capabilities", {
  key: text("key").primaryKey(),
  definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
  ownerPluginKey: text("owner_plugin_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
