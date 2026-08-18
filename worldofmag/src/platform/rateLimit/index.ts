import { prisma } from "@/platform/db/prisma";
import { POLITYKI, kluczDzierzawy, kluczOkna, type ZakresLimitu } from "./polityki";

/**
 * 081 (zadanie 26, Faza 5) — LIMITER WSPÓŁDZIELONY MIĘDZY INSTANCJAMI.
 *
 * **Co się zmieniło i co nie.** Kształt wyniku (`RateCheck`) jest ten sam co w liczniku z pamięci
 * procesu — rozdz. 11.2 prosi wprost: „zachowaj ten sam interfejs, zmienia się implementacja, nie
 * miejsca wywołań". Zmieniła się jedna rzecz, której zachować się nie da: funkcje są ASYNCHRONICZNE.
 * Utrzymanie sygnatury synchronicznej wymagałoby lokalnego cache'u przed zapytaniem, czyli DRUGIEGO
 * nośnika tego samego stanu — dokładnie tego, co ta zmiana likwiduje.
 *
 * **Dlaczego nie zostawiliśmy szybkiego bezpiecznika w pamięci „na wszelki wypadek".** Bo licznik
 * w pamięci i licznik w bazie rozjeżdżają się z definicji, a wtedy nikt nie umie odpowiedzieć na
 * pytanie „ile temu użytkownikowi zostało". Jedno źródło prawdy, jedno zapytanie na żądanie.
 *
 * **Koszt.** Jedno `INSERT … ON CONFLICT` na okno (minutowe i godzinne) — dwa zapytania na żądanie
 * objęte limitem, obie po kluczu głównym. Przy operacji, która i tak woła model językowy przez sieć,
 * jest to niemierzalne; przy zwykłym odczycie strony limiter w ogóle nie chodzi.
 */

export type RateCheck = { ok: true } | { ok: false; retryAfterSec: number; message: string };

type WierszOkna = { count: number; resetAt: Date };

/**
 * Atomowy przyrost licznika w oknie. Całość okna (przesunięcie terminu i wyzerowanie licznika po
 * jego upływie) dzieje się w bazie — gdyby decyzję „czy okno wygasło" podejmował kod, dwie instancje
 * czytające ten sam wygasły wiersz wyzerowałyby go dwa razy i użytkownik dostałby podwójny limit.
 */
async function przyrost(key: string, limit: number, oknoMs: number): Promise<WierszOkna> {
  const koniec = new Date(Date.now() + oknoMs);
  const rows = await prisma.$queryRaw<WierszOkna[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${koniec})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC')
                       THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= (now() AT TIME ZONE 'UTC')
                       THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const w = rows[0];
  // Wiersz jest zwracany zawsze (INSERT albo DO UPDATE) — ale gdyby dostawca kiedyś tego nie
  // dotrzymał, wpuszczamy żądanie zamiast wywracać trasę. Limiter chroni koszt, nie dane.
  return w ?? { count: 1, resetAt: koniec };
}

function sekundDo(termin: Date): number {
  return Math.max(1, Math.ceil((termin.getTime() - Date.now()) / 1000));
}

/**
 * Sprawdza (i zużywa) jedno żądanie w danym zakresie. Licznik rośnie także po przekroczeniu limitu
 * — świadomie: to zwykły licznik odrzuceń, a termin okna zostaje, więc dobijanie się NIE przedłuża
 * kary. Naliczanie kary za dobijanie się byłoby inną polityką i wymagałoby własnej decyzji.
 */
export async function sprawdzLimit(zakres: ZakresLimitu, podmiot: string): Promise<RateCheck> {
  const p = POLITYKI[zakres];
  if (p.naMinute !== null) {
    const w = await przyrost(kluczOkna(zakres, podmiot, "min"), p.naMinute, 60_000);
    if (w.count > p.naMinute) {
      return { ok: false, retryAfterSec: sekundDo(w.resetAt), message: p.komunikatMinuta };
    }
  }
  if (p.naGodzine !== null) {
    const w = await przyrost(kluczOkna(zakres, podmiot, "godz"), p.naGodzine, 3_600_000);
    if (w.count > p.naGodzine) {
      return { ok: false, retryAfterSec: sekundDo(w.resetAt), message: p.komunikatGodzina };
    }
  }
  return { ok: true };
}

/**
 * Zajmuje slot współbieżności. Zwraca funkcję zwalniającą albo `null`, gdy wszystkie sloty są zajęte.
 *
 * Pętla po numerach slotów jest tu zamiast „policz i wstaw": każdy obrót to jedno zapytanie atomowe
 * na poziomie wiersza, a indeks unikalny (klucz, slot) załatwia serializację, której zliczanie by nie
 * dało. Slotów jest 2, więc pętla ma najwyżej dwa obroty.
 */
export async function zajmijSlot(
  zakres: ZakresLimitu,
  podmiot: string
): Promise<(() => Promise<void>) | null> {
  const p = POLITYKI[zakres];
  if (p.rownolegle === null) return async () => {};
  const key = kluczDzierzawy(zakres, podmiot);
  const holder = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const wygasa = new Date(Date.now() + p.dzierzawaSek * 1000);

  for (let slot = 0; slot < p.rownolegle; slot++) {
    const rows = await prisma.$queryRaw<{ holder: string }[]>`
      INSERT INTO "RateLimitLease" ("key", "slot", "holder", "expiresAt")
      VALUES (${key}, ${slot}, ${holder}, ${wygasa})
      ON CONFLICT ("key", "slot") DO UPDATE
        SET "holder" = EXCLUDED."holder", "expiresAt" = EXCLUDED."expiresAt"
        WHERE "RateLimitLease"."expiresAt" <= (now() AT TIME ZONE 'UTC')
      RETURNING "holder"
    `;
    if (rows.length > 0) {
      let zwolniony = false;
      return async () => {
        if (zwolniony) return;
        zwolniony = true;
        // Warunek `holder` jest istotny: jeśli nasza dzierżawa zdążyła wygasnąć i slot przejął ktoś
        // inny, to `DELETE` bez tego warunku wyrzuciłby CUDZĄ dzierżawę i przepuścił trzecią operację.
        await prisma.rateLimitLease
          .deleteMany({ where: { key, slot, holder } })
          .catch(() => {});
      };
    }
  }
  return null;
}

/**
 * Sprząta wiersze, których nikt już nie czyta. Nie jest potrzebne do POPRAWNOŚCI (wygasłe okno
 * zeruje się przy pierwszym trafieniu, wygasły slot da się przejąć) — jest potrzebne, żeby tabela
 * nie rosła liniowo z liczbą kont, które kiedykolwiek dotknęły asystenta. Wołane z zadania
 * okresowego razem z resztą retencji.
 */
export async function posprzatajLimity(): Promise<{ okna: number; dzierzawy: number }> {
  const teraz = new Date();
  const [okna, dzierzawy] = await Promise.all([
    prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: teraz } } }),
    prisma.rateLimitLease.deleteMany({ where: { expiresAt: { lt: teraz } } }),
  ]);
  return { okna: okna.count, dzierzawy: dzierzawy.count };
}

export { POLITYKI } from "./polityki";
export type { ZakresLimitu } from "./polityki";
