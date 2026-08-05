/**
 * Kontrakt modułu **Nawyki** (tracker z heatmapą, seriami i celami tygodniowymi).
 *
 * To jedyny plik tego modułu, który wolno zaimportować z zewnątrz — reguła ESLint
 * `no-restricted-imports` blokuje sięganie do `@/modules/habits/*` poza `contract`.
 *
 * Konsument zewnętrzny jest jeden: egzekutor akcji asystenta (`lib/ai/executors/habitsExecutor.ts`).
 * Kontrakt wystawia więc **sześć operacji, których on realnie używa**. `getHabits` i `reorderHabits`
 * celowo tu nie ma — służą wyłącznie własnemu widokowi modułu, a kontrakt to nie drugi spis
 * eksportów, tylko lista tego, na czym ktoś z zewnątrz naprawdę polega.
 */

export {
  toggleHabitDay,
  createHabit,
  updateHabit,
  setHabitArchived,
  deleteHabit,
  createTaskFromHabit,
} from "./actions/habits";
