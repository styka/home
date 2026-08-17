/**
 * 049/T-1 + 050/T-1 — SYNTETYCZNE DANE do porównania „przed" i „po" dla agendy **oraz** pulpitu.
 *
 * Zwykły seed tworzy uprawnienia, konfigurację i scenariusze QA, ale **żadnych danych
 * użytkownika** — konta powstają dopiero przez OAuth. Bez danych agregaty zwracają zera, więc
 * porównanie „przed/po" niczego by nie dowiodło: **pusty wynik zgadza się z pustym nawet wtedy,
 * gdy przebudowa zgubiła połowę źródeł.** To jest lekcja z 049 i powód istnienia tego pliku.
 *
 * Pokrywa **dwie powierzchnie**:
 *  - **agenda kalendarza** — po jednym zdarzeniu w każdym z siedmiu źródeł, w bieżącym miesiącu;
 *  - **migawka pulpitu** — dane dla każdego z jedenastu wkładów, liczone względem DZISIAJ
 *    (zadania na dziś i zaległe, przypięta notatka, spiżarnia z krótkim terminem, saldo portfela,
 *    talia z powtórkami, braki magazynowe, raport).
 *
 * Uruchamiany ręcznie, wyłącznie przeciw lokalnej bazie (C-13), idempotentny (stały identyfikator
 * użytkownika, `deleteMany` przed wstawieniem).
 *
 *   npx tsx scripts/fixture-surface.ts
 */
import { prisma } from "../src/platform/db/prisma";
// 079: własność zapisujemy i filtrujemy tym samym helperem co aplikacja — po usunięciu kolumn
// `ownerId` fixture musiałby inaczej znać przestrzeń, a to jest dokładnie ta wiedza, którą
// `platform/workspaces/zapis.ts` trzyma w jednym miejscu.
import { filtrMoichRekordow, wlasnoscDoZapisu } from "../src/platform/workspaces/zapis";

/**
 * 050: fixture można zasiać na **istniejącym** użytkowniku (`--email=...`).
 *
 * Powód jest odkryciem samym w sobie: siedem z jedenastu bloków migawki pulpitu woła kontrakty
 * modułów, a te wywodzą użytkownika **z sesji**, nie z parametru. Zasianie danych na osobnym koncie
 * dawało więc zera — bloki czytały konto z ciasteczka. Żeby zrzut cokolwiek mierzył, dane muszą
 * należeć do tego samego użytkownika, którym jesteśmy zalogowani.
 */
const ARG_EMAIL = process.argv.find((a) => a.startsWith("--email="))?.slice("--email=".length);
const EMAIL = ARG_EMAIL ?? "fixture-049@local.test";
const USER_ID_DOMYSLNY = "fixture-049-kalendarz";

function tegoMiesiaca(dzien: number, godzina = 12): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), dzien, godzina, 0, 0, 0);
}

/** Pulpit liczy „dziś" i „zaległe" względem bieżącej daty, nie miesiąca — stąd osobny helper. */
function odDzis(dni: number, godzina = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() + dni);
  d.setHours(godzina, 0, 0, 0);
  return d;
}

async function main() {
  if (/neon\.tech|render\.com/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("C-13: fixture wolno odpalać wyłącznie na lokalnej bazie.");
  }

  const istniejacy = ARG_EMAIL ? await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } }) : null;
  if (ARG_EMAIL && !istniejacy) throw new Error(`Nie ma użytkownika ${EMAIL}`);
  const USER_ID = istniejacy?.id ?? USER_ID_DOMYSLNY;
  if (!istniejacy) {
    await prisma.user.upsert({
      where: { id: USER_ID },
      update: {},
      create: { id: USER_ID, email: EMAIL, name: "Fixture 049", role: "USER" },
    });
  }

  // Sprzątanie przed wstawieniem — fixture ma dawać ten sam wynik przy każdym uruchomieniu.
  await prisma.task.deleteMany({ where: { createdById: USER_ID } });
  await prisma.mealPlanEntry.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.healthEvent.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.vehicle.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.medicationSchedule.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.pet.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.languageDeck.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });

  // 1. Zadanie z terminem
  await prisma.task.create({
    data: { title: "Fixture: zadanie z terminem", createdById: USER_ID, dueDate: tegoMiesiaca(5, 9), status: "TODO" },
  });

  // 2. Posiłek w planie
  await prisma.mealPlanEntry.create({
    data: { date: tegoMiesiaca(6), slot: "DINNER", customTitle: "Fixture: obiad", ...(await wlasnoscDoZapisu(USER_ID)) },
  });

  // 3. Wizyta / badanie
  await prisma.healthEvent.create({
    data: { kind: "VISIT", title: "Fixture: wizyta", scheduledAt: tegoMiesiaca(7, 10), ...(await wlasnoscDoZapisu(USER_ID)) },
  });

  // 4. Pojazd z przeglądem i ubezpieczeniem
  await prisma.vehicle.create({
    data: {
      name: "Fixture: auto",
      ...(await wlasnoscDoZapisu(USER_ID)),
      inspectionDue: tegoMiesiaca(8),
      insuranceDue: tegoMiesiaca(9),
    },
  });

  // 5. Lek (cykliczny — agenda liczy z niego sloty)
  await prisma.medicationSchedule.create({
    data: {
      kind: "MEDICATION",
      name: "Fixture: lek",
      ...(await wlasnoscDoZapisu(USER_ID)),
      freqType: "DAILY",
      interval: 1,
      startDate: tegoMiesiaca(1),
      timesOfDay: JSON.stringify(["08:00"]),
      active: true,
    },
  });

  // 6. Zwierzę z czynnością pielęgnacyjną
  const pet = await prisma.pet.create({
    data: { name: "Fixture: zwierzę", species: "dog", ...(await wlasnoscDoZapisu(USER_ID)) },
  });
  await prisma.petCareTask.create({
    data: { petId: pet.id, title: "Fixture: karmienie", category: "FEEDING", nextDueAt: tegoMiesiaca(10), active: true },
  });

  // 7. Fiszka do powtórki (SRS)
  const deck = await prisma.languageDeck.create({
    data: { name: "Fixture: talia", nativeLang: "pl", targetLang: "en", ...(await wlasnoscDoZapisu(USER_ID)) },
  });
  await prisma.vocabulary.create({
    data: { deckId: deck.id, term: "fixture", translation: "atrapa", dueAt: tegoMiesiaca(11) },
  });

  console.log(`✓ Fixture 049: dane w siedmiu źródłach agendy dla użytkownika ${EMAIL}`);

  // ── Dane dla MIGAWKI PULPITU (050) — liczone względem DZISIAJ, nie miesiąca ──────────────
  await prisma.shoppingList.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.note.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.pantryItem.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.walletElement.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.storageItem.deleteMany({ where: { ...(await filtrMoichRekordow(USER_ID)) } });
  await prisma.report.deleteMany({ where: { authorId: USER_ID } });

  // 8. Lista zakupów z dwiema pozycjami do kupienia (`pendingItems`)
  const lista = await prisma.shoppingList.create({ data: { name: "Fixture: lista", ...(await wlasnoscDoZapisu(USER_ID)) } });
  await prisma.item.createMany({
    data: [
      { listId: lista.id, name: "Fixture: mleko", status: "NEEDED" },
      { listId: lista.id, name: "Fixture: chleb", status: "NEEDED" },
      { listId: lista.id, name: "Fixture: kupione", status: "DONE" },
    ],
  });

  // 9. Zadania: jedno na dziś, jedno zaległe (`todayTasks`, `overdueTasks`, `todayTaskPreview`)
  await prisma.task.create({
    data: { title: "Fixture: zadanie na dziś", createdById: USER_ID, dueDate: odDzis(0, 9), status: "TODO", priority: "HIGH" },
  });
  await prisma.task.create({
    data: { title: "Fixture: zadanie zaległe", createdById: USER_ID, dueDate: odDzis(-3, 9), status: "TODO" },
  });

  // 10. Przypięta notatka (`pinnedNotes`)
  await prisma.note.create({ data: { title: "Fixture: notatka", ...(await wlasnoscDoZapisu(USER_ID)), pinned: true } });

  // 11. Posiłek na DZIŚ + spiżarnia z krótkim terminem (`todayMeals`, `expiringSoon`)
  await prisma.mealPlanEntry.create({
    data: { date: odDzis(0), slot: "LUNCH", customTitle: "Fixture: lunch dziś", ...(await wlasnoscDoZapisu(USER_ID)) },
  });
  await prisma.pantryItem.create({
    data: { name: "Fixture: jogurt", ...(await wlasnoscDoZapisu(USER_ID)), quantity: 1, expiresAt: odDzis(2) },
  });

  // 12. Czynność pielęgnacyjna należna DZIŚ (`petCareDue`, `petAgenda`)
  await prisma.petCareTask.create({
    data: { petId: pet.id, title: "Fixture: karmienie dziś", category: "FEEDING", nextDueAt: odDzis(0), active: true },
  });

  // 13. Pojazd z przeglądem w horyzoncie 30 dni (`vehiclesCount`, `vehicleAlerts`)
  await prisma.vehicle.create({
    data: { name: "Fixture: auto 2", ...(await wlasnoscDoZapisu(USER_ID)), inspectionDue: odDzis(10) },
  });

  // 14. Element portfela (`wallet`)
  await prisma.walletElement.create({
    data: { name: "Fixture: konto", kind: "account", balance: 1234.5, ...(await wlasnoscDoZapisu(USER_ID)) },
  });

  // 15. Fiszka należna DZIŚ (`languagesDue`, `languageDecks`)
  await prisma.vocabulary.create({
    data: { deckId: deck.id, term: "dashboard", translation: "pulpit", dueAt: odDzis(-1) },
  });

  // 16. Wizyta nadchodząca (`healthUpcomingCount`, `healthUpcoming`)
  await prisma.healthEvent.create({
    data: { kind: "TEST", title: "Fixture: badanie", scheduledAt: odDzis(5, 10), ...(await wlasnoscDoZapisu(USER_ID)) },
  });

  // 17. Magazyn: brak stanu + krótki termin (`storageLowStock`, `storageExpiring`)
  await prisma.storageItem.create({
    data: { name: "Fixture: śruby", ...(await wlasnoscDoZapisu(USER_ID)), quantity: 1, minQuantity: 10 },
  });
  await prisma.storageItem.create({
    data: { name: "Fixture: klej", ...(await wlasnoscDoZapisu(USER_ID)), quantity: 5, expiresAt: odDzis(20) },
  });

  // 18. Raport z ostatnich 7 dni (`recentReports`)
  await prisma.report.create({
    data: { title: "Fixture: raport", slug: `fixture-050-${USER_ID}`, content: "# Fixture", authorId: USER_ID },
  });

  console.log("✓ Fixture 050: dane dla jedenastu wkładów migawki pulpitu");

  await prisma.$disconnect();
}

main();
