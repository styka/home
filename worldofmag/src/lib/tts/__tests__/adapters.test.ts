import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpeechRequest, parseSpeechResponse, escapeSsml } from "@/lib/tts/adapters";
import {
  TTS_CATALOG,
  findTtsProvider,
  findTtsProviderById,
  voicesFor,
  isVoiceOf,
  defaultVoiceFor,
  isKindUnique,
  providerMatchesSpec,
} from "@/lib/tts/catalog";
import type { ResolvedLlm } from "@/platform/llm/resolver";

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

test("findTtsProvider: dopasowanie po rodzaju I adresie", () => {
  assert.equal(findTtsProvider("openai_compat", "https://api.openai.com/v1")?.id, "openai");
  assert.equal(findTtsProvider("openai_compat", "https://api.groq.com/openai/v1")?.id, "groq-playai");
  // Końcowy ukośnik nie może psuć dopasowania.
  assert.equal(findTtsProvider("openai_compat", "https://api.openai.com/v1/")?.id, "openai");
});

// ── R-1/R-2/R-3: `kind` NIE identyfikuje pozycji katalogu ────────────────────
// OpenAI i Groq PlayAI dzielą `openai_compat`. Dopasowanie po samym rodzaju powodowało, że zapis
// lektora OpenAI trafiał w istniejący wiersz Groqa (obsługujący czat) i przestawiał mu adres —
// czyli wyłączał cały asystent. Te testy pilnują, że rodzaj jest fallbackiem TYLKO gdy jednoznaczny.

test("isKindUnique: openai_compat NIE jest jednoznaczny, pozostałe są", () => {
  assert.equal(isKindUnique("openai_compat"), false);
  assert.equal(isKindUnique("elevenlabs"), true);
  assert.equal(isKindUnique("google_tts"), true);
  assert.equal(isKindUnique("azure_tts"), true);
});

test("nieznany adres przy NIEJEDNOZNACZNYM rodzaju → brak dopasowania (nie zgadujemy)", () => {
  // Proxy zgodne z OpenAI pod obcym adresem: nie wolno założyć, że to OpenAI ani że to Groq.
  assert.equal(findTtsProvider("openai_compat", "https://proxy.example.com/v1"), undefined);
  assert.deepEqual(voicesFor("openai_compat", "https://proxy.example.com/v1"), []);
  assert.equal(defaultVoiceFor("openai_compat", "https://proxy.example.com/v1"), null);
});

test("nieznany adres przy JEDNOZNACZNYM rodzaju → fallback po rodzaju (region Azure)", () => {
  assert.equal(findTtsProvider("azure_tts", "https://polandcentral.tts.speech.microsoft.com")?.id, "azure-speech");
  assert.ok(isVoiceOf("azure_tts", "https://polandcentral.tts.speech.microsoft.com", "pl-PL-ZofiaNeural"));
});

test("głosy należą do POZYCJI katalogu, nie do rodzaju", () => {
  const openaiUrl = "https://api.openai.com/v1";
  const groqUrl = "https://api.groq.com/openai/v1";
  // Ten sam `kind`, a listy głosów rozłączne — to jest sedno błędu R-3.
  assert.ok(isVoiceOf("openai_compat", openaiUrl, "nova"));
  assert.equal(isVoiceOf("openai_compat", groqUrl, "nova"), false);
  assert.ok(isVoiceOf("openai_compat", groqUrl, "Fritz-PlayAI"));
  assert.equal(isVoiceOf("openai_compat", openaiUrl, "Fritz-PlayAI"), false);
  assert.equal(defaultVoiceFor("openai_compat", groqUrl), "Fritz-PlayAI");
  assert.equal(defaultVoiceFor("openai_compat", openaiUrl), "nova");
});

test("głosy: walidacja po dostawcy i głos domyślny", () => {
  const azureUrl = "https://westeurope.tts.speech.microsoft.com";
  assert.ok(isVoiceOf("azure_tts", azureUrl, "pl-PL-ZofiaNeural"));
  // Głos OpenAI nie jest głosem Azure — tego pilnuje AC-7 (nie zapisujemy obcego głosu po cichu).
  assert.equal(isVoiceOf("azure_tts", azureUrl, "nova"), false);
  assert.equal(isVoiceOf("azure_tts", azureUrl, null), false);
  assert.equal(defaultVoiceFor("azure_tts", azureUrl), voicesFor("azure_tts", azureUrl)[0].id);
  assert.equal(defaultVoiceFor("nieistniejacy", "https://x"), null);
});

test("providerMatchesSpec: zapis lektora OpenAI NIE MOŻE trafić w wiersz Groqa (R-1)", () => {
  // Dokładny scenariusz z recenzji: standardowa instalacja ma dostawcę Groq obsługującego czat.
  const groqRow = { kind: "openai_compat", baseUrl: "https://api.groq.com/openai/v1" };
  const openaiSpec = findTtsProviderById("openai")!;
  const groqSpec = findTtsProviderById("groq-playai")!;

  // Gdyby to było `true`, `applySpeechProvider` przestawiłoby adres Groqa na api.openai.com,
  // zostawiając klucz Groqa — i cały asystent zacząłby zwracać 401.
  assert.equal(providerMatchesSpec(groqRow, openaiSpec), false);
  // Ten sam wiersz JEST natomiast właściwym dostawcą dla pozycji Groq PlayAI.
  assert.equal(providerMatchesSpec(groqRow, groqSpec), true);
});

test("providerMatchesSpec: rodzaj jednoznaczny dopuszcza zmianę adresu (region Azure)", () => {
  const azureSpec = findTtsProviderById("azure-speech")!;
  const azureRow = { kind: "azure_tts", baseUrl: "https://polandcentral.tts.speech.microsoft.com" };
  // Inny region to nadal ten sam dostawca — aktualizujemy w miejscu, nie mnożymy wierszy.
  assert.equal(providerMatchesSpec(azureRow, azureSpec), true);
  // Ale inny RODZAJ to zawsze inny dostawca.
  assert.equal(providerMatchesSpec({ kind: "google_tts", baseUrl: azureSpec.baseUrl }, azureSpec), false);
});

test("providerMatchesSpec: końcowy ukośnik nie tworzy duplikatu dostawcy", () => {
  const openaiSpec = findTtsProviderById("openai")!;
  assert.equal(providerMatchesSpec({ kind: "openai_compat", baseUrl: "https://api.openai.com/v1/" }, openaiSpec), true);
});

test("adresy bazowe pozycji katalogu są rozłączne w obrębie rodzaju", () => {
  // Gdyby dwie pozycje miały ten sam rodzaj I adres, dopasowanie znów byłoby niejednoznaczne.
  const keys = TTS_CATALOG.map((p) => `${p.kind}|${p.baseUrl.replace(/\/+$/, "")}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("każda pozycja katalogu ma głos domyślny osiągalny przez swój adres", () => {
  for (const spec of TTS_CATALOG) {
    const fallback = defaultVoiceFor(spec.kind, spec.baseUrl);
    assert.equal(fallback, spec.voices[0].id, `${spec.id}: zły głos domyślny`);
    assert.equal(findTtsProviderById(spec.id)?.id, spec.id);
  }
});
