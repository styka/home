// 037: JEDYNY punkt decydujący, czy licznik kosztu AI trafia do użytkownika.
//
// Dlaczego osobny plik, a nie `lib/ai/usage.ts`: `usage.ts` jest importowany przez `lib/llm/chat.ts`,
// czyli przez KAŻDE wywołanie modelu. Wciągnięcie tam `@/lib/auth` (NextAuth + adapter Prismy)
// rozlałoby graf importów po całym module LLM i groziło cyklem. Tutaj `auth()` jest wołany tylko
// wtedy, gdy ktoś faktycznie chce pokazać licznik.
//
// Kontrola dostępu jest STRUKTURALNA, nie kosmetyczna: konto bez `module.admin` nie dostaje danych
// o modelach i tokenach na drut, więc nie ma czego ukrywać w kliencie.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { AI_COST_BADGE_CONFIG_KEY, usageFromChat, type AiUsageInfo } from "@/lib/ai/usage";

/**
 * Czy licznik kosztu jest w ogóle włączony w systemie.
 *
 * Brak wiersza = włączone (zgodność wsteczna z instalacjami sprzed migracji 0215) — wzorzec 1:1
 * z `readFollowupsEnabled`. Awaria odczytu też nie może po cichu wygasić funkcji.
 */
export async function readCostBadgeEnabled(): Promise<boolean> {
  try {
    const row = await prisma.config.findUnique({ where: { key: AI_COST_BADGE_CONFIG_KEY } });
    if (!row) return true;
    return row.value !== "0";
  } catch {
    return true;
  }
}

/**
 * Przepuszcza zużycie tylko wtedy, gdy licznik jest włączony i pyta o niego administrator.
 * W każdym innym przypadku zwraca `undefined` — komponent `AiCostBadge` wtedy nic nie renderuje.
 *
 * Decyzja właściciela (spec 037): domyślnie licznik widzi administrator; szczegóły techniczne
 * (modele, tokeny, koszt per prompt) są wyłącznie dla niego.
 */
export async function visibleUsage(
  usage: AiUsageInfo | undefined
): Promise<AiUsageInfo | undefined> {
  if (!usage) return undefined;
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) return undefined;
  if (!(await readCostBadgeEnabled())) return undefined;
  return usage;
}

/**
 * Skrót dla tras `/api/llm/*` i handlerów zadań: gotowe pole `usage` do wstawienia w odpowiedź.
 *
 * Zwraca pusty obiekt, gdy licznika nie wolno pokazać, więc w trasie wystarczy jedna linia:
 * `return NextResponse.json({ ...wynik, ...(await usageField(result)) })`. Bez tego każda z
 * kilkunastu tras musiałaby powtarzać ten sam warunek — a jedna zapomniana znaczyłaby moduł bez
 * licznika (bramka `check:cost-badge` pilnuje, żeby o żadnej nie zapomnieć).
 */
export async function usageField(
  res: { ok: boolean; model?: string; usage?: { prompt: number; completion: number; total: number; cacheRead?: number; cacheWrite?: number } },
  label?: string,
  op?: string
): Promise<{ usage?: AiUsageInfo }> {
  const usage = await visibleUsage(usageFromChat([{ res, label, op }]));
  return usage ? { usage } : {};
}
