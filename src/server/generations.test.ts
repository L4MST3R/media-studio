import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// An in-memory SQLite with the app's migrations stands in for D1, and a Map
// for the R2 bucket.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
const bucket = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));
vi.mock("cloudflare:workers", () => ({
  env: {
    files: {
      delete: async (keys: string[]) => keys.forEach((k) => bucket.delete(k)),
    },
  },
}));

const generations = await import("./generations");
const templates = await import("./templates");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

const base = {
  prompt: "A teapot",
  model: "m",
  settings: { aspectRatio: "1:1", count: 1 },
};

describe("generations", () => {
  it("belong to the member who made them", async () => {
    const mine = await generations.createGeneration("alice", {
      ...base,
      kind: "image",
      status: "pending",
    });
    await generations.updateGeneration("alice", mine.id, {
      status: "succeeded",
      assetKeys: [`generations/${mine.id}/0.png`],
    });
    bucket.set(`generations/${mine.id}/0.png`, "bytes");
    await generations.createGeneration("bob", {
      ...base,
      kind: "audio",
      status: "pending",
    });

    const list = await generations.listGenerations("alice", { page: 1 });
    expect(list.items.map((g) => g.id)).toEqual([mine.id]);
    expect(list.items[0]!.assets).toEqual([`/media/${mine.id}/0`]);
    expect(await generations.getGeneration("bob", mine.id)).toBeNull();
    expect(await generations.assetKey("bob", mine.id, 0)).toBeNull();
    expect(
      await generations.updateGeneration("bob", mine.id, { status: "failed" }),
    ).toBeNull();
    expect(await generations.deleteGeneration("bob", mine.id)).toBe(false);
    expect(bucket.size).toBe(1);

    expect(await generations.deleteGeneration("alice", mine.id)).toBe(true);
    expect(bucket.size).toBe(0);
    expect(await generations.getGeneration("alice", mine.id)).toBeNull();
  });

  it("filter by kind and status, newest first, a page at a time", async () => {
    for (let i = 0; i < 14; i++) {
      await generations.createGeneration("carol", {
        ...base,
        prompt: `p${i}`,
        kind: i % 2 ? "video" : "image",
        status: i === 3 ? "failed" : "succeeded",
      });
      await new Promise((r) => setTimeout(r, 2));
    }
    const first = await generations.listGenerations("carol", { page: 1 });
    expect(first.total).toBe(14);
    expect(first.pageCount).toBe(2);
    expect(first.items[0]!.prompt).toBe("p13");
    const second = await generations.listGenerations("carol", { page: 2 });
    expect(second.items).toHaveLength(2);
    const videos = await generations.listGenerations("carol", {
      page: 1,
      kind: "video",
    });
    expect(videos.total).toBe(7);
    const failed = await generations.listGenerations("carol", {
      page: 1,
      status: "failed",
    });
    expect(failed.items.map((g) => g.prompt)).toEqual(["p3"]);
  });
});

describe("templates", () => {
  it("are seeded and filter by category", async () => {
    const all = await templates.listTemplates();
    expect(all.length).toBeGreaterThan(5);
    const fashion = await templates.listTemplates("fashion");
    expect(fashion.length).toBeGreaterThan(0);
    expect(fashion.every((t) => t.category === "fashion")).toBe(true);
  });

  it("can be created, edited and deleted", async () => {
    const made = await templates.createTemplate("admin", {
      title: "Menu photo",
      category: "business",
      kind: "image",
      prompt: "A {dish} on a plate",
      settings: { aspectRatio: "4:3" },
    });
    const edited = await templates.updateTemplate({
      id: made.id,
      title: "Menu photo",
      category: "business",
      kind: "image",
      prompt: "A {dish} on a slate plate",
      settings: {},
    });
    expect(edited?.prompt).toBe("A {dish} on a slate plate");
    expect(await templates.deleteTemplate(made.id)).toBe(true);
    expect(await templates.getTemplate(made.id)).toBeNull();
  });
});
