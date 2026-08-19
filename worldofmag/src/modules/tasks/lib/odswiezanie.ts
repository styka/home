import { revalidatePath } from "next/cache";

/**
 * 080 (Z3): odświeżenie widoków listy zadań po mutacji.
 *
 * Poza `/tasks` trzeba odświeżyć też trasę zapisanego zestawu. Podajemy ją w formie TRASY
 * (`[zestawId]`, tryb "page"), a nie konkretnego adresu: jedna mutacja może dotyczyć zadania,
 * które należy do kilku zestawów naraz, a akcja nie ma powodu ich wyliczać.
 *
 * Mieszka w `lib/`, a nie przy akcjach, bo pomocnik zamknięty w pliku `"use server"` jest
 * niesprawdzalny — pilnuje tego bramka `check:domain`.
 */
export function odswiezZadania(): void {
  revalidatePath("/tasks");
  revalidatePath("/tasks/zestaw/[zestawId]", "page");
}
