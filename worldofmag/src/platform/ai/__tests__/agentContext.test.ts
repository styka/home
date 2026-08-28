import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactToolResults,
  collapseUsedToolData,
  czyCachowacKatalog,
  PER_TOOL_MAX_RECORDS,
  TOOL_RESULT_MAX_CHARS,
  TOOL_DATA_HEADER,
  TOOL_DATA_STUB,
  type ToolResult,
} from "@/platform/ai/agentContext";

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
  // 030: pojedyncze wielkie pole łapie teraz trim per-pole (test niżej), więc bezpiecznik
  // blokowy prowokujemy WIELOMA rekordami z polami poniżej progu per-pole.
  const results: ToolResult[] = [
    { tool: "list_notes", args: {}, data: Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, content: "x".repeat(400) })) },
  ];
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

// 030: skracanie długich pól per-pole — blok wyników pozostaje POPRAWNYM JSON-em
// (wcześniej bezpiecznik znakowy ucinał JSON w połowie i model wpadał w pętlę powtórek).
import { trimLongStrings, FIELD_MAX_CHARS } from "@/platform/ai/agentContext";

test("trimLongStrings skraca długi string z markerem, krótkie zostawia", () => {
  const long = "y".repeat(FIELD_MAX_CHARS + 500);
  const out = trimLongStrings({ id: "t1", title: "krótki", description: long }) as Record<string, string>;
  assert.equal(out.title, "krótki");
  assert.ok(out.description.length < long.length, "opis skrócony");
  assert.match(out.description, /SKRÓCONO z \d+ znaków/, "marker z liczbą znaków");
  assert.match(out.description, /get_task\/get_note/, "wskazówka jak sięgnąć po całość");
});

test("compactToolResults z ogromnym opisem zwraca POPRAWNY JSON z markerem skrócenia", () => {
  const huge = "opis ".repeat(2000); // ~10k znaków w jednym polu
  const results: ToolResult[] = [
    { tool: "get_task", args: { taskId: "t1" }, data: { id: "t1", title: "A", description: huge } },
  ];
  const out = compactToolResults(results);
  const parsed = JSON.parse(out) as Array<{ data: { description: string } }>; // nie rzuca = poprawny JSON
  assert.match(parsed[0].data.description, /SKRÓCONO/, "pole oznaczone jako skrócone");
  assert.ok(out.length <= TOOL_RESULT_MAX_CHARS, "mieści się w budżecie bloku bez cięcia w połowie");
});

test("trimLongStrings działa rekurencyjnie w tablicach i zagnieżdżeniach", () => {
  const long = "z".repeat(FIELD_MAX_CHARS * 2);
  const out = trimLongStrings([{ nested: { note: long } }, "ok"]) as Array<unknown>;
  const first = out[0] as { nested: { note: string } };
  assert.match(first.nested.note, /SKRÓCONO/);
  assert.equal(out[1], "ok");
});

// ── 112: polityka DRUGIEGO punktu cięcia pamięci podręcznej promptu ──────────────────────────────
//
// Prompt systemowy jest budowany RAZ przed pętlą i identyczny co do znaku we wszystkich wywołaniach
// przebiegu, a mimo to do 112 katalog (~12–18 tys. tokenów) był opłacany w pełnej cenie za każdym
// razem — w zgłoszonej sesji sześć razy, ~67% rachunku tury. Oba brzegi reguły są celowe: zapis do
// pamięci kosztuje 1,25× ceny wejścia, więc oznaczanie katalogu przy wywołaniu, po którym nic nie
// nastąpi, byłoby czystą stratą (zmierzone: 11 860 tokenów wyrzuconych w domknięciu przebiegu).

test("czyCachowacKatalog: pierwsze wywołanie NIE cache'uje katalogu (tura jednowywołaniowa nie może zdrożeć)", () => {
  assert.equal(czyCachowacKatalog(1), false);
});

test("czyCachowacKatalog: od drugiego wywołania cache'ujemy katalog", () => {
  assert.equal(czyCachowacKatalog(2), true);
  assert.equal(czyCachowacKatalog(3), true);
  assert.equal(czyCachowacKatalog(6), true);
});

test("czyCachowacKatalog: wywołanie DOMYKAJĄCE nigdy nie cache'uje — nikt tego nie odczyta (AC-13)", () => {
  assert.equal(czyCachowacKatalog(0, true), false);
  assert.equal(czyCachowacKatalog(7, true), false, "nawet jako siódme wywołanie w przebiegu");
});
