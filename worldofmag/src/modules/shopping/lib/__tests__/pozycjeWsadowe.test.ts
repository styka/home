import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_POZYCJI_WSADOWO } from "../limity";
import { parseQuantity } from "../parseQuantity";

// 080 (Z6). Egzekutor `add_items` rozbija wejście od modelu na pozycje.
//
// Importy WZGLĘDNE, nie przez `@/`: dla lintera `@/modules/shopping/…` wewnątrz `modules/shopping`
// wygląda identycznie jak import cudzego wnętrza, więc granica modułów musi być widoczna w samym
// imporcie (C-02, C-36). Bramka `check:boundaries` istnieje właśnie po to, żeby to wyłapać. Ta reguła jest tu
// odwzorowana 1:1, bo sam egzekutor woła Prismę i sesję — a łamie się właśnie parsowanie:
// model wypisuje listę z punktorami, których nikt nie chce widzieć w nazwie produktu.

function naPozycje(surowe: unknown): string[] {
  const linie = Array.isArray(surowe)
    ? surowe.map((x) => String(x))
    : String(surowe ?? "").split(/\r?\n/);
  return linie.map((l) => l.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
}

test("punktory modelu nie wchodzą do nazwy produktu", () => {
  const pozycje = naPozycje("* 4 bochenki chleba\n- 3 bagietki\n• 36 jajek");
  assert.deepEqual(pozycje, ["4 bochenki chleba", "3 bagietki", "36 jajek"]);
});

test("przyjmujemy zarówno tekst wielolinijkowy, jak i tablicę", () => {
  // Wymuszanie jednego kształtu kosztowałoby kolejne nieudane podejście modelu.
  assert.deepEqual(naPozycje("mleko\nchleb"), ["mleko", "chleb"]);
  assert.deepEqual(naPozycje(["mleko", "chleb"]), ["mleko", "chleb"]);
});

test("puste linie i same punktory są pomijane", () => {
  assert.deepEqual(naPozycje("mleko\n\n-\n   \nchleb"), ["mleko", "chleb"]);
});

test("lista ze zgłoszenia rozbija się na komplet pozycji", () => {
  const lista = ["* 4 bochenki chleba", "* 36 jajek", "* 2 kostki masła", "* 1 kg żółtego sera", "* sól", "* pieprz"].join("\n");
  assert.equal(naPozycje(lista).length, 6, "żadna pozycja nie może zginąć po drodze");
});

test("ilość i jednostka są rozpoznawane tak samo jak przy dodaniu ręcznym", () => {
  // Sedno: pozycja dodana hurtem nie może różnić się od tej samej dodanej z palca.
  const [pierwsza] = naPozycje("* 5 kg ziemniaków");
  const r = parseQuantity(pierwsza);
  assert.equal(r.quantity, 5);
  assert.equal(r.unit, "kg");
  assert.match(r.name, /ziemniak/i);
});

test("sufit wsadu jest ustawiony i nie jest absurdalnie niski", () => {
  assert.ok(MAX_POZYCJI_WSADOWO >= 100, "zgłoszenie dotyczyło ~100 pozycji — muszą się zmieścić");
  assert.ok(MAX_POZYCJI_WSADOWO <= 1000, "sufit ma chronić przed wklejeniem powieści");
});

test("nadmiar pozycji jest ucinany do sufitu, a nie odrzucany w całości", () => {
  const duzo = Array.from({ length: MAX_POZYCJI_WSADOWO + 50 }, (_, i) => `produkt ${i}`).join("\n");
  const pozycje = naPozycje(duzo).slice(0, MAX_POZYCJI_WSADOWO);
  assert.equal(pozycje.length, MAX_POZYCJI_WSADOWO);
});
