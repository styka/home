import { prisma } from "@/platform/db/prisma";
import type { PolitykaRetencji } from "./typy";

export type { PolitykaRetencji } from "./typy";

/**
 * 083 (zadanie 30, Faza 5) — WYKONAWCA RETENCJI.
 *
 * **Polityki wchodzą PARAMETREM.** Platforma nie może importować modułów (rozdz. 7.1), a dwie
 * z siedmiu polityk opisują dane modułowe (`NewsArticle` — Wiadomości, `ItemHistory` — Zakupy).
 * Korzeń kompozycji stoi więc poza platformą: `src/lib/retention/polityki.ts`. Ten sam wzorzec,
 * co `buildAiCatalog(contributions)` i `filterAccessibleFavorites(…, isPathLocked)`.
 */

export function kluczKonfiguracji(polityka: { klucz: string }): string {
  return `retention_${polityka.klucz}_days`;
}

/**
 * Ile dni trzymamy dane objęte tą polityką.
 *
 * Wartość poniżej `minimumDni` jest **podnoszona do minimum, nie odrzucana**. To jest różnica
 * praktyczna: odrzucenie działa tylko wtedy, gdy wartość przechodzi przez nasz formularz, a wiersz
 * w `Config` da się zmienić także z `psql` albo migracją. Granica pilnowana przy ODCZYCIE obowiązuje
 * niezależnie od tego, kto zapisał wartość.
 */
export async function dniRetencji(polityka: PolitykaRetencji): Promise<number> {
  const row = await prisma.config.findUnique({ where: { key: kluczKonfiguracji(polityka) } });
  const n = row?.value ? Number(row.value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return polityka.domyslneDni;
  return Math.max(polityka.minimumDni, Math.floor(n));
}

export type WynikRetencji = {
  klucz: string;
  etykieta: string;
  dni: number;
  usunieto: number;
  blad?: string;
};

/**
 * Wykonuje wszystkie polityki. Błąd jednej **nie przerywa pozostałych** — retencja to sprzątanie,
 * a nie transakcja: przerwanie po pierwszym problemie zostawiłoby sześć tabel rosnących dalej,
 * i to bez żadnego sygnału poza jednym wpisem w logu.
 */
export async function uruchomRetencje(polityki: PolitykaRetencji[]): Promise<WynikRetencji[]> {
  const wyniki: WynikRetencji[] = [];
  for (const p of polityki) {
    const dni = await dniRetencji(p);
    const granica = new Date(Date.now() - dni * 86_400_000);
    try {
      wyniki.push({ klucz: p.klucz, etykieta: p.etykieta, dni, usunieto: await p.usun(granica) });
    } catch (e) {
      wyniki.push({
        klucz: p.klucz,
        etykieta: p.etykieta,
        dni,
        usunieto: 0,
        blad: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return wyniki;
}
