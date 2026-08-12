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
 * Własność zespołowa liczy się **tylko wtedy, gdy moduł zadeklarował `teamOwnership`** (053).
 * Domyślne milczenie jest celowe: przyznanie dostępu na podstawie samej obecności kolumny
 * `ownerTeamId` byłoby poszerzeniem uprawnień bez decyzji (052/AC-5).
 */
function rolaZWlasnosci(
  facts: ResourceFacts,
  userId: string,
  ctx: AccessContext,
  deklaracja: ResourceDeclaration | undefined,
): ResourceRole | null {
  if (facts.ownerId && facts.ownerId === userId) return "manager";
  const zespolowa = deklaracja?.teamOwnership;
  if (zespolowa && facts.ownerTeamId) {
    if (ctx.adminTeamIds.includes(facts.ownerTeamId)) return zespolowa.admin;
    if (ctx.teamIds.includes(facts.ownerTeamId)) return zespolowa.member;
  }
  return null;
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
