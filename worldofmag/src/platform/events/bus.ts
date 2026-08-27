/**
 * 072 (zadanie 23, rozdz. 11.1) — SZYNA ROZGŁOSZENIOWA W PROCESIE.
 *
 * Ostatnie ogniwo łańcucha z rozdz. 11.1.1: worker dostarczył zdarzenie, teraz trzeba powiedzieć
 * o tym **otwartym kartom**. Szyna łączy worker (nadawca) z trasami strumienia (odbiorcy).
 *
 * **OGRANICZENIE, KTÓRE TRZEBA ZNAĆ: to jest szyna JEDNEGO PROCESU.** Rozdz. 11.1.1 wymienia w tym
 * miejscu `LISTEN/NOTIFY` albo Redis — i oba istnieją tam z **jednego** powodu: żeby worker
 * z instancji A dosięgnął karty podłączonej do instancji B. Omnia chodzi dziś na **jednej**
 * instancji, a oba warianty wymagają surowego połączenia poza Prismą, czyli nowej zależności.
 * Kupowanie jej na zapas byłoby dokładnie tym, czego zabrania C-53.
 *
 * Konsekwencja przy wielu instancjach: karta dostanie sygnał tylko ze swojej. **Siatką
 * bezpieczeństwa jest 5-minutowe odpytywanie awaryjne** w `DataFreshness` — i dlatego zostaje ono
 * na stałe, a nie „dopóki nie mamy SSE". Szczegóły: `docs/devops/kanal-czasu-rzeczywistego.md`.
 */

export interface SygnalKanalu {
  /** Rodzaj zdarzenia — klient go nie renderuje, służy do diagnostyki i filtrowania. */
  type: string;
  /**
   * Przestrzeń, której dotyczy zmiana.
   *
   * 107: **opcjonalna**. Zdarzenia domenowe zawsze mają przestrzeń, ale rozmowa prywatna nie żyje
   * w żadnej — jej uczestnicy są wymienieni wprost. Wymuszanie tu pustego łańcucha byłoby
   * kłamstwem o danych, żeby zadowolić typ.
   */
  workspaceId?: string;
  /**
   * 107: której rozmowy dotyczy sygnał — żeby otwarty wątek mógł zignorować cudzą rozmowę
   * zamiast dociągać wiadomości przy każdym sygnale.
   *
   * Ładunek zostaje UBOGI: nie ma tu treści wiadomości ani nazwiska autora. Klient dostaje
   * wyłącznie „w tej rozmowie coś się zmieniło” i pobiera treść z serwera, który sprawdza
   * uczestnictwo — to zamyka drogę do podsłuchania cudzej rozmowy kanałem.
   */
  rozmowaId?: string;
}

type Sluchacz = (sygnal: SygnalKanalu) => void;

// Guard singletona przetrwały przeładowanie modułów w trybie deweloperskim — ten sam chwyt co
// w obu workerach. Bez niego każda przebudowa modułu zakłada drugą, pustą szynę.
const g = globalThis as unknown as { __omniaEventBus?: Map<string, Set<Sluchacz>> };
const kanaly: Map<string, Set<Sluchacz>> = (g.__omniaEventBus ??= new Map());

/**
 * Zapisuje słuchacza na podane kanały i **zwraca funkcję odsubskrybowania**.
 *
 * Zwracanie odsubskrybowania nie jest wygodą, tylko wymogiem poprawności: bez niego każda zamknięta
 * karta zostawia słuchacza w mapie, a po dobie serwer rozgłasza do połączeń, których nie ma.
 */
export function subskrybuj(nazwy: string[], sluchacz: Sluchacz): () => void {
  for (const n of nazwy) {
    if (!kanaly.has(n)) kanaly.set(n, new Set());
    kanaly.get(n)!.add(sluchacz);
  }
  return () => {
    for (const n of nazwy) {
      const zbior = kanaly.get(n);
      if (!zbior) continue;
      zbior.delete(sluchacz);
      if (zbior.size === 0) kanaly.delete(n);
    }
  };
}

/**
 * Rozgłasza sygnał na podane kanały. Błąd jednego słuchacza nie blokuje pozostałych.
 *
 * **Uwaga na `forEach` zamiast `for…of` po zbiorze.** Główny `tsconfig.json` nie ustawia `target`,
 * więc przy sprawdzaniu typów przez `next build` iteracja po `Set` wymagałaby `downlevelIteration`.
 * `tsconfig.test.json` ma `ES2022` i tego nie wyłapie — build owszem.
 */
export function rozglos(nazwy: string[], sygnal: SygnalKanalu): void {
  const juz = new Set<Sluchacz>();
  nazwy.forEach((n) => {
    kanaly.get(n)?.forEach((s) => {
      // Karta bywa zapisana na kilku kanałach naraz (własnym i przestrzeni) — sygnał ma do niej
      // dotrzeć RAZ, inaczej `router.refresh()` poleciałby dwa razy pod rząd.
      if (juz.has(s)) return;
      juz.add(s);
      try {
        s(sygnal);
      } catch {
        // Zerwane połączenie rzuca przy zapisie. To normalny koniec życia karty, nie awaria.
      }
    });
  });
}

/** Liczba aktywnych słuchaczy — do diagnostyki i testów. */
export function ileSluchaczy(): number {
  const wszyscy = new Set<Sluchacz>();
  kanaly.forEach((zbior) => zbior.forEach((s) => wszyscy.add(s)));
  return wszyscy.size;
}

/** Nazwy kanałów dla użytkownika. Liczone WYŁĄCZNIE na serwerze z sesji (C-21). */
export function kanalyDla(userId: string, workspaceIds: string[]): string[] {
  return [`user:${userId}`, ...workspaceIds.map((id) => `ws:${id}`)];
}
