import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import {
  GenerationFailed,
  GeneratorOff,
} from "@/client/components/GeneratorNotices";
import { ImagePicker, type PickedImage } from "@/client/components/ImagePicker";
import { MediaResults } from "@/client/components/MediaResults";
import { OptionToggle } from "@/client/components/OptionToggle";
import { PageHeader } from "@/client/components/PageHeader";
import { Setting } from "@/client/components/Setting";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Label } from "@/client/components/ui/label";
import { Spinner } from "@/client/components/ui/spinner";
import { Textarea } from "@/client/components/ui/textarea";
import { useGenerator } from "@/client/lib/useGenerator";
import { generateVideo, getGenerationStatus } from "@/serverFunctions/generate";
import {
  ASPECT_RATIOS,
  VIDEO_DURATIONS,
  VIDEO_MODELS,
  VIDEO_RESOLUTIONS,
  type AspectRatio,
} from "@/shared/options";

const search = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  duration: z.coerce.number().optional(),
  resolution: z.enum(VIDEO_RESOLUTIONS).optional(),
});

export const Route = createFileRoute("/video")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Video · Media Studio" }] }),
  component: VideoPage,
});

function VideoPage() {
  const initial = Route.useSearch();
  return <VideoForm key={JSON.stringify(initial)} initial={initial} />;
}

const POLL_MS = 3000;

function VideoForm({ initial }: { initial: z.infer<typeof search> }) {
  const [prompt, setPrompt] = useState(initial.prompt ?? "");
  const [model, setModel] = useState<string>(
    VIDEO_MODELS.some((m) => m.id === initial.model)
      ? initial.model!
      : VIDEO_MODELS[0].id,
  );
  const [duration, setDuration] = useState(
    String(initial.duration === 10 ? 10 : 5),
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initial.aspectRatio ?? "16:9",
  );
  const [resolution, setResolution] = useState<string>(
    initial.resolution ?? "720p",
  );
  const [startImage, setStartImage] = useState<PickedImage[]>([]);
  const generator = useGenerator();
  const { result, setResult } = generator;
  const running =
    result?.status === "queued" || result?.status === "processing";

  // Follow the video until the provider finishes.
  useEffect(() => {
    if (!running || !result) return;
    const timer = setTimeout(async () => {
      const next = await getGenerationStatus({ data: { id: result.id } });
      if (next) setResult(next);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [running, result, setResult]);

  function submit() {
    void generator.run(() =>
      generateVideo({
        data: {
          prompt,
          model,
          duration: Number(duration),
          aspectRatio,
          resolution: resolution as (typeof VIDEO_RESOLUTIONS)[number],
          startImageId: startImage[0]?.id ?? null,
        },
      }),
    );
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Video" />
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="video-prompt">Prompt</Label>
            <Textarea
              id="video-prompt"
              data-testid="video-prompt"
              value={prompt}
              maxLength={4000}
              rows={4}
              placeholder="Describe the scene and the camera movement"
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>
          <ImagePicker
            images={startImage}
            onChange={setStartImage}
            max={1}
            label="Add start image"
            testId="start-image-input"
          />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <Setting label="Model">
              <ChoiceSelect
                label="Model"
                testId="video-model"
                value={model}
                onChange={setModel}
                items={VIDEO_MODELS.map((m) => ({
                  value: m.id,
                  label: m.label,
                }))}
              />
            </Setting>
            <Setting label="Aspect ratio">
              <OptionToggle
                label="Aspect ratio"
                value={aspectRatio}
                onChange={setAspectRatio}
                items={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
              />
            </Setting>
          </div>
          <div className="flex flex-wrap gap-6">
            <Setting label="Duration">
              <OptionToggle
                label="Duration"
                value={duration}
                onChange={setDuration}
                items={VIDEO_DURATIONS.map((d) => ({
                  value: String(d),
                  label: `${d} seconds`,
                }))}
              />
            </Setting>
            <Setting label="Resolution">
              <OptionToggle
                label="Resolution"
                value={resolution}
                onChange={setResolution}
                items={VIDEO_RESOLUTIONS.map((r) => ({ value: r, label: r }))}
              />
            </Setting>
          </div>
          <Button
            data-testid="generate-video"
            disabled={!prompt.trim() || running}
            pending={generator.pending}
            onClick={submit}
          >
            <Clapperboard data-icon="inline-start" />
            Generate video
          </Button>
        </CardContent>
      </Card>
      {generator.off ? (
        <GeneratorOff name="Video generation" setup={generator.off.setup} />
      ) : null}
      {result ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <StatusBadge status={result.status} testId="video-status" />
            {running ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Spinner />
                This usually takes a few minutes.
              </span>
            ) : null}
          </div>
          {generator.failure ? (
            <GenerationFailed message={generator.failure} />
          ) : null}
          <MediaResults generation={result} />
        </section>
      ) : generator.failure ? (
        <GenerationFailed message={generator.failure} />
      ) : null}
    </AppShell>
  );
}
