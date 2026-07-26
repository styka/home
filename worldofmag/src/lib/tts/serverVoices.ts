// 031: katalog głosów SERWEROWEJ syntezy mowy (lektor asystenta).
//
// Dlaczego w ogóle serwerowo: głosy Web Speech pochodzą z systemu użytkownika — na Chrome/Windows
// polskich głosów jest kilka, ale działa zwykle jeden, a na iPhonie jest dokładnie jeden („Zosia").
// Nie da się tego naprawić po stronie przeglądarki, więc dokładamy syntezę u dostawcy
// skonfigurowanego przez administratora (typ operacji `speech` w /admin/llm — C-40).
//
// Głosy poniżej to głosy dostawców zgodnych z OpenAI (`/audio/speech`). Są NIEZALEŻNE OD JĘZYKA —
// ten sam głos czyta po polsku i po angielsku — dlatego opisujemy je barwą, a nie językiem.
// Identyfikator (`id`) jest przekazywany dostawcy jako nazwa głosu.

export interface ServerVoice {
  id: string;
  label: string;
  description: string;
}

export const SERVER_VOICES: ServerVoice[] = [
  { id: "nova", label: "Nova", description: "Kobiecy, ciepły i naturalny — dobry domyślny lektor." },
  { id: "shimmer", label: "Shimmer", description: "Kobiecy, jaśniejszy i bardziej energiczny." },
  { id: "coral", label: "Coral", description: "Kobiecy, spokojny, z wyraźną dykcją." },
  { id: "sage", label: "Sage", description: "Kobiecy, stonowany i rzeczowy." },
  { id: "alloy", label: "Alloy", description: "Neutralny, uniwersalny — bezpieczny wybór." },
  { id: "ash", label: "Ash", description: "Męski, niski i spokojny." },
  { id: "onyx", label: "Onyx", description: "Męski, głęboki, „lektorski”." },
  { id: "echo", label: "Echo", description: "Męski, wyraźny i szybki w odbiorze." },
];

/** Domyślny głos serwerowy, gdy użytkownik nie wybrał żadnego. */
export const DEFAULT_SERVER_VOICE = "nova";

/** Czy podany identyfikator jest znanym głosem serwerowym (walidacja wejścia z klienta). */
export function isServerVoiceId(id: string | null | undefined): boolean {
  return !!id && SERVER_VOICES.some((v) => v.id === id);
}

// Prefiks odróżniający głos serwerowy od głosu przeglądarki na jednej liście wyboru w UI.
export const SERVER_VOICE_PREFIX = "omnia-server:";

export function toServerVoiceValue(id: string): string {
  return `${SERVER_VOICE_PREFIX}${id}`;
}

/** Wyciąga identyfikator głosu serwerowego z wartości listy wyboru (albo null dla głosu systemowego). */
export function parseServerVoiceValue(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(SERVER_VOICE_PREFIX)) return null;
  const id = value.slice(SERVER_VOICE_PREFIX.length);
  return isServerVoiceId(id) ? id : null;
}
