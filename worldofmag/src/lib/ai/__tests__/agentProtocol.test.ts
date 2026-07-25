import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJsonLoose, salvageAnswerText } from "@/lib/ai/agentProtocol";

// 030: tolerancyjne parsowanie protokołu agenta — pojedyncza niesforna odpowiedź
// modelu nie może kończyć tury błędem „LLM zwrócił nieprawidłowy format".

test("extractJsonLoose: czysty JSON", () => {
  const j = extractJsonLoose('{ "step": "answer", "answer": "OK" }');
  assert.equal(j?.step, "answer");
});

test("extractJsonLoose: JSON w płotkach markdown", () => {
  const j = extractJsonLoose('```json\n{ "step": "query", "tools": [] }\n```');
  assert.equal(j?.step, "query");
});

test("extractJsonLoose: proza przed i po JSON-ie", () => {
  const j = extractJsonLoose('Oto moja odpowiedź:\n{ "step": "answer", "answer": "2 zadania" }\nMiłego dnia!');
  assert.equal(j?.step, "answer");
  assert.equal(j?.answer, "2 zadania");
});

test("extractJsonLoose: trailing comma", () => {
  const j = extractJsonLoose('{ "step": "answer", "answer": "OK", }');
  assert.equal(j?.answer, "OK");
});

test("extractJsonLoose: klamry wewnątrz stringów nie psują balansu", () => {
  const j = extractJsonLoose('Wynik: { "step": "answer", "answer": "obiekt {a} i \\"cytat\\"" } koniec');
  assert.equal(j?.answer, 'obiekt {a} i "cytat"');
});

test("extractJsonLoose: tablica ani śmieci nie przechodzą", () => {
  assert.equal(extractJsonLoose("[1,2,3]"), null);
  assert.equal(extractJsonLoose("zwykły tekst bez JSON-a"), null);
});

test("salvageAnswerText: preferuje pole answer z parsowalnego JSON-a", () => {
  const text = salvageAnswerText('{ "step": "answer", "answer": "Masz **2** zadania." }');
  assert.equal(text, "Masz **2** zadania.");
});

test("salvageAnswerText: wyciąga answer z NIEDOMKNIĘTEGO JSON-a", () => {
  const text = salvageAnswerText('{ "step": "answer", "answer": "Lista:\\n- A\\n- B');
  assert.match(text, /Lista:/);
  assert.match(text, /- B/);
});

test("salvageAnswerText: kompletnie popsuty tekst → oczyszczona treść", () => {
  const text = salvageAnswerText("```\nProjekt ma 2 zadania: A i C.\n```");
  assert.equal(text, "Projekt ma 2 zadania: A i C.");
});

test("salvageAnswerText: nigdy nie zwraca pustki", () => {
  const text = salvageAnswerText("{}");
  assert.ok(text.trim().length > 0, "fallbackowy komunikat po polsku");
});
