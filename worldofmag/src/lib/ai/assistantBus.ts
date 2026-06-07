// Lekka magistrala zdarzeń do otwierania globalnego asystenta AI (AICommandSheet)
// z dowolnego miejsca w aplikacji — bez przebudowy drzewa komponentów na Context.
// Asystent jest montowany raz w AppShell i nasłuchuje na `omnia:assistant-open`.

export const ASSISTANT_OPEN_EVENT = "omnia:assistant-open";

export interface AssistantOpenDetail {
  // Gdy ustawione, asystent startuje w „trybie zgłoszenia": pokazuje kontekst
  // wskazanego miejsca i z opisu admina tworzy zadanie w projekcie „Omnia".
  feedbackContext?: string;
}

export function openAssistant(detail: AssistantOpenDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AssistantOpenDetail>(ASSISTANT_OPEN_EVENT, { detail }));
}
