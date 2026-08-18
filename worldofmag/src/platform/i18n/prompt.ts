import { JEZYK_DOMYSLNY, NAZWY_JEZYKOW, type Jezyk } from "./jezyki";

/**
 * 089 (zadanie 38, Faza 7) — JĘZYK PRZESTRZENI W PROMPCIE MODELU.
 *
 * Rozdz. 12.3 stawia to jako osobne zadanie, nie efekt uboczny wyciągnięcia tekstów, i podaje
 * konkretny powód: **prompty traktują nazwy kategorii jako polskie słowa** (C-32). Model, który nie
 * wie, w jakim języku pracuje przestrzeń, przy pierwszej niepolskiej przestrzeni zacznie mylić
 * kategoryzację — a objawem nie będzie błąd, tylko produkty wpadające do złych kategorii.
 *
 * Zdanie jest KRÓTKIE i to jest decyzja: prompt systemowy asystenta płaci za każdy token przy każdej
 * wiadomości (036), więc instrukcja językowa musi kosztować jedną linię, nie akapit.
 *
 * Dla polskiego zwracamy **pusty tekst**. Dziś każda przestrzeń jest polska, a prompty są napisane
 * po polsku — dopisywanie „odpowiadaj po polsku" do polskiego promptu to czysty koszt bez treści.
 * Zdanie pojawia się dopiero wtedy, gdy naprawdę coś zmienia.
 */
export function zdanieOJezyku(locale: string | null | undefined): string {
  const j = (locale ?? JEZYK_DOMYSLNY) as Jezyk;
  if (!j || j === JEZYK_DOMYSLNY) return "";
  const nazwa = NAZWY_JEZYKOW[j] ?? j;
  return `\n\nJĘZYK: ta przestrzeń pracuje w języku ${nazwa} (${j}). Odpowiadaj w tym języku, a nazwy kategorii, jednostek i etykiet traktuj jako słowa tego języka.`;
}
