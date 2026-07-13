// Z-240 (T-16) — ranking trafności wyszukiwania notatek (app-level, po indeksowanym
// filtrze trigramowym z bazy). Czysta funkcja — testowalna, bez zależności od DB/Prisma.
//
// Indeks pg_trgm przyspiesza SAM filtr (ILIKE), ale nie porządkuje wyników po trafności.
// Tu liczymy prosty, deterministyczny wynik: tytuł waży więcej niż treść, dopasowanie
// całego słowa / prefiksu / na początku pola > dopasowanie w środku; liczy się też liczba
// trafień. Dzięki temu „najlepsze" notatki lądują na górze wyników wyszukiwania.

export interface RankableNote {
  title?: string | null;
  content?: string | null;
}

/** Liczba wystąpień `needle` w `hay` (obie już lowercase). */
function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

/** Wynik dopasowania pojedynczego pola do zapytania (0 = brak). */
function fieldScore(field: string, q: string): number {
  if (!field || !q) return 0;
  const f = field.toLowerCase();
  const idx = f.indexOf(q);
  if (idx === -1) return 0;
  let score = 1; // jest dopasowanie w środku
  // Dopasowanie na granicy słowa / na początku pola / całe pole → premie.
  if (idx === 0) score += 3; // pole zaczyna się od zapytania
  else if (/\s/.test(f[idx - 1] ?? "")) score += 2; // początek słowa
  if (f === q) score += 4; // całe pole == zapytanie
  score += Math.min(countOccurrences(f, q) - 1, 3); // dodatkowe trafienia (limit)
  return score;
}

/**
 * Wynik trafności notatki dla zapytania. Tytuł waży ~3× mocniej niż treść.
 * Zwraca 0, gdy nic nie pasuje (notatka i tak przeszła filtr — np. dopasowanie
 * w polu, którego tu nie liczymy — więc nie odrzucamy, tylko dajemy niski wynik).
 */
export function noteSearchScore(note: RankableNote, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const title = (note.title ?? "").toString();
  const content = (note.content ?? "").toString();
  return fieldScore(title, q) * 3 + fieldScore(content, q);
}

/**
 * Sortuje notatki malejąco po trafności (stabilnie — zachowuje wejściową kolejność
 * dla remisów, więc wcześniejsze [pinned, updatedAt] zostaje jako tie-breaker).
 */
export function rankNotesBySearch<T extends RankableNote>(notes: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return notes;
  return notes
    .map((note, i) => ({ note, i, score: noteSearchScore(note, q) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.note);
}
