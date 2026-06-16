"use server";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/ownership";
import { purgeUserData } from "@/lib/privacy/purge";
import { signOut } from "@/lib/auth";

/**
 * Z-050 (RODO art. 15/20) — eksport danych użytkownika.
 *
 * Zbiera komplet rekordów, których użytkownik jest właścicielem (`ownerId`/`userId`
 * /`createdById`/`clientId`/`senderId`), ze wszystkich modułów, wraz z kluczowymi
 * dziećmi (pozycje list, składniki przepisów, wpisy portfela, słownictwo itd.).
 *
 * Zasady prywatności (plan A.3):
 * - eksportujemy tylko dane WŁASNE użytkownika; danych zespołu (ownerTeamId) tu nie
 *   wciągamy bez kontekstu — user dostaje je przez zespół, nie przez ten eksport;
 * - nie eksportujemy sekretów uwierzytelniania (tokeny OAuth kont) — tylko fakt
 *   istnienia połączenia (provider).
 */
export interface UserDataExport {
  meta: {
    format: "omnia-user-export";
    version: 1;
    exportedAt: string;
    userId: string;
    note: string;
  };
  [section: string]: unknown;
}

export async function exportMyData(): Promise<UserDataExport> {
  const userId = await requireUserId();
  const own = { ownerId: userId } as const;
  const byUser = { userId } as const;

  const [
    profile,
    accounts,
    ownedTeams,
    teamMemberships,
    // shopping
    shoppingLists,
    products,
    units,
    categories,
    stores,
    categoryIcons,
    // tasks
    taskProjects,
    projectGroups,
    tasksCreated,
    // notes
    notes,
    noteGroups,
    // kitchen
    recipes,
    cookbooks,
    mealPlans,
    pantryItems,
    recipeRatings,
    // pets
    pets,
    petEnclosures,
    petBreedingPairs,
    petSales,
    // health
    healthEvents,
    medicationSchedules,
    // habits
    habits,
    // flota
    vehicles,
    vehicleProfile,
    // portfel
    walletElements,
    budgets,
    financeGoals,
    financeSettings,
    exchangeRates,
    // languages
    languageDecks,
    // news / weather
    newsSources,
    newsTopics,
    newsPref,
    weatherLocations,
    weatherWatchers,
    // storage / warsztaty
    storageItems,
    storageSuppliers,
    storageDocuments,
    storageOrders,
    storageSettings,
    workshops,
    warsztatSettings,
    // services
    serviceProvider,
    serviceCategories,
    serviceRequests,
    serviceReviews,
    serviceFavorites,
    sentServiceMessages,
    // crm / ai / prefs / system
    contacts,
    aiConversations,
    notifications,
    trashItems,
    dashboardPref,
    menuPref,
    skinPref,
    ownedSkins,
    userActivity,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, avatarUrl: true, role: true, createdAt: true, updatedAt: true },
    }),
    prisma.account.findMany({ where: byUser, select: { provider: true, type: true, providerAccountId: true } }),
    prisma.team.findMany({ where: own }),
    prisma.teamMember.findMany({ where: byUser }),
    // shopping
    prisma.shoppingList.findMany({ where: own, include: { items: true } }),
    prisma.product.findMany({ where: byUser }),
    prisma.unit.findMany({ where: byUser }),
    prisma.category.findMany({ where: byUser }),
    prisma.store.findMany({ where: own, include: { nodes: true, edges: true } }),
    prisma.categoryIconVariant.findMany({ where: byUser }),
    // tasks
    prisma.taskProject.findMany({ where: own, include: { tasks: { include: { tags: true, comments: true } } } }),
    prisma.projectGroup.findMany({ where: own }),
    prisma.task.findMany({ where: { createdById: userId, projectId: null } }),
    // notes
    prisma.note.findMany({ where: own, include: { tags: true, attachments: true, revisions: true } }),
    prisma.noteGroup.findMany({ where: { notes: { some: { ownerId: userId } } } }),
    // kitchen
    prisma.recipe.findMany({ where: own, include: { ingredients: true, steps: true, tags: true, ratings: true } }),
    prisma.cookbook.findMany({ where: own }),
    prisma.mealPlanEntry.findMany({ where: own }),
    prisma.pantryItem.findMany({ where: own }),
    prisma.recipeRating.findMany({ where: byUser }),
    // pets
    prisma.pet.findMany({
      where: own,
      include: { measurements: true, healthRecords: true, vetVisits: true, treatments: true, careTasks: true, careLogs: true },
    }),
    prisma.petEnclosure.findMany({ where: own }),
    prisma.petBreedingPair.findMany({ where: own }),
    prisma.petSale.findMany({ where: own }),
    // health
    prisma.healthEvent.findMany({ where: own, include: { attachments: true } }),
    prisma.medicationSchedule.findMany({ where: own, include: { logs: true } }),
    // habits
    prisma.habit.findMany({ where: own, include: { entries: true } }),
    // flota
    prisma.vehicle.findMany({ where: own, include: { fuelLogs: true, services: true, attachments: true } }),
    prisma.vehicleProfile.findUnique({ where: { userId } }),
    // portfel
    prisma.walletElement.findMany({ where: own, include: { entries: true } }),
    prisma.budget.findMany({ where: own }),
    prisma.financeGoal.findMany({ where: own }),
    prisma.financeSettings.findUnique({ where: { userId } }),
    prisma.exchangeRate.findMany({ where: byUser }),
    // languages
    prisma.languageDeck.findMany({ where: own, include: { cards: true } }),
    // news / weather
    prisma.newsSource.findMany({ where: own }),
    prisma.newsTopic.findMany({ where: own, include: { knowledge: true } }),
    prisma.newsPref.findUnique({ where: { ownerId: userId } }),
    prisma.weatherLocation.findMany({ where: own }),
    prisma.weatherWatcher.findMany({ where: own }),
    // storage / warsztaty
    prisma.storageItem.findMany({ where: own, include: { movements: true, batches: true } }),
    prisma.storageSupplier.findMany({ where: own }),
    prisma.storageDocument.findMany({ where: own, include: { lines: true } }),
    prisma.storagePurchaseOrder.findMany({ where: own, include: { lines: true } }),
    prisma.storageSettings.findUnique({ where: { userId } }),
    prisma.workshop.findMany({ where: own, include: { items: true, projects: true } }),
    prisma.warsztatSettings.findUnique({ where: { userId } }),
    // services
    prisma.serviceProvider.findUnique({ where: { userId }, include: { listings: true, availability: true, staff: true } }),
    prisma.serviceCategory.findMany({ where: byUser }),
    prisma.serviceRequest.findMany({ where: { clientId: userId }, include: { messages: true, quotes: true, review: true } }),
    prisma.serviceReview.findMany({ where: { authorId: userId } }),
    prisma.serviceFavorite.findMany({ where: byUser }),
    prisma.serviceMessage.findMany({ where: { senderId: userId } }),
    // crm / ai / prefs / system
    prisma.contact.findMany({ where: own }),
    prisma.aiConversation.findMany({ where: byUser, include: { messages: true } }),
    prisma.notification.findMany({ where: byUser }),
    prisma.trashItem.findMany({ where: byUser }),
    prisma.dashboardPref.findUnique({ where: { userId } }),
    prisma.userMenuPref.findUnique({ where: { userId } }),
    prisma.userSkinPref.findUnique({ where: { userId } }),
    prisma.skin.findMany({ where: own }),
    prisma.userActivity.findMany({ where: byUser, take: 1000, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    meta: {
      format: "omnia-user-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      userId,
      note:
        "Eksport zawiera dane, których jesteś właścicielem (RODO art. 15/20). Dane zespołów oraz sekrety uwierzytelniania (tokeny) nie są tu zawarte.",
    },
    profile,
    accounts,
    teams: { owned: ownedTeams, memberships: teamMemberships },
    shopping: { lists: shoppingLists, products, units, categories, stores, categoryIcons },
    tasks: { projects: taskProjects, projectGroups, personalTasks: tasksCreated },
    notes: { notes, groups: noteGroups },
    kitchen: { recipes, cookbooks, mealPlans, pantryItems, recipeRatings },
    pets: { pets, enclosures: petEnclosures, breedingPairs: petBreedingPairs, sales: petSales },
    health: { events: healthEvents, medicationSchedules },
    habits,
    flota: { vehicles, vehicleProfile },
    portfel: { walletElements, budgets, financeGoals, financeSettings, exchangeRates },
    languages: { decks: languageDecks },
    news: { sources: newsSources, topics: newsTopics, pref: newsPref },
    weather: { locations: weatherLocations, watchers: weatherWatchers },
    magazynowanie: { items: storageItems, suppliers: storageSuppliers, documents: storageDocuments, orders: storageOrders, settings: storageSettings },
    warsztaty: { workshops, settings: warsztatSettings },
    services: { provider: serviceProvider, categories: serviceCategories, requestsAsClient: serviceRequests, reviews: serviceReviews, favorites: serviceFavorites, sentMessages: sentServiceMessages },
    contacts,
    ai: { conversations: aiConversations },
    system: { notifications, trashItems, dashboardPref, menuPref, skinPref, ownedSkins, recentActivity: userActivity },
  };
}

/**
 * Z-051 (RODO art. 17) — twarde usunięcie konta.
 *
 * Potwierdzenie: użytkownik musi wpisać swój adres e-mail. Konta będące
 * właścicielem zespołów są blokowane (dane współdzielone wymagają przekazania
 * własności — decyzja użytkownika, wzorzec graceful degradation). Po usunięciu
 * danych wylogowujemy (strategia sesji = JWT, więc trzeba wyczyścić cookie).
 */
export async function deleteMyAccount(confirmation: string): Promise<void> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new Error("Nie znaleziono konta.");

  const expected = (user.email ?? "").trim().toLowerCase();
  if (!expected || confirmation.trim().toLowerCase() !== expected) {
    throw new Error("Potwierdzenie nie pasuje do adresu e-mail konta.");
  }

  const ownedTeams = await prisma.team.count({ where: { ownerId: userId } });
  if (ownedTeams > 0) {
    throw new Error(
      "To konto jest właścicielem zespołu/zespołów. Najpierw przekaż własność lub usuń swoje zespoły (Ustawienia → Zespoły) — chronimy w ten sposób dane współdzielone z innymi członkami.",
    );
  }

  await purgeUserData(userId);

  // JWT: usunięcie rekordu User nie unieważnia ciasteczka — wymuszamy wylogowanie.
  await signOut({ redirectTo: "/auth/signin?deleted=1" });
}
