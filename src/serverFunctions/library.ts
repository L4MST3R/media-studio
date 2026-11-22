import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as generations from "@/server/generations";
import { rememberUser } from "@/server/users";

const idInput = z.object({ id: z.string().min(1) }).strict();

export const listLibrary = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => generations.listInput.parse(data))
  .handler(async ({ data, context }) => {
    await rememberUser(context.user);
    return generations.listGenerations(context.user.id, data);
  });

export const getLibraryItem = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context }) =>
    generations.getGeneration(context.user.id, data.id),
  );

export const deleteLibraryItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const deleted = await generations.deleteGeneration(
      context.user.id,
      data.id,
    );
    if (!deleted) throw new Error("Not found.");
    return { ok: true };
  });
