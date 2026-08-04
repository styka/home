import type { LucideIcon } from "lucide-react";

/**
 * 046 — DEKLARACJA MODUŁU (rozdz. 9.3 dokumentu „Omnia 🧐 — architektura docelowa").
 *
 * Problem, który to rozwiązuje: dodanie modułu wymaga dziś wpisu w **ośmiu** równoległych listach
 * (rejestr menu, słownik uprawnień, mapowanie ścieżek, pasek boczny, pulpit, kalendarz, katalog
 * asystenta, manifest kontraktu widoku). Każda z nich może zostać pominięta osobno i nic tego nie
 * zauważy. Cel z rozdz. 9.3: **8 → 1**.
 *
 * Ten plik zawiera **wyłącznie typ i funkcję pomocniczą** — żadnego importu modułu. To nie jest
 * ostrożność, tylko wymóg: reguła ESLint zabrania `src/platform/**` importować cokolwiek z
 * `@/modules/*` (asymetria z rozdz. 7.1 — platforma nie zna modułów). Samo **złożenie** deklaracji
 * w rejestr robi więc korzeń kompozycji poza platformą (`src/lib/modules.tsx`), który z definicji
 * zna wszystkich. Plan zakładał tutaj także scalanie; przeniesienie go do korzenia kompozycji to
 * poprawka wymuszona właśnie przez tę regułę (C-54).
 *
 * `defineModule` nie robi nic w czasie wykonania poza zwróceniem obiektu — jej wartością jest
 * **kontrola typów w miejscu deklaracji**: brakujące pole to błąd kompilacji w `module.ts` modułu,
 * a nie cicha nieobecność w menu zauważona miesiąc później.
 */
export type ModuleDeclaration = {
  /** Identyfikator modułu — klucz w preferencjach menu i pulpitu. Musi być unikalny. */
  id: string;
  /** Etykieta po polsku (C-32). i18n przychodzi w późniejszej fazie — dziś tekst wprost. */
  label: string;
  /** Ścieżka wejściowa modułu. */
  href: string;
  /** `true`, gdy moduł zajmuje dokładnie tę ścieżkę (Strona główna) i nie chce dopasowania prefiksem. */
  exact?: boolean;
  /**
   * Slug uprawnienia (`module.*`) albo `null` dla modułu dostępnego każdemu zalogowanemu.
   * To ten sam slug, który wcześniej żył w `PERMISSIONS` — deklaracja go **przejmuje**, a nie dubluje.
   */
  permission: string | null;
  /** Kolor akcentu — zawsze zmienna CSS, nigdy literał (C-30, skórki). */
  color: string;
  Icon: LucideIcon;
  /** Czy moduł jest domyślnie włączony w menu (QA celowo nie jest). */
  defaultEnabled: boolean;
  /**
   * Prefiksy ścieżek, które należą do modułu — źródło mapowania ścieżka → uprawnienie.
   * Domyślnie `[href]`; osobne pole jest potrzebne dla modułów z kilkoma korzeniami tras.
   */
  routes?: string[];
};

/** Deklaracja po uzupełnieniu wartości domyślnych — tego używa rejestr. */
export type ResolvedModule = ModuleDeclaration & { routes: string[] };

/**
 * Sygnatura jest **generyczna po to, żeby zachować dokładny typ deklaracji**. Dzięki temu
 * `qaModule.permission` ma typ `"module.qa"`, a nie `string | null`, i strażnik trasy pisze się
 * jako `hasPermission(session, qaModule.permission)` — bez asercji `!`, która tłumiłaby akurat ten
 * błąd, który chcemy widzieć (moduł bez uprawnienia użyty tam, gdzie uprawnienie jest wymagane).
 */
export function defineModule<T extends ModuleDeclaration>(decl: T): T & { routes: string[] } {
  return { ...decl, routes: decl.routes ?? [decl.href] };
}

/**
 * Scala deklaracje modułów z **przejściową** tablicą modułów jeszcze nieprzeniesionych.
 *
 * Tablica przejściowa istnieje, bo Faza 1 przenosi 4 z 21 modułów. Jest to jawny, tymczasowy stan —
 * dokładnie ten wzorzec, który sprawdził się w 045: `pending` jako legalny, ale **widoczny** status,
 * zamiast cichego długu.
 *
 * Kolejność wyniku bierze się z `order` — bo kolejność pozycji w menu jest decyzją produktową,
 * a nie pochodną tego, który moduł akurat został już przeniesiony.
 *
 * Duplikat identyfikatora jest **błędem**, nie ostrzeżeniem: dwa moduły o tym samym `id` po cichu
 * nadpisałyby sobie preferencje menu użytkownika.
 */
export function mergeModules(
  declared: ResolvedModule[],
  legacy: ResolvedModule[],
  order: string[],
): ResolvedModule[] {
  const all = [...declared, ...legacy];

  const seen = new Set<string>();
  for (const m of all) {
    if (seen.has(m.id)) {
      throw new Error(
        `Zduplikowany identyfikator modułu „${m.id}" — moduł zadeklarowany i jednocześnie obecny na liście przejściowej.`,
      );
    }
    seen.add(m.id);
  }

  const byId = new Map(all.map((m) => [m.id, m]));
  const ordered = order.map((id) => byId.get(id)).filter((m): m is ResolvedModule => !!m);

  // Moduł spoza listy kolejności (nowo dodany, zanim ktoś wpisze go do kolejności) ląduje na końcu
  // — ma być widoczny, a nie zniknąć dlatego, że ktoś zapomniał o drugim miejscu.
  const rest = all.filter((m) => !order.includes(m.id));
  return [...ordered, ...rest];
}

/**
 * Mapuje ścieżkę na wymagane uprawnienie na podstawie deklaracji.
 * Zwraca `undefined`, gdy żaden moduł nie obejmuje tej ścieżki — wtedy pyta się dalej mapowania
 * historycznego. `null` jest znaczącą wartością (moduł bez uprawnienia), więc nie może służyć
 * jako „nie wiem".
 */
export function permissionForPathIn(modules: ResolvedModule[], path: string): string | null | undefined {
  for (const m of modules) {
    for (const route of m.routes) {
      if (m.exact ? path === route : path === route || path.startsWith(`${route}/`)) {
        return m.permission;
      }
    }
  }
  return undefined;
}
