/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * Phone photos are often 5 to 17 MB. The site never shows them bigger than
 * about 2400 pixels wide, so this redraws the photo at that size and saves it
 * as a WebP file (or JPEG if the browser can't make WebP). A 15 MB phone photo
 * usually comes out around 0.5 MB.
 */

export const SHRINKABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Largest file allowed after shrinking. */
const MAX_BYTES = 5 * 1024 * 1024;

export interface ShrunkImage {
  blob: Blob;
  /** "webp" or "jpg", for the file name. */
  extension: string;
  width: number;
  height: number;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Returns the smaller photo, or throws an Error with a plain-English message
 * the admin page can show as is.
 */
export async function shrinkImage(
  file: File,
  { maxEdge = 2400, quality = 0.85 }: { maxEdge?: number; quality?: number } = {}
): Promise<ShrunkImage> {
  if (!SHRINKABLE_TYPES.includes(file.type)) {
    throw new Error(
      `"${file.name}" isn't a JPEG, PNG or WebP photo. iPhone photos (HEIC) can be saved as JPEG first, or picked from the photo library, which converts them.`
    );
  }

  let bitmap: ImageBitmap;
  try {
    // "from-image" turns the photo the right way up, as the camera meant.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`This browser can't open "${file.name}". Try a JPEG copy of the photo.`);
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This browser can't shrink photos. Try another browser.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Some browsers can't make WebP and quietly hand back a PNG instead.
  let blob = await toBlob(canvas, "image/webp", quality);
  let extension = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", quality);
    extension = "jpg";
  }
  if (!blob) {
    throw new Error(`Couldn't shrink "${file.name}". Try another photo.`);
  }
  if (blob.size > MAX_BYTES) {
    throw new Error(`"${file.name}" is still over 5 MB after shrinking. Try a smaller photo.`);
  }
  return { blob, extension, width, height };
}
