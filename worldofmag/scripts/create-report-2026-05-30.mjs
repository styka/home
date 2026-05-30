/**
 * Tworzy/aktualizuje raport implementacji w bazie (model Report).
 * Idempotentny — upsert po `slug`. Uruchom tam, gdzie dostępna jest baza:
 *
 *   node scripts/create-report-2026-05-30.mjs
 *
 * Autor raportu: użytkownik o e-mailu ADMIN_EMAIL (jeśli istnieje), inaczej null.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ADMIN_EMAIL = "tyka.szymon@gmail.com";

const slug = "omnia-implementacja-2026-05-30";
const title = "Omnia — Raport implementacji 2026-05-30";
const category = "general";

const content = `# Omnia — Raport implementacji 2026-05-30

## Magiczna ikona — przekierowania na widoki Omni
**Diagnoza:** Asystent AI (magiczna ikona, \`AICommandSheet\`) umiał jedynie wykonać akcje
zapisu (\`plan\`) albo odpowiedzieć tekstem (\`answer\`). Brakowało trzeciej, naturalnej drogi:
gdy polecenie sprowadza się do „pokaż / otwórz / przejdź do …", a w aplikacji istnieje
gotowy widok z parametrami (np. zadania w trakcie), użytkownik powinien móc potwierdzić
przekierowanie i zostać tam przeniesiony. Podobnie po dodaniu np. zadania z dopiskiem „przejdź
do niego" — powinno paść pytanie o przejście do utworzonego elementu. Dopiero gdy prośba jest
zbyt złożona dla gotowego widoku, dane mają być odfiltrowane przez LLM i pokazane jako markdown.

**Rozwiązanie:** Dodano do protokołu agenta nowy krok \`navigate\` obok \`query/clarify/answer/plan\`.
Wybór drogi spoczywa na LLM, wg jasnych reguł w prompcie: prośby o pokazanie listy odwzorowalnej
gotowym widokiem → \`navigate\`; pytania analityczne / filtrowanie spoza możliwości widoku → \`answer\`.
Dwa scenariusze przejścia:
- *Czyste przekierowanie* (np. „pokaż zadania w trakcie" → \`/tasks/all?status=IN_PROGRESS\`):
  agent w razie potrzeby najpierw pobiera \`id\` przez \`query\`, potem zwraca \`navigate\` z adresem
  i etykietą; klient pokazuje potwierdzenie „Przejść do: …?" i robi \`router.push\`.
- *Utworzenie + przejście* („dodaj zadanie X i przejdź do niego"): akcja tworząca dostaje
  \`params.openAfter\`, a \`execute\` po zapisie zwraca cel przekierowania zbudowany z ID świeżo
  utworzonego rekordu (tylko serwer zna nowe ID). Klient po wykonaniu oferuje przycisk „Przejdź".

Bezpieczeństwo: adres przekierowania pochodzi od LLM, więc jest traktowany jak nieufne wejście.
\`sanitizeNavUrl()\` dopuszcza wyłącznie ścieżki wewnętrzne (jeden wiodący \`/\`, bez \`//\` i URL-i
absolutnych) pasujące do whitelisty prefiksów (\`/tasks\`, \`/shopping\`, \`/notes\`, \`/pets\`) —
to zamyka furtkę open-redirect. Aby deep-linki faktycznie lądowały na właściwym widoku,
\`TasksPage\` czyta teraz parametry \`?status=\` (ustawia filtr) i \`?task=\` (otwiera szczegóły),
analogicznie do istniejących \`?focus=\`/\`?pinned=\` w Notatkach.

**Zmienione pliki:**
- \`src/app/api/llm/home/agent/route.ts\` — krok \`navigate\` w protokole + katalog dozwolonych
  adresów w prompcie, walidator \`sanitizeNavUrl\` (whitelista prefiksów), obsługa kroku z
  ponowną prośbą do LLM przy niedozwolonym URL; podpowiedź o \`params.openAfter\`.
- \`src/app/api/llm/home/execute/route.ts\` — \`executeAction\` zwraca \`string | ExecOutcome\`;
  akcje tworzące (create_task/note/list/project, add_item) z \`openAfter\` zwracają \`navigateTo\`
  + \`navigateLabel\`; pole przeniesione do \`ActionResult\`.
- \`src/components/home/AICommandSheet.tsx\` — nowa faza \`navigate\` (ekran potwierdzenia
  „Przejdź / Zostań") oraz przyciski „Przejdź do…" w widoku wyników dla akcji z \`navigateTo\`.
- \`src/components/tasks/TasksPage.tsx\` — \`initialFilter\` / \`initialOpenTaskId\` z URL.
- \`src/app/tasks/[projectId]/page.tsx\` — odczyt \`searchParams\` (\`status\`, \`task\`) i przekazanie
  do \`TasksPage\` (z walidacją statusu po \`TASK_STATUS_FILTERS\`).

## Podsumowanie
Sesja objęła jedno zadanie z roadmapy UX asystenta AI — domknięcie „magicznej ikony" o zdolność
nawigacji. Główne obszary zmian: warstwa agenta LLM (nowy krok protokołu + walidacja adresów),
warstwa wykonawcza (zwracanie celu przekierowania po utworzeniu rekordu) oraz UI (potwierdzenie
przejścia i deep-linki w module Zadań). Świadomie ograniczono się do minimum: brak nowych
abstrakcji, ponowne użycie istniejącego wzorca parametrów z Notatek, a wybór drogi
(navigate / answer / plan) pozostawiono LLM wg reguł w prompcie. Kluczowa uwaga utrzymaniowa:
każdy URL od modelu walidujemy whitelistą prefiksów (ochrona przed open-redirect), a deep-link
działa tylko, gdy strona docelowa czyta swoje parametry z query.
`;

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } });
  const report = await prisma.report.upsert({
    where: { slug },
    update: { title, content, category },
    create: { title, slug, content, category, authorId: admin?.id ?? null },
  });
  console.log(`✅ Raport zapisany: ${report.slug} (id: ${report.id})`);
}

main()
  .catch((e) => {
    console.error("❌ Nie udało się zapisać raportu:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
