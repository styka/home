# Rozdział 5 — Metodyka audytu: od podstaw po złożoność

Zanim zespoły zaczęły rozbierać projekt na części, odbyły **debatę o samej metodzie** — w jakiej
kolejności analizować, żeby nie utonąć w szczegółach i nie przeoczyć rzeczy krytycznych.

## Kontekst

Powierzchnia projektu jest ogromna (~26 modułów, ~130 modeli). Analiza „na ślepo, moduł po module”
grozi tym, że utoniemy w detalach UI, a przeoczymy wąskie gardła **przekrojowe** (baza, koszty AI,
bezpieczeństwo), które decydują o przetrwaniu przy skali.

## Głos Zespołu A — Strażnicy

**Katarzyna (analityk):** „Najpierw **fakty z kodu**, potem opinie. Każdy rozdział musi startować od
tego, co realnie jest w repozytorium — pliki, modele, wzorce. Bez tego debata to gdybanie.”

**dr inż. Tomasz (architekt):** „Kolejność musi iść **od fundamentów ku górze**: dane → bezpieczeństwo
→ wydajność → operacje → dopiero potem UX i moduły. Nie ma sensu polerować przycisku, jeśli baza nie
udźwignie ruchu.”

**Anna (security):** „Proponuję klasyczną **piramidę ryzyka**: najpierw to, co może skrzywdzić
użytkownika lub firmę (dane, prawo), potem to, co psuje doświadczenie, na końcu kosmetyka.”

## Głos Zespołu B — Pionierzy

**Patryk (analityk):** „Zgoda na fakty, ale dołóżmy **perspektywę wartości**: przy każdym obszarze
pytajmy nie tylko »co jest złe«, ale »co dałoby największy efekt przy najmniejszym nakładzie«. Audyt
ma napędzać działanie, nie tylko katalogować grzechy.”

**Sandra (architekt):** „I patrzmy **przez pryzmat skali docelowej**. Każde zalecenie oceniajmy w
dwóch światach: »1–50 użytkowników jutro« i »100M za rok«. Część rzeczy, które dziś wyglądają na dług,
jest w zupełności OK na ten etap — i odwrotnie.”

**Ola (UX):** „Nie spychajmy UX na koniec jako »kosmetyki«. Dla użytkownika UX **jest** produktem.
Ale OK — niech ma swój rozdział, byle nie został pominięty.”

## Punkty sporne

- **Kolejność: fundament-first vs wartość-first.** Strażnicy chcą iść od bazy ku UI; Pionierzy — od
  największego ROI. **Rozstrzygnięcie:** kolejność rozdziałów jest fundament-first (czytelność), ale
  **każde zalecenie** dostaje priorytet wg ryzyka **i** notkę „efekt vs nakład” (kompromis).
- **Czy oceniać każdy moduł osobno?** Strażnicy: „przekrojowo wystarczy”. Pionierzy: „nie, użytkownik
  żyje w modułach”. **Rozstrzygnięcie (decyzja właściciela):** **oba** — pełen audyt przekrojowy
  (Część II) **plus** osobna debata per moduł (Część III).

## Przyjęta metodyka — 7 warstw analizy (od podstaw po złożoność)

1. **Warstwa 0 — Fakty.** Inwentaryzacja z kodu: trasy, modele, akcje, wzorce. (zrobione w Rozdz. 1–3)
2. **Warstwa 1 — Architektura i kod.** Granice modułów, dług, spójność konwencji. (Rozdz. 6)
3. **Warstwa 2 — Dane.** Model, integralność, migracje, skalowanie bazy. (Rozdz. 7)
4. **Warstwa 3 — Bezpieczeństwo i zgodność.** RBAC, szyfrowanie, RODO, prywatność. (Rozdz. 8)
5. **Warstwa 4 — Wydajność i skala.** Zapytania, cache, paginacja, ścieżka do 100M. (Rozdz. 9)
6. **Warstwa 5 — Operacje.** DevOps, CI/CD, observability, koszty, backup/DR. (Rozdz. 10)
7. **Warstwa 6 — Doświadczenie i integracje.** UX/a11y/i18n, AI/LLM, integracje. (Rozdz. 11–13)
8. **Warstwa 7 — Jakość i współpraca.** Testy, multi-tenant, rodziny. (Rozdz. 14–15)
9. **Per moduł** — pogłębiona debata dla każdego działu. (Rozdz. 16–41)
10. **Biznes i przyszłość** — model, branże, liczby, marketing. (Rozdz. 42–45)

## Kryteria oceny (wspólne dla wszystkich rozdziałów)

Każdy obszar oceniamy w pięciu wymiarach — to „rubryka” audytu:

| Wymiar | Pytanie |
|---|---|
| **Poprawność** | Czy działa zgodnie z intencją, także w przypadkach brzegowych? |
| **Bezpieczeństwo** | Czy chroni dane i spełnia wymogi prawne? |
| **Skalowalność** | Czy udźwignie 100× i 10000× ruchu bez przepisywania? |
| **Utrzymywalność** | Czy łatwo to rozwijać i nie zepsuć przy okazji? |
| **Doświadczenie** | Czy użytkownik czuje, że to dobre — szybkie, spójne, przyjemne? |

## Głos użytkowników

**Helena (68):** „Mnie nie obchodzą wasze warstwy — ja chcę, żeby się nie zawieszało i było duże.”
→ przypomnienie, że metodyka ma służyć użytkownikowi, nie odwrotnie (wydajność i a11y to nie luksus).

**Marek (29):** „Najbardziej zależy mi, żeby się to spinało z moim kalendarzem i mailem.”
→ integracje (Rozdz. 13) dostają wysoki priorytet w ocenie „efekt vs nakład”.

## Konsensus i zalecenia

Metodyka przyjęta: **fundament-first w układzie, ryzyko+ROI w priorytetach, fakty z kodu na starcie
każdego rozdziału, rubryka 5 wymiarów**. Zalecenia metodologiczne (lekkie, ale ważne dla powtarzalności):

- **Z-001** *(P1 · S)* — **Każdy rozdział audytu zaczyna od sekcji „Stan z kodu” z konkretnymi
  ścieżkami plików.** Zapewnia, że dokument jest weryfikowalny i użyteczny dla Claude Code w kolejnych
  sesjach.
- **Z-002** *(P1 · S)* — **Każde zalecenie ma: priorytet (P0–P2), nakład (S/M/L), ryzyko i — w
  Dodatku A — plan wdrożenia.** Spójny format = łatwa egzekucja i raport 1:1.
- **Z-003** *(P2 · S)* — **Utrzymywać ten audyt jako żywy dokument** (`content/audyt/*.md`):
  aktualizować statusy rozdziałów i dopisywać zalecenia po każdej istotnej zmianie w projekcie.

## Dobre vs złe praktyki (meta)

**Dobre:** projekt już prowadzi raporty implementacyjne i dziennik „doświadczeń” — to gotowy nawyk
dokumentacyjny, na którym ten audyt się opiera.
**Złe (do uniknięcia):** audyt, który jest jednorazowym „zrzutem opinii”. Dlatego od początku
projektujemy go jako **wersjonowany, przyrostowy** dokument w repo, a nie wpis w bazie.
