import { test } from "node:test";
import assert from "node:assert/strict";
import { openAiBody, anthropicBody } from "@/lib/llm/chat";
import type { ResolvedLlm } from "@/lib/llm/resolver";
import type { ChatOptions } from "@/lib/llm/chat";

// 026-anthropic-temperature-fix: nowsze modele Anthropic (claude-sonnet-5, Opus 4.x)
// odrzucają `temperature` błędem 400 „temperature is deprecated for this model".
// Ciało żądania do Anthropic NIE może zawierać `temperature`; ciało OpenAI — musi (jak dotąd).

const anthropicCfg: ResolvedLlm = {
  kind: "anthropic",
  baseUrl: "https://api.anthropic.com/v1",
  apiKey: "sk-test",
  model: "claude-sonnet-5",
};

const openAiCfg: ResolvedLlm = {
  kind: "openai_compat",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "gsk-test",
  model: "llama-3.1-8b-instant",
};

function baseOpts(extra: Partial<ChatOptions> = {}): ChatOptions {
  return {
    op: "reasoning",
    messages: [
      { role: "system", content: "Jesteś asystentem." },
      { role: "user", content: "Cześć" },
    ],
    ...extra,
  };
}

test("anthropicBody: pomija `temperature` mimo opts.temperature (AC-1)", () => {
  const body = anthropicBody(anthropicCfg, baseOpts({ temperature: 0.2 }), false);
  assert.equal("temperature" in body, false, "ciało Anthropic nie może zawierać `temperature`");
});

test("anthropicBody: pomija `temperature` mimo cfg.temperature", () => {
  const cfg: ResolvedLlm = { ...anthropicCfg, temperature: 0.7 };
  const body = anthropicBody(cfg, baseOpts(), false);
  assert.equal("temperature" in body, false);
});

test("anthropicBody: wariant strumieniowy też bez `temperature`, z `stream:true` (AC-3)", () => {
  const body = anthropicBody(anthropicCfg, baseOpts({ temperature: 0.9 }), true);
  assert.equal("temperature" in body, false);
  assert.equal(body.stream, true);
});

test("anthropicBody: zawiera model, max_tokens i messages (sanity)", () => {
  const body = anthropicBody(anthropicCfg, baseOpts(), false);
  assert.equal(body.model, "claude-sonnet-5");
  assert.equal(typeof body.max_tokens, "number");
  assert.ok(Array.isArray(body.messages));
  // system trafia do osobnego pola `system` (Messages API), nie do messages
  assert.ok("system" in body);
});

test("openAiBody: zachowuje `temperature` gdy podane (AC-4 — brak regresji Groq/OpenAI)", () => {
  const body = openAiBody(openAiCfg, baseOpts({ temperature: 0.2 }), false);
  assert.equal(body.temperature, 0.2);
});

test("openAiBody: json → response_format tylko w wariancie jednorazowym; stream → stream:true", () => {
  const oneShot = openAiBody(openAiCfg, baseOpts({ json: true }), false);
  assert.deepEqual(oneShot.response_format, { type: "json_object" });
  assert.equal("stream" in oneShot, false);

  const streamed = openAiBody(openAiCfg, baseOpts({ json: true }), true);
  assert.equal(streamed.stream, true);
  assert.equal("response_format" in streamed, false);
});
