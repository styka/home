import { prisma } from "@/lib/prisma";

/**
 * Z-051 (RODO art. 17) — twarde usunięcie wszystkich danych użytkownika.
 *
 * Wydzielone z `actions/privacy.ts` jako czysta funkcja (bez auth/redirect), żeby
 * dało się ją zweryfikować na lokalnej bazie.
 *
 * Strategia (oparta na realnych regułach FK → patrz audyt Z-051/Z-033):
 * - większość rekordów ma FK `ON DELETE CASCADE` do User → znika wraz z `user.delete()`;
 * - PO Z-033 także relacje WŁASNOŚCI (Note, Recipe, ShoppingList, Habit, HealthEvent,
 *   MedicationSchedule, LanguageDeck, Cookbook, MealPlanEntry, TaskProject) są `Cascade`
 *   — poniższe jawne `deleteMany` dla nich to już tylko zabezpieczenie (defense-in-depth);
 * - relacje AKTORA wciąż `SET NULL` (Task.createdBy, Report.authorId) — rekord zostałby
 *   z ownerem=null, więc rekordy OSOBISTE usera kasujemy JAWNIE (dane zespołów zostają);
 * - modele z kolumną właściciela ALE BEZ FK (Contact, ServiceFavorite — Z-370) NIE
 *   kaskadują — muszą być skasowane jawnie, inaczej zostają osierocone;
 * - rekordy z `ON DELETE RESTRICT` (TeamInvitation) usuwamy przed `user.delete()`;
 * - `Team.ownerId` (RESTRICT) jest blokadą — własność zespołu wymaga decyzji
 *   użytkownika i jest sprawdzana wcześniej w `deleteMyAccount` (nie tutaj).
 *
 * `AuditLog` nie ma FK do User (zrzut e-maila) — historia audytu celowo zostaje.
 */
export async function purgeUserData(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // RESTRICT: zaproszenia wysłane i otrzymane.
    await tx.teamInvitation.deleteMany({
      where: { OR: [{ invitedById: userId }, { invitedUserId: userId }] },
    });

    // SET NULL — treści osobiste. Zadania (komentarze/udostępnienia → zadania →
    // projekty) w kolejności od zależnych, by nie zostawić sierot.
    await tx.taskComment.deleteMany({ where: { userId } });
    await tx.taskShare.deleteMany({ where: { userId } });
    await tx.task.deleteMany({
      where: { OR: [{ createdById: userId }, { project: { ownerId: userId } }] },
    });
    await tx.taskProject.deleteMany({ where: { ownerId: userId } });

    await tx.mealPlanEntry.deleteMany({ where: { ownerId: userId } });
    await tx.recipe.deleteMany({ where: { ownerId: userId } });
    await tx.cookbook.deleteMany({ where: { ownerId: userId } });
    await tx.shoppingList.deleteMany({ where: { ownerId: userId } });
    await tx.note.deleteMany({ where: { ownerId: userId } });
    await tx.habit.deleteMany({ where: { ownerId: userId } });
    await tx.healthEvent.deleteMany({ where: { ownerId: userId } });
    await tx.medicationSchedule.deleteMany({ where: { ownerId: userId } });
    await tx.languageDeck.deleteMany({ where: { ownerId: userId } });
    await tx.report.deleteMany({ where: { authorId: userId } });

    // Z-370: modele z kolumną właściciela ALE BEZ FK do User (Contact, ServiceFavorite)
    // nie kasują się kaskadowo — bez tego zostawałyby OSIEROCONE (ownerId/userId wskazujące
    // usuniętego usera). Kontakty to dane osób trzecich → musimy je skasować dla RODO.
    await tx.contact.deleteMany({ where: { ownerId: userId } });
    await tx.serviceFavorite.deleteMany({ where: { userId } });

    // Reszta (CASCADE) zniknie wraz z użytkownikiem.
    await tx.user.delete({ where: { id: userId } });
  });
}
