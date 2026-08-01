// 037: typy i helpery propozycji „co robić" z modułu Pogoda.
//
// Plik celowo NIE jest częścią `actions/weather.ts`: z pliku `"use server"` wolno eksportować
// wyłącznie funkcje async, a tutaj mieszkają stałe i czysta funkcja `fingerprintOf`. Trzymanie ich
// razem z akcjami wywaliłoby `next build` („Only async functions are allowed to be exported").

/** Stan propozycji w bibliotece pomysłów. String + union (C-12) — nigdy enum Prisma. */
export type IdeaState = "considered" | "saved" | "blocked";

/** Rodzaj propozycji — steruje ikoną i filtrem, nie logiką. */
export type IdeaCategory = "outdoor" | "trip" | "home" | "other";

export const IDEA_STATES: IdeaState[] = ["considered", "saved", "blocked"];
export const IDEA_CATEGORIES: IdeaCategory[] = ["outdoor", "trip", "home", "other"];

export const IDEA_STATE_LABELS: Record<IdeaState, string> = {
  considered: "Rozważana",
  saved: "Zapisana",
  blocked: "Zablokowana",
};

export const IDEA_CATEGORY_LABELS: Record<IdeaCategory, string> = {
  outdoor: "Na zewnątrz",
  trip: "Wycieczka",
  home: "W domu",
  other: "Inne",
};

/** Propozycja pokazywana użytkownikowi — wspólny kształt dla listy „Co robić?" i biblioteki. */
export interface IdeaDTO {
  /** Id wiersza w bazie; `null`, gdy propozycja istnieje tylko na świeżo wygenerowanej liście. */
  id: string | null;
  fingerprint: string;
  title: string;
  summary: string;
  category: IdeaCategory;
  state: IdeaState | null;
  /** Czy propozycja dotyczy konkretnego miejsca w okolicy (a nie ogólnej czynności). */
  nearby: boolean;
  /** Czy użytkownik oglądał już jej szczegóły — znacznik „Już rozważana" na liście. */
  hasDetail: boolean;
  locationLabel: string;
  detailAt: string | null;
  detailRuns: number;
}

export function parseIdeaState(value: string | null | undefined): IdeaState {
  return IDEA_STATES.includes(value as IdeaState) ? (value as IdeaState) : "considered";
}

export function parseIdeaCategory(value: string | null | undefined): IdeaCategory {
  return IDEA_CATEGORIES.includes(value as IdeaCategory) ? (value as IdeaCategory) : "other";
}

/**
 * Odcisk tytułu propozycji — klucz naturalny, po którym rozpoznajemy, że model zaproponował coś,
 * co użytkownik już rozważał albo zablokował.
 *
 * 039: implementacja przeniosła się do `@/lib/textKey`, bo dokładnie tego samego odcisku potrzebują
 * teraz odrzucone gorące tematy i fakty o użytkowniku. Re-eksport zostaje, żeby dotychczasowe
 * importy z modułu Pogoda działały bez zmian.
 */
export { fingerprintOf } from "@/lib/textKey";
