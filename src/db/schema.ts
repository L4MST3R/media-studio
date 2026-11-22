import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The app's own record of each member, keyed by the Gateway's user id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

// One run of a generator. Private to its owner (`user_id`).
export const generations = sqliteTable(
  "generations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind", { enum: ["image", "video", "audio"] }).notNull(),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    // The generator's options as JSON (aspect ratio, count, voice, …).
    settings: text("settings").notNull(),
    status: text("status", {
      enum: ["pending", "queued", "processing", "succeeded", "failed"],
    }).notNull(),
    error: text("error"),
    // R2 keys of the results, as a JSON array.
    assetKeys: text("asset_keys").notNull().default("[]"),
    // Upload ids used as reference or start images, as a JSON array.
    inputIds: text("input_ids").notNull().default("[]"),
    predictionId: text("prediction_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("generations_user_created").on(t.userId, t.createdAt)],
);

// An image a member uploaded to guide a generation. Private to its owner.
export const uploads = sqliteTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("uploads_user").on(t.userId)],
);

// Prompt templates, shared by everyone in the organization; admins edit them.
export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  kind: text("kind", { enum: ["image", "video"] }).notNull(),
  prompt: text("prompt").notNull(),
  settings: text("settings").notNull().default("{}"),
  createdBy: text("created_by"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
