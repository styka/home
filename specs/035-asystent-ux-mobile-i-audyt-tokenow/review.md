# Recenzja: 035-asystent-ux-mobile-i-audyt-tokenow

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-28
- **Zakres:** `git diff origin/develop...HEAD` — 13 plików, +1606/−479

## Ustalenia

### 1. `AiCostBadge.tsx:90-114` — correctness (NAPRAWIONE w recenzji)
**Opis:** Panel kosztu był przycinany do **okna przeglądarki**, podczas gdy realnym ograniczeniem
jest **arkusz asystenta** — na komputerze ma on `max-w-lg` (512 px) i stoi pośrodku szerokiego ekranu,
a jego obszar przewijania (`overflow-y-auto`, co w praktyce przycina też poziomo) obcina wszystko, co
z niego wystaje.
**Scenariusz awarii:** okno 1400 px, arkusz zajmuje ~444–956 px, krótka odpowiedź → kwota blisko lewej
krawędzi arkusza (`anchor.right ≈ 480`). Wyliczenie `left = 480 − 360 = 120` mieści się w oknie
(margines 8 px), więc **żadne clampowanie nie zadziała** — a panel rozciąga się od 120 do 480, czyli
ponad 300 px **poza lewą krawędź arkusza**, gdzie zostaje ucięty. Dokładnie objaw opisany w zgłoszeniu
Z2 („na komputerze chyba też był podobny problem").
**Poprawka (naniesiona):** granice liczone z `wrap.closest('[role="dialog"]')` (arkusz asystenta),
przecięte z widocznym obszarem okna; szerokość panelu też ograniczona dostępną przestrzenią
(`maxPanelWidth`), a pozycja wyliczana już z przyciętą szerokością — dzięki temu jedno przejście
`useLayoutEffect` daje spójny wynik.

### 2. `AiCostBadge.tsx` — convention (sprawdzone, poprawne)
**Opis:** Wszystkie hooki (`useState`, `useRef`, `useCallback`, `useLayoutEffect`, `useEffect`) są
wywoływane **przed** wczesnymi zwrotami `if (!usage) return null` i `if (!hasCost && !hasDetail)`.
**Ocena:** poprawne — kolejność hooków jest stała między renderami, brak naruszenia zasad Reacta.
Warto to odnotować, bo w tym komponencie łatwo o pomyłkę przy kolejnych zmianach.

### 3. `AssistantLevelSettings.tsx:115` — correctness (sprawdzone, zachowanie zamierzone)
**Opis:** Gdy użytkownik zmieni **tylko temperaturę**, zapis wysyła `key: op.key`, czyli nadal `null`,
mimo że pole pokazuje `defaultKey`.
**Ocena:** to zachowanie **poprawne i pożądane** — pole, którego użytkownik nie dotknął, ma dalej
podążać za poziomem standardowym. Gdyby administrator zmienił model dla `standard`, użytkownik
dostanie nowy model, zamiast zostać z zamrożoną kopią sprzed miesięcy. Wyświetlana wartość i wartość
efektywna są tożsame, więc nie ma rozjazdu widocznego dla użytkownika.

### 4. `AICommandSheet.tsx` — correctness (sprawdzone, poprawne)
**Opis:** Po przeniesieniu paneli do obszaru treści w drzewie mogłyby powstać dwa elementy `flex-1`
naraz (panel + wątek).
**Ocena:** wykluczone konstrukcyjnie — wątek renderuje się tylko przy `headerPanel !== "none" ? null`,
a kompozytor przy `headerPanel === "none"`. Dokładnie jeden element `flex-1` w każdym stanie.

### 5. `AiCostBadge.tsx` — simplification (odnotowane)
**Opis:** Zniknął prop `align`, bo pozycja jest teraz liczona automatycznie.
**Ocena:** zamierzone uproszczenie — komponent był używany wyłącznie z wartością domyślną (`tsc`
potwierdza brak innych wywołań), a ręczny wybór strony był właśnie źródłem błędu. Komponent nadal nie
importuje niczego z `home/`, więc pozostaje gotowy do użycia w innych modułach.

### 6. Sprawdzone i czyste (bez ustaleń)
- **AC-22 / neutralność przenosin** — `src/lib/llm` bez zmian; `fastPath.ts` tylko `export`;
  w `agent/route.ts` **wszystkie** dodane linie to import + `buildRouterPrompt(allowed, primary)`.
  Treść promptu: 30 106 znaków przed i po, identyczna.
- **C-23** — brak nowych `AIAction`; bramka po przenosinach widzi 160 akcji i 373 parametry.
- **C-14** — migracja idempotentna (`ON CONFLICT DO UPDATE`), dollar-quoting z zabezpieczeniem przed
  kolizją tagu, slug globalnie unikalny; ponowne uruchomienie → `wierszy: 1`.
- **C-30/C-32** — wyłącznie zmienne CSS, brak hardkodowanych hexów; teksty po polsku.
- **C-41** — feature nie dotyka kluczy API; raport nie zawiera żadnych sekretów (prompty systemowe to
  instrukcje, nie dane uwierzytelniające).
- **Bezpieczeństwo treści raportu** — raport jest renderowany przez `markdownToHtml`, który escapuje
  `&` i `<`; prompty w blokach kodu nie wprowadzają HTML-a.
- **C-01** — tymczasowy skrypt audytowy usunięty; w repo nie został żaden plik roboczy.

## Werdykt

**APPROVE Z UWAGAMI.**

Jedna realna wada znaleziona i naprawiona w recenzji (ustalenie 1 — clampowanie do okna zamiast do
arkusza; bez tego kryterium AC-8 byłoby spełnione tylko na telefonie). Uwagi niewymagające zmian:
weryfikacja zachowań wizualnych i dotykowych odbyła się przez inspekcję logiki, nie na urządzeniu —
przy pierwszym wejściu na środowisko testowe warto sprawdzić trzy rzeczy: czy klawiatura na telefonie
znika przy dotknięciu przycisków **i czy akcja wykonuje się za pierwszym razem**, czy kursor na
iPhonie stoi od razu we właściwym miejscu, oraz czy panel kosztu przy krótkiej odpowiedzi mieści się
w oknie asystenta na komputerze.
