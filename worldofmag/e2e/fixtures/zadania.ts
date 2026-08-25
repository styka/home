import { prisma } from "./db";
import { E2E_ADMIN } from "./users";

/**
 * 100 — etykiety zadań dla klikacza.
 *
 * Filtr etykiet w ogóle się nie renderuje, gdy słownik jest pusty (`allTags.length === 0`), a
 * `prisma/seed.ts` żadnych nie zakłada. Bez tej podkładki AC-6..AC-9 dałoby się sprawdzić wyłącznie
 * z lektury kodu — czyli nie dałoby się ich sprawdzić.
 *
 * Osiemnaście etykiet, nie trzy: całe zgłoszenie właściciela brzmiało „jak jest dużo tagów a
 * najczęściej jest dużo to ten pasek jest bardzo długi". Przy trzech stary pasek też mieściłby się
 * w jednym wierszu, więc test nie odróżniłby naprawy od jej braku — dokładnie ten sam powód, dla
 * którego 086 wstawiło do Pogody długą nazwę lokalizacji zamiast „Kraków".
 */
export const ETYKIETY_E2E = [
  "dziś", "finanse", "inne", "katowice", "kocoń", "moje pomysły",
  "praca", "quick", "raj", "remonty i naprawy", "research", "samochód",
  "sprzątanie", "wspólne", "zakupy", "zdrowie", "dom", "ogród",
];

/**
 * Zwraca identyfikator projektu, w którym filtr etykiet w ogóle się rysuje.
 *
 * `/tasks` to PULPIT modułu (liczniki i skróty), a nie lista z paskiem filtrów — pasek żyje pod
 * `/tasks/[projectId]`, i dokładnie stamtąd pochodzi zgłoszenie właściciela. Seed nie zakłada
 * żadnego projektu, więc podkładka musi go stworzyć, inaczej test mierzyłby nieistniejący pasek.
 */
export async function ensureEtykietyZadan(): Promise<string> {
  // `TaskTagDef` jest słownikiem GLOBALNYM (unikalna nazwa, bez przestrzeni), więc nie ma tu
  // czego wiązać z użytkownikiem — inaczej niż w podkładce Pogody.
  await prisma.taskTagDef.createMany({
    data: ETYKIETY_E2E.map((name, i) => ({
      name,
      // Kolor jest DANYMI (etykieta użytkownika), nie tokenem motywu — stąd wartości wprost.
      color: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#6b7280"][i % 6],
    })),
    // Baza klikacza jest długowieczna, a fixture ma być idempotentna.
    skipDuplicates: true,
  });

  const user = await prisma.user.findUnique({ where: { email: E2E_ADMIN.email } });
  if (!user) throw new Error("Brak użytkownika E2E — uruchom ensureE2EFixtures() najpierw");
  const przestrzen = await prisma.workspace.findFirst({ where: { personalUserId: user.id } });
  if (!przestrzen) throw new Error("Brak przestrzeni osobistej użytkownika E2E");

  const NAZWA = "Ergonomia — projekt klikacza";
  const istnieje = await prisma.taskProject.findFirst({
    where: { workspaceId: przestrzen.id, name: NAZWA },
    select: { id: true },
  });
  if (istnieje) return istnieje.id;

  const projekt = await prisma.taskProject.create({
    data: { workspaceId: przestrzen.id, name: NAZWA },
    select: { id: true },
  });
  return projekt.id;
}
