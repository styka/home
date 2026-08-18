import { prisma } from "@/platform/db/prisma";
import { uruchomRetencje, type PolitykaRetencji, type WynikRetencji } from "./index";

/**
 * 083 (zadanie 30, Faza 5) — KIEDY RETENCJA CHODZI.
 *
 * **Dlaczego nie zadanie w kolejce.** Mapa handlerów jest jednocześnie **allowlistą tego, co klient
 * może zakolejkować z przeglądarki** (049). Retencja kasuje dane; dopisanie jej tam poszerzyłoby
 * tę listę o operację niszczącą, żeby zyskać kafelek w `/admin/jobs`. Chodzi więc tak jak
 * `cleanupOldJobs`: z okresowego tyknięcia workera.
 *
 * **Dlaczego mimo to nie robi tego po prostu `setInterval`.** Tyknięcie chodzi w KAŻDEJ instancji
 * `web`, a retencja ma sens raz na dobę. Prawo do przebiegu jest więc *odbierane atomowo*
 * — warunkowym `UPDATE` na wierszu w `Config`: dostaje je ta instancja, której zapis się powiódł.
 * Wersja „odczytaj znacznik, porównaj, zapisz" przepuszcza dwie instancje naraz (obie widzą stary
 * znacznik). Podwójny przebieg sam w sobie jest nieszkodliwy — drugi nic nie znajduje — ale dwa
 * równoległe `deleteMany` na tych samych wierszach to zbędne blokady na tabelach, których dotyczy
 * cała aplikacja.
 *
 * Po zadaniu 33 (rozdzielenie `web`/`worker`/`cron`) właściwym miejscem będzie proces `cron`;
 * odbieranie prawa zostanie i tam, bo chroni też przed nakładającymi się przebiegami.
 */
export const RETENCJA_ZNACZNIK_KLUCZ = "retention_last_run";
export const RETENCJA_WYNIK_KLUCZ = "retention_last_result";
const DOBA_MS = 24 * 60 * 60 * 1000;

/**
 * Próbuje odebrać prawo do przebiegu. `true` = ta instancja ma je i tylko ona.
 * Wiersza jeszcze nie ma → pierwszy zapis wygrywa dzięki `ON CONFLICT DO NOTHING`.
 */
export async function odbierzPrawoDoPrzebiegu(odstepMs = DOBA_MS): Promise<boolean> {
  const teraz = new Date().toISOString();
  const granica = new Date(Date.now() - odstepMs).toISOString();
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "Config" ("id", "key", "value", "updatedAt")
    VALUES (gen_random_uuid()::text, ${RETENCJA_ZNACZNIK_KLUCZ}, ${teraz}, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = EXCLUDED."value", "updatedAt" = now()
      WHERE "Config"."value" < ${granica}
    RETURNING "key"
  `;
  return rows.length > 0;
}

/** Jeden przebieg retencji, jeśli minęła doba od poprzedniego. Zwraca `null`, gdy nie było przebiegu. */
export async function retencjaJesliCzas(
  polityki: PolitykaRetencji[],
  odstepMs = DOBA_MS
): Promise<WynikRetencji[] | null> {
  if (!(await odbierzPrawoDoPrzebiegu(odstepMs))) return null;
  const wyniki = await uruchomRetencje(polityki);
  // Wynik trafia do `Config`, żeby administrator widział w `/admin/config`, co i kiedy zniknęło.
  // Bez tego jedynym śladem po kasowaniu danych byłby brak danych.
  await prisma.config.upsert({
    where: { key: RETENCJA_WYNIK_KLUCZ },
    update: { value: JSON.stringify(wyniki) },
    create: { key: RETENCJA_WYNIK_KLUCZ, value: JSON.stringify(wyniki) },
  });
  return wyniki;
}
