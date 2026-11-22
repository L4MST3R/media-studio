import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { templates } from "@/db/schema";
import {
  ASPECT_RATIOS,
  TEMPLATE_CATEGORIES,
  VIDEO_DURATIONS,
} from "@/shared/options";

const CATEGORY_IDS = TEMPLATE_CATEGORIES.map((c) => c.id) as [
  string,
  ...string[],
];

const templateSettings = z
  .object({
    aspectRatio: z.enum(ASPECT_RATIOS).optional(),
    duration: z
      .number()
      .refine((n) => (VIDEO_DURATIONS as readonly number[]).includes(n))
      .optional(),
  })
  .strict();

export const templateInput = z
  .object({
    title: z.string().trim().min(1, "Give the template a title").max(120),
    category: z.enum(CATEGORY_IDS),
    kind: z.enum(["image", "video"]),
    prompt: z.string().trim().min(1, "Write the prompt").max(4000),
    settings: templateSettings.default({}),
  })
  .strict();
export const updateTemplateInput = templateInput.extend({
  id: z.string().min(1),
});
export const templateIdInput = z.object({ id: z.string().min(1) }).strict();

export interface Template {
  id: string;
  title: string;
  category: string;
  kind: "image" | "video";
  prompt: string;
  settings: z.infer<typeof templateSettings>;
}

type Row = typeof templates.$inferSelect;
function shown(row: Row): Template {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    kind: row.kind,
    prompt: row.prompt,
    settings: JSON.parse(row.settings) as Template["settings"],
  };
}

// Templates are shared by every member of the organization the app is
// installed for; only admins write them (checked in the server functions).
export async function listTemplates(category?: string): Promise<Template[]> {
  const rows = await db
    .select()
    .from(templates)
    .where(category ? eq(templates.category, category) : undefined)
    .orderBy(asc(templates.category), desc(templates.createdAt));
  return rows.map(shown);
}

export async function getTemplate(id: string): Promise<Template | null> {
  const [row] = await db.select().from(templates).where(eq(templates.id, id));
  return row ? shown(row) : null;
}

export async function createTemplate(
  userId: string,
  input: z.infer<typeof templateInput>,
): Promise<Template> {
  const now = Date.now();
  const [row] = await db
    .insert(templates)
    .values({
      id: crypto.randomUUID(),
      title: input.title,
      category: input.category,
      kind: input.kind,
      prompt: input.prompt,
      settings: JSON.stringify(input.settings),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return shown(row!);
}

export async function updateTemplate({
  id,
  ...input
}: z.infer<typeof updateTemplateInput>): Promise<Template | null> {
  const [row] = await db
    .update(templates)
    .set({
      title: input.title,
      category: input.category,
      kind: input.kind,
      prompt: input.prompt,
      settings: JSON.stringify(input.settings),
      updatedAt: Date.now(),
    })
    .where(eq(templates.id, id))
    .returning();
  return row ? shown(row) : null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const rows = await db
    .delete(templates)
    .where(eq(templates.id, id))
    .returning({ id: templates.id });
  return rows.length > 0;
}
