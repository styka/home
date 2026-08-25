import { test } from "node:test";
import assert from "node:assert/strict";
import { odkazSvg, bezpiecznyObrazekData } from "../odkazSvg";

/**
 * 101 (AC-9) — treść ikony jednego użytkownika renderuje się u innego członka jego zespołu
 * (`getActiveCategoryIconMap` zwraca ikony zespołowe). Te testy pilnują jedynej rzeczy, która
 * stoi między tym faktem a wykonaniem cudzego kodu w cudzej sesji.
 *
 * Zasada doboru przypadków: sprawdzamy **sposoby wykonania kodu**, nie konkretne ładunki —
 * dlatego jest tu `onload` na kształcie i `onbegin` na animacji, a nie pięć wariantów `<script>`.
 */

test("zwykła ikona konturowa przechodzi bez zmian", () => {
  const ikona = '<path d="M3 12h18" stroke-width="1.5" stroke-linecap="round"/>';
  assert.equal(odkazSvg(ikona), ikona);
});

test("wielokształtna ikona zachowuje wszystkie dozwolone elementy", () => {
  const ikona = '<g><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></g>';
  assert.equal(odkazSvg(ikona), ikona);
});

test("atrybut zdarzeniowy na kształcie znika, sam kształt zostaje", () => {
  const wynik = odkazSvg('<circle cx="12" cy="12" r="9" onload="alert(1)"/>');
  assert.ok(!wynik.includes("onload"), "atrybut zdarzeniowy przeszedł");
  assert.ok(!wynik.includes("alert"), "ładunek przeszedł");
  assert.ok(wynik.includes('cx="12"'), "geometria powinna zostać");
});

test("wielkość liter nie omija filtra atrybutów zdarzeniowych", () => {
  const wynik = odkazSvg('<rect x="0" y="0" width="4" height="4" OnLoAd="alert(1)"/>');
  assert.ok(!/onload/i.test(wynik));
  assert.ok(!wynik.includes("alert"));
});

test("<script> znika RAZEM z treścią", () => {
  const wynik = odkazSvg('<path d="M0 0"/><script>alert(1)</script>');
  assert.ok(!wynik.includes("alert"), "treść skryptu została jako tekst");
  assert.ok(wynik.includes('<path d="M0 0"/>'));
});

test("<animate onbegin> — wykonanie kodu bez <script> — znika", () => {
  const wynik = odkazSvg('<animate onbegin="alert(1)" attributeName="x"/>');
  assert.ok(!wynik.includes("alert"));
  assert.ok(!wynik.includes("animate"));
});

test("<set onbegin> znika", () => {
  const wynik = odkazSvg('<set onbegin="alert(1)" attributeName="x" to="1"/>');
  assert.ok(!wynik.includes("alert"));
});

test("<image href onerror> znika w całości", () => {
  const wynik = odkazSvg('<image href="x" onerror="alert(1)"/>');
  assert.equal(wynik.trim(), "");
});

test("<use href> — odwołanie poza dokument — znika", () => {
  const wynik = odkazSvg('<use href="#gdzies"/>');
  assert.equal(wynik.trim(), "");
});

test("<foreignObject> z treścią HTML znika w całości", () => {
  const wynik = odkazSvg('<foreignObject><body onload="alert(1)"/></foreignObject>');
  assert.ok(!wynik.includes("alert"));
  assert.ok(!wynik.includes("foreignObject"));
});

test("atrybut style nie przechodzi (droga do cudzych reguł stylu)", () => {
  const wynik = odkazSvg('<path d="M0 0" style="background:url(javascript:alert(1))"/>');
  assert.ok(!wynik.includes("style"));
  assert.ok(!wynik.includes("javascript"));
});

test("wartość z javascript: nie przechodzi nawet w dozwolonym atrybucie", () => {
  const wynik = odkazSvg('<path d="M0 0" fill="url(javascript:alert(1))"/>');
  assert.ok(!wynik.includes("javascript"));
  assert.ok(!wynik.includes("url("));
});

test("komentarz nie może ukryć znacznika", () => {
  const wynik = odkazSvg('<!-- <script>alert(1)</script> --><path d="M0 0"/>');
  assert.ok(!wynik.includes("alert"));
});

test("pusta i niezdefiniowana treść dają pusty łańcuch, nie wyjątek", () => {
  assert.equal(odkazSvg(""), "");
  assert.equal(odkazSvg(null), "");
  assert.equal(odkazSvg(undefined), "");
});

test("obrazek data: — rastry tak, svg+xml nie", () => {
  assert.equal(bezpiecznyObrazekData("data:image/png;base64,AAAA"), true);
  assert.equal(bezpiecznyObrazekData("data:image/webp;base64,AAAA"), true);
  assert.equal(bezpiecznyObrazekData("data:image/svg+xml;base64,AAAA"), false);
  assert.equal(bezpiecznyObrazekData("data:text/html;base64,AAAA"), false);
});

/**
 * Przypadki przeciwnika dołożone na etapie RECENZJI. Pierwszy z nich wykrył wtedy realną wadę:
 * `>` wewnątrz wartości atrybutu urywał znacznik w połowie, a reszta wejścia wypadała z parsera
 * jako tekst. Nie dawało się tego wykonać, ale wynik przestawał być poprawnie zbudowany — a to
 * jest dokładnie ten rodzaj usterki, który przy następnej zmianie staje się luką.
 */

test("`>` w wartości atrybutu nie urywa znacznika ani nie wypuszcza tekstu atakującego", () => {
  const wynik = odkazSvg('<path d="M0 0" fill="a>b" onload="alert(1)">');
  assert.equal(wynik, '<path d="M0 0">');
  assert.ok(!wynik.includes("onload"));
  assert.ok(!wynik.includes("alert"));
});

test("znacznik składany z kawałków nie odtwarza się jako element", () => {
  // Klasyczne obejście filtrów: po usunięciu par `<script></script>` fragmenty sklejają się
  // w `<script>`. U nas biała lista z kroku 3 i tak go nie przepuszcza — zostaje sam TEKST,
  // który w SVG nie jest wykonywany.
  const wynik = odkazSvg("<scr<script></script>ipt>alert(1)</scr<script></script>ipt>");
  assert.ok(!wynik.includes("<script"), "znacznik odtworzył się");
  assert.ok(!/<[a-z]/i.test(wynik), "w wyniku nie powinno zostać ŻADNEGO znacznika");
});

test("kształt składany z kawałków traci ładunek", () => {
  assert.equal(odkazSvg("<circ<script></script>le onload=alert(1)>"), "<circle>");
});

test("wielkość liter nie omija usuwania niebezpiecznych elementów", () => {
  assert.equal(odkazSvg('<IMAGE HREF="x" ONERROR="alert(1)"/>').trim(), "");
});

test("encja nie przemyca schematu javascript:", () => {
  const wynik = odkazSvg('<path d="M0 0" fill="&#106;avascript:alert(1)"/>');
  assert.ok(!wynik.includes("avascript"));
});
