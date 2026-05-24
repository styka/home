import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — moduł Raporty (reports).
 * Read dla użytkowników (własne + publiczne + zespołowe), CRUD tylko admin.
 * Kategorie: architecture, refactoring, security, performance, ux, proposal, general.
 */
export const REPORTS_EPICS: EpicSeed[] = [
  {
    slug: "epic-reports-viewing",
    title: "Przeglądanie raportów",
    description: "Widoczność: własne + publiczne (authorId=null) + zespołowe.",
    stories: [
      {
        slug: "story-reports-user-view",
        title: "Widok użytkownika",
        scenarios: [
          {
            slug: "scenario-reports-list-visibility",
            title: "Lista pokazuje własne, publiczne i zespołowe",
            type: "positive",
            priority: "P1",
            pre: ["Istnieją raporty publiczne, Twoje i zespołowe oraz cudze prywatne"],
            steps: ["Otwórz `/reports`"],
            expected: [
              "Widoczne: authorId=Ty, authorId=null (publiczne), teamId w Twoich zespołach",
              "Cudze prywatne raporty nie są widoczne",
            ],
          },
          {
            slug: "scenario-reports-open-markdown",
            title: "Otwarcie raportu renderuje markdown",
            type: "positive",
            priority: "P1",
            pre: ["Istnieje dostępny raport"],
            steps: ["Otwórz `/reports/[slug]`"],
            expected: ["Treść renderowana jako markdown (markdownToHtml)", "Widoczna kategoria z kolorowym badge"],
          },
          {
            slug: "scenario-reports-forbidden",
            title: "Brak dostępu do cudzego prywatnego raportu",
            type: "negative",
            priority: "P0",
            pre: ["Istnieje prywatny raport innego użytkownika"],
            steps: ["Wejdź na `/reports/<cudzySlug>`"],
            expected: ["getUserReport rzuca błąd / brak dostępu"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-reports-admin",
    title: "Admin CRUD raportów",
    description: "Tworzenie, edycja, usuwanie raportów — tylko admin.",
    stories: [
      {
        slug: "story-reports-admin-crud",
        title: "Zarządzanie raportami",
        scenarios: [
          {
            slug: "scenario-reports-admin-create",
            title: "Utworzenie raportu",
            type: "positive",
            priority: "P1",
            pre: ["Zalogowany jako admin", "Jesteś na `/admin/reports/new`"],
            steps: ["Podaj tytuł, kategorię, treść markdown", "Zapisz"],
            expected: ["Slug generowany z tytułu (lowercase, spacje→myślniki)", "authorId ustawione na admina"],
          },
          {
            slug: "scenario-reports-admin-edit",
            title: "Edycja raportu",
            type: "positive",
            priority: "P2",
            pre: ["Istnieje raport"],
            steps: ["Otwórz edycję `/admin/reports/[slug]/edit`", "Zmień treść/kategorię", "Zapisz"],
            expected: ["Zmiany trwałe", "Walidacja: tytuł i treść wymagane"],
          },
          {
            slug: "scenario-reports-admin-delete",
            title: "Usunięcie raportu",
            type: "positive",
            priority: "P2",
            pre: ["Istnieje raport"],
            steps: ["Usuń raport (deleteReport)"],
            expected: ["Raport znika z `/admin/reports` i `/reports`"],
          },
          {
            slug: "scenario-reports-admin-only",
            title: "Nie-admin nie wejdzie do panelu raportów",
            type: "negative",
            priority: "P0",
            pre: ["Użytkownik bez `module.admin`"],
            steps: ["Wejdź na `/admin/reports`"],
            expected: ["Przekierowanie na `/` — CRUD wymaga PERMISSIONS.ADMIN"],
          },
        ],
      },
    ],
  },
];
