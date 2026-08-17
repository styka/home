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
 * 078/079 (zadanie 11, etap 4) — JEDEN PUNKT PRZEŁĄCZENIA DLA `DROP COLUMN`. **PRZEŁĄCZONY.**
 *
 * 079: migracja 0244 usunęła kolumny własnościowe, a te funkcje zwracają odtąd samo
 * `{ workspaceId }`. Zmiana dotknęła TRZECH ciał funkcji; ~250 miejsc zapisu nie ruszono ani razu,
 * bo rozpakowują wynik przez `...`. Opis fazy podwójnego zapisu zostaje niżej jako uzasadnienie
 * kształtu tych funkcji — bez niego pierwsza osoba, która je zobaczy, uzna je za zbędne owijki.
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
};

export async function wlasnoscDoZapisu(
  userId: string,
  teamId?: string | null
): Promise<WlasnoscZapisu> {
  // 079: faza podwójnego zapisu SKOŃCZONA. Migracja 0244 usunęła kolumny własnościowe z 40 tabel,
  // więc to jedno ciało funkcji przestało je zwracać — i wszystkie ~250 miejsc zapisu przestało je
  // pisać, bez dotykania żadnego z nich. Po to ta funkcja powstała w 078.
  return { workspaceId: await przestrzenDoZapisu(userId, teamId) };
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
};

export async function wlasnoscOsobistaDoZapisu(userId: string): Promise<WlasnoscOsobistaZapisu> {
  return { workspaceId: await przestrzenOsobista(userId) };
}

/**
 * 078 (zadanie 11, etap 4 część 2) — FILTR „MOJE REKORDY" DLA TABEL BEZ WSPÓŁWŁASNOŚCI ZESPOŁOWEJ.
 *
 * Odpowiednik `wlasnoscOsobistaDoZapisu` po stronie ODCZYTU: zastępuje
 * `where: { ownerId: userId }` na tabelach, które kolumny `ownerTeamId` nie mają wcale
 * (Pogoda, Wiadomości, `FavoriteView`, `ProjectGroup`, `UserFact`, `AiContent`, `AiSectionPref`).
 *
 * **079: używamy go także na tabelach, które współwłasność zespołową ZNAJĄ** — wszędzie tam, gdzie
 * dawny warunek brzmiał dokładnie `ownerId = ja` (np. lista własnych projektów zadań, sklepy).
 * To nie jest rozluźnienie reguły z 078, tylko rozróżnienie dwóch rzeczy, które ta reguła
 * mieszała: przedmiotem ograniczenia jest **kształt warunku**, a nie kształt tabeli. `ownerId = ja`
 * ⟺ „moja przestrzeń osobista" jest ścisłe zawsze; zakazane pozostaje podmienianie tego warunku na
 * szerszy `ownedOrAsync`, bo TO poszerza zakres.
 *
 * **Dlaczego wąsko, po przestrzeni OSOBISTEJ, a nie przez `ownedOrAsync`.** `ownedOrAsync` zwraca
 * `workspaceId IN (wszystkie moje przestrzenie)` — czyli osobistą **i zespołowe**. Na tabeli, która
 * współwłasności zespołowej nie zna, byłoby to POSZERZENIE zakresu: filtr zacząłby dopuszczać
 * wiersz w przestrzeni zespołu, którego stara reguła (`ownerId = ja`) nigdy nie dopuszczała.
 * Dziś takich wierszy nie ma, więc oba warianty dałyby ten sam wynik — i właśnie dlatego pomyłka
 * przeszłaby niezauważona, a zaczęła szkodzić dopiero wtedy, gdy któraś z tych tabel dostanie
 * kolumnę zespołową. Równoważność `ownerId = ja` ⟺ „moja przestrzeń osobista" jest ścisła
 * i tylko ona jest tu prawdą.
 *
 * Zwraca gotowy fragment `where`, żeby miejsce użycia wyglądało jak dotąd
 * (`where: { ...(await filtrMoichRekordow(userId)), enabled: true }`).
 */
export async function filtrMoichRekordow(userId: string): Promise<{ workspaceId: string }> {
  return { workspaceId: await przestrzenOsobista(userId) };
}

/**
 * 079 — ten sam warunek co wyżej, ale zastosowany do POBRANEGO JUŻ rekordu.
 *
 * Odpowiednik dawnego `rekord.ownerId === userId`, który w kilkudziesięciu miejscach stoi po
 * `findUnique` jako druga połowa warunku `if (!rekord || rekord.ownerId !== userId) throw …`.
 * Osobna funkcja, żeby te miejsca nie rozwijały się w trzy linijki z ręcznym rozpakowaniem
 * `(await filtrMoichRekordow(userId)).workspaceId` — a przy okazji żeby po `DROP COLUMN` istniało
 * JEDNO miejsce, w którym „to jest moje" znaczy „leży w mojej przestrzeni osobistej".
 *
 * **Świadomie wąskie, jak `filtrMoichRekordow`**: nie uznaje przestrzeni zespołowych. Stosuj tam,
 * gdzie dawny warunek brzmiał dokładnie `ownerId === ja`; gdzie brzmiał „mój lub mojego zespołu",
 * właściwym odpowiednikiem jest `assertOwnership`.
 */
export async function czyMojRekord(
  rekord: { workspaceId: string } | null | undefined,
  userId: string
): Promise<boolean> {
  if (!rekord) return false;
  return rekord.workspaceId === (await przestrzenOsobista(userId));
}
