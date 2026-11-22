import {
  aiBaseUrl,
  createGatewayFetch,
  gatewayRefusal,
  integrationFetch,
  refusalFromError,
  type GatewayCallFor,
} from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { parseDataUrl } from "@/server/bytes";
import type { AspectRatio } from "@/shared/options";

/** The generator can't run because its key isn't set on the Gateway. */
export class GeneratorOffError extends Error {
  constructor(readonly setup: string | null) {
    super(setup ?? "Not set up.");
  }
}

/** A failure to show the member, in a sentence. */
export class GenerationError extends Error {}

function offOr(error: unknown): never {
  const refusal = refusalFromError(error);
  if (refusal?.code.endsWith("_not_configured")) {
    throw new GeneratorOffError(refusal.setup);
  }
  if (error instanceof GenerationError) throw error;
  throw new GenerationError(
    error instanceof Error ? error.message : "The request failed.",
  );
}

/** Throws the Gateway's refusal or the provider's error for a failed answer. */
async function ensureOk(response: Response): Promise<Response> {
  if (response.ok) return response;
  const refusal = await gatewayRefusal(response.clone());
  if (refusal) {
    if (refusal.code.endsWith("_not_configured")) {
      throw new GeneratorOffError(refusal.setup);
    }
    throw new GenerationError(refusal.message);
  }
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string } | string;
    detail?: string;
  } | null;
  const message =
    (typeof body?.error === "string" ? body.error : body?.error?.message) ??
    body?.detail ??
    `The provider answered ${response.status}.`;
  throw new GenerationError(message);
}

function aiFetch(): typeof fetch {
  try {
    return createGatewayFetch({ env });
  } catch (error) {
    offOr(error);
  }
}

/** One image from an image-capable chat model, with optional reference images. */
export async function generateImage(input: {
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  references: string[];
}): Promise<{ contentType: string; bytes: Uint8Array }> {
  const content = [
    { type: "text", text: input.prompt },
    ...input.references.map((url) => ({
      type: "image_url",
      image_url: { url },
    })),
  ];
  let response: Response;
  try {
    response = await aiFetch()(`${aiBaseUrl("openrouter")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: input.model,
        modalities: ["image", "text"],
        image_config: { aspect_ratio: input.aspectRatio },
        messages: [{ role: "user", content }],
      }),
    });
  } catch (error) {
    offOr(error);
  }
  await ensureOk(response);
  const body = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        images?: { image_url?: { url?: string } }[];
      };
    }[];
  };
  const message = body.choices?.[0]?.message;
  const url = message?.images?.[0]?.image_url?.url;
  const image = url ? parseDataUrl(url) : null;
  if (!image) {
    throw new GenerationError(
      message?.content?.trim() || "The model returned no image.",
    );
  }
  return image;
}

/** Speech for `text` as MP3 bytes. */
export async function generateSpeech(input: {
  model: string;
  text: string;
  voice: string;
  speed: number;
}): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await aiFetch()(`${aiBaseUrl("openai")}/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: input.model,
        input: input.text,
        voice: input.voice,
        speed: input.speed,
        response_format: "mp3",
      }),
    });
  } catch (error) {
    offOr(error);
  }
  await ensureOk(response);
  return new Uint8Array(await response.arrayBuffer());
}

const REPLICATE = "https://api.replicate.com/v1";

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error: unknown;
}

function replicate(target?: GatewayCallFor): typeof fetch {
  try {
    return integrationFetch({
      env,
      provider: "replicate",
      ...(target ? { for: target } : {}),
    });
  } catch (error) {
    offOr(error);
  }
}

/** Starts a video prediction on Replicate. */
export async function startPrediction(
  model: string,
  input: Record<string, unknown>,
): Promise<Prediction> {
  let response: Response;
  try {
    response = await replicate()(`${REPLICATE}/models/${model}/predictions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
    });
  } catch (error) {
    offOr(error);
  }
  await ensureOk(response);
  return (await response.json()) as Prediction;
}

/** Where a prediction is now. Runs in the background, for the organization. */
export async function getPrediction(
  id: string,
  organizationId: string,
): Promise<Prediction> {
  let response: Response;
  try {
    response = await replicate({ background: true, organizationId })(
      `${REPLICATE}/predictions/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    offOr(error);
  }
  await ensureOk(response);
  return (await response.json()) as Prediction;
}

/** The first output URL of a finished prediction. */
export function outputUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  return null;
}
