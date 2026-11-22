import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as generate from "@/server/generate";
import { getGeneration } from "@/server/generations";
import { UploadError } from "@/server/uploads";
import { rememberUser } from "@/server/users";

type Result = generate.GenerateResult | { off: false; error: string };

async function guarded(work: () => Promise<generate.GenerateResult>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof UploadError) {
      return { off: false, error: error.message } as Result;
    }
    throw error;
  }
}

export const generateImages = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => generate.imageInput.parse(data))
  .handler(async ({ data, context }): Promise<Result> => {
    await rememberUser(context.user);
    return guarded(() => generate.runImageGeneration(context.user.id, data));
  });

export const generateSpeech = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => generate.speechInput.parse(data))
  .handler(async ({ data, context }): Promise<Result> => {
    await rememberUser(context.user);
    return guarded(() => generate.runSpeech(context.user.id, data));
  });

export const generateVideo = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => generate.videoInput.parse(data))
  .handler(async ({ data, context }): Promise<Result> => {
    await rememberUser(context.user);
    return guarded(() => generate.startVideo(context.user, data));
  });

/** One of the member's own generations, for following a video's progress. */
export const getGenerationStatus = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(({ data, context }) => getGeneration(context.user.id, data.id));
