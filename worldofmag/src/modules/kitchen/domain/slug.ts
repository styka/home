/**
 * 069 (zadanie 19, rozdz. 10.1) — ADRES PRZEPISU.
 *
 * Wyprowadzone z `actions/recipes.ts` (funkcja `slugify`). Reguła tożsamościowa: jej wynik trafia
 * do adresu URL przepisu, więc zmiana zachowania zmieniłaby adresy istniejących wpisów.
 *
 * **Uwaga — Omnia ma DWIE różne reguły sluga** (druga w `modules/qa/domain/slug.ts`) i dają one
 * różne wyniki dla tego samego tytułu. Nie ujednolicamy ich w 069: przepisanie któregokolwiek
 * zmieniłoby istniejące adresy. Szczegóły rozbieżności — w teście modułu QA.
 */

/**
 * Tytuł przepisu → slug: bez znaków diakrytycznych, tylko `a-z0-9-`, maks. 80 znaków.
 *
 * Wartość awaryjna `"przepis"` jest częścią reguły, nie zabezpieczeniem: tytuł złożony wyłącznie
 * ze znaków spoza alfabetu łacińskiego (emoji, cyrylica, same znaki interpunkcyjne) dałby pusty
 * slug, a przepis bez adresu nie istnieje.
 */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "przepis"
  );
}
