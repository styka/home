/**
 * Faza 2 przebudowy, zadanie 9 — SŁOWNIKI PRZESTRZENI I NADAŃ (rozdz. 8.2 i 8.4).
 *
 * Wszystko tu jest `String` + unia TS, nigdy enum Prismy (C-12).
 *
 * **Co to jest, a czego tu NIE MA.** To jest sam słownik — nazwy i ich kolejność. Egzekwowanie
 * (`requireAccess`, dziedziczenie nadań, cache per żądanie) to zadanie 10 i celowo nie ma go
 * w tym przebiegu: reguła bez konsumenta zastyga w kształcie, którego pierwszy prawdziwy konsument
 * i tak by nie przyjął.
 */

/** Rodzaj przestrzeni. Osobista powstaje z kontem, zespołowa — z zespołem. */
export type WorkspaceKind = "personal" | "team";

/** Rola w przestrzeni (rozdz. 8.3). Właściciel ma pełne prawa do wszystkiego, co w niej żyje. */
export type WorkspaceMemberRole = "owner" | "admin" | "member" | "guest";

/**
 * Rola NA ZASOBIE — cztery, uporządkowane rosnąco (rozdz. 8.4). Zastępują trzy dzisiejsze,
 * częściowo pokrywające się słowniki (`MEMBER|ADMIN|OWNER`, `VIEWER|EDITOR`, `String?`).
 *
 * **Moduł nie definiuje własnych ról** — mapuje swoje operacje na te cztery.
 */
export type ResourceRole = "viewer" | "commenter" | "editor" | "manager";

/** Komu przyznano dostęp: konkretnej osobie, całej przestrzeni albo każdemu z linkiem. */
export type GrantSubjectType = "user" | "workspace" | "link";

/**
 * Kolejność rang ról zasobu — rosnąco. Trzymana jako **tablica, nie mapa liczb**, bo porządek jest
 * tu treścią: wstawienie nowej roli w środek ma być jedną zmianą w jednym miejscu.
 */
export const RESOURCE_ROLE_ORDER: readonly ResourceRole[] = ["viewer", "commenter", "editor", "manager"];

/** Czy `rola` wystarcza tam, gdzie wymagana jest `wymagana`. Czyste porównanie rang. */
export function resourceRoleAtLeast(rola: ResourceRole, wymagana: ResourceRole): boolean {
  return RESOURCE_ROLE_ORDER.indexOf(rola) >= RESOURCE_ROLE_ORDER.indexOf(wymagana);
}

/**
 * Mapowanie ról zespołu na role przestrzeni (rozdz. 8.10, krok 1 — „role prawie identyczne").
 *
 * **Ta sama reguła żyje w SQL-u migracji 0226** (`CASE tm."role" …`). Dwa zapisy jednej reguły to
 * dług — ale alternatywą byłoby wykonanie kodu TS przez `migrate deploy`, czego prod nie robi.
 * Rozjazd łapie test lustra: uzgodnienie po backfillu musi zwrócić zero zmian.
 */
export function workspaceRoleFromTeamRole(rolaZespolu: string): WorkspaceMemberRole {
  if (rolaZespolu === "OWNER") return "owner";
  if (rolaZespolu === "ADMIN") return "admin";
  return "member";
}

/**
 * 059 (zadanie 12, etap 1) — ODWZOROWANIE DAWNYCH SŁOWNIKÓW NA ROLE ZASOBU.
 *
 * Rozdz. 8.10 podaje je w tabeli migracji: `MEMBER→editor`, `ADMIN/OWNER→manager`,
 * `VIEWER→viewer`, `EDITOR→editor`. Odwzorowanie mieszka **w jednym miejscu**, bo używają go
 * dwie rzeczy o różnym cyklu życia: **migracja SQL** (rekordy istniejące) i **kod** (rekordy nowe).
 * Rozjazd między nimi nie objawiłby się błędem — dałby po prostu inne role rekordom starym
 * i nowym, co wychodzi dopiero przy skardze użytkownika.
 *
 * Wartość spoza słownika daje `null`, a nie „bezpieczny domyślny": cicha degradacja do `viewer`
 * przyznałaby dostęp na podstawie danych, których nie rozumiemy.
 */
export function resourceRoleFromLegacy(rola: string | null | undefined): ResourceRole | null {
  switch (rola) {
    case "OWNER":
    case "ADMIN":
      return "manager";
    case "MEMBER":
    case "EDITOR":
      return "editor";
    case "VIEWER":
      return "viewer";
    default:
      return null;
  }
}
