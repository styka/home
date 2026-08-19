import { prisma } from "@/platform/db/prisma";

/**
 * 080 (Z4): przełącznik „czytaj głosem systemowym" po stronie administratora.
 *
 * Ze zgłoszenia: „admin nie ma możliwości zmiany lektora na systemowy, co spowodowało, że opcja
 * lektora w aplikacji w tej sytuacji nie działa". Gdy dostawca płatnego lektora odmawia, jedynym
 * wyjściem było skasowanie przypisania modelu — czyli zniszczenie konfiguracji, żeby wyłączyć
 * warstwę. To jest świadomy, odwracalny wybór, więc zasługuje na własny przełącznik.
 *
 * Wyłączamy WARSTWĘ, a nie dostawcę: `synthesizeSpeech` zwraca `null`, trasa odpowiada 501,
 * a klient schodzi na syntezę przeglądarki ścieżką, która już działa. Routing modeli zostaje
 * DB-driven (C-40) — nic tu nie hardkoduje dostawcy ani modelu.
 *
 * Ten moduł to czysty ODCZYT bez sesji — woła go `serverTts`, który nie może przechodzić przez
 * akcję administratora. Wersja dla panelu admina jest w `actions/llmConfig.ts`. Wzorzec 1:1
 * z `platform/ai/followups.ts`.
 */
export const SPEECH_FORCE_BROWSER_KEY = "speech_force_browser";

/** Brak wiersza = wyłączone, czyli lektor serwerowy działa jak dotąd. */
export async function readForceBrowserVoice(): Promise<boolean> {
  try {
    const row = await prisma.config.findUnique({ where: { key: SPEECH_FORCE_BROWSER_KEY } });
    return row?.value === "1";
  } catch {
    // Awaria odczytu nie może po cichu wyłączyć lektora serwerowego — zostajemy przy domyślnym.
    return false;
  }
}
