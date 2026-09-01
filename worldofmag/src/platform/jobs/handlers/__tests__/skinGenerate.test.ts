import { test } from "node:test";
import assert from "node:assert/strict";
import {
  korekta,
  opisPorazki,
  odczytajOdpowiedzJson,
  korektaFormatu,
  opisPorazkiFormatu,
  SKIN_MAX_ATTEMPTS,
} from "@/platform/jobs/handlers/skinGenerate";
import { wyodrebnijTokeny } from "@/lib/skins/mapowanie";

// 080 (Z10). Zgłoszenie: opis „Skórka nawiązująca stylem do kosmicznej sagi Star Trek" kończył się
// zdaniem „Model nie zwrócił ani jednego poprawnego tokenu — spróbuj ponownie". Zdanie było
// nieprawdziwe jako diagnoza (właściciel wymienił klucz API, co nie miało z tym nic wspólnego)
// i bezużyteczne jako wskazówka. Te testy pilnują dwóch rzeczy: że jest DRUGIE podejście
// i że komunikat porażki niesie informację.

test("SKIN_MAX_ATTEMPTS: jest ponowienie, a nie jedno podejście", () => {
  assert.ok(SKIN_MAX_ATTEMPTS >= 2, "bez ponowienia jedna nieudana odpowiedź kończyła operację");
});

test("korekta: pokazuje modelowi JEGO odrzucone klucze", () => {
  const tekst = korekta(["--kolor-tla", "--fontHeading"]);
  assert.match(tekst, /--kolor-tla/);
  assert.match(tekst, /--fontHeading/);
});

test("korekta: dokłada katalog dopuszczalnych nazw", () => {
  // Katalog jest generowany z ALL_CONTROLS, więc musi zawierać token bazowy.
  assert.match(korekta([]), /--bg-base/);
});

test("korekta: przy zerze kluczy nie udaje, że jakieś odrzucono", () => {
  assert.match(korekta([]), /Nie zwróciłeś ani jednego tokenu/);
});

test("korekta: długa lista jest skracana, nie wklejana w całości", () => {
  const duzo = Array.from({ length: 30 }, (_, i) => `--klucz-${i}`);
  const tekst = korekta(duzo);
  assert.match(tekst, /i 22 więcej/);
  assert.doesNotMatch(tekst, /--klucz-29/);
});

test("opisPorazki: rozróżnia brak tokenów od złych kluczy", () => {
  const nic = opisPorazki(0, []);
  const zle = opisPorazki(12, ["--tlo", "--tekst"]);
  assert.notEqual(nic, zle, "dwa różne stany nie mogą dawać tego samego zdania");
  assert.match(zle, /12/, "liczba przysłanych kluczy jest informacją diagnostyczną");
  assert.match(zle, /--tlo/, "nazwy odrzuconych kluczy mówią, czego zabrakło");
});

test("opisPorazki: brak mapy tokenów NIE obwinia użytkownika za opis", () => {
  // 081: po dołożeniu warstwy mapowania ten stan znaczy „przeszukaliśmy wszystkie kształty i nic",
  // czyli problem jest po stronie modelu. Poprzedni komunikat kazał „opisać skórkę konkretniej",
  // co przy opisie „kosmiczna saga Star Trek" było zwyczajnie nieprawdziwe.
  const nic = opisPorazki(0, []);
  assert.doesNotMatch(nic, /konkretniej/, "nie zrzucamy winy na opis użytkownika");
  assert.match(nic, /generation/, "kierujemy tam, gdzie da się coś zrobić: konfiguracja modelu");
});

test("korekta: przypomina KSZTAŁT odpowiedzi, nie tylko nazwy kluczy", () => {
  // Po warstwie mapowania zła nazwa klucza już nie jest przyczyną porażki — jest nią kształt,
  // którego nie umiemy zmapować. Korekta ma celować w to, co realnie zostało.
  const tekst = korekta(["--cos"]);
  assert.match(tekst, /OBIEKT/);
  assert.match(tekst, /NAPIS/);
});

test("opisPorazki: nie odsyła użytkownika do klucza API", () => {
  // To był realny koszt starego komunikatu: właściciel wygenerował nowy klucz na darmo.
  for (const tekst of [opisPorazki(0, []), opisPorazki(5, ["--x"])]) {
    assert.doesNotMatch(tekst, /API/i);
  }
});

// ─── 117. Zgłoszenie: „błąd o formacie" przy generowaniu skórki. Odczyt odpowiedzi
// modelu ma tolerować OPAKOWANIE (płotki markdown, tekst wokół JSON-a, luźne kształty)
// i rozpoznawać UCIĘCIE z flagi transportu — a komunikaty porażki mają nazywać
// przyczynę, nie mówić „nieprawidłowy format". Te przypadki wcześniej kończyły się
// twardym 502 na pierwszym podejściu.

test("117/odczyt: płotki markdown z językiem są zdejmowane", () => {
  const w = odczytajOdpowiedzJson('```json\n{"name":"Mostek","tokens":{"--bg-base":"#050a18"}}\n```', false);
  assert.ok(w.ok);
  assert.equal((w.parsed as { name?: string }).name, "Mostek");
});

test("117/odczyt: znak nowej linii PO płotku zamykającym nie psuje odczytu", () => {
  // Dokładnie ten kształt wywalał stary regex `/```$/` (kotwica na samym końcu).
  const w = odczytajOdpowiedzJson('```\n{"name":"Zen"}\n```\n', false);
  assert.ok(w.ok);
});

test("117/odczyt: tekst przed i po obiekcie JSON nie jest błędem formatu", () => {
  const w = odczytajOdpowiedzJson('Oto Twoja skórka:\n{"name":"Papier","tokens":{}}\nMiłego dnia!', false);
  assert.ok(w.ok);
  assert.equal((w.parsed as { name?: string }).name, "Papier");
});

test("117/odczyt: odpowiedź ucięta w połowie obiektu → przyczyna „ucieta” z flagi", () => {
  const w = odczytajOdpowiedzJson('{"name":"Terminal","tokens":{"--bg-base":"#0', true);
  assert.ok(!w.ok);
  assert.equal(w.przyczyna, "ucieta");
});

test("117/odczyt: śmieci bez JSON-a → przyczyna „brak-json”", () => {
  const w = odczytajOdpowiedzJson("przepraszam, nie mogę pomóc", false);
  assert.ok(!w.ok);
  assert.equal(w.przyczyna, "brak-json");
});

test("117/odczyt: tablica ani pusta odpowiedź nie udają skórki", () => {
  const tablica = odczytajOdpowiedzJson('[{"name":"x"}]', false);
  assert.ok(!tablica.ok);
  const pusta = odczytajOdpowiedzJson("", false);
  assert.ok(!pusta.ok);
  assert.equal(pusta.przyczyna, "brak-json");
});

test("117/komunikaty: korekta formatu mówi modelowi, CO poprawić", () => {
  assert.match(korektaFormatu("ucieta"), /UCIĘTA/);
  assert.match(korektaFormatu("ucieta"), /zwięźlej/);
  assert.match(korektaFormatu("brak-json"), /WYŁĄCZNIE jeden obiekt JSON/);
});

test("117/komunikaty: porażka formatu rozróżnia ucięcie od braku JSON-a i wskazuje panel LLM", () => {
  const ucieta = opisPorazkiFormatu("ucieta");
  const brak = opisPorazkiFormatu("brak-json");
  assert.match(ucieta, /ucięta/);
  assert.match(ucieta, /generation/);
  assert.match(brak, /nie zwrócił obiektu JSON/);
  assert.match(brak, /generation/);
  assert.notEqual(ucieta, brak);
  // Stary, bezużyteczny komunikat nie ma prawa wrócić.
  assert.doesNotMatch(ucieta, /nieprawidłowy format/);
  assert.doesNotMatch(brak, /nieprawidłowy format/);
});

test("117/tryb prosty: mapa tokenów w pojemniku `variables` jest odzyskiwana (081 wpięte)", () => {
  // Kontener inny niż `tokens` — wcześniej handler czytał wyłącznie `parsed.tokens`,
  // więc taka odpowiedź kończyła się „modelem bez tokenów" mimo poprawnej treści.
  const w = odczytajOdpowiedzJson('{"variables":{"--bg-base":"#101010"}}', false);
  assert.ok(w.ok);
  const mapa = wyodrebnijTokeny(w.parsed);
  assert.equal(mapa.tokeny["--bg-base"], "#101010");
});
