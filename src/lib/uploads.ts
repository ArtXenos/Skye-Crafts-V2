import "server-only";

// Checks for uploaded photos (receipts and product images). The storage
// buckets enforce size and type too; these run first for clear messages and
// also look at the file's first bytes, so a renamed file can't pass as an
// image just by its name.

// Vercel refuses request bodies over 4.5 MB, so photos are capped at 4 MB.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; matches: (bytes: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    type: "image/webp",
    ext: "webp",
    matches: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export type CheckedImage = { bytes: Uint8Array; type: string; ext: string };

/** Returns the image, or a message saying what's wrong with the upload. */
export async function checkImage(value: FormDataEntryValue | null): Promise<CheckedImage | string> {
  if (!(value instanceof File) || value.size === 0) return "Choose a photo to upload.";
  if (value.size > MAX_UPLOAD_BYTES) return "That photo is larger than 4 MB. Try a smaller screenshot or photo.";
  const bytes = new Uint8Array(await value.arrayBuffer());
  const kind = SIGNATURES.find((signature) => signature.matches(bytes));
  if (!kind) return "Upload a JPG, PNG or WebP image.";
  return { bytes, type: kind.type, ext: kind.ext };
}
