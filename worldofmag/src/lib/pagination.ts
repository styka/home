/**
 * Z-070: paginacja keyset (cursor) — stały koszt zapytania niezależnie od głębi,
 * w przeciwieństwie do OFFSET. Cursor = `id` ostatniego elementu strony; sortuj
 * deterministycznie (np. `[{ createdAt: "desc" }, { id: "desc" }]`), żeby `id`
 * jednoznacznie pozycjonował kursor.
 *
 * Użycie:
 *   const rows = await prisma.x.findMany({
 *     where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
 *     ...keysetQuery({ cursor, limit }),
 *   });
 *   return keysetResult(rows, limit);
 */
export interface KeysetParams {
  cursor?: string | null;
  limit?: number;
}

export interface KeysetPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

/**
 * Argumenty Prisma `findMany` dla keyset: pobiera limit+1 (by wykryć „jest więcej").
 * Jawny, pojedynczy typ zwrotny (cursor/skip opcjonalne) — bez tego spread tworzy
 * unię, której typy Prisma nie przyjmują.
 */
export function keysetQuery({ cursor, limit }: KeysetParams): {
  take: number;
  cursor?: { id: string };
  skip?: number;
} {
  const take = clampLimit(limit) + 1;
  return cursor ? { take, cursor: { id: cursor }, skip: 1 } : { take };
}

/** Tnie nadmiarowy element i wylicza następny cursor. */
export function keysetResult<T extends { id: string }>(rows: T[], limit?: number): KeysetPage<T> {
  const take = clampLimit(limit);
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return {
    items,
    hasMore,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
  };
}
