/**
 * Kontrakt modułu **Nauka języków** (talie fiszek, powtórki SuperMemo-2).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/languages/*` poza `contract`.
 *
 * Trzej konsumenci z zewnątrz, każdy o innej potrzebie:
 * - **pulpit** (`app/page.tsx`) — `getDecks`, żeby pokazać kafelek talii,
 * - **narzędzia odczytu asystenta** (`lib/ai/agentTools.ts`) — `getDueCards`, `getStudyStreak`,
 * - **egzekutor akcji asystenta** — operacje na taliach i słówkach.
 *
 * `submitReview` i cała mechanika SRS (`lib/srs.ts`) zostają **prywatne**: powtórka to sesja nauki
 * prowadzona przez własny widok modułu, a nie operacja, którą ktoś z zewnątrz miałby wywoływać.
 */

export {
  // odczyt
  getDecks,
  getDueCards,
  getStudyStreak,
  // redakcja talii i słówek
  createDeck,
  updateDeck,
  deleteDeck,
  addWord,
  updateWord,
  deleteWord,
  bulkAddWords,
} from "./actions/languageDecks";
