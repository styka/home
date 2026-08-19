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
