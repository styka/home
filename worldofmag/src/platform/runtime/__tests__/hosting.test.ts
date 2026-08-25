import { test } from "node:test";
import assert from "node:assert/strict";
import { czyNaHostingu } from "../hosting";

/**
 * 104 (punkt 3) — ta funkcja decyduje, czy uproszczone logowanie testowe w ogóle istnieje.
 * Pomyłka w którąkolwiek stronę jest kosztowna: zbyt wąska wywraca klikacze, zbyt szeroka
 * zostawia na hostingu drogę logowania bez hasła.
 */

test("na hostingu — rozpoznane po każdym ze znaczników Rendera", () => {
  assert.equal(czyNaHostingu({ RENDER: "true" }), true);
  assert.equal(czyNaHostingu({ RENDER_SERVICE_ID: "srv-abc" }), true);
  assert.equal(czyNaHostingu({ RENDER_GIT_BRANCH: "master" }), true);
});

test("poza hostingiem — także w BUDOWIE PRODUKCYJNEJ, bo tak chodzą klikacze", () => {
  // To jest sedno: `next start` ustawia NODE_ENV=production, a mimo to nie jesteśmy na hostingu.
  // Gdyby ta asercja padła, cały zestaw klikaczy przestałby móc się zalogować.
  assert.equal(czyNaHostingu({ NODE_ENV: "production" }), false);
  assert.equal(czyNaHostingu({}), false);
});

test("pusty znacznik nie liczy się jako hosting", () => {
  assert.equal(czyNaHostingu({ RENDER: "", RENDER_SERVICE_ID: "" }), false);
});
