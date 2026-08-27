import {
  Activity,
  BookOpen,
  Globe,
  LayoutGrid,
  type LucideIcon,
  Palette,
  Plug,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";

/**
 * 109: REJESTR SEKCJI USTAWIEŃ — jedno źródło prawdy.
 *
 * Do 109 `/settings` było jedną kolumną z trzynastoma nagłówkami: żeby cokolwiek znaleźć, trzeba
 * było przewijać i zgadywać, w którym miejscu to jest, a pojedynczego ustawienia nie dało się ani
 * podlinkować, ani zapisać w ulubionych. Ten rejestr karmi NARAZ cztery rzeczy: spis na `/settings`,
 * listę boczną przy sekcji, wyszukiwarkę i walidację segmentu trasy `/settings/[sekcja]`.
 *
 * **Jedna lista, nie cztery.** Osobny słownik fraz dla wyszukiwarki rozjechałby się z listą sekcji
 * przy pierwszej zmianie nazwy — a wyszukiwarka istnieje właśnie po to, żeby prowadzić do sekcji,
 * które NAPRAWDĘ są.
 *
 * **Same klucze, zero literałów** (C-32): nazwy i opisy czyta `useTranslations` po stronie
 * komponentu. Bramka `check:i18n` nie widzi kluczy podawanych zmienną, więc ich istnienia pilnuje
 * test jednostkowy obok tego pliku — inaczej martwy klucz wyszedłby dopiero na ekranie.
 */
export type SekcjaUstawien = {
  /** Segment adresu: ASCII, bez diakrytyków — adres ma się dać przepisać i wysłać. */
  id: string;
  Ikona: LucideIcon;
  /** Klucze w przestrzeni `components.settings.SpisUstawien`. */
  kluczNazwy: string;
  kluczOpisu: string;
  /** Dodatkowe słowa dla wyszukiwarki — to, czego użytkownik szuka, nie zawsze jest w nazwie. */
  kluczHasel: string;
};

/**
 * Kolejność: od najczęściej używanych do rzadkich. To decyzja produktowa, więc trzyma się jednej
 * tablicy — zmiana kolejności = zmiana tej tablicy, nie sortowania w trzech komponentach.
 */
export const SEKCJE_USTAWIEN: SekcjaUstawien[] = [
  { id: "konto", Ikona: User, kluczNazwy: "sekcje.konto.nazwa", kluczOpisu: "sekcje.konto.opis", kluczHasel: "sekcje.konto.hasla" },
  { id: "wyglad", Ikona: Palette, kluczNazwy: "sekcje.wyglad.nazwa", kluczOpisu: "sekcje.wyglad.opis", kluczHasel: "sekcje.wyglad.hasla" },
  { id: "nawigacja", Ikona: LayoutGrid, kluczNazwy: "sekcje.nawigacja.nazwa", kluczOpisu: "sekcje.nawigacja.opis", kluczHasel: "sekcje.nawigacja.hasla" },
  { id: "jezyk", Ikona: Globe, kluczNazwy: "sekcje.jezyk.nazwa", kluczOpisu: "sekcje.jezyk.opis", kluczHasel: "sekcje.jezyk.hasla" },
  { id: "polaczenia", Ikona: Plug, kluczNazwy: "sekcje.polaczenia.nazwa", kluczOpisu: "sekcje.polaczenia.opis", kluczHasel: "sekcje.polaczenia.hasla" },
  { id: "asystent", Ikona: Sparkles, kluczNazwy: "sekcje.asystent.nazwa", kluczOpisu: "sekcje.asystent.opis", kluczHasel: "sekcje.asystent.hasla" },
  { id: "zespoly", Ikona: Users, kluczNazwy: "sekcje.zespoly.nazwa", kluczOpisu: "sekcje.zespoly.opis", kluczHasel: "sekcje.zespoly.hasla" },
  { id: "pomoc", Ikona: BookOpen, kluczNazwy: "sekcje.pomoc.nazwa", kluczOpisu: "sekcje.pomoc.opis", kluczHasel: "sekcje.pomoc.hasla" },
  { id: "prywatnosc", Ikona: ShieldCheck, kluczNazwy: "sekcje.prywatnosc.nazwa", kluczOpisu: "sekcje.prywatnosc.opis", kluczHasel: "sekcje.prywatnosc.hasla" },
  { id: "aktywnosc", Ikona: Activity, kluczNazwy: "sekcje.aktywnosc.nazwa", kluczOpisu: "sekcje.aktywnosc.opis", kluczHasel: "sekcje.aktywnosc.hasla" },
];

export function znajdzSekcje(id: string): SekcjaUstawien | undefined {
  return SEKCJE_USTAWIEN.find((s) => s.id === id);
}

/**
 * 110: `bezOgonkow` i `pasujeDoFrazy` wyprowadziły się do `src/lib/ui/szukanie.ts`.
 *
 * Panel administratora potrzebuje tej samej normalizacji, a funkcje nigdy nie wiedziały nic
 * o ustawieniach. Re-eksport zostaje, bo importuje je stąd spis ustawień i jego testy — jedno
 * miejsce definicji, dwa miejsca użycia.
 */
export { bezOgonkow, pasujeDoFrazy } from "@/lib/ui/szukanie";
