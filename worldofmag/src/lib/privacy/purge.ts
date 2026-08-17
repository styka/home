import { prisma } from "@/platform/db/prisma";
import { pickTeamSuccessor } from "@/lib/teams/ownership";
import { mirrorTeamWorkspace } from "@/platform/workspaces/sync";

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
async function resolveOwnedTeams(tx: PurgeTx, userId: string): Promise<string[]> {
  const teams = await tx.team.findMany({
    where: { ownerId: userId },
    include: { members: { select: { userId: true, role: true, joinedAt: true } } },
  });
  // 051 (Faza 2, zadanie 9): zespoły, w których własność PRZESZŁA na następcę. Ich przestrzenie
  // trzeba uzgodnić PO transakcji — usunięty właściciel znika z przestrzeni kaskadą, ale rola
  // `owner` nie przeskoczy na następcę sama. Zespoły usunięte nie wchodzą: ich przestrzeń
  // kaskaduje razem z nimi.
  const przekazane: string[] = [];
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
      przekazane.push(team.id);
    }
  }
  return przekazane;
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
  /**
   * 079 (zadanie 11, etap 4) — RODO KLUCZOWANE PO PRZESTRZENI, NIE PO `ownerId`.
   *
   * Przestrzeń czytamy **przed** transakcją i **nie tworzymy jej**, gdy jej nie ma. Użycie tu
   * `przestrzenOsobista()` (który brakującą przestrzeń domyka) byłoby absurdem: zakładalibyśmy
   * przestrzeń kontu, które właśnie kasujemy. Brak przestrzeni znaczy „nie ma czego kasować tą
   * drogą" — i tak też jest obsłużony.
   *
   * **Uwaga o kolejności**: `Workspace.personalUserId` ma klucz obcy `ON DELETE CASCADE`, więc
   * przestrzeń znika razem z `user.delete()` na końcu transakcji. Odczyt musi być wcześniej.
   */
  const przestrzen = await prisma.workspace.findUnique({
    where: { personalUserId: userId },
    select: { id: true },
  });
  const moje = przestrzen ? { workspaceId: przestrzen.id } : null;

  let przekazaneZespoly: string[] = [];
  await prisma.$transaction(async (tx) => {
    // Z-194 (T-04): najpierw rozwiąż własność zespołów (Team.ownerId = RESTRICT).
    przekazaneZespoly = await resolveOwnedTeams(tx, userId);

    // RESTRICT: zaproszenia wysłane i otrzymane.
    await tx.teamInvitation.deleteMany({
      where: { OR: [{ invitedById: userId }, { invitedUserId: userId }] },
    });

    // SET NULL — treści osobiste. Zadania (komentarze/udostępnienia → zadania →
    // projekty) w kolejności od zależnych, by nie zostawić sierot.
    await tx.taskComment.deleteMany({ where: { userId } });
    await tx.taskShare.deleteMany({ where: { userId } });
    // 059: nadania są lustrem udostępnień, więc znikają razem z nimi. Kasujemy je HURTEM po
    // podmiocie, a nie przez `unmirrorTaskShare` per wiersz — usuwanie konta idzie w jednej
    // transakcji i nie może wołać kodu, który sięga po `prisma` obok niej.
    // `ResourceGrant` nie ma klucza obcego do `User` (nadanie ma przeżyć usunięcie AUTORA),
    // więc bez tego wiersza nadania usuniętego konta zostałyby w bazie jako cichy dostęp.
    await tx.resourceGrant.deleteMany({ where: { subjectType: "user", subjectId: userId } });
    // Zadania: własne ORAZ leżące w moich projektach. Gałąź po projekcie dokładamy TYLKO wtedy,
    // gdy przestrzeń istnieje — `{ project: { workspaceId: undefined } }` nie zawęziłoby niczego
    // i skasowałoby zadania z całej bazy.
    await tx.task.deleteMany({
      where: { OR: [{ createdById: userId }, ...(moje ? [{ project: moje }] : [])] },
    });
    if (moje) {
      await tx.taskProject.deleteMany({ where: moje });

      await tx.mealPlanEntry.deleteMany({ where: moje });
      await tx.recipe.deleteMany({ where: moje });
      await tx.cookbook.deleteMany({ where: moje });
      await tx.shoppingList.deleteMany({ where: moje });
      await tx.note.deleteMany({ where: moje });
      await tx.habit.deleteMany({ where: moje });
      await tx.healthEvent.deleteMany({ where: moje });
      await tx.medicationSchedule.deleteMany({ where: moje });
      await tx.languageDeck.deleteMany({ where: moje });
    }
    await tx.report.deleteMany({ where: { authorId: userId } });

    // Z-131 (T-17): zadania w tle (Job) mają ownerId bez FK — kasujemy jawnie (payload
    // może zawierać dane usera, np. obraz do OCR). RODO.
    //
    // 079: `Job` zostaje przy `ownerId` — jest jedną z pięciu tabel z listy
    // `workspace-nullable.json`, bo zadanie systemowe nie ma właściciela, a więc i przestrzeni.
    await tx.job.deleteMany({ where: { ownerId: userId } });

    // Z-370: modele z kolumną właściciela ALE BEZ FK do User (Contact, ServiceFavorite)
    // nie kasują się kaskadowo — bez tego zostawałyby OSIEROCONE (ownerId/userId wskazujące
    // usuniętego usera). Kontakty to dane osób trzecich → musimy je skasować dla RODO.
    if (moje) await tx.contact.deleteMany({ where: moje });
    await tx.serviceFavorite.deleteMany({ where: { userId } });

    // Reszta (CASCADE) zniknie wraz z użytkownikiem.
    await tx.user.delete({ where: { id: userId } });
  });

  // 051 (Faza 2, zadanie 9): uzgodnienie przestrzeni PO transakcji — `syncTeamWorkspace` pracuje
  // na globalnym kliencie, więc w środku widziałoby stan sprzed commitu. Wariant cichy: usunięcie
  // konta na żądanie RODO nie może się wywalić przez lustro, którego nikt jeszcze nie czyta.
  for (const teamId of przekazaneZespoly) {
    await mirrorTeamWorkspace(teamId);
  }
}
