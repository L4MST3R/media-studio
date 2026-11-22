import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
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
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { useGenerator } from "@/client/lib/useGenerator";
import { generateImages } from "@/serverFunctions/generate";
import {
  ASPECT_RATIOS,
  IMAGE_MODELS,
  MAX_REFERENCES,
  type AspectRatio,
} from "@/shared/options";

const search = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  count: z.coerce.number().int().min(1).max(4).optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Images · Media Studio" }] }),
  component: ImagesPage,
});

const COUNTS = [1, 2, 3, 4].map((n) => ({
  value: String(n),
  label: n === 1 ? "1 image" : `${n} images`,
}));

function ImagesPage() {
  const initial = Route.useSearch();
  return <ImageForm key={JSON.stringify(initial)} initial={initial} />;
}

function ImageForm({ initial }: { initial: z.infer<typeof search> }) {
  const [prompt, setPrompt] = useState(initial.prompt ?? "");
  const [model, setModel] = useState<string>(
    IMAGE_MODELS.some((m) => m.id === initial.model)
      ? initial.model!
      : IMAGE_MODELS[0].id,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initial.aspectRatio ?? "1:1",
  );
  const [count, setCount] = useState(String(initial.count ?? 1));
  const [references, setReferences] = useState<PickedImage[]>([]);
  const generator = useGenerator();

  function submit() {
    void generator.run(() =>
      generateImages({
        data: {
          prompt,
          model,
          aspectRatio,
          count: Number(count),
          referenceIds: references.map((r) => r.id),
        },
      }),
    );
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Images" />
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="image-prompt">Prompt</Label>
            <Textarea
              id="image-prompt"
              data-testid="image-prompt"
              value={prompt}
              maxLength={4000}
              rows={4}
              placeholder="Describe the image"
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>
          <ImagePicker
            images={references}
            onChange={setReferences}
            max={MAX_REFERENCES}
            label="Add reference image"
            testId="reference-input"
          />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <Setting label="Model">
              <ChoiceSelect
                label="Model"
                testId="image-model"
                value={model}
                onChange={setModel}
                items={IMAGE_MODELS.map((m) => ({
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
          <Setting label="Number of images">
            <OptionToggle
              label="Number of images"
              value={count}
              onChange={setCount}
              items={COUNTS}
            />
          </Setting>
          <Button
            data-testid="generate-image"
            disabled={!prompt.trim()}
            pending={generator.pending}
            onClick={submit}
          >
            <Sparkles data-icon="inline-start" />
            Generate
          </Button>
        </CardContent>
      </Card>
      {generator.off ? (
        <GeneratorOff name="Image generation" setup={generator.off.setup} />
      ) : null}
      {generator.failure ? (
        <GenerationFailed message={generator.failure} />
      ) : null}
      {generator.result ? (
        <section data-testid="image-results">
          <MediaResults generation={generator.result} />
        </section>
      ) : null}
    </AppShell>
  );
}
