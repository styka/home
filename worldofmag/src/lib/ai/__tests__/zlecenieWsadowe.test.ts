import { test } from "node:test";
import assert from "node:assert/strict";
import { zlecenieWsadowe } from "@/lib/ai/zlecenieWsadowe";

// 080 (Z6). Test odtwarza WIADOMOŚĆ ZE ZGŁOSZENIA: wklejoną listę produktów na weekend, po której
// asystent dwa razy odpowiedział „zabrakło kroków" i nie dodał ani jednej pozycji.

const LISTA_ZE_ZGLOSZENIA = `Do listy zakupów weekend dodaj:

* 4 bochenki chleba
* 3 bagietki
* 36 jajek
* 2 kostki masła
* 1 kg żółtego sera
* 700 g wędliny
* 3 × 400 g śmietany 18%
* 1 l mleka
* 5 kg ziemniaków
* 1 kg cebuli
* 1 kg mąki pszennej
* 2 l oleju
* sól
* pieprz
* 1,5 kg pomidorów`;

test("lista ze zgłoszenia jest rozpoznana jako zlecenie wsadowe", () => {
  assert.equal(zlecenieWsadowe(LISTA_ZE_ZGLOSZENIA), true);
});

test("zwykłe pytanie NIE dostaje większej rezerwacji tokenów", () => {
  // Fałszywe rozpoznanie kosztuje przepustowość przy każdej rozmowie, więc próg musi być wysoki.
  for (const tekst of [
    "Co mam dziś do zrobienia?",
    "Dodaj mleko do listy zakupów",
    "Pokaż zadania z projektu Omnia i powiedz, które są zaległe",
    "Dodaj:\n- mleko\n- chleb",
  ]) {
    assert.equal(zlecenieWsadowe(tekst), false, `nie powinno być wsadowe: ${tekst.slice(0, 40)}`);
  }
});

test("długa lista bez punktorów też się liczy", () => {
  const gole = Array.from({ length: 14 }, (_, i) => `produkt ${i}`).join("\n");
  assert.equal(zlecenieWsadowe(gole), true);
});

test("lista numerowana liczy się tak samo jak punktowana", () => {
  const numerowana = Array.from({ length: 9 }, (_, i) => `${i + 1}. produkt`).join("\n");
  assert.equal(zlecenieWsadowe(numerowana), true);
});

test("puste linie nie nabijają licznika", () => {
  const zPustymi = "Dodaj:\n\n\n\n\n\n\n\n\n\n\n\n\n\n- mleko\n- chleb";
  assert.equal(zlecenieWsadowe(zPustymi), false, "same odstępy nie tworzą listy");
});

test("pusty tekst nie wywraca funkcji", () => {
  assert.equal(zlecenieWsadowe(""), false);
  assert.equal(zlecenieWsadowe("   \n  \n "), false);
});
