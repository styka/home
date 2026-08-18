import { prisma } from "@/platform/db/prisma";
import { notifyUser } from "@/lib/notify";
import { getUsdPlnRate } from "@/lib/usdPlnRate";
import { withPln } from "@/lib/usdPln";
import { getAdminUserIds, getDailyCostUsd } from "@/platform/ai/usage";

/**
 * 082 (zadanie 27, Faza 5) — BUDŻETY AI.
 *
 * Rozdz. 11.3 nazywa to „jedynym zagrożeniem, które kosztuje realne pieniądze, zanim zdąży zepsuć
 * aplikację" i wymienia cztery mechanizmy. Trzy z nich mieszkają tutaj; czwarty (dzienny limit per
 * plan) był już zrobiony i został w `usage.ts`.
 *
 * | Rozdz. 11.3                     | Gdzie                                                    |
 * |---------------------------------|----------------------------------------------------------|
 * | Limit miesięczny per użytkownik | `plan.aiMonthlyTokens`, sprawdzany w `checkAiBudget`      |
 * | Limit globalny                  | `ai_globally_disabled` — wyłącznik awaryjny (ten plik)    |
 * | Alarm progowy 50 % / 80 %       | `ai_monthly_budget_usd` + `maybeFireMonthlyBudgetAlert`   |
 * | Widoczność dla użytkownika      | `getMyAiUsage` → `/settings`                              |
 */

/** `"1"` = AI wyłączone w całym systemie. Brak wiersza = działa. */
export const AI_KILL_SWITCH_CONFIG_KEY = "ai_globally_disabled";
/** Miesięczny budżet kosztowy CAŁEJ instalacji w USD. `0`/brak = bez budżetu (tylko alert dzienny). */
export const AI_MONTHLY_BUDGET_CONFIG_KEY = "ai_monthly_budget_usd";
/** `"1"` = po wyczerpaniu miesięcznego budżetu AI wyłącza się SAMO. Domyślnie wyłączone. */
export const AI_MONTHLY_BUDGET_HARD_KEY = "ai_monthly_budget_hard";

/**
 * Czy wyłącznik awaryjny jest podniesiony.
 *
 * **Bez cache'u — świadomie.** To jest hamulec bezpieczeństwa: administrator podnosi go, gdy
 * rachunek rośnie w oczach, i musi zadziałać NATYCHMIAST, a nie „w ciągu 30 sekund". Koszt to jedno
 * wyszukanie po kluczu głównym przy operacji, która i tak idzie przez sieć do dostawcy modelu.
 *
 * **Awaria odczytu = AI działa** (jak w `readCostBadgeEnabled`). Odwrotna decyzja oznaczałaby, że
 * chwilowy problem z bazą wygasza asystenta wszystkim — a przy niedostępnej bazie i tak nie ma czym
 * obsłużyć żądania. Zapisujemy to wprost, bo „fail-open w wyłączniku bezpieczeństwa" wygląda na błąd,
 * dopóki nie przeczyta się uzasadnienia.
 */
export async function readAiKillSwitch(): Promise<boolean> {
  try {
    const row = await prisma.config.findUnique({ where: { key: AI_KILL_SWITCH_CONFIG_KEY } });
    return row?.value === "1";
  } catch {
    return false;
  }
}

export const AI_WYLACZONE_KOMUNIKAT =
  "Asystent AI jest tymczasowo wyłączony przez administratora. Spróbuj później.";

/** Bieżący miesiąc UTC w postaci `YYYY-MM`. */
export function currentMonthUtc(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** Suma szacowanego kosztu (USD) z `AiCall` w danym miesiącu UTC. */
export async function getMonthlyCostUsd(month = currentMonthUtc()): Promise<number> {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const agg = await prisma.aiCall.aggregate({
    where: { createdAt: { gte: start, lt: end } },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ?? 0;
}

async function readLiczbe(key: string): Promise<number> {
  const row = await prisma.config.findUnique({ where: { key } });
  const n = row?.value ? Number(row.value) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getMonthlyBudgetUsd(): Promise<number> {
  return readLiczbe(AI_MONTHLY_BUDGET_CONFIG_KEY);
}

export async function readMonthlyBudgetHard(): Promise<boolean> {
  try {
    const row = await prisma.config.findUnique({ where: { key: AI_MONTHLY_BUDGET_HARD_KEY } });
    return row?.value === "1";
  } catch {
    return false;
  }
}

/**
 * Progi alarmowe. Rozdz. 11.3 wymienia 50 % i 80 %; **100 % jest dołożone** — bez niego moment
 * faktycznego wyczerpania budżetu byłby jedyną chwilą, o której administrator NIE dostaje
 * powiadomienia.
 */
export const PROGI_ALARMU = [0.5, 0.8, 1] as const;

/**
 * Powiadamia administratorów po przekroczeniu kolejnego progu miesięcznego budżetu.
 *
 * Deduplikacja jest per (miesiąc, próg) — dzięki temu przekroczenie 50 % daje jedno powiadomienie
 * na cały miesiąc, a nie jedno na każde wywołanie modelu po tym momencie. Klucz z samym miesiącem
 * byłby ZA WĄSKI (80 % nie miałoby jak się przebić), a z samym progiem — za szeroki (w kolejnym
 * miesiącu alarm już by nie zadziałał).
 */
export async function maybeFireMonthlyBudgetAlert(): Promise<void> {
  const budget = await getMonthlyBudgetUsd();
  if (budget <= 0) return;
  const month = currentMonthUtc();
  const total = await getMonthlyCostUsd(month);
  const udzial = total / budget;
  const przekroczone = PROGI_ALARMU.filter((p) => udzial >= p);
  if (przekroczone.length === 0) return;

  const admins = await getAdminUserIds();
  if (admins.length === 0) return;
  const rate = await getUsdPlnRate();
  const totalStr = withPln(`$${total.toFixed(2)}`, total, rate);
  const budgetStr = withPln(`$${budget.toFixed(2)}`, budget, rate);

  for (const prog of przekroczone) {
    const procent = Math.round(prog * 100);
    await Promise.all(
      admins.map((userId) =>
        notifyUser({
          userId,
          module: "admin",
          title:
            prog >= 1
              ? "Wyczerpano miesięczny budżet AI"
              : `Miesięczny budżet AI przekroczył ${procent}%`,
          body: `Koszt AI w miesiącu ${month} to ${totalStr} z budżetu ${budgetStr}.`,
          href: "/admin/llm",
          dedupeKey: `ai-budget-${month}-${procent}`,
        })
      )
    );
  }
}

export type StanBudzetuAI = {
  wylaczoneRecznie: boolean;
  budzetUsd: number;
  wydanoUsd: number;
  twardy: boolean;
  /** `true`, gdy jakakolwiek przyczyna każe wstrzymać wywołania modelu. */
  wstrzymane: boolean;
  powod: string | null;
};

/**
 * Jedno miejsce, w którym rozstrzyga się „czy wolno teraz zawołać model".
 *
 * **Dlaczego globalny limit i wyłącznik są rozdzielone.** Rozdz. 11.3 opisuje limit globalny jako
 * „wyłącznik awaryjny w `Config`", czyli decyzję CZŁOWIEKA. Sam alarm progowy niczego nie zatrzymuje
 * — a budżet, który tylko powiadamia, nie jest budżetem. Dlatego jest trzecie ustawienie
 * (`ai_monthly_budget_hard`): administrator jawnie mówi „po przekroczeniu budżetu zatrzymaj".
 * Domyślnie wyłączone, bo automat gaszący asystenta bez uprzedzenia byłby gorszy od rachunku.
 */
export async function stanBudzetuAI(): Promise<StanBudzetuAI> {
  const [wylaczoneRecznie, budzetUsd, twardy] = await Promise.all([
    readAiKillSwitch(),
    getMonthlyBudgetUsd(),
    readMonthlyBudgetHard(),
  ]);
  const wydanoUsd = budzetUsd > 0 ? await getMonthlyCostUsd() : 0;
  if (wylaczoneRecznie) {
    return { wylaczoneRecznie, budzetUsd, wydanoUsd, twardy, wstrzymane: true, powod: AI_WYLACZONE_KOMUNIKAT };
  }
  if (twardy && budzetUsd > 0 && wydanoUsd >= budzetUsd) {
    return {
      wylaczoneRecznie,
      budzetUsd,
      wydanoUsd,
      twardy,
      wstrzymane: true,
      powod: "Wyczerpano miesięczny budżet AI całej instalacji. Asystent wróci po jego odnowieniu lub podniesieniu przez administratora.",
    };
  }
  return { wylaczoneRecznie, budzetUsd, wydanoUsd, twardy, wstrzymane: false, powod: null };
}

/**
 * Skrót dla punktu dławiącego w `chatComplete`/`chatStream`: `null` = wolno, tekst = komunikat odmowy.
 *
 * Sprawdzenie jest BEZWARUNKOWE — nie zależy od tego, czy operacja ma `userId`. Dawny budżet dzienny
 * chodził tylko dla wywołań z użytkownikiem, więc zadania w tle (odświeżanie wiadomości, OCR,
 * generowanie skórek) przechodziły obok kontroli kosztów. Wyłącznik awaryjny, który nie wyłącza
 * najdroższych operacji w systemie, byłby ozdobą.
 */
export async function powodWstrzymaniaAI(): Promise<string | null> {
  const stan = await stanBudzetuAI();
  return stan.wstrzymane ? stan.powod : null;
}

/** Poglądowe zużycie dla WŁAŚCICIELA konta („wykorzystano X z Y" z rozdz. 11.3). */
export type MojeZuzycieAI = {
  planName: string;
  dzien: { requests: number; limitRequests: number; tokens: number; limitTokens: number };
  miesiac: { tokens: number; limitTokens: number };
};

export async function getMyAiUsage(userId: string): Promise<MojeZuzycieAI> {
  const { getActivePlan } = await import("@/lib/plans");
  const day = new Date().toISOString().slice(0, 10);
  const month = currentMonthUtc();
  const [plan, dzien, miesiac] = await Promise.all([
    getActivePlan(userId),
    prisma.aiUsage.findUnique({ where: { userId_day: { userId, day } } }),
    prisma.aiUsage.aggregate({
      where: { userId, day: { gte: `${month}-01`, lte: `${month}-31` } },
      _sum: { tokens: true },
    }),
  ]);
  return {
    planName: plan.name,
    dzien: {
      requests: dzien?.requests ?? 0,
      limitRequests: plan.aiDailyRequests,
      tokens: dzien?.tokens ?? 0,
      limitTokens: plan.aiDailyTokens,
    },
    miesiac: { tokens: miesiac._sum.tokens ?? 0, limitTokens: plan.aiMonthlyTokens },
  };
}

/** Re-eksport, żeby alert dzienny i miesięczny dało się wołać z jednego miejsca. */
export { getDailyCostUsd };
