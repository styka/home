/**
 * Z-176 — czysta logika liczenia posiadaczy dostępu do `/admin` (anty self-lockout).
 *
 * Wydzielona z `actions/access.ts` (która jest "use server"), żeby pokryć testem
 * najważniejszą część zabezpieczenia: symulację hipotetycznej zmiany RBAC
 * ("co jeśli ta rola przestanie dawać admina / ten user straci tę rolę").
 *
 * @param adminRoles  role nadające `module.admin` (przed wykluczeniami)
 * @param userRoles   przypisania user↔rola (dla ról z `adminRoles`)
 * @param opts.excludeRoleGrant   udawaj, że ta rola NIE nadaje już admina
 * @param opts.removeUserRole     udawaj, że ten user stracił tę rolę
 * @returns liczba RÓŻNYCH użytkowników, którzy nadal mieliby dostęp do `/admin`
 */
export function countDistinctAdminHolders(
  adminRoles: string[],
  userRoles: Array<{ userId: string; role: string }>,
  opts?: {
    excludeRoleGrant?: string;
    removeUserRole?: { userId: string; role: string };
  },
): number {
  let roles = adminRoles;
  if (opts?.excludeRoleGrant) roles = roles.filter((r) => r !== opts.excludeRoleGrant);
  if (roles.length === 0) return 0;

  const adminRoleSet = new Set(roles);
  const holders = new Set<string>();
  for (const ur of userRoles) {
    if (!adminRoleSet.has(ur.role)) continue;
    if (
      opts?.removeUserRole &&
      ur.userId === opts.removeUserRole.userId &&
      ur.role === opts.removeUserRole.role
    ) {
      continue;
    }
    holders.add(ur.userId);
  }
  return holders.size;
}
