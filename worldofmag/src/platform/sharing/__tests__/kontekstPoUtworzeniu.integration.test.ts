import { test } from "node:test";
import assert from "node:assert/strict";
import { wpiszPrzestrzenDoKontekstu } from "../cache";
import type { AccessContext } from "../types";

/**
 * 077 (U-1) — KOREKTA KONTEKSTU PO UTWORZENIU PRZESTRZENI W TRAKCIE ŻĄDANIA.
 *
 * Scenariusz z przeglądu: konto bez przestrzeni osobistej zapisuje rekord (przestrzeń powstaje po
 * drodze), a zaraz potem sprawdzany jest do niego dostęp. Bez korekty kontekst pamięta
 * `personalWorkspaceId: null` i użytkownik dostaje odmowę do własnego, przed chwilą utworzonego
 * zasobu.
 *
 * **Dlaczego test celuje w funkcję czystą, a nie w cały przepływ.** Pierwsza wersja wołała
 * `getAccessContext` wokół `przestrzenOsobista()` i przechodziła RÓWNIEŻ po usunięciu poprawki:
 * poza runtime'em Reacta kontekst nie jest memoizowany, więc drugie wywołanie czytało bazę i
 * widziało już utworzoną przestrzeń. Zielony wynik brał się z przyczyny niezwiązanej z tym, co miał
 * mierzyć. Tu sprawdzamy to, co naprawdę może być błędne — trzy pola korekty.
 */
function pustyKontekst(): AccessContext {
  return {
    teamIds: [],
    adminTeamIds: [],
    workspaceIds: [],
    personalWorkspaceId: null,
    workspaceRoles: {},
  } as AccessContext;
}

test("korekta kontekstu ustawia przestrzeń, zakres I ROLĘ", () => {
  const ctx = pustyKontekst();
  wpiszPrzestrzenDoKontekstu(ctx, "ws-1");

  assert.equal(ctx.personalWorkspaceId, "ws-1");
  assert.deepEqual(ctx.workspaceIds, ["ws-1"]);
  // Bez roli przestrzeń istnieje, ale nie daje dostępu — pułapka rozpoznana w 056. To jest to
  // pole, którego pominięcie byłoby najtrudniejsze do zauważenia.
  assert.equal(ctx.workspaceRoles["ws-1"], "owner");
});

test("korekta jest idempotentna i nie nadpisuje istniejącej przestrzeni osobistej", () => {
  const ctx = pustyKontekst();
  ctx.personalWorkspaceId = "moja";
  ctx.workspaceIds = ["moja"];
  ctx.workspaceRoles = { moja: "owner" };

  wpiszPrzestrzenDoKontekstu(ctx, "moja");
  assert.deepEqual(ctx.workspaceIds, ["moja"], "brak duplikatu przy powtórzeniu");

  // Przestrzeń osobista jest jedna. Gdyby korekta ją nadpisywała, dopisanie innej przestrzeni
  // przestawiłoby użytkownikowi „moje" na cudze.
  wpiszPrzestrzenDoKontekstu(ctx, "inna");
  assert.equal(ctx.personalWorkspaceId, "moja", "istniejąca przestrzeń osobista nie może się zmienić");
  assert.deepEqual(ctx.workspaceIds, ["moja", "inna"]);
});
