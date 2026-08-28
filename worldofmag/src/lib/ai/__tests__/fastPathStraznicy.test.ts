import { test } from "node:test";
import assert from "node:assert/strict";
import { granicePolskie, MAX_DLUGOSC_KLASYFIKACJI, READ_INTENT_RE, wartoKlasyfikowac } from "@/lib/ai/fastPath";

// 112 (AC-15): klasyfikator intencji ma NIE być wołany, gdy jego wynik jest znany z góry.
//
// Zgłoszenie właściciela („czemu taka prosta operacja kosztowała 30 groszy?") pokazało turę, w
// której długie zdanie sugestii przeszło przez klasyfikator tylko po to, żeby usłyszeć „complex" —
// 1867 tokenów i ~7 sekund za rozstrzygnięcie przesądzone. Strażniki są funkcją CZYSTĄ właśnie po
// to, żeby dało się to sprawdzić bez dostawcy: gdyby siedziały wewnątrz `classifyIntent`, jedynym
// dowodem „model nie został wołany" byłoby uruchomienie prawdziwego wywołania.

test("krótkie polecenie dodania przechodzi do klasyfikacji", () => {
  assert.equal(wartoKlasyfikowac("dodaj mleko"), true);
  assert.equal(wartoKlasyfikowac("zanotuj: oddzwonić do Kasi"), true);
});

test("pusta wiadomość nie idzie do modelu", () => {
  assert.equal(wartoKlasyfikowac(""), false);
  assert.equal(wartoKlasyfikowac("   \n  "), false);
});

test("prośba o odczyt nie idzie do modelu", () => {
  assert.equal(wartoKlasyfikowac("pokaż zadania na dziś"), false);
  assert.equal(wartoKlasyfikowac("ile mam pilnych zadań?"), false);
});

test("wiadomość dłuższa niż próg nie idzie do modelu (AC-15)", () => {
  // Zdanie ze zgłoszenia — sugestia UX, która kosztowała klasyfikację i tak zakończoną „complex".
  const zgloszenie =
    "denerwuje usera że za każdym razem po wykonaniu bulk akcji widok z checkboxami się wyłącza " +
    "a on chciałbym dalej zaznaczyć wiele elementów by zrobić kolejną bulk akcję. " +
    "wymyśl coś na obsługę tego przypadku tak by UX był super";
  assert.ok(zgloszenie.length > MAX_DLUGOSC_KLASYFIKACJI, "zdanie ze zgłoszenia ma przekraczać próg");
  assert.equal(wartoKlasyfikowac(zgloszenie), false);
});

// 112 (T-2a): `\b` w JavaScripcie jest ASCII-owe, więc człon alternatywy kończący się polską literą
// NIGDY nie pasował — „pokaż zadania" przechodziło przez strażnika i szło do płatnego klasyfikatora
// oraz płatnego routera, mimo że odpowiedź obu była znana z góry. Objaw był całkowicie cichy: wersje
// bez diakrytyków („pokaz") działały, więc regexp wyglądał na sprawny.

test("strażnik odczytu łapie formy z polskimi znakami na końcu (T-2a)", () => {
  for (const s of ["pokaż zadania", "znajdź notatkę o psie", "sprawdź pogodę", "doradź mi coś"]) {
    assert.equal(READ_INTENT_RE.test(s), true, `powinno łapać: ${s}`);
  }
});

test("granica słowa nie dopasowuje się WEWNĄTRZ słowa", () => {
  assert.equal(READ_INTENT_RE.test("podajnik do wody"), false, "człon „podaj” wewnątrz „podajnik”");
  const pets = granicePolskie("zwierz\\w*|wąż");
  assert.equal(pets.test("mój wąż"), true);
  assert.equal(pets.test("opiszwierzak"), false, "dopasowanie w środku słowa jest niedozwolone");
});

test("granicePolskie działa na początku i na końcu członu z diakrytykiem", () => {
  const kuchnia = granicePolskie("śniadani\\w*|obiad\\w*");
  assert.equal(kuchnia.test("zrób śniadanie"), true, "człon ZACZYNAJĄCY się od polskiej litery");
  assert.equal(kuchnia.test("co na obiad"), true);
});

test("próg liczy się po przycięciu białych znaków, a granica jest włączna", () => {
  const dokladnieProg = "a".repeat(MAX_DLUGOSC_KLASYFIKACJI);
  assert.equal(wartoKlasyfikowac(`   ${dokladnieProg}   `), true, "dokładnie próg = jeszcze klasyfikujemy");
  assert.equal(wartoKlasyfikowac("a".repeat(MAX_DLUGOSC_KLASYFIKACJI + 1)), false);
});
