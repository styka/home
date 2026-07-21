import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReadToolsPrompt, READ_TOOLS_PROMPT } from "@/lib/ai/agentTools";

// 016-ai-chat-tag-query-overload: katalog narzędzi ODCZYTU jest filtrowany po
// wybranych modułach (jak buildActionCatalog), żeby prompt agenta nie zawierał
// wszystkich ~50 narzędzi w KAŻDYM wywołaniu — bo dwa wywołania (query→answer)
// na proste zapytanie przebijały minutowy limit tokenów Groqa (TPM).

test("zawężenie do ['tasks'] zawiera narzędzia zadań + core, bez obcych modułów", () => {
  const p = buildReadToolsPrompt(["tasks"]);
  // narzędzia modułu tasks
  assert.match(p, /- list_tasks:/, "powinno zawierać list_tasks");
  assert.match(p, /- list_task_tags:/, "powinno zawierać list_task_tags");
  assert.match(p, /- list_projects:/, "powinno zawierać list_projects");
  // narzędzia przekrojowe (core) — zawsze
  assert.match(p, /- list_calendar:/, "core: list_calendar zawsze");
  assert.match(p, /- web_search:/, "core: web_search zawsze");
  assert.match(p, /- list_trash:/, "core: list_trash zawsze");
  // narzędzia innych modułów — NIE
  assert.doesNotMatch(p, /- list_recipes:/, "nie powinno być narzędzi kitchen");
  assert.doesNotMatch(p, /- list_vehicles:/, "nie powinno być narzędzi flota");
  assert.doesNotMatch(p, /- list_wallet:/, "nie powinno być narzędzi portfel");
});

test("pusty/nieznany input → pełny katalog (bezpieczny fallback)", () => {
  assert.equal(buildReadToolsPrompt([]), READ_TOOLS_PROMPT);
  assert.equal(buildReadToolsPrompt(["nieistniejacy_modul"]), READ_TOOLS_PROMPT);
});

test("zawężenie realnie skraca prompt (dowód redukcji tokenów)", () => {
  const scoped = buildReadToolsPrompt(["tasks"]);
  assert.ok(
    scoped.length < READ_TOOLS_PROMPT.length * 0.5,
    `prompt zawężony (${scoped.length}) powinien być <50% pełnego (${READ_TOOLS_PROMPT.length})`,
  );
  // nagłówek zachowany
  assert.match(scoped, /^Dostępne narzędzia ODCZYTU/);
});

test("wiele modułów → suma ich narzędzi (union) + core", () => {
  const p = buildReadToolsPrompt(["tasks", "portfel"]);
  assert.match(p, /- list_tasks:/);
  assert.match(p, /- list_wallet:/);
  assert.match(p, /- get_monthly_report:/);
  assert.match(p, /- list_calendar:/); // core
  assert.doesNotMatch(p, /- list_recipes:/); // kitchen poza zakresem
});
