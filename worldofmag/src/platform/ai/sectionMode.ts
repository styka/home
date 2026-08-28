// 041: TRYB ODŚWIEŻANIA sekcji AI — słownik pojęć: typ trybu, etykiety, lista sekcji.
//
// Do 040 odpowiedź na pytanie „kiedy ta sekcja ma zawołać model" brzmiała „zawsze, gdy nie ma
// zapisu" i była zaszyta w `rememberedContent`. Skutek: pierwsze wejście na stronę kosztowało, a
// użytkownik nie miał nad tym żadnej kontroli. Teraz decyduje tryb.
//
// Ten plik jest CZYSTY (bez bazy), bo etykiety trybów są potrzebne w komponencie klienckim.
// Rozstrzyganie kolejności — preferencja → `Config` → „na żądanie" — mieszka w
// `sectionModeResolver.ts` i jest tam w JEDNEJ funkcji celowo: rozsypane po komponentach dałoby
// sekcje, które „prawie" tak samo dziedziczą po administratorze.

import type { AiContentKind } from "@/platform/ai/contentMemory";

/** String + union TS (C-12) — nigdy enum Prisma. */
export type AiSectionMode = "onDemand" | "onChange" | "always";

/** Klucz w tabeli `Config` z domyślnymi systemowymi (JSON: rodzaj sekcji → tryb). */
export const AI_SECTION_MODES_CONFIG_KEY = "ai_section_default_modes";

/**
 * Tryb bezpieczny: nic nie powstaje bez kliknięcia. To ma być wartość, do której degradujemy w
 * każdej niepewnej sytuacji (brak wiersza, uszkodzony JSON, nieznana nazwa trybu) — bo błąd w tę
 * stronę kosztuje użytkownika jedno kliknięcie, a w drugą: pieniądze za treść, o którą nie prosił.
 */
export const DEFAULT_SECTION_MODE: AiSectionMode = "onDemand";

/** Sekcje AI objęte trybem. Kolejność jest kolejnością wyświetlania w ustawieniach. */
export const AI_SECTION_KINDS: AiContentKind[] = [
  "weather.ideas",
  "weather.watchers",
  "news.hotTopics",
  "storage.insights",
  "pets.insights",
  "kitchen.planWeek",
  // 113: obie sekcje Roślin POKAZUJĄ SIĘ przy wejściu na widok przestrzeni, więc podlegają trybowi
  // odświeżania — inaczej otwarcie przestrzeni kosztowałoby wywołanie modelu za każdym razem.
  "rosliny.planSezonu",
  "rosliny.wnioski",
];

/** Nazwy sekcji po polsku (C-32) — do ustawień użytkownika i administratora. */
export const AI_SECTION_LABELS: Record<AiContentKind, string> = {
  "weather.ideas": "Pogoda — „Co robić?”",
  "weather.watchers": "Pogoda — obserwatory",
  "news.hotTopics": "Wiadomości — gorące tematy",
  "storage.insights": "Magazynowanie — wnioski",
  "pets.insights": "Pety — wnioski",
  "kitchen.planWeek": "Kuchnia — plan tygodnia",
  // 102: etykieta jest wymagana, bo mapa pokrywa CAŁĄ unię rodzajów. Sekcji nie ma natomiast
  // w `AI_SECTION_KINDS` i to jest świadome: tryb odświeżania dotyczy sekcji, która pokazuje się
  // sama przy wejściu na stronę, a streszczenie filmu powstaje wyłącznie po kliknięciu długości.
  "youtube.streszczenie": "YouTube — streszczenie filmu",
  "rosliny.planSezonu": "Rośliny — plan sezonu",
  "rosliny.wnioski": "Rośliny — wnioski o przestrzeni",
};

/** Etykiety trybów wraz z wyjaśnieniem, bo sama nazwa nie mówi, co się stanie z kosztem. */
export const AI_SECTION_MODE_LABELS: Record<AiSectionMode, { label: string; hint: string }> = {
  onDemand: {
    label: "Na żądanie",
    hint: "Nic nie powstaje samo. Treść pojawia się dopiero po kliknięciu.",
  },
  onChange: {
    label: "Przy zmianie danych",
    hint: "Odświeża się samo, gdy zmienią się warunki, z których treść powstała.",
  },
  always: {
    label: "Zawsze świeże",
    hint: "Model odpowiada przy każdym wejściu. Najdroższy tryb.",
  },
};

export function isSectionMode(v: unknown): v is AiSectionMode {
  return v === "onDemand" || v === "onChange" || v === "always";
}
