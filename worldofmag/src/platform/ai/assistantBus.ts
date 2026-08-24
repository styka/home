// Lekka magistrala zdarzeń do otwierania globalnego asystenta AI (AICommandSheet)
// z dowolnego miejsca w aplikacji — bez przebudowy drzewa komponentów na Context.
// Asystent jest montowany raz w AppShell i nasłuchuje na `omnia:assistant-open`.

export const ASSISTANT_OPEN_EVENT = "omnia:assistant-open";

export interface AssistantOpenDetail {
  // Gdy ustawione, asystent startuje w „trybie zgłoszenia": pokazuje kontekst
  // wskazanego miejsca i z opisu admina tworzy zadanie w projekcie „Omnia".
  feedbackContext?: string;
  // 042: gdy ustawione, asystent otwiera się i OD RAZU wysyła tę wiadomość — tak jakby
  // użytkownik wpisał ją w oknie czatu. Dzięki temu dokowana kolumna na stronie głównej
  // jest tylko polem wejściowym, a cały stan rozmowy zostaje w jednym komponencie.
  prompt?: string;
  // 088: zrzut wskazanego elementu (data URL, PNG albo JPEG) zrobiony w chwili wskazania.
  // Idzie razem z kontekstem, bo po otwarciu asystenta tamtego elementu może już nie być na ekranie
  // — a zgłoszenie ma pokazywać to, co zgłaszający widział, gdy klikał.
  feedbackShot?: string;
}

export function openAssistant(detail: AssistantOpenDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AssistantOpenDetail>(ASSISTANT_OPEN_EVENT, { detail }));
}
