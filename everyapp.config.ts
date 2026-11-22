import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB, env.files, env.VIDEO_WORKFLOW), never the file.
export default defineEveryApp({
  id: "media-studio",
  name: "Media Studio",
  description:
    "Make images, videos and speech from prompts and keep them in a private library.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    // Generated media and uploaded reference images.
    r2: ["files"],
    // One instance per video: polls the provider until the video is ready.
    workflows: [{ name: "VIDEO_WORKFLOW", className: "VideoWorkflow" }],
  },
  providers: [
    {
      id: "openrouter",
      why: "Generates images from prompts and reference images.",
      docs: "https://openrouter.ai/settings/keys",
    },
    {
      id: "openai",
      why: "Turns text into speech.",
      docs: "https://platform.openai.com/api-keys",
    },
  ],
  ai: {
    // Every model id the code can send (src/shared/options.ts).
    models: [
      "google/gemini-2.5-flash-image",
      "google/gemini-3-pro-image-preview",
      "openai/gpt-5-image-mini",
      "tts-1",
    ],
    routes: ["/v1/audio/speech"],
  },
  capabilities: {
    replicate: {
      access: "read",
      why: "Runs the video models.",
      docs: "https://replicate.com/account/api-tokens",
    },
  },
  // Each generator works on its own; the app opens without any of them.
  features: {
    images: {
      name: "Image generation",
      why: "Makes images from prompts and reference images.",
      steps: [
        "Create an OpenRouter API key: https://openrouter.ai/settings/keys",
      ],
      providers: ["openrouter"],
    },
    speech: {
      name: "Speech",
      why: "Reads text aloud in a choice of voices.",
      steps: ["Create an OpenAI API key: https://platform.openai.com/api-keys"],
      providers: ["openai"],
    },
    video: {
      name: "Video generation",
      why: "Makes short videos from prompts and start images.",
      steps: [
        "Create a Replicate API token: https://replicate.com/account/api-tokens",
      ],
      capabilities: ["replicate"],
    },
  },
});
