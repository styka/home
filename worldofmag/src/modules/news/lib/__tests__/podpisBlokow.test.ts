import { test } from "node:test";
import assert from "node:assert/strict";
import { podpisBlokow } from "../podpisBlokow";

/**
 * 111 (AC-24) — to jest dokładnie usterka, którą naprawiamy. Zmiana poziomu streszczenia nie rusza
 * tytułu, więc podpis liczony z samych tytułów nie zmieniał się, efekt uciszający lektora się nie
 * budził i lektor czytał dalej tekst sprzed zmiany.
 */
test("zmiana samej TREŚCI zmienia podpis, choć tytuł zostaje ten sam", () => {
  const przed = podpisBlokow([{ title: "Teleskop Romana", text: "Krótkie streszczenie." }]);
  const po = podpisBlokow([
    { title: "Teleskop Romana", text: "Dłuższe, średnie streszczenie z liczbami i kontekstem." },
  ]);
  assert.notEqual(przed, po);
});

/** Bez tego lektor milkłby po pierwszym zdaniu: konsument buduje tablicę bloków przy każdym renderze. */
test("ten sam zestaw daje ten sam podpis", () => {
  const bloki = [
    { title: "A", text: "Pierwsza." },
    { title: "B", text: "Druga." },
  ];
  assert.equal(
    podpisBlokow(bloki),
    podpisBlokow(bloki.map((b) => ({ ...b }))),
  );
});

test("zdjęcie wiadomości z zestawu zmienia podpis", () => {
  const przed = podpisBlokow([
    { title: "A", text: "Pierwsza." },
    { title: "B", text: "Druga." },
  ]);
  assert.notEqual(przed, podpisBlokow([{ title: "A", text: "Pierwsza." }]));
});

/**
 * Separator musi być nie do podrobienia treścią. Gdyby był spacją, zestaw [„A"/„x", „B"/„y"]
 * i zestaw [„A"/„x B y"] dałyby ten sam podpis — a to są dwie różne listy wiadomości.
 */
test("treść nie potrafi podrobić granicy między blokami", () => {
  const dwa = podpisBlokow([
    { title: "A", text: "x" },
    { title: "B", text: "y" },
  ]);
  const jeden = podpisBlokow([{ title: "A", text: "x B y" }]);
  assert.notEqual(dwa, jeden);
});
