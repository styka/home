/**
 * 076 (zadanie 11, etap 4 część 2) — DOKĄD ZAPISAĆ NOWY REKORD.
 *
 * Etap 4 usuwa `ownerId`/`ownerTeamId`, więc `data: { ownerId: user.id }` przestaje istnieć jako
 * sposób powiedzenia „to jest moje". Zastępuje je `data: { workspaceId: … }` — i to jest jedyna
 * zmiana, którą trzeba wykonać w ~250 miejscach zapisu.
 *
 * **Dlaczego to nie może zostać na wyzwalaczu.** Wyzwalacz z 0236/0238 wyprowadza przestrzeń
 * Z KOLUMNY WŁAŚCICIELA. Gdy kolumna zniknie, nie ma z czego wyprowadzać: wyzwalacz nadal będzie
 * ratował zapisy, które przestrzeń podały wprost, ale nie zgadnie autora zapisu, bo baza go nie zna.
 * Od etapu 4 przestrzeń podaje **kod**, a wyzwalacz zostaje wyłącznie jako siatka dla zapisów
 * surowym SQL-em na tabelach, które właściciela jeszcze mają.
 *
 * **Dlaczego osobny plik, a nie `getAccessContext(...).personalWorkspaceId` w każdym module.**
 * Trzy powody, wszystkie praktyczne:
 *  1. `personalWorkspaceId` jest `string | null`, a `workspaceId` po zaostrzeniu jest wymagane —
 *     250 miejsc zapisu musiałoby powtórzyć ten sam `?? throw`. Tu robimy to raz, z komunikatem,
 *     który mówi, co poszło źle, zamiast „Argument workspaceId is missing";
 *  2. `null` nie jest tu stanem do obsłużenia, tylko **usterką lustra** — konto bez przestrzeni
 *     osobistej nie powinno istnieć. Domykamy ją w miejscu wykrycia (jak wyzwalacz w 0236),
 *     zamiast przepuszczać dalej;
 *  3. zapis zespołowy potrzebuje przestrzeni ZESPOŁU, której kontekst dostępu nie indeksuje po
 *     `teamId` — bez wspólnego helpera każdy moduł pisałby własne wyszukanie.
 */

import { prisma } from "../db/prisma";
import { getAccessContext } from "../sharing/cache";
import { ensurePersonalWorkspace, syncTeamWorkspace } from "./sync";

/**
 * Przestrzeń osobista użytkownika — miejsce zapisu dla „mojego" rekordu.
 *
 * Czyta z kontekstu dostępu, liczonego **raz na żądanie** (cache z 052), więc wywołanie w pętli
 * nie mnoży zapytań. Gdy przestrzeni nie ma, tworzy ją zamiast rzucać: to ta sama decyzja, co
 * w wyzwalaczu 0236 — brak przestrzeni jest rozjazdem lustra, a nie sytuacją, w której użytkownik
 * ma zobaczyć błąd.
 */
export async function przestrzenOsobista(userId: string): Promise<string> {
  const ctx = await getAccessContext(userId);
  if (ctx.personalWorkspaceId) return ctx.personalWorkspaceId;

  await ensurePersonalWorkspace(userId);
  const utworzona = await prisma.workspace.findUnique({
    where: { personalUserId: userId },
    select: { id: true },
  });
  if (!utworzona) {
    // Nie da się zapisać rekordu „niczyjego" na tabeli, która wymaga przestrzeni. Lepszy jasny
    // wyjątek tutaj niż „Argument `workspaceId` is missing" trzy warstwy niżej.
    throw new Error(`Nie udało się ustalić przestrzeni osobistej użytkownika ${userId}`);
  }
  return utworzona.id;
}

/**
 * Przestrzeń zespołu — miejsce zapisu dla rekordu zespołowego.
 *
 * **Nie sprawdza uprawnień.** Kto może pisać do zespołu, rozstrzyga guard modułu przed wywołaniem;
 * ta funkcja tylko tłumaczy identyfikator zespołu na identyfikator przestrzeni. Wpisanie tu
 * dodatkowej kontroli dałoby dwa miejsca decydujące o tym samym — i to gorsze, bo bez kontekstu
 * operacji.
 */
export async function przestrzenZespolu(teamId: string): Promise<string> {
  const istnieje = await prisma.workspace.findUnique({
    where: { teamId },
    select: { id: true },
  });
  if (istnieje) return istnieje.id;

  await syncTeamWorkspace(teamId);
  const utworzona = await prisma.workspace.findUnique({ where: { teamId }, select: { id: true } });
  if (!utworzona) throw new Error(`Nie udało się ustalić przestrzeni zespołu ${teamId}`);
  return utworzona.id;
}

/**
 * Skrót dla akcji, które przyjmują opcjonalny `ownerTeamId` i zapisują „do zespołu albo do siebie".
 * Zastępuje wzorzec `ownerId: teamId ? undefined : user.id, ownerTeamId: teamId ?? undefined`,
 * który powtarzał się w kilkudziesięciu miejscach — i który był jedynym powodem, dla którego
 * wzajemne wykluczanie się tych dwóch kolumn trzeba było pamiętać przy każdym zapisie.
 */
export async function przestrzenDoZapisu(userId: string, teamId?: string | null): Promise<string> {
  return teamId ? przestrzenZespolu(teamId) : przestrzenOsobista(userId);
}
