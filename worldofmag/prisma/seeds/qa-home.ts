import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — Strona główna (home, route "/").
 * Dashboard renderujący sekcje warunkowo per-uprawnienie.
 */
export const HOME_EPICS: EpicSeed[] = [
  {
    slug: "epic-home-dashboard",
    title: "Dashboard i snapshoty",
    description: "Sekcje renderowane warunkowo wg uprawnień użytkownika.",
    stories: [
      {
        slug: "story-home-snapshots",
        title: "Snapshoty modułów",
        scenarios: [
          {
            slug: "scenario-home-snapshots-filtered",
            title: "Widoczne tylko snapshoty modułów z uprawnieniem",
            type: "positive",
            priority: "P0",
            pre: ["Użytkownik ma np. `module.shopping` i `module.tasks`, ale nie `module.kitchen`"],
            steps: ["Otwórz `/`"],
            expected: [
              "ModuleSnapshotGrid pokazuje tylko kafle dostępnych modułów",
              "Brak kafla Kuchni (filtr przed renderem, nie „locked”)",
            ],
            notes: "Wzorzec: ukrywaj całe sekcje per-permission zamiast pokazywać wyszarzone.",
          },
          {
            slug: "scenario-home-tasks-badges",
            title: "Snapshot zadań pokazuje liczniki dziś/zaległe",
            type: "positive",
            priority: "P1",
            pre: ["Użytkownik z `module.tasks`", "Ma zadania na dziś i zaległe"],
            steps: ["Otwórz `/`"],
            expected: ["Kafel Zadań pokazuje liczbę „dziś” i czerwony badge zaległych (gdy > 0)", "Linki do `/tasks/today` i `/tasks/overdue`"],
          },
          {
            slug: "scenario-home-subtitle",
            title: "Kontekstowy podtytuł powitania",
            type: "positive",
            priority: "P2",
            pre: ["Użytkownik ma zaległe zadania"],
            steps: ["Otwórz `/`"],
            expected: [
              "Podtytuł wg priorytetu: zaległe > dziś > pozycje do kupienia > posiłki > stan zerowy",
              "Greeting zależny od pory dnia (Dzień dobry / Cześć / Dobry wieczór)",
            ],
          },
        ],
      },
      {
        slug: "story-home-widgets",
        title: "Widżety dodatkowe",
        scenarios: [
          {
            slug: "scenario-home-activity-feed",
            title: "Feed aktywności widoczny gdy są wpisy",
            type: "positive",
            priority: "P2",
            pre: ["Istnieją wpisy UserActivity"],
            steps: ["Otwórz `/`"],
            expected: ["Pokazuje ostatnie wpisy (do 20)", "Brak sekcji gdy 0 wpisów"],
          },
          {
            slug: "scenario-home-admin-widget",
            title: "Widżet admina tylko dla admina",
            type: "positive",
            priority: "P1",
            pre: ["Zalogowany jako admin"],
            steps: ["Otwórz `/`"],
            expected: ["AdminDashboardWidget pokazuje liczby użytkowników/zespołów/raportów + build info", "Dla nie-admina widżet nie renderuje się"],
          },
          {
            slug: "scenario-home-invitations-banner",
            title: "Baner zaproszeń tylko gdy są oczekujące",
            type: "positive",
            priority: "P2",
            pre: ["Użytkownik ma oczekujące zaproszenia do zespołu"],
            steps: ["Otwórz `/`"],
            expected: ["InvitationsBanner widoczny z linkiem do `/invitations`", "Brak banera gdy count=0"],
          },
        ],
      },
      {
        slug: "story-home-beta",
        title: "Gating beta",
        scenarios: [
          {
            slug: "scenario-home-beta-badge",
            title: "Odznaka beta dla BETA_TESTER (nie-admin)",
            type: "positive",
            priority: "P2",
            pre: ["Użytkownik z rolą BETA_TESTER i bez ADMIN"],
            steps: ["Otwórz `/`"],
            expected: ["Greeting pokazuje odznakę beta", "Dla admina odznaka się nie pokazuje"],
          },
          {
            slug: "scenario-home-no-permission",
            title: "Brak `module.home` przekierowuje",
            type: "negative",
            priority: "P1",
            pre: ["Użytkownik bez `module.home`"],
            steps: ["Wejdź na `/`"],
            expected: ["Strona główna zablokowana zgodnie z gating (isPathLocked dla `/`)"],
          },
        ],
      },
    ],
  },
];
