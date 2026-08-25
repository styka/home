import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rozpoznajAdresKanalu,
  idKanaluZHtml,
  nazwaKanaluZHtml,
  uchwytZHtml,
  rozwiazKanal,
  czyIdentyfikatorKanalu,
} from "../kanal";

/**
 * 102 (AC-1) — użytkownik wkleja to, co ma pod ręką. Te testy pilnują, że każda postać, jaką
 * YouTube pokazuje w pasku adresu, prowadzi do tego samego identyfikatora — i że wejście spoza
 * YouTube jest odrzucane, a nie pobierane „na wszelki wypadek".
 *
 * Wszystko na zapisanych próbkach: test odpytujący żywy serwis nie przechodzi w piaskownicy,
 * a w CI byłby migotliwy i sprawdzałby cudzy serwis zamiast naszego kodu.
 */

const ID = "UCXuqSBlHAE6Xw-yeJA0Tunw";

test("identyfikator rozpoznajemy po kształcie, nie po długości na oko", () => {
  assert.equal(czyIdentyfikatorKanalu(ID), true);
  assert.equal(czyIdentyfikatorKanalu("UCzakrotki"), false);
  assert.equal(czyIdentyfikatorKanalu("XX" + ID.slice(2)), false);
});

test("wszystkie postacie adresu prowadzą do tego samego kanału", () => {
  assert.deepEqual(rozpoznajAdresKanalu(ID), { rodzaj: "id", id: ID });
  assert.deepEqual(rozpoznajAdresKanalu(`https://www.youtube.com/channel/${ID}`), { rodzaj: "id", id: ID });
  assert.deepEqual(rozpoznajAdresKanalu(`youtube.com/channel/${ID}/`), { rodzaj: "id", id: ID });

  const uchwyt = rozpoznajAdresKanalu("@LinusTechTips");
  assert.equal(uchwyt?.rodzaj, "strona");
  assert.equal(uchwyt && "handle" in uchwyt ? uchwyt.handle : null, "@LinusTechTips");

  const zAdresu = rozpoznajAdresKanalu("https://www.youtube.com/@LinusTechTips");
  assert.equal(zAdresu?.rodzaj, "strona");

  assert.equal(rozpoznajAdresKanalu("https://www.youtube.com/c/JakasNazwa")?.rodzaj, "strona");
  assert.equal(rozpoznajAdresKanalu("https://www.youtube.com/user/JakasNazwa")?.rodzaj, "strona");
});

test("adres spoza YouTube jest odrzucany, a nie pobierany", () => {
  assert.equal(rozpoznajAdresKanalu("https://example.com/@ktos"), null);
  assert.equal(rozpoznajAdresKanalu("https://youtube.com.zlodziej.pl/@ktos"), null);
  assert.equal(rozpoznajAdresKanalu(""), null);
  assert.equal(rozpoznajAdresKanalu("cokolwiek"), null);
});

const PROBKA_STRONY = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Kanał Testowy &amp; Sp&#243;łka">
<link rel="canonical" href="https://www.youtube.com/channel/${ID}">
</head><body><script>var x = {"externalId":"${ID}","channelHandle":{"simpleText":"@kanaltestowy"}};</script></body></html>`;

test("identyfikator, nazwa i uchwyt wyciągają się ze strony kanału", () => {
  assert.equal(idKanaluZHtml(PROBKA_STRONY), ID);
  assert.equal(nazwaKanaluZHtml(PROBKA_STRONY), "Kanał Testowy & Spółka");
  assert.equal(uchwytZHtml(PROBKA_STRONY), "@kanaltestowy");
});

test("strona bez identyfikatora daje null, nie wyjątek", () => {
  assert.equal(idKanaluZHtml("<html><body>nic tu nie ma</body></html>"), null);
});

test("rozwiazKanal: uchwyt → strona → identyfikator", async () => {
  const odwiedzone: string[] = [];
  const wynik = await rozwiazKanal("@kanaltestowy", async (url) => {
    odwiedzone.push(url);
    return PROBKA_STRONY;
  });
  assert.equal(wynik?.channelId, ID);
  assert.equal(wynik?.title, "Kanał Testowy & Spółka");
  assert.deepEqual(odwiedzone, ["https://www.youtube.com/@kanaltestowy"]);
});

test("rozwiazKanal: niedostępna strona daje null, nie wyjątek", async () => {
  assert.equal(await rozwiazKanal("@ktokolwiek", async () => null), null);
});

test("rozwiazKanal: gotowy identyfikator działa nawet gdy strona nie odpowiada", async () => {
  const wynik = await rozwiazKanal(ID, async () => null);
  assert.equal(wynik?.channelId, ID, "identyfikator znamy z wejścia — brak strony nie może go unieważnić");
  assert.equal(wynik?.title, null);
});
