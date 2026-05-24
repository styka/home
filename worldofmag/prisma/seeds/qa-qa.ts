import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — sam moduł QA (meta).
 * Dostęp: ADMIN i TESTER (module.qa). CRUD scenariuszy: tylko admin.
 */
export const QA_META_EPICS: EpicSeed[] = [
  {
    slug: "epic-qa-access",
    title: "Dostęp do działu QA",
    description: "Gating przez module.qa dla ról ADMIN i TESTER.",
    stories: [
      {
        slug: "story-qa-access",
        title: "Uprawnienia QA",
        scenarios: [
          {
            slug: "scenario-qa-tester-access",
            title: "TESTER widzi dział QA",
            type: "positive",
            priority: "P0",
            pre: ["Użytkownik z rolą TESTER (ma `module.qa`)"],
            steps: ["Sprawdź sidebar", "Otwórz `/qa`"],
            expected: ["Pozycja „QA” (ikona probówki) widoczna i klikalna", "Centrum QA ładuje statystyki i moduły"],
          },
          {
            slug: "scenario-qa-no-permission",
            title: "Brak `module.qa` — kłódka i blokada",
            type: "negative",
            priority: "P0",
            pre: ["Użytkownik bez ADMIN i bez TESTER"],
            steps: ["Sprawdź sidebar", "Wejdź ręcznie na `/qa`"],
            expected: ["Pozycja „QA” wyszarzona z kłódką", "Bezpośredni URL przekierowuje na stronę główną"],
          },
          {
            slug: "scenario-qa-tester-no-admin-crud",
            title: "TESTER nie ma dostępu do panelu admina QA",
            type: "negative",
            priority: "P1",
            pre: ["Użytkownik z TESTER, bez ADMIN"],
            steps: ["Wejdź na `/admin/qa`"],
            expected: ["Przekierowanie na `/` — CRUD scenariuszy wymaga module.admin"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-qa-browsing",
    title: "Przeglądanie scenariuszy",
    description: "Centrum QA, drzewo modułu, pełny scenariusz.",
    stories: [
      {
        slug: "story-qa-browse",
        title: "Nawigacja po scenariuszach",
        scenarios: [
          {
            slug: "scenario-qa-module-tree",
            title: "Drzewo modułu Epic → Story → Scenariusz",
            type: "positive",
            priority: "P1",
            pre: ["Moduł ma zaseedowane scenariusze (np. shopping)"],
            steps: ["Otwórz `/qa/shopping`", "Rozwiń epiki i user stories"],
            expected: ["Hierarchia rozwijalna", "Scenariusze z badge'ami typu i priorytetu"],
          },
          {
            slug: "scenario-qa-scenario-fullscreen",
            title: "Pełnoekranowy widok scenariusza",
            type: "positive",
            priority: "P1",
            pre: ["Istnieje scenariusz"],
            steps: ["Kliknij scenariusz → `/qa/scenariusz/[slug]`"],
            expected: [
              "Markdown z warunkami, krokami, oczekiwanym rezultatem",
              "Breadcrumb (Moduł › Epic › Story)",
              "Nawigacja poprzedni/następny w obrębie story",
            ],
          },
          {
            slug: "scenario-qa-home-stats",
            title: "Centrum QA pokazuje statystyki i placeholdery",
            type: "positive",
            priority: "P2",
            pre: ["Część modułów ma scenariusze, część nie"],
            steps: ["Otwórz `/qa`"],
            expected: [
              "Statystyki: liczba scenariuszy/epików/stories/modułów",
              "Moduły bez scenariuszy oznaczone „Brak scenariuszy”",
              "Sekcja „Wkrótce” (test runs, bugi, statystyki, środowiska)",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-qa-admin-crud",
    title: "Admin CRUD scenariuszy",
    description: "Tworzenie i edycja epików, user stories, scenariuszy.",
    stories: [
      {
        slug: "story-qa-admin-crud",
        title: "Zarządzanie treścią QA",
        scenarios: [
          {
            slug: "scenario-qa-admin-create-hierarchy",
            title: "Utworzenie epica, story i scenariusza",
            type: "positive",
            priority: "P1",
            pre: ["Zalogowany jako admin", "Jesteś na `/admin/qa`"],
            steps: ["Dodaj epic dla modułu", "Dodaj user story", "Dodaj scenariusz z treścią markdown"],
            expected: ["Elementy zapisane z auto-generowanym slugiem", "Widoczne w drzewie i w `/qa/<module>`"],
          },
          {
            slug: "scenario-qa-admin-edit-preview",
            title: "Edycja scenariusza z podglądem markdown",
            type: "positive",
            priority: "P2",
            pre: ["Istnieje scenariusz"],
            steps: ["Otwórz edycję", "Przełącz podgląd markdown", "Zmień typ/priorytet/treść", "Zapisz"],
            expected: ["Podgląd renderuje markdown", "Zmiany trwałe po zapisie"],
          },
          {
            slug: "scenario-qa-admin-delete-cascade",
            title: "Usunięcie epica kasuje stories i scenariusze",
            type: "positive",
            priority: "P2",
            pre: ["Epic ma user stories i scenariusze"],
            steps: ["Usuń epic (deleteEpic) z potwierdzeniem"],
            expected: ["Epic, jego stories i scenariusze usunięte kaskadowo (onDelete: Cascade)"],
          },
        ],
      },
    ],
  },
];
