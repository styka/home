// 031: HUMANIZACJA WYJŚCIA ASYSTENTA — deterministyczne domknięcie tego, co model powinien zrobić
// sam, ale czego nie da się na nim wymusić promptem.
//
// Problem: asystent cytował w odpowiedziach język bazy danych — „Obie pozycje bez priorytetu (NONE)
// i w statusie TODO" — oraz identyfikatory rekordów (`cmrxo01jm00egksnw1ycs4dq8`). Użytkownik ma
// widzieć te same nazwy, co na ekranach aplikacji („Brak", „Do zrobienia"), i nigdy identyfikatorów.
//
// Lekcja z doświadczeń (2026-07-25): prefiksów/etykiet generowanych przez LLM nie zostawiamy na
// łasce modelu — wymuszamy je w JEDNYM choke-poincie. Prompt jest tylko tanią profilaktyką.
//
// Zasady bezpieczeństwa zamiany (żeby nie psuć treści użytkownika):
//   • zamieniamy tylko CAŁE słowa pisane WIELKIMI literami (`TODO`, a nie „todo" w zdaniu),
//   • pomijamy bloki i wstawki kodu (``` … ``` oraz `…`) — tam wartości techniczne są na miejscu,
//   • identyfikatory usuwamy razem z nawiasem/separatorem, w którym siedziały, żeby nie zostawiać
//     osieroconego „()" ani podwójnych spacji.

// Słowniki wartości technicznych → etykiet widocznych w aplikacji. Trzymamy je tutaj (a nie
// w kontrakcie akcji), bo humanizacja działa na TEKŚCIE, bez wiedzy o polu, z którego wartość
// pochodzi — potrzebny jest jeden, płaski słownik tokenów.
const TOKEN_LABELS: Record<string, string> = {
  // Zadania
  TODO: "Do zrobienia",
  IN_PROGRESS: "W trakcie",
  IN_VERIFICATION: "W weryfikacji",
  DONE: "Zrobione",
  CANCELLED: "Anulowane",
  DEFERRED: "Odłożone",
  NONE: "Brak",
  LOW: "Niski",
  MEDIUM: "Średni",
  HIGH: "Wysoki",
  URGENT: "Pilne",
  // Zakupy
  NEEDED: "Do kupienia",
  IN_CART: "W koszyku",
  MISSING: "Brak w sklepie",
  // Zdrowie / leki
  VISIT: "Wizyta",
  TEST: "Badanie",
  PLANNED: "Zaplanowane",
  MEDICATION: "Lek",
  CARE: "Pielęgnacja",
  DAILY: "Codziennie",
  WEEKLY: "Co tydzień",
  HOURLY: "Co kilka godzin",
  // Zwierzęta
  ACTIVE: "Aktywne",
  SOLD: "Sprzedane",
  DECEASED: "Nie żyje",
  ARCHIVED: "Zarchiwizowane",
  VACCINE: "Szczepienie",
  DEWORMER: "Odrobaczanie",
  PARASITE: "Przeciwpasożytniczo",
  SUPPLEMENT: "Suplement",
  FEEDING: "Karmienie",
  CLEANING: "Czyszczenie",
  GROOMING: "Pielęgnacja",
  WALK: "Spacer",
  WATER_CHANGE: "Wymiana wody",
  UVB_REPLACEMENT: "Wymiana UVB",
  WEIGHING: "Ważenie",
  CUSTOM: "Inne",
  CONDITION: "Schorzenie",
  ALLERGY: "Alergia",
  SYMPTOM: "Objaw",
  INJURY: "Uraz",
  NOTE: "Notatka",
  MILESTONE: "Kamień milowy",
  FED: "Zjadło",
  REFUSED: "Odmówiło",
  REGURGITATED: "Zwróciło",
  TERRARIUM: "Terrarium",
  AQUARIUM: "Akwarium",
  PALUDARIUM: "Paludarium",
  CAGE: "Klatka",
  AVIARY: "Woliera",
  TANK: "Zbiornik",
};

// Token techniczny: CAŁE słowo z WIELKICH liter i podkreśleń, min. 3 znaki (żeby nie ruszać
// skrótów typu „PL", „AI", „KG"). Sprawdzamy przynależność do słownika, więc nieznane akronimy
// (np. „PDF", „RSS") zostają nietknięte.
const TOKEN_RE = /\b[A-Z][A-Z_]{2,}\b/g;

// Identyfikator rekordu: cuid — 25 znaków, zaczyna się od „c", tylko małe litery i cyfry.
// Świadomie wąsko, żeby nie zjeść zwykłego długiego słowa ani skrótu.
const CUID_RE = /\bc[a-z0-9]{24,}\b/g;

/** Zamienia tokeny techniczne na polskie etykiety (tylko te znane ze słownika). */
function replaceTokens(text: string): string {
  return text.replace(TOKEN_RE, (token) => TOKEN_LABELS[token] ?? token);
}

/** Usuwa identyfikatory rekordów razem z konstrukcją, w której siedziały. */
function stripIds(text: string): string {
  let out = text;
  // Najpierw wzorce „w nawiasie" i „po separatorze" — usuwamy całą konstrukcję.
  out = out.replace(/\s*[([]\s*(?:id[:=]?\s*)?c[a-z0-9]{24,}\s*[)\]]/gi, "");
  out = out.replace(/\s*[—–-]\s*(?:id[:=]?\s*)?c[a-z0-9]{24,}\b/gi, "");
  out = out.replace(/\bid[:=]\s*c[a-z0-9]{24,}\b/gi, "");
  // Reszta — samotny identyfikator w tekście.
  out = out.replace(CUID_RE, "");
  // Porządki po usunięciu: podwójne spacje, spacja przed interpunkcją, puste nawiasy.
  out = out.replace(/\(\s*\)/g, "").replace(/\[\s*\]/g, "");
  out = out.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1");
  return out;
}

/**
 * Humanizuje tekst przeznaczony DLA UŻYTKOWNIKA (odpowiedź, raport, dopytanie, opisowy log
 * rozumowania). Bloki kodu i wstawki `code` zostają nietknięte — tam wartości techniczne są
 * uprawnione (np. przykład JSON w odpowiedzi na pytanie o API).
 */
export function humanizeAssistantText(text: string | null | undefined): string {
  if (!text) return text ?? "";

  // Rozbij na fragmenty: bloki ``` … ```, wstawki `…` i resztę. Zamieniamy tylko „resztę".
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts
    .map((part, i) => {
      const isCode = i % 2 === 1; // separatory z grupy przechwytującej trafiają na nieparzyste indeksy
      if (isCode) return part;
      return stripIds(replaceTokens(part));
    })
    .join("");
}

/**
 * Etykieta pojedynczej wartości technicznej (np. "TODO" → „Do zrobienia"). Używana w wynikach
 * read-toolów asystenta, żeby model od razu dostawał język aplikacji, a nie bazy danych.
 * Nieznana wartość wraca bez zmian (nie gubimy informacji).
 */
export function technicalToLabel(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return value ?? null;
  return TOKEN_LABELS[value] ?? value;
}

/** Czy tekst nadal zawiera coś technicznego — używane w testach i diagnostyce. */
export function hasTechnicalLeftovers(text: string): boolean {
  const stripped = text.replace(/(```[\s\S]*?```|`[^`\n]*`)/g, "");
  if (CUID_RE.test(stripped)) return true;
  CUID_RE.lastIndex = 0;
  const tokens = stripped.match(TOKEN_RE) ?? [];
  return tokens.some((t) => TOKEN_LABELS[t] !== undefined);
}
