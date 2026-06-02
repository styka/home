// Wspólne narzędzia do obrazów po stronie klienta. Zdjęcia downscalujemy przed
// wysłaniem do AI (mniejszy request) lub przed zapisem w bazie jako data-URL
// (zdjęcie pozycji / dokumentu). Wcześniej ta funkcja była zduplikowana w
// StorageScan i RecipeImagesEditor — teraz jest jedno źródło prawdy.

export interface DownscaleOptions {
  /** Maksymalny wymiar (px) dłuższego boku. */
  maxDim?: number;
  /** Jakość JPEG 0–1. */
  quality?: number;
}

/**
 * Wczytuje plik obrazu i zwraca downscalowany data-URL (JPEG).
 * Domyślnie 1400px / 0.82 — rozsądny kompromis dla rozpoznawania przez AI.
 */
export function fileToDownscaledDataUrl(
  file: File,
  { maxDim = 1400, quality = 0.82 }: DownscaleOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Nie udało się wczytać obrazu"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Brak kontekstu canvas"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
