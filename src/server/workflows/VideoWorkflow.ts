import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { env } from "cloudflare:workers";
import { getGeneration, updateGeneration } from "@/server/generations";
import {
  GenerationError,
  GeneratorOffError,
  getPrediction,
  outputUrl,
} from "@/server/providers";

interface VideoParams {
  generationId: string;
  userId: string;
  organizationId: string;
  predictionId: string;
}

// Polls up to about half an hour: quickly at first, then every 15 seconds.
const MAX_POLLS = 125;
const pause = (attempt: number) =>
  attempt < 5 ? "3 seconds" : ("15 seconds" as const);

const STEP = { retries: { limit: 3, delay: "5 seconds" as const } };

/** One video: waits for the provider, saves the file, records the outcome. */
export class VideoWorkflow extends WorkflowEntrypoint<Env, VideoParams> {
  async run(event: WorkflowEvent<VideoParams>, step: WorkflowStep) {
    const { generationId, userId, organizationId, predictionId } =
      event.payload;
    const fail = (reason: string) =>
      step.do("record failure", async () => {
        await updateGeneration(userId, generationId, {
          status: "failed",
          error: reason,
        });
      });

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const state = await step.do(`check ${attempt}`, STEP, async () => {
        if (!(await getGeneration(userId, generationId))) return { gone: true };
        try {
          const prediction = await getPrediction(predictionId, organizationId);
          if (prediction.status === "processing") {
            await updateGeneration(userId, generationId, {
              status: "processing",
            });
          }
          return {
            status: prediction.status,
            output: outputUrl(prediction.output),
            error: prediction.error ? String(prediction.error) : null,
          };
        } catch (error) {
          if (
            error instanceof GeneratorOffError ||
            error instanceof GenerationError
          ) {
            return { status: "failed", output: null, error: error.message };
          }
          throw error;
        }
      });
      if ("gone" in state) return;
      if (state.status === "succeeded") {
        if (!state.output) return fail("The provider returned no video.");
        const saved = await step.do("save video", STEP, async () => {
          const response = await fetch(state.output!);
          if (!response.ok || !response.body) return false;
          const key = `generations/${generationId}/0.mp4`;
          await env.files.put(key, response.body, {
            httpMetadata: {
              contentType: response.headers.get("content-type") ?? "video/mp4",
            },
          });
          const updated = await updateGeneration(userId, generationId, {
            status: "succeeded",
            error: null,
            assetKeys: [key],
          });
          // Deleted while it ran: drop the file too.
          if (!updated) await env.files.delete(key);
          return true;
        });
        if (!saved) return fail("The video couldn't be downloaded.");
        return;
      }
      if (state.status === "failed" || state.status === "canceled") {
        return fail(state.error ?? "The video model stopped.");
      }
      await step.sleep(`wait ${attempt}`, pause(attempt));
    }
    await fail("The video took too long.");
  }
}
