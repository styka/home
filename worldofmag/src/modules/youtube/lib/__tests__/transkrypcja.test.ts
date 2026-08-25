import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sciezkiNapisowZHtml,
  wybierzSciezke,
  tekstZNapisow,
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
