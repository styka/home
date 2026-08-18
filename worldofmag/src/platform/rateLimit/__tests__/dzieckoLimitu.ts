/**
 * 081 — DRUGI PROCES do testu współdzielenia limitu (rozdz. 11.2: „test integracyjny z dwoma
 * procesami, inaczej regres wróci niezauważony").
 *
 * Uruchamiany przez `rateLimit.integration.test.ts` jako osobny proces node. Zużywa wskazaną liczbę
 * żądań w podanym zakresie i wypisuje na stdout, ile z nich przeszło. Musi to być PRAWDZIWY drugi
 * proces: limiter w pamięci procesu przechodzi każdy test w jednym procesie i wywraca się dopiero
 * na produkcji, gdzie instancji jest więcej niż jedna.
 */
async function main() {
  const [zakres, podmiot, ile] = process.argv.slice(2);
  const { sprawdzLimit } = await import("@/platform/rateLimit");
  const { prisma } = await import("@/platform/db/prisma");
  let przeszlo = 0;
  for (let i = 0; i < Number(ile); i++) {
    const r = await sprawdzLimit(zakres as "zaproszenia", podmiot);
    if (r.ok) przeszlo++;
  }
  process.stdout.write(String(przeszlo));
  await prisma.$disconnect();
}

void main();
