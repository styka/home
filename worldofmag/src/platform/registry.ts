import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { AiContribution } from "./ai/contribution";
import type { JobHandler } from "./jobs/types";
import type { CalendarContributor } from "./calendar";

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
  /**
   * 048: własna nawigacja boczna modułu, renderowana przez powłokę gdy moduł jest aktywny.
   *
   * **Ładowana LENIWIE i to nie jest optymalizacja, tylko warunek poprawności.** `module.ts` jest
   * importowany przez korzeń kompozycji, a ten przez **kod serwerowy**; statyczny import komponentu
   * klienckiego wciągnąłby go do każdego takiego grafu. Funkcja zwracająca `import()` jest
   * wywoływana dopiero przez `next/dynamic` po stronie klienta.
   *
   * Kształt `{ default }` bierze się z `next/dynamic`; komponenty eksportowane nazwanie mapujemy
   * w miejscu deklaracji: `() => import("./ui/XNav").then((m) => ({ default: m.XNav }))`.
   *
   * Bez tego pola powłoka musiałaby importować `ui/` sześciu modułów — czyli sięgać do ich wnętrz
   * (rozdz. 9.3 opisuje ten sam wzorzec dla kafelka pulpitu).
   */
  sideNav?: () => Promise<{ default: ComponentType }>;
  /**
   * 049: wkład modułu do asystenta AI — katalog akcji, egzekutor i narzędzia odczytu.
   *
   * **Leniwy z tego samego powodu co `sideNav`, tylko w drugą stronę.** Tam chodziło o to, żeby
   * komponent kliencki nie wpadł do grafu serwerowego; tu — żeby **kod serwerowy nie wpadł do
   * bundla klienta**. `MODULES` importuje `ModuleSidebar`, który jest komponentem klienckim,
   * a egzekutory wołają Server Actions i Prismę. Statyczne `ai: { … }` (dosłowny kształt
   * z rozdz. 9.3) wciągnęłoby serwer do przeglądarki.
   *
   * Rozdz. 9.6: „moduł bez deklaracji nie istnieje dla asystenta" — i to jest gwarancja mocniejsza
   * niż kompletność ręcznej listy, bo modułu nie da się zapomnieć.
   */
  ai?: () => Promise<{ default: AiContribution }>;
  /**
   * 049: zadania w tle należące do tego modułu — mapa `typ zadania → handler`.
   *
   * Handlery **nie importują kontraktów** (sięgają wprost do Prismy), więc litera C-36 przepuściłaby
   * je do platformy. O przynależności decyduje jednak lista konsumentów, nie brak importu: „wygeneruj
   * przepis" jest zadaniem Kuchni, a nie zdolnością platformy. Przekrojowe zostają w platformie.
   *
   * Z tej mapy powstaje też **allowlista tego, co klient może zakolejkować** — czyli granica
   * bezpieczeństwa. Wcześniej była ręczną mapą w jednym pliku.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs?: () => Promise<{ default: Record<string, JobHandler<any, any>> }>;
  /**
   * 049: wkład modułu do wspólnej agendy kalendarza (rozdz. 9.3).
   *
   * Leniwy, bo sięga do bazy. Bez tego pola moduł Kalendarz musiałby znać tabele wszystkich
   * pozostałych — i znał, przez dziewięć zapytań w jednym `Promise.all`.
   */
  calendar?: () => Promise<{ default: CalendarContributor }>;
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
 * Układa deklaracje modułów w kolejności menu.
 *
 * **048 — parametr `legacy` zniknął.** Do fali 3 funkcja scalała deklaracje z jawną tablicą modułów
 * jeszcze nieprzeniesionych; ta tablica doszła do zera i została usunięta jako martwy kod. Gdyby
 * została pusta „na wszelki wypadek", byłaby zaproszeniem, żeby dopisać do niej kolejny moduł
 * zamiast utworzyć katalog — czyli dokładnie ten dług, który Faza 1 zlikwidowała.
 *
 * Kolejność wyniku bierze się z `order` — bo kolejność pozycji w menu jest decyzją produktową,
 * a nie pochodną kolejności importów.
 *
 * Duplikat identyfikatora jest **błędem**, nie ostrzeżeniem: dwa moduły o tym samym `id` po cichu
 * nadpisałyby sobie preferencje menu użytkownika.
 */
export function mergeModules(
  declared: ResolvedModule[],
  order: string[],
): ResolvedModule[] {
  const all = [...declared];

  const seen = new Set<string>();
  for (const m of all) {
    if (seen.has(m.id)) {
      throw new Error(
        `Zduplikowany identyfikator modułu „${m.id}" — dwa moduły deklarują to samo id.`,
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
