// The fixed choices each generator offers. Shared by pages and server code;
// every model id here is listed under `ai.models` in everyapp.config.ts.

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const IMAGE_MODELS = [
  { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image" },
  { id: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini" },
] as const;
export const IMAGE_MODEL_IDS = IMAGE_MODELS.map((m) => m.id) as [
  string,
  ...string[],
];
export const MAX_IMAGE_COUNT = 4;
export const MAX_REFERENCES = 3;

export const VIDEO_MODELS = [
  { id: "bytedance/seedance-1-lite", label: "Seedance 1 Lite" },
  { id: "bytedance/seedance-1-pro", label: "Seedance 1 Pro" },
] as const;
export const VIDEO_MODEL_IDS = VIDEO_MODELS.map((m) => m.id) as [
  string,
  ...string[],
];
export const VIDEO_DURATIONS = [5, 10] as const;
export const VIDEO_RESOLUTIONS = ["720p", "1080p"] as const;

export const SPEECH_MODEL = "tts-1";
export const VOICES = [
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;
export const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
export const MAX_SPEECH_CHARS = 4000;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const KINDS = ["image", "video", "audio"] as const;
export type Kind = (typeof KINDS)[number];
export const STATUSES = [
  "pending",
  "queued",
  "processing",
  "succeeded",
  "failed",
] as const;
export type Status = (typeof STATUSES)[number];

export const TEMPLATE_CATEGORIES = [
  { id: "e-commerce", label: "E-commerce" },
  { id: "fashion", label: "Fashion" },
  { id: "business", label: "Business" },
  { id: "portrait", label: "Portrait" },
] as const;

export function categoryLabel(id: string): string {
  return TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function voiceLabel(voice: string): string {
  return voice.charAt(0).toUpperCase() + voice.slice(1);
}

/** The distinct `{placeholder}` names in a template's prompt, in order. */
export function placeholdersOf(prompt: string): string[] {
  const names: string[] = [];
  for (const match of prompt.matchAll(/\{([a-zA-Z][\w-]*)\}/g)) {
    if (!names.includes(match[1]!)) names.push(match[1]!);
  }
  return names;
}

/** The prompt with each filled placeholder put in; empty ones stay as they are. */
export function fillTemplate(
  prompt: string,
  values: Record<string, string>,
): string {
  return prompt.replace(/\{([a-zA-Z][\w-]*)\}/g, (whole, name: string) => {
    const value = values[name]?.trim();
    return value ? value : whole;
  });
}
