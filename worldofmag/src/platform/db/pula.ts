/**
 * 084 (zadanie 28, Faza 5) — PULA POŁĄCZEŃ.
 *
 * Rozdz. 11.4 wymienia dwie rzeczy: `connection_limit` w `DATABASE_URL` i pgbouncer w trybie
 * transakcyjnym. Ta funkcja odpowiada za pierwszą i **rozpoznaje** drugą.
 *
 * **Dlaczego to nie jest po prostu zapisane w zmiennej środowiskowej na Renderze.** Bo domyślna
 * wartość Prismy zależy od liczby rdzeni instancji (`rdzenie × 2 + 1`), więc jest inna po każdej
 * zmianie planu hostingu i nikt się o tym nie dowiaduje. Neon liczy połączenia po swojej stronie:
 * kilka instancji `web` plus worker plus migracja wdrożeniowa potrafią razem przekroczyć limit,
 * a objawem jest `too many connections` przy wdrożeniu — czyli w najgorszym możliwym momencie.
 *
 * **Czego ta funkcja NIE robi: nie dopisuje `pgbouncer=true`.** Kusiło, bo host Neona z członem
 * `-pooler` tego wymaga (tryb transakcyjny nie znosi zapytań przygotowanych). Ale cicha zmiana
 * sposobu, w jaki produkcja rozmawia z bazą, na podstawie fragmentu nazwy hosta, to zbyt duża
 * decyzja jak na funkcję pomocniczą — a jeśli obecna konfiguracja działa, zepsułaby ją bez pytania.
 * Zamiast tego brak flagi jest **zgłaszany** w `/admin/health` i opisany w runbooku.
 */

/** Ile połączeń na instancję, gdy nikt nie powiedział inaczej. */
export const DOMYSLNY_LIMIT_POLACZEN = 5;

export type StanPuli = {
  /** URL po ewentualnym dopisaniu limitu — to jego dostaje Prisma. */
  url: string;
  /** Limit, który faktycznie obowiązuje. */
  limit: number;
  /** `true`, gdy limit był już w URL-u i nic nie dopisaliśmy. */
  jawnyWUrl: boolean;
  /** Host wygląda na pulę połączeń (Neon `-pooler`, pgbouncer). */
  przezPule: boolean;
  /** Pula bez `pgbouncer=true` — Prisma wyśle zapytania przygotowane, których tryb transakcyjny nie znosi. */
  brakujeFlagiPgbouncer: boolean;
};

/**
 * Czysta funkcja: URL wejściowy → URL dla Prismy + rozpoznany stan. Bez sieci i bez `process.env`,
 * żeby dała się sprawdzić testem jednostkowym dla wszystkich wariantów naraz.
 */
export function ustalPule(surowyUrl: string | undefined, limitZeSrodowiska?: string): StanPuli {
  const pusty: StanPuli = {
    url: surowyUrl ?? "",
    limit: DOMYSLNY_LIMIT_POLACZEN,
    jawnyWUrl: false,
    przezPule: false,
    brakujeFlagiPgbouncer: false,
  };
  if (!surowyUrl) return pusty;

  let u: URL;
  try {
    u = new URL(surowyUrl);
  } catch {
    // Nieparsowalny URL zostawiamy w spokoju — niech Prisma zgłosi swój własny, czytelny błąd,
    // zamiast dostać coś, co my sklejaliśmy po omacku.
    return pusty;
  }

  const przezPule = /-pooler\./.test(u.hostname) || /pgbouncer/i.test(u.hostname);
  const jawnyWUrl = u.searchParams.has("connection_limit");
  const zeSrodowiska = Number(limitZeSrodowiska);
  const limit = jawnyWUrl
    ? Number(u.searchParams.get("connection_limit"))
    : Number.isFinite(zeSrodowiska) && zeSrodowiska > 0
      ? Math.floor(zeSrodowiska)
      : DOMYSLNY_LIMIT_POLACZEN;

  if (!jawnyWUrl) u.searchParams.set("connection_limit", String(limit));

  return {
    url: u.toString(),
    limit,
    jawnyWUrl,
    przezPule,
    brakujeFlagiPgbouncer: przezPule && u.searchParams.get("pgbouncer") !== "true",
  };
}
