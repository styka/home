import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sciezkiNapisowZHtml,
  sciezkiNapisowZPlayerResponse,
  powodOdmowyZPlayerResponse,
  wybierzSciezke,
  tekstZNapisow,
  tekstZPanelu,
  paramsPanelu,
  paramsPaneluZDokumentu,
  pobierzTranskrypcje,
} from "../transkrypcja";

/**
 * 102 (AC-7, AC-8) — cała wiedza o kształcie odpowiedzi YouTube siedzi w funkcjach czystych,
 * więc zmiana po tamtej stronie objawi się TU przewracającym się testem, a nie ciszą na produkcji.
 *
 * Drugi cel tych testów jest równie ważny: udowodnić, że **nic tu nie rzuca**. Brak transkrypcji
 * jest normalnym stanem modułu, a nie awarią — jeden film bez napisów nie może wywrócić
 * odświeżania obejmującego wszystkie pozostałe.
 */

const HTML_Z_NAPISAMI = `<html><body><script>
var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[
{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc\\u0026lang=en\\u0026kind=asr","name":{"simpleText":"English (auto)"},"languageCode":"en","kind":"asr"},
{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc\\u0026lang=pl","name":{"simpleText":"Polski"},"languageCode":"pl"}
]}}};
</script></body></html>`;

test("ścieżki napisów wycinają się z osadzonego dokumentu", () => {
  const s = sciezkiNapisowZHtml(HTML_Z_NAPISAMI);
  assert.equal(s.length, 2);
  assert.equal(s[0].jezyk, "en");
  assert.equal(s[0].automatyczne, true);
  assert.equal(s[1].jezyk, "pl");
  assert.equal(s[1].automatyczne, false);
  assert.ok(s[1].baseUrl.includes("&lang=pl"), "sekwencje ucieczki powinny się odkodować");
});

test("film bez napisów daje pustą listę, nie wyjątek", () => {
  assert.deepEqual(sciezkiNapisowZHtml("<html><body>nic</body></html>"), []);
  assert.deepEqual(sciezkiNapisowZHtml(""), []);
});

test("uszkodzony dokument daje pustą listę, nie wyjątek", () => {
  assert.deepEqual(sciezkiNapisowZHtml('<script>"captionTracks":[{"baseUrl":</script>'), []);
});

test("polski wygrywa z angielskim, a autorskie z automatycznymi", () => {
  const s = sciezkiNapisowZHtml(HTML_Z_NAPISAMI);
  assert.equal(wybierzSciezke(s)?.jezyk, "pl");

  const tylkoAngielski = s.filter((x) => x.jezyk === "en");
  assert.equal(wybierzSciezke(tylkoAngielski)?.jezyk, "en", "brak polskiego → angielski");

  const dwaAngielskie = [
    { baseUrl: "a", jezyk: "en", automatyczne: true },
    { baseUrl: "b", jezyk: "en", automatyczne: false },
  ];
  assert.equal(wybierzSciezke(dwaAngielskie)?.baseUrl, "b", "autorskie przed automatycznymi");
});

test("gdy nie ma ani polskiego, ani angielskiego — bierzemy cokolwiek", () => {
  const s = [{ baseUrl: "x", jezyk: "de", automatyczne: false }];
  assert.equal(wybierzSciezke(s)?.jezyk, "de");
  assert.equal(wybierzSciezke([]), null);
});

test("tekst składa się z postaci XML", () => {
  const xml = `<?xml version="1.0"?><transcript>
<text start="0" dur="2">Dzie&#324; dobry</text>
<text start="2" dur="2">to jest   test</text>
</transcript>`;
  assert.equal(tekstZNapisow(xml), "Dzień dobry to jest test");
});

test("tekst składa się z postaci JSON", () => {
  const json = JSON.stringify({
    events: [{ segs: [{ utf8: "Dzień " }, { utf8: "dobry" }] }, { segs: [{ utf8: " świecie" }] }],
  });
  assert.equal(tekstZNapisow(json), "Dzień dobry świecie");
});

test("pusta albo uszkodzona odpowiedź daje pusty tekst, nie wyjątek", () => {
  assert.equal(tekstZNapisow(""), "");
  assert.equal(tekstZNapisow("{nie-json"), "");
  assert.equal(tekstZNapisow("<transcript></transcript>"), "");
});

test("pełna ścieżka: strona → wybór języka → tekst", async () => {
  const wynik = await pobierzTranskrypcje("abc", async (url) =>
    url.includes("watch") ? HTML_Z_NAPISAMI : "<transcript><text>Treść filmu</text></transcript>"
  );
  assert.equal(wynik?.tekst, "Treść filmu");
  assert.equal(wynik?.jezyk, "pl");
  assert.equal(wynik?.automatyczna, false);
});

test("każde niepowodzenie kończy się wartością null — NIGDY wyjątkiem", async () => {
  assert.equal(await pobierzTranskrypcje("abc", async () => null), null, "strona niedostępna");
  assert.equal(
    await pobierzTranskrypcje("abc", async (u) => (u.includes("watch") ? "<html></html>" : "x")),
    null,
    "film bez napisów"
  );
  assert.equal(
    await pobierzTranskrypcje("abc", async (u) => (u.includes("watch") ? HTML_Z_NAPISAMI : null)),
    null,
    "ścieżka napisów nie odpowiada"
  );
  assert.equal(
    await pobierzTranskrypcje("abc", async (u) => (u.includes("watch") ? HTML_Z_NAPISAMI : "")),
    null,
    "pusta transkrypcja to brak transkrypcji, a nie film z pustym tekstem"
  );
});

/**
 * 123 — próbki dróg `player` i `panel`. Droga `strona` przestała wystarczać (adresy napisów z
 * webowej odpowiedzi odtwarzacza wymagają tokenu POT i zwracają 200 z pustym ciałem), więc
 * pobranie jest łańcuchem — te testy przypinają kształty odpowiedzi obu dróg zapasowych oraz
 * samo spadanie łańcucha w dół.
 */

const PLAYER_RESPONSE = JSON.stringify({
  playabilityStatus: { status: "OK" },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        { baseUrl: "https://yt.example/timedtext?v=abc&lang=en&kind=asr", languageCode: "en", kind: "asr" },
        { baseUrl: "https://yt.example/timedtext?v=abc&lang=pl", languageCode: "pl" },
      ],
    },
  },
});

const PANEL_RESPONSE = JSON.stringify({
  actions: [
    {
      updateEngagementPanelAction: {
        content: {
          transcriptRenderer: {
            content: {
              transcriptSearchPanelRenderer: {
                body: {
                  transcriptSegmentListRenderer: {
                    initialSegments: [
                      { transcriptSectionHeaderRenderer: { snippet: { runs: [{ text: "Wstęp" }] } } },
                      { transcriptSegmentRenderer: { snippet: { runs: [{ text: "Dzień " }, { text: "dobry" }] } } },
                      { transcriptSegmentRenderer: { snippet: { runs: [{ text: "to jest test" }] } } },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  ],
});

test("ścieżki napisów wycinają się z odpowiedzi odtwarzacza (droga player)", () => {
  const s = sciezkiNapisowZPlayerResponse(PLAYER_RESPONSE);
  assert.equal(s.length, 2);
  assert.equal(s[0].jezyk, "en");
  assert.equal(s[0].automatyczne, true);
  assert.equal(s[1].jezyk, "pl");
  assert.equal(s[1].automatyczne, false);
  assert.equal(wybierzSciezke(s)?.jezyk, "pl", "wybór ścieżki jest wspólny z drogą strony");
});

test("odpowiedź odtwarzacza bez napisów albo uszkodzona daje pustą listę, nie wyjątek", () => {
  assert.deepEqual(sciezkiNapisowZPlayerResponse("{}"), []);
  assert.deepEqual(sciezkiNapisowZPlayerResponse(JSON.stringify({ playabilityStatus: { status: "LOGIN_REQUIRED" } })), []);
  assert.deepEqual(sciezkiNapisowZPlayerResponse("nie-json"), []);
  assert.deepEqual(sciezkiNapisowZPlayerResponse(""), []);
});

test("tekst składa się z odpowiedzi panelu transkrypcji (droga panel)", () => {
  assert.equal(tekstZPanelu(PANEL_RESPONSE), "Dzień dobry to jest test");
});

test("panel bez segmentów albo uszkodzony daje pusty tekst, nie wyjątek", () => {
  assert.equal(tekstZPanelu("{}"), "");
  assert.equal(tekstZPanelu("nie-json"), "");
  assert.equal(tekstZPanelu(""), "");
});

test("parametr panelu to pełny protobuf wg przepisu Invidiousa (v2)", () => {
  const params = paramsPanelu("jNQXAC9IVRw", "pl", true);
  const bajty = Buffer.from(decodeURIComponent(params), "base64url");

  // pole 1: videoId
  assert.equal(bajty[0], 0x0a, "tag pola 1");
  assert.equal(bajty[1], 11, "długość identyfikatora");
  assert.equal(bajty.subarray(2, 13).toString("utf8"), "jNQXAC9IVRw");

  // pole 2: base64url zagnieżdżonego {kind, język}
  assert.equal(bajty[13], 0x12, "tag pola 2");
  const dlWewn = bajty[14];
  const wewnetrzny = Buffer.from(bajty.subarray(15, 15 + dlWewn).toString("utf8"), "base64url");
  assert.equal(wewnetrzny[0], 0x0a, "tag kind");
  assert.equal(wewnetrzny.subarray(2, 2 + wewnetrzny[1]).toString("utf8"), "asr");
  const odJezyka = 2 + wewnetrzny[1];
  assert.equal(wewnetrzny[odJezyka], 0x12, "tag języka");
  assert.equal(wewnetrzny.subarray(odJezyka + 2, odJezyka + 2 + wewnetrzny[odJezyka + 1]).toString("utf8"), "pl");

  // pole 3 (varint 1) + pole 5 (identyfikator panelu)
  const ogon = bajty.subarray(15 + dlWewn);
  assert.equal(ogon[0], 0x18, "tag pola 3");
  assert.equal(ogon[1], 1, "wartość pola 3");
  assert.equal(ogon[2], 0x2a, "tag pola 5");
  assert.equal(ogon.subarray(4, 4 + ogon[3]).toString("utf8"), "engagement-panel-searchable-transcript-search-panel");

  // napisy autorskie = pusty kind, ale pole jest emitowane (jak w Invidiousie)
  const autorskie = Buffer.from(decodeURIComponent(paramsPanelu("jNQXAC9IVRw", "pl", false)), "base64url");
  const wewnAut = Buffer.from(autorskie.subarray(15, 15 + autorskie[14]).toString("utf8"), "base64url");
  assert.deepEqual([wewnAut[0], wewnAut[1]], [0x0a, 0], "pusty kind jest emitowany");

  assert.equal(paramsPanelu("jNQXAC9IVRw", "pl", true), params, "wynik jest stabilny");
});

test("params panelu wycinają się i ze strony filmu, i z odpowiedzi next", () => {
  const wDokumencie = 'cos{"getTranscriptEndpoint":{"params":"CgtqTlFYQUM5SVZSdw%3D%3D"}}cos';
  assert.equal(paramsPaneluZDokumentu(wDokumencie), "CgtqTlFYQUM5SVZSdw%3D%3D");

  const zUcieczka = '{"getTranscriptEndpoint":{"params":"Cgt\\u0041BC"}}';
  assert.equal(paramsPaneluZDokumentu(zUcieczka), "CgtABC", "ucieczki JSON są odkodowywane");

  assert.equal(paramsPaneluZDokumentu("<html>bez panelu</html>"), null);
  assert.equal(paramsPaneluZDokumentu(""), null);
});

test("powód odmowy odtwarzacza jest odczytywany (diagnostyka blokady IP)", () => {
  const blokada = JSON.stringify({
    playabilityStatus: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you're not a bot" },
  });
  assert.equal(powodOdmowyZPlayerResponse(blokada), "LOGIN_REQUIRED: Sign in to confirm you're not a bot");
  assert.equal(powodOdmowyZPlayerResponse(PLAYER_RESPONSE), null, "OK nie jest odmową");
  assert.equal(powodOdmowyZPlayerResponse("nie-json"), null);
});

test("pusty timedtext (POT) spuszcza łańcuch do drogi player", async () => {
  const wywolania: string[] = [];
  const wynik = await pobierzTranskrypcje("abc", async (url, opcje) => {
    wywolania.push(url);
    if (url.includes("/watch")) return HTML_Z_NAPISAMI;
    // Adresy napisów ze STRONY (youtube.com/api/timedtext) — puste 200, jak przy wymogu POT.
    if (url.includes("youtube.com/api/timedtext")) return "";
    if (url.includes("youtubei/v1/player")) {
      const cialo = JSON.parse(opcje?.body ?? "{}") as {
        videoId?: string;
        context?: { client?: { clientName?: string } };
      };
      assert.equal(cialo.videoId, "abc", "żądanie odtwarzacza niesie identyfikator filmu");
      assert.equal(cialo.context?.client?.clientName, "ANDROID", "droga player idzie jako klient ANDROID");
      return PLAYER_RESPONSE;
    }
    if (url.includes("yt.example/timedtext")) return "<transcript><text>Treść z playera</text></transcript>";
    return null;
  });
  assert.equal(wynik?.tekst, "Treść z playera");
  assert.equal(wynik?.jezyk, "pl");
  assert.equal(wynik?.zrodlo, "player");
  assert.ok(wywolania.some((u) => u.includes("youtube.com/api/timedtext")), "droga strony była próbowana najpierw");
});

test("params znalezione w HTML-u strony prowadzą prosto do panelu (droga przycisku)", async () => {
  const htmlZPanelem =
    '<html><script>var ytInitialData = {"getTranscriptEndpoint":{"params":"PRAWDZIWE%3D"}}</script></html>';
  const wynik = await pobierzTranskrypcje("jNQXAC9IVRw", async (url, opcje) => {
    if (url.includes("/watch")) return htmlZPanelem; // bez captionTracks, ale z przyciskiem transkrypcji
    if (url.includes("youtubei/v1/get_transcript")) {
      const cialo = JSON.parse(opcje?.body ?? "{}") as { params?: string };
      assert.equal(cialo.params, "PRAWDZIWE%3D", "params idą ze strony, nie z ręcznej budowy");
      return PANEL_RESPONSE;
    }
    return null;
  });
  assert.equal(wynik?.tekst, "Dzień dobry to jest test");
  assert.equal(wynik?.zrodlo, "panel");
});

test("gdy strona i player zawodzą, params przynosi odpowiedź next", async () => {
  const wynik = await pobierzTranskrypcje("jNQXAC9IVRw", async (url, opcje) => {
    if (url.includes("/watch")) return "<html></html>"; // ściana bota — bez niczego
    if (url.includes("youtubei/v1/player")) return "{}"; // odtwarzacz bez napisów
    if (url.includes("youtubei/v1/next"))
      return '{"engagementPanels":[{"getTranscriptEndpoint":{"params":"Z_NEXT"}}]}';
    if (url.includes("youtubei/v1/get_transcript")) {
      const cialo = JSON.parse(opcje?.body ?? "{}") as { params?: string };
      assert.equal(cialo.params, "Z_NEXT");
      return PANEL_RESPONSE;
    }
    return null;
  });
  assert.equal(wynik?.tekst, "Dzień dobry to jest test");
  assert.equal(wynik?.zrodlo, "panel");
});

test("ostatnia deska: ręczne params w kolejności preferencji, z językiem w wyniku", async () => {
  const probowane: string[] = [];
  const diagnoza: string[] = [];
  const wynik = await pobierzTranskrypcje(
    "jNQXAC9IVRw",
    async (url, opcje) => {
      if (url.includes("/watch")) return null; // strona nieosiągalna
      if (url.includes("youtubei/v1/player")) return "{}";
      if (url.includes("youtubei/v1/next")) return "{}";
      if (url.includes("youtubei/v1/get_transcript")) {
        const cialo = JSON.parse(opcje?.body ?? "{}") as { params?: string };
        probowane.push(cialo.params ?? "");
        // Autorskiego polskiego nie ma — dopiero automatyczny polski przynosi segmenty.
        return cialo.params === paramsPanelu("jNQXAC9IVRw", "pl", true) ? PANEL_RESPONSE : "{}";
      }
      return null;
    },
    diagnoza
  );
  assert.equal(wynik?.tekst, "Dzień dobry to jest test");
  assert.equal(wynik?.jezyk, "pl", "ręczne params znają język");
  assert.equal(wynik?.automatyczna, true);
  assert.equal(wynik?.zrodlo, "panel");
  assert.equal(probowane[0], paramsPanelu("jNQXAC9IVRw", "pl", false), "autorskie przed automatycznymi");
  assert.ok(diagnoza.some((d) => d.startsWith("strona:")), "diagnoza odnotowała odpadnięcie strony");
});

test("droga strony, gdy działa, wygrywa i raportuje swoje źródło", async () => {
  const wynik = await pobierzTranskrypcje("abc", async (url) =>
    url.includes("/watch") ? HTML_Z_NAPISAMI : "<transcript><text>Treść filmu</text></transcript>"
  );
  assert.equal(wynik?.zrodlo, "strona");
});
