import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRateLimitKind, rateLimitUserMessage } from "@/lib/llm/chat";

// 017-ai-model-limit-resilience: rozróżnienie limitu dziennego (TPD) od minutowego
// (TPM) z treści błędu Groqa, żeby komunikat dla użytkownika był UCZCIWY.

const TPD = "Rate limit reached for model `llama-3.3-70b-versatile` in organization `org_x` service tier `on_demand` on tokens per day (TPD): Limit 100000, Used 98326, Requested 7010.";
const TPM = "Rate limit reached for model `llama-3.3-70b-versatile` in organization `org_x` service tier `on_demand` on tokens per minute (TPM): Limit 12000, Used 5502, Requested 6845.";

test("klasyfikacja: TPD → daily", () => {
  assert.equal(classifyRateLimitKind(TPD), "daily");
});

test("klasyfikacja: TPM → minute", () => {
  assert.equal(classifyRateLimitKind(TPM), "minute");
});

test("klasyfikacja: brak sygnału → generic", () => {
  assert.equal(classifyRateLimitKind("Internal Server Error"), "generic");
  assert.equal(classifyRateLimitKind(""), "generic");
  assert.equal(classifyRateLimitKind(undefined), "generic");
});

test("komunikat dzienny mówi o dziennym limicie i panelu LLM, nie 'za chwilę'", () => {
  const msg = rateLimitUserMessage("daily");
  assert.match(msg, /dzienn/i);
  assert.match(msg, /LLM/);
  assert.doesNotMatch(msg, /za chwilę/i);
});

test("komunikat minutowy/generyczny mówi 'za chwilę'", () => {
  assert.match(rateLimitUserMessage("minute"), /za chwilę/i);
  assert.match(rateLimitUserMessage("generic"), /za chwilę/i);
});

test("komunikaty nigdy nie zawierają surowego tekstu dostawcy (C-41)", () => {
  for (const k of ["daily", "minute", "generic"] as const) {
    assert.doesNotMatch(rateLimitUserMessage(k), /Rate limit reached for model/i);
  }
});
