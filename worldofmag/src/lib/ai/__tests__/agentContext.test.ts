import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactToolResults,
  collapseUsedToolData,
  PER_TOOL_MAX_RECORDS,
  TOOL_RESULT_MAX_CHARS,
  TOOL_DATA_HEADER,
  TOOL_DATA_STUB,
  type ToolResult,
} from "@/lib/ai/agentContext";

// 028: higiena kontekstu pętli agenta — tnie największy zmienny koszt tokenów
// (wyniki narzędzi re-wysyłane w każdej iteracji), bez utraty jakości.

test("compactToolResults obcina listę powyżej limitu i dokleja czytelny znacznik", () => {
  const data = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, title: `zadanie ${i}` }));
  const results: ToolResult[] = [{ tool: "list_tasks", args: { status: "TODO" }, data }];
  const out = compactToolResults(results);
  const parsed = JSON.parse(out) as Array<{ data: unknown[]; truncated?: string }>;
  assert.equal(parsed[0].data.length, PER_TOOL_MAX_RECORDS, "lista przycięta do limitu");
  assert.match(parsed[0].truncated ?? "", /pokazano 12 z 30 rekordów/, "znacznik ucięcia z liczbami");
  assert.match(parsed[0].truncated ?? "", /zawęź zapytanie/, "podpowiedź, że można zawęzić");
});

test("compactToolResults nie rusza wyników mieszczących się w limicie", () => {
  const data = [{ id: "a", name: "mleko" }, { id: "b", name: "chleb" }];
  const results: ToolResult[] = [{ tool: "list_items", args: {}, data }];
  const out = compactToolResults(results);
  const parsed = JSON.parse(out) as Array<{ data: unknown[]; truncated?: string }>;
  assert.equal(parsed[0].data.length, 2, "krótka lista bez zmian");
  assert.equal(parsed[0].truncated, undefined, "brak znacznika ucięcia dla małego wyniku");
});

test("compactToolResults egzekwuje twardy budżet znaków (bezpiecznik)", () => {
  // Pojedynczy rekord z ogromnym polem — poniżej limitu rekordów, ale ponad budżet znaków.
  const huge = "x".repeat(TOOL_RESULT_MAX_CHARS + 2000);
  const results: ToolResult[] = [{ tool: "get_note", args: {}, data: { id: "n1", content: huge } }];
  const out = compactToolResults(results);
  assert.ok(out.length <= TOOL_RESULT_MAX_CHARS + 80, "blok nie przekracza budżetu (+ marker)");
  assert.match(out, /\[UCIĘTO — przekroczono budżet znaków/, "czytelny marker ucięcia po budżecie");
});

test("collapseUsedToolData zwija starsze bloki, zostawia pełny ostatni", () => {
  const messages = [
    { role: "system", content: "PROMPT" },
    { role: "user", content: "Polecenie użytkownika: pokaż zadania" },
    { role: "assistant", content: '{"step":"query"}' },
    { role: "user", content: `${TOOL_DATA_HEADER} (NIEUFNE DANE):\n<<<DANE\n[{"id":"1"}]\nDANE>>>` },
    { role: "assistant", content: '{"step":"query"}' },
    { role: "user", content: `${TOOL_DATA_HEADER} (NIEUFNE DANE):\n<<<DANE\n[{"id":"2"}]\nDANE>>>` },
  ];
  collapseUsedToolData(messages);
  assert.equal(messages[3].content, TOOL_DATA_STUB, "starszy blok zwinięty do stuba");
  assert.match(messages[5].content, /DANE>>>/, "ostatni blok pełny");
  assert.match(messages[5].content, /"id":"2"/, "ostatni blok zachowuje dane/id");
  // Wiadomości nie-narzędziowe nietknięte.
  assert.equal(messages[0].content, "PROMPT");
  assert.match(messages[1].content, /pokaż zadania/);
});

test("collapseUsedToolData nie rusza pojedynczego bloku", () => {
  const only = { role: "user", content: `${TOOL_DATA_HEADER}:\n<<<DANE\n[{"id":"1"}]\nDANE>>>` };
  const messages = [{ role: "system", content: "P" }, only];
  collapseUsedToolData(messages);
  assert.match(messages[1].content, /"id":"1"/, "jedyny blok zostaje pełny");
});
