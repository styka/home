import { requireAccess as requireAccessPlatform } from "@/platform/sharing/access";
import { getAccessContext } from "@/platform/sharing/cache";
import { idZasobowNadanychMi } from "@/platform/sharing/nadaneMi";
import type { ResourceRef } from "@/platform/sharing/types";
import resources from "../sharing";

/**
 * 095 — wejście modułu Notatki do wspólnego sprawdzania dostępu.
 *
 * Ten sam wzorzec, co w Zadaniach (052), Zwierzętach (060), Zakupach i Kuchni (064): moduł woła
 * platformę z **własnym** katalogiem (import względny — C-02/C-36), nigdy przez korzeń kompozycji.
 */
export async function requireModuleAccess(
  userId: string,
  ref: ResourceRef,
  operation: string,
): Promise<void> {
  const ctx = await getAccessContext(userId);
  await requireAccessPlatform(userId, ref, operation, resources, ctx);
}

/** Identyfikatory notatek udostępnionych mi spoza moich przestrzeni. */
export async function idNotatekNadanychMi(userId: string): Promise<string[]> {
  const ctx = await getAccessContext(userId);
  return idZasobowNadanychMi(userId, "notes.note", ctx);
}
