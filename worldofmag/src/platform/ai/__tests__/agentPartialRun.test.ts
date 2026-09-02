import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countSuccessfulReads,
  describeBlocker,
  partialRunFallbackMessage,
  type PartialRunLogEntry,
} from "@/platform/ai/agentPartialRun";
import { isTruncatedAnthropicResponse, isTruncatedOpenAiResponse } from "@/platform/llm/truncation";

// 032 (zgłoszenie Z-2): przebieg, który się nie domknął, oddawał użytkownikowi jedno bezużyteczne
// zdanie o „limicie kroków". Teraz musi powiedzieć, co ustalono i co zablokowało dokończenie.

const okRead: PartialRunLogEntry = { results: [{}, {}] };
const repeated: PartialRunLogEntry = { results: [{ repeat: "POWTÓRKA — to samo wywołanie" }] };
const failed: PartialRunLogEntry = { results: [{ error: "Nie znaleziono listy zakupów o nazwie „moje”." }] };

test("countSuccessfulReads liczy tylko realne, udane odczyty", () => {
  assert.equal(countSuccessfulReads([okRead, repeated, failed]), 2);
  assert.equal(countSuccessfulReads([]), 0);
  assert.equal(countSuccessfulReads([{}]), 0);
});

test("ucięcie odpowiedzi ma pierwszeństwo jako przyczyna", () => {
  assert.match(describeBlocker([failed], true), /nie zmieściła się w dopuszczalnej długości/);
});

test("bez ucięcia przyczyną jest OSTATNI błąd narzędzia", () => {
  const first: PartialRunLogEntry = { results: [{ error: "pierwszy błąd" }] };
  const second: PartialRunLogEntry = { results: [{ error: "drugi błąd" }] };
  assert.equal(describeBlocker([first, second], false), "drugi błąd");
});

test("same powtórki → przyczyną jest brak postępu", () => {
  assert.match(describeBlocker([okRead, repeated], false), /nie wnosiły nic nowego/);
});

test("brak błędów i powtórek → zwykły brak kroków", () => {
  assert.match(describeBlocker([okRead], false), /zabrakło kroków/);
});

test("komunikat awaryjny zawiera ustalenia, przyczynę i podpowiedź (AC-11)", () => {
  const msg = partialRunFallbackMessage([okRead, repeated], false);
  assert.match(msg, /2 odczyty/);
  assert.match(msg, /Zablokowało mnie to:/);
  assert.match(msg, /jedną rzecz naraz/);
  // Kluczowe: NIE wolno oddać samego zdania o limicie kroków.
  assert.ok(!/limicie kroków/.test(msg));
});

test("komunikat awaryjny bez żadnych danych mówi to wprost", () => {
  const msg = partialRunFallbackMessage([], false);
  assert.match(msg, /Nie zdążyłem jeszcze pobrać żadnych danych/);
});

test("liczebnik „odczyt” vs „odczyty”", () => {
  assert.match(partialRunFallbackMessage([{ results: [{}] }], false), /\(1 odczyt\)/);
  assert.match(partialRunFallbackMessage([{ results: [{}, {}] }], false), /\(2 odczyty\)/);
});

// ── Rozpoznanie ucięcia (AC-28) ──────────────────────────────────────────────

test("OpenAI-compatible: finish_reason 'length' = ucięcie", () => {
  assert.equal(isTruncatedOpenAiResponse({ choices: [{ finish_reason: "length" }] }), true);
  assert.equal(isTruncatedOpenAiResponse({ choices: [{ finish_reason: "stop" }] }), false);
  assert.equal(isTruncatedOpenAiResponse({ choices: [] }), false);
  assert.equal(isTruncatedOpenAiResponse(null), false);
});

test("Anthropic: stop_reason 'max_tokens' = ucięcie", () => {
  assert.equal(isTruncatedAnthropicResponse({ stop_reason: "max_tokens" }), true);
  assert.equal(isTruncatedAnthropicResponse({ stop_reason: "end_turn" }), false);
  assert.equal(isTruncatedAnthropicResponse(null), false);
});

// ── 120: przy UCIĘCIU komunikat musi mówić o limicie długości, nie o brakujących krokach ──────────
//
// Zgłoszenie: użytkownik dostał „zabrakło kroków na dokończenie odpowiedzi", co sugerowało, że
// pomogłoby więcej iteracji. Nie pomogłoby — każda kolejna też zostałaby ucięta. Gałąź ucięcia
// istniała w `describeBlocker` od 032, ale nie mogła zostać użyta, bo flaga ucięcia była kasowana
// przez pusty obiekt podstawiany za brakującą treść.

test("describeBlocker: ucięcie ma pierwszeństwo przed 'zabrakło kroków' (AC-3)", () => {
  const logBezBledow: PartialRunLogEntry[] = [{ results: [{}] }];
  assert.match(describeBlocker(logBezBledow, true), /długoś|dopuszczaln/i, "ma mówić o limicie długości");
  assert.doesNotMatch(describeBlocker(logBezBledow, true), /zabrakło kroków/);
});

test("partialRunFallbackMessage: przy ucięciu nie obiecuje, że pomogą kolejne kroki (AC-3)", () => {
  const komunikat = partialRunFallbackMessage([{ results: [{}] }], true);
  assert.doesNotMatch(komunikat, /zabrakło kroków/, "to była nieprawda w zgłoszonej sesji");
  assert.match(komunikat, /długoś|dopuszczaln/i);
});

test("bez ucięcia komunikat o brakujących krokach zostaje (dorobek 032 nietknięty)", () => {
  assert.match(describeBlocker([{ results: [{}] }], false), /zabrakło kroków/);
});
