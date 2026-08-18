import { prisma } from "@/platform/db/prisma";
import type { AccessContext } from "./types";

/**
 * 095 (zadanie 14, brakująca połowa) — ZASOBY DANEGO TYPU NADANE MNIE.
 *
 * `resolveRole` odpowiada na pytanie „czy mam dostęp do TEGO zasobu" — czyli zakłada, że użytkownik
 * już wie, o który zasób chodzi. Do wypisania listy potrzebne jest pytanie odwrotne: „**których**
 * zasobów tego typu mi udostępniono". Bez niego nadanie było prawdziwe i niewidoczne: dostęp
 * istniał, a udostępniona notatka nie pojawiała się nigdzie, gdzie użytkownik jej szuka.
 *
 * Funkcja stoi w platformie, bo nie zna żadnego modułu — dostaje `resourceType` jako **tekst**
 * (C-36) i zwraca identyfikatory. Złożenie tego z zapytaniem modułu (`id: { in: […] }`) należy do
 * modułu, który jako jedyny wie, z której tabeli czytać.
 *
 * **Nadania linkowe są celowo pominięte.** Link daje dostęp temu, kto go ma — a nie konkretnemu
 * kontu — więc doklejenie takiego zasobu do czyjejś listy pokazywałoby go osobie, która linku nigdy
 * nie dostała. Do zasobu z linku wchodzi się linkiem.
 *
 * **Nadania odziedziczone (`inherited`) też nie.** Zasób dziedziczący dostęp po rodzicu pojawia się
 * na liście przez rodzica; wypisanie obu dałoby ten sam zasób dwa razy, raz jako siebie i raz jako
 * dziecko.
 */
export async function idZasobowNadanychMi(
  userId: string,
  resourceType: string,
  ctx: AccessContext,
): Promise<string[]> {
  const teraz = new Date();
  const nadania = await prisma.resourceGrant.findMany({
    where: {
      resourceType,
      inherited: false,
      AND: [
        {
          OR: [
            { subjectType: "user", subjectId: userId },
            ...(ctx.workspaceIds.length
              ? [{ subjectType: "workspace", subjectId: { in: ctx.workspaceIds } }]
              : []),
          ],
        },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: teraz } }] },
      ],
    },
    select: { resourceId: true },
    // Zapytanie listowe — próg z rozdz. 11.4. Nadań na jeden typ zasobu bywa tyle, ile zasobów;
    // bez ograniczenia jedno udostępnienie „wszystkiego" zamieniłoby listę w pełny skan.
    take: 500,
  });
  // `Array.from`, nie `[...Set]` — cel kompilacji aplikacji jest niższy niż w konfiguracji
  // testów, więc rozwinięcie zbioru przechodzi `tsc -p tsconfig.test.json` i pada w `next build`.
  return Array.from(new Set(nadania.map((n) => n.resourceId)));
}
