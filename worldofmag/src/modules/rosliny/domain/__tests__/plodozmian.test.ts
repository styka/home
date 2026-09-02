import { test } from "node:test";
import assert from "node:assert/strict";
import { historiaMiejsca, ostrzezeniePlodozmianu, PROG_OSTRZEZENIA, type WpisHistorii } from "../plodozmian";

const wpis = (rok: number, rodzina: string | null, nazwa = "roślina"): WpisHistorii => ({ rok, rodzina, nazwa });

test("zmiana rodziny nie wywołuje żadnego ostrzeżenia", () => {
  const historia = [wpis(2025, "Fabaceae"), wpis(2024, "Poaceae")];
  assert.equal(ostrzezeniePlodozmianu("Solanaceae", historia, 2026), null);
});

test("trzeci sezon tej samej rodziny to ostrzeżenie, nie blokada", () => {
  const historia = [wpis(2025, "Solanaceae", "pomidor"), wpis(2024, "Solanaceae", "ziemniak")];
  const wynik = ostrzezeniePlodozmianu("Solanaceae", historia, 2026);

  assert.ok(wynik, "spodziewano się ostrzeżenia");
  assert.equal(wynik.powtorzenia, PROG_OSTRZEZENIA);
  assert.equal(wynik.poziom, "warn");
  assert.match(wynik.tresc, /psiankowate/);
  // Reguła OSTRZEGA — nie ma tu żadnego pola „zablokowane".
  assert.ok(!("blokada" in wynik));
});

test("drugi sezon z rzędu też jest zgłaszany, bo wtedy przerwa jeszcze coś zmienia", () => {
  const wynik = ostrzezeniePlodozmianu("Brassicaceae", [wpis(2025, "Brassicaceae")], 2026);
  assert.ok(wynik);
  assert.equal(wynik.powtorzenia, 2);
  assert.match(wynik.tresc, /kiłę kapusty/);
});

test("przerwa w historii kończy liczenie — o to właśnie chodzi w płodozmianie", () => {
  // 2023 psiankowate, 2024 przerwa (brak wpisu), 2025 psiankowate → licznik startuje od 2025.
  const historia = [wpis(2025, "Solanaceae"), wpis(2023, "Solanaceae")];
  const wynik = ostrzezeniePlodozmianu("Solanaceae", historia, 2026);
  assert.ok(wynik);
  assert.equal(wynik.powtorzenia, 2);
});

test("inna rodzina w tym samym sezonie też przerywa ciąg", () => {
  const historia = [wpis(2025, "Poaceae"), wpis(2024, "Solanaceae")];
  assert.equal(ostrzezeniePlodozmianu("Solanaceae", historia, 2026), null);
});

test("nieznana rodzina milczy — ani ostrzeżenia, ani fałszywego spokoju", () => {
  assert.equal(ostrzezeniePlodozmianu(null, [wpis(2025, null)], 2026), null);
  assert.equal(ostrzezeniePlodozmianu(undefined, [], 2026), null);
});

test("wpis historii bez rodziny nie liczy się do ciągu", () => {
  const historia = [wpis(2025, null), wpis(2024, "Solanaceae")];
  assert.equal(ostrzezeniePlodozmianu("Solanaceae", historia, 2026), null);
});

test("motylkowe po czymś innym to dobra wiadomość — reguła nie hałasuje", () => {
  assert.equal(ostrzezeniePlodozmianu("Fabaceae", [wpis(2025, "Poaceae")], 2026), null);
});

test("ale motylkowe po motylkowych już są zgłaszane", () => {
  const wynik = ostrzezeniePlodozmianu("Fabaceae", [wpis(2025, "Fabaceae")], 2026);
  assert.ok(wynik);
  assert.equal(wynik.powtorzenia, 2);
});

test("rodzina spoza listy ryzyka daje łagodniejszy poziom przy dwóch sezonach", () => {
  const wynik = ostrzezeniePlodozmianu("Cucurbitaceae", [wpis(2025, "Cucurbitaceae")], 2026);
  assert.ok(wynik);
  assert.equal(wynik.poziom, "info");
});

test("ta sama rodzina spoza listy ryzyka przy trzecim sezonie podnosi poziom", () => {
  const historia = [wpis(2025, "Cucurbitaceae"), wpis(2024, "Cucurbitaceae")];
  const wynik = ostrzezeniePlodozmianu("Cucurbitaceae", historia, 2026);
  assert.ok(wynik);
  assert.equal(wynik.poziom, "warn");
});

test("pusta historia nigdy nie ostrzega", () => {
  assert.equal(ostrzezeniePlodozmianu("Solanaceae", [], 2026), null);
});

test("historia miejsca wraca od najnowszego sezonu i respektuje limit", () => {
  const historia = [wpis(2022, "A"), wpis(2025, "B"), wpis(2023, "C"), wpis(2024, null)];
  const wynik = historiaMiejsca(historia, 3);
  assert.deepEqual(wynik.map((w) => w.rok), [2025, 2024, 2023]);
  // Wpis bez rodziny ZOSTAJE — użytkownik chce go zobaczyć, choć reguła go nie użyje.
  assert.equal(wynik[1].rodzina, null);
});
