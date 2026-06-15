# Dodatek A.11 — Plany wdrożenia: podaplikacje branżowe

Plany realizujące zalecenia z Rozdz. 43.

---

## Plan Z-490 (P1·L) — V1 Hodowca (pierwsza branża, z modułu Pets)

**Cel:** dowód modelu „expand” — płatna głębia branżowa na bazie istniejącego modułu.
**Kroki:**
1. Wykorzystać istniejące `Pet.presetKey`/`featureFlags` + breeding/genetykę; włączyć preset
   `breeder` rozszerzający funkcje: rodowody (drzewo), zarządzanie lęgami (`PetClutch`), sprzedaż
   (`PetSale`), certyfikaty, **koszty/ROI hodowli** (spięcie z Portfelem przez auto-wydatki).
2. Bramkować funkcje zaawansowane planem (A.10).
3. Onboarding branżowy (Z-494) — konfiguracja pod gatunek/typ hodowli.
**Pliki:** `src/actions/petBreeding.ts`, `src/components/pets/*`, presety `src/lib/pets/*`, plan.
**Kryteria:** hodowca prowadzi rodowody/lęgi/sprzedaż/koszty w jednym; funkcje pro za planem.
**Uwaga:** zakres = duży; realizować etapami (rodowody → lęgi → sprzedaż → koszty).

---

## Plan Z-492 (P1) — Komercjalizacja istniejących trybów Pro (Warsztat, Magazyn)

**Cel:** najszybsi pierwsi płacący — moduły już mają tryb Pro.
**Kroki:** domknąć funkcje premium Warsztat Pro (przeglądy, projekty) i Magazyn Pro (dokumenty, FEFO,
analityka); bramkować planem (A.10); pakiet „Pro” w cenniku.
**Kryteria:** tryb Pro dostępny w planie płatnym; wartość uzasadnia cenę.

---

## Plan Z-491 (P2·L) — „Silnik nakładek” (po drugiej branży)

**Cel:** kolejne branże = konfiguracja, nie nowy kod.
**Kroki:** **po** Hodowcy wyabstrahować wzorzec: preset = (moduły + pola + słowniki + AI-prompty +
szablony + bramkowanie). Uogólnić mechanizm presetów Pets na dowolny moduł.
**Kryteria:** nowa branża definiowana deklaratywnie; brak duplikacji kodu per branża.
**Ryzyka:** przedwczesna abstrakcja — robić dopiero, gdy widać, co się powtarza.

---

## Pozostałe

- **Z-493 (P2·L)** — V2 Gastronomia (food cost, kalkulacja menu, alergeny, zamówienia) — z Kitchen.
- **Z-494 (P2)** — onboarding branżowy z AI („powiedz, czym się zajmujesz” → konfiguracja nakładki).
- **Z-495 (P2·L)** — V3 Flota B2B (wiele pojazdów, kierowcy, ORS, przeglądy regulacyjne).

**Kolejność:** Z-492 (szybkie) ‖ Z-490 (flagowa branża) → Z-491 (silnik) → Z-493/Z-495.
**Zasada:** jedna branża na raz do dojrzałości i pierwszych płacących.
