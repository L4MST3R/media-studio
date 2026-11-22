import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  ASPECT_RATIOS,
  IMAGE_MODEL_IDS,
  MAX_IMAGE_COUNT,
  MAX_REFERENCES,
  MAX_SPEECH_CHARS,
  SPEECH_MODEL,
  SPEEDS,
  VIDEO_DURATIONS,
  VIDEO_MODEL_IDS,
  VIDEO_RESOLUTIONS,
  VOICES,
} from "@/shared/options";
import { extensionFor } from "@/server/bytes";
import {
  createGeneration,
  discardGeneration,
  updateGeneration,
  type Generation,
} from "@/server/generations";
import {
  GenerationError,
  GeneratorOffError,
  generateImage,
  generateSpeech,
  startPrediction,
} from "@/server/providers";
import { ownUploads, uploadDataUrl } from "@/server/uploads";

const prompt = z.string().trim().min(1, "Write a prompt").max(4000);

export const imageInput = z
  .object({
    prompt,
    model: z.enum(IMAGE_MODEL_IDS),
    aspectRatio: z.enum(ASPECT_RATIOS),
    count: z.number().int().min(1).max(MAX_IMAGE_COUNT),
    referenceIds: z.array(z.string().uuid()).max(MAX_REFERENCES).default([]),
  })
  .strict();

export const speechInput = z
  .object({
    text: z.string().trim().min(1, "Write some text").max(MAX_SPEECH_CHARS),
    voice: z.enum(VOICES),
    speed: z
      .number()
      .refine((n) => (SPEEDS as readonly number[]).includes(n), "Pick a speed"),
  })
  .strict();

export const videoInput = z
  .object({
    prompt,
    model: z.enum(VIDEO_MODEL_IDS),
    duration: z
      .number()
      .refine((n) => (VIDEO_DURATIONS as readonly number[]).includes(n)),
    aspectRatio: z.enum(ASPECT_RATIOS),
    resolution: z.enum(VIDEO_RESOLUTIONS),
    startImageId: z.string().uuid().nullable().default(null),
  })
  .strict();

export type GenerateResult =
  | { off: false; generation: Generation }
  | { off: true; setup: string | null };

/** Records a failure on the generation and returns it. */
async function failed(
  userId: string,
  generation: Generation,
  error: unknown,
  assetKeys?: string[],
): Promise<GenerateResult> {
  const message =
    error instanceof GenerationError
      ? error.message
      : "Something went wrong while generating.";
  if (!(error instanceof GenerationError)) console.error(error);
  const updated = await updateGeneration(userId, generation.id, {
    status: "failed",
    error: message,
    ...(assetKeys ? { assetKeys } : {}),
  });
  return { off: false, generation: updated ?? generation };
}

async function offOrFailed(
  userId: string,
  generation: Generation,
  error: unknown,
  assetKeys: string[] = [],
): Promise<GenerateResult> {
  if (error instanceof GeneratorOffError && assetKeys.length === 0) {
    await discardGeneration(userId, generation.id);
    return { off: true, setup: error.setup };
  }
  return failed(userId, generation, error, assetKeys);
}

export async function runImageGeneration(
  userId: string,
  input: z.infer<typeof imageInput>,
): Promise<GenerateResult> {
  const references = await ownUploads(userId, input.referenceIds);
  const generation = await createGeneration(userId, {
    kind: "image",
    prompt: input.prompt,
    model: input.model,
    settings: { aspectRatio: input.aspectRatio, count: input.count },
    status: "pending",
    inputIds: input.referenceIds,
  });
  const keys: string[] = [];
  try {
    const dataUrls = await Promise.all(references.map(uploadDataUrl));
    for (let i = 0; i < input.count; i++) {
      const image = await generateImage({
        model: input.model,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        references: dataUrls,
      });
      const key = `generations/${generation.id}/${i}.${extensionFor(image.contentType)}`;
      await env.files.put(key, image.bytes, {
        httpMetadata: { contentType: image.contentType },
      });
      keys.push(key);
    }
  } catch (error) {
    return offOrFailed(userId, generation, error, keys);
  }
  const done = await updateGeneration(userId, generation.id, {
    status: "succeeded",
    assetKeys: keys,
  });
  return { off: false, generation: done ?? generation };
}

export async function runSpeech(
  userId: string,
  input: z.infer<typeof speechInput>,
): Promise<GenerateResult> {
  const generation = await createGeneration(userId, {
    kind: "audio",
    prompt: input.text,
    model: SPEECH_MODEL,
    settings: { voice: input.voice, speed: input.speed },
    status: "pending",
  });
  try {
    const audio = await generateSpeech({ model: SPEECH_MODEL, ...input });
    const key = `generations/${generation.id}/0.mp3`;
    await env.files.put(key, audio, {
      httpMetadata: { contentType: "audio/mpeg" },
    });
    const done = await updateGeneration(userId, generation.id, {
      status: "succeeded",
      assetKeys: [key],
    });
    return { off: false, generation: done ?? generation };
  } catch (error) {
    return offOrFailed(userId, generation, error);
  }
}

/** The model's own input names for the shared video settings. */
function videoModelInput(
  input: z.infer<typeof videoInput>,
  startImage: string | null,
): Record<string, unknown> {
  return {
    prompt: input.prompt,
    duration: input.duration,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    ...(startImage ? { image: startImage } : {}),
  };
}

export async function startVideo(
  user: { id: string; orgId: string },
  input: z.infer<typeof videoInput>,
): Promise<GenerateResult> {
  const startIds = input.startImageId ? [input.startImageId] : [];
  const [start] = await ownUploads(user.id, startIds);
  const generation = await createGeneration(user.id, {
    kind: "video",
    prompt: input.prompt,
    model: input.model,
    settings: {
      duration: input.duration,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
    },
    status: "queued",
    inputIds: startIds,
  });
  try {
    const startImage = start ? await uploadDataUrl(start) : null;
    const prediction = await startPrediction(
      input.model,
      videoModelInput(input, startImage),
    );
    const queued = await updateGeneration(user.id, generation.id, {
      predictionId: prediction.id,
    });
    await env.VIDEO_WORKFLOW.create({
      id: generation.id,
      params: {
        generationId: generation.id,
        userId: user.id,
        organizationId: user.orgId,
        predictionId: prediction.id,
      },
    });
    return { off: false, generation: queued ?? generation };
  } catch (error) {
    return offOrFailed(user.id, generation, error);
  }
}
