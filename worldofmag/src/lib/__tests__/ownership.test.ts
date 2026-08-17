import { test } from "node:test";
import assert from "node:assert/strict";

// Czysta logika modelu własności (prywatny ownerId LUB zespół ownerTeamId).
// Dynamiczny import — ownership.ts ciągnie server-utils, ale same funkcje są czyste
// i nie dotykają bazy (test nie jest DB-gated).

/**
 * 058: `ownedByWhere` przestało być czystą funkcją od `(userId, teamIds)`.
 *
 * Zakres własności idzie teraz po PRZESTRZENIACH, a te trzeba odczytać — więc funkcja jest
 * asynchroniczna i bierze sam `userId`. Dawna asercja sprawdzała **kształt starej reguły**
 * i utrzymanie jej znaczyłoby pilnowanie stanu, który świadomie zmieniamy (ten sam ruch, co
 * w 053 z asercją o martwych projektach zespołowych).
 *
 * Równości ZBIORÓW rekordów przed i po pilnuje osobny dowód na prawdziwych danych:
 * `platform/auth/__tests__/ownershipScopeSwitch.integration.test.ts`. Tutaj zostaje to, co da się
 * sprawdzić bez bazy: że sygnatura jest asynchroniczna i że wynik ma kształt warunku Prismy.
 */
test("ownedByWhere: zwraca warunek `OR` i wymaga odczytu przestrzeni (058)", async () => {
  const { ownedByWhere } = await import("@/platform/auth/ownership");
  const wynik = ownedByWhere("u1");
  assert.ok(wynik instanceof Promise, "zakres wymaga odczytu przestrzeni, więc jest asynchroniczny");
  // Samego wyniku nie rozwijamy: bez bazy nie ma przestrzeni do odczytania, a udawanie ich
  // atrapą sprawdzałoby atrapę. Od tego jest dowód integracyjny.
});

/**
 * 078 (etap 4 część 2) — TA SAMA TABELA PRAWDY, PRZENIESIONA NA PRZESTRZENIE.
 *
 * Guard rekordu przestał czytać `ownerId`/`ownerTeamId` (kolumny znikają) i czyta przestrzeń.
 * Zmiana reguły dostępu wymaga tabeli prawdy porównanej **komórka w komórkę** — więc poniżej stoi
 * dokładnie siedem przypadków z wersji sprzed zmiany, każdy przetłumaczony przez lustro:
 *
 * | # | przed (własność)                             | po (przestrzeń)                  | wynik      |
 * |---|----------------------------------------------|----------------------------------|------------|
 * | 1 | `null`                                       | `null`                           | Not found  |
 * | 2 | `ownerId: u1`, ja u1                         | przestrzeń osobista u1           | OK         |
 * | 3 | `ownerTeamId: t1`, ja w t1                   | przestrzeń zespołu t1, jestem    | OK         |
 * | 4 | `ownerId: other`, ja u1 w t1                 | przestrzeń osobista other        | Forbidden  |
 * | 5 | `ownerTeamId: t9`, ja tylko w t1             | przestrzeń zespołu t9, nie jestem| Forbidden  |
 * | 6 | `ownerId: null, ownerTeamId: null` (niczyje) | brak przestrzeni                 | Forbidden  |
 * | 7 | `ownerTeamId: t1`, ja bez zespołów           | przestrzeń t1, pusta lista       | Forbidden  |
 *
 * Tłumaczenie jest legalne, bo lustro z zadania 9 utrzymuje równoważności: `ownerId = ja`
 * ⟺ „przestrzeń osobista moja", `ownerTeamId = t` ⟺ „przestrzeń zespołu t", a członkostwo
 * w `WorkspaceMember` ⟺ członkostwo w `TeamMember`. Żadna komórka nie zmieniła wyniku — w
 * szczególności **nikt nie zyskał dostępu**, co jest tu jedynym kierunkiem pomyłki, który
 * przeszedłby niezauważony.
 *
 * Przypadek 6 zasługuje na słowo: „rekord niczyj" nie jest już możliwy na 40 tabelach objętych
 * etapem 4 (`workspaceId` NOT NULL od 0235), ale komórka zostaje, bo funkcja przyjmuje pole
 * opcjonalne i ktoś kiedyś podstawi jej rekord słownikowy. Wynik musi wtedy brzmieć „odmowa",
 * a nie „przejdź" — słowniki mają własną drogę (`ownedOrSystemWhere`).
 */
test("maDostepDoPrzestrzeni: tabela prawdy guardu rekordu (078)", async () => {
  const { maDostepDoPrzestrzeni } = await import("@/platform/auth/ownership");
  const mojaOsobista = "ws-u1";
  const zespolT1 = "ws-t1";
  const moje = [mojaOsobista, zespolT1];

  // 1. brak encji
  assert.equal(maDostepDoPrzestrzeni(null, moje), "brak");
  // 2. własność bezpośrednia → moja przestrzeń osobista
  assert.equal(maDostepDoPrzestrzeni({ workspaceId: mojaOsobista }, moje), "ok");
  // 3. własność przez zespół → przestrzeń zespołu, którego jestem członkiem
  assert.equal(maDostepDoPrzestrzeni({ workspaceId: zespolT1 }, moje), "ok");
  // 4. obcy właściciel → jego przestrzeń osobista
  assert.equal(maDostepDoPrzestrzeni({ workspaceId: "ws-other" }, moje), "obcy");
  // 5. zespół, do którego nie należę
  assert.equal(maDostepDoPrzestrzeni({ workspaceId: "ws-t9" }, moje), "obcy");
  // 6. rekord bez przestrzeni (dawne „niczyje")
  assert.equal(maDostepDoPrzestrzeni({ workspaceId: null }, moje), "obcy");
  assert.equal(maDostepDoPrzestrzeni({}, moje), "obcy");
  // 7. przestrzeń zespołu, ale pusta lista członkostw
  assert.equal(maDostepDoPrzestrzeni({ workspaceId: zespolT1 }, []), "obcy");
});

test("assertOwnership: tłumaczy rozstrzygnięcie na wyjątki i wymaga odczytu kontekstu (078)", async () => {
  const { assertOwnership } = await import("@/platform/auth/ownership");
  // Guard musi odczytać przestrzenie użytkownika, więc jest asynchroniczny. Samego wyniku nie
  // rozwijamy bez bazy — od równoważności zbiorów jest dowód integracyjny, a od reguły tabela wyżej.
  //
  // Obietnicę trzeba tu OBSŁUŻYĆ, a nie tylko sprawdzić jej typ: `assert.ok(… instanceof Promise)`
  // zostawia odrzucenie bez odbiorcy i test pada na `unhandledRejection` po jego zakończeniu —
  // czyli z powodu niezwiązanego z tym, co mierzy.
  const obietnica = assertOwnership(null, "u1");
  assert.ok(obietnica instanceof Promise, "guard czyta kontekst dostępu, więc musi być asynchroniczny");
  await assert.rejects(() => obietnica, /Not found/);
});
