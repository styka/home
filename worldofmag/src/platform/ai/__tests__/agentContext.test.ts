import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactToolResults,
  collapseUsedToolData,
  czyCachowacKatalog,
  czyUzytecznyKrok,
  czyPrzerwacBezKroku,
  KROKI_PROTOKOLU,
  budzetWyjscia,
  BAZOWY_BUDZET_WYJSCIA,
  DUZY_BUDZET_WYJSCIA,
  PER_TOOL_MAX_RECORDS,
  TOOL_RESULT_MAX_CHARS,
  TOOL_DATA_HEADER,
  TOOL_DATA_STUB,
  type ToolResult,
} from "@/platform/ai/agentContext";

// 028: higiena kontekstu pętli agenta — tnie największy zmienny koszt tokenów
// (wyniki narzędzi re-wysyłane w każdej iteracji), bez utraty jakości.

test("compactToolResults obcina listę powyżej limitu i mówi, JAK dobrać resztę (AC-1)", () => {
  const data = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, title: `zadanie ${i}` }));
  const results: ToolResult[] = [{ tool: "list_tasks", args: { status: "TODO" }, data }];
  const out = compactToolResults(results);
  const parsed = JSON.parse(out) as Array<{ data: unknown[]; truncated?: string }>;
  assert.equal(parsed[0].data.length, PER_TOOL_MAX_RECORDS, "lista przycięta do limitu");
  assert.match(parsed[0].truncated ?? "", /pokazano 40 z 60 rekordów/, "znacznik ucięcia z liczbami");
  // 112: znacznik musi podać KONKRETNY następny krok. Poprzednie „zawęź zapytanie" było poleceniem
  // niewykonalnym (limit siedzi w kontekście, nie w zapytaniu) i to ono wyprodukowało spiralę
  // jedenastu odczytów w zgłoszonej sesji.
  assert.match(parsed[0].truncated ?? "", /offset: 40/, "wskazany konkretny offset kolejnej porcji");
  assert.doesNotMatch(parsed[0].truncated ?? "", /zawęź zapytanie/, "żadnego 'zawęź' jako jedynej rady");
});

test("znacznik uwzględnia offset już pobranej porcji (AC-2)", () => {
  const data = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}` }));
  const results: ToolResult[] = [{ tool: "list_tasks", args: { offset: 40 }, data }];
  const parsed = JSON.parse(compactToolResults(results)) as Array<{ truncated?: string }>;
  assert.match(parsed[0].truncated ?? "", /offset: 80/, "kolejna porcja liczona od już pobranych");
});

test("compactToolResults nie rusza wyników mieszczących się w limicie", () => {
  const data = [{ id: "a", name: "mleko" }, { id: "b", name: "chleb" }];
  const results: ToolResult[] = [{ tool: "list_items", args: {}, data }];
  const out = compactToolResults(results);
  const parsed = JSON.parse(out) as Array<{ data: unknown[]; truncated?: string }>;
  assert.equal(parsed[0].data.length, 2, "krótka lista bez zmian");
  assert.equal(parsed[0].truncated, undefined, "brak znacznika ucięcia dla małego wyniku");
});

test("compactToolResults egzekwuje twardy budżet znaków, ZOSTAWIAJĄC poprawny JSON (AC-4)", () => {
  // 030: pojedyncze wielkie pole łapie trim per-pole (test niżej), więc bezpiecznik blokowy
  // prowokujemy WIELOMA rekordami z polami poniżej progu per-pole.
  const results: ToolResult[] = [
    { tool: "list_notes", args: {}, data: Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, content: "x".repeat(600) })) },
  ];
  const out = compactToolResults(results);
  assert.ok(out.length <= TOOL_RESULT_MAX_CHARS, "blok nie przekracza budżetu");
  // 112: TO jest istota poprawki. Poprzednia wersja robiła `json.slice(...)`, czyli oddawała modelowi
  // strukturę urwaną w połowie rekordu — a model, nie rozumiejąc wyniku, ponawiał to samo zapytanie
  // aż do wyczerpania limitu kroków. Wynik musi być zawsze parsowalny.
  const parsed = JSON.parse(out) as Array<{ data: unknown[]; truncated?: string }>;
  assert.ok(Array.isArray(parsed), "wynik jest poprawnym JSON-em, nie urwanym stringiem");
  assert.ok(parsed[0].data.length < 40, "zmieściliśmy się, oddając MNIEJ rekordów");
  assert.match(parsed[0].truncated ?? "", /offset:/, "model wie, jak sięgnąć po resztę");
});

test("bezpiecznik nie psuje JSON-a nawet przy skrajnie dużych rekordach (AC-4)", () => {
  // Skrajność: pojedynczy rekord po skróceniu per-pole i tak przekracza cały budżet bloku.
  const results: ToolResult[] = [
    { tool: "list_notes", args: {}, data: Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, a: "y".repeat(690) })) },
  ];
  const out = compactToolResults(results);
  assert.doesNotThrow(() => JSON.parse(out), "wynik zawsze parsowalny");
  assert.ok(out.length <= TOOL_RESULT_MAX_CHARS, "budżet dotrzymany");
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

// ── 112 (recenzja): bezpiecznik znakowy nie może zgłaszać FAŁSZYWEGO obcięcia ────────────────────
//
// Znaleziono w recenzji własnego diffu: gdy blok przekraczał budżet znaków, ścieżka awaryjna
// dokładała znacznik „pokazano N z N — pobierz kolejne przez offset" do KAŻDEGO narzędzia w
// iteracji, także temu, którego wynik był kompletny. Model dostawał polecenie pobrania danych,
// których nie ma — czyli tę samą pętlę, którą ten przebieg likwiduje, tylko wywołaną z drugiej
// strony. Sprawdzone na czerwono: bez warunku `data.length > ile` ten test pada.

test("wynik KOMPLETNY nie dostaje znacznika, nawet gdy blok przekracza budżet znaków", () => {
  const results: ToolResult[] = [
    // to narzędzie wypycha blok ponad budżet…
    { tool: "list_notes", args: {}, data: Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, a: "y".repeat(650) })) },
    // …a to ma wynik kompletny i musi zostać nietknięte
    { tool: "list_projects", args: {}, data: [{ id: "p1", name: "Raj" }, { id: "p2", name: "Dom" }] },
  ];
  const parsed = JSON.parse(compactToolResults(results)) as Array<{ tool: string; data: unknown[]; truncated?: string }>;
  const projekty = parsed.find((r) => r.tool === "list_projects");
  assert.equal(projekty?.data.length, 2, "kompletna lista zostaje w całości");
  assert.equal(projekty?.truncated, undefined, "brak fałszywego 'pobierz kolejne' dla kompletnego wyniku");
});

// ── 113: co jest UŻYTECZNĄ odpowiedzią, a co jałowym obrotem ─────────────────────────────────────
//
// Zgłoszenie: pięć wywołań po 1200 tokenów wyjścia (dokładnie limit), wszystkie wyrzucone, i
// komunikat „zabrakło kroków", który był nieprawdą. Przyczyna: pusta treść modelu była zastępowana
// przez `"{}"`, a pusty obiekt parsuje się poprawnie — więc ucięta odpowiedź udawała sparsowaną,
// kasowała flagę ucięcia i zostawiała pętli tylko „nieznany krok", czyli kolejny obrót bez licznika.

test("czyUzytecznyKrok: pusty obiekt NIE jest użyteczną odpowiedzią", () => {
  assert.equal(czyUzytecznyKrok({}), false, "to jest dokładnie to, co podstawiało `\"{}\"`");
  assert.equal(czyUzytecznyKrok(null), false);
  assert.equal(czyUzytecznyKrok({ thought: "myślę" }), false, "sama myśl to nie krok");
  assert.equal(czyUzytecznyKrok({ step: "nieistniejacy" }), false);
  assert.equal(czyUzytecznyKrok({ step: 42 }), false, "step musi być tekstem");
});

test("czyUzytecznyKrok: każdy krok protokołu jest użyteczny", () => {
  for (const krok of KROKI_PROTOKOLU) {
    assert.equal(czyUzytecznyKrok({ step: krok }), true, `krok ${krok} musi być uznany`);
  }
});

test("czyPrzerwacBezKroku: jedna szansa na poprawę, po drugiej wychodzimy", () => {
  assert.equal(czyPrzerwacBezKroku(1), false, "pierwsza jałowa odpowiedź → dajemy szansę");
  assert.equal(czyPrzerwacBezKroku(2), true, "druga → koniec, zamiast dobijać do limitu iteracji");
  assert.equal(czyPrzerwacBezKroku(5), true);
});

// ── 113: budżet wyjścia dobierany do ETAPU tury ──────────────────────────────────────────────────
//
// Do 113 budżet był liczony RAZ, przed pętlą, z treści wiadomości użytkownika. Rozmiar planu zależy
// jednak od ilości danych, które asystent PRZECZYTAŁ — prośba o psa Raj ma trzy zdania, a plan to
// kilkanaście akcji. Rozpoznanie po wiadomości z zasady tego nie wykryje.

test("budzetWyjscia: zwykła tura bez danych zostaje na dotychczasowym budżecie (AC-5)", () => {
  assert.equal(budzetWyjscia({ maDaneWKontekscie: false }), BAZOWY_BUDZET_WYJSCIA);
  assert.equal(BAZOWY_BUDZET_WYJSCIA, 1200, "AC-5 wymaga BRAKU zmiany, nie 'prawie braku'");
});

test("budzetWyjscia: po odczycie danych jest wyraźnie więcej miejsca (AC-4)", () => {
  const po = budzetWyjscia({ maDaneWKontekscie: true });
  assert.ok(po > BAZOWY_BUDZET_WYJSCIA, "tura, która ma co wypisać, dostaje więcej");
  assert.equal(po, DUZY_BUDZET_WYJSCIA);
});

test("budzetWyjscia: bierze MAKSIMUM z mających zastosowanie progów", () => {
  // Raport bez danych = dotychczasowe 2800; raport PO odczycie danych nie może zejść poniżej 4000.
  assert.equal(budzetWyjscia({ maDaneWKontekscie: false, raport: true }), 2800);
  assert.equal(budzetWyjscia({ maDaneWKontekscie: true, raport: true }), DUZY_BUDZET_WYJSCIA);
  assert.equal(budzetWyjscia({ maDaneWKontekscie: false, wsadowe: true }), DUZY_BUDZET_WYJSCIA);
});
