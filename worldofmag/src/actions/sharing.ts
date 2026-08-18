"use server";

import { auth } from "@/platform/auth/session";
import {
  zbierzUdostepnioneMnie,
  zbierzUdostepnionePrzezeMnie,
  type SharedGrantRow,
} from "@/lib/sharingLists";

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
