// A1: dziennik audytu zmian RBAC i konfiguracji. Helper server-side (NIE "use server")
// wołany przez akcje admina po wykonaniu mutacji. Sam pobiera aktora z sesji.

import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";

// 090 (zadanie 14): doszła kategoria `sharing`. Rozdz. 12.3 wymienia „nadania i odwołania dostępu
// do dziennika" jako OBOWIĄZEK zgodności, nie funkcję — zmiana dostępu do cudzych danych musi
// zostawiać ślad tak samo, jak zmiana roli w RBAC.
// 117: "admin" = operacje administratora na cudzych zasobach (np. przywrócenie z kosza) —
// muszą zostawiać ślad (C-25), a nie są ani RBAC, ani konfiguracją.
export type AuditCategory = "rbac" | "config" | "sharing" | "admin";

/** Zapisuje wpis audytu. Błędy logowania nie blokują operacji (best-effort). */
export async function logAudit(category: AuditCategory, action: string, target?: string | null, detail?: string | null): Promise<void> {
  // 090: odczyt sesji ma WŁASNY `try`. Wcześniej obejmował go ten sam blok co zapis, więc brak
  // kontekstu żądania (zadanie w tle, skrypt, test) kończył się pominięciem CAŁEGO wpisu — a nie
  // brakiem samego autora. Operacja systemowa też musi zostawiać ślad; „nie wiadomo kto" jest
  // informacją, „nie wiadomo czy się stało" nie jest.
  let actorId: string | null = null;
  let actorEmail: string | null = null;
  try {
    const session = await auth();
    actorId = session?.user?.id ?? null;
    actorEmail = session?.user?.email ?? null;
  } catch {
    /* brak kontekstu żądania — wpis powstaje bez autora */
  }
  try {
    await prisma.auditLog.create({
      data: { actorId, actorEmail, category, action, target: target ?? null, detail: detail ?? null },
    });
  } catch {
    /* audyt nie może wywrocic operacji biznesowej */
  }
}
