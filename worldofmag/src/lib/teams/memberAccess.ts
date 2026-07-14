// Z-194 (T-12) — granularne role „rodzic / dziecko" w rodzinie/zespole.
//
// Rdzeń reguł: czy dany członek zespołu ma dostęp do WSPÓŁDZIELONYCH zasobów danego
// modułu. Czyste dane + funkcje (bez Prismy/UI) — w pełni testowalne lokalnie.
//
// Model: `TeamMember.moduleAccess` (kolumna TEXT) trzyma JSON `string[]` albo NULL:
//   * NULL          → brak ograniczeń = pełny dostęp (wstecznie zgodne, domyślne),
//   * "[]"          → brak dostępu do JAKIEGOKOLWIEK współdzielonego modułu,
//   * '["tasks",…]' → dostęp tylko do wymienionych modułów.
// „Rodzice" (OWNER/ADMIN) mają pełny dostęp NIEZALEŻNIE od tej kolumny.

import { SHARE_CAPABILITIES } from "@/lib/sharing/capabilities";

export type TeamRole = "MEMBER" | "ADMIN" | "OWNER";

/** Role „rodzica" — pełny, nieograniczalny dostęp do wszystkiego w zespole. */
export const PARENT_ROLES: ReadonlySet<string> = new Set<string>(["OWNER", "ADMIN"]);

/**
 * Moduły, które można per-członka ograniczyć = te, które w ogóle da się współdzielić
 * w zespole (mechanizm "team"). Źródło prawdy: mapa zdolności współdzielenia (Z-193),
 * więc lista nie zdryfuje względem realnego modelu własności.
 */
export const RESTRICTABLE_MODULES: readonly string[] = Object.values(SHARE_CAPABILITIES)
  .filter((c) => c.mechanisms.includes("team"))
  .map((c) => c.module)
  .sort();

/** Czy moduł da się ograniczyć per-członek (jest współdzielony przez zespół). */
export function isRestrictableModule(moduleId: string): boolean {
  return RESTRICTABLE_MODULES.includes(moduleId);
}

/** Polskie etykiety ograniczalnych modułów (do UI „dostęp domownika"). */
export const RESTRICTABLE_MODULE_LABELS: Record<string, string> = {
  shopping: "Zakupy",
  tasks: "Zadania",
  notes: "Notatki",
  kitchen: "Kuchnia",
  pets: "Zwierzęta",
  health: "Zdrowie",
  habits: "Nawyki",
  flota: "Flota",
  portfel: "Portfel",
  languages: "Języki",
  magazynowanie: "Magazynowanie",
  warsztaty: "Warsztaty",
  contacts: "Kontakty",
};

/** Etykieta modułu albo samo id (fallback). */
export function moduleLabel(moduleId: string): string {
  return RESTRICTABLE_MODULE_LABELS[moduleId] ?? moduleId;
}

export interface MemberAccessInput {
  /** Rola w zespole: MEMBER | ADMIN | OWNER. */
  role: string;
  /** Surowa zawartość kolumny `TeamMember.moduleAccess` (JSON string[] albo null). */
  moduleAccess?: string | null;
}

/**
 * Parsuje kolumnę `moduleAccess` do listy dozwolonych modułów.
 * - null / "" / niepoprawny JSON / nie-tablica → `null` (brak ograniczeń = pełny dostęp),
 * - poprawna tablica → odfiltrowane do znanych, ograniczalnych modułów (bez duplikatów).
 *   Pusta tablica PO filtrze (gdy wejście było niepuste) zostaje `[]` = brak dostępu.
 */
export function parseModuleAccess(raw: string | null | undefined): string[] | null {
  if (raw == null || raw === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const ids = parsed.filter(
    (x): x is string => typeof x === "string" && isRestrictableModule(x)
  );
  return Array.from(new Set(ids));
}

/**
 * Serializuje listę dozwolonych modułów do zapisu w kolumnie.
 * - `null`/`undefined` → `null` (brak ograniczeń),
 * - tablica → posortowany, odduplikowany JSON tylko ze znanych modułów (`[]` możliwe).
 */
export function serializeModuleAccess(modules: string[] | null | undefined): string | null {
  if (modules == null) return null;
  const ids = Array.from(new Set(modules.filter(isRestrictableModule))).sort();
  return JSON.stringify(ids);
}

/**
 * RDZEŃ Z-194: czy członek zespołu ma dostęp do współdzielonych zasobów `moduleId`.
 * - „Rodzice" (OWNER/ADMIN) → zawsze `true`,
 * - moduł nieograniczalny (nie da się go współdzielić w zespole) → zawsze `true`
 *   (restrykcja dotyczy wyłącznie zasobów współdzielonych),
 * - „dziecko" bez ograniczeń (moduleAccess=null) → `true` (wstecznie zgodne),
 * - „dziecko" z listą → `true` tylko gdy moduł jest na liście.
 */
export function canMemberAccessModule(member: MemberAccessInput, moduleId: string): boolean {
  if (PARENT_ROLES.has(member.role)) return true;
  if (!isRestrictableModule(moduleId)) return true;
  const allowed = parseModuleAccess(member.moduleAccess);
  if (allowed === null) return true;
  return allowed.includes(moduleId);
}
