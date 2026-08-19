import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";

/**
 * 097 (zadanie 35) — SŁOWNIK KOMUNIKATÓW MUSI DAĆ SIĘ SPARSOWAĆ.
 *
 * Po wyciągnięciu ~1300 tekstów z komponentów `messages/pl.json` przestał być plikiem, który ktoś
 * czyta w całości przed wdrożeniem. Dwie rzeczy psują się w nim cicho:
 *
 *   1. **Zły ICU.** `{n, plural, one {…}}` bez gałęzi `other` albo z literówką w nazwie kategorii
 *      wywala się dopiero przy renderowaniu tego jednego komponentu, u tego jednego użytkownika,
 *      przy tej jednej liczbie. Parser wyłapuje to tutaj, w milisekundach.
 *   2. **Nawias klamrowy w treści.** Tekst przeniesiony z JSX potrafi zawierać `{` — dla ICU to
 *      początek argumentu, więc napis, który w kodzie był nieszkodliwy, w słowniku jest błędem.
 *
 * Bramka `check:i18n` pilnuje, że każdy KLUCZ istnieje; ten test pilnuje, że każda WARTOŚĆ jest
 * poprawna. Jedno bez drugiego zostawia połowę drogi.
 */

const KORZEN = path.join(process.cwd(), "messages");

function splasz(obiekt: unknown, prefiks = ""): [string, string][] {
  if (typeof obiekt === "string") return [[prefiks, obiekt]];
  if (typeof obiekt !== "object" || obiekt === null) return [];
  return Object.entries(obiekt as Record<string, unknown>).flatMap(([k, v]) =>
    k.startsWith("_") ? [] : splasz(v, prefiks ? `${prefiks}.${k}` : k),
  );
}

test("messages/pl.json: każdy komunikat jest poprawnym ICU", () => {
  const plik = path.join(KORZEN, "pl.json");
  const wpisy = splasz(JSON.parse(fs.readFileSync(plik, "utf8")));
  assert.ok(wpisy.length > 1000, `spodziewamy się pełnego słownika, jest ${wpisy.length} wpisów`);

  const bledy: string[] = [];
  for (const [klucz, tekst] of wpisy) {
    try {
      parse(tekst);
    } catch (e) {
      bledy.push(`${klucz}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  assert.deepEqual(bledy, [], "komunikaty, których ICU nie potrafi sparsować");
});

test("messages/pl.json: brak pustych i brak zdublowanych wartości pod tym samym kluczem", () => {
  const wpisy = splasz(JSON.parse(fs.readFileSync(path.join(KORZEN, "pl.json"), "utf8")));
  const puste = wpisy.filter(([, v]) => !v.trim()).map(([k]) => k);
  assert.deepEqual(puste, [], "pusty komunikat to w interfejsie pusty napis, a nie brak elementu");
  const klucze = wpisy.map(([k]) => k);
  assert.equal(new Set(klucze).size, klucze.length, "klucz nie może wystąpić dwa razy");
});
