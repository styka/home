// Z-131 (T-17) — wspólna walidacja obrazu (data URL) dla handlerów wizyjnych OCR.
import { JobError } from "@/lib/jobs/types";

const MAX_BYTES = 8 * 1024 * 1024;

/** Waliduje data-URL obrazu; rzuca JobError(400/413). Zwraca ten sam string. */
export function assertValidImage(image: unknown): string {
  if (!image || typeof image !== "string") throw new JobError("Brak obrazu", 400);
  if (!/^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(image)) {
    throw new JobError("Niepoprawny format obrazu (oczekiwany data:image/...;base64,...)", 400);
  }
  const idx = image.indexOf(",");
  const bytes = idx < 0 ? 0 : Math.floor(((image.length - idx - 1) * 3) / 4);
  if (bytes > MAX_BYTES) throw new JobError("Obraz za duży (max 8 MB)", 413);
  return image;
}
