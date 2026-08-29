/**
 * Kontrakt modułu **Notatki** (markdown, wikilinki `[[Tytuł]]`, grupy, wyszukiwanie pełnotekstowe).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/notes/*` poza `contract`.
 *
 * Konsumenci: egzekutor akcji asystenta (notatki + grupy) i `lib/ai/agentTools.ts` (`getNoteGroups`).
 *
 * **`actions/tags.ts` świadomie NIE należy do tego modułu** i został w `src/actions`. Tagi są
 * słownikiem **współdzielonym**: obok Notatek używa ich Kuchnia (`app/kitchen/recipes`) i narzędzia
 * odczytu asystenta. Wciągnięcie ich tutaj oznaczałoby, że Kuchnia zależy od kontraktu Notatek dla
 * słownika, który nie jest własnością żadnego z nich — czyli **zabetonowałoby przypadkowe
 * sprzężenie** zamiast je rozwiązać. Docelowe miejsce tagów to warstwa słowników platformy, razem
 * z kategoriami i jednostkami; to osobne zadanie, odnotowane w dzienniku przebudowy.
 *
 * Wyszukiwanie (`lib/searchRank`) i wikilinki (`lib/wikilinks`) zostają prywatne — to mechanika
 * własnego widoku, nie usługa dla innych modułów.
 */

// 115 (Z-INT-11/12): deklaracja modułu dla konsumentów sprawdzających uprawnienie
// `module.notes` przed zapisem cudzej treści jako notatki (wzorzec `tasksModule`).
export { default as notesModule } from "./module";

export {
  // notatki
  createNote,
  updateNote,
  deleteNote,
  toggleNotePin,
  setNoteTags,
} from "./actions/notes";

export {
  // grupy notatek
  getNoteGroups,
  createNoteGroup,
  updateNoteGroup,
  deleteNoteGroup,
} from "./actions/noteGroups";
