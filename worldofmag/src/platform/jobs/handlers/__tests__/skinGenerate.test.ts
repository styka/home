import { test } from "node:test";
import assert from "node:assert/strict";
import { korekta, opisPorazki, SKIN_MAX_ATTEMPTS } from "@/platform/jobs/handlers/skinGenerate";

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
