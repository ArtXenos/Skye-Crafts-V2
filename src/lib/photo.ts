// Preparing a product photo in the browser, before it is uploaded.
//
// Phone cameras take 3–12 MB photos, but uploads are capped at 4 MB (Vercel
// refuses bigger requests). So every photo is redrawn at most 1600 px wide
// or tall and saved as a JPEG, usually 200–600 KB. Redrawing also:
// - turns the photo the right way up (phones store rotation separately), and
// - drops the hidden EXIF data, which can include the GPS location of the
//   place the photo was taken (often the owner's home).

/** The longest side of a saved photo, in pixels. Product cards show ~600 px. */
export const PHOTO_MAX_SIDE = 1600;

/** Scale width × height down (never up) so the longest side is at most `max`. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Draw any image source onto a canvas at the right size and save it as a JPEG file. */
export async function canvasToPhoto(source: CanvasImageSource, width: number, height: number): Promise<File> {
  const size = fitWithin(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare photos.");
  // JPEG has no transparency: give see-through PNGs a white background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("This browser can't prepare photos.");
  return new File([blob], "product-photo.jpg", { type: "image/jpeg" });
}

/**
 * Shrink a photo the owner picked or took. Throws with a friendly message
 * when the file isn't an image the browser can read (for example a HEIC
 * photo on a browser that doesn't support HEIC).
 */
export async function preparePhoto(file: Blob): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file couldn't be opened as a photo. Try a JPG or PNG, or take the photo again.");
  }
  try {
    return await canvasToPhoto(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
