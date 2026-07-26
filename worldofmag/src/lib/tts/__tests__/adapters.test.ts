import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpeechRequest, parseSpeechResponse, escapeSsml } from "@/lib/tts/adapters";
import { TTS_CATALOG, findTtsProvider, voicesForKind, isVoiceOfKind, defaultVoiceForKind } from "@/lib/tts/catalog";
import type { ResolvedLlm } from "@/lib/llm/resolver";

// 032: dostawców wymagających płatnego konta (ElevenLabs, Google, Azure) nie da się sprawdzić realnym
// nagraniem w środowisku CI — dowodem poprawności jest KONTRAKT ŻĄDANIA: adres, nagłówki i kształt
// treści. Te testy są jedynym zabezpieczeniem tych trzech torów, więc mają być drobiazgowe.

function cfg(kind: ResolvedLlm["kind"], baseUrl: string, model: string): ResolvedLlm {
  return { kind, baseUrl, apiKey: "SECRET-KEY", model };
}

const headersOf = (init: RequestInit) => (init.headers ?? {}) as Record<string, string>;

test("openai_compat: POST /audio/speech z Bearer i modelem z konfiguracji", () => {
  const req = buildSpeechRequest(cfg("openai_compat", "https://api.openai.com/v1/", "tts-1"), {
    text: "Dzień dobry",
    voiceId: "nova",
  });
  assert.equal(req.url, "https://api.openai.com/v1/audio/speech");
  assert.equal(req.init.method, "POST");
  assert.equal(headersOf(req.init).Authorization, "Bearer SECRET-KEY");
  const body = JSON.parse(String(req.init.body));
  assert.deepEqual(body, { model: "tts-1", voice: "nova", input: "Dzień dobry", response_format: "mp3" });
});

test("elevenlabs: głos w ścieżce, model w treści, klucz w nagłówku xi-api-key", () => {
  const req = buildSpeechRequest(cfg("elevenlabs", "https://api.elevenlabs.io/v1", "eleven_multilingual_v2"), {
    text: "Dzień dobry",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
  });
  assert.equal(req.url, "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM");
  assert.equal(headersOf(req.init)["xi-api-key"], "SECRET-KEY");
  // Klucz NIE może wyciekać do nagłówka Authorization ani do treści.
  assert.equal(headersOf(req.init).Authorization, undefined);
  const body = JSON.parse(String(req.init.body));
  assert.deepEqual(body, { text: "Dzień dobry", model_id: "eleven_multilingual_v2" });
});

test("google_tts: klucz w query, język pl-PL, głos jako name", () => {
  const req = buildSpeechRequest(cfg("google_tts", "https://texttospeech.googleapis.com/v1", "pl-PL"), {
    text: "Dzień dobry",
    voiceId: "pl-PL-Neural2-A",
  });
  assert.equal(req.url, "https://texttospeech.googleapis.com/v1/text:synthesize?key=SECRET-KEY");
  const body = JSON.parse(String(req.init.body));
  assert.equal(body.voice.languageCode, "pl-PL");
  assert.equal(body.voice.name, "pl-PL-Neural2-A");
  assert.equal(body.audioConfig.audioEncoding, "MP3");
  assert.equal(body.input.text, "Dzień dobry");
});

test("azure_tts: SSML z pl-PL i głosem, klucz w Ocp-Apim-Subscription-Key", () => {
  const req = buildSpeechRequest(cfg("azure_tts", "https://westeurope.tts.speech.microsoft.com", "neural"), {
    text: "Dzień dobry",
    voiceId: "pl-PL-ZofiaNeural",
  });
  assert.equal(req.url, "https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
  const h = headersOf(req.init);
  assert.equal(h["Ocp-Apim-Subscription-Key"], "SECRET-KEY");
  assert.equal(h["Content-Type"], "application/ssml+xml");
  assert.match(h["X-Microsoft-OutputFormat"], /mp3/);
  const body = String(req.init.body);
  assert.match(body, /xml:lang="pl-PL"/);
  assert.match(body, /<voice name="pl-PL-ZofiaNeural">Dzień dobry<\/voice>/);
});

test("azure_tts: znaki specjalne w tekście nie rozwalają SSML", () => {
  const req = buildSpeechRequest(cfg("azure_tts", "https://x.tts.speech.microsoft.com", "neural"), {
    text: 'Kasia & Jan <b>"test"</b>',
    voiceId: "pl-PL-ZofiaNeural",
  });
  const body = String(req.init.body);
  assert.ok(!/<b>/.test(body), "surowy tag HTML nie może trafić do SSML");
  assert.match(body, /Kasia &amp; Jan &lt;b&gt;&quot;test&quot;/);
});

test("escapeSsml: pełny zestaw znaków XML", () => {
  assert.equal(escapeSsml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
});

test("parseSpeechResponse: google zwraca base64 → dekodujemy do audio", async () => {
  const payload = Buffer.from("UDAJE-MP3").toString("base64");
  const res = new Response(JSON.stringify({ audioContent: payload }), {
    headers: { "content-type": "application/json" },
  });
  const out = await parseSpeechResponse("google_tts", res, "audio/mpeg");
  assert.equal(Buffer.from(out.audio).toString("utf8"), "UDAJE-MP3");
  assert.equal(out.contentType, "audio/mpeg");
});

test("parseSpeechResponse: pozostali oddają surowe bajty z typem z nagłówka", async () => {
  const res = new Response(Buffer.from("BAJTY"), { headers: { "content-type": "audio/mp3" } });
  const out = await parseSpeechResponse("elevenlabs", res, "audio/mpeg");
  assert.equal(Buffer.from(out.audio).toString("utf8"), "BAJTY");
  assert.equal(out.contentType, "audio/mp3");
});

// ── Katalog ──────────────────────────────────────────────────────────────────

test("katalog: każda pozycja ma co najmniej jeden model i jeden głos", () => {
  assert.ok(TTS_CATALOG.length >= 5);
  for (const p of TTS_CATALOG) {
    assert.ok(p.models.length > 0, `${p.id} bez modelu`);
    assert.ok(p.voices.length > 0, `${p.id} bez głosu`);
    assert.ok(p.costHint.length > 0 && p.polishHint.length > 0 && p.setupHint.length > 0, `${p.id} bez opisu`);
  }
});

test("katalog: identyfikatory pozycji są unikalne", () => {
  const ids = TTS_CATALOG.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("findTtsProvider: dopasowanie po adresie, a przy jego zmianie — po rodzaju", () => {
  assert.equal(findTtsProvider("openai_compat", "https://api.openai.com/v1")?.id, "openai");
  // Zmieniony region Azure nadal ma trafić w pozycję Azure (dopasowanie po rodzaju).
  assert.equal(findTtsProvider("azure_tts", "https://polandcentral.tts.speech.microsoft.com")?.id, "azure-speech");
});

test("głosy: walidacja po rodzaju dostawcy i głos domyślny", () => {
  assert.ok(isVoiceOfKind("azure_tts", "pl-PL-ZofiaNeural"));
  // Głos OpenAI nie jest głosem Azure — tego pilnuje AC-7 (nie zapisujemy obcego głosu po cichu).
  assert.equal(isVoiceOfKind("azure_tts", "nova"), false);
  assert.equal(isVoiceOfKind("azure_tts", null), false);
  assert.equal(defaultVoiceForKind("azure_tts"), voicesForKind("azure_tts")[0].id);
  assert.equal(defaultVoiceForKind("nieistniejacy"), null);
});
