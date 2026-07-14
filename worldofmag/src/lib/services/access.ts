import { prisma } from "@/lib/prisma";

export type RequestRole = "client" | "provider";

/**
 * Z-173/Z-360: dostęp do zlecenia marketplace. Tylko klient zlecenia lub
 * wykonawca (właściciel profilu) mają dostęp — każdy inny zalogowany dostaje
 * „Brak dostępu". Rdzeń izolacji dwustronnej (czat/wyceny/płatności/spory).
 *
 * Wydzielone z `actions/services.ts` (która jest "use server"), żeby pokryć je
 * testem bez wystawiania jako Server Action.
 */
export async function loadRequestAccess(requestId: string, userId: string) {
  const req = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, title: true, status: true, clientId: true, providerId: true, provider: { select: { userId: true } } },
  });
  if (!req) throw new Error("Zlecenie nie istnieje");
  const isClient = req.clientId === userId;
  const isProvider = req.provider.userId === userId;
  if (!isClient && !isProvider) throw new Error("Brak dostępu do zlecenia");
  return { req, role: (isClient ? "client" : "provider") as RequestRole };
}
