import * as React from "react";
import { AsyncLocalStorage } from "async_hooks";
import { getUserTeamIds } from "@/platform/auth/serverUtils";
import { prisma } from "@/platform/db/prisma";
import type { WorkspaceMemberRole } from "@/platform/workspaces/types";
import type { AccessContext } from "./types";

/**
 * Faza 2 przebudowy, zadanie 10 — CACHE PER ŻĄDANIE (rozdz. 8.9 pkt 2).
 *
 * `requireAccess` siedzi na ścieżce **każdego** żądania, a jedna akcja potrafi sprawdzić ten sam
 * zasób kilka razy (guard w akcji, potem guard w funkcji, którą ona woła). Bez memoizacji każde
 * sprawdzenie to komplet zapytań od nowa.
 *
 * **Dlaczego `React.cache`, a nie własna mapa.** Jego zakres to dokładnie jedno żądanie — czyli
 * dokładnie to, czego wymaga dokument. Własny cache trzeba by unieważniać, a unieważnianie
 * zdarzeniem (rozdz. 8.9 pkt 3) wymaga warstwy zdarzeń z Fazy 4. Cache, który znika razem
 * z żądaniem, **nie ma czego unieważniać** — problem nie powstaje, zamiast być rozwiązywany
 * mechanizmem, którego jeszcze nie ma.
 *
 * **077 — to uzasadnienie przestało być pełne i dlatego jest tu poprawione, a nie tylko rozszerzone.**
 * Przestało w chwili, gdy `platform/workspaces/zapis.ts` zaczął TWORZYĆ brakującą przestrzeń
 * osobistą w trakcie żądania (076). Od tego momentu w jednym żądaniu istnieje stan sprzed i po
 * zmianie, czyli dokładnie „coś do unieważnienia". Objaw był podstępny: zapis się udawał, ale
 * sprawdzenie dostępu tuż po nim liczyło się ze starego kontekstu — użytkownik dostawał odmowę do
 * zasobu, który sam przed chwilą utworzył.
 *
 * `React.cache` nie ma API unieważniania i nie potrzebuje go: memoizuje obietnicę, więc **wszyscy
 * w tym żądaniu dostają TEN SAM obiekt**. Zamiast wyrzucać wpis, korygujemy go w miejscu
 * (`dopiszPrzestrzenDoKontekstu`). To nie jest obejście — cache JEST tu stanem żądania, a my
 * doprowadzamy go do zgodności z bazą, którą właśnie zmieniliśmy.
 *
 * **Poza kontekstem żądania** (zadanie w tle, skrypt, test) `React.cache` NIE degraduje się sam —
 * w środowisku bez runtime'u React nie jest nawet funkcją i wywołanie kończy się
 * `cache is not a function`. Sprawdziliśmy to testem i dlatego degradacja jest tu **napisana
 * wprost**: gdy `cache` nie istnieje, `perRequest` zwraca funkcję niezmienioną. Bez tego
 * `requireAccess` wywalałby każde zadanie w tle i każdy skrypt — czyli zdanie „cache działa" byłoby
 * prawdziwe wyłącznie tam, gdzie i tak nic by się nie stało.
 */

/**
 * 084 (zadanie 28) — ZAKRES OPERACJI POZA ŻĄDANIEM.
 *
 * Degradacja opisana wyżej („bez runtime'u React funkcja bez zmian") jest bezpieczna, ale ma cenę,
 * której nikt nie mierzył: zadanie w tle sprawdzające dostęp pięćdziesiąt razy wykonywało
 * **dwieście** zapytań o te same członkostwa. Pomiar N+1 pokazał to samo w mniejszej skali —
 * kalendarz składany z siedmiu wkładów odpytywał `TeamMember` sześć razy pod rząd.
 *
 * `AsyncLocalStorage` daje ten sam zakres co żądanie, tylko wyznaczany jawnie: kod owinięty
 * w `wZakresieOperacji` liczy kontekst raz. Poza żądaniem **i** poza tym owinięciem zachowanie
 * pozostaje dawne — brak memoizacji, zero ryzyka, że wynik przeżyje dłużej, niż powinien.
 *
 * Kolejność jest istotna: `React.cache` ma pierwszeństwo, bo w żądaniu to ON jest nośnikiem stanu
 * i to jego obietnicę koryguje `dopiszPrzestrzenDoKontekstu`.
 */
const zakresOperacji = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

/**
 * Wyznacza zakres memoizacji dla kodu spoza żądania (worker, zadanie w tle, skrypt, pomiar).
 * Zagnieżdżenie jest bezpieczne — wewnętrzne wywołanie po prostu korzysta z zewnętrznej mapy.
 */
export function wZakresieOperacji<T>(f: () => Promise<T>): Promise<T> {
  const istniejacy = zakresOperacji.getStore();
  return istniejacy ? f() : zakresOperacji.run(new Map(), f);
}

/**
 * Memoizacja na czas żądania, jeśli środowisko ją ma; w przeciwnym razie na czas OPERACJI, jeśli
 * ktoś ją wyznaczył; a poza jednym i drugim — funkcja bez zmian.
 * Zawężone do jednego argumentu, bo tyle wystarcza i tyle da się bezpiecznie otypować.
 */
function perRequest<A, R>(fn: (a: A) => Promise<R>): (a: A) => Promise<R> {
  const maybeCache = (React as { cache?: <T>(f: T) => T }).cache;
  const wZadaniu = typeof maybeCache === "function" ? maybeCache(fn) : null;
  const nazwa = fn.name || "anon";
  return (a: A) => {
    if (wZadaniu) return wZadaniu(a);
    const mapa = zakresOperacji.getStore();
    if (!mapa) return fn(a);
    const klucz = `${nazwa}:${String(a)}`;
    const gotowe = mapa.get(klucz) as Promise<R> | undefined;
    if (gotowe) return gotowe;
    const obietnica = fn(a);
    mapa.set(klucz, obietnica);
    return obietnica;
  };
}

/**
 * Kontekst użytkownika liczony **raz na żądanie**: zespoły i przestrzenie. Bez tego każde
 * sprawdzenie dostępu odpytywałoby o członkostwa od nowa.
 */
export const getAccessContext = perRequest(async (userId: string): Promise<AccessContext> => {
  const [teamIds, workspaces, czlonkostwa, osobista] = await Promise.all([
    getUserTeamIds(userId),
    // 056: to samo zapytanie co dotąd, tylko z dwoma polami więcej. Rozstrzyganie po przestrzeni
    // potrzebuje MOJEJ ROLI w niej i wskazania, która przestrzeń jest moja osobista — jedno i
    // drugie idzie złączeniem, żeby sprawdzenie dostępu nie kosztowało dodatkowej rundy do bazy.
    prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true, role: true, workspace: { select: { personalUserId: true } } },
    }),
    // 053: role w zespołach — właściciel/admin dostaje wyższą rolę na zasobach zespołu niż zwykły
    // członek. Czytamy je RAZEM z resztą kontekstu, żeby nie dokładać zapytania na sprawdzenie.
    prisma.teamMember.findMany({
      where: { userId, role: { in: ["OWNER", "ADMIN"] } },
      select: { teamId: true },
    }),
    /**
     * 079 (zadanie 11, etap 4) — PRZESTRZEŃ OSOBISTA CZYTANA PO WŁAŚCICIELU, NIE PO CZŁONKOSTWIE.
     *
     * Do etapu 4 przestrzeń osobistą znajdowało się wśród członkostw wyżej, a gdy jej tam nie było,
     * dostęp właściciela ratowała **siatka** w `rolaZWlasnosci`: fakt `ownerId === ja` dawał
     * `manager` niezależnie od przestrzeni (075/077). Etap 4 zabiera zasobom kolumnę `ownerId`,
     * więc tamtej siatki nie ma z czego zbudować — a chroniony przez nią stan (brak wiersza
     * `WorkspaceMember`, rozjazd lustra rozpoznany w 056) nadal jest osiągalny.
     *
     * Zapytanie przenosi siatkę **do miejsca, w którym problem powstaje**: „moja przestrzeń
     * osobista" jest faktem z tabeli `Workspace` (`personalUserId`), a nie z tabeli członkostw.
     * Idzie równolegle z pozostałymi, więc sprawdzenie dostępu nie kosztuje dodatkowej rundy.
     *
     * **To nie jest poszerzenie dostępu**: przestrzeń osobista z definicji należy do jednej osoby,
     * więc uznanie jej za swoją nie daje nikomu wglądu w cudze dane. Dowodzi tego wiersz „obcy"
     * w tabeli prawdy `wlasnoscBezLustra` — musi zostać samą odmową.
     */
    prisma.workspace.findUnique({ where: { personalUserId: userId }, select: { id: true } }),
  ]);
  // Przestrzeń osobistą rozpoznajemy po `personalUserId === userId`, a NIE po `kind === "personal"`:
  // `kind` mówi, jakiego rodzaju jest przestrzeń, a `personalUserId` — CZYJA. Gdyby ktoś kiedyś był
  // członkiem cudzej przestrzeni osobistej, sprawdzanie `kind` przyznałoby mu w niej rolę właściciela.
  const personalWorkspaceId = osobista?.id ?? null;
  const ctx: AccessContext = {
    teamIds,
    adminTeamIds: czlonkostwa.map((m) => m.teamId),
    workspaceIds: workspaces.map((w) => w.workspaceId),
    personalWorkspaceId,
    workspaceRoles: Object.fromEntries(
      workspaces.map((w) => [w.workspaceId, w.role as WorkspaceMemberRole]),
    ),
  };
  // Brakujący wiersz członkostwa we WŁASNEJ przestrzeni domykamy tak samo, jak 077 domyka
  // przestrzeń utworzoną w trakcie żądania — tą samą funkcją, żeby nie powstały dwie interpretacje
  // tego samego stanu. Bez tego zakres list (`ownedOrAsync`, `accessibleProjectIds`) nadal liczyłby
  // się z członkostw i pokazywałby mniej, niż przepuszcza guard.
  if (personalWorkspaceId) wpiszPrzestrzenDoKontekstu(ctx, personalWorkspaceId);
  return ctx;
});

/**
 * 077 (U-1) — dopisuje świeżo utworzoną przestrzeń OSOBISTĄ do kontekstu bieżącego żądania.
 *
 * Wołane przez `przestrzenOsobista()` zaraz po domknięciu lustra. Bez tego reszta żądania widzi
 * `personalWorkspaceId: null` i pustą mapę ról, choć w bazie przestrzeń już jest.
 *
 * **Czego świadomie NIE robi: przypadku zespołowego.** Brak przestrzeni zespołu w chwili zapisu
 * oznacza zepsute lustro zespołu, a nie świeże konto — naprawia to `syncTeamWorkspace` po stronie
 * bazy i od następnego żądania kontekst jest poprawny. Zgadywanie roli użytkownika w takiej
 * przestrzeni (owner? admin? member?) bez ponownego odpytania i tak zniweczyłoby cache, a pomyłka
 * dałaby ROLĘ WYŻSZĄ NIŻ NALEŻNA — czyli koszt błędu jest tu asymetryczny i lepiej poczekać na
 * następne żądanie niż zgadnąć.
 *
 * Poza kontekstem żądania (zadanie w tle, skrypt) `getAccessContext` nie jest memoizowane, więc
 * mutacja dotyczy obiektu jednorazowego i po prostu nic nie zmienia — też poprawnie.
 */
export async function dopiszPrzestrzenDoKontekstu(userId: string, workspaceId: string): Promise<void> {
  wpiszPrzestrzenDoKontekstu(await getAccessContext(userId), workspaceId);
}

/**
 * Czysta część powyższego: sama korekta obiektu kontekstu.
 *
 * **Wydzielona, bo inaczej poprawki nie da się sprawdzić.** Pierwsza wersja testu wołała
 * `getAccessContext` dwa razy wokół `przestrzenOsobista()` i przechodziła — także wtedy, gdy
 * poprawkę USUNIĘTO. Powód: poza runtime'em Reacta `getAccessContext` nie jest memoizowane, więc
 * drugie wywołanie po prostu czyta bazę i widzi już utworzoną przestrzeń. Test zielenił się
 * z przyczyny niezwiązanej z tym, co miał mierzyć.
 *
 * Sama korekta obiektu jest logiką, która MOŻE być błędna (trzy pola, w tym rola — bez niej
 * przestrzeń istnieje, a dostępu nie daje; pułapka z 056) i to ją tu testujemy. Fakt, że
 * w prawdziwym żądaniu jest to TEN SAM obiekt co u pozostałych czytelników, wynika z kontraktu
 * `React.cache` i jest sprawdzalny tylko w prawdziwym żądaniu — klikaczem, nie testem jednostkowym.
 */
export function wpiszPrzestrzenDoKontekstu(ctx: AccessContext, workspaceId: string): void {
  if (ctx.personalWorkspaceId === null) ctx.personalWorkspaceId = workspaceId;
  if (!ctx.workspaceIds.includes(workspaceId)) ctx.workspaceIds.push(workspaceId);
  if (!ctx.workspaceRoles[workspaceId]) ctx.workspaceRoles[workspaceId] = "owner";
}
