import { declaredPermissionForPath } from "@/lib/modules";
import { legacyPermissionForPath } from "@/platform/auth/permissions";

/**
 * 046 — mapowanie ścieżka → uprawnienie **dla całej aplikacji**.
 *
 * Dlaczego to nie może mieszkać w `platform/auth/permissions.ts`: moduł przeniesiony do
 * `src/modules/` niesie swoją ścieżkę i swoje uprawnienie w `module.ts`, a platformie **nie wolno**
 * importować modułów (asymetria z rozdz. 7.1, wymuszana regułą ESLint). Składanie jednego i drugiego
 * jest więc zadaniem korzenia kompozycji — tego pliku.
 *
 * Kolejność ma znaczenie: deklaracje modułów **wyprzedzają** mapowanie historyczne. Po przeniesieniu
 * modułu jego wpis znika z `legacyPermissionForPath`, więc kolizji dziś nie ma; pierwszeństwo jest
 * zabezpieczeniem na wypadek, gdyby ktoś zostawił stary wpis przy kolejnej fali przenosin.
 *
 * `undefined` z `declaredPermissionForPath` znaczy „żaden zadeklarowany moduł nie obejmuje tej
 * ścieżki". To NIE to samo co `null`, które znaczy „moduł jej nie chroni" (Raporty) — dlatego
 * rozróżnienie musi przetrwać aż tutaj, zamiast zostać spłaszczone do falsy.
 */
export function permissionForPath(path: string): string | null {
  const declared = declaredPermissionForPath(path);
  if (declared !== undefined) return declared;
  return legacyPermissionForPath(path);
}

/** Czy użytkownikowi brakuje uprawnienia do wskazanej ścieżki. */
export function isPathLocked(permissions: string[], path: string): boolean {
  const required = permissionForPath(path);
  if (!required) return false;
  return !permissions.includes(required);
}
