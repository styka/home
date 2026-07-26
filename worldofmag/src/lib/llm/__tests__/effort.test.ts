import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyEffort,
  bumpEffort,
  effortSupported,
  isEffortRejection,
  parseEffort,
  supportsTemperature,
} from "@/lib/llm/effort";

describe("effort — skala", () => {
  it("podnosi wysiłek o jeden stopień, najwyższy zostaje najwyższy", () => {
    assert.equal(bumpEffort("none"), "low");
    assert.equal(bumpEffort("low"), "medium");
    assert.equal(bumpEffort("medium"), "high");
    assert.equal(bumpEffort("high"), "high");
  });

  it("wczytuje wartość z bazy bezpiecznie", () => {
    assert.equal(parseEffort("medium"), "medium");
    assert.equal(parseEffort(null), "none");
    assert.equal(parseEffort(undefined), "none");
    assert.equal(parseEffort("turbo"), "none");
  });
});

describe("effort — możliwości dostawcy i modelu", () => {
  it("Anthropic: rozszerzone myślenie tylko dla Claude 4/5", () => {
    assert.equal(effortSupported("anthropic", "claude-sonnet-5"), true);
    assert.equal(effortSupported("anthropic", "claude-opus-4-1"), true);
    assert.equal(effortSupported("anthropic", "claude-haiku-4-5-20251001"), true);
    assert.equal(effortSupported("anthropic", "claude-3-5-sonnet-20241022"), false);
  });

  it("OpenAI-compatible: tylko rodziny rozumujące", () => {
    assert.equal(effortSupported("openai_compat", "gpt-5"), true);
    assert.equal(effortSupported("openai_compat", "o3-mini"), true);
    assert.equal(effortSupported("openai_compat", "qwen3-32b"), true);
    assert.equal(effortSupported("openai_compat", "openai/gpt-oss-120b"), true);
    assert.equal(effortSupported("openai_compat", "llama-3.3-70b-versatile"), false);
    assert.equal(effortSupported("openai_compat", "llama-3.1-8b-instant"), false);
  });

  it("pusty model nigdy nie obsługuje wysiłku", () => {
    assert.equal(effortSupported("anthropic", ""), false);
    assert.equal(effortSupported("openai_compat", "   "), false);
  });

  it("temperatura: Anthropic jej nie przyjmuje (lekcja 026)", () => {
    assert.equal(supportsTemperature("anthropic"), false);
    assert.equal(supportsTemperature("openai_compat"), true);
  });
});

describe("effort — tłumaczenie na parametr dostawcy", () => {
  it("Anthropic dostaje budżet myślenia i podniesiony max_tokens", () => {
    const body: Record<string, unknown> = { model: "claude-sonnet-5", max_tokens: 1024 };
    applyEffort(body, "anthropic", "claude-sonnet-5", "medium");
    assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 6144 });
    // max_tokens MUSI być większy od budżetu — inaczej Anthropic zwraca 400.
    assert.equal(body.max_tokens, 6144 + 1024);
    assert.ok((body.max_tokens as number) > 6144);
  });

  it("Anthropic: nie obniża max_tokens, gdy admin ustawił większy", () => {
    const body: Record<string, unknown> = { model: "claude-sonnet-5", max_tokens: 30000 };
    applyEffort(body, "anthropic", "claude-sonnet-5", "low");
    assert.equal(body.max_tokens, 30000);
  });

  it("wyższy poziom = większy budżet myślenia", () => {
    const low: Record<string, unknown> = { max_tokens: 1024 };
    const high: Record<string, unknown> = { max_tokens: 1024 };
    applyEffort(low, "anthropic", "claude-sonnet-5", "low");
    applyEffort(high, "anthropic", "claude-sonnet-5", "high");
    const b = (o: Record<string, unknown>) => (o.thinking as { budget_tokens: number }).budget_tokens;
    assert.ok(b(high) > b(low));
  });

  it("model rozumujący zgodny z OpenAI dostaje reasoning_effort", () => {
    const body: Record<string, unknown> = { model: "gpt-5" };
    applyEffort(body, "openai_compat", "gpt-5", "high");
    assert.equal(body.reasoning_effort, "high");
  });

  it("model bez wsparcia zostaje NIETKNIĘTY (żaden parametr nie leci)", () => {
    const body: Record<string, unknown> = { model: "llama-3.3-70b-versatile", temperature: 0.3, max_tokens: 800 };
    const before = JSON.stringify(body);
    applyEffort(body, "openai_compat", "llama-3.3-70b-versatile", "high");
    assert.equal(JSON.stringify(body), before);
  });

  it("poziom „brak” nigdy nic nie dokłada — ciało identyczne jak przed zmianą", () => {
    const body: Record<string, unknown> = { model: "claude-sonnet-5", max_tokens: 1024 };
    const before = JSON.stringify(body);
    applyEffort(body, "anthropic", "claude-sonnet-5", "none");
    assert.equal(JSON.stringify(body), before);
  });
});

describe("effort — rozpoznanie odrzucenia parametru", () => {
  it("rozpoznaje 400 dotyczący wysiłku", () => {
    assert.equal(isEffortRejection(400, "Unexpected parameter: reasoning_effort"), true);
    assert.equal(isEffortRejection(400, "thinking.budget_tokens must be less than max_tokens"), true);
    assert.equal(isEffortRejection(400, "Extended thinking is not supported for this model"), true);
  });

  it("nie myli go z innym błędem 400 ani z innymi statusami", () => {
    assert.equal(isEffortRejection(400, "temperature is deprecated for this model"), false);
    assert.equal(isEffortRejection(400, "invalid api key"), false);
    assert.equal(isEffortRejection(429, "reasoning_effort rate limited"), false);
    assert.equal(isEffortRejection(400, ""), false);
    assert.equal(isEffortRejection(400, null), false);
  });
});
