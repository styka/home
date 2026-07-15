import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOmniaPrompt, OMNIA_LLM_PROMPT } from "@/lib/omniaClipboard";

// Wyciąga zawartość bloku ```json … ``` z wygenerowanego tekstu.
function extractJson(out: string): unknown {
  const start = out.indexOf("```json");
  const body = out.slice(start + "```json".length, out.lastIndexOf("```"));
  return JSON.parse(body.trim());
}

test("buildOmniaPrompt: prompt bazowy + blok JSON z zadaniami (tytuł/opis)", () => {
  const out = buildOmniaPrompt([{ title: "Napraw X", description: "opis X" }]);
  assert.ok(out.startsWith(OMNIA_LLM_PROMPT), "zaczyna się promptem bazowym");
  assert.ok(out.includes("```json"), "zawiera fenced blok json");
  assert.deepEqual(extractJson(out), [{ tytuł: "Napraw X", opis: "opis X" }]);
});

test("OMNIA_LLM_PROMPT: uruchamia spec-driven pipeline przez /specify", () => {
  assert.ok(OMNIA_LLM_PROMPT.includes("/specify"), "prompt odwołuje się do komendy /specify");
  assert.ok(/spec-driven/i.test(OMNIA_LLM_PROMPT), "prompt wskazuje spec-driven pipeline");
});

test("buildOmniaPrompt: null description → pusty opis; pusta lista → []", () => {
  assert.deepEqual(extractJson(buildOmniaPrompt([{ title: "T", description: null }])), [{ tytuł: "T", opis: "" }]);
  assert.deepEqual(extractJson(buildOmniaPrompt([])), []);
});

test("buildOmniaPrompt: wiele zadań zachowuje kolejność", () => {
  const out = buildOmniaPrompt([
    { title: "A", description: "a" },
    { title: "B", description: null },
  ]);
  assert.deepEqual(extractJson(out), [
    { tytuł: "A", opis: "a" },
    { tytuł: "B", opis: "" },
  ]);
});
