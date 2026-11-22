/** Base64 of a byte array, in chunks so large files don't overflow the stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** `{ contentType, bytes }` of a `data:` URL, or null when it isn't base64 data. */
export function parseDataUrl(
  url: string,
): { contentType: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
  if (!match) return null;
  return { contentType: match[1]!, bytes: fromBase64(match[2]!) };
}

export function extensionFor(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "audio/mpeg":
      return "mp3";
    case "video/mp4":
      return "mp4";
    default:
      return "png";
  }
}
