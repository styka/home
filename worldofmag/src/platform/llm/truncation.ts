// 032: rozpoznanie UCIĘCIA odpowiedzi modelu.
//
// Problem, który rozwiązuje: gdy odpowiedź nie zmieści się w budżecie tokenów, dostawca oddaje ją
// przerwaną w połowie. Dla pętli agenta wyglądało to jak „model zwrócił nieprawidłowy JSON", więc
// kazała mu odpowiedzieć jeszcze raz — i jeszcze raz — aż do wyczerpania limitu kroków. W zgłoszeniu
// Z-2 kosztowało to 6 wywołań i ~0,81 zł bez żadnego wyniku dla użytkownika.
//
// Osobny moduł bez zależności, żeby dało się to przetestować bez bazy i bez sieci.

/** OpenAI-compatible: `choices[0].finish_reason === "length"`. */
export function isTruncatedOpenAiResponse(data: unknown): boolean {
  const choices = (data as { choices?: Array<{ finish_reason?: string }> } | null)?.choices;
  return choices?.[0]?.finish_reason === "length";
}

/** Anthropic Messages API: `stop_reason === "max_tokens"`. */
export function isTruncatedAnthropicResponse(data: unknown): boolean {
  return (data as { stop_reason?: string } | null)?.stop_reason === "max_tokens";
}
