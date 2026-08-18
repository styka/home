import { prisma } from "@/platform/db/prisma";
import { resourceRoleAtLeast, RESOURCE_ROLE_ORDER, type ResourceRole } from "@/platform/workspaces/types";
import {
  ACCESS_DENIED,
  type AccessContext,
  type ResourceCatalog,
  type ResourceDeclaration,
  type ResourceFacts,
  type ResourceRef,
} from "./types";

/**
 * Faza 2 przebudowy, zadanie 10 — SPRAWDZANIE DOSTĘPU JAKO ZDOLNOŚĆ PLATFORMY (rozdz. 8.9).
 *
 * Jedna odpowiedź na pytanie „czy ta osoba może wykonać tę operację na tym zasobie" — zamiast
 * osobnego guardu w każdym module, z osobnym słownikiem ról.
 *
 * **Katalog jest parametrem WYMAGANYM** (C-36). Nie ma wartości domyślnej i nie będzie:
 * zapomniany argument zamieniłby się w ciche przyzwolenie, a to jest kod decydujący o dostępie
 * do cudzych danych. Wersję z katalogiem podaje korzeń kompozycji (`src/lib/sharing.ts`).
 *
 * **Kolejność rozstrzygania jest od najtańszego** (rozdz. 8.9 pkt 4): najczęstszy przypadek —
 * właściciel — kończy się bez ani jednego dodatkowego zapytania.
 */

/** Ochrona przed zapętloną deklaracją (`A → B → A`). Realne łańcuchy mają 2–3 poziomy. */
const MAX_GLEBOKOSC = 8;

function najwyzsza(a: ResourceRole | null, b: ResourceRole | null): ResourceRole | null {
  if (!a) return b;
  if (!b) return a;
  return RESOURCE_ROLE_ORDER.indexOf(a) >= RESOURCE_ROLE_ORDER.indexOf(b) ? a : b;
}

/**
 * Łańcuch zasób → rodzic → … zebrany **przed** zapytaniem o nadania. Dzięki temu nadania dla
 * całego łańcucha czyta się JEDNYM zapytaniem (rozdz. 8.9 pkt 1), a nie po jednym na poziom.
 */
async function zbierzLancuch(
  ref: ResourceRef,
  katalog: ResourceCatalog,
): Promise<{ ref: ResourceRef; facts: ResourceFacts }[]> {
  const lancuch: { ref: ResourceRef; facts: ResourceFacts }[] = [];
  let biezacy: ResourceRef | undefined = ref;

  while (biezacy !== undefined) {
    const krok: ResourceRef = biezacy;
    if (lancuch.length >= MAX_GLEBOKOSC) {
      // Błąd KONFIGURACJI, nie dostępu — deklaracja modułu opisuje cykl. Rozróżnienie jest
      // istotne: cichy `false` wyglądałby jak zwykła odmowa i szukałoby się go po stronie danych.
      throw new Error(
        `Deklaracja zasobów zapętla się na „${krok.type}" (limit ${MAX_GLEBOKOSC} poziomów).`,
      );
    }
    const deklaracja = katalog[krok.type];
    if (!deklaracja) return lancuch; // nieznany typ = brak podstawy do przyznania czegokolwiek
    const facts: ResourceFacts | null = await deklaracja.resolve(krok.id);
    if (!facts) return lancuch; // zasób nie istnieje
    lancuch.push({ ref: krok, facts });
    biezacy = facts.parent;
  }
  return lancuch;
}

/**
 * Rola wynikająca z WŁASNOŚCI — bez zapytań, na faktach już wczytanych.
 *
 * **056 (etap 3A): decyduje PRZESTRZEŃ, gdy zasób ją ma.** To jest ten jeden krok, który miało
 * zmienić zadanie 11 — zapowiedziany w komentarzu do `ResourceFacts` jeszcze w 052.
 *
 * Własność zespołowa liczy się **tylko wtedy, gdy moduł zadeklarował `teamOwnership`** (053) —
 * i dotyczy to obu gałęzi. Przyznanie dostępu na podstawie samej obecności przestrzeni byłoby
 * dokładnie tym poszerzeniem uprawnień bez decyzji, którego zabroniło 052/AC-5; przejście
 * z `ownerTeamId` na `workspaceId` nie jest powodem, żeby tę zasadę porzucić.
 */
function rolaZWlasnosci(
  facts: ResourceFacts,
  userId: string,
  ctx: AccessContext,
  deklaracja: ResourceDeclaration | undefined,
): ResourceRole | null {
  const zespolowa = deklaracja?.teamOwnership;

  // 064: zasób otwarty daje swoją rolę KAŻDEMU zalogowanemu — także komuś bez żadnej relacji.
  // Liczymy to jako podłogę, nie jako wynik: właściciel otwartego zasobu ma nadal `manager`.
  const otwarty = facts.publicRole ?? null;

  // 075: WŁAŚCICIEL OSOBISTY ZAWSZE DOSTAJE `manager`, zanim cokolwiek policzymy z przestrzeni.
  //
  // 079 (etap 4) ZMIENIŁO ZAKRES TEJ REGUŁY, nie jej treść. Do 078 `ownerId` podawały wszystkie
  // deklaracje i warunek był SIATKĄ: gdy przestrzeni zasobu nie było w kontekście użytkownika
  // (brak wiersza `WorkspaceMember` — pułapka z 056), właściciel i tak zostawał właścicielem.
  // Etap 4 usunął kolumnę `ownerId` z 40 tabel, więc siatki nie ma tu z czego zbudować —
  // przeniosła się do `getAccessContext`, gdzie przestrzeń osobistą czyta się po
  // `Workspace.personalUserId`, a nie po członkostwie. Dowodzi tego tabela prawdy
  // `wlasnoscBezLustra` (sonda: bez tamtej poprawki sześć komórek czerwienieje).
  //
  // Zostaje jedyny przypadek, w którym własność osobista NIE jest przestrzenią: zasób o własności
  // WYPROWADZONEJ, który kolumny przestrzeni nie ma i mieć nie będzie — zadanie bez projektu,
  // gdzie właścicielem jest twórca.
  if (facts.ownerId && facts.ownerId === userId) return "manager";

  if (facts.workspaceId) {
    // Mój zasób — odpowiednik dawnego `ownerId === userId`, tylko wyrażony przestrzenią.
    if (facts.workspaceId === ctx.personalWorkspaceId) return "manager";
    if (!zespolowa) return otwarty;
    const rola = ctx.workspaceRoles[facts.workspaceId];
    // `guest` NIE dostaje nic. Dziś nic takiej roli nie produkuje (lustro zespołu zna wyłącznie
    // owner/admin/member), więc przypisanie jej czegokolwiek byłoby poszerzeniem dostępu na zapas.
    if (rola === "owner" || rola === "admin") return najwyzsza(zespolowa.admin, otwarty);
    if (rola === "member") return najwyzsza(zespolowa.member, otwarty);
    return otwarty;
  }

  // 079: GAŁĄŹ „zasób bez przestrzeni, własność zespołowa z `ownerTeamId`" ZNIKŁA.
  //
  // Nie jako uproszczenie — jako usunięcie kodu, do którego nie da się dojść. Fakt `ownerTeamId`
  // podawała dokładnie jedna deklaracja (`tasks.task`) i zawsze jako `null`; po etapie 4 nie ma
  // go już z czego wziąć, bo kolumna nie istnieje. Pięć tabel, które `ownerTeamId` zachowuje
  // (słowniki + `Job` — `workspace-nullable.json`), nie jest zasobami w rozumieniu udostępniania:
  // rządzi nimi `ownedOrSystemWhere`/`assertDictionaryAccess`. Gdy któraś z nich kiedyś stanie
  // się zasobem, gałąź wróci **razem z własną tabelą prawdy**, zamiast czekać tu nieużywana
  // i nieprzetestowana.
  return otwarty;
}

/**
 * Najwyższa rola, jaką użytkownik ma na zasobie — z uwzględnieniem dziedziczenia po rodzicu.
 * `null` = brak jakiegokolwiek dostępu.
 */
export async function resolveRole(
  userId: string,
  ref: ResourceRef,
  katalog: ResourceCatalog,
  ctx: AccessContext,
): Promise<ResourceRole | null> {
  const lancuch = await zbierzLancuch(ref, katalog);
  if (lancuch.length === 0) return null;

  // 1. Właściciel — najczęstszy przypadek, zero dodatkowych zapytań.
  let rola: ResourceRole | null = null;
  for (const ogniwo of lancuch) {
    rola = najwyzsza(rola, rolaZWlasnosci(ogniwo.facts, userId, ctx, katalog[ogniwo.ref.type]));
  }
  if (rola === "manager") return rola;

  // 2. Dostępy nazwane wprost przez moduł (przypisanie, członkostwo) — po jednym zapytaniu
  //    na ogniwo, ale tylko dla modułów, które takie pole zadeklarowały.
  for (const ogniwo of lancuch) {
    const extra = katalog[ogniwo.ref.type]?.extraGrants;
    if (!extra) continue;
    for (const g of await extra(ogniwo.ref.id)) {
      if (g.userId === userId) rola = najwyzsza(rola, g.role);
    }
  }
  if (rola === "manager") return rola;

  // 3. Nadania — JEDNO zapytanie dla całego łańcucha (rozdz. 8.9 pkt 1).
  const podmioty = [
    { subjectType: "user", subjectId: userId },
    ...ctx.workspaceIds.map((id) => ({ subjectType: "workspace", subjectId: id })),
  ];
  const teraz = new Date();
  const nadania = await prisma.resourceGrant.findMany({
    where: {
      // Dwie niezależne alternatywy (zasób z łańcucha ORAZ podmiot) muszą iść przez AND —
      // dwa pola `OR` na jednym poziomie nadpisałyby się i zapytanie po cichu poszerzyłoby wynik.
      AND: [
        { OR: lancuch.map((o) => ({ resourceType: o.ref.type, resourceId: o.ref.id })) },
        { OR: podmioty },
        // Nadanie z terminem, który minął, nie daje nic. Brak terminu = bezterminowe.
        { OR: [{ expiresAt: null }, { expiresAt: { gt: teraz } }] },
      ],
    },
    select: { role: true },
  });
  for (const n of nadania) {
    rola = najwyzsza(rola, n.role as ResourceRole);
  }

  return rola;
}

/** Czy użytkownik może wykonać operację. Nieznana operacja = **odmowa**, nigdy przyzwolenie. */
export async function canAccess(
  userId: string,
  ref: ResourceRef,
  operation: string,
  katalog: ResourceCatalog,
  ctx: AccessContext,
): Promise<boolean> {
  const wymagana = katalog[ref.type]?.operations[operation];
  if (!wymagana) return false;
  const rola = await resolveRole(userId, ref, katalog, ctx);
  return rola !== null && resourceRoleAtLeast(rola, wymagana);
}

/** Jak `canAccess`, ale rzuca — z **tym samym komunikatem**, co dotychczasowe guardy modułów. */
export async function requireAccess(
  userId: string,
  ref: ResourceRef,
  operation: string,
  katalog: ResourceCatalog,
  ctx: AccessContext,
): Promise<void> {
  if (!(await canAccess(userId, ref, operation, katalog, ctx))) throw new Error(ACCESS_DENIED);
}

/**
 * 090 (zadanie 14) — KTO MOŻE UDOSTĘPNIAĆ.
 *
 * Reguła jest **platformowa, nie modułowa**, i wynika wprost z rozdz. 8.1: *udostępnianie jest
 * zdolnością platformy, nie funkcją modułu*. Gdyby prawo do dzielenia się zasobem wyrażała operacja
 * deklarowana przez moduł (`"project.share"`), to każdy moduł musiałby o niej pamiętać, a moduł,
 * który zapomni, dostałby jedno z dwóch: albo nikt nie może udostępniać jego zasobów, albo — gdyby
 * brak operacji traktować jako „wolno" — **każdy**. Obie odpowiedzi są złe i obie są ciche.
 *
 * Wymagamy roli `manager`: to ta sama rola, która pozwala skasować zasób. Nie da się sensownie
 * bronić stanu, w którym ktoś może oddać komuś zasób, ale nie może go usunąć.
 */
export async function requireShareAccess(
  userId: string,
  ref: ResourceRef,
  katalog: ResourceCatalog,
  ctx: AccessContext,
): Promise<void> {
  const rola = await resolveRole(userId, ref, katalog, ctx);
  if (rola === null || !resourceRoleAtLeast(rola, "manager")) throw new Error(ACCESS_DENIED);
}
