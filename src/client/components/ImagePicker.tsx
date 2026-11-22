import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/client/components/ui/button";
import { UPLOAD_TYPES } from "@/shared/options";

export interface PickedImage {
  id: string;
  url: string;
}

/** Uploads images to guide a generation; shows them with a way to remove each. */
export function ImagePicker({
  images,
  onChange,
  max,
  label,
  testId,
}: {
  images: PickedImage[];
  onChange: (images: PickedImage[]) => void;
  max: number;
  label: string;
  testId: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    const added: PickedImage[] = [];
    try {
      for (const file of [...files].slice(0, max - images.length)) {
        const response = await fetch("/uploads", {
          method: "POST",
          headers: { "content-type": file.type },
          body: file,
        });
        const body = (await response.json().catch(() => null)) as
          | (PickedImage & { error?: string })
          | null;
        if (!response.ok || !body?.id) {
          setError(body?.error ?? "That image couldn't be uploaded.");
          break;
        }
        added.push({ id: body.id, url: body.url });
      }
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
    if (added.length) onChange([...images, ...added]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {images.map((image) => (
          <div
            key={image.id}
            data-testid="reference-thumb"
            className="relative size-16 overflow-hidden rounded-md border border-border"
          >
            <img src={image.url} alt="" className="size-full object-cover" />
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label="Remove image"
              className="absolute top-0.5 right-0.5"
              onClick={() =>
                onChange(images.filter((other) => other.id !== image.id))
              }
            >
              <X />
            </Button>
          </div>
        ))}
        {images.length < max ? (
          <Button
            variant="outline"
            size="sm"
            pending={uploading}
            onClick={() => input.current?.click()}
          >
            <ImagePlus data-icon="inline-start" />
            {label}
          </Button>
        ) : null}
        <input
          ref={input}
          type="file"
          accept={UPLOAD_TYPES.join(",")}
          multiple={max > 1}
          hidden
          data-testid={testId}
          onChange={(event) => void upload(event.target.files)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
