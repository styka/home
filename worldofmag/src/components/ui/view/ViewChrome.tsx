"use client";

/**
 * 045/085 — co z kontraktu widoku należy do POWŁOKI.
 *
 * Do 085 mieszkał tu kontekst, którym powłoka wstrzykiwała do paska widoku trzy elementy: gwiazdkę
 * ulubionych, wskaźnik świeżości danych i wejście do ściągawki skrótów. Wszystkie trzy stąd wyszły
 * (gwiazdka i ściągawka do rzędu chromu konta, wskaźnik świeżości skasowany jako mylący), więc
 * kontekst został pusty i zniknął razem z nimi — mechanizm bez zawartości byłby martwym API
 * w miejscu wspólnym.
 *
 * Zostaje `ViewResource`: to osobny byt, prop `ModuleView`, a nie zawartość paska.
 */

/**
 * Zasób, którego dotyczy widok.
 *
 * ŚWIADOMIE ZAREZERWOWANY (plan 045 §5.2). Dziś nic nie robi. Istnieje od początku, żeby
 * okno konfliktu edycji, udostępnianie i awatary obecności — wymagające zdolności
 * z Faz 2 i 4 przebudowy — dało się dołożyć **bez wracania do 21 modułów**. Dokładnie
 * o to chodzi w rozdz. 10.5 architektury docelowej.
 */
export interface ViewResource {
  /** np. "tasks.project", "shopping.list" */
  type: string;
  id: string;
}
