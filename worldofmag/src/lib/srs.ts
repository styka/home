// Algorytm powtórek rozłożonych w czasie (SuperMemo-2).
//
// Cel: słowa, które idą najgorzej (niskie oceny), wracają szybko i często,
// ale słowa dobrze opanowane NIE są zapominane — dostają coraz dłuższe
// interwały, lecz nadal mają termin powtórki (dueAt). Dzięki temu cała talia
// jest utrzymywana w pamięci, a wysiłek koncentruje się tam, gdzie trzeba.

export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface SrsUpdate extends SrsState {
  dueAt: Date;
  lastReviewedAt: Date;
}

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Przelicza stan SRS karty po ocenie odpowiedzi.
 * @param state aktualny stan karty
 * @param grade ocena 0–5 (0 = całkowite niepowodzenie, 5 = perfekcyjnie)
 * @param now punkt odniesienia (do testów); domyślnie teraz
 */
export function reviewCard(state: SrsState, grade: ReviewGrade, now: Date = new Date()): SrsUpdate {
  // Korekta współczynnika łatwości wg wzoru SM-2 (im niższa ocena, tym mocniej spada).
  let easeFactor = state.easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

  let repetitions: number;
  let intervalDays: number;
  let lapses = state.lapses;

  if (grade < 3) {
    // Niepowodzenie — wraca jutro, licznik powtórek zerowany.
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    repetitions = state.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(state.intervalDays * easeFactor);
    if (intervalDays < 1) intervalDays = 1;
  }

  const dueAt = new Date(now.getTime() + intervalDays * DAY_MS);

  return { easeFactor, intervalDays, repetitions, lapses, dueAt, lastReviewedAt: now };
}

// Opcje oceny prezentowane użytkownikowi (klawisze 1–4). Mapują przyciski na
// oceny SM-2: „Jeszcze raz" zeruje, pozostałe to powtórki o rosnącej jakości.
export const REVIEW_OPTIONS: Array<{ key: string; label: string; grade: ReviewGrade; color: string }> = [
  { key: "1", label: "Jeszcze raz", grade: 0, color: "var(--accent-red)" },
  { key: "2", label: "Trudne", grade: 3, color: "var(--accent-amber)" },
  { key: "3", label: "Dobre", grade: 4, color: "var(--accent-blue)" },
  { key: "4", label: "Łatwe", grade: 5, color: "var(--accent-green)" },
];
