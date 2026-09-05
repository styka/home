// 031: KONTRAKT AKCJI ASYSTENTA — jedno źródło prawdy o tym, jak akcja wygląda dla użytkownika
// i jakie wartości są dla niej dopuszczalne.
//
// Problem, który rozwiązuje: panel „Przejrzyj / popraw" pokazywał techniczne nazwy akcji
// (`update_task_status`), techniczne nazwy parametrów (`priority`) i techniczne wartości
// (`MEDIUM`, `TODO`) — czyli język bazy danych, nie aplikacji. Osobno brakowało wymuszenia, żeby
// asystent nie mógł zapisać wartości, której nie przyjąłby formularz w UI.
//
// Jeden rejestr zasila naraz:
//   • `ActionDrawer` — etykieta akcji, etykiety pól, kontrolka adekwatna do rodzaju pola,
//   • egzekutor (`/api/llm/home/execute`) — walidacja parametrów w jednym choke-poincie,
//   • bramkę `npm run check:actions` — każdy typ akcji MUSI mieć tu wpis.
//
// Zasada minimalizmu (C-53): opisujemy tylko to, co wymaga opisu. Pole nieopisane dostaje
// etykietę z `PARAM_LABELS` i kontrolkę tekstową; pole kończące się na `Id` jest ukrywane.

import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/types";
import type { AIAction } from "@/platform/ai/aiAction";

export type FieldControl =
  | "text"
  | "textarea"
  | "select"
  | "date"
  | "datetime"
  | "number"
  | "boolean"
  | "hidden";

export interface FieldOption {
  /** Wartość techniczna zapisywana do bazy (np. "MEDIUM"). */
  value: string;
  /** Etykieta widoczna dla użytkownika — taka, jaką widzi na ekranach aplikacji (np. „Średni"). */
  label: string;
}

export interface FieldSpec {
  label: string;
  control: FieldControl;
  /** Dozwolone wartości (dla `control: "select"`) — spoza tej listy walidacja odrzuca. */
  options?: FieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface ActionContract {
  /** Polska nazwa akcji widoczna dla użytkownika (np. „Zmień status zadania"). */
  label: string;
  /** Opisy pól — tylko te, które wymagają innej kontrolki/etykiety niż domyślna. */
  fields?: Record<string, FieldSpec>;
}

// ── Słowniki wartości ────────────────────────────────────────────────────────
// Re-używamy istniejących map etykiet z aplikacji (C-53) — dzięki temu użytkownik widzi w panelu
// akcji DOKŁADNIE te same nazwy, co na ekranach modułów.

function optionsFrom(labels: Record<string, string>): FieldOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export const TASK_STATUS_OPTIONS = optionsFrom(TASK_STATUS_LABELS);
export const TASK_PRIORITY_OPTIONS = optionsFrom(TASK_PRIORITY_LABELS);
export const ITEM_STATUS_OPTIONS = optionsFrom({
  NEEDED: "Do kupienia",
  IN_CART: "W koszyku",
  DONE: "Kupione",
  MISSING: "Brak w sklepie",
});
export const MEAL_SLOT_OPTIONS = optionsFrom({
  breakfast: "Śniadanie",
  lunch: "Obiad",
  dinner: "Kolacja",
  snack: "Przekąska",
});
export const HEALTH_EVENT_KIND_OPTIONS = optionsFrom({ VISIT: "Wizyta", TEST: "Badanie" });
export const HEALTH_STATUS_OPTIONS = optionsFrom({
  PLANNED: "Zaplanowane",
  DONE: "Wykonane",
  CANCELLED: "Anulowane",
});
export const MEDICATION_KIND_OPTIONS = optionsFrom({
  MEDICATION: "Lek",
  CARE: "Pielęgnacja",
});
export const MEDICATION_FREQ_OPTIONS = optionsFrom({
  DAILY: "Codziennie",
  WEEKLY: "W wybrane dni tygodnia",
  HOURLY: "Co określoną liczbę godzin",
});
// 113: słowniki modułu Rośliny. Wartości techniczne (te, którymi mówi model) tłumaczone na słowa,
// które użytkownik widzi w podglądzie planu — bez tego zatwierdzałby akcję opisaną kodem.
export const PLANT_SPACE_MODE_OPTIONS = optionsFrom({
  home: "Mieszkanie",
  garden: "Ogród",
  production: "Produkcja / kwiaciarnia",
  field: "Pole",
});
export const PLANT_QUANTITY_UNIT_OPTIONS = optionsFrom({
  szt: "sztuki",
  m2: "metry kwadratowe",
  ha: "hektary",
});
export const PLANT_CARE_KIND_OPTIONS = optionsFrom({
  WATERING: "Podlewanie",
  FERTILIZING: "Nawożenie",
  PRUNING: "Przycinanie",
  REPOTTING: "Przesadzanie",
  SPRAYING: "Oprysk",
  MULCHING: "Ściółkowanie",
  SOWING: "Siew",
  HARVEST: "Zbiór",
  CUSTOM: "Inny zabieg",
});
export const PLANT_MEASUREMENT_KIND_OPTIONS = optionsFrom({
  HEIGHT_CM: "Wysokość",
  LEAF_COUNT: "Liczba liści",
  TRUNK_CM: "Obwód pnia",
  SOIL_MOISTURE: "Wilgotność podłoża",
  TEMP_C: "Temperatura",
  PH: "Odczyn pH",
  LIGHT: "Natężenie światła",
  OTHER: "Inny pomiar",
});
export const PET_SPECIES_OPTIONS = optionsFrom({
  dog: "Pies",
  cat: "Kot",
  snake: "Wąż",
  lizard: "Jaszczurka",
  turtle: "Żółw",
  fish: "Ryba",
  bird: "Ptak",
  rodent: "Gryzoń",
  rabbit: "Królik",
  other: "Inne",
});
export const PET_SEX_OPTIONS = optionsFrom({ male: "Samiec", female: "Samica", unknown: "Nieznana" });
export const PET_STATUS_OPTIONS = optionsFrom({
  ACTIVE: "Aktywne",
  SOLD: "Sprzedane",
  DECEASED: "Nie żyje",
  ARCHIVED: "Zarchiwizowane",
});
export const PET_TREATMENT_KIND_OPTIONS = optionsFrom({
  MEDICATION: "Lek",
  VACCINE: "Szczepienie",
  DEWORMER: "Odrobaczanie",
  PARASITE: "Przeciwpasożytniczo",
  SUPPLEMENT: "Suplement",
});
export const PET_CARE_CATEGORY_OPTIONS = optionsFrom({
  FEEDING: "Karmienie",
  CLEANING: "Czyszczenie",
  GROOMING: "Pielęgnacja",
  WALK: "Spacer",
  WATER_CHANGE: "Wymiana wody",
  UVB_REPLACEMENT: "Wymiana UVB",
  WEIGHING: "Ważenie",
  CUSTOM: "Inne",
});
export const PET_HEALTH_TYPE_OPTIONS = optionsFrom({
  CONDITION: "Schorzenie",
  ALLERGY: "Alergia",
  SYMPTOM: "Objaw",
  INJURY: "Uraz",
  NOTE: "Notatka",
  MILESTONE: "Kamień milowy",
});
export const PET_FEEDING_OUTCOME_OPTIONS = optionsFrom({
  FED: "Zjadło",
  REFUSED: "Odmówiło",
  REGURGITATED: "Zwróciło",
});
export const ENCLOSURE_TYPE_OPTIONS = optionsFrom({
  TERRARIUM: "Terrarium",
  AQUARIUM: "Akwarium",
  PALUDARIUM: "Paludarium",
  CAGE: "Klatka",
  AVIARY: "Woliera",
  TANK: "Zbiornik",
});
export const WORKSHOP_TYPE_OPTIONS = optionsFrom({
  stolarski: "Stolarski",
  samochodowy: "Samochodowy",
  malarski: "Malarski",
  elektroniczny: "Elektroniczny",
  slusarski: "Ślusarski",
  ceramiczny: "Ceramiczny",
  krawiecki: "Krawiecki",
  jubilerski: "Jubilerski",
  ogolny: "Ogólny",
});
export const WORKSHOP_ITEM_KIND_OPTIONS = optionsFrom({
  tool: "Narzędzie",
  machine: "Maszyna",
  consumable: "Materiał eksploatacyjny",
  safety: "Ochrona (BHP)",
  material: "Materiał",
});
export const WORKSHOP_PROJECT_STATUS_OPTIONS = optionsFrom({
  planned: "Planowany",
  active: "W toku",
  done: "Zakończony",
});
export const WATCHER_HORIZON_OPTIONS = optionsFrom({
  today: "Dziś",
  tomorrow: "Jutro",
  weekend: "Weekend",
  week: "Tydzień",
});

// ── Wspólny słownik etykiet parametrów ───────────────────────────────────────
// Fallback dla pól, których kontrakt nie opisuje wprost. Klucz = nazwa parametru.
export const PARAM_LABELS: Record<string, string> = {
  // 102: nazwa jest celowo jednoznaczna („adres" znaczyłby co innego w innych akcjach), dzięki
  // czemu etykieta może żyć w słowniku WSPÓLNYM. Wpis per akcja (`fields`) byłby tu pułapką:
  // parser kontraktu w bramce dopasowuje blok wpisu do pierwszej linii `  },`, więc wpis
  // jednoliniowy stojący wyżej połyka następne i `fields` przestaje być widziane.
  adresKanalu: "Odnośnik lub uchwyt kanału",
  // 113 (Rośliny): nazwy są jednoznaczne w skali całej aplikacji, więc etykiety mieszkają
  // w słowniku WSPÓLNYM. `rodzaj` i `jednostka` mają dodatkowo listy wartości w `fields` swoich
  // akcji — tam, gdzie znaczą co innego (rodzaj zabiegu vs rodzaj pomiaru).
  przestrzen: "Przestrzeń roślinna",
  miejsce: "Miejsce",
  gatunek: "Gatunek",
  ilosc: "Ilość",
  jednostka: "Jednostka",
  tryb: "Tryb",
  rodzaj: "Rodzaj",
  wartosc: "Wartość",
  roslina: "Roślina",
  nazwa: "Nazwa",
  notatka: "Notatka",
  amount: "Kwota",
  active: "Aktywne",
  // 112: pola profilu zwierzęcia — nazwy znaczą to samo w `add_pet` i `update_pet`, więc
  // etykieta jest wspólna; kontrolki (data, przełącznik) dokłada `PET_PROFILE_FIELDS`.
  acquiredAt: "Data nabycia",
  acquiredFrom: "Skąd pochodzi",
  archived: "Zarchiwizowane",
  bookToPortfel: "Zaksięguj wydatek w Portfelu",
  birthApprox: "Data urodzenia jest przybliżona",
  birthDate: "Data urodzenia",
  body: "Treść",
  breed: "Rasa / odmiana",
  buyerContact: "Kontakt kupującego",
  buyerName: "Kupujący",
  category: "Kategoria",
  color: "Kolor",
  company: "Firma",
  contact: "Kontakt",
  content: "Treść",
  cost: "Koszt",
  currentAmount: "Zebrana kwota",
  customTitle: "Nazwa posiłku",
  date: "Data",
  days: "Liczba dni",
  daysOfWeek: "Dni tygodnia",
  deadline: "Termin",
  deckName: "Talia",
  delta: "Zmiana ilości",
  description: "Opis",
  doctorName: "Lekarz",
  dosage: "Dawka",
  dueDate: "Termin",
  durationMin: "Czas trwania (min)",
  elementName: "Konto / element portfela",
  email: "E-mail",
  emoji: "Ikona (emoji)",
  enabled: "Włączone",
  enclosureName: "Zbiornik",
  endDate: "Data zakończenia",
  everyDays: "Powtarzaj co (dni)",
  example: "Przykład użycia",
  expiresAt: "Data ważności",
  facility: "Placówka",
  foodType: "Rodzaj pokarmu",
  freqType: "Częstotliwość",
  goalName: "Cel oszczędnościowy",
  groupName: "Grupa notatek",
  homepageUrl: "Adres strony",
  horizon: "Zakres czasu",
  hourlyEnd: "Godzina zakończenia",
  hourlyStart: "Godzina rozpoczęcia",
  identifier: "Obrączka / tag",
  icon: "Ikona",
  initialBalance: "Stan początkowy",
  instructions: "Zalecenia",
  interval: "Co ile",
  isOptional: "Opcjonalny",
  kind: "Rodzaj",
  descriptor: "Opis źródła",
  lengthCm: "Długość (cm)",
  limitAmount: "Limit",
  listName: "Lista",
  liters: "Litry",
  location: "Miejsce",
  lotNo: "Numer partii",
  make: "Marka",
  model: "Model",
  name: "Nazwa",
  nativeLang: "Język znany",
  newName: "Nowa nazwa",
  newTitle: "Nowy tytuł",
  note: "Notatka",
  notes: "Notatki",
  odometer: "Przebieg",
  openAfter: "Otwórz po utworzeniu",
  parentSearch: "Zadanie nadrzędne",
  partner: "Partner",
  phone: "Telefon",
  plate: "Numer rejestracyjny",
  preyType: "Rodzaj karmy",
  presetKey: "Gotowy obserwator",
  price: "Cena",
  priority: "Priorytet",
  projectName: "Projekt",
  projectNames: "Projekty",
  quantity: "Ilość",
  query: "Zapytanie",
  rawText: "Co dodać",
  reason: "Powód",
  removeTags: "Etykiety do usunięcia",
  replace: "Zastąp cały zestaw",
  rssUrl: "Adres kanału RSS",
  scheduledAt: "Termin",
  semanticFilter: "Filtr tematu",
  serialNo: "Numer seryjny",
  servings: "Porcje",
  serviceType: "Rodzaj serwisu",
  skipPantry: "Pomiń to, co w spiżarni",
  slot: "Pora",
  specialty: "Specjalizacja",
  startDate: "Data rozpoczęcia",
  status: "Status",
  steps: "Liczba szczebli",
  tags: "Etykiety",
  targetAmount: "Kwota docelowa",
  targetLang: "Język uczony",
  targetListName: "Lista docelowa",
  term: "Słowo",
  text: "Treść",
  timesOfDay: "Pory dnia",
  title: "Tytuł",
  toLocation: "Miejsce docelowe",
  totalCost: "Koszt całkowity",
  toWarehouse: "Magazyn docelowy",
  translation: "Tłumaczenie",
  type: "Rodzaj",
  unit: "Jednostka",
  vehicleName: "Pojazd",
  warehouse: "Magazyn",
  weightGrams: "Waga (g)",
  weightKg: "Waga (kg)",
  words: "Fiszki",
  workshopName: "Warsztat",
  year: "Rok",
};

// Skróty do budowania wpisów.
const f = (label: string, control: FieldControl = "text", extra: Partial<FieldSpec> = {}): FieldSpec => ({
  label,
  control,
  ...extra,
});
const sel = (label: string, options: FieldOption[]): FieldSpec => ({ label, control: "select", options });
const num = (label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ label, control: "number", ...extra });
const bool = (label: string): FieldSpec => ({ label, control: "boolean" });
const day = (label: string): FieldSpec => ({ label, control: "date" });
const dt = (label: string): FieldSpec => ({ label, control: "datetime" });
const longText = (label: string): FieldSpec => ({ label, control: "textarea" });

/**
 * 112: pola profilu zwierzęcia wspólne dla `add_pet` i `update_pet`.
 *
 * Jeden zestaw, bo oba wejścia opisują ten sam profil — dwie kopie rozjechałyby się przy pierwszej
 * zmianie, a objawem byłoby pole widoczne przy zakładaniu i niewidoczne przy poprawianiu.
 */
const PET_PROFILE_FIELDS: Record<string, FieldSpec> = {
  birthDate: day("Data urodzenia"),
  birthApprox: bool("Data urodzenia jest przybliżona"),
  acquiredAt: day("Data nabycia"),
  acquiredFrom: f("Skąd pochodzi"),
  microchipId: f("Numer mikroczipa"),
  identifier: f("Obrączka / tag"),
  color: f("Umaszczenie"),
  notes: longText("Notatki"),
};

/**
 * Rejestr wszystkich typów akcji asystenta. Kompletność wymusza bramka
 * `scripts/check-action-coverage.js` — nowy typ akcji bez wpisu = build pada.
 */
export const ACTION_CONTRACTS: Record<string, ActionContract> = {
  // ── ZAKUPY ────────────────────────────────────────────────────────────────
  add_item: { label: "Dodaj pozycję do listy zakupów", fields: { rawText: f("Co dodać") } },
  add_items: { label: "Dodaj wiele pozycji do listy zakupów", fields: { rawText: f("Pozycje (po jednej w linii)") } },
  update_item_status: { label: "Zmień status pozycji", fields: { status: sel("Status", ITEM_STATUS_OPTIONS) } },
  update_item: { label: "Zmień pozycję na liście", fields: { quantity: num("Ilość", { min: 0 }) } },
  delete_item: { label: "Usuń pozycję z listy" },
  create_list: { label: "Utwórz listę zakupów" },
  rename_list: { label: "Zmień nazwę listy" },
  archive_list: { label: "Zarchiwizuj listę" },
  delete_list: { label: "Usuń listę zakupów" },
  clear_done_items: { label: "Usuń kupione pozycje z listy" },
  mark_all_in_cart: { label: "Oznacz wszystko jako w koszyku" },
  move_item: { label: "Przenieś pozycję na inną listę" },
  unarchive_list: { label: "Przywróć listę z archiwum" },
  complete_shopping: { label: "Zakończ zakupy", fields: { bookToPortfel: bool("Zaksięguj wydatek w Portfelu") } },

  // ── ZADANIA ───────────────────────────────────────────────────────────────
  create_task: {
    label: "Dodaj zadanie",
    fields: {
      description: longText("Opis"),
      priority: sel("Priorytet", TASK_PRIORITY_OPTIONS),
      dueDate: dt("Termin"),
      openAfter: bool("Otwórz po utworzeniu"),
    },
  },
  update_task: {
    label: "Zmień zadanie",
    fields: {
      description: longText("Opis"),
      priority: sel("Priorytet", TASK_PRIORITY_OPTIONS),
      status: sel("Status", TASK_STATUS_OPTIONS),
      dueDate: dt("Termin"),
    },
  },
  update_task_status: { label: "Zmień status zadania", fields: { status: sel("Status", TASK_STATUS_OPTIONS) } },
  shift_task_due_date: { label: "Przesuń termin zadania", fields: { days: num("Przesunięcie (dni)") } },
  shift_task_priority: { label: "Zmień priorytet zadania o kilka szczebli", fields: { steps: num("Liczba szczebli", { min: -4, max: 4 }) } },
  delete_task: { label: "Usuń zadanie" },
  set_task_tags: { label: "Ustaw etykiety zadania", fields: { replace: bool("Zastąp cały zestaw") } },
  add_task_comment: { label: "Dodaj komentarz do zadania", fields: { content: longText("Komentarz") } },
  submit_feedback: { label: "Wyślij zgłoszenie do administratora", fields: { description: longText("Opis zgłoszenia") } },
  create_project: { label: "Utwórz projekt zadań" },
  update_project: { label: "Zmień projekt zadań" },
  delete_project: { label: "Usuń projekt zadań" },

  // ── NOTATKI ───────────────────────────────────────────────────────────────
  create_note: { label: "Utwórz notatkę", fields: { content: longText("Treść") } },
  append_to_note: { label: "Dopisz do notatki", fields: { content: longText("Co dopisać") } },
  update_note: { label: "Zmień notatkę", fields: { content: longText("Treść") } },
  delete_note: { label: "Usuń notatkę" },
  toggle_pin: { label: "Przypnij / odepnij notatkę" },
  set_note_tags: { label: "Ustaw etykiety notatki", fields: { replace: bool("Zastąp cały zestaw") } },
  create_note_group: { label: "Utwórz grupę notatek" },
  update_note_group: { label: "Zmień grupę notatek" },
  delete_note_group: { label: "Usuń grupę notatek" },

  // ── NAWYKI ────────────────────────────────────────────────────────────────
  toggle_habit: { label: "Odhacz / cofnij nawyk na dziś" },
  create_habit: { label: "Utwórz nawyk" },
  update_habit: { label: "Zmień nawyk" },
  archive_habit: { label: "Archiwizuj nawyk", fields: { archived: bool("Zarchiwizowany") } },
  delete_habit: { label: "Usuń nawyk" },
  create_task_from_habit: { label: "Utwórz zadanie z nawyku", fields: { dueDate: day("Termin") } },

  // ── PORTFEL ───────────────────────────────────────────────────────────────
  add_expense: { label: "Zapisz wydatek", fields: { amount: num("Kwota", { min: 0 }) } },
  add_income: { label: "Zapisz przychód", fields: { amount: num("Kwota", { min: 0 }) } },
  create_wallet_element: { label: "Utwórz konto w portfelu", fields: { initialBalance: num("Stan początkowy") } },
  update_wallet_element: { label: "Zmień konto w portfelu" },
  set_wallet_balance: { label: "Ustaw stan konta", fields: { amount: num("Stan") } },
  archive_wallet_element: { label: "Archiwizuj konto w portfelu", fields: { archived: bool("Zarchiwizowane") } },
  delete_wallet_element: { label: "Usuń konto z portfela" },
  create_budget: { label: "Utwórz budżet", fields: { limitAmount: num("Limit", { min: 0 }) } },
  update_budget: { label: "Zmień budżet", fields: { limitAmount: num("Limit", { min: 0 }) } },
  delete_budget: { label: "Usuń budżet" },
  create_goal: {
    label: "Utwórz cel oszczędnościowy",
    fields: { targetAmount: num("Kwota docelowa", { min: 0 }), currentAmount: num("Zebrana kwota", { min: 0 }), deadline: day("Termin") },
  },
  update_goal: { label: "Zmień cel oszczędnościowy", fields: { targetAmount: num("Kwota docelowa", { min: 0 }), deadline: day("Termin") } },
  delete_goal: { label: "Usuń cel oszczędnościowy" },
  contribute_goal: { label: "Dopłać do celu", fields: { amount: num("Kwota") } },

  // ── KUCHNIA ───────────────────────────────────────────────────────────────
  plan_meal: { label: "Zaplanuj posiłek", fields: { date: day("Data"), slot: sel("Pora", MEAL_SLOT_OPTIONS) } },
  add_pantry_item: { label: "Dodaj produkt do spiżarni", fields: { quantity: num("Ilość", { min: 0 }), expiresAt: day("Data ważności") } },
  create_recipe: { label: "Utwórz przepis", fields: { description: longText("Opis"), body: longText("Treść przepisu"), servings: num("Porcje", { min: 1 }) } },
  update_recipe: { label: "Zmień przepis", fields: { description: longText("Opis"), servings: num("Porcje", { min: 1 }) } },
  archive_recipe: { label: "Archiwizuj przepis" },
  duplicate_recipe: { label: "Skopiuj przepis" },
  mark_recipe_cooked: { label: "Oznacz przepis jako ugotowany", fields: { servings: num("Porcje", { min: 1 }) } },
  shop_for_recipe: { label: "Dodaj składniki przepisu do zakupów", fields: { servings: num("Porcje", { min: 1 }), skipPantry: bool("Pomiń to, co w spiżarni") } },
  add_ingredient: { label: "Dopisz składnik do przepisu", fields: { quantity: num("Ilość", { min: 0 }), isOptional: bool("Opcjonalny") } },
  add_step: { label: "Dopisz krok przepisu", fields: { text: longText("Treść kroku"), durationMin: num("Czas (min)", { min: 0 }) } },
  delete_recipe: { label: "Usuń przepis" },
  mark_meal_cooked: { label: "Oznacz posiłek jako ugotowany" },
  delete_meal_plan: { label: "Usuń posiłek z jadłospisu" },
  update_pantry_item: { label: "Zmień produkt w spiżarni", fields: { quantity: num("Ilość", { min: 0 }), expiresAt: day("Data ważności") } },
  consume_pantry: { label: "Zużyj produkt ze spiżarni", fields: { quantity: num("Ilość", { min: 0 }) } },
  delete_pantry_item: { label: "Usuń produkt ze spiżarni" },
  generate_shopping_from_plan: { label: "Zrób listę zakupów z jadłospisu", fields: { days: num("Liczba dni", { min: 1, max: 60 }), skipPantry: bool("Pomiń to, co w spiżarni") } },
  set_pantry_quantity: { label: "Ustaw ilość w spiżarni", fields: { quantity: num("Ilość", { min: 0 }) } },
  move_item_to_pantry: { label: "Przenieś zakup do spiżarni" },
  auto_replenish_pantry: { label: "Uzupełnij zakupy z braków w spiżarni" },
  mark_meal_skipped: { label: "Oznacz posiłek jako pominięty" },
  update_meal_plan_entry: { label: "Zmień posiłek w jadłospisie", fields: { slot: sel("Pora", MEAL_SLOT_OPTIONS) } },
  move_meal_plan_entry: { label: "Przenieś posiłek", fields: { date: day("Data"), slot: sel("Pora", MEAL_SLOT_OPTIONS) } },
  create_cookbook: { label: "Utwórz książkę kucharską", fields: { description: longText("Opis") } },
  update_cookbook: { label: "Zmień książkę kucharską", fields: { description: longText("Opis") } },
  delete_cookbook: { label: "Usuń książkę kucharską" },

  // ── FLOTA ─────────────────────────────────────────────────────────────────
  add_fuel_log: {
    label: "Zapisz tankowanie",
    fields: { liters: num("Litry", { min: 0 }), totalCost: num("Koszt całkowity", { min: 0 }), odometer: num("Przebieg", { min: 0 }) },
  },
  add_service_record: { label: "Zapisz wpis serwisowy", fields: { cost: num("Koszt", { min: 0 }), odometer: num("Przebieg", { min: 0 }) } },
  create_vehicle: { label: "Dodaj pojazd", fields: { year: num("Rok", { min: 1900, max: 2100 }) } },
  update_vehicle: { label: "Zmień pojazd", fields: { odometer: num("Przebieg", { min: 0 }) } },
  delete_vehicle: { label: "Usuń pojazd" },

  // ── MAGAZYN ───────────────────────────────────────────────────────────────
  add_storage_item: { label: "Dodaj pozycję do magazynu", fields: { quantity: num("Ilość", { min: 0 }) } },
  adjust_storage: { label: "Skoryguj stan magazynowy", fields: { delta: num("Zmiana ilości") } },
  update_storage_item: { label: "Zmień pozycję magazynu" },
  delete_storage_item: { label: "Usuń pozycję z magazynu" },
  transfer_storage: { label: "Przenieś pozycję magazynową", fields: { quantity: num("Ilość", { min: 0 }) } },
  add_batch: { label: "Dodaj partię (lot)", fields: { quantity: num("Ilość", { min: 0 }), expiresAt: day("Data ważności") } },
  add_low_stock_to_shopping: { label: "Dorzuć braki magazynowe do zakupów" },
  add_supplier: { label: "Dodaj dostawcę" },
  update_supplier: { label: "Zmień dostawcę" },
  delete_supplier: { label: "Usuń dostawcę" },

  // ── WARSZTATY ─────────────────────────────────────────────────────────────
  create_workshop: { label: "Utwórz warsztat", fields: { type: sel("Rodzaj warsztatu", WORKSHOP_TYPE_OPTIONS) } },
  add_workshop_item: {
    label: "Dodaj wyposażenie warsztatu",
    fields: { kind: sel("Rodzaj", WORKSHOP_ITEM_KIND_OPTIONS), quantity: num("Ilość", { min: 0 }) },
  },
  update_workshop: { label: "Zmień warsztat", fields: { type: sel("Rodzaj warsztatu", WORKSHOP_TYPE_OPTIONS) } },
  delete_workshop: { label: "Usuń warsztat" },
  update_workshop_item: { label: "Zmień wyposażenie warsztatu", fields: { kind: sel("Rodzaj", WORKSHOP_ITEM_KIND_OPTIONS) } },
  delete_workshop_item: { label: "Usuń wyposażenie warsztatu" },
  adjust_workshop_item: { label: "Skoryguj ilość wyposażenia", fields: { delta: num("Zmiana ilości") } },
  add_workshop_project: {
    label: "Dodaj projekt w warsztacie",
    fields: { description: longText("Opis"), status: sel("Status", WORKSHOP_PROJECT_STATUS_OPTIONS) },
  },
  update_workshop_project: {
    label: "Zmień projekt w warsztacie",
    fields: { description: longText("Opis"), status: sel("Status", WORKSHOP_PROJECT_STATUS_OPTIONS) },
  },
  delete_workshop_project: { label: "Usuń projekt w warsztacie" },

  // ── ZDROWIE ───────────────────────────────────────────────────────────────
  create_health_event: {
    label: "Zaplanuj wizytę lub badanie",
    fields: { kind: sel("Rodzaj", HEALTH_EVENT_KIND_OPTIONS), scheduledAt: dt("Termin"), notes: longText("Notatki") },
  },
  update_health_event: {
    label: "Zmień wizytę lub badanie",
    fields: { scheduledAt: dt("Termin"), status: sel("Status", HEALTH_STATUS_OPTIONS), notes: longText("Notatki") },
  },
  set_health_status: { label: "Zmień status wizyty / badania", fields: { status: sel("Status", HEALTH_STATUS_OPTIONS) } },
  delete_health_event: { label: "Usuń wizytę lub badanie" },
  create_medication: {
    label: "Dodaj lek lub czynność pielęgnacyjną",
    fields: {
      kind: sel("Rodzaj", MEDICATION_KIND_OPTIONS),
      freqType: sel("Częstotliwość", MEDICATION_FREQ_OPTIONS),
      interval: num("Co ile", { min: 1 }),
      startDate: day("Data rozpoczęcia"),
      endDate: day("Data zakończenia"),
      instructions: longText("Zalecenia"),
    },
  },
  log_dose: { label: "Odhacz dawkę", fields: { date: day("Data") } },
  unlog_dose: { label: "Cofnij odhaczenie dawki", fields: { date: day("Data") } },
  update_medication: { label: "Zmień lek lub pielęgnację", fields: { active: bool("Aktywny"), instructions: longText("Zalecenia") } },
  delete_medication: { label: "Usuń lek lub pielęgnację" },

  // ── JĘZYKI ────────────────────────────────────────────────────────────────
  create_deck: { label: "Utwórz talię fiszek" },
  add_word: { label: "Dodaj fiszkę" },
  delete_word: { label: "Usuń fiszkę" },
  update_deck: { label: "Zmień talię fiszek" },
  delete_deck: { label: "Usuń talię fiszek" },
  update_word: { label: "Zmień fiszkę" },
  bulk_add_words: { label: "Dodaj wiele fiszek naraz" },

  // ── WIADOMOŚCI ────────────────────────────────────────────────────────────
  create_news_topic: { label: "Dodaj monitorowany temat", fields: { semanticFilter: longText("Filtr tematu") } },
  delete_news_topic: { label: "Usuń monitorowany temat" },
  update_news_topic: { label: "Zmień monitorowany temat", fields: { semanticFilter: longText("Filtr tematu") } },
  refresh_news: { label: "Odśwież wiadomości" },
  create_news_source: { label: "Dodaj źródło wiadomości", fields: { descriptor: f("Opis źródła") } },
  update_news_source: { label: "Zmień źródło wiadomości", fields: { descriptor: f("Opis źródła"), enabled: bool("Włączone") } },
  delete_news_source: { label: "Usuń źródło wiadomości" },

  // ── YOUTUBE ───────────────────────────────────────────────────────────────
  add_youtube_channel: { label: "Dodaj kanał YouTube" },
  refresh_youtube: { label: "Odśwież YouTube" },
  mark_youtube_watched: { label: "Oznacz film jako obejrzany" },

  // ── ROŚLINY ───────────────────────────────────────────────────────────────
  // 113: żadna z tych akcji nie jest destrukcyjna. Usuwanie rośliny i przestrzeni świadomie NIE
  // wchodzi do katalogu asystenta — nie ma go w kryteriach akceptacji, a dopisanie wymagałoby
  // rozszerzenia `DESTRUCTIVE_ACTION_TYPES` bez potrzeby (C-53).
  create_plant_space: { label: "Załóż przestrzeń roślinną", fields: { tryb: sel("Tryb", PLANT_SPACE_MODE_OPTIONS) } },
  create_plant: { label: "Dodaj roślinę", fields: { jednostka: sel("Jednostka", PLANT_QUANTITY_UNIT_OPTIONS), notatka: longText("Notatki") } },
  log_plant_care: { label: "Odnotuj zabieg przy roślinie", fields: { rodzaj: sel("Rodzaj zabiegu", PLANT_CARE_KIND_OPTIONS), notatka: longText("Notatka") } },
  add_plant_measurement: { label: "Zapisz pomiar rośliny", fields: { rodzaj: sel("Rodzaj pomiaru", PLANT_MEASUREMENT_KIND_OPTIONS) } },

  // ── POGODA ────────────────────────────────────────────────────────────────
  add_weather_location: { label: "Dodaj lokalizację pogodową" },
  delete_weather_location: { label: "Usuń lokalizację pogodową" },
  set_default_weather_location: { label: "Ustaw domyślną lokalizację pogodową" },
  add_weather_watcher: { label: "Dodaj gotowego obserwatora pogody" },
  add_custom_watcher: { label: "Dodaj własnego obserwatora pogody", fields: { query: longText("Zapytanie"), horizon: sel("Zakres", WATCHER_HORIZON_OPTIONS) } },
  update_watcher: { label: "Zmień obserwatora pogody", fields: { query: longText("Zapytanie"), horizon: sel("Zakres", WATCHER_HORIZON_OPTIONS), enabled: bool("Włączony") } },
  delete_weather_watcher: { label: "Usuń obserwatora pogody" },

  // ── KONTAKTY ──────────────────────────────────────────────────────────────
  create_contact: { label: "Dodaj kontakt", fields: { notes: longText("Notatki") } },
  update_contact: { label: "Zmień kontakt", fields: { notes: longText("Notatki") } },
  delete_contact: { label: "Usuń kontakt" },

  // ── RAPORTY ───────────────────────────────────────────────────────────────
  save_report: { label: "Zapisz raport", fields: { content: longText("Treść raportu") } },

  // ── ZWIERZĘTA ─────────────────────────────────────────────────────────────
  // 112: pola PROFILU (data urodzenia, pochodzenie, mikroczip, umaszczenie, notatki) — ten rejestr
  // rysuje panel potwierdzenia I waliduje po stronie serwera, więc pole opisane w prompcie bez
  // wpisu tutaj byłoby obietnicą bez pokrycia: model by je podał, a użytkownik nigdy nie zobaczył.
  add_pet: {
    label: "Dodaj zwierzę",
    fields: {
      species: sel("Gatunek", PET_SPECIES_OPTIONS),
      sex: sel("Płeć", PET_SEX_OPTIONS),
      ...PET_PROFILE_FIELDS,
    },
  },
  update_pet: { label: "Zmień zwierzę", fields: { sex: sel("Płeć", PET_SEX_OPTIONS), ...PET_PROFILE_FIELDS } },
  set_pet_status: { label: "Zmień status zwierzęcia", fields: { status: sel("Status", PET_STATUS_OPTIONS) } },
  delete_pet: { label: "Usuń zwierzę" },
  log_weight: {
    label: "Zapisz pomiar zwierzęcia",
    fields: { weightKg: num("Waga (kg)", { min: 0 }), weightGrams: num("Waga (g)", { min: 0 }), lengthCm: num("Długość (cm)", { min: 0 }) },
  },
  schedule_treatment: {
    label: "Zaplanuj lek lub zabieg",
    fields: { kind: sel("Rodzaj", PET_TREATMENT_KIND_OPTIONS), dueDate: day("Termin"), everyDays: num("Powtarzaj co (dni)", { min: 1 }) },
  },
  log_treatment_done: { label: "Odhacz lek lub zabieg" },
  schedule_care_task: {
    label: "Zaplanuj rutynę opieki",
    fields: { category: sel("Rodzaj", PET_CARE_CATEGORY_OPTIONS), dueDate: day("Termin"), everyDays: num("Powtarzaj co (dni)", { min: 1 }) },
  },
  log_feeding: { label: "Zapisz karmienie", fields: { outcome: sel("Efekt", PET_FEEDING_OUTCOME_OPTIONS) } },
  record_vet_visit: { label: "Zapisz wizytę u weterynarza", fields: { date: day("Data"), cost: num("Koszt", { min: 0 }) } },
  log_health_note: { label: "Dodaj wpis do dziennika zdrowia", fields: { type: sel("Rodzaj", PET_HEALTH_TYPE_OPTIONS), description: longText("Opis") } },
  add_enclosure: { label: "Dodaj zbiornik", fields: { type: sel("Rodzaj", ENCLOSURE_TYPE_OPTIONS), volumeL: num("Pojemność (l)", { min: 0 }) } },
  update_enclosure: { label: "Zmień zbiornik", fields: { type: sel("Rodzaj", ENCLOSURE_TYPE_OPTIONS), notes: longText("Notatki") } },
  delete_enclosure: { label: "Usuń zbiornik" },
  assign_pet_to_enclosure: { label: "Przypisz zwierzę do zbiornika" },
  log_environment: {
    label: "Zapisz parametry środowiska",
    fields: {
      tempWarmC: num("Temperatura (ciepła strefa, °C)"),
      tempCoolC: num("Temperatura (chłodna strefa, °C)"),
      humidityPct: num("Wilgotność (%)", { min: 0, max: 100 }),
      uvbIndex: num("Indeks UVB", { min: 0 }),
      waterTempC: num("Temperatura wody (°C)"),
      ph: num("pH", { min: 0, max: 14 }),
      ammoniaPpm: num("Amoniak (ppm)", { min: 0 }),
      nitritePpm: num("Azotyny (ppm)", { min: 0 }),
      nitratePpm: num("Azotany (ppm)", { min: 0 }),
      salinityPpt: num("Zasolenie (ppt)", { min: 0 }),
      gh: num("Twardość ogólna (GH)", { min: 0 }),
      kh: num("Twardość węglanowa (KH)", { min: 0 }),
    },
  },
  record_sale: { label: "Zapisz sprzedaż zwierzęcia", fields: { price: num("Cena", { min: 0 }) } },
  add_breeding_pair: { label: "Utwórz parę hodowlaną" },
};

// ── API dla UI i egzekutora ──────────────────────────────────────────────────

/** Czy dany typ akcji ma wpis w kontrakcie. */
export function hasContract(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACTION_CONTRACTS, type);
}

/**
 * Polska nazwa akcji dla użytkownika. Gdy typ nie jest znany (nie powinno się zdarzyć — pilnuje
 * bramka) — zwracamy sam opis akcji od agenta, nigdy technicznej nazwy typu.
 */
export function actionLabel(action: Pick<AIAction, "type">): string {
  return ACTION_CONTRACTS[action.type]?.label ?? "Akcja";
}

/** Domyślna etykieta parametru: z kontraktu → ze wspólnego słownika → sama nazwa pola. */
export function paramLabel(type: string, key: string): string {
  return ACTION_CONTRACTS[type]?.fields?.[key]?.label ?? PARAM_LABELS[key] ?? key;
}

/**
 * 034: czy parametr ma opis PO POLSKU (w kontrakcie akcji albo we wspólnym słowniku).
 * Bramka `check:actions` pilnuje kompletności dla parametrów z KATALOGU akcji, ale model potrafi
 * wymyślić parametr, którego katalog nie zna (tak powstał `groupName` w zgłoszeniu) — takiego pola
 * nie wolno pokazać użytkownikowi pod nazwą z kodu, więc `fieldSpec` chowa je (patrz niżej).
 */
export function hasParamLabel(type: string, key: string): boolean {
  return !!(ACTION_CONTRACTS[type]?.fields?.[key] || PARAM_LABELS[key]);
}

const ID_KEY = /Id$/;
// 112: eksportowane — egzekutory modułów muszą uznawać za datę DOKŁADNIE to samo, co walidacja
// kontraktu. `new Date()` jest zbyt pobłażliwe: `new Date("ok. 2021")` zwraca 1 stycznia 2021, czyli
// model podający datę szacunkową wyprodukowałby precyzyjną datę, której nikt nie podał.
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Opis pola z sensownym fallbackiem:
 *  • wprost z kontraktu, gdy jest,
 *  • pola `…Id` → `hidden` (identyfikatory nic użytkownikowi nie mówią, ale przechodzą do backendu),
 *  • 034: pole BEZ polskiej etykiety → `hidden` (parametr wymyślony przez model; pokazanie go
 *    znaczyłoby wyciek nazwy technicznej do UI — wartość i tak jedzie do backendu bez zmian),
 *  • wartość wyglądająca na datę ISO → kontrolka daty,
 *  • wartość logiczna / liczbowa → odpowiednia kontrolka,
 *  • reszta → tekst.
 */
export function fieldSpec(type: string, key: string, value?: unknown): FieldSpec {
  const explicit = ACTION_CONTRACTS[type]?.fields?.[key];
  if (explicit) return explicit;
  if (ID_KEY.test(key)) return { label: paramLabel(type, key), control: "hidden" };
  if (!hasParamLabel(type, key)) return { label: key, control: "hidden" };

  const label = paramLabel(type, key);
  if (typeof value === "boolean") return { label, control: "boolean" };
  if (typeof value === "number") return { label, control: "number" };
  if (typeof value === "string" && ISO_DATE_RE.test(value.trim()) && !Number.isNaN(new Date(value).getTime())) {
    const hasTime = /[T ]\d{2}:\d{2}/.test(value) && !/[T ]00:00(:00)?(\.\d+)?(Z|[+-])?/.test(value);
    return { label, control: hasTime ? "datetime" : "date" };
  }
  return { label, control: "text" };
}

/** Etykieta wartości technicznej (np. „MEDIUM" → „Średni"). Nieznana wartość wraca bez zmian. */
export function valueLabel(type: string, key: string, value: unknown): string {
  const spec = ACTION_CONTRACTS[type]?.fields?.[key];
  const raw = value === null || value === undefined ? "" : String(value);
  if (!spec?.options) return raw;
  return spec.options.find((o) => o.value === raw)?.label ?? raw;
}

/**
 * Walidacja parametrów akcji wobec kontraktu. Zwraca listę komunikatów po polsku
 * (pusta lista = OK). Używana W DWÓCH miejscach: w `ActionDrawer` (od razu, dla UX) i w
 * egzekutorze na serwerze (rozstrzygająco — asystent nie ma drogi obejścia).
 */
export function validateActionParams(action: Pick<AIAction, "type" | "params">): string[] {
  const contract = ACTION_CONTRACTS[action.type];
  if (!contract) return [`Nieznana akcja „${action.type}".`];

  const errors: string[] = [];
  for (const [key, rawValue] of Object.entries(action.params ?? {})) {
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;
    const spec = contract.fields?.[key];
    if (!spec) continue; // pole nieopisane — nie wymyślamy reguł, których UI nie ma

    const asText = String(rawValue);

    if (spec.control === "select" && spec.options) {
      if (!spec.options.some((o) => o.value === asText)) {
        const allowed = spec.options.map((o) => `„${o.label}"`).join(", ");
        errors.push(`Pole „${spec.label}": wartość „${asText}" jest niedozwolona. Dopuszczalne: ${allowed}.`);
      }
      continue;
    }

    if (spec.control === "number") {
      const n = typeof rawValue === "number" ? rawValue : Number(asText.replace(",", "."));
      if (!Number.isFinite(n)) {
        errors.push(`Pole „${spec.label}": „${asText}" nie jest liczbą.`);
        continue;
      }
      if (spec.min !== undefined && n < spec.min) errors.push(`Pole „${spec.label}": wartość nie może być mniejsza niż ${spec.min}.`);
      if (spec.max !== undefined && n > spec.max) errors.push(`Pole „${spec.label}": wartość nie może być większa niż ${spec.max}.`);
      continue;
    }

    if (spec.control === "date" || spec.control === "datetime") {
      if (Number.isNaN(new Date(asText).getTime())) {
        errors.push(`Pole „${spec.label}": „${asText}" nie jest poprawną datą.`);
      }
      continue;
    }

    if (spec.control === "boolean") {
      if (typeof rawValue !== "boolean" && !["true", "false", "1", "0"].includes(asText.toLowerCase())) {
        errors.push(`Pole „${spec.label}": oczekiwano wartości tak/nie.`);
      }
      continue;
    }

    if (spec.maxLength !== undefined && asText.length > spec.maxLength) {
      errors.push(`Pole „${spec.label}": maksymalnie ${spec.maxLength} znaków.`);
    }
  }
  return errors;
}
