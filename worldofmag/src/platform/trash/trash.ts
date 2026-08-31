// H5: kosz / soft-delete. Helper server-side (NIE "use server") wołany przez akcje usuwania
// (notes.ts, tasks.ts…), nie eksponowany do klienta. Zapisuje migawkę encji przed twardym
// usunięciem, by dało się ją przywrócić.

import { prisma } from "@/platform/db/prisma";

const RETENTION_DAYS = 30;

// 037: „weather" = propozycje „co robić" z modułu Pogoda (biblioteka pomysłów).
// 102: „youtube" = obserwowany kanał (filmy znikają kaskadą i dobiorą się przy odświeżeniu).
// 107: „czat" = własna wiadomość. Usunięcie jest MIĘKKIE (wiersz zostaje, bo wiszą na nim cytaty
// w cudzych odpowiedziach), więc przywrócenie zdejmuje znacznik usunięcia zamiast tworzyć rekord.
// 113: „rosliny" = przestrzeń roślinna albo pojedyncza roślina. Snapshot przestrzeni niesie także
// jej miejsca i rośliny, bo kaskada FK usunie je fizycznie — przywrócenie samej nazwy byłoby
// przywróceniem pustej przestrzeni.
// 114: „contacts" = kontakt, „habits" = nawyk wraz z dziennikiem wykonań — oba to płaskie
// rekordy (bez kaskad poza wpisami nawyku), więc migawka JSON wystarcza do pełnego powrotu.
// 117: „obszary" = obszar (lub poddrzewo obszarów) z modułu Zadania — migawka niesie usuwane
// węzły drzewa i mapę przypisań zadań, bo FK `SetNull` nadpisuje `Task.areaId` przy kasowaniu.
export type TrashModule = "notes" | "tasks" | "weather" | "youtube" | "czat" | "rosliny" | "contacts" | "habits" | "obszary";

/**
 * 066 (zadanie 16) — WERSJA ROBOCZA ODRZUCONA PRZY KONFLIKCIE.
 *
 * Rozdz. 8.5.2: *„Wersja odrzucona trafia do kosza jako wersja robocza, żeby dało się do niej
 * wrócić."* Bez tego przycisk „odrzuć moje zmiany" byłby **utratą pracy jednym kliknięciem** —
 * czyli dokładnie tym, co zadanie 15 miało skończyć, tylko z ładniejszym oknem.
 *
 * Zapisujemy to jako zwykły wpis kosza, nie nowy byt: kosz **już** umie retencję, przywracanie
 * i sprzątanie, a wersja robocza nie różni się od usuniętego rekordu niczym, co wymagałoby
 * osobnej tabeli. `entityId` wskazuje rekord, którego dotyczyła — dzięki temu przywrócenie ma
 * do czego wrócić.
 */
export async function recordRejectedDraft(
  userId: string,
  data: { module: TrashModule; entityId: string; title: string; payload: unknown },
): Promise<void> {
  await recordTrash(userId, {
    module: data.module,
    entityId: data.entityId,
    // Prefiks jest częścią treści, nie ozdobą: w koszu wersja robocza stoi obok usuniętych
    // rekordów i bez niego wyglądałaby na skasowany zasób, którym nie jest.
    title: `Wersja robocza (konflikt): ${data.title}`,
    payload: data.payload,
  });
}

/**
 * 117: STATUS WPISU KOSZA — nieusuwalność zasobów (decyzja właściciela, spec 117).
 * Opróżnienie kosza, retencja i przywrócenie tylko OZNACZAJĄ wiersz; twardego DELETE na
 * `TrashItem` nie wykonuje już nic poza RODO (kaskada po `User` w `lib/privacy/purge.ts`).
 * Wpisy nie-`active` znikają z kosza użytkownika, ale admin widzi je w `/admin/kosz`
 * i może przywrócić właścicielowi.
 */
export type TrashStatus = "active" | "emptied" | "expired" | "restored";

/** Zapisuje migawkę usuwanej encji do kosza i przy okazji wygasza wpisy starsze niż 30 dni. */
export async function recordTrash(
  userId: string,
  data: { module: TrashModule; entityId: string; title: string; payload: unknown },
): Promise<void> {
  await prisma.trashItem.create({
    data: {
      userId,
      module: data.module,
      entityId: data.entityId,
      title: data.title.slice(0, 200) || "(bez tytułu)",
      payload: JSON.stringify(data.payload),
    },
  });
  // Sprzątanie: wygaś przeterminowane wpisy tego użytkownika (free-tier: bez crona).
  // 117: oznaczenie zamiast DELETE — dane zostają odzyskiwalne dla admina.
  await prisma.trashItem.updateMany({
    where: { userId, status: "active", deletedAt: { lt: trashCutoff() } },
    data: { status: "expired", resolvedAt: new Date() },
  });
}

export const TRASH_RETENTION_DAYS = RETENTION_DAYS;

/**
 * Z-059: data graniczna retencji kosza — wpisy usunięte przed nią wypadają z kosza
 * użytkownika (117: przez status `expired`, już nie przez DELETE). Czysta funkcja
 * (testowalna), wspólna dla inline-cleanup i globalnego sweepu.
 */
export function trashCutoff(now: Date = new Date(), retentionDays: number = RETENTION_DAYS): Date {
  return new Date(now.getTime() - retentionDays * 86_400_000);
}

/**
 * Z-059: globalne wygaszanie przeterminowanego kosza (WSZYSCY użytkownicy).
 * Inline-cleanup w `recordTrash` dotyka tylko aktywnego usera — konta nieaktywne
 * nigdy nie zwolniłyby swoich wpisów. Wołane z zewnętrznego wyzwalacza
 * (`/api/cron/retention`), bo free tier nie ma natywnego crona. Zwraca liczbę wygaszonych.
 * 117: oznaczenie `expired` zamiast DELETE — nieusuwalność zasobów.
 */
export async function purgeExpiredTrash(now: Date = new Date()): Promise<number> {
  const res = await prisma.trashItem.updateMany({
    where: { status: "active", deletedAt: { lt: trashCutoff(now) } },
    data: { status: "expired", resolvedAt: now },
  });
  return res.count;
}
