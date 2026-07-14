// Z-051 / Z-194 (T-04) — rozwiązanie własności zespołu, gdy właściciel kasuje konto.
//
// Zamiast twardej blokady „masz zespół, najpierw przekaż własność" stosujemy
// automatyczną degradację: własność przechodzi na następcę, a zespół „solo"
// (właściciel jest jedynym członkiem) jest kasowany wraz z zasobami.
//
// Reguła wyboru następcy (decyzja właściciela 2026-06-28):
//   1) najstarszy stażem pozostały ADMIN,
//   2) w razie braku ADMIN-a — najstarszy stażem pozostały członek,
//   3) brak innych członków → null (zespół do usunięcia).
// Czysta funkcja (bez Prismy) — w pełni testowalna lokalnie.

export interface TeamMemberLike {
  userId: string;
  role: string;
  joinedAt: Date | string | number;
}

const byJoinedAsc = (a: TeamMemberLike, b: TeamMemberLike) =>
  new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();

/**
 * Wybiera userId następcy własności zespołu po odejściu `leavingUserId`,
 * albo `null` gdy nie ma innych członków (zespół „solo" → do usunięcia).
 */
export function pickTeamSuccessor(members: TeamMemberLike[], leavingUserId: string): string | null {
  const others = members.filter((m) => m.userId !== leavingUserId);
  if (others.length === 0) return null;
  const admins = others.filter((m) => m.role === "ADMIN").sort(byJoinedAsc);
  if (admins.length > 0) return admins[0].userId;
  return [...others].sort(byJoinedAsc)[0].userId;
}
