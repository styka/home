import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJsonLoose, salvageAnswerText, odzyskajAkcjeZUcietego } from "@/platform/ai/agentProtocol";

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

// ── 113: odzysk kompletnych akcji z UCIĘTEGO planu ───────────────────────────────────────────────
//
// Zgłoszenie: kilkanaście obowiązków psa do przeniesienia, plan nie mieścił się w budżecie wyjścia,
// pięć odpowiedzi uciętych i wyrzuconych w całości — użytkownik nie dostał ani jednej akcji, choć
// każda ucięta odpowiedź niosła kilka gotowych. Odzyskujemy to, co kompletne; urwaną pomijamy.

const PELNY_PLAN = JSON.stringify({
  step: "plan",
  thought: "Zakładam psa i przenoszę obowiązki",
  actions: [
    { id: "a1", module: "pets", type: "add_pet", description: "Dodaj psa Raj", params: { name: "Raj" } },
    { id: "a2", module: "pets", type: "schedule_treatment", description: "Odrobaczanie", params: { everyDays: 90 } },
  ],
});

test("odzyskajAkcjeZUcietego: pełny plan → wszystkie akcje", () => {
  const akcje = odzyskajAkcjeZUcietego(PELNY_PLAN);
  assert.equal(akcje.length, 2);
  assert.equal(akcje[0].type, "add_pet");
  assert.equal(akcje[1].type, "schedule_treatment");
});

test("odzyskajAkcjeZUcietego: plan urwany W ŚRODKU akcji oddaje te kompletne (AC-7)", () => {
  const urwany =
    '{"step":"plan","thought":"Przenoszę obowiązki","actions":[' +
    '{"id":"a1","module":"pets","type":"add_pet","description":"Dodaj psa Raj","params":{"name":"Raj"}},' +
    '{"id":"a2","module":"pets","type":"schedule_care_task","description":"Czesanie","params":{"everyDays":7}},' +
    '{"id":"a3","module":"pets","type":"schedule_treatment","description":"Szczepienie przeciwko kaszlowi ken';
  const akcje = odzyskajAkcjeZUcietego(urwany);
  assert.equal(akcje.length, 2, "dwie kompletne; trzecia urwana pominięta");
  assert.equal(akcje[1].type, "schedule_care_task");
});

test("odzyskajAkcjeZUcietego: nawias klamrowy W OPISIE nie psuje liczenia głębokości", () => {
  const zNawiasem =
    '{"step":"plan","actions":[' +
    '{"id":"a1","type":"schedule_treatment","description":"Zabieg {co 3 miesiące} u weterynarza"},' +
    '{"id":"a2","type":"log_weight","description":"Waga"}]}';
  const akcje = odzyskajAkcjeZUcietego(zNawiasem);
  assert.equal(akcje.length, 2, "klamra w tekście to znak, nie zagnieżdżenie");
  assert.match(String(akcje[0].description), /co 3 miesiące/);
});

test("odzyskajAkcjeZUcietego: urwanie WEWNĄTRZ stringu nie gubi wcześniejszych akcji", () => {
  const urwanyWStringu =
    '{"step":"plan","actions":[' +
    '{"id":"a1","type":"add_pet","description":"Dodaj psa"},' +
    '{"id":"a2","type":"log_health_note","description":"Niedoczynność tarczycy, lek \\"Forth';
  const akcje = odzyskajAkcjeZUcietego(urwanyWStringu);
  assert.equal(akcje.length, 1);
  assert.equal(akcje[0].type, "add_pet");
});

test("odzyskajAkcjeZUcietego: brak tablicy actions → pusta lista", () => {
  assert.deepEqual(odzyskajAkcjeZUcietego('{"step":"answer","answer":"Nie ma tu akcji"}'), []);
  assert.deepEqual(odzyskajAkcjeZUcietego(""), []);
  assert.deepEqual(odzyskajAkcjeZUcietego("zupełnie nie JSON"), []);
});

test("odzyskajAkcjeZUcietego: pusta tablica actions → pusta lista", () => {
  assert.deepEqual(odzyskajAkcjeZUcietego('{"step":"plan","actions":[]}'), []);
});
