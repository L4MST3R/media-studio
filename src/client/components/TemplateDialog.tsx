import { useState, type ReactElement } from "react";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { OptionToggle } from "@/client/components/OptionToggle";
import { Setting } from "@/client/components/Setting";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import type { Template } from "@/server/templates";
import { createTemplate, updateTemplate } from "@/serverFunctions/templates";
import {
  ASPECT_RATIOS,
  TEMPLATE_CATEGORIES,
  VIDEO_DURATIONS,
  type AspectRatio,
} from "@/shared/options";

/** Create a template, or edit `template`. Admins only. */
export function TemplateDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template;
  onSaved: (saved: Template) => void;
}): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit template" : "New template"}
          </DialogTitle>
        </DialogHeader>
        {open ? <TemplateForm template={template} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TemplateForm({
  template,
  onSaved,
}: {
  template?: Template;
  onSaved: (saved: Template) => void;
}) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [category, setCategory] = useState<string>(
    template?.category ?? TEMPLATE_CATEGORIES[0].id,
  );
  const [kind, setKind] = useState<"image" | "video">(
    template?.kind ?? "image",
  );
  const [prompt, setPrompt] = useState(template?.prompt ?? "");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    template?.settings.aspectRatio ?? "1:1",
  );
  const [duration, setDuration] = useState(
    String(template?.settings.duration ?? 5),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const data = {
      title,
      category,
      kind,
      prompt,
      settings:
        kind === "video"
          ? { aspectRatio, duration: Number(duration) }
          : { aspectRatio },
    };
    try {
      const saved = template
        ? await updateTemplate({ data: { ...data, id: template.id } })
        : await createTemplate({ data });
      onSaved(saved);
    } catch {
      setError("The template couldn't be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="template-title">Title</Label>
        <Input
          id="template-title"
          data-testid="template-title"
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Setting label="Category">
          <ChoiceSelect
            label="Category"
            testId="template-category"
            value={category}
            onChange={setCategory}
            items={TEMPLATE_CATEGORIES.map((c) => ({
              value: c.id,
              label: c.label,
            }))}
          />
        </Setting>
        <Setting label="Makes">
          <OptionToggle
            label="Makes"
            value={kind}
            onChange={setKind}
            items={[
              { value: "image", label: "Image" },
              { value: "video", label: "Video" },
            ]}
          />
        </Setting>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="template-prompt">Prompt</Label>
        <Textarea
          id="template-prompt"
          data-testid="template-prompt"
          value={prompt}
          rows={4}
          maxLength={4000}
          placeholder="A photo of {product} on a {surface}"
          onChange={(event) => setPrompt(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Words in {"{braces}"} become fields to fill in.
        </p>
      </div>
      <Setting label="Aspect ratio">
        <OptionToggle
          label="Aspect ratio"
          value={aspectRatio}
          onChange={setAspectRatio}
          items={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
        />
      </Setting>
      {kind === "video" ? (
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
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button
          type="submit"
          pending={saving}
          disabled={!title.trim() || !prompt.trim()}
        >
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
