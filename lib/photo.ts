export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// The optional "photo" file of a form: null when none was chosen, `error` when it is not an allowed image.
export function parsePhoto(formData: FormData): { photo: File | null; error?: string } {
  const f = formData.get("photo");
  if (!(f instanceof File) || f.size === 0) return { photo: null };
  if (!PHOTO_TYPES.includes(f.type)) return { photo: null, error: "The photo must be a JPEG, PNG or WebP image." };
  if (f.size > PHOTO_MAX_BYTES) return { photo: null, error: "The photo must be 2 MB or smaller." };
  return { photo: f };
}

// What the update statements need: replace/clear the stored photo only when a new file or "remove" was sent.
export async function photoUpdate(formData: FormData, photo: File | null) {
  return {
    replace: Boolean(photo) || formData.get("removePhoto") === "on",
    b64: await photoBase64(photo),
    type: photo?.type ?? null,
  };
}

export async function photoBase64(photo: File | null): Promise<string | null> {
  return photo ? Buffer.from(await photo.arrayBuffer()).toString("base64") : null;
}
