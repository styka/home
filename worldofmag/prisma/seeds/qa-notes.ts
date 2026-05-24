import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — moduł Notatki (notes).
 * Note: ownerId/ownerTeamId, isMarkdown, pinned, groupId, tagi (NoteTag).
 */
export const NOTES_EPICS: EpicSeed[] = [
  {
    slug: "epic-notes-crud",
    title: "Notatki — CRUD",
    description: "Tworzenie, edycja, usuwanie, markdown i przypinanie.",
    stories: [
      {
        slug: "story-notes-create",
        title: "Tworzenie notatki",
        scenarios: [
          {
            slug: "scenario-notes-create",
            title: "Utworzenie notatki z tytułem i treścią",
            type: "positive",
            priority: "P0",
            pre: ["Zalogowany użytkownik z `module.notes`"],
            steps: ["Utwórz nową notatkę", "Podaj tytuł i treść", "Zapisz"],
            expected: ["Notatka pojawia się na liście", "Należy do bieżącego użytkownika (`ownerId`)", "Domyślnie `isMarkdown=false`, `pinned=false`"],
          },
          {
            slug: "scenario-notes-create-markdown",
            title: "Notatka w trybie markdown",
            type: "positive",
            priority: "P1",
            pre: ["Tworzysz/edytujesz notatkę"],
            steps: ["Włącz `isMarkdown`", "Wpisz treść z nagłówkami, listą, kodem", "Zapisz i otwórz podgląd"],
            expected: ["Treść renderowana jako markdown (markdownToHtml)", "Bez markdown — wyświetlany czysty tekst"],
          },
          {
            slug: "scenario-notes-create-empty-title",
            title: "Walidacja pustego tytułu",
            type: "negative",
            priority: "P1",
            pre: ["Otwarty formularz notatki"],
            steps: ["Zapisz bez tytułu"],
            expected: ["Notatka nie powstaje lub tytuł jest wymagany"],
          },
        ],
      },
      {
        slug: "story-notes-edit-delete",
        title: "Edycja, usuwanie i przypinanie",
        scenarios: [
          {
            slug: "scenario-notes-edit",
            title: "Edycja treści notatki",
            type: "positive",
            priority: "P1",
            pre: ["Posiadasz notatkę"],
            steps: ["Otwórz notatkę", "Zmień tytuł/treść", "Zapisz"],
            expected: ["Zmiany trwałe", "`updatedAt` zaktualizowane"],
          },
          {
            slug: "scenario-notes-pin",
            title: "Przypięcie i odpięcie notatki",
            type: "positive",
            priority: "P1",
            pre: ["Posiadasz notatkę"],
            steps: ["Przełącz pin (toggleNotePin)"],
            expected: ["Przypięta notatka pojawia się w sekcji przypiętych na home (max 3)", "Ponowne kliknięcie odpina"],
          },
          {
            slug: "scenario-notes-delete-access",
            title: "Usunięcie tylko własnej / zespołowej notatki",
            type: "negative",
            priority: "P0",
            pre: ["Istnieje notatka, do której nie masz dostępu"],
            steps: ["Spróbuj usunąć cudzą notatkę"],
            expected: ["Operacja odrzucona — assertNoteAccess sprawdza ownerId lub ownerTeamId w teamIds"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-notes-organization",
    title: "Grupy i tagi",
    description: "NoteGroup i Tag/NoteTag — organizacja notatek.",
    stories: [
      {
        slug: "story-notes-groups",
        title: "Grupy notatek",
        scenarios: [
          {
            slug: "scenario-notes-group-create",
            title: "Utworzenie grupy",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś na `/notes/groups`"],
            steps: ["Utwórz grupę z nazwą, opisem i kolorem", "Zapisz"],
            expected: ["Grupa dostępna przy przypisywaniu notatek"],
            notes: "NoteGroup nie ma pola ownera — jest globalny dla zalogowanych.",
          },
          {
            slug: "scenario-notes-group-assign",
            title: "Przypisanie notatki do grupy",
            type: "positive",
            priority: "P2",
            pre: ["Istnieje grupa i notatka"],
            steps: ["Edytuj notatkę", "Ustaw `groupId`", "Zapisz"],
            expected: ["Notatka filtruje się w widoku grupy", "Ustawienie groupId na null usuwa z grupy"],
          },
          {
            slug: "scenario-notes-group-delete",
            title: "Usunięcie grupy",
            type: "positive",
            priority: "P2",
            pre: ["Istnieje grupa"],
            steps: ["Usuń grupę (deleteNoteGroup)"],
            expected: ["Grupa znika", "Notatki nie są kasowane — tracą przypisanie"],
          },
        ],
      },
      {
        slug: "story-notes-tags",
        title: "Tagi notatek",
        scenarios: [
          {
            slug: "scenario-notes-tag-create-assign",
            title: "Utworzenie i przypisanie tagu",
            type: "positive",
            priority: "P1",
            pre: ["Jesteś na `/notes/tags`"],
            steps: ["Utwórz tag (nazwa unikalna, lowercase)", "Przypisz do notatki (setNoteTags / addTagToNote)"],
            expected: ["Tag widoczny przy notatce", "Wiele tagów na notatkę (NoteTag many-to-many)"],
          },
          {
            slug: "scenario-notes-tag-filter",
            title: "Filtrowanie notatek po tagu",
            type: "positive",
            priority: "P2",
            pre: ["Notatki mają różne tagi"],
            steps: ["Filtruj listę po `tagIds`"],
            expected: ["Lista pokazuje tylko notatki z wybranym tagiem"],
          },
        ],
      },
    ],
  },
  {
    slug: "epic-notes-search-access",
    title: "Wyszukiwanie, zespoły, uprawnienia",
    stories: [
      {
        slug: "story-notes-search",
        title: "Wyszukiwanie i widoki",
        scenarios: [
          {
            slug: "scenario-notes-search",
            title: "Wyszukiwanie po tytule i treści",
            type: "positive",
            priority: "P1",
            pre: ["Masz notatki o różnej treści"],
            steps: ["Wpisz frazę w wyszukiwarce (`/notes/all`)"],
            expected: ["Wyniki obejmują dopasowania w tytule i treści (case-insensitive)"],
          },
          {
            slug: "scenario-notes-home-recent-pinned",
            title: "Home pokazuje ostatnie i przypięte",
            type: "positive",
            priority: "P2",
            pre: ["Masz kilka notatek, część przypięta"],
            steps: ["Otwórz `/notes`"],
            expected: ["Sekcja ostatnich (max 5) i przypiętych (max 3) z licznikami"],
          },
        ],
      },
      {
        slug: "story-notes-team-permission",
        title: "Zespoły i uprawnienia",
        scenarios: [
          {
            slug: "scenario-notes-team-owned",
            title: "Notatka zespołowa widoczna dla członków",
            type: "positive",
            priority: "P1",
            pre: ["Należysz do zespołu", "Tworzysz notatkę z `ownerTeamId`"],
            steps: ["Utwórz notatkę zespołową", "Zaloguj się jako inny członek zespołu"],
            expected: ["Notatka widoczna dla członków zespołu", "Użytkownik spoza zespołu jej nie widzi"],
          },
          {
            slug: "scenario-notes-no-permission",
            title: "Brak `module.notes` — kłódka i blokada",
            type: "negative",
            priority: "P0",
            pre: ["Użytkownik bez `module.notes`"],
            steps: ["Sprawdź sidebar", "Wejdź ręcznie na `/notes`"],
            expected: ["Pozycja „Notatki” wyszarzona z kłódką", "Bezpośredni URL przekierowuje na stronę główną"],
          },
        ],
      },
    ],
  },
];
