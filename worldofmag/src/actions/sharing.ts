"use server";

import { auth } from "@/platform/auth/session";
import { revalidatePath } from "next/cache";
import {
  zbierzUdostepnioneMnie,
  zbierzUdostepnionePrzezeMnie,
  type SharedGrantRow,
} from "@/lib/sharingLists";
import {
  nadaniaZasobu,
  nadajDostep,
  odbierzDostep,
  odbierzZaproszeniaZasobow,
  type PodmiotNadania,
} from "@/lib/sharingGrants";
import type { ResourceRole } from "@/platform/workspaces/types";

/**
 * 067 (zadanie 14, część odczytowa) — „UDOSTĘPNIONE MI” I „CO UDOSTĘPNIŁEM”.
 *
 * Rozdz. 8.7 mówi o tym widoku rzecz, która jest sednem całej Fazy 2:
 * *„Widok »Udostępnione mi« jest możliwy tylko dzięki jednolitemu modelowi — przy pięciu
 * mechanizmach wymagałby pięciu zapytań i pięciu formatów.”*
 *
 * To jest **wypłata** za 051–066. Przed tą fazą pytanie „co mi udostępniono?” wymagałoby zapytania
 * do `TaskProjectMember`, `TaskShare`, `PetShare`, sprawdzenia `ownerTeamId` w kilkunastu tabelach
 * i sklejenia pięciu różnych słowników ról. Teraz to **jedno zapytanie do jednej tabeli**.
 *
 * **Nazwę zasobu bierzemy z deklaracji modułu**, nie z mapy w tym pliku. Platforma nie zna modułów
 * (C-36), a warstwa kompozycji zna wszystkie — więc etykieta („Projekt zadań”, „Zwierzę”) pochodzi
 * z `label` w `sharing.ts` danego modułu. Mapa tutaj byłaby szóstym miejscem, w którym trzeba
 * pamiętać o nowym typie zasobu.
 *
 * **084:** rdzeń (bez sesji) mieszka w `@/lib/sharingLists` — pomiar N+1 nie ma jak wywołać Server
 * Action, a mierzenie „czegoś podobnego” napisanego w teście nie mierzyłoby niczego. Tutaj zostają
 * cienkie otoczki sesyjne.
 */

export type { SharedGrantRow };

/**
 * Zasoby udostępnione **mnie** — przez nadanie dla mnie albo dla przestrzeni, której jestem
 * członkiem. Jedno zapytanie, wszystkie moduły.
 */
export async function getSharedWithMe(): Promise<SharedGrantRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return zbierzUdostepnioneMnie(session.user.id);
}

/**
 * Zasoby, które udostępniłem **ja** — nadania w moich przestrzeniach, wystawione komuś innemu.
 *
 * Filtrujemy po przestrzeni zasobu, a nie po `createdById`: nadania z migracji 0229/0230 mają tam
 * właściciela zasobu, ale nadanie wystawione kiedyś przez współpracownika też dotyczy **mojego**
 * zasobu i powinno tu być widoczne. Pytanie brzmi „co z moich rzeczy jest udostępnione”, nie
 * „co ja osobiście kliknąłem”.
 */
export async function getSharedByMe(): Promise<SharedGrantRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return zbierzUdostepnionePrzezeMnie(session.user.id);
}

// ─── 090 (zadanie 14): STRONA ZAPISU ─────────────────────────────────────────
//
// Cienkie otoczki sesyjne nad `@/lib/sharingGrants` — rdzeń jest bez sesji z tego samego powodu co
// przy listach: pomiar i testy nie mają jak wywołać Server Action, a mierzenie „czegoś podobnego"
// napisanego w teście nie mierzy niczego.

export async function getResourceGrants(resourceType: string, resourceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return nadaniaZasobu(session.user.id, resourceType, resourceId);
}

export async function grantResourceAccess(
  resourceType: string,
  resourceId: string,
  podmiot: PodmiotNadania,
  role: ResourceRole,
  expiresAtIso?: string | null,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const wynik = await nadajDostep(
    session.user.id,
    resourceType,
    resourceId,
    podmiot,
    role,
    expiresAtIso ? new Date(expiresAtIso) : null,
  );
  revalidatePath("/udostepnione");
  return wynik;
}

export async function revokeResourceAccess(grantId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await odbierzDostep(session.user.id, grantId);
  revalidatePath("/udostepnione");
}

/** Odbiera zaproszenia czekające na e-mail tej osoby. Wołane z `/invitations`. */
export async function redeemResourceInvitations(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  const n = await odbierzZaproszeniaZasobow(session.user.id, session.user.email);
  if (n > 0) revalidatePath("/udostepnione");
  return n;
}
