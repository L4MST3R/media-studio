import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as templates from "@/server/templates";

function requireAdmin(user: Parameters<typeof isAdmin>[0]) {
  if (!isAdmin(user)) throw new Error("Only admins can change templates.");
}

export const listTemplates = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z.object({ category: z.string().optional() }).strict().parse(data),
  )
  .handler(async ({ data, context }) => ({
    templates: await templates.listTemplates(data.category),
    canEdit: isAdmin(context.user),
  }));

export const getTemplate = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.templateIdInput.parse(data))
  .handler(async ({ data, context }) => ({
    template: await templates.getTemplate(data.id),
    canEdit: isAdmin(context.user),
  }));

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.templateInput.parse(data))
  .handler(({ data, context }) => {
    requireAdmin(context.user);
    return templates.createTemplate(context.user.id, data);
  });

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.updateTemplateInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    const updated = await templates.updateTemplate(data);
    if (!updated) throw new Error("Not found.");
    return updated;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => templates.templateIdInput.parse(data))
  .handler(async ({ data, context }) => {
    requireAdmin(context.user);
    if (!(await templates.deleteTemplate(data.id)))
      throw new Error("Not found.");
    return { ok: true };
  });
