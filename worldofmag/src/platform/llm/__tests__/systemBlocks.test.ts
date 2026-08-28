import { test } from "node:test";
import assert from "node:assert/strict";
import { toAnthropicSystem } from "@/platform/llm/chat";

// 112 (AC-12, AC-13): DRUGI punkt cięcia pamięci podręcznej promptu.
//
// Do 036 oznaczany był wyłącznie blok STAŁY (wstęp + protokół, ~1276 tokenów), a katalog narzędzi i
// akcji (~12–18 tys. tokenów) szedł zwykłym wejściem. W pętli agenta prompt systemowy jest budowany
// RAZ przed pętlą i przekazywany do każdej iteracji identyczny co do znaku — więc w zgłoszonej sesji
// („pies Raj", 6 iteracji) ten sam katalog opłacono w pełnej cenie sześć razy, ~67% rachunku tury.
//
// Flaga jest domyślnie WYŁĄCZONA i to jest istota projektu: zapis do pamięci kosztuje 1,25× ceny
// wejścia, więc oznaczenie katalogu w turze jednowywołaniowej podniosłoby koszt — czyli dokładnie
// tego przypadku, którego dotyczyło drugie zgłoszenie („czemu ta prosta operacja kosztowała 30 gr").

const stable = "WSTĘP I PROTOKÓŁ — część niezależna od wybranych modułów.";
const variable = "KATALOG NARZĘDZI I AKCJI — zależny od modułów wybranych w tej turze.";

function cacheControlNaBlokach(bloki: ReturnType<typeof toAnthropicSystem>): boolean[] {
  return (bloki ?? []).map((b) => b.cache_control !== undefined);
}

test("bez flagi oznaczony jest wyłącznie blok stały (zachowanie z 036)", () => {
  const bloki = toAnthropicSystem(stable + variable, { stable, variable });
  assert.equal(bloki?.length, 2);
  assert.deepEqual(cacheControlNaBlokach(bloki), [true, false]);
  assert.equal(bloki?.[0].text, stable);
  assert.equal(bloki?.[1].text, variable);
});

test("z flagą oznaczone są OBA bloki — drugi punkt cięcia (AC-12)", () => {
  const bloki = toAnthropicSystem(stable + variable, { stable, variable }, true);
  assert.equal(bloki?.length, 2);
  assert.deepEqual(cacheControlNaBlokach(bloki), [true, true]);
  // Treść musi pozostać nietknięta — punkt cięcia zmienia rozliczenie, nigdy prompt.
  assert.equal((bloki?.[0].text ?? "") + (bloki?.[1].text ?? ""), stable + variable);
});

test("flaga nie tworzy drugiego bloku, gdy część zmienna jest pusta", () => {
  const bloki = toAnthropicSystem(stable, { stable, variable: "" }, true);
  assert.equal(bloki?.length, 1, "nie ma czego oznaczać drugim punktem cięcia");
  assert.deepEqual(cacheControlNaBlokach(bloki), [true]);
});

test("podział niepasujący do treści jest ODRZUCANY — prompt nigdy nie jest po cichu zmieniany", () => {
  // Sklejenie nie odtwarza wysyłanego `system`, więc podziału nie wolno przyjąć.
  const bloki = toAnthropicSystem("zupełnie inna treść promptu", { stable, variable }, true);
  assert.equal(bloki?.length, 1);
  assert.equal(bloki?.[0].text, "zupełnie inna treść promptu");
  assert.deepEqual(cacheControlNaBlokach(bloki), [true]);
});

test("pusty prefiks stały nie włącza podziału (nie ma czego cache'ować)", () => {
  const bloki = toAnthropicSystem(variable, { stable: "", variable }, true);
  assert.equal(bloki?.length, 1);
  assert.equal(bloki?.[0].text, variable);
});

test("brak promptu systemowego → brak bloków", () => {
  assert.equal(toAnthropicSystem(undefined, { stable, variable }, true), undefined);
  assert.equal(toAnthropicSystem(""), undefined);
});
