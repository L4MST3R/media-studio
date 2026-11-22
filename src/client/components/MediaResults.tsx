import { Download } from "lucide-react";
import { buttonVariants } from "@/client/components/ui/button";
import type { Generation } from "@/server/generations";

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      data-testid="download"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <Download data-icon="inline-start" />
      {label}
    </a>
  );
}

/** A generation's files: images in a grid, a player for audio and video. */
export function MediaResults({ generation }: { generation: Generation }) {
  if (generation.assets.length === 0) return null;
  if (generation.kind === "image") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {generation.assets.map((url, index) => (
          <figure key={url} className="space-y-2">
            <img
              src={url}
              alt={`Result ${index + 1}`}
              className="w-full rounded-lg border border-border bg-muted object-contain"
            />
            <DownloadLink href={`${url}?download=1`} label="Download" />
          </figure>
        ))}
      </div>
    );
  }
  const url = generation.assets[0]!;
  if (generation.kind === "audio") {
    return (
      <div className="space-y-2">
        <audio
          controls
          src={url}
          data-testid="speech-audio"
          className="w-full"
        />
        <DownloadLink href={`${url}?download=1`} label="Download MP3" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <video
        controls
        src={url}
        data-testid="video-player"
        className="w-full rounded-lg border border-border bg-muted"
      />
      <DownloadLink href={`${url}?download=1`} label="Download MP4" />
    </div>
  );
}
