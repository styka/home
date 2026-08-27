import { test } from "node:test";
import assert from "node:assert/strict";
import {
  czyZaDlugie,
  instrukcjaDlugosci,
  liczSlowa,
  maksSlow,
  materialUbogi,
  poziomStreszczenia,
  LIMIT_MATERIALU,
  MIN_MATERIALU,
} from "../dlugoscStreszczenia";

const slowa = (n: number) => Array.from({ length: n }, () => "słowo").join(" ");

/**
 * 111 (AC-23) — pułap musi być w instrukcji dla modelu i w kontroli wyniku TĄ SAMĄ liczbą.
 * Gdy się rozjadą, kontrola zaczyna odrzucać teksty zgodne z instrukcją albo przepuszczać niezgodne.
 */
test("instrukcja niesie dokładnie ten pułap, którego pilnuje kontrola", () => {
  for (const p of ["short", "medium", "long"] as const) {
    assert.match(instrukcjaDlugosci(p), new RegExp(`${maksSlow(p)}`));
  }
});

test("pułapy rosną wraz z poziomem", () => {
  assert.ok(maksSlow("short") < maksSlow("medium"));
  assert.ok(maksSlow("medium") < maksSlow("long"));
});

test("liczSlowa nie liczy pustego tekstu jako jednego słowa", () => {
  assert.equal(liczSlowa(""), 0);
  assert.equal(liczSlowa("   "), 0);
  assert.equal(liczSlowa("dwa słowa"), 2);
});

/**
 * To jest liczbowy zapis zgłoszenia: „streszczenie około dwa razy dłuższe, mimo że poziom ten sam".
 * Dwukrotność pułapu musi zostać wyłapana; wynik mieszczący się w pułapie — nie.
 */
test("dwukrotnie za długi wynik jest wyłapany, mieszczący się w pułapie — nie", () => {
  assert.equal(czyZaDlugie(slowa(maksSlow("medium") * 2), "medium"), true);
  assert.equal(czyZaDlugie(slowa(maksSlow("medium")), "medium"), false);
});

/**
 * Tolerancja istnieje po to, żeby nie płacić za kolejne wywołanie z powodu kilku słów — model
 * liczy słowa inaczej niż my.
 */
test("nieznaczne przekroczenie pułapu nie wywołuje korekty", () => {
  assert.equal(czyZaDlugie(slowa(maksSlow("medium") + 3), "medium"), false);
});

test("nieznany poziom to poziom średni, nie wyjątek", () => {
  assert.equal(poziomStreszczenia("bzdura"), "medium");
  assert.equal(poziomStreszczenia(null), "medium");
  assert.equal(poziomStreszczenia("long"), "long");
});

/**
 * 111 (AC-21) — próg ubogiego materiału jest sygnałem „sięgnij po pełny artykuł". Pusty skrót
 * z kanału to dokładnie ten przypadek, w którym model odpowiadał, że nie ma czego streszczać.
 */
test("pusty i jednozdaniowy skrót z kanału liczy się jako materiał ubogi", () => {
  assert.equal(materialUbogi(""), true);
  assert.equal(materialUbogi(null), true);
  assert.equal(materialUbogi("Krótka zapowiedź."), true);
  assert.equal(materialUbogi("x".repeat(MIN_MATERIALU)), false);
});

/** Wspólny limit materiału jest warunkiem powtarzalności — obie ścieżki muszą widzieć tyle samo. */
test("limit materiału jest jedną liczbą, wspólną dla obu ścieżek", () => {
  assert.ok(LIMIT_MATERIALU > MIN_MATERIALU);
});
