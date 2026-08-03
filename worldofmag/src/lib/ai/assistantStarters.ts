// 043: JEDNO źródło akcji startowych asystenta (AC-17).
//
// Wcześniej lista żyła w dwóch miejscach: `STARTER_CHIPS` w `AICommandSheet.tsx` (pusty wątek czatu)
// i doraźnie budowana tablica w `HomePage.tsx` (dokowana kolumna). Dwie listy tego samego = pewny
// rozjazd przy pierwszej zmianie. Tu jest wspólny katalog: panel czatu bierze z niego domyślny
// zestaw, a widget na pulpicie — zestaw dobrany do tego, co użytkownik faktycznie ma w danych.
//
// Moduł jest czysto obliczeniowy (bez Reacta, bez Prismy), więc importuje się i z komponentu
// klienckiego, i z serwera — tak samo jak `lib/favorites/favoriteViews.ts`.

export interface AssistantStarter {
  id: string;
  /** Krótka etykieta na przycisku (widget na pulpicie ma mało miejsca). */
  label: string;
  /** Pełne polecenie wysyłane do asystenta — to ono trafia do rozmowy. */
  prompt: string;
}

/**
 * Katalog akcji. `prompt` jest tym, co asystent dostaje jako wiadomość użytkownika, więc zmiana
 * tekstu tutaj zmienia zachowanie w OBU miejscach naraz — o to chodzi.
 */
export const ASSISTANT_STARTERS = {
  priorities: {
    id: "priorities",
    label: "Co teraz?",
    prompt: "Co mam dziś najważniejszego do zrobienia?",
  },
  week: {
    id: "week",
    label: "Podsumuj tydzień",
    prompt: "Podsumuj mój tydzień",
  },
  mood: {
    id: "mood",
    label: "Dobierz zadania",
    prompt: "Znajdź 5 obowiązków pasujących do mojego nastroju i posortuj priorytetami",
  },
  report: {
    id: "report",
    label: "Zrób raport",
    prompt: "Zrób raport z tej rozmowy",
  },
  overdue: {
    id: "overdue",
    label: "Zaległości",
    prompt: "Co powinienem zrobić w pierwszej kolejności z zaległych zadań?",
  },
  dinner: {
    id: "dinner",
    label: "Obiad na dziś",
    prompt: "Zaproponuj obiad na dziś",
  },
  shopping: {
    id: "shopping",
    label: "Lista zakupów",
    prompt: "Co mam jeszcze do kupienia?",
  },
} as const satisfies Record<string, AssistantStarter>;

/**
 * Domyślny zestaw dla pustego wątku czatu — dokładnie ten, który panel pokazywał przed 043
 * (kolejność bez zmian, żeby zachowanie asystenta zostało takie samo).
 */
export const DEFAULT_ASSISTANT_STARTERS: AssistantStarter[] = [
  ASSISTANT_STARTERS.priorities,
  ASSISTANT_STARTERS.week,
  ASSISTANT_STARTERS.mood,
  ASSISTANT_STARTERS.report,
];

export interface AssistantStarterContext {
  overdueTasks?: number;
  pendingItems?: number;
  todayMeals?: number;
  /** Slugi uprawnień użytkownika — bez `module.kitchen` nie proponujemy obiadu. */
  permissions?: string[];
}

const MAX_WIDGET_STARTERS = 4;

/**
 * Zestaw dla widgetu na pulpicie: najpierw akcje wynikające z realnego stanu danych
 * (zaległości, brak posiłku, niekupione pozycje), potem uzupełnienie z zestawu domyślnego.
 * Zawsze zwraca co najmniej jedną pozycję — widget bez akcji nie miałby po co istnieć.
 */
export function buildAssistantStarters(ctx: AssistantStarterContext = {}): AssistantStarter[] {
  const has = (slug: string) => ctx.permissions?.includes(slug) ?? false;
  const out: AssistantStarter[] = [];

  if ((ctx.overdueTasks ?? 0) > 0) out.push(ASSISTANT_STARTERS.overdue);
  if ((ctx.todayMeals ?? 0) === 0 && has("module.kitchen")) out.push(ASSISTANT_STARTERS.dinner);
  if ((ctx.pendingItems ?? 0) > 0) out.push(ASSISTANT_STARTERS.shopping);

  for (const starter of DEFAULT_ASSISTANT_STARTERS) {
    if (out.length >= MAX_WIDGET_STARTERS) break;
    // `report` ma sens dopiero w trwającej rozmowie — na pulpicie nie ma z czego robić raportu.
    if (starter.id === ASSISTANT_STARTERS.report.id) continue;
    if (out.some((s) => s.id === starter.id)) continue;
    out.push(starter);
  }

  return out.slice(0, MAX_WIDGET_STARTERS);
}
