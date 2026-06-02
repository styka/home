// Gotowe „obserwatory pogody" do szybkiego włączenia. Każdy preset to nazwany
// scenariusz aktywności z domyślnym horyzontem i opisem warunków, które LLM
// ocenia względem prognozy (tak samo jak obserwatory własne). Użytkownik może
// też dodać własny obserwator opisany naturalnym językiem.

export type Horizon = "today" | "tomorrow" | "weekend" | "week";

export const HORIZON_META: Record<Horizon, { label: string }> = {
  today: { label: "Dziś" },
  tomorrow: { label: "Jutro" },
  weekend: { label: "Weekend" },
  week: { label: "Najbliższy tydzień" },
};

// Pory dnia używane przy poradzie „co robić" (zakres godzin lokalnych).
export type DayPart = "morning" | "noon" | "afternoon" | "evening";

export const DAY_PARTS: { key: DayPart; label: string; from: number; to: number }[] = [
  { key: "morning", label: "Rano", from: 6, to: 11 },
  { key: "noon", label: "Południe", from: 11, to: 15 },
  { key: "afternoon", label: "Popołudnie", from: 15, to: 19 },
  { key: "evening", label: "Wieczór", from: 19, to: 23 },
];

/** Pora dnia wynikająca z bieżącej (lub podanej) godziny. */
export function currentDayPart(d = new Date()): DayPart {
  const h = d.getHours();
  for (const p of DAY_PARTS) if (h >= p.from && h < p.to) return p.key;
  return h < 6 ? "morning" : "evening";
}

export interface WeatherPreset {
  key: string;
  title: string;
  emoji: string;
  horizon: Horizon;
  // Opis warunków „dobrych" dla tej aktywności — trafia do promptu oceny.
  query: string;
}

export const WEATHER_PRESETS: WeatherPreset[] = [
  {
    key: "weekend_dry",
    title: "Weekend bez deszczu",
    emoji: "🌳",
    horizon: "weekend",
    query: "Czy nadchodzący weekend będzie suchy i nadający się na wycieczkę/plany na zewnątrz (mało opadów, brak burz)?",
  },
  {
    key: "running",
    title: "Bieganie",
    emoji: "🏃",
    horizon: "today",
    query: "Dobre warunki na bieganie: umiarkowana temperatura, brak ulewy i silnego wiatru, najlepsze okno godzinowe dnia.",
  },
  {
    key: "cycling",
    title: "Rower",
    emoji: "🚴",
    horizon: "tomorrow",
    query: "Dobre warunki na jazdę rowerem: sucho, słaby/umiarkowany wiatr, komfortowa temperatura.",
  },
  {
    key: "grill",
    title: "Grill",
    emoji: "🔥",
    horizon: "weekend",
    query: "Dobre warunki na grilla na zewnątrz: bez opadów, ciepło, słaby wiatr — wskaż najlepsze popołudnie/wieczór.",
  },
  {
    key: "garden",
    title: "Ogród / podlewanie",
    emoji: "🪴",
    horizon: "week",
    query: "Czy w najbliższych dniach spodziewane są opady (czy trzeba podlewać), oraz dni dobre na prace ogrodowe.",
  },
  {
    key: "laundry",
    title: "Suszenie prania",
    emoji: "🧺",
    horizon: "today",
    query: "Czy dziś/jutro jest dobry dzień na suszenie prania na zewnątrz (sucho, wiatr, słońce).",
  },
  {
    key: "ski",
    title: "Narty / śnieg",
    emoji: "⛷️",
    horizon: "week",
    query: "Warunki śniegowe i mróz w najbliższych dniach pod kątem nart/sportów zimowych.",
  },
  {
    key: "frost",
    title: "Przymrozki",
    emoji: "❄️",
    horizon: "week",
    query: "Ostrzeżenie o przymrozkach: czy temperatura spadnie poniżej 0°C (ochrona roślin, opony, instalacje).",
  },
  {
    key: "storm",
    title: "Burze / wichury",
    emoji: "⛈️",
    horizon: "week",
    query: "Ostrzeżenie o burzach, gradzie lub silnym wietrze w najbliższych dniach.",
  },
  {
    key: "heat",
    title: "Upały",
    emoji: "🥵",
    horizon: "week",
    query: "Ostrzeżenie o upałach (wysoka temperatura odczuwalna, wysoki UV) i wskazówki jak się chronić.",
  },
];

export function presetByKey(key: string): WeatherPreset | undefined {
  return WEATHER_PRESETS.find((p) => p.key === key);
}

// Domyślna lokalizacja, gdy użytkownik nie udostępni geolokalizacji ani nie zapisze własnej.
export const FALLBACK_LOCATION = { label: "Warszawa", lat: 52.2297, lon: 21.0122 };
