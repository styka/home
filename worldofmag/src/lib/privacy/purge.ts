import { prisma } from "@/lib/prisma";
import { pickTeamSuccessor } from "@/lib/teams/ownership";

type PurgeTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Z-051/Z-194 (T-04) — rozwiązanie zespołów, których usuwany user jest WŁAŚCICIELEM.
 * `Team.ownerId` ma FK RESTRICT, więc przed `user.delete()` musimy albo przekazać
 * własność, albo usunąć zespół:
 * - są inni członkowie → własność na następcę (najstarszy ADMIN, fallback najstarszy
 *   członek — `pickTeamSuccessor`); zasoby zespołu (ownerTeamId) zostają z zespołem;
 * - zespół „solo" (właściciel jest jedynym członkiem) → `team.delete()` kaskadowo usuwa
 *   wszystkie zasoby team-owned (ownerTeam = Cascade) i członkostwa.
 * Subzespoły (`parentTeamId` = SetNull) i zespoły, w których user jest tylko członkiem,
 * nie wymagają akcji — odpowiednio osierocają się na top-level / kaskadują z TeamMember.
 */
async function resolveOwnedTeams(tx: PurgeTx, userId: string): Promise<void> {
  const teams = await tx.team.findMany({
    where: { ownerId: userId },
    include: { members: { select: { userId: true, role: true, joinedAt: true } } },
  });
  for (const team of teams) {
    const successor = pickTeamSuccessor(team.members, userId);
    if (successor === null) {
      // Solo — usuń zespół; ownerTeam=Cascade sprząta zasoby i członkostwa.
      await tx.team.delete({ where: { id: team.id } });
    } else {
      // Przekaż własność: następca = OWNER, Team.ownerId → następca. Membership
      // odchodzącego usera i tak kaskaduje przy user.delete().
      await tx.teamMember.update({
        where: { teamId_userId: { teamId: team.id, userId: successor } },
        data: { role: "OWNER" },
      });
      await tx.team.update({ where: { id: team.id }, data: { ownerId: successor } });
    }
  }
}

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
 * - `Team.ownerId` (RESTRICT) — własność zespołów rozwiązuje `resolveOwnedTeams`
 *   (Z-194/T-04): auto-transfer na następcę albo usunięcie zespołu solo.
 *
 * `AuditLog` nie ma FK do User (zrzut e-maila) — historia audytu celowo zostaje.
 */
export async function purgeUserData(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Z-194 (T-04): najpierw rozwiąż własność zespołów (Team.ownerId = RESTRICT).
    await resolveOwnedTeams(tx, userId);

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
