import { prisma } from "./db";
import { E2E_ADMIN } from "./users";

/**
 * 085 — dane Pogody dla klikacza.
 *
 * Sekcja obserwatorów w ogóle się nie renderuje bez lokalizacji i obserwatorów, a `prisma/seed.ts`
 * ich nie zakłada (moduł powstał później). Bez tego kryteria AC-18, AC-21 i AC-22 dałoby się
 * sprawdzić wyłącznie z lektury kodu — czyli nie dałoby się ich sprawdzić.
 *
 * Świadomie NIE zakładamy werdyktów: ocena obserwatorów to wywołanie modelu, a przedmiotem testu
 * jest UKŁAD paska, nie treść oceny. Panel rysuje listę i pasek także przed oceną (sterowanie jest
 * wtedy nieaktywne z podpowiedzią) — i to wystarczy, żeby zmierzyć wysokość i policzyć chipsy.
 */
export async function ensurePogodaFixtures(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: E2E_ADMIN.email } });
  if (!user) throw new Error("Brak użytkownika E2E — uruchom ensureE2EFixtures() najpierw");
  const przestrzen = await prisma.workspace.findFirst({ where: { personalUserId: user.id } });
  if (!przestrzen) throw new Error("Brak przestrzeni osobistej użytkownika E2E");

  const istnieje = await prisma.weatherLocation.findFirst({ where: { workspaceId: przestrzen.id } });
  if (!istnieje) {
    await prisma.weatherLocation.create({
      data: { workspaceId: przestrzen.id, label: "Kraków", lat: 50.06, lon: 19.94, isDefault: true },
    });
  }

  // Cztery obserwatory: tyle, ile było stanów w skasowanym pasku chipsów — czyli dokładnie tyle,
  // ile potrzeba, żeby stara wersja paska łamała się na drugą linię przy 360 px.
  const ile = await prisma.weatherWatcher.count({ where: { workspaceId: przestrzen.id } });
  if (ile === 0) {
    await prisma.weatherWatcher.createMany({
      data: [
        { workspaceId: przestrzen.id, title: "Rower po pracy", kind: "custom", query: "sucho i ciepło po 17", horizon: "today", sortOrder: 0 },
        { workspaceId: przestrzen.id, title: "Weekend w górach", kind: "custom", query: "bez opadów w sobotę", horizon: "weekend", sortOrder: 1 },
        { workspaceId: przestrzen.id, title: "Burze", kind: "custom", query: "burze w okolicy", horizon: "week", sortOrder: 2 },
        { workspaceId: przestrzen.id, title: "Mróz nocą", kind: "custom", query: "temperatura poniżej zera w nocy", horizon: "week", sortOrder: 3 },
      ],
    });
  }
}
