import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { KINDS, STATUSES, type Kind, type Status } from "@/shared/options";
import { uploadUrl } from "@/server/uploads";

type Row = typeof generations.$inferSelect;

export type Settings = Record<string, string | number>;

export interface Generation {
  id: string;
  kind: Kind;
  prompt: string;
  model: string;
  settings: Settings;
  status: Status;
  error: string | null;
  assets: string[];
  inputs: string[];
  createdAt: number;
}

function mediaUrl(id: string, index: number): string {
  return `/media/${id}/${index}`;
}

function shown(row: Row): Generation {
  const keys = JSON.parse(row.assetKeys) as string[];
  const inputs = JSON.parse(row.inputIds) as string[];
  return {
    id: row.id,
    kind: row.kind,
    prompt: row.prompt,
    model: row.model,
    settings: JSON.parse(row.settings) as Settings,
    status: row.status,
    error: row.error,
    assets: keys.map((_, index) => mediaUrl(row.id, index)),
    inputs: inputs.map(uploadUrl),
    createdAt: row.createdAt,
  };
}

export async function createGeneration(
  userId: string,
  input: {
    kind: Kind;
    prompt: string;
    model: string;
    settings: Settings;
    status: Status;
    inputIds?: string[];
  },
): Promise<Generation> {
  const now = Date.now();
  const [row] = await db
    .insert(generations)
    .values({
      id: crypto.randomUUID(),
      userId,
      kind: input.kind,
      prompt: input.prompt,
      model: input.model,
      settings: JSON.stringify(input.settings),
      status: input.status,
      inputIds: JSON.stringify(input.inputIds ?? []),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return shown(row!);
}

/** Changes the member's own generation; null when it's gone. */
export async function updateGeneration(
  userId: string,
  id: string,
  change: {
    status?: Status;
    error?: string | null;
    assetKeys?: string[];
    predictionId?: string;
  },
): Promise<Generation | null> {
  const { assetKeys, ...rest } = change;
  const [row] = await db
    .update(generations)
    .set({
      ...rest,
      ...(assetKeys ? { assetKeys: JSON.stringify(assetKeys) } : {}),
      updatedAt: Date.now(),
    })
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .returning();
  return row ? shown(row) : null;
}

/** Removes a generation that never started (the generator was off). */
export async function discardGeneration(userId: string, id: string) {
  await db
    .delete(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)));
}

export async function getGeneration(
  userId: string,
  id: string,
): Promise<Generation | null> {
  const [row] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)));
  return row ? shown(row) : null;
}

/** The R2 key of one of the member's own results, or null. */
export async function assetKey(
  userId: string,
  id: string,
  index: number,
): Promise<string | null> {
  const [row] = await db
    .select({ assetKeys: generations.assetKeys })
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)));
  if (!row) return null;
  return (JSON.parse(row.assetKeys) as string[])[index] ?? null;
}

const PAGE_SIZE = 12;

export const listInput = z
  .object({
    kind: z.enum(KINDS).optional(),
    status: z.enum(STATUSES).optional(),
    page: z.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export async function listGenerations(
  userId: string,
  { kind, status, page }: z.infer<typeof listInput>,
) {
  const filters: SQL[] = [eq(generations.userId, userId)];
  if (kind) filters.push(eq(generations.kind, kind));
  if (status) filters.push(eq(generations.status, status));
  const where = and(...filters);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(generations)
      .where(where)
      .orderBy(desc(generations.createdAt), desc(generations.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(generations).where(where),
  ]);
  const n = total?.n ?? 0;
  return {
    items: rows.map(shown),
    total: n,
    page,
    pageCount: Math.max(1, Math.ceil(n / PAGE_SIZE)),
  };
}

/** Deletes the member's own generation and its files; false when not theirs. */
export async function deleteGeneration(
  userId: string,
  id: string,
): Promise<boolean> {
  const [row] = await db
    .delete(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, userId)))
    .returning({ assetKeys: generations.assetKeys });
  if (!row) return false;
  const keys = JSON.parse(row.assetKeys) as string[];
  if (keys.length > 0) await env.files.delete(keys);
  return true;
}
