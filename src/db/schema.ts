import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";

// Placeholder table so drizzle-kit has a valid schema to generate against.
// Real tables are added per-feature, driven by each spec's data model section.
export const _placeholder = pgTable("_placeholder", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
