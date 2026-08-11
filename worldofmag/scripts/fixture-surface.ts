/**
 * 049/T-1 — SYNTETYCZNE DANE do porównania agregatu kalendarza „przed" i „po".
 *
 * Zwykły seed tworzy uprawnienia, konfigurację i scenariusze QA, ale **żadnych danych
 * użytkownika** — konta powstają dopiero przez OAuth. Bez danych agregat kalendarza zwraca zero
 * zdarzeń, więc porównanie „przed/po" niczego by nie dowiodło: pusty wynik zgadza się z pustym
 * wynikiem nawet wtedy, gdy przebudowa zgubiła połowę źródeł.
 *
 * Ten fixture zakłada po jednym zdarzeniu w **każdym** z sześciu źródeł, które składają się na
 * wspólną agendę. Uruchamiany ręcznie, wyłącznie przeciw lokalnej bazie (C-13), idempotentny
 * (stały identyfikator użytkownika, `deleteMany` przed wstawieniem).
 *
 *   npx tsx scripts/fixture-calendar-surface.ts
 */
import { prisma } from "../src/platform/db/prisma";

const USER_ID = "fixture-049-kalendarz";
const EMAIL = "fixture-049@local.test";

function tegoMiesiaca(dzien: number, godzina = 12): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), dzien, godzina, 0, 0, 0);
}

async function main() {
  if (/neon\.tech|render\.com/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("C-13: fixture wolno odpalać wyłącznie na lokalnej bazie.");
  }

  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: { id: USER_ID, email: EMAIL, name: "Fixture 049", role: "USER" },
  });

  // Sprzątanie przed wstawieniem — fixture ma dawać ten sam wynik przy każdym uruchomieniu.
  await prisma.task.deleteMany({ where: { createdById: USER_ID } });
  await prisma.mealPlanEntry.deleteMany({ where: { ownerId: USER_ID } });
  await prisma.healthEvent.deleteMany({ where: { ownerId: USER_ID } });
  await prisma.vehicle.deleteMany({ where: { ownerId: USER_ID } });
  await prisma.medicationSchedule.deleteMany({ where: { ownerId: USER_ID } });
  await prisma.pet.deleteMany({ where: { ownerId: USER_ID } });
  await prisma.languageDeck.deleteMany({ where: { ownerId: USER_ID } });

  // 1. Zadanie z terminem
  await prisma.task.create({
    data: { title: "Fixture: zadanie z terminem", createdById: USER_ID, dueDate: tegoMiesiaca(5, 9), status: "TODO" },
  });

  // 2. Posiłek w planie
  await prisma.mealPlanEntry.create({
    data: { date: tegoMiesiaca(6), slot: "DINNER", customTitle: "Fixture: obiad", ownerId: USER_ID },
  });

  // 3. Wizyta / badanie
  await prisma.healthEvent.create({
    data: { kind: "VISIT", title: "Fixture: wizyta", scheduledAt: tegoMiesiaca(7, 10), ownerId: USER_ID },
  });

  // 4. Pojazd z przeglądem i ubezpieczeniem
  await prisma.vehicle.create({
    data: {
      name: "Fixture: auto",
      ownerId: USER_ID,
      inspectionDue: tegoMiesiaca(8),
      insuranceDue: tegoMiesiaca(9),
    },
  });

  // 5. Lek (cykliczny — agenda liczy z niego sloty)
  await prisma.medicationSchedule.create({
    data: {
      kind: "MEDICATION",
      name: "Fixture: lek",
      ownerId: USER_ID,
      freqType: "DAILY",
      interval: 1,
      startDate: tegoMiesiaca(1),
      timesOfDay: JSON.stringify(["08:00"]),
      active: true,
    },
  });

  // 6. Zwierzę z czynnością pielęgnacyjną
  const pet = await prisma.pet.create({
    data: { name: "Fixture: zwierzę", species: "dog", ownerId: USER_ID },
  });
  await prisma.petCareTask.create({
    data: { petId: pet.id, title: "Fixture: karmienie", category: "FEEDING", nextDueAt: tegoMiesiaca(10), active: true },
  });

  // 7. Fiszka do powtórki (SRS)
  const deck = await prisma.languageDeck.create({
    data: { name: "Fixture: talia", nativeLang: "pl", targetLang: "en", ownerId: USER_ID },
  });
  await prisma.vocabulary.create({
    data: { deckId: deck.id, term: "fixture", translation: "atrapa", dueAt: tegoMiesiaca(11) },
  });

  console.log(`✓ Fixture 049: dane w siedmiu źródłach agendy dla użytkownika ${EMAIL}`);
  await prisma.$disconnect();
}

main();
