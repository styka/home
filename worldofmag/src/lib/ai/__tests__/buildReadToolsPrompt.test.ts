import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReadToolsPrompt } from "@/platform/ai/tools";
import { getAiCatalog } from "@/lib/ai/catalog";

// 016-ai-chat-tag-query-overload: katalog narzędzi ODCZYTU jest filtrowany po
// wybranych modułach (jak buildActionCatalog), żeby prompt agenta nie zawierał
// wszystkich ~56 narzędzi w KAŻDYM wywołaniu — bo dwa wywołania (query→answer)
// na proste zapytanie przebijały minutowy limit tokenów Groqa (TPM).
//
// 049: katalog nie jest już stałą w jednym pliku — składa się z deklaracji modułów, więc test
// najpierw go buduje. Treść asercji bez zmian: to ta sama umowa co przed przebudową.

test("zawężenie do ['tasks'] zawiera narzędzia zadań + przekrojowe, bez obcych modułów", async () => {
  const catalog = await getAiCatalog();
  const p = buildReadToolsPrompt(["tasks"], catalog);
  // narzędzia modułu tasks
  assert.match(p, /- list_tasks:/, "powinno zawierać list_tasks");
  assert.match(p, /- list_task_tags:/, "powinno zawierać list_task_tags");
  assert.match(p, /- list_projects:/, "powinno zawierać list_projects");
  // narzędzia przekrojowe — zawsze
  assert.match(p, /- list_calendar:/, "przekrojowe: list_calendar zawsze");
  assert.match(p, /- web_search:/, "przekrojowe: web_search zawsze");
  assert.match(p, /- list_trash:/, "przekrojowe: list_trash zawsze");
  // narzędzia innych modułów — NIE
  assert.doesNotMatch(p, /- list_recipes:/, "nie powinno być narzędzi kitchen");
  assert.doesNotMatch(p, /- list_vehicles:/, "nie powinno być narzędzi flota");
  assert.doesNotMatch(p, /- list_wallet:/, "nie powinno być narzędzi portfel");
});

test("pusty/nieznany input → pełny katalog (bezpieczny fallback)", async () => {
  const catalog = await getAiCatalog();
  const pelny = buildReadToolsPrompt([], catalog);
  assert.equal(buildReadToolsPrompt(["nieistniejacy_modul"], catalog), pelny);
  assert.match(pelny, /- list_recipes:/, "pełny katalog ma narzędzia wszystkich modułów");
});

test("zawężenie realnie skraca prompt (dowód redukcji tokenów)", async () => {
  const catalog = await getAiCatalog();
  const pelny = buildReadToolsPrompt([], catalog);
  const scoped = buildReadToolsPrompt(["tasks"], catalog);
  assert.ok(
    scoped.length < pelny.length * 0.5,
    `prompt zawężony (${scoped.length}) powinien być <50% pełnego (${pelny.length})`,
  );
  // nagłówek zachowany
  assert.match(scoped, /^Dostępne narzędzia ODCZYTU/);
});
