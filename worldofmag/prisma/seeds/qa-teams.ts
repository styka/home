import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — Zespoły (teams) i zaproszenia (invitations).
 * Role: OWNER > ADMIN > MEMBER. Zaproszenia: PENDING/ACCEPTED/REJECTED.
 */
export const TEAMS_EPICS: EpicSeed[] = [
  {
    slug: "epic-teams-crud",
    title: "Zarządzanie zespołami",
    description: "Tworzenie, edycja, usuwanie, pod-zespoły.",
    stories: [
      {
        slug: "story-teams-create",
        title: "Tworzenie zespołu",
        scenarios: [
          {
            slug: "scenario-teams-create",
            title: "Utworzenie zespołu",
            type: "positive",
            priority: "P0",
            pre: ["Zalogowany użytkownik", "Jesteś na `/settings/team/new`"],
            steps: ["Podaj nazwę (wymagana) i opis", "Utwórz (createTeam)"],
            expected: ["Zespół powstaje", "Twórca automatycznie jako OWNER (TeamMember)"],
          },
          {
            slug: "scenario-teams-create-empty-name",
            title: "Nazwa zespołu jest wymagana",
            type: "negative",
            priority: "P1",
            pre: ["Formularz tworzenia zespołu"],
            steps: ["Zostaw nazwę pustą", "Zatwierdź"],
            expected: ["Zespół nie powstaje"],
          },
        ],
      },
      {
        slug: "story-teams-edit-delete",
        title: "Edycja i usuwanie",
        scenarios: [
          {
            slug: "scenario-teams-edit-admin",
            title: "Edycja zespołu wymaga ADMIN",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś ADMIN/OWNER zespołu"],
            steps: ["Zmień nazwę/opis/avatar (updateTeam)"],
            expected: ["Zmiany zapisane", "MEMBER nie może edytować"],
          },
          {
            slug: "scenario-teams-delete-owner",
            title: "Usunięcie zespołu tylko przez OWNER",
            type: "negative",
            priority: "P1",
            pre: ["Jesteś ADMIN (nie OWNER)"],
            steps: ["Spróbuj usunąć zespół"],
            expected: ["Operacja odrzucona — deleteTeam wymaga OWNER"],
          },
          {
            slug: "scenario-teams-delete-blocked-by-lists",
            title: "Nie można usunąć zespołu posiadającego listy",
            type: "negative",
            priority: "P1",
            pre: ["Zespół jest właścicielem list zakupowych", "Jesteś OWNER"],
            steps: ["Spróbuj usunąć zespół"],
            expected: ["Usunięcie zablokowane dopóki zespół ma zasoby (np. listy zakupowe)"],
          },
        ],
      },
      {
        slug: "story-teams-subteams",
        title: "Pod-zespoły",
        scenarios: [
          {
            slug: "scenario-teams-subteam-create",
            title: "Utworzenie pod-zespołu",
            type: "positive",
            priority: "P2",
            pre: ["Jesteś ADMIN zespołu nadrzędnego"],
            steps: ["Utwórz pod-zespół (createSubTeam)"],
            expected: ["Pod-zespół z parentTeamId", "Twórca jest OWNER pod-zespołu"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-teams-members",
    title: "Członkowie zespołu",
    description: "Role, usuwanie, opuszczanie, przekazanie własności.",
    stories: [
      {
        slug: "story-teams-roles",
        title: "Zarządzanie rolami",
        scenarios: [
          {
            slug: "scenario-teams-change-role-owner",
            title: "Zmiana roli członka tylko przez OWNER",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś OWNER", "Zespół ma członków"],
            steps: ["Zmień rolę członka na ADMIN/MEMBER (changeMemberRole)"],
            expected: ["Rola zaktualizowana", "Nie można zmienić własnej roli"],
          },
          {
            slug: "scenario-teams-remove-member-rules",
            title: "ADMIN nie usunie OWNER ani innego ADMIN",
            type: "negative",
            priority: "P1",
            pre: ["Jesteś ADMIN"],
            steps: ["Spróbuj usunąć OWNER lub innego ADMIN (removeMember)"],
            expected: ["Operacja odrzucona — ochrona OWNER i ADMIN"],
          },
          {
            slug: "scenario-teams-transfer-ownership",
            title: "Przekazanie własności zespołu",
            type: "positive",
            priority: "P2",
            pre: ["Jesteś OWNER"],
            steps: ["Przekaż własność innemu członkowi (transferTeamOwnership)"],
            expected: ["Nowy członek = OWNER", "Dotychczasowy OWNER staje się ADMIN"],
          },
          {
            slug: "scenario-teams-leave-owner-blocked",
            title: "OWNER nie może opuścić zespołu",
            type: "negative",
            priority: "P2",
            pre: ["Jesteś OWNER"],
            steps: ["Spróbuj opuścić zespół (leaveTeam)"],
            expected: ["Operacja zablokowana — OWNER musi najpierw przekazać własność"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-teams-invitations",
    title: "Zaproszenia",
    description: "Wysyłanie, akceptacja, odrzucenie zaproszeń.",
    stories: [
      {
        slug: "story-teams-invite",
        title: "Przepływ zaproszeń",
        scenarios: [
          {
            slug: "scenario-teams-invite-send",
            title: "Wysłanie zaproszenia istniejącemu użytkownikowi",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś ADMIN/OWNER", "Adresat istnieje w bazie"],
            steps: ["Zaproś po e-mailu (inviteUser)"],
            expected: ["Zaproszenie PENDING", "Powtórne zaproszenie robi upsert (bez duplikatu)"],
          },
          {
            slug: "scenario-teams-invite-unknown",
            title: "Zaproszenie nieistniejącego użytkownika",
            type: "negative",
            priority: "P2",
            pre: ["Jesteś ADMIN/OWNER"],
            steps: ["Podaj e-mail spoza bazy"],
            expected: ["Błąd — adresat musi istnieć w systemie"],
          },
          {
            slug: "scenario-teams-invite-accept",
            title: "Akceptacja zaproszenia",
            type: "positive",
            priority: "P0",
            pre: ["Masz oczekujące zaproszenie", "Jesteś na `/invitations`"],
            steps: ["Zaakceptuj (acceptInvitation)"],
            expected: ["Powstaje TeamMember z rolą MEMBER", "Zaproszenie → ACCEPTED", "Licznik zaproszeń maleje"],
          },
          {
            slug: "scenario-teams-invite-reject",
            title: "Odrzucenie zaproszenia",
            type: "positive",
            priority: "P2",
            pre: ["Masz oczekujące zaproszenie"],
            steps: ["Odrzuć (rejectInvitation)"],
            expected: ["Zaproszenie → REJECTED", "Nie dołączasz do zespołu"],
          },
        ],
      },
    ],
  },
];
