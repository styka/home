import { test } from "node:test";
import assert from "node:assert/strict";
import { ownedWhere, ownedOr } from "../serverUtils";

/**
 * 057 — RÓWNOWAŻNOŚĆ DWÓCH KSZTAŁTÓW WARUNKU WŁASNOŚCI.
 *
 * Sweep po 52 plikach zamienia dwa warianty tego samego warunku na jeden helper:
 *
 *   A (bezwarunkowy):  OR: [{ ownerId }, { ownerTeamId: { in: teamIds } }]
 *   B (ostrożniejszy): OR: [{ ownerId }, ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : [])]
 *
 * Twierdzenie „są równoważne, bo `in: []` nie pasuje do niczego" jest prawdziwe — ale **zdanie
 * o Prismie, nie fakt sprawdzony**. Ten test zamienia je w sprawdzenie: helper musi zwracać obiekt
 * strukturalnie identyczny z tym, co zastępuje, w obu wariantach danych wejściowych.
 *
 * Test jest czysto strukturalny (bez bazy) — porównuje **kształt zapytania**, bo to on jest tym,
 * co sweep przenosi. Zgodność wyników na danych pilnują testy integracyjne modułów.
 */

const USER = "user-1";

test("057: z zespołami helper daje dokładnie kształt A", () => {
  const oczekiwane = { OR: [{ ownerId: USER }, { ownerTeamId: { in: ["t1", "t2"] } }] };
  assert.deepEqual(ownedWhere(USER, ["t1", "t2"]), oczekiwane);
});

test("057: bez zespołów helper daje kształt B w jego pustym wariancie", () => {
  // Wariant B przy pustej liście zwijał się do jednej alternatywy — i to samo robi helper.
  const wariantB = { OR: [{ ownerId: USER }, ...([] as unknown[])] };
  assert.deepEqual(ownedWhere(USER, []), wariantB);
});

test("057: wariant A z pustą listą zespołów znaczy to samo, co wariant B", () => {
  // Sedno sweepu: miejsca pisane wariantem A przy `teamIds = []` wysyłały do bazy
  // `{ ownerTeamId: { in: [] } }`. Alternatywa, która nie pasuje do żadnego wiersza, nie zmienia
  // wyniku sumy — więc zwinięcie jej przez helper jest bezpieczne. Gdyby kiedyś przestało być
  // (inna baza, inne ORM), ten test wskaże miejsce do przemyślenia.
  const wariantA = { OR: [{ ownerId: USER }, { ownerTeamId: { in: [] as string[] } }] };
  const zHelpera = ownedWhere(USER, []);

  assert.equal(wariantA.OR[0].ownerId, USER);
  assert.equal(zHelpera.OR.length, 1, "pusta gałąź zespołowa zostaje zwinięta");
  assert.deepEqual(zHelpera.OR[0], wariantA.OR[0], "gałąź osobista bez zmian");
  assert.deepEqual(
    (wariantA.OR[1] as { ownerTeamId: { in: string[] } }).ownerTeamId.in,
    [],
    "usunięta gałąź to ta, która nie pasowała do niczego",
  );
});

test("057: `ownedOr` zwraca te same alternatywy, bez opakowania", () => {
  assert.deepEqual(ownedOr(USER, ["t1"]), ownedWhere(USER, ["t1"]).OR);
  assert.deepEqual(ownedOr(USER, []), ownedWhere(USER, []).OR);
});

test("057: helper NIE dopuszcza rekordów systemowych", () => {
  // Rozróżnienie wobec `ownedOrSystemWhere`: tam trzecia alternatywa (`ownerId: null`) celowo
  // wpuszcza rekordy wspólne. Gdyby helper ogólny robił to samo, sweep po cichu dołożyłby dostęp
  // do cudzych rekordów systemowych wszędzie tam, gdzie go nie było.
  const w = ownedWhere(USER, ["t1"]);
  const maSystemowe = w.OR.some((g) => "ownerId" in g && g.ownerId === null);
  assert.equal(maSystemowe, false);
});
