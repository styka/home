// Tolerancyjne parsowanie JSON z odpowiedzi LLM. Modele bywają „gadatliwe"
// (dodają tekst wokół JSON lub blok ```json). Wyciągamy pierwszy obiekt/tablicę.

export function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // znajdź pierwszy sensowny fragment { ... } lub [ ... ]
    const start = cleaned.search(/[[{]/);
    if (start === -1) return null;
    const open = cleaned[start];
    const close = open === "{" ? "}" : "]";
    const end = cleaned.lastIndexOf(close);
    if (end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}
