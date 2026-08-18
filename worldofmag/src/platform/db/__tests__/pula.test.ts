import { test } from "node:test";
import assert from "node:assert/strict";
import { ustalPule, DOMYSLNY_LIMIT_POLACZEN } from "../pula";

/**
 * 084 (zadanie 28) — pula połączeń. Test bez bazy: `ustalPule` jest czystą funkcją, więc wszystkie
 * warianty da się sprawdzić naraz, łącznie z tymi, których na lokalnym Postgresie nie da się
 * odtworzyć (host puli Neona).
 */
const LOKALNY = "postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev";

test("dopisuje domyślny limit, gdy nie ma go w URL-u", () => {
  const p = ustalPule(LOKALNY);
  assert.equal(p.limit, DOMYSLNY_LIMIT_POLACZEN);
  assert.equal(p.jawnyWUrl, false);
  assert.match(p.url, new RegExp(`connection_limit=${DOMYSLNY_LIMIT_POLACZEN}`));
});

test("limit ze zmiennej środowiskowej ma pierwszeństwo przed domyślnym", () => {
  const p = ustalPule(LOKALNY, "12");
  assert.equal(p.limit, 12);
  assert.match(p.url, /connection_limit=12/);
});

test("limit JUŻ W URL-U wygrywa ze zmienną — decyzja wpisana wprost nie może zostać nadpisana", () => {
  const p = ustalPule(`${LOKALNY}?connection_limit=3`, "12");
  assert.equal(p.limit, 3);
  assert.equal(p.jawnyWUrl, true);
  assert.equal((p.url.match(/connection_limit/g) ?? []).length, 1, "parametr nie może się zdublować");
});

test("rozpoznaje pulę połączeń i BRAK flagi pgbouncer", () => {
  // Tryb transakcyjny nie znosi zapytań przygotowanych, więc Prisma potrzebuje tam `pgbouncer=true`.
  const p = ustalPule("postgresql://u:h@ep-abc-123-pooler.eu-central-1.aws.neon.tech/db?sslmode=require");
  assert.equal(p.przezPule, true);
  assert.equal(p.brakujeFlagiPgbouncer, true, "brak flagi ma być ZGŁOSZONY");
  assert.ok(!p.url.includes("pgbouncer=true"), "…ale NIE dopisany po cichu: to zmiana sposobu rozmowy z bazą");
});

test("pula z flagą nie jest zgłaszana", () => {
  const p = ustalPule("postgresql://u:h@ep-abc-123-pooler.eu-central-1.aws.neon.tech/db?pgbouncer=true");
  assert.equal(p.przezPule, true);
  assert.equal(p.brakujeFlagiPgbouncer, false);
});

test("host bezpośredni nie jest brany za pulę", () => {
  const p = ustalPule("postgresql://u:h@ep-abc-123.eu-central-1.aws.neon.tech/db");
  assert.equal(p.przezPule, false);
  assert.equal(p.brakujeFlagiPgbouncer, false);
});

test("brak URL-a i URL nieparsowalny nie wywracają startu aplikacji", () => {
  assert.equal(ustalPule(undefined).url, "");
  // Niech Prisma zgłosi swój własny, czytelny błąd zamiast dostać coś sklejonego po omacku.
  assert.equal(ustalPule("to nie jest url").url, "to nie jest url");
});
