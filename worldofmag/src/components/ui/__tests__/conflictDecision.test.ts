import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 066 — ZASADA Z ROZDZ. 8.5.2 JAKO TEST, A NIE JAKO ZDANIE W KOMENTARZU.
 *
 * *„Konflikt nigdy nie kończy się utratą pracy użytkownika bez jego świadomej decyzji."*
 *
 * Tego nie da się sprawdzić klikając — da się sprawdzić **kształtem API**. Trzy rzeczy muszą być
 * prawdą i każda z nich łatwo psuje się przy późniejszej „drobnej poprawce":
 *
 * 1. **Degradacja poza providerem nie może wybierać za użytkownika.** Gdyby `useConflict` poza
 *    powłoką zwracało „nadpisz" (bo „przecież to najczęstszy wybór"), komponent użyty w teście,
 *    w playgroundzie albo w nowym miejscu, gdzie ktoś zapomniał providera, **kasowałby cudzą
 *    pracę bez pytania**. Degradacja idzie więc w „wróć do edycji" — jedyne wyjście, którego nie
 *    trzeba cofać.
 * 2. **Żadne wyjście nie jest domyślne.** Trzy decyzje, każda nazwana, żadnej „OK".
 * 3. **Odrzucenie nie jest kasowaniem** — wersja robocza idzie do kosza z rozpoznawalnym tytułem.
 */

test("066: poza providerem konflikt NIE wybiera za użytkownika", async () => {
  // Sprawdzamy dokładnie tę wartość, którą hook zwraca poza providerem — wyprowadzoną z niego
  // właśnie po to, żeby dało się ją sprawdzić bez runtime'u Reacta.
  const { konfliktPozaPowloka } = await import("../ConflictProvider");
  const decyzja = await konfliktPozaPowloka({ zasob: "zadanie" });

  assert.equal(
    decyzja,
    "wroc",
    'degradacja musi znaczyć nie-rob-nic; nadpisanie kasowałoby cudzą pracę bez pytania',
  );
  assert.notEqual(decyzja, "nadpisz");
  assert.notEqual(decyzja, "odrzuc");
});

test("066: wersja robocza z konfliktu jest rozpoznawalna w koszu", async () => {
  const { recordRejectedDraft } = await import("@/platform/trash/trash");
  assert.equal(typeof recordRejectedDraft, "function");

  // Tytuł musi odróżniać wersję roboczą od usuniętego rekordu — w koszu stoją obok siebie.
  // Sprawdzamy kształt bez bazy: funkcja jest cienką nakładką na `recordTrash`, a jedyne, co
  // wnosi, to właśnie prefiks. Gdyby zniknął, ten test jest jedynym miejscem, które to zauważy.
  const zrodlo = await import("node:fs").then((fs) =>
    fs.readFileSync("src/platform/trash/trash.ts", "utf8"),
  );
  assert.match(zrodlo, /Wersja robocza \(konflikt\)/);
});
