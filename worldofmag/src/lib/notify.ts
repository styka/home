import { prisma } from "@/lib/prisma";

// 031 (audyt kontroli dostępu): `notifyUser` żyła w `src/actions/notifications.ts` z dyrektywą
// `"use server"`, więc — jak każda eksportowana funkcja w takim pliku — była wystawiona jako
// zdalny endpoint. Przyjmuje `userId` odbiorcy, bo LEGALNIE powiadamia INNE osoby (np. wykonawcę
// zlecenia w marketplace), więc nie da się jej obwarować regułą „tylko własne konto".
// Rozwiązanie: to jest helper SERWEROWY (zwykły moduł, bez `"use server"`) — wołany z akcji i z
// zadań w tle, ale niedostępny z przeglądarki.

export interface NotifyInput {
  userId: string;
  module: string;
  title: string;
  body?: string | null;
  href?: string | null;
  dueAt?: Date | null;
  dedupeKey?: string | null;
}

/**
 * Tworzy powiadomienie idempotentnie po (userId, dedupeKey). Gdy `dedupeKey` jest puste —
 * zawsze tworzy nowe (ad-hoc).
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  const data = {
    module: input.module,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    dueAt: input.dueAt ?? null,
  };
  if (input.dedupeKey) {
    await prisma.notification.upsert({
      where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
      create: { userId: input.userId, dedupeKey: input.dedupeKey, ...data },
      update: {}, // istnieje → nie duplikuj i nie „odczytuj" ponownie
    });
  } else {
    await prisma.notification.create({ data: { userId: input.userId, ...data } });
  }
}
