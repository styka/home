import { test } from "node:test";
import assert from "node:assert/strict";
import {
  speak,
  setServerVoiceId,
  setSpeechFallbackNotice,
  serverVoiceLatchedOff,
} from "@/lib/tts";

// 080 (Z4). Zgłoszenie: „jak włączy się czytaj to nic nie słychać".
//
// Ścieżka zapasowa istniała, ale była per wypowiedź i asynchroniczna: każde zdanie szło do
// /api/tts, dostawało odmowę i DOPIERO POTEM wołało syntezę przeglądarki — już poza gestem
// użytkownika, gdzie WebKit odrzuca ją po cichu. Efekt: cisza zamiast innego głosu.
//
// Te testy pilnują jednej rzeczy, która to naprawia: po pierwszej odmowie kolejne wypowiedzi
// NIE wykonują już żądania. Bez tego naprawa byłaby pozorna.

/** Podstawiony `fetch` zawsze odmawiający; liczy wywołania. */
function odmawiajacyFetch(status = 502, reason = "auth") {
  let calls = 0;
  const fn = async () => {
    calls++;
    return {
      ok: false,
      status,
      json: async () => ({ error: "Nie udało się odczytać tekstu na głos.", reason }),
    } as unknown as Response;
  };
  return Object.assign(fn, { calls: () => calls });
}

/** Domyka mikrozadania — `speak()` jest synchroniczne, ale odpala łańcuch obietnic. */
const przelicz = () => new Promise<void>((r) => setTimeout(r, 0));

test("po pierwszej odmowie kolejne wypowiedzi nie wykonują już żądania", async () => {
  const f = odmawiajacyFetch();
  const oryginalny = globalThis.fetch;
  globalThis.fetch = f as unknown as typeof fetch;
  setSpeechFallbackNotice(null);
  setServerVoiceId("jakis-glos");

  try {
    speak("Pierwsze zdanie.", "pl");
    await przelicz();
    assert.equal(f.calls(), 1, "pierwsze zdanie próbuje głosu serwerowego");
    assert.ok(serverVoiceLatchedOff(), "odmowa zatrzaskuje głos serwerowy");

    speak("Drugie zdanie.", "pl");
    speak("Trzecie zdanie.", "pl");
    await przelicz();
    assert.equal(f.calls(), 1, "kolejne zdania omijają sieć — synteza rusza w geście użytkownika");
  } finally {
    globalThis.fetch = oryginalny;
    setServerVoiceId(null);
  }
});

test("użytkownik jest informowany o zejściu na głos systemowy — dokładnie raz", async () => {
  const f = odmawiajacyFetch(502, "auth");
  const oryginalny = globalThis.fetch;
  globalThis.fetch = f as unknown as typeof fetch;

  const powiadomienia: (string | null)[] = [];
  setSpeechFallbackNotice((r) => powiadomienia.push(r));
  setServerVoiceId("inny-glos");

  try {
    speak("Raz.", "pl");
    await przelicz();
    speak("Dwa.", "pl");
    speak("Trzy.", "pl");
    await przelicz();

    assert.equal(powiadomienia.length, 1, "przejście musi być widoczne, ale nie natrętne");
    assert.equal(powiadomienia[0], "auth", "powód z trasy dociera do UI");
  } finally {
    globalThis.fetch = oryginalny;
    setSpeechFallbackNotice(null);
    setServerVoiceId(null);
  }
});

test("zmiana głosu kasuje zatrzask — administrator mógł właśnie poprawić konfigurację", async () => {
  const f = odmawiajacyFetch();
  const oryginalny = globalThis.fetch;
  globalThis.fetch = f as unknown as typeof fetch;
  setSpeechFallbackNotice(null);
  setServerVoiceId("glos-a");

  try {
    speak("Zdanie.", "pl");
    await przelicz();
    assert.ok(serverVoiceLatchedOff());

    setServerVoiceId("glos-b");
    assert.equal(serverVoiceLatchedOff(), false, "nowa konfiguracja dostaje kolejną szansę");

    speak("Zdanie.", "pl");
    await przelicz();
    assert.equal(f.calls(), 2, "po zmianie głosu znów próbujemy serwera");
  } finally {
    globalThis.fetch = oryginalny;
    setServerVoiceId(null);
  }
});

// ── 080 (Z12): prędkość czytania ────────────────────────────────────────────

test("prędkość jest wspólna dla obu ścieżek i trzymana w dozwolonym zakresie", async () => {
  const { setSpeechRate, getSpeechRate } = await import("@/lib/tts");

  setSpeechRate(1.5);
  assert.equal(getSpeechRate(), 1.5);

  // Wartości spoza zakresu zaokrąglamy do brzegu — suwak nie może wyprodukować bełkotu.
  setSpeechRate(9);
  assert.equal(getSpeechRate(), 2);
  setSpeechRate(0.1);
  assert.equal(getSpeechRate(), 0.5);

  // Śmieć nie może wyzerować prędkości ani rzucić — zostaje ostatnia poprawna.
  setSpeechRate(Number.NaN);
  assert.equal(getSpeechRate(), 0.5);

  setSpeechRate(0.95);
});
