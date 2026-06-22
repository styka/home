import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankCsv, parseBankDate, parseBankAmount } from "@/lib/portfel/bankCsv";

// Z-300: parser wyciągów bankowych CSV.

test("parseBankDate: różne formaty → ISO", () => {
  assert.equal(parseBankDate("2026-06-17"), "2026-06-17");
  assert.equal(parseBankDate("17.06.2026"), "2026-06-17");
  assert.equal(parseBankDate("7/6/2026"), "2026-06-07");
  assert.equal(parseBankDate("17 czerwca"), null);
  assert.equal(parseBankDate("32.13.2026"), null, "niepoprawny miesiąc/dzień");
});

test("parseBankAmount: przecinek dziesiętny, separator tysięcy, znaki", () => {
  assert.equal(parseBankAmount("1 234,56"), 1234.56);
  assert.equal(parseBankAmount("-50,00"), -50);
  assert.equal(parseBankAmount("+1234.56"), 1234.56);
  assert.equal(parseBankAmount("(50,00)"), -50, "nawias księgowy = ujemne");
  assert.equal(parseBankAmount("1.234,56"), 1234.56, "kropka tysięcy + przecinek dziesiętny");
  assert.equal(parseBankAmount("99,90 zł"), 99.9);
  assert.equal(parseBankAmount("brak"), null);
});

test("parseBankCsv: separator ';', nagłówek, daty dd.mm.yyyy, kwoty z przecinkiem", () => {
  const csv = [
    "Data;Opis;Kwota",
    "01.06.2026;Sklep spożywczy;-123,45",
    "05.06.2026;Wypłata;+5000,00",
    "10.06.2026;Kawa;-12,00",
  ].join("\n");
  const r = parseBankCsv(csv);
  assert.equal(r.transactions.length, 3, "3 transakcje (nagłówek pominięty)");
  assert.equal(r.skipped, 1, "nagłówek nieparsowalny → skipped");
  assert.deepEqual(r.transactions[0], { date: "2026-06-01", amount: -123.45, description: "Sklep spożywczy" });
  assert.equal(r.transactions[1].amount, 5000);
});

test("parseBankCsv: separator ',', daty ISO", () => {
  const csv = "2026-01-02,Czynsz,-1500.00\n2026-01-03,Premia,250.50";
  const r = parseBankCsv(csv);
  assert.equal(r.transactions.length, 2);
  assert.equal(r.transactions[0].amount, -1500);
  assert.equal(r.transactions[0].description, "Czynsz");
});

test("parseBankCsv: pusty wkład → brak transakcji, bez wyjątku", () => {
  const r = parseBankCsv("");
  assert.equal(r.transactions.length, 0);
  assert.equal(r.skipped, 0);
});

test("parseBankCsv: wykrywa kolumny niezależnie od kolejności", () => {
  // kwota, opis, data
  const csv = "-99,99;Paliwo;15.06.2026\n200,00;Zwrot;16.06.2026";
  const r = parseBankCsv(csv);
  assert.equal(r.transactions.length, 2);
  assert.equal(r.transactions[0].date, "2026-06-15");
  assert.equal(r.transactions[0].amount, -99.99);
  assert.equal(r.transactions[0].description, "Paliwo");
});
