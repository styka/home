// 032: opis NIEDOKOŃCZONEGO przebiegu agenta.
//
// Problem, który rozwiązuje: gdy przebieg się nie domknął, użytkownik dostawał jedno zdanie „Nie
// udało się dokończyć w limicie kroków", które nie mówiło ani co asystent ustalił, ani co go
// zablokowało. Tutaj wyciągamy jedno i drugie z logu przebiegu — to ścieżka AWARYJNA (główna to
// podsumowanie modelem), używana gdy dodatkowe wywołanie modelu też zawiedzie.
//
// Czysta logika bez zależności, żeby dała się przetestować bez bazy i bez sieci.

export interface PartialRunResult {
  error?: string;
  repeat?: string;
}

export interface PartialRunLogEntry {
  results?: PartialRunResult[];
}

/**
 * Ile odczytów danych faktycznie się udało. Świadomie NIE nazywamy narzędzi — ich nazwy są
 * techniczne, a użytkownik nie ma ich widzieć (dorobek 031).
 */
export function countSuccessfulReads(log: PartialRunLogEntry[]): number {
  let n = 0;
  for (const entry of log) {
    for (const r of entry.results ?? []) {
      if (!r.error && !r.repeat) n += 1;
    }
  }
  return n;
}

/**
 * Co konkretnie zablokowało dokończenie. Kolejność jest celowa — od przyczyny najbardziej
 * konkretnej do najbardziej ogólnej:
 *  1. ucięcie odpowiedzi (wiemy to wprost od dostawcy),
 *  2. ostatni błąd narzędzia (np. nierozwiązana nazwa listy),
 *  3. powtarzanie tych samych odczytów bez postępu,
 *  4. zwyczajny brak kroków.
 */
export function describeBlocker(log: PartialRunLogEntry[], truncated: boolean): string {
  if (truncated) return "odpowiedź nie zmieściła się w dopuszczalnej długości";
  const errors: string[] = [];
  for (const entry of log) {
    for (const r of entry.results ?? []) {
      if (r.error) errors.push(r.error);
    }
  }
  if (errors.length > 0) return errors[errors.length - 1];
  if (log.some((e) => (e.results ?? []).some((r) => r.repeat))) {
    return "kolejne próby pobierania danych nie wnosiły nic nowego";
  }
  return "zabrakło kroków na dokończenie odpowiedzi";
}

/** Awaryjny komunikat dla użytkownika: co ustalono + co zablokowało + jak dopytać (AC-11). */
export function partialRunFallbackMessage(log: PartialRunLogEntry[], truncated: boolean): string {
  const reads = countSuccessfulReads(log);
  const gathered =
    reads > 0
      ? `Zdążyłem pobrać dane z aplikacji (${reads} ${reads === 1 ? "odczyt" : "odczyty"}), ale nie ułożyłem z nich odpowiedzi.`
      : "Nie zdążyłem jeszcze pobrać żadnych danych.";
  return (
    `Nie dokończyłem tego zadania. ${gathered} ` +
    `Zablokowało mnie to: ${describeBlocker(log, truncated)}. ` +
    "Spróbuj poprosić o jedną rzecz naraz — np. najpierw o samo wskazanie zadania, a potem o jego omówienie."
  );
}
