import { test } from "node:test";
import assert from "node:assert/strict";
import { planDef, PLANS } from "@/lib/plans";

test("planDef: znany klucz → plan; null/nieznany/pusty → free (NIGDY premium)", () => {
  assert.equal(planDef("premium").key, "premium");
  assert.equal(planDef("free").key, "free");
  assert.equal(planDef(null).key, "free", "null → free");
  assert.equal(planDef(undefined).key, "free", "undefined → free");
  assert.equal(planDef("enterprise").key, "free", "nieznany plan NIE daje premium (bezpieczny fallback)");
  assert.equal(planDef("").key, "free");
});

test("PLANS: free bez funkcji premium, premium z funkcjami; limity premium > free", () => {
  assert.deepEqual(PLANS.free.features, [], "free nie udostępnia funkcji premium");
  assert.ok(PLANS.premium.features.length > 0, "premium ma funkcje");
  assert.ok(PLANS.premium.aiDailyRequests > PLANS.free.aiDailyRequests, "limit requestów premium > free");
  assert.ok(PLANS.premium.aiDailyTokens > PLANS.free.aiDailyTokens, "limit tokenów premium > free");
  assert.equal(PLANS.free.key, "free");
  assert.equal(PLANS.premium.key, "premium");
});
