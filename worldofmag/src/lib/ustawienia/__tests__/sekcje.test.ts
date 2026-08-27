import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SEKCJE_USTAWIEN, bezOgonkow, pasujeDoFrazy, znajdzSekcje } from "../sekcje";

/**
 * 109 — ZASTĘPSTWO ZA BRAMKĘ i18n DLA KLUCZY PODAWANYCH ZMIENNĄ.
 *
 * `check:i18n` sprawdza wyłącznie wywołania `t("literał")` — musi, bo tylko wtedy zna klucz bez
 * uruchamiania kodu. Spis ustawień woła `t(sekcja.kluczNazwy)`, więc dla bramki jest niewidzialny:
 * literówka w kluczu przeszłaby build i wyszła dopiero na ekranie użytkownika, jako nazwa sekcji
 * zastąpiona surowym kluczem. Ten test domyka tę lukę na dokładnie tym samym poziomie.
 */

const komunikaty = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "messages/pl.json"), "utf8"),
) as Record<string, unknown>;

/** Przestrzeń, w której spis czyta swoje teksty — musi zgadzać się z `useTranslations` w komponencie. */
const PRZESTRZEN = "components.settings.SpisUstawien";

function wartosc(sciezka: string): unknown {
  let biezacy: unknown = komunikaty;
  for (const czesc of sciezka.split(".")) {
    if (typeof biezacy !== "object" || biezacy === null) return undefined;
    biezacy = (biezacy as Record<string, unknown>)[czesc];
  }
  return biezacy;
}

test("każdy klucz tekstu sekcji istnieje w messages/pl.json", () => {
  for (const sekcja of SEKCJE_USTAWIEN) {
    for (const klucz of [sekcja.kluczNazwy, sekcja.kluczOpisu, sekcja.kluczHasel]) {
      const pelny = `${PRZESTRZEN}.${klucz}`;
      assert.equal(
        typeof wartosc(pelny),
        "string",
        `brak klucza ${pelny} — sekcja „${sekcja.id}" wyświetliłaby surowy klucz zamiast nazwy`,
      );
    }
  }
});

test("identyfikatory sekcji są unikalne i nadają się na segment adresu", () => {
  const widziane = new Set<string>();
  for (const sekcja of SEKCJE_USTAWIEN) {
    assert.ok(!widziane.has(sekcja.id), `zduplikowany identyfikator sekcji: ${sekcja.id}`);
    widziane.add(sekcja.id);
    // Adres ma się dać przepisać z ekranu i wysłać — bez diakrytyków i bez znaków do kodowania.
    assert.match(sekcja.id, /^[a-z][a-z0-9-]*$/, `identyfikator „${sekcja.id}" nie nadaje się na segment adresu`);
  }
});

test("znajdzSekcje zwraca sekcję po identyfikatorze, a nieznany segment to brak wyniku", () => {
  assert.equal(znajdzSekcje("wyglad")?.id, "wyglad");
  // Segment `team` jest statyczną trasą zespołów; jako sekcja NIE istnieje i ma dać 404.
  assert.equal(znajdzSekcje("team"), undefined);
  assert.equal(znajdzSekcje("nieistniejaca"), undefined);
});

test("wyszukiwanie działa bez polskich znaków", () => {
  assert.equal(bezOgonkow("Język"), "jezyk");
  assert.equal(bezOgonkow("Prywatność"), "prywatnosc");
  // `ł` nie jest literą z akcentem — NFD go nie rozkłada, więc wymaga jawnej podmiany.
  assert.equal(bezOgonkow("Połączenia"), "polaczenia");

  const nazwa = "Język i strefa czasowa";
  const opis = "Język przestrzeni i strefa, w której liczone są daty.";
  const hasla = "jezyk strefa czasowa lokalizacja";
  assert.equal(pasujeDoFrazy("jezyk", nazwa, opis, hasla), true);
  assert.equal(pasujeDoFrazy("JĘZYK", nazwa, opis, hasla), true);
  assert.equal(pasujeDoFrazy("strefa czasowa", nazwa, opis, hasla), true);
  assert.equal(pasujeDoFrazy("qqq", nazwa, opis, hasla), false);
});

test("pusta fraza pokazuje wszystko, a nie nic", () => {
  // Stan początkowy pola szukania to pusty ciąg — gdyby filtr traktował go jak brak trafień,
  // spis byłby pusty zanim użytkownik cokolwiek napisze.
  assert.equal(pasujeDoFrazy("", "Konto", "Twój profil", "profil"), true);
  assert.equal(pasujeDoFrazy("   ", "Konto", "Twój profil", "profil"), true);
});

test("hasła pomocnicze prowadzą do sekcji, której nazwa ich nie zawiera", () => {
  const sekcja = SEKCJE_USTAWIEN.find((s) => s.id === "polaczenia");
  assert.ok(sekcja);
  const hasla = wartosc(`${PRZESTRZEN}.${sekcja!.kluczHasel}`) as string;
  // „drive" nie pada w nazwie ani w opisie — po to są hasła.
  assert.ok(bezOgonkow(hasla).includes("drive"), "sekcja Połączenia musi być znajdowana po słowie „drive”");
});
