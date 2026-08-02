# Recenzja: Kontrola nad AI — kiedy generuje, ile kosztuje, co robi bez pytania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-02
- **Zakres diffa:** `origin/develop...HEAD` — 18 commitów, 36 plików, +3102 / −171

## Ustalenia

### 1. `contentMemory.ts:139-168` — **simplification** *(naprawione w recenzji)*

Ta sama treść była dekodowana z JSON-a **dwa razy**: raz w gałęzi odczytu z pamięci, drugi raz w
warunku „czy wpis jest czytelny" przed zwróceniem stanu oczekiwania.

*Skutek:* nie błąd, ale podwójny `JSON.parse` przy każdym odczycie sekcji **i**, groźniejsze,
dwa niezależne miejsca wyrażające tę samą myśl („wpis da się odczytać"). Rozejście się tych dwóch
warunków przy kolejnej zmianie dałoby sekcję, która jednocześnie „ma treść" i „czeka na kliknięcie".

*Poprawka:* jeden `const stored = existing ? decode<T>(existing.content) : undefined;` u góry, obie
decyzje pytają o tę samą zmienną. Tabela decyzyjna bez zmian — potwierdzone ponownym uruchomieniem
kompletu 7 testów `contentMemoryMode` (wszystkie zielone).

### 2. `AiContentMeta.tsx:64-76` — **correctness** *(naprawione w recenzji)*

`pick()` oddawał do `startTransition` funkcję `async` z `try/finally`, ale **bez `catch`**. Gdy
`setSectionMode` odrzuci (brak sesji, chwilowa awaria bazy), odrzucenie nie ma właściciela.

*Scenariusz awarii:* użytkownik wybiera „Zawsze świeże" przy zerwanej sesji → akcja rzuca
`Unauthorized` → menu się zamyka (`finally`), tryb zostaje stary, a w przeglądarce ląduje
nieobsłużone odrzucenie obietnicy (w produkcyjnym buildzie Next potrafi je wynieść do granicy błędu).

*Poprawka:* dodany `catch`, który świadomie **nie** woła `onModeChange` — ekran nie obiecuje wtedy
ustawienia, którego serwer nie zna. Wzorzec 1:1 z `toggleAutoApprove` w `AICommandSheet`, który miał
`.catch()` od początku.

### 3. `news.ts` `getNewsRefreshHistory` — **efficiency** *(świadomie bez poprawki)*

`visibleUsage` jest wołane **per wiersz** (do 30 razy), a każde wywołanie robi `auth()` i odczyt
`Config.ai_cost_badge_enabled`.

*Skutek:* kilkanaście dodatkowych zapytań przy rozwinięciu historii. Realnie: lista jest wczytywana
**dopiero po kliknięciu** „Historia odświeżeń", domyślnie 10 wierszy, a odczyty idą po kluczu głównym.

*Dlaczego zostaje:* jedyny sposób na policzenie tego raz to powtórzenie warunku widoczności
(`hasPermission` + flaga `Config`) poza `visibleUsage`. To rozbiłoby **jedyny punkt kontroli**
ustanowiony w 037 — dokładnie ten rodzaj „drugiej listy", który w tym samym wydaniu odrzuciliśmy dla
akcji niszczących. Kilkanaście zapytań na kliknięcie jest tańsze niż rozszczelniona bramka.

### 4. `AiCostBadge.tsx:159-168` — **convention** *(świadome, odnotowane)*

Poprawka celów dotyku z T-21 dotyka komponentu używanego w **~20 miejscach**, więc urósł tam wiersz,
w którym stoi wskaźnik.

*Dlaczego to jest w porządku:* `padding: 0` łamał C-31 (min. cel dotyku `py-3`) **wszędzie**, nie
tylko w pasku sekcji AI — poprawka jest więc naprawą reguły globalnej, a nie zmianą przy okazji.
Rozmiar i kolor tekstu zostały bez zmian, więc waga wizualna też. Pozycjonowanie rozwijanego panelu
liczy się z opakowania (`wrapRef`), nie z przycisku, więc padding go nie rusza — sprawdzone w
`reposition()`.

*Do obejrzenia na `develop`:* wygląd tych ~20 wierszy. Recenzja kodu nie zastąpi spojrzenia na ekran.

## Co sprawdzone i **bez** ustaleń

- **Guardy dostępu (C-21):** każda nowa akcja zaczyna od `requireAuth()`, a zapisy i odczyty idą
  wyłącznie po `ownerId` z sesji. `setDefaultSectionModes`/`getDefaultSectionModes` mają
  `requireAdmin()`. `setSectionMode` waliduje **i** rodzaj sekcji, **i** nazwę trybu — śmieć nie wejdzie
  do bazy ani do `Config`, który czytają handlery zadań bez sesji.
- **`revalidatePath` (C-20):** obecne na końcu wszystkich trzech mutacji.
- **Migracja ↔ schemat:** `prisma migrate diff` nie pokazuje rozjazdu dla nowych obiektów; migracja
  jest w całości addytywna, więc poprzednia wersja kodu działa na nowym schemacie.
- **`AIAction` (C-23):** katalog nietknięty, `check:actions` zielony — 041 zmienia sposób
  **zatwierdzania**, nie zbiór akcji.
- **Jedno źródło klasyfikacji niszczących:** `grep DESTRUCTIVE_ACTION_TYPES` daje `aiAction.ts`
  (definicja), `ActionDrawer.tsx` (szuflada) i komentarz w `assistantPrefs.ts`. Auto-zatwierdzanie woła
  `isDestructiveAction` z tego samego pliku — **drugiej listy nie ma**, czyli ryzyko ze spec §9 zamknięte.
- **Wyścig przy auto-zatwierdzaniu:** decyzja czyta `autoApproveRef`, nie stan — przełączenie trybu w
  trakcie oczekiwania na odpowiedź agenta nie zadziała na starej wartości z domknięcia.
- **Ścieżki poza agentem** (plan ze zdjęcia, zgłoszenie „🐛", `handleRefine`) tworzą tury planu
  **własnymi** ścieżkami i auto-zatwierdzania **nie** wyzwalają. To dobrze: auto dotyczy planu, o który
  użytkownik poprosił rozmową, a nie planu powstałego z rozpoznania obrazu.
- **Awaria kroniki przebiegu:** `recordRun` jest w `try/catch` — nieudany zapis historii nie zabiera
  użytkownikowi wyniku odświeżania, na który czekał. Ścieżka błędu przebiegu nadal **rzuca**, więc
  zadanie kończy się `FAILED`, a nie „po cichu OK".
- **Retencja:** przycinanie do 30 wierszy przy każdym zapisie, pokryte testem.
- **C-30/C-32:** w nowym kodzie brak hexów (wyłącznie `var(--*)`, `var(--on-accent)` na kolorowym
  przycisku); wszystkie teksty po polsku.
- **C-01/C-02:** zmiany wyłącznie w `worldofmag/` i `specs/`; importy przez alias `@/*`.
- **Bezpieczeństwo:** żaden nowy kod nie dotyka kluczy API ani renderowania HTML; jedyne nowe dane
  wrażliwe (koszty) przechodzą przez istniejącą bramkę serwerową.

## Bramki po poprawkach recenzenckich

| Komenda | Wynik |
|---|---|
| `npx tsc --noEmit` | ✅ bez błędów |
| `npx next lint --dir src` | ✅ 0 błędów |
| `npx next build` | ✅ „Compiled successfully" |
| `npm run test:unit` | ✅ **585/585** |

## Werdykt

**APPROVE Z UWAGAMI.**

Dwie poprawki naniesione w recenzji (podwójne dekodowanie w pamięci treści, brakujący `catch` przy
zapisie trybu) — obie drobne i bezpieczne, obie przeszły ponownie komplet bramek. Dwie uwagi zostają
świadomie bez zmian i są uzasadnione wyżej: kilkanaście zapytań przy rozwinięciu historii kosztów
(cena za jeden punkt kontroli widoczności) oraz globalny zasięg powiększenia celu dotyku we
wskaźniku kosztu (naprawa reguły, która była łamana wszędzie).

Jedyna rzecz, której recenzja kodu z definicji nie rozstrzyga, to **wygląd** — proporcje paska sekcji
AI po powiększeniu przycisków i wiersze ze wskaźnikiem kosztu w ~20 miejscach. To do obejrzenia na
środowisku testowym.
