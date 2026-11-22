import { and, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/shared/options";
import { toBase64 } from "@/server/bytes";

export class UploadError extends Error {}

/** Stores an image a member uploaded and returns its id. */
export async function saveUpload(
  userId: string,
  contentType: string,
  body: ArrayBuffer,
): Promise<{ id: string; url: string }> {
  if (!(UPLOAD_TYPES as readonly string[]).includes(contentType)) {
    throw new UploadError("Upload a PNG, JPEG or WebP image.");
  }
  if (body.byteLength === 0) throw new UploadError("The file is empty.");
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError("Images can be up to 8 MB.");
  }
  const id = crypto.randomUUID();
  const key = `uploads/${id}`;
  await env.files.put(key, body, { httpMetadata: { contentType } });
  await db.insert(uploads).values({
    id,
    userId,
    key,
    contentType,
    size: body.byteLength,
    createdAt: Date.now(),
  });
  return { id, url: uploadUrl(id) };
}

export function uploadUrl(id: string): string {
  return `/uploads/${id}`;
}

/** The member's own upload, or null. */
export async function getUpload(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, id), eq(uploads.userId, userId)));
  return row ?? null;
}

/** The member's own uploads among `ids`; throws when any isn't theirs. */
export async function ownUploads(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(uploads)
    .where(and(inArray(uploads.id, ids), eq(uploads.userId, userId)));
  if (rows.length !== new Set(ids).size) {
    throw new UploadError("A reference image is missing. Upload it again.");
  }
  return ids.map((id) => rows.find((row) => row.id === id)!);
}

/** An upload as a `data:` URL, the form the models take images in. */
export async function uploadDataUrl(upload: {
  key: string;
  contentType: string;
}): Promise<string> {
  const object = await env.files.get(upload.key);
  if (!object) throw new UploadError("A reference image is missing.");
  const bytes = new Uint8Array(await object.arrayBuffer());
  return `data:${upload.contentType};base64,${toBase64(bytes)}`;
}
