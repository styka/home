import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hrefPrzewodnikaModulu,
  przewodnikPoSlugu,
  szukajWPrzewodnikach,
  wszystkiePrzewodniki,
} from "@/lib/przewodniki";

/**
 * 108 — dwie rzeczy, które muszą działać, bo od nich zależą kryteria akceptacji AC-2 i AC-6.
 *
 * Test celowo NIE sprawdza treści przewodnika słowo w słowo: treść ma się zmieniać razem
 * z aplikacją, a test, który pada po każdej poprawce zdania, zostaje wyłączony. Sprawdzamy
 * mechanikę: czy moduł bez przewodnika daje `undefined` i czy wyszukiwarka trafia w rozdział.
 */

test("moduł bez przewodnika nie dostaje adresu pomocy (AC-2)", () => {
  assert.equal(hrefPrzewodnikaModulu("habits"), undefined);
  assert.equal(hrefPrzewodnikaModulu("nie-ma-takiego-modulu"), undefined);
});

test("moduł z przewodnikiem dostaje adres w dziale przewodników (AC-1)", () => {
  assert.equal(hrefPrzewodnikaModulu("notes"), "/guide/notatki");
});

test("każdy przewodnik ma co najmniej jeden rozdział z treścią", () => {
  const wszystkie = wszystkiePrzewodniki();
  assert.ok(wszystkie.length >= 2, "spodziewamy się przewodnika Notatek i Asystenta");
  for (const p of wszystkie) {
    assert.ok(p.rozdzialy.length > 0, `${p.slug} nie ma rozdziałów`);
    for (const r of p.rozdzialy) {
      assert.ok(r.markdown.trim().length > 40, `${p.slug}/${r.slug} jest pusty`);
      assert.ok(r.tekst.length > 0, `${p.slug}/${r.slug} nie ma wyciągu tekstowego`);
    }
  }
});

test("slug nieznanego przewodnika zwraca null, nie rzuca", () => {
  assert.equal(przewodnikPoSlugu("nie-ma-takiego"), null);
  assert.ok(przewodnikPoSlugu("notatki"));
});

test("wyszukiwanie wskazuje rozdział, w którym fraza występuje (AC-6)", () => {
  const wyniki = szukajWPrzewodnikach("wikilink");
  assert.ok(wyniki.length > 0, "fraza z treści przewodnika musi cokolwiek znaleźć");
  assert.ok(
    wyniki.some((w) => w.rozdzialSlug === "04-wikilinki"),
    "trafienie powinno wskazać rozdział o wikilinkach"
  );
  assert.match(wyniki[0].href, /^\/guide\/[a-z0-9-]+#[a-z0-9-]+$/);
});

test("wielkość liter i polskie znaki nie mają znaczenia (AC-6)", () => {
  const zOgonkami = szukajWPrzewodnikach("załącznik");
  const bezOgonkow = szukajWPrzewodnikach("ZALACZNIK");
  assert.ok(zOgonkami.length > 0, "fraza z ogonkami musi cokolwiek znaleźć");
  assert.deepEqual(
    bezOgonkow.map((w) => w.rozdzialSlug),
    zOgonkami.map((w) => w.rozdzialSlug),
    "pisownia bez ogonków i wielkimi literami ma dawać ten sam wynik"
  );
});

test("fraza, której nie ma, daje pustą listę — nie błąd", () => {
  assert.deepEqual(szukajWPrzewodnikach("zyrafa-na-rowerze"), []);
});

test("jedna litera nie uruchamia wyszukiwania", () => {
  // Inaczej pierwsze naciśnięcie klawisza zwracałoby wszystko, co zawiera tę literę.
  assert.deepEqual(szukajWPrzewodnikach("a"), []);
});
