import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReaderRate, READER_RATE_DEFAULT, READER_RATE_MIN, READER_RATE_MAX } from "@/lib/lektor";

// 080 (Z12). Prędkość lektora przychodzi z suwaka, ale zapis idzie przez Server Action, czyli
// przez granicę, za którą może trafić cokolwiek. Reguła: ZAOKRĄGLAMY do brzegu, nie odrzucamy
// błędem — użytkownik, który nic złego nie zrobił, nie ma prawa zobaczyć wyjątku.

test("wartość z zakresu przechodzi bez zmian", () => {
  assert.equal(parseReaderRate(1.5), 1.5);
  assert.equal(parseReaderRate(0.75), 0.75);
});

test("wartości spoza zakresu lądują na brzegu, a nie w błędzie", () => {
  assert.equal(parseReaderRate(9), READER_RATE_MAX);
  assert.equal(parseReaderRate(0.01), READER_RATE_MIN);
  assert.equal(parseReaderRate(-5), READER_RATE_MIN);
});

test("śmieć degraduje do domyślnej, a nie do zera", () => {
  // Zero byłoby ciszą — czyli dokładnie tym objawem, który naprawiamy w tej fali (Z4).
  for (const zle of [Number.NaN, Infinity, -Infinity, null, undefined]) {
    assert.equal(parseReaderRate(zle as number), READER_RATE_DEFAULT);
  }
});

test("domyślna prędkość odtwarza zachowanie sprzed 080", () => {
  // 0.95 było zaszyte w lib/tts jako u.rate. Kto niczego nie ustawi, nie może usłyszeć zmiany.
  assert.equal(READER_RATE_DEFAULT, 0.95);
  assert.ok(READER_RATE_DEFAULT >= READER_RATE_MIN && READER_RATE_DEFAULT <= READER_RATE_MAX);
});

test("prędkość jest zaokrąglana do dwóch miejsc — suwak nie ma produkować ułamków bez końca", () => {
  assert.equal(parseReaderRate(1.234567), 1.23);
});
