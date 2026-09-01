import { mergeModules, permissionForPathIn, type ResolvedModule } from "@/platform/registry";

// 046: deklaracje modułów przeniesionych do `src/modules/`. TO JEST KORZEŃ KOMPOZYCJI —
// jedyne miejsce w kodzie, które zna wszystkie moduły naraz. Nie może nim być
// `src/platform/registry.ts`, bo platforma z zasady nie zna modułów (reguła ESLint tego pilnuje).
import truckModule from "@/modules/truck/module";
import contactsModule from "@/modules/contacts/module";
import reportsModule from "@/modules/reports/module";
import qaModule from "@/modules/qa/module";
import homeModule from "@/modules/home/module";
import calendarModule from "@/modules/calendar/module";
import tasksModule from "@/modules/tasks/module";
import shoppingModule from "@/modules/shopping/module";
import portfelModule from "@/modules/portfel/module";
import petsModule from "@/modules/pets/module";
import kitchenModule from "@/modules/kitchen/module";
import servicesModule from "@/modules/services/module";
import weatherModule from "@/modules/weather/module";
import newsModule from "@/modules/news/module";
import healthModule from "@/modules/health/module";
import flotaModule from "@/modules/flota/module";
import notesModule from "@/modules/notes/module";
import magazynowanieModule from "@/modules/magazynowanie/module";
import warsztatyModule from "@/modules/warsztaty/module";
import languagesModule from "@/modules/languages/module";
import habitsModule from "@/modules/habits/module";
import youtubeModule from "@/modules/youtube/module";
import czatModule from "@/modules/czat/module";
import roslinyModule from "@/modules/rosliny/module";

// Definicja górnego (konfigurowalnego) modułu menu. Pozycje dolne (Ustawienia,
// Zaproszenia, Admin) NIE są tutaj — pozostają na stałe w komponentach paska.
export type ModuleDef = ResolvedModule;

const DECLARED: ResolvedModule[] = [truckModule, youtubeModule, czatModule, roslinyModule, contactsModule, reportsModule, qaModule, habitsModule, languagesModule, warsztatyModule, magazynowanieModule, notesModule, flotaModule, healthModule, newsModule, weatherModule, servicesModule, kitchenModule, petsModule, portfelModule, shoppingModule, tasksModule, calendarModule, homeModule];

/**
 * Kolejność pozycji w menu — decyzja produktowa, więc trzyma się jednej listy, a nie kolejności,
 * w jakiej moduły akurat zostały przeniesione. Zmiana kolejności = zmiana tej tablicy.
 */
const MODULE_ORDER = [
  "home", "calendar", "shopping", "tasks", "notes", "pets", "rosliny", "kitchen", "languages", "health",
  "news", "youtube", "weather", "habits", "services", "czat", "contacts", "qa", "truck", "flota", "portfel",
  "magazynowanie", "warsztaty", "reports",
];

// Jedno źródło prawdy dla górnych modułów (kolejność = domyślna kolejność menu).
export const MODULES: ModuleDef[] = mergeModules(DECLARED, MODULE_ORDER);

const MODULE_INDEX = new Map(MODULES.map((m, i) => [m.id, i]));

/**
 * 109: DEKLARACJA STRONY GŁÓWNEJ DLA PANELU BOCZNEGO.
 *
 * Strona główna wraca jako nazwany wiersz nawigacji (087 zamieniło ją na ikonę domu w rzędzie ikon
 * konta — właściciel zgłosił, że przez to stoi POD ulubionymi i nie jest opisana słowami). Wiersz
 * potrzebuje etykiety, ikony, koloru, `exact` i uprawnienia — czyli dokładnie tego, co już stoi
 * w deklaracji modułu.
 *
 * Dlatego czytamy stąd, a nie z nowej stałej w powłoce: równoległa lista modułowa jest tym, co
 * przebudowa 048/049 wyrzuciła (C-36), a druga kopia etykiety rozjechałaby się przy pierwszej
 * zmianie nazwy. `resolveMenu` zostaje nietknięte, więc Strona główna dalej NIE wraca ani do
 * kolejności menu, ani do „Więcej…", ani do ekranu zarządzania menu, ani do dolnego paska.
 */
export function modulStronyGlownej(): ModuleDef | null {
  return MODULES.find((m) => m.id === "home") ?? null;
}

/**
 * Mapowanie ścieżka → uprawnienie **wszystkich** modułów. Po fali 3 (048) nie ma już modułów
 * nieprzeniesionych, więc to jest komplet — `legacyPermissionForPath` obsługuje wyłącznie
 * powierzchnie SPOZA rejestru modułów (ustawienia, admin, zaproszenia).
 */
export function declaredPermissionForPath(path: string): string | null | undefined {
  return permissionForPathIn(DECLARED, path);
}

/**
 * 103: ile MIEJSC MODUŁOWYCH zostaje w dolnym pasku po odjęciu kotwic.
 *
 * Ta liczba nie jest gustem, tylko wynikiem arytmetyki na najwęższym ekranie, który obsługujemy.
 * Przy 360 px pasek ma 360 − 68 px (stały kontener magicznej ikony) = **292 px na pozycje**.
 *
 * **104 — poprawka pomyłki o jeden z run 103.** Poprzedni komentarz twierdził, że sufitem jest PIĘĆ
 * pozycji, bo „szósta zeszłaby do ~41 px". To był błąd rachunkowy: 292 / 6 = **48,7 px**, czyli
 * szósta mieści się z zapasem ponad minimum 44 × 44 px (C-31); dopiero **siódma** schodzi do
 * 41,7 px i regułę łamie. Pasek ma więc dziś sześć pozycji: trzy dalsze (dom + dwa moduły) po
 * ~48,7 px i trzy bliższe (ulubione, nawigacja, wstecz) po tyle samo.
 *
 * **Szóste miejsce poszło na KOTWICĘ, nie na trzeci moduł** — i to jest decyzja produktowa, nie
 * skutek arytmetyki: pasek ma dawać jedną drogę do wszystkiego, a nie mieścić więcej skrótów.
 * Dlatego ta stała zostaje na 2.
 *
 * Poprzednik tej stałej (`MAX_TAB_BAR = 5`) został USUNIĘTY, a nie zostawiony „na wszelki wypadek":
 * po wprowadzeniu kotwic nie miał już ani jednego wywołania, a stała bez konsumenta w pliku
 * wspólnym ogłasza limit, którego nikt nie egzekwuje (C-35 czytane w drugą stronę).
 */
export const MAKS_MODULOW_W_PASKU = 2;

/**
 * Domyślny dolny pasek (mobile) — niezależny od kolejności menu bocznego.
 *
 * 103: **bez `home`.** Strona główna jest od tego przebiegu KOTWICĄ paska (stałym miejscem), więc
 * jej wpis w preferencjach dawałby dwie ikony domu w jednym pasku. Ten sam ruch, który 087 zrobiło
 * z pozycją „Strona główna" w menu.
 */
export const DEFAULT_TAB_BAR = ["tasks", "shopping"];

/**
 * 100: dominująca ręka. `String` + union zamiast enuma Prisma (C-12) — kolumna w bazie przyjmie
 * cokolwiek, więc walidacja należy do kodu odczytującego (`readMenuPrefs`).
 */
export type Reka = "right" | "left";

/**
 * Zawęża wartość z bazy do unii `Reka`.
 *
 * Mieszka TU, a nie przy zapisie w `actions/menuPrefs.ts`, i to jest wymóg bramki, nie porządek:
 * plik z `"use server"` eksportuje wyłącznie funkcje asynchroniczne, więc reguły w nim zawartej
 * **nie da się zaimportować do testu** (`check:domain`, zadanie 19). Tutaj stoi obok własnego typu
 * i jest zwykłą funkcją — sprawdzalną.
 *
 * Schodzi do `"right"` zamiast rzucać, bo kolumna jest `String` (C-12) i przyjmie cokolwiek:
 * starą migrację, ręczną poprawkę z `psql`, literówkę w skrypcie. Nieznana preferencja WYGLĄDU
 * nigdy nie jest powodem, żeby nie dało się wyświetlić strony.
 */
export function czytajReke(wartosc: string | null | undefined): Reka {
  return wartosc === "left" ? "left" : "right";
}

export type MenuPrefs = {
  order: string[];
  disabled: string[];
  tabBar: string[];
  /**
   * 080 (Z8): czy sekcja ulubionych w menu jest ZWINIĘTA. Domyślnie tak — rozwinięta spychała
   * pozycje modułów poniżej pierwszego ekranu, więc wejście na stronę główną albo do notatek
   * wymagało przewinięcia przez obszar, którego użytkownik w tym momencie nie potrzebował.
   */
  favoritesCollapsed: boolean;
  /**
   * 100: po której stronie ekranu stoi to, co obsługuje kciuk — dolny pasek, gwiazdka ulubionych,
   * magiczna ikona asystenta i ikona zgłaszania. Domyślnie `"right"`: tak stoi aplikacja dzisiaj,
   * a zmiana domyślnej byłaby cichą przeprowadzką układu u wszystkich użytkowników naraz.
   */
  handedness: Reka;
  /**
   * 118 (zgł. 11): czy menu boczne na komputerze jest zwinięte do samych ikon. Domyślnie nie —
   * pełne menu to stan, który aplikacja miała zawsze; zwinięcie jest świadomym wyborem
   * użytkownika i wraca na każdym urządzeniu (nośnik: `UserMenuPref`, nie localStorage).
   */
  sidebarCollapsed: boolean;
};

export function defaultMenuPrefs(): MenuPrefs {
  return {
    order: MODULES.map((m) => m.id),
    disabled: MODULES.filter((m) => !m.defaultEnabled).map((m) => m.id),
    tabBar: [...DEFAULT_TAB_BAR],
    favoritesCollapsed: true,
    handedness: "right",
    sidebarCollapsed: false,
  };
}

function hasAccess(m: ModuleDef, permissions: string[]): boolean {
  return m.permission === null || permissions.includes(m.permission);
}

/**
 * Rozdziela moduły wg uprawnień + preferencji:
 *  - `enabled`: dostępne i włączone (renderowane w menu, w kolejności użytkownika),
 *  - `more`: dostępne, ale wyłączone przez użytkownika (sekcja „Więcej…"),
 *  - niedostępne (brak uprawnień) — pomijane całkowicie (ukryte).
 */
export function resolveMenu(permissions: string[], prefs: MenuPrefs) {
  const orderIndex = new Map(prefs.order.map((id, i) => [id, i]));
  const ordered = [...MODULES].sort((a, b) => {
    // moduły spoza zapisanej kolejności (np. nowo dodane) lądują na końcu, w kolejności bazowej
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : 1000 + (MODULE_INDEX.get(a.id) ?? 0);
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : 1000 + (MODULE_INDEX.get(b.id) ?? 0);
    return ai - bi;
  });
  /**
   * 087 (AC-17): STRONA GŁÓWNA NIE JEST POZYCJĄ MENU — ma własną ikonę w chromie konta.
   *
   * Zgłoszenie właściciela: „po lewej daj ikonę strony domowej zamiast pozycji w menu »strona
   * domowa«". Moduł zostaje w rejestrze: ma trasę, uprawnienie i wpis w bramce rejestru — znika
   * wyłącznie z LISTY. Filtrujemy tutaj, a nie w powłoce, bo tę samą listę czyta panel boczny,
   * menu telefonu i ekran zarządzania menu w ustawieniach; filtr w jednym z tych miejsc zostawiłby
   * pozycję w dwóch pozostałych. Musi wypaść także z „Więcej…" — inaczej wracałaby tam jako „dział
   * do włączenia".
   */
  const accessible = ordered.filter((m) => m.id !== "home" && hasAccess(m, permissions));
  const disabledSet = new Set(prefs.disabled);
  return {
    enabled: accessible.filter((m) => !disabledSet.has(m.id)),
    more: accessible.filter((m) => disabledSet.has(m.id)),
  };
}

/** Wszystkie dostępne moduły (do ekranu zarządzania menu w ustawieniach). */
export function accessibleModulesInOrder(permissions: string[], prefs: MenuPrefs): ModuleDef[] {
  const { enabled, more } = resolveMenu(permissions, prefs);
  // enabled w kolejności użytkownika, potem dostępne-wyłączone
  return [...enabled, ...more];
}

/**
 * Moduły dolnego paska (mobile) w kolejności wybranej przez użytkownika — niezależnej
 * od menu bocznego. Filtruje wg uprawnień, ucina do `limit`. Gdy nic nie zostanie
 * (np. brak uprawnień do wybranych), wraca do pierwszych włączonych modułów menu.
 */
export function resolveTabBar(permissions: string[], prefs: MenuPrefs, limit: number): ModuleDef[] {
  const byId = new Map(MODULES.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const picked: ModuleDef[] = [];
  for (const id of prefs.tabBar) {
    if (seen.has(id)) continue;
    // 103: `home` NIE jest pozycją modułową paska — jest jego kotwicą. Odsiewamy tutaj, a nie
    // w powłoce, z tego samego powodu, dla którego `resolveMenu` odsiewa go od 087: tę samą listę
    // czyta pasek, ekran ustawień i test, więc filtr w jednym z tych miejsc zostawiłby pozycję
    // w dwóch pozostałych.
    if (id === "home") continue;
    const m = byId.get(id);
    if (m && hasAccess(m, permissions)) {
      picked.push(m);
      seen.add(id);
    }
    if (picked.length >= limit) break;
  }
  if (picked.length > 0) return picked;
  return resolveMenu(permissions, prefs).enabled.slice(0, limit);
}

/**
 * 103: jedna pozycja dolnego paska. Pasek przestał być listą modułów — są w nim cztery RODZAJE
 * pozycji, a magiczna ikona asystenta stoi poza tą listą, bo ma stałe miejsce na środku (run 100).
 */
export type PozycjaPaska =
  | { rodzaj: "modul"; modul: ModuleDef }
  | { rodzaj: "dom" }
  | { rodzaj: "ulubione" }
  /** 104: szybka nawigacja — otwiera panel z modułami, ich celami i ostatnio odwiedzonymi stronami. */
  | { rodzaj: "nawigacja" }
  | { rodzaj: "historia" };

/**
 * 103: SKŁAD dolnego paska — czysta funkcja, świadomie tutaj, a nie w komponencie.
 *
 * Powód jest ten sam, dla którego mieszka tu `resolveTabBar`: ten sam skład czyta pasek, ekran
 * ustawień (żeby wiedzieć, ile miejsc modułowych zostało) i test jednostkowy. Reguła „ile miejsc
 * zostaje na moduły" policzona w komponencie musiałaby zostać powtórzona w edytorze menu — a dwie
 * kopie tej samej arytmetyki rozjeżdżają się przy pierwszej zmianie kotwic.
 *
 * Zwracamy dwie grupy, nie jedną listę, bo tak wygląda pasek: dwa pojemniki po obu stronach
 * magicznej ikony. `bliskie` to strona kciuka.
 *
 * Kolejność jest treścią zgłoszenia właściciela: **Dom | Sparkles | ulubione | historia**. Historia
 * ląduje w samym rogu pod kciukiem, bo powrót jest najczęstszą czynnością nawigacyjną, a run 100
 * ustalił, że róg należy do pozycji najważniejszej.
 *
 * `domDostepny` przychodzi PARAMETREM (a nie jest tu liczony z uprawnień), bo mapowanie ścieżka →
 * uprawnienie mieszka w `@/lib/pathPermissions`, który importuje ten plik — policzenie go tutaj
 * zamknęłoby cykl importów.
 */
export function pozycjePaska(
  permissions: string[],
  prefs: MenuPrefs,
  domDostepny: boolean,
): { dalekie: PozycjaPaska[]; bliskie: PozycjaPaska[] } {
  // Gdy kotwica domu odpada (konto bez uprawnienia do Strony głównej), jej miejsce nie ma stać
  // puste — przechodzi na moduły. Pasek ma zawsze tyle samo celów dotyku tej samej szerokości.
  const miejscaModulowe = MAKS_MODULOW_W_PASKU + (domDostepny ? 0 : 1);
  const moduly = resolveTabBar(permissions, prefs, miejscaModulowe).slice(0, miejscaModulowe);

  const dalekie: PozycjaPaska[] = [
    ...(domDostepny ? [{ rodzaj: "dom" } as const] : []),
    ...moduly.map((modul) => ({ rodzaj: "modul" as const, modul })),
  ];
  // Kolejność w `bliskie` jest „od środka na zewnątrz": ostatnia pozycja ląduje w ROGU pod kciukiem.
  // Historia jest tam celowo — powrót jest najczęstszą czynnością nawigacyjną. Szybka nawigacja
  // stoi między gwiazdką a historią, dokładnie tak, jak poprosił właściciel po zobaczeniu paska
  // na żywo: „między gwiazdką (ulubione) a ikoną »wstecz« dodaj nową ikonę".
  const bliskie: PozycjaPaska[] = [{ rodzaj: "ulubione" }, { rodzaj: "nawigacja" }, { rodzaj: "historia" }];

  return { dalekie, bliskie };
}

/**
 * 103: LUSTRZENIE — zamienia dwie grupy na to, co faktycznie stoi po lewej i po prawej.
 *
 * Funkcja istnieje dlatego, że jej brak kosztował usterkę. Lustrzenie było wpisane wprost w JSX
 * `PasekKciuka`, a test sprawdzał `pozycjePaska`, czyli listę **przed** lustrzeniem — więc twierdził,
 * że historia stoi w rogu, podczas gdy w rogu stało co innego. Test sprawdzający wejście funkcji,
 * której wyjście jest gdzie indziej odwracane, daje **fałszywe pokrycie**: świeci na zielono i nie
 * pilnuje niczego.
 *
 * Obowiązują dwie reguły, po jednej na grupę. Pojemniki renderują swoje tablice **od lewej do
 * prawej**, więc „róg" to pierwsza pozycja pojemnika lewego albo ostatnia pojemnika prawego:
 *  - **róg po stronie kciuka należy do OSTATNIEJ pozycji `bliskie`** (historia),
 *  - **przeciwległy narożnik należy do PIERWSZEJ pozycji `dalekie`** (Strona główna) — jest najdalej
 *    od kciuka, więc trafia tam rzecz, po którą sięga się najrzadziej.
 *
 * Stąd asymetria odwróceń: przy ręce prawej `bliskie` idzie do prawego pojemnika bez zmian, a
 * `dalekie` do lewego bez zmian; przy lewej oba są odwrócone. Wygląda to jak brak symetrii i nią
 * nie jest — to ta sama reguła wyrażona w pojemniku, który liczy pozycje z drugiej strony.
 */
export function stronyPaska(
  dalekie: PozycjaPaska[],
  bliskie: PozycjaPaska[],
  reka: Reka,
): { lewa: PozycjaPaska[]; prawa: PozycjaPaska[] } {
  return reka === "left"
    ? { lewa: [...bliskie].reverse(), prawa: [...dalekie].reverse() }
    : { lewa: [...dalekie], prawa: [...bliskie] };
}
