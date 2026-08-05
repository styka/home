// N2: wikilinki [[Tytuł]] łączące notatki + lekkie ważenie wyszukiwania.
// Czysta logika (bez React/Prisma) — reużywalna w UI i testach.

export type NoteLike = { id: string; title: string; content: string };

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Wyłuskuje cele [[Tytuł]] z treści (bez duplikatów, z zachowaniem kolejności). */
export function extractWikilinks(content: string): string[] {
  if (!content) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    const title = m[1].trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

/** Znajduje notatkę po tytule (case-insensitive). Zwraca pierwszą pasującą. */
export function resolveByTitle<T extends NoteLike>(title: string, notes: T[]): T | null {
  const key = title.trim().toLowerCase();
  return notes.find((n) => n.title.trim().toLowerCase() === key) ?? null;
}

/** Notatki, na które wskazuje bieżąca (rozwiązane do istniejących + nierozwiązane tytuły). */
export function outgoingLinks<T extends NoteLike>(
  note: NoteLike,
  allNotes: T[]
): { resolved: T[]; unresolved: string[] } {
  const titles = extractWikilinks(note.content);
  const resolved: T[] = [];
  const unresolved: string[] = [];
  for (const t of titles) {
    const hit = resolveByTitle(t, allNotes);
    if (hit && hit.id !== note.id) resolved.push(hit);
    else if (!hit) unresolved.push(t);
  }
  return { resolved, unresolved };
}

/** Notatki, które linkują do bieżącej (po jej tytule). */
export function backlinks<T extends NoteLike>(note: NoteLike, allNotes: T[]): T[] {
  const myKey = note.title.trim().toLowerCase();
  if (!myKey) return [];
  return allNotes.filter((n) => {
    if (n.id === note.id) return false;
    return extractWikilinks(n.content).some((t) => t.toLowerCase() === myKey);
  });
}
