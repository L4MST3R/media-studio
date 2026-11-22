import {
  createFileRoute,
  Link,
  useNavigate,
  type LinkProps,
} from "@tanstack/react-router";
import { ChevronLeft, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { GenerationFailed } from "@/client/components/GeneratorNotices";
import { MediaResults } from "@/client/components/MediaResults";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/client/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { formatDate } from "@/client/lib/format";
import type { Generation } from "@/server/generations";
import { deleteLibraryItem, getLibraryItem } from "@/serverFunctions/library";
import { IMAGE_MODELS, VIDEO_MODELS, voiceLabel } from "@/shared/options";

export const Route = createFileRoute("/library/$id")({
  loader: ({ params }) => getLibraryItem({ data: { id: params.id } }),
  head: () => ({ meta: [{ title: "Library · Media Studio" }] }),
  component: DetailPage,
});

const KIND_TITLES = { image: "Image", video: "Video", audio: "Speech" };

const backLink = (
  <Link
    to="/library"
    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
  >
    <ChevronLeft className="size-4" aria-hidden />
    Library
  </Link>
);

function DetailPage() {
  const generation = Route.useLoaderData();
  if (!generation) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Not found" backLink={backLink} />
        <div data-testid="not-found">
          <EmptyState
            kind="error"
            title="This item doesn't exist or isn't yours"
          />
        </div>
      </AppShell>
    );
  }
  return <Detail generation={generation} />;
}

/** The generator, prefilled with this generation's prompt and settings. */
function reuseLink(g: Generation): LinkProps {
  const s = g.settings as Record<string, string | number | undefined>;
  if (g.kind === "audio") {
    return {
      to: "/speech",
      search: { text: g.prompt, voice: s.voice, speed: s.speed },
    } as LinkProps;
  }
  if (g.kind === "video") {
    return {
      to: "/video",
      search: {
        prompt: g.prompt,
        model: g.model,
        aspectRatio: s.aspectRatio,
        duration: s.duration,
        resolution: s.resolution,
      },
    } as LinkProps;
  }
  return {
    to: "/",
    search: {
      prompt: g.prompt,
      model: g.model,
      aspectRatio: s.aspectRatio,
      count: s.count,
    },
  } as LinkProps;
}

function settingsList(g: Generation): [string, string][] {
  const s = g.settings as Record<string, string | number | undefined>;
  const modelLabel =
    [...IMAGE_MODELS, ...VIDEO_MODELS].find((m) => m.id === g.model)?.label ??
    g.model;
  const rows: [string, string][] = [["Model", modelLabel]];
  if (g.kind === "image") {
    rows.push(["Aspect ratio", String(s.aspectRatio)]);
    rows.push(["Images", String(s.count)]);
  } else if (g.kind === "video") {
    rows.push(["Duration", `${s.duration} seconds`]);
    rows.push(["Aspect ratio", String(s.aspectRatio)]);
    rows.push(["Resolution", String(s.resolution)]);
  } else {
    rows.push(["Voice", voiceLabel(String(s.voice))]);
    rows.push(["Speed", `${s.speed}×`]);
  }
  return rows;
}

function Detail({ generation }: { generation: Generation }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await deleteLibraryItem({ data: { id: generation.id } });
      setConfirming(false);
      await navigate({ to: "/library" });
    } catch {
      setError("It couldn't be deleted. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={KIND_TITLES[generation.kind]}
        backLink={backLink}
        description={
          <span suppressHydrationWarning>
            {formatDate(generation.createdAt)}
          </span>
        }
        actions={
          <>
            <Link
              {...reuseLink(generation)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <RotateCcw data-icon="inline-start" />
              Reuse prompt
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          </>
        }
      />
      <div data-testid="generation-detail" className="space-y-6">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{generation.prompt}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={generation.status} />
              </dd>
              {settingsList(generation).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {generation.inputs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {generation.inputs.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt="Reference"
                    className="size-16 rounded-md border border-border object-cover"
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
        {generation.status === "failed" && generation.error ? (
          <GenerationFailed message={generation.error} />
        ) : null}
        <MediaResults generation={generation} />
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this {KIND_TITLES[generation.kind].toLowerCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its files are deleted too. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" pending={deleting} onClick={remove}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
