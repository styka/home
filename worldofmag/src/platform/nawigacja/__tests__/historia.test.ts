import { test } from "node:test";
import assert from "node:assert/strict";
import { dopisz, odczytaj, zapisz, LIMIT_HISTORII, type WpisHistorii } from "@/platform/nawigacja/historia";

/**
 * 103 — historia odwiedzonych stron. Testujemy dwie rzeczy, które objawiłyby się dopiero na
 * telefonie: kolejność (poprzednia strona ma być najbliżej palca) i to, że brak pamięci nie
 * wywraca powłoki.
 */

function w(sciezka: string, czas = 1): WpisHistorii {
  return { sciezka, etykieta: sciezka, czas };
}

test("najświeższy wpis jest PIERWSZY — tak układa go wachlarz przy kciuku (AC-11)", () => {
  const lista = dopisz(dopisz([], w("/tasks", 1)), w("/shopping", 2));
  assert.deepEqual(lista.map((x) => x.sciezka), ["/shopping", "/tasks"]);
});

test("powtórzenie tej samej ścieżki pod rząd jest scalane, nie dopisywane (AC-15)", () => {
  let lista: WpisHistorii[] = [];
  for (let i = 0; i < 5; i++) lista = dopisz(lista, w("/tasks", i));
  assert.equal(lista.length, 1, "odświeżenie strony nie ma produkować kolejnych wpisów");
});

test("ponowne odwiedziny AWANSUJĄ ścieżkę, zamiast dublować ją w liście", () => {
  let lista: WpisHistorii[] = [];
  lista = dopisz(lista, w("/tasks", 1));
  lista = dopisz(lista, w("/shopping", 2));
  lista = dopisz(lista, w("/tasks", 3));
  assert.deepEqual(lista.map((x) => x.sciezka), ["/tasks", "/shopping"]);
});

test("lista jest przycięta do limitu — najstarsze wypadają (AC-15)", () => {
  let lista: WpisHistorii[] = [];
  for (let i = 0; i < LIMIT_HISTORII + 5; i++) lista = dopisz(lista, w(`/s${i}`, i));
  assert.equal(lista.length, LIMIT_HISTORII);
  assert.equal(lista[0]?.sciezka, `/s${LIMIT_HISTORII + 4}`, "na początku stoi najświeższy");
});

test("brak pamięci sesji to POPRAWNY stan, nie wyjątek", () => {
  const oryginal = globalThis.window;
  // Prywatne okno części przeglądarek rzuca przy samym dostępie do `sessionStorage`.
  (globalThis as { window?: unknown }).window = {
    get sessionStorage(): Storage {
      throw new Error("dostęp zablokowany");
    },
  };
  try {
    assert.deepEqual(odczytaj(), [], "odczyt ma zwrócić pustą historię");
    assert.doesNotThrow(() => zapisz([w("/tasks")]), "zapis ma milczeć, a nie wywracać powłoki");
  } finally {
    (globalThis as { window?: unknown }).window = oryginal;
  }
});

test("uszkodzona zawartość pamięci nie przedostaje się do wachlarza", () => {
  const oryginal = globalThis.window;
  let zawartosc = "";
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: () => zawartosc,
      setItem: (_k: string, v: string) => { zawartosc = v; },
    },
  };
  try {
    zawartosc = "{ to nie jest JSON";
    assert.deepEqual(odczytaj(), []);

    zawartosc = JSON.stringify({ nie: "tablica" });
    assert.deepEqual(odczytaj(), []);

    // Wpis podrobiony ręcznie w pamięci przeglądarki nie może wyprowadzić poza aplikację —
    // ta sama reguła, którą `normalizeFavoritePath` stosuje do ulubionych.
    zawartosc = JSON.stringify([
      { sciezka: "//zly.example", etykieta: "Obcy", czas: 1 },
      { sciezka: "/tasks", etykieta: "Zadania", czas: 2 },
    ]);
    assert.deepEqual(odczytaj().map((x) => x.sciezka), ["/tasks"]);
  } finally {
    (globalThis as { window?: unknown }).window = oryginal;
  }
});

test("zapis i odczyt są zgodne", () => {
  const oryginal = globalThis.window;
  let zawartosc = "";
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: () => zawartosc,
      setItem: (_k: string, v: string) => { zawartosc = v; },
    },
  };
  try {
    zapisz([w("/tasks", 7)]);
    assert.deepEqual(odczytaj(), [w("/tasks", 7)]);
  } finally {
    (globalThis as { window?: unknown }).window = oryginal;
  }
});
