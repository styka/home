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
import { getAccessContext, dopiszPrzestrzenDoKontekstu } from "../sharing/cache";
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

  // 077 (U-1): kontekst dostępu tego żądania został policzony ZANIM ta przestrzeń powstała, więc
  // nadal ma `personalWorkspaceId: null`. Bez tej linii sprawdzenie dostępu do rekordu utworzonego
  // przed chwilą liczy się ze starego stanu i kończy odmową.
  await dopiszPrzestrzenDoKontekstu(userId, utworzona.id);
  return utworzona.id;
}

/**
 * Przestrzeń zespołu — miejsce zapisu dla rekordu zespołowego.
 *
 * **Nie sprawdza uprawnień** — i od 078 mówi o tym własną nazwą. Kto może pisać do zespołu,
 * rozstrzyga guard modułu przed wywołaniem; ta funkcja tylko tłumaczy identyfikator zespołu na
 * identyfikator przestrzeni. Wpisanie tu dodatkowej kontroli dałoby dwa miejsca decydujące o tym
 * samym — i to gorsze, bo bez kontekstu operacji.
 *
 * 078 (U-5 z przeglądu 077): poprzednia nazwa brzmiała `przestrzenZespolu` i **nie ostrzegała
 * o niczym**. Ryzyko było konkretne: nowy moduł bierze `teamId` z formularza, woła funkcję
 * o zupełnie niewinnej nazwie i zapisuje rekord do przestrzeni cudzego zespołu — bez czerwonego
 * builda i bez żadnego objawu poza tym, że ktoś widzi nie swoje dane. Nazwa jest teraz jedynym
 * miejscem, w którym ta informacja dociera do autora wywołania, więc musi krzyczeć.
 */
export async function przestrzenZespoluBezKontroliDostepu(teamId: string): Promise<string> {
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
  return teamId ? przestrzenZespoluBezKontroliDostepu(teamId) : przestrzenOsobista(userId);
}

/**
 * 078 (zadanie 11, etap 4 część 2) — JEDEN PUNKT PRZEŁĄCZENIA DLA `DROP COLUMN`.
 *
 * **Po co osobna funkcja obok `przestrzenDoZapisu`.** Pomiar przed konwersją pokazał rzecz, której
 * plan etapu 4 nie przewidywał: na **14 z 40 tabel `ownerId` jest NOT NULL**
 * (`ProjectGroup`, `FavoriteView`, siedem tabel Wiadomości, trzy Pogody, `UserFact`, `AiContent`,
 * `AiSectionPref`). Na tych tabelach „przestań pisać właściciela, zacznij pisać przestrzeń" **nie
 * jest jednym krokiem** — zapis bez `ownerId` odrzuca baza. Zamiana zapisów i `DROP COLUMN`
 * musiałyby więc wejść jednym commitem na 92 plikach naraz, a każdy pośredni merge do `develop`
 * jest wdrożeniem: byłby to jeden commit, po którym albo wszystko działa, albo nic.
 *
 * Dlatego zapisy przechodzą przez **fazę podwójnego zapisu**: kod podaje `workspaceId` **wprost**
 * (bo wyzwalacz 0236/0238 wyprowadza go z kolumny właściciela i umrze razem z nią) i nadal podaje
 * kolumny własnościowe (bo baza ich jeszcze wymaga). Każdy taki commit jest samodzielnie
 * wdrażalny. Migracja usuwająca kolumny zmienia potem **to jedno ciało funkcji** na
 * `{ workspaceId }` — i wszystkie miejsca zapisu przestają pisać własność w jednym ruchu, bez
 * dotykania ich ponownie.
 *
 * **Dlaczego wynik jest rozpakowywany przez `...`, a nie przypisywany do pola.** Miejsce zapisu
 * wygląda tak: `data: { ...(await wlasnoscDoZapisu(userId, teamId)), nazwa }`. Gdy funkcja przestanie
 * zwracać `ownerId`, te miejsca kompilują się dalej bez zmiany — a gdyby przypisywały pola po
 * kolei, trzeba by wrócić do wszystkich 250.
 *
 * **Kontrola, że faza podwójnego zapisu jest spójna:** `workspaceId` policzony tutaj musi być
 * dokładnie tym, co wyliczyłby wyzwalacz z podanych kolumn własnościowych. Sprawdza to test
 * `wlasnoscDoZapisu.integration.test.ts` — porównaniem z rzeczywistym wynikiem wyzwalacza, a nie
 * powtórzeniem tej samej arytmetyki w asercji.
 */
export type WlasnoscZapisu = {
  workspaceId: string;
  /** Znika w `DROP COLUMN`. Do tego czasu baza wymaga go na 14 tabelach. */
  ownerId: string | null;
  /** Znika w `DROP COLUMN`. */
  ownerTeamId: string | null;
};

export async function wlasnoscDoZapisu(
  userId: string,
  teamId?: string | null
): Promise<WlasnoscZapisu> {
  return {
    workspaceId: await przestrzenDoZapisu(userId, teamId),
    ownerId: teamId ? null : userId,
    ownerTeamId: teamId ?? null,
  };
}

/**
 * 078 — wariant dla tabel BEZ współwłasności zespołowej (`ownerTeamId` tam nie istnieje).
 *
 * Trzynaście z czternastu tabel o `ownerId NOT NULL` należy właśnie tu, więc `ownerId` jest w tym
 * wariancie typu `string`, nie `string | null`. Rozdzielenie na dwie funkcje zamiast jednej
 * z opcjonalnym argumentem jest celowe: gdyby `wlasnoscDoZapisu(userId)` (bez zespołu) obsługiwała
 * także te tabele, jej typ zwracany musiałby dopuszczać `ownerId: null` — czyli wartość, którą
 * baza tam odrzuca, a kompilator by ją przepuścił.
 */
export type WlasnoscOsobistaZapisu = {
  workspaceId: string;
  /** Znika w `DROP COLUMN`. */
  ownerId: string;
};

export async function wlasnoscOsobistaDoZapisu(userId: string): Promise<WlasnoscOsobistaZapisu> {
  return { workspaceId: await przestrzenOsobista(userId), ownerId: userId };
}
