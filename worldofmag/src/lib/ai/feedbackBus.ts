// Lekka magistrala zdarzeń do uruchomienia admińskiego „trybu wskazywania"
// (FeedbackInspector) z dowolnego miejsca — bez przebudowy drzewa na Context.
// FeedbackInspector jest montowany raz w AppShell (tylko dla admina) i nasłuchuje
// na `omnia:feedback-start`. Trigger wołają: przycisk w panelu admina oraz
// admiński przycisk w górnym pasku (mobile).

export const FEEDBACK_START_EVENT = "omnia:feedback-start";

export function startFeedbackInspector(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEEDBACK_START_EVENT));
}
