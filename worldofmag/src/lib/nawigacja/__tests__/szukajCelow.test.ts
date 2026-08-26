import { test } from "node:test";
import assert from "node:assert/strict";
import { bezOgonkow, szukajCelow, type GalazNawigacji } from "@/lib/nawigacja/szukajCelow";

/**
 * 104 — wyszukiwarka panelu szybkiej nawigacji. Testujemy to, co decyduje o jej użyteczności na
 * telefonie: czy fraza pisana BEZ ogonków znajduje nazwę Z ogonkami.
 */

const DRZEWO: GalazNawigacji[] = [
  {
    id: "tasks",
    etykieta: "Zadania",
    href: "/tasks",
    kolor: "var(--accent-green)",
    cele: [
      { id: "tasks:zalegle", etykieta: "Zaległe", href: "/tasks/overdue" },
      { id: "tasks:nowy", etykieta: "Nowy projekt", href: "/tasks?akcja=nowy-projekt" },
    ],
  },
  {
    id: "magazynowanie",
    etykieta: "Magazynowanie",
    href: "/magazynowanie",
    kolor: "var(--accent-blue)",
    cele: [{ id: "mag:przeplyw", etykieta: "Przepływ", href: "/magazynowanie/przeplyw" }],
  },
  { id: "calendar", etykieta: "Kalendarz", href: "/calendar", kolor: "var(--accent-purple)", cele: [] },
];

test("fraza bez ogonków znajduje nazwę z ogonkami", () => {
  const wynik = szukajCelow(DRZEWO, "zalegle");
  assert.equal(wynik?.length, 1);
  assert.equal(wynik?.[0]?.etykieta, "Zaległe");
});

test("litera ł też — nie ma rozkładu kanonicznego, więc wymaga osobnej podmiany", () => {
  // To jest przypadek, dla którego cała normalizacja powstała: `normalize("NFD")` NIE rozkłada
  // litery ł na l + znak łączący, bo to osobna litera, a nie „l z ogonkiem".
  assert.equal(bezOgonkow("Przepływ"), "przeplyw");
  const wynik = szukajCelow(DRZEWO, "przeplyw");
  assert.equal(wynik?.length, 1);
  assert.equal(wynik?.[0]?.etykieta, "Przepływ");
});

test("działa też w drugą stronę: fraza z ogonkami znajduje wpis", () => {
  assert.equal(szukajCelow(DRZEWO, "Zaległe")?.length, 1);
});

test("trafienie w NAZWĘ MODUŁU wciąga jego cele", () => {
  // Kto wpisał „zadania", chce zobaczyć, co w Zadaniach może zrobić — a nie sam wiersz „Zadania".
  const wynik = szukajCelow(DRZEWO, "zadania");
  assert.deepEqual(wynik?.map((w) => w.etykieta), ["Zadania", "Zaległe", "Nowy projekt"]);
  assert.equal(wynik?.[0]?.modul, null, "sam moduł nie ma nadrzędnego modułu");
  assert.equal(wynik?.[1]?.modul, "Zadania", "cel niesie przynależność modułu");
});

test("pusta fraza zwraca null — panel ma wtedy pokazać drzewo, nie listę wszystkiego", () => {
  assert.equal(szukajCelow(DRZEWO, ""), null);
  assert.equal(szukajCelow(DRZEWO, "   "), null, "same spacje to nadal brak frazy");
});

test("fraza bez trafień zwraca pustą listę, a nie null", () => {
  // Rozróżnienie jest istotne dla panelu: `null` znaczy „nie szukam", `[]` znaczy „szukałem i nie ma".
  assert.deepEqual(szukajCelow(DRZEWO, "kwiaciarnia"), []);
});

test("moduł bez celów nadal daje się znaleźć po swojej nazwie", () => {
  const wynik = szukajCelow(DRZEWO, "kalend");
  assert.equal(wynik?.length, 1);
  assert.equal(wynik?.[0]?.href, "/calendar");
});

test("wielkość liter nie ma znaczenia", () => {
  assert.equal(szukajCelow(DRZEWO, "ZADANIA")?.length, 3);
});
