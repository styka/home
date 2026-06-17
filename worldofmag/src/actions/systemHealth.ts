"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { OPERATION_TYPES, OPERATION_TYPE_META } from "@/lib/llm/operationTypes";
import { isSecretConfigured } from "@/lib/crypto/secrets";

async function requireAdmin() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) throw new Error("Forbidden");
}

export type HealthCheck = { label: string; ok: boolean; detail: string };

export type SystemHealth = {
  build: { commit: string; branch: string; buildDate: string; commitMsg: string };
  db: { ok: boolean; latencyMs: number; migrations: number; lastMigration: string | null };
  llm: { ready: boolean; providers: number; enabledProviders: number; assignments: HealthCheck[]; legacyGroq: boolean };
  integrations: HealthCheck[];
  counts: { label: string; value: number }[];
  audit: { total: number; last: string | null };
};

export async function getSystemHealth(): Promise<SystemHealth> {
  await requireAdmin();

  // DB: pomiar latencji prostym zapytaniem + stan migracji.
  const t0 = Date.now();
  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }
  const latencyMs = Date.now() - t0;

  let migrations = 0;
  let lastMigration: string | null = null;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC`;
    migrations = rows.length;
    lastMigration = rows[0]?.migration_name ?? null;
  } catch {
    /* tabela migracji niedostępna (np. SQLite) */
  }

  // LLM: dostawcy + przypisania per typ operacji.
  const providers = await prisma.llmProvider.findMany({ select: { id: true, enabled: true, apiKey: true } });
  const enabledProviders = providers.filter((p) => p.enabled && p.apiKey).length;
  const assignmentsRaw = await prisma.llmAssignment.findMany({ include: { provider: { select: { enabled: true, apiKey: true } } } });
  const byType = new Map(assignmentsRaw.map((a) => [a.operationType, a]));
  const assignments: HealthCheck[] = OPERATION_TYPES.map((op) => {
    const a = byType.get(op);
    const ok = !!a && !!a.provider?.enabled && !!a.provider?.apiKey;
    return { label: OPERATION_TYPE_META[op].label, ok, detail: a ? (ok ? a.model : "dostawca wyłączony/brak klucza") : "brak przypisania" };
  });
  const legacy = await prisma.config.findUnique({ where: { key: "groq_api_key" }, select: { value: true } });
  const legacyGroq = !!legacy?.value;
  const llmReady = assignments.some((a) => a.ok) || legacyGroq;

  // Integracje (klucze konfiguracyjne — tylko obecność, bez wartości).
  const cfg = async (key: string) => !!(await prisma.config.findUnique({ where: { key }, select: { value: true } }))?.value;
  const integrations: HealthCheck[] = [
    { label: "Brave Search (web_search)", ok: await cfg("brave_search_api_key") || !!process.env.BRAVE_SEARCH_API_KEY, detail: "wyszukiwarka asystenta/Wiadomości" },
    { label: "OpenRouteService (Truck)", ok: await cfg("ors_api_key") || !!process.env.ORS_API_KEY, detail: "trasowanie ciężarówek" },
    // Z-054: czy klucz szyfrujący sekrety jest ustawiony (inaczej niebezpieczny fallback).
    { label: "Szyfrowanie sekretów (CONFIG_SECRET/AUTH_SECRET)", ok: isSecretConfigured(), detail: isSecretConfigured() ? "klucz ustawiony" : "BRAK — używany niebezpieczny fallback! Ustaw sekret w env." },
  ];

  // Liczby rekordów kluczowych encji.
  const [users, teams, notes, tasks, lists, recipes, notifications, trash] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.note.count(),
    prisma.task.count(),
    prisma.shoppingList.count(),
    prisma.recipe.count(),
    prisma.notification.count().catch(() => 0),
    prisma.trashItem.count().catch(() => 0),
  ]);
  const counts = [
    { label: "Użytkownicy", value: users },
    { label: "Zespoły", value: teams },
    { label: "Notatki", value: notes },
    { label: "Zadania", value: tasks },
    { label: "Listy zakupów", value: lists },
    { label: "Przepisy", value: recipes },
    { label: "Powiadomienia", value: notifications },
    { label: "Kosz", value: trash },
  ];

  const auditTotal = await prisma.auditLog.count().catch(() => 0);
  const auditLast = await prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }).catch(() => null);

  return {
    build: {
      commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "?",
      branch: process.env.NEXT_PUBLIC_BUILD_BRANCH ?? "?",
      buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? "?",
      commitMsg: process.env.NEXT_PUBLIC_BUILD_COMMIT_MSG ?? "—",
    },
    db: { ok: dbOk, latencyMs, migrations, lastMigration },
    llm: { ready: llmReady, providers: providers.length, enabledProviders, assignments, legacyGroq },
    integrations,
    counts,
    audit: { total: auditTotal, last: auditLast?.createdAt.toISOString() ?? null },
  };
}
