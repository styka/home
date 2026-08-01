// 039: wiedza o użytkowniku — typy i stałe.
//
// Osobno od `actions/userFacts.ts`, bo z pliku `"use server"` wolno eksportować wyłącznie funkcje
// async, a tutaj mieszkają unie i słowniki etykiet (`next build` inaczej pada).

/** Kategorie faktów. String + union (C-12) — nigdy enum Prisma. */
export type UserFactCategory = "interests" | "activity" | "lifestyle" | "constraints" | "content";
/** Jak bardzo jesteśmy pewni faktu — trafia do promptu jako SŁOWO, nie liczba. */
export type UserFactConfidence = "guess" | "likely" | "confirmed";
/** Skąd fakt pochodzi. `admin` nigdy nie jest nadpisywany automatycznym wnioskowaniem. */
export type UserFactOrigin = "inferred" | "confirmed" | "admin";
/** Odrzucony nie znika z bazy — inaczej wnioskowanie proponowałoby go w kółko. */
export type UserFactStatus = "active" | "rejected";

export const USER_FACT_CATEGORIES: UserFactCategory[] = [
  "interests",
  "activity",
  "lifestyle",
  "constraints",
  "content",
];

export const USER_FACT_CATEGORY_LABELS: Record<UserFactCategory, string> = {
  interests: "Zainteresowania",
  activity: "Aktywność",
  lifestyle: "Tryb życia",
  constraints: "Ograniczenia",
  content: "Treści",
};

export const USER_FACT_CONFIDENCE_LABELS: Record<UserFactConfidence, string> = {
  guess: "przypuszczenie",
  likely: "prawdopodobne",
  confirmed: "potwierdzone",
};

export const USER_FACT_ORIGIN_LABELS: Record<UserFactOrigin, string> = {
  inferred: "wywnioskowane z zachowań",
  confirmed: "potwierdzone przez Ciebie",
  admin: "ustawione przez administratora",
};

export interface UserFactDTO {
  id: string;
  category: UserFactCategory;
  text: string;
  confidence: UserFactConfidence;
  origin: UserFactOrigin;
  status: UserFactStatus;
  evidence: string | null;
  createdAt: string;
}

export function parseUserFactCategory(value: unknown): UserFactCategory {
  return USER_FACT_CATEGORIES.includes(value as UserFactCategory)
    ? (value as UserFactCategory)
    : "interests";
}

export function parseUserFactConfidence(value: unknown): UserFactConfidence {
  const all: UserFactConfidence[] = ["guess", "likely", "confirmed"];
  return all.includes(value as UserFactConfidence) ? (value as UserFactConfidence) : "guess";
}
