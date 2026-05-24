import type { EpicSeed } from "./qa-helpers";

/**
 * Scenariusze testowe — Logowanie (auth).
 * NextAuth v5 + Google OAuth. Sesja: user.id, user.roles, user.permissions.
 * Pierwsze logowanie: rola BETA_TESTER; admin po e-mailu ADMIN_EMAIL.
 */
export const AUTH_EPICS: EpicSeed[] = [
  {
    slug: "epic-auth-signin",
    title: "Logowanie",
    description: "Google OAuth jako jedyna metoda logowania.",
    stories: [
      {
        slug: "story-auth-google",
        title: "Logowanie Google",
        scenarios: [
          {
            slug: "scenario-auth-google-success",
            title: "Pomyślne logowanie przez Google",
            type: "positive",
            priority: "P0",
            pre: ["Niezalogowany", "Jesteś na `/auth/signin`"],
            steps: ["Kliknij „Zaloguj przez Google”", "Przejdź flow OAuth"],
            expected: ["Sesja utworzona (JWT)", "Przekierowanie do aplikacji", "session.user ma id, roles[], permissions[]"],
          },
          {
            slug: "scenario-auth-first-signin-roles",
            title: "Pierwsze logowanie nadaje rolę BETA_TESTER",
            type: "positive",
            priority: "P1",
            pre: ["Nowy użytkownik (pierwsze logowanie)"],
            steps: ["Zaloguj się po raz pierwszy"],
            expected: [
              "Nowy użytkownik dostaje rolę BETA_TESTER",
              "Jeśli e-mail = ADMIN_EMAIL (tyka.szymon@gmail.com) → dodatkowo USER + ADMIN",
              "Avatar zapisany w user.avatarUrl",
            ],
            notes: "Logika w evencie createUser w src/lib/auth.ts.",
          },
        ],
      },
      {
        slug: "story-auth-session-guard",
        title: "Sesja i ochrona tras",
        scenarios: [
          {
            slug: "scenario-auth-unauth-redirect",
            title: "Niezalogowany przekierowany do logowania",
            type: "negative",
            priority: "P0",
            pre: ["Brak aktywnej sesji"],
            steps: ["Wejdź na dowolną chronioną trasę (np. `/shopping`)"],
            expected: ["Middleware przekierowuje na `/auth/signin`", "Trasy `/auth/*` dostępne bez sesji"],
          },
          {
            slug: "scenario-auth-fresh-permissions",
            title: "Uprawnienia świeże przy każdym żądaniu",
            type: "positive",
            priority: "P1",
            pre: ["Admin zmienił role/uprawnienia użytkownika"],
            steps: ["Odśwież stronę jako ten użytkownik"],
            expected: ["session.user.roles i permissions pobierane świeżo z DB w callbacku session", "Zmiany ról widoczne bez ponownego logowania"],
          },
          {
            slug: "scenario-auth-no-anonymous",
            title: "Brak trybu anonimowego",
            type: "negative",
            priority: "P1",
            pre: ["Brak sesji"],
            steps: ["Spróbuj użyć aplikacji bez logowania"],
            expected: ["Wszystkie strony poza `/auth/signin` wymagają sesji"],
          },
        ],
      },
    ],
  },
];
