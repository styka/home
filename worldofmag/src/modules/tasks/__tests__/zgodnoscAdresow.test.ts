import { test } from "node:test";
import assert from "node:assert/strict";

// 080 (Z3). Zakres widoku przeniósł się z parametrów zapytania do segmentu ścieżki, bo tylko tak
// przeżywa ponowny render wywołany z akcji. Ale właściciel ma stare adresy w ULUBIONYCH WIDOKACH
// (`FavoriteView.path`), więc muszą dalej otwierać ten sam zakres — inaczej naprawa jednego
// zgłoszenia zepsułaby inną funkcję.
//
// Reguła przekierowania jest tu odwzorowana 1:1 z `src/app/tasks/[projectId]/page.tsx`.

function przekieruj(searchParams: Record<string, string | undefined>): string {
  const { group, view, projects, ...reszta } = searchParams;
  const ogon = new URLSearchParams(
    Object.entries(reszta).filter((e): e is [string, string] => typeof e[1] === "string")
  ).toString();
  const przyrostek = ogon ? `?${ogon}` : "";

  const zestaw = group ?? view;
  if (zestaw) return `/tasks/zestaw/${zestaw}${przyrostek}`;

  const wybrane = (projects ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const parametry = new URLSearchParams(
    Object.entries(reszta).filter((e): e is [string, string] => typeof e[1] === "string")
  );
  if (wybrane.length > 0) parametry.set("projekty", wybrane.join(","));
  const zapytanie = parametry.toString();
  return `/tasks/all${zapytanie ? `?${zapytanie}` : ""}`;
}

test("zapisany zestaw: ?group= trafia do segmentu ścieżki", () => {
  assert.equal(przekieruj({ group: "abc123" }), "/tasks/zestaw/abc123");
});

test("alias sprzed 043 (?view=) działa tak samo", () => {
  assert.equal(przekieruj({ view: "abc123" }), "/tasks/zestaw/abc123");
});

test("filtry z ulubionego widoku NIE giną przy przekierowaniu", () => {
  // To jest sedno AC-6: ulubiony widok to ścieżka Z PARAMETRAMI. Zgubienie filtra przy
  // przekierowaniu byłoby cichą regresją — widok otworzyłby się, ale pokazał co innego.
  const cel = przekieruj({ group: "abc", status: "IN_PROGRESS", tags: "t1,t2", layout: "kanban" });
  assert.ok(cel.startsWith("/tasks/zestaw/abc?"));
  assert.match(cel, /status=IN_PROGRESS/);
  assert.match(cel, /tags=t1%2Ct2/);
  assert.match(cel, /layout=kanban/);
});

test("doraźny wybór projektów staje się FILTREM widoku zbiorczego", () => {
  assert.equal(przekieruj({ projects: "p1,p2" }), "/tasks/all?projekty=p1%2Cp2");
});

test("pusty zakres nie prowadzi do pustego widoku, tylko do wszystkich zadań", () => {
  // Dokładnie ten przypadek dawał wcześniej „🗂 Wiele projektów (0)".
  assert.equal(przekieruj({}), "/tasks/all");
  assert.equal(przekieruj({ projects: "" }), "/tasks/all");
  assert.equal(przekieruj({ projects: " , " }), "/tasks/all");
});

test("nieistniejące id projektów nie wywraca adresu", () => {
  // Walidacja należy do widoku; przekierowanie ma tylko nie zgubić intencji.
  assert.match(przekieruj({ projects: "nie-ma-takiego" }), /^\/tasks\/all\?projekty=/);
});
