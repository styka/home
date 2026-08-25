import { prisma } from "./db";

/**
 * 100 — etykiety zadań dla klikacza.
 *
 * Filtr etykiet w ogóle się nie renderuje, gdy słownik jest pusty (`allTags.length === 0`), a
 * `prisma/seed.ts` żadnych nie zakłada. Bez tej podkładki AC-6..AC-9 dałoby się sprawdzić wyłącznie
 * z lektury kodu — czyli nie dałoby się ich sprawdzić.
 *
 * Osiemnaście etykiet, nie trzy: całe zgłoszenie właściciela brzmiało „jak jest dużo tagów a
 * najczęściej jest dużo to ten pasek jest bardzo długi". Przy trzech stary pasek też mieściłby się
 * w jednym wierszu, więc test nie odróżniłby naprawy od jej braku — dokładnie ten sam powód, dla
 * którego 086 wstawiło do Pogody długą nazwę lokalizacji zamiast „Kraków".
 */
export const ETYKIETY_E2E = [
  "dziś", "finanse", "inne", "katowice", "kocoń", "moje pomysły",
  "praca", "quick", "raj", "remonty i naprawy", "research", "samochód",
  "sprzątanie", "wspólne", "zakupy", "zdrowie", "dom", "ogród",
];

export async function ensureEtykietyZadan(): Promise<void> {
  // `TaskTagDef` jest słownikiem GLOBALNYM (unikalna nazwa, bez przestrzeni), więc nie ma tu
  // czego wiązać z użytkownikiem — inaczej niż w podkładce Pogody.
  await prisma.taskTagDef.createMany({
    data: ETYKIETY_E2E.map((name, i) => ({
      name,
      // Kolor jest DANYMI (etykieta użytkownika), nie tokenem motywu — stąd wartości wprost.
      color: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#6b7280"][i % 6],
    })),
    // Baza klikacza jest długowieczna, a fixture ma być idempotentna.
    skipDuplicates: true,
  });
}
