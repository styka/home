import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — Konsola Admin (admin).
 * Gate: module.admin. Sekcje: config, access (RBAC), categories, reports, playground, architecture.
 */
export const ADMIN_EPICS: EpicSeed[] = [
  {
    slug: "epic-admin-access-gating",
    title: "Dostęp do konsoli",
    description: "Gating całej sekcji /admin przez module.admin.",
    stories: [
      {
        slug: "story-admin-gating",
        title: "Ochrona tras admina",
        scenarios: [
          {
            slug: "scenario-admin-console-admin-only",
            title: "Konsola dostępna tylko dla admina",
            type: "positive",
            priority: "P0",
            pre: ["Zalogowany jako admin"],
            steps: ["Otwórz `/admin`"],
            expected: ["Widoczny dashboard z build info i linkami do sekcji", "Pokazuje e-mail/rolę/ID sesji"],
          },
          {
            slug: "scenario-admin-non-admin-blocked",
            title: "Nie-admin nie wejdzie do `/admin`",
            type: "negative",
            priority: "P0",
            pre: ["Użytkownik bez `module.admin`"],
            steps: ["Wejdź ręcznie na `/admin` i podstrony"],
            expected: ["Każda strona robi redirect(\"/\") przy braku PERMISSIONS.ADMIN"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-admin-rbac",
    title: "RBAC — uprawnienia i role",
    description: "Zarządzanie Permission, RolePermission, UserRole.",
    stories: [
      {
        slug: "story-admin-permissions",
        title: "Uprawnienia",
        scenarios: [
          {
            slug: "scenario-admin-permission-crud",
            title: "Tworzenie i edycja uprawnienia",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś na `/admin/access`"],
            steps: ["Utwórz uprawnienie (slug, nazwa, opis)", "Edytuj jego nazwę/opis"],
            expected: ["Permission zapisany (slug unikalny)", "Widoczny na liście uprawnień"],
          },
          {
            slug: "scenario-admin-toggle-role-permission",
            title: "Przypisanie uprawnienia do roli",
            type: "positive",
            priority: "P0",
            pre: ["Istnieje uprawnienie i rola"],
            steps: ["Przełącz uprawnienie dla roli (toggleRolePermission)"],
            expected: ["RolePermission dodany/usunięty", "Użytkownicy z rolą zyskują/tracą dostęp (po odświeżeniu sesji)"],
          },
        ],
      },
      {
        slug: "story-admin-user-roles",
        title: "Role użytkowników",
        scenarios: [
          {
            slug: "scenario-admin-add-user-role",
            title: "Nadanie roli użytkownikowi",
            type: "positive",
            priority: "P0",
            pre: ["Jesteś na `/admin/access`", "Istnieje inny użytkownik"],
            steps: ["Dodaj rolę (np. TESTER) użytkownikowi (addUserRole)"],
            expected: ["UserRole upsert (bez duplikatu)", "Rola pojawia się przy użytkowniku"],
            notes: "getAvailableRoles zwraca też wbudowane: ADMIN, USER, BETA_TESTER, TESTER.",
          },
          {
            slug: "scenario-admin-remove-user-role",
            title: "Odebranie roli użytkownikowi",
            type: "positive",
            priority: "P1",
            pre: ["Użytkownik ma przypisaną rolę"],
            steps: ["Usuń rolę (removeUserRole)"],
            expected: ["UserRole usunięty", "Użytkownik traci powiązane uprawnienia"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-admin-config-categories",
    title: "Konfiguracja i kategorie systemowe",
    description: "Config key-value + globalne kategorie.",
    stories: [
      {
        slug: "story-admin-config",
        title: "Konfiguracja systemu",
        scenarios: [
          {
            slug: "scenario-admin-config-groq",
            title: "Zapis klucza Groq API",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś na `/admin/config`"],
            steps: ["Wprowadź klucz groq_api_key", "Zapisz (setConfigValue)"],
            expected: ["Wartość zapisana w Config (klucz unikalny, upsert)", "Odczyt przez getConfigValue"],
          },
        ],
      },
      {
        slug: "story-admin-system-categories",
        title: "Kategorie systemowe",
        scenarios: [
          {
            slug: "scenario-admin-system-category-create",
            title: "Utworzenie kategorii systemowej",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś na `/admin/categories`"],
            steps: ["Utwórz kategorię systemową (userId=null, teamId=null)"],
            expected: ["Kategoria widoczna dla wszystkich użytkowników jako bazowa (isBase)"],
          },
          {
            slug: "scenario-admin-system-category-update-cascade",
            title: "Edycja kategorii aktualizuje przypisane produkty",
            type: "positive",
            priority: "P2",
            pre: ["Istnieje kategoria systemowa z przypisanymi produktami"],
            steps: ["Zmień nazwę kategorii (updateSystemCategory)"],
            expected: ["Referencje Product.category zaktualizowane wraz z nazwą"],
          },
          {
            slug: "scenario-admin-system-category-delete",
            title: "Usunięcie kategorii systemowej",
            type: "positive",
            priority: "P2",
            pre: ["Istnieje kategoria systemowa"],
            steps: ["Usuń kategorię (deleteSystemCategory)"],
            expected: ["Kategoria usunięta", "Warianty ikon archiwizowane do „__library__”"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-admin-tools",
    title: "Narzędzia deweloperskie",
    description: "Playground i dokument architektury.",
    stories: [
      {
        slug: "story-admin-dev-tools",
        title: "Playground i architektura",
        scenarios: [
          {
            slug: "scenario-admin-playground",
            title: "Playground komponentów",
            type: "positive",
            priority: "P2",
            pre: ["Jesteś na `/admin/playground`"],
            steps: ["Przejrzyj prezentację komponentów UI"],
            expected: ["Komponenty renderują się poprawnie do przeglądu"],
          },
          {
            slug: "scenario-admin-architecture",
            title: "Dokument architektury",
            type: "positive",
            priority: "P2",
            pre: ["Jesteś na `/admin/architecture`"],
            steps: ["Przejrzyj sekcje (stack, struktura, auth, schema, skróty)"],
            expected: ["Dokument wyświetla się czytelnie"],
          },
        ],
      },
    ],
  },
];
