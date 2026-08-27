import {
  Activity,
  BookOpen,
  Boxes,
  Bug,
  ClipboardList,
  Compass,
  Database,
  FileText,
  LayoutGrid,
  LineChart,
  ListChecks,
  type LucideIcon,
  Map,
  MousePointerClick,
  Palette,
  Rss,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";

/**
 * 110: REJESTR NARZĘDZI PANELU ADMINISTRATORA — jedno źródło prawdy.
 *
 * Do 110 `/admin` było jedną kolumną z **płaską listą dwudziestu jeden odnośników** bez grup i bez
 * szukania: „Zarządzanie dostępem", „Audyt stanu projektu", „Skórki systemowe" i „Testy klikacze"
 * stały w jednym nierozróżnialnym pasku, każdy z tą samą strzałką po prawej.
 *
 * Ten rejestr karmi NARAZ trzy rzeczy: spis z grupami, wyszukiwarkę i **bramkę kompletności**
 * (`scripts/check-admin-links.js`). To ostatnie jest tu najważniejsze: lista przepisywana ręcznie
 * już raz się rozjechała — `/admin/llm`, czyli konfiguracja dostawców i modeli LLM, **nie miała
 * odnośnika z żadnego miejsca w aplikacji**, a `/admin/qa` prowadziło wyłącznie z modułu QA.
 *
 * **Same klucze tekstów, zero literałów** (C-32). Bramka `check:i18n` nie widzi kluczy podawanych
 * zmienną, więc ich istnienia pilnuje test jednostkowy obok tego pliku.
 */
type WspolneNarzedzia = {
  /**
   * Ostatni segment trasy pod `/admin` — to po nim bramka kojarzy wpis z katalogiem na dysku.
   * Pozycje spoza `/admin` (moderacja usług) mają `id` opisowe i `href` wskazujący gdzie indziej;
   * bramka je pomija, bo nie ma czego porównać.
   */
  id: string;
  Ikona: LucideIcon;
  /** Klucze w przestrzeni `components.admin.SpisNarzedziAdmina`. */
  kluczNazwy: string;
  kluczOpisu: string;
  /** Dodatkowe słowa dla wyszukiwarki — czego szuka administrator, nie zawsze jest w nazwie. */
  kluczHasel: string;
};

/**
 * Pozycja jest ALBO odnośnikiem, ALBO akcją — nigdy jednym i drugim.
 *
 * Unia zamiast opcjonalnej `akcja` obok wymaganego `href`: akcja („wskaż element do zgłoszenia")
 * nie prowadzi pod żaden adres, więc wymagany `href` zmuszał ją do noszenia atrapy `"#"` — czyli
 * nieprawdy w pliku, którego całym zadaniem jest być jedynym źródłem prawdy. Przy unii kompilator
 * pilnuje, że odnośnik ma adres, a akcja go nie ma.
 *
 * Akcja **zostaje w rejestrze**, mimo że nie jest trasą: inaczej wypadłaby też z wyszukiwarki,
 * czyli z jedynego miejsca, w którym administrator jej szuka.
 */
export type NarzedzieAdmina =
  | (WspolneNarzedzia & { href: string; akcja?: undefined })
  | (WspolneNarzedzia & { href?: undefined; akcja: "wskazElement" });

export type GrupaNarzedzi = {
  id: string;
  kluczNazwy: string;
  narzedzia: NarzedzieAdmina[];
};

function n(id: string, Ikona: LucideIcon, opcje?: { href?: string }): NarzedzieAdmina {
  return {
    id,
    href: opcje?.href ?? `/admin/${id}`,
    Ikona,
    kluczNazwy: `narzedzia.${id}.nazwa`,
    kluczOpisu: `narzedzia.${id}.opis`,
    kluczHasel: `narzedzia.${id}.hasla`,
  };
}

/** Pozycja uruchamiająca coś na miejscu — bez adresu, bo nigdzie nie prowadzi. */
function akcja(id: string, Ikona: LucideIcon, rodzaj: "wskazElement"): NarzedzieAdmina {
  return {
    id,
    Ikona,
    kluczNazwy: `narzedzia.${id}.nazwa`,
    kluczOpisu: `narzedzia.${id}.opis`,
    kluczHasel: `narzedzia.${id}.hasla`,
    akcja: rodzaj,
  };
}

/**
 * Kolejność grup: od najczęściej używanych do najrzadszych. Decyzja produktowa, więc trzyma się
 * jednej tablicy — zmiana kolejności to zmiana tej tablicy, nie sortowania w trzech komponentach.
 */
export const GRUPY_NARZEDZI: GrupaNarzedzi[] = [
  {
    id: "przeglad",
    kluczNazwy: "grupy.przeglad",
    narzedzia: [n("przeglad", LayoutGrid)],
  },
  {
    id: "dostep",
    kluczNazwy: "grupy.dostep",
    narzedzia: [n("access", Shield), n("audit", FileText)],
  },
  {
    id: "diagnostyka",
    kluczNazwy: "grupy.diagnostyka",
    narzedzia: [n("health", Activity), n("metrics", LineChart), n("jobs", ListChecks), n("ai-calls", Database)],
  },
  {
    id: "ai",
    kluczNazwy: "grupy.ai",
    narzedzia: [n("config", Settings), n("llm", Sparkles), n("ai-coverage", ClipboardList), n("user-facts", Users)],
  },
  {
    id: "tresc",
    kluczNazwy: "grupy.tresc",
    narzedzia: [
      n("categories", Tag),
      n("skins", Palette),
      n("reports", BookOpen),
      n("zrodla-rss", Rss),
      n("moderacja", Shield, { href: "/services/moderation" }),
    ],
  },
  {
    id: "dokumentacja",
    kluczNazwy: "grupy.dokumentacja",
    narzedzia: [
      n("docs", BookOpen),
      n("audyt", Compass),
      n("audyt-podsumowanie", Compass),
      n("architektura-docelowa", Map),
      n("architecture", Boxes),
      n("spec-pipeline", ClipboardList),
    ],
  },
  {
    id: "deweloper",
    kluczNazwy: "grupy.deweloper",
    narzedzia: [
      n("playground", MousePointerClick),
      n("e2e", Bug),
      n("qa", ClipboardList),
      akcja("zglos-blad", Bug, "wskazElement"),
    ],
  },
];

/** Wszystkie pozycje w kolejności grup — dla wyszukiwarki, testów i bramki. */
export function wszystkieNarzedzia(): NarzedzieAdmina[] {
  return GRUPY_NARZEDZI.flatMap((g) => g.narzedzia);
}

/**
 * Identyfikatory pozycji, które odpowiadają katalogowi pod `src/app/admin/`.
 *
 * Bramka kompletności porównuje **ten** zbiór z zawartością dysku, więc pozycje spoza `/admin`
 * (moderacja usług) i pozycje-akcje (tryb wskazywania) muszą z niego wypaść — inaczej bramka
 * szukałaby katalogu, którego z założenia nie ma.
 */
export function idNarzedziPodAdmin(): string[] {
  return wszystkieNarzedzia()
    .filter((x) => x.href === `/admin/${x.id}`)
    .map((x) => x.id);
}
