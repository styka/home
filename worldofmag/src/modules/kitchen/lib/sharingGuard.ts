import { requireAccess as requireAccessPlatform } from "@/platform/sharing/access";
import { getAccessContext } from "@/platform/sharing/cache";
import type { ResourceRef } from "@/platform/sharing/types";
import resources from "../sharing";

/**
 * 064 — wejście modułu do wspólnego sprawdzania dostępu.
 *
 * Ten sam wzorzec, co w Zadaniach (052) i Zwierzętach (060): moduł woła platformę z **własnym**
 * katalogiem (import względny — C-02/C-36), nie przez korzeń kompozycji. Sięgnięcie po korzeń
 * odwróciłoby zależność i wciągnęło deklaracje całej aplikacji do grafu tego modułu.
 */
export async function requireModuleAccess(
  userId: string,
  ref: ResourceRef,
  operation: string,
): Promise<void> {
  const ctx = await getAccessContext(userId);
  await requireAccessPlatform(userId, ref, operation, resources, ctx);
}
