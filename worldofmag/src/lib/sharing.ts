import { canAccess, requireAccess as requireAccessPlatform, resolveRole } from "@/platform/sharing/access";
import { getAccessContext } from "@/platform/sharing/cache";
import type { ResourceRef } from "@/platform/sharing/types";
import { loadResourceCatalog } from "@/lib/sharingResources";

/**
 * 052 — WERSJA APLIKACYJNA sprawdzania dostępu.
 *
 * Platforma dostarcza mechanizm i wymaga katalogu **parametrem**; ten plik jest jedynym miejscem,
 * które ten katalog podaje. Moduły wołają stąd — nigdy wprost z platformy, bo wtedy każdy wołający
 * musiałby pamiętać o katalogu i kontekście, a zapomniany argument byłby cichym przyzwoleniem.
 *
 * To ten sam układ co `src/lib/pathPermissions.ts`: platforma daje regułę, korzeń podaje wiedzę.
 */

export async function requireAccess(userId: string, ref: ResourceRef, operation: string): Promise<void> {
  const [katalog, ctx] = await Promise.all([loadResourceCatalog(), getAccessContext(userId)]);
  await requireAccessPlatform(userId, ref, operation, katalog, ctx);
}

export async function hasAccess(userId: string, ref: ResourceRef, operation: string): Promise<boolean> {
  const [katalog, ctx] = await Promise.all([loadResourceCatalog(), getAccessContext(userId)]);
  return canAccess(userId, ref, operation, katalog, ctx);
}

/** Najwyższa rola użytkownika na zasobie — dla przyszłego UI udostępniania i diagnostyki. */
export async function roleOn(userId: string, ref: ResourceRef) {
  const [katalog, ctx] = await Promise.all([loadResourceCatalog(), getAccessContext(userId)]);
  return resolveRole(userId, ref, katalog, ctx);
}
