import { requireAccess as requireAccessPlatform } from "@/platform/sharing/access";
import { getAccessContext } from "@/platform/sharing/cache";
import type { ResourceRef } from "@/platform/sharing/types";
import resources from "../sharing";

/**
 * 113 — wejście modułu Rośliny do wspólnego sprawdzania dostępu.
 *
 * Ten sam wzorzec, co w Zadaniach (052) i Zwierzętach (060): moduł woła platformę z **własnym**
 * katalogiem (import względny — C-02/C-36), a nie przez korzeń kompozycji `@/lib/sharing`.
 * Sięgnięcie po korzeń odwróciłoby zależność (moduł → korzeń → wszystkie moduły) i wciągnęłoby
 * deklaracje całej aplikacji do grafu Roślin — błąd, który w 049 spowolnił kompilację każdej trasy
 * dwukrotnie.
 *
 * Własny katalog wystarcza, mimo że roślina MA rodzica: rodzicem jest przestrzeń roślinna, czyli
 * zasób tego samego modułu. Gdyby kiedyś rodzic znalazł się w innym module, będzie to znak, że
 * wołający należy do warstwy kompozycji — a nie że trzeba tu dokleić import korzenia.
 */
export async function requireRoslinyAccess(
  userId: string,
  ref: ResourceRef,
  operation: string,
): Promise<void> {
  const ctx = await getAccessContext(userId);
  await requireAccessPlatform(userId, ref, operation, resources, ctx);
}
