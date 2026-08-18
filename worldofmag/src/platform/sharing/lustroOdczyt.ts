import { prisma } from "@/platform/db/prisma";
import { zanotujOperacje } from "@/platform/observability/metryki";
import { logEvent } from "@/platform/observability/log";
import type { ResourceRole } from "@/platform/workspaces/types";

/**
 * 093 (zadanie 12, etap 2) — PRZEŁĄCZENIE ODCZYTU NA `ResourceGrant`, Z POMIAREM.
 *
 * Etap 1 (059/061) zbudował **lustro**: zmiana w `TaskProjectMember`, `TaskShare` czy `PetShare`
 * dopisuje odbicie do `ResourceGrant`. Etap 2 miał przełączyć odczyty — i był zablokowany zdaniem
 * „wymaga produkcyjnego pomiaru rozjazdu tabela↔nadanie". Blokada była słuszna: gdyby lustro
 * kiedykolwiek czegoś nie dopisało, samo przełączenie odczytu **odebrałoby komuś dostęp**, po cichu
 * i bez śladu.
 *
 * **Ta warstwa zamienia pomiar ręczny na automatyczny i tym samym odblokowuje przełączenie.**
 * Zasada jest jedna i jest asymetryczna z rozmysłem:
 *
 *   * źródłem prawdy jest `ResourceGrant`;
 *   * gdy tabela źródłowa daje dostęp, którego w nadaniach NIE MA (albo daje wyższą rolę),
 *     zwracamy **wynik z tabeli źródłowej** i **zgłaszamy rozjazd** — metryką i logiem;
 *   * gdy nadania dają tyle samo albo więcej, zwracamy pustą listę: nadania już to pokryły.
 *
 * Asymetria jest tu całą treścią. Rozjazd w jedną stronę (nadania mają mniej) to **utrata dostępu
 * u realnej osoby**; rozjazd w drugą (nadania mają więcej) to nadwyżka, którą widać w oknie
 * udostępniania i którą da się odebrać. Pierwsze musi być niemożliwe, drugie wystarczy, że jest
 * widoczne.
 *
 * **Warunek wyjścia jest nazwany, bo inaczej ta warstwa zostanie tu na zawsze:** gdy metryka
 * `sharing / lustro.rozjazd` utrzyma na produkcji zero przez pełny miesiąc, `extraGrants` dla tabel
 * lustrzanych można usunąć razem z tym plikiem. Do tego czasu koszt to jedno dodatkowe zapytanie
 * przy sprawdzeniu dostępu do zasobu, który ma deklarację `extraGrants`.
 */
export type NadanieZTabeli = { userId: string; role: ResourceRole };

const KOLEJNOSC: ResourceRole[] = ["viewer", "commenter", "editor", "manager"];
const wyzsza = (a: ResourceRole, b: ResourceRole) =>
  KOLEJNOSC.indexOf(a) >= KOLEJNOSC.indexOf(b) ? a : b;

/**
 * Zwraca te nadania z tabeli źródłowej, których **brakuje** w `ResourceGrant` — czyli dokładnie to,
 * co trzeba jeszcze doliczyć, żeby nikt nie stracił dostępu. Pusta lista = lustro jest kompletne.
 */
export async function brakujaceWzgledemNadan(
  resourceType: string,
  resourceId: string,
  zTabeli: NadanieZTabeli[],
): Promise<NadanieZTabeli[]> {
  if (zTabeli.length === 0) return [];

  const teraz = new Date();
  const nadania = await prisma.resourceGrant.findMany({
    where: {
      resourceType,
      resourceId,
      subjectType: "user",
      subjectId: { in: zTabeli.map((g) => g.userId) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: teraz } }],
    },
    select: { subjectId: true, role: true },
  });

  const wNadaniach = new Map<string, ResourceRole>();
  for (const n of nadania) {
    if (!n.subjectId) continue;
    const dotychczas = wNadaniach.get(n.subjectId);
    wNadaniach.set(n.subjectId, dotychczas ? wyzsza(dotychczas, n.role as ResourceRole) : (n.role as ResourceRole));
  }

  const brakujace = zTabeli.filter((g) => {
    const wN = wNadaniach.get(g.userId);
    if (!wN) return true; // nadania nie znają tej osoby wcale
    return wyzsza(wN, g.role) !== wN; // nadania znają, ale z NIŻSZĄ rolą
  });

  if (brakujace.length > 0) {
    // Metryka, nie tylko log: rozjazd trzeba móc ZOBACZYĆ na `/admin/health` bez grzebania
    // w strumieniu, bo od jej wartości zależy decyzja o usunięciu tej warstwy.
    zanotujOperacje("sharing", "lustro.rozjazd", 0, "blad");
    logEvent("warn", "sharing.lustro.rozjazd", {
      resourceType,
      resourceId,
      ile: brakujace.length,
      // Bez identyfikatorów osób: log nie jest miejscem na to, kto ma dostęp do czego.
    });
  }
  return brakujace;
}
