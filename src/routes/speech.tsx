import { createFileRoute } from "@tanstack/react-router";
import { AudioLines } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import {
  GenerationFailed,
  GeneratorOff,
} from "@/client/components/GeneratorNotices";
import { MediaResults } from "@/client/components/MediaResults";
import { PageHeader } from "@/client/components/PageHeader";
import { Setting } from "@/client/components/Setting";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { useGenerator } from "@/client/lib/useGenerator";
import { generateSpeech } from "@/serverFunctions/generate";
import { MAX_SPEECH_CHARS, SPEEDS, VOICES, voiceLabel } from "@/shared/options";

const search = z.object({
  text: z.string().optional(),
  voice: z.enum(VOICES).optional(),
  speed: z.coerce.number().optional(),
});

export const Route = createFileRoute("/speech")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Speech · Media Studio" }] }),
  component: SpeechPage,
});

function SpeechPage() {
  const initial = Route.useSearch();
  return <SpeechForm key={JSON.stringify(initial)} initial={initial} />;
}

function SpeechForm({ initial }: { initial: z.infer<typeof search> }) {
  const [text, setText] = useState(initial.text ?? "");
  const [voice, setVoice] = useState<string>(initial.voice ?? "alloy");
  const [speed, setSpeed] = useState(
    String(
      (SPEEDS as readonly number[]).includes(initial.speed ?? 1)
        ? (initial.speed ?? 1)
        : 1,
    ),
  );
  const generator = useGenerator();
  const tooLong = text.length > MAX_SPEECH_CHARS;

  function submit() {
    void generator.run(() =>
      generateSpeech({
        data: {
          text,
          voice: voice as (typeof VOICES)[number],
          speed: Number(speed),
        },
      }),
    );
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader title="Speech" />
      <Card>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="speech-text">Text</Label>
            <Textarea
              id="speech-text"
              data-testid="speech-text"
              value={text}
              rows={6}
              placeholder="What should be read aloud?"
              aria-invalid={tooLong || undefined}
              onChange={(event) => setText(event.target.value)}
            />
            <p
              className={
                tooLong
                  ? "text-right text-xs text-destructive"
                  : "text-right text-xs text-muted-foreground"
              }
            >
              {text.length.toLocaleString()} /{" "}
              {MAX_SPEECH_CHARS.toLocaleString()}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Setting label="Voice">
              <ChoiceSelect
                label="Voice"
                testId="speech-voice"
                value={voice}
                onChange={setVoice}
                items={VOICES.map((v) => ({ value: v, label: voiceLabel(v) }))}
              />
            </Setting>
            <Setting label="Speed">
              <ChoiceSelect
                label="Speed"
                testId="speech-speed"
                value={speed}
                onChange={setSpeed}
                items={SPEEDS.map((s) => ({
                  value: String(s),
                  label: `${s}×`,
                }))}
              />
            </Setting>
          </div>
          <Button
            data-testid="generate-speech"
            disabled={!text.trim() || tooLong}
            pending={generator.pending}
            onClick={submit}
          >
            <AudioLines data-icon="inline-start" />
            Generate speech
          </Button>
        </CardContent>
      </Card>
      {generator.off ? (
        <GeneratorOff name="Speech" setup={generator.off.setup} />
      ) : null}
      {generator.failure ? (
        <GenerationFailed message={generator.failure} />
      ) : null}
      {generator.result ? <MediaResults generation={generator.result} /> : null}
    </AppShell>
  );
}
