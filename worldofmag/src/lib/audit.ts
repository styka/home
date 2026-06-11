// A1: dziennik audytu zmian RBAC i konfiguracji. Helper server-side (NIE "use server")
// wołany przez akcje admina po wykonaniu mutacji. Sam pobiera aktora z sesji.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AuditCategory = "rbac" | "config";

/** Zapisuje wpis audytu. Błędy logowania nie blokują operacji (best-effort). */
export async function logAudit(category: AuditCategory, action: string, target?: string | null, detail?: string | null): Promise<void> {
  try {
    const session = await auth();
    await prisma.auditLog.create({
      data: {
        actorId: session?.user?.id ?? null,
        actorEmail: session?.user?.email ?? null,
        category,
        action,
        target: target ?? null,
        detail: detail ?? null,
      },
    });
  } catch {
    /* audyt nie może wywrocic operacji biznesowej */
  }
}
