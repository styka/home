import { test } from "node:test";
import assert from "node:assert/strict";
import { powodZeStatusu, SpeechError, SPEECH_FAILURE_REASONS } from "@/lib/tts/serverTts";

// 080 (Z4). Zgłoszenie właściciela: „nawet wygenerowałem nowy api key i zmieniłem tu
// w ustawieniach i nadal ten sam błąd". Komunikat był ten sam, bo KAŻDA odmowa dostawcy
// zwracała 502 i to samo zdanie o kluczu API. Te testy pilnują, że powód jest rozróżniany
// — i że przy okazji nie zaczęliśmy wypuszczać na zewnątrz odpowiedzi dostawcy (C-41).

test("powodZeStatusu: odrzucony klucz to nie to samo, co nieznany model", () => {
  assert.equal(powodZeStatusu(401), "auth");
  assert.equal(powodZeStatusu(403), "auth");
  assert.equal(powodZeStatusu(404), "model");
  assert.equal(powodZeStatusu(400), "model");
  assert.notEqual(powodZeStatusu(401), powodZeStatusu(404));
});

test("powodZeStatusu: wyczerpany limit ma własny powód", () => {
  assert.equal(powodZeStatusu(429), "quota");
  assert.equal(powodZeStatusu(402), "quota", "część dostawców tak sygnalizuje koniec limitu");
});

test("powodZeStatusu: awaria po stronie dostawcy", () => {
  assert.equal(powodZeStatusu(500), "provider");
  assert.equal(powodZeStatusu(503), "provider");
});

test("powodZeStatusu: nieznany status degraduje do provider, nie wywala się", () => {
  assert.ok(SPEECH_FAILURE_REASONS.includes(powodZeStatusu(418)));
  assert.ok(SPEECH_FAILURE_REASONS.includes(powodZeStatusu(0)));
});

test("SpeechError: szczegóły dostawcy nie trafiają do komunikatu (C-41)", () => {
  // `detail` bywa surową odpowiedzią dostawcy — a ta potrafi zawierać wysłany klucz.
  const tajne = "Invalid API key: sk-live-TAJNY-KLUCZ-123";
  const err = new SpeechError("auth", tajne);
  assert.doesNotMatch(err.message, /sk-live/, "klucz nie może wyciec przez komunikat błędu");
  assert.equal(err.reason, "auth");
  assert.equal(err.detail, tajne, "szczegół zostaje dostępny dla logu serwerowego");
});

/**
 * 106 — POWÓD MA BYĆ PRAWDZIWY, A NIE WYPROWADZONY ZE STATUSU.
 *
 * Zgłoszenie właściciela: „lektor odrzuca klucz API, mimo że dałem nowy". Klucz był poprawny —
 * skończyły się kredyty, a dostawca powiedział to **odpowiedzią 401 z powodem w treści**. Sam status
 * kazał nam mówić „zły klucz", więc właściciel po raz drugi wygenerował klucz na darmo.
 */
import { powodZOdpowiedzi } from "@/lib/tts/serverTts";

test("401 z powodem limitu w treści to LIMIT, nie odrzucony klucz", () => {
  assert.equal(powodZOdpowiedzi(401, '{"detail":{"status":"quota_exceeded"}}'), "quota");
  assert.equal(powodZOdpowiedzi(401, "You have run out of credits"), "quota");
  assert.equal(powodZOdpowiedzi(401, '{"error":{"code":"insufficient_quota"}}'), "quota");
});

test("401 bez śladu limitu nadal znaczy odrzucony klucz", () => {
  assert.equal(powodZOdpowiedzi(401, '{"error":"invalid api key"}'), "auth");
  assert.equal(powodZOdpowiedzi(403, ""), "auth");
});

test("pozostałe statusy zachowują dotychczasowe znaczenie", () => {
  assert.equal(powodZOdpowiedzi(404, ""), "model");
  assert.equal(powodZOdpowiedzi(429, ""), "quota");
  assert.equal(powodZOdpowiedzi(500, ""), "provider");
});

test("wielkość liter nie ma znaczenia", () => {
  assert.equal(powodZOdpowiedzi(401, "QUOTA EXCEEDED"), "quota");
});
