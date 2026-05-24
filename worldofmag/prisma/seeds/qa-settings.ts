import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — Ustawienia (settings).
 * Profil + lista zespołów + wylogowanie.
 */
export const SETTINGS_EPICS: EpicSeed[] = [
  {
    slug: "epic-settings-profile",
    title: "Profil i sesja",
    description: "Dane profilu, wylogowanie.",
    stories: [
      {
        slug: "story-settings-profile",
        title: "Profil użytkownika",
        scenarios: [
          {
            slug: "scenario-settings-profile-display",
            title: "Wyświetlenie danych profilu",
            type: "positive",
            priority: "P1",
            pre: ["Zalogowany użytkownik", "Jesteś na `/settings`"],
            steps: ["Przejrzyj sekcję profilu"],
            expected: ["Widoczny avatar, imię i e-mail z sesji"],
          },
          {
            slug: "scenario-settings-logout",
            title: "Wylogowanie",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś na `/settings`"],
            steps: ["Kliknij „Wyloguj”"],
            expected: ["Sesja zakończona", "Przekierowanie na `/auth/signin`"],
          },
        ],
      },
      {
        slug: "story-settings-teams",
        title: "Lista zespołów",
        scenarios: [
          {
            slug: "scenario-settings-teams-list",
            title: "Lista zespołów z licznikami",
            type: "positive",
            priority: "P2",
            pre: ["Należysz do kilku zespołów"],
            steps: ["Przejrzyj sekcję zespołów na `/settings`"],
            expected: ["Karty zespołów z nazwą, opisem i liczbą członków (getMyTeams)", "Przycisk „Nowy team” → `/settings/team/new`"],
          },
          {
            slug: "scenario-settings-team-open",
            title: "Wejście w szczegóły zespołu",
            type: "positive",
            priority: "P2",
            pre: ["Należysz do zespołu"],
            steps: ["Kliknij zespół → `/settings/team/[teamId]`"],
            expected: ["Szczegóły: członkowie, zaproszenia, pod-zespoły, opcje wg roli"],
          },
        ],
      },
    ],
  },
];
