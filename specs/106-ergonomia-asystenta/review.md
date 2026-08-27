# Recenzja: Ergonomia asystenta AI — chrom, sesje i tryb dokowania

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-27
- **Zakres:** `git diff 745175e..HEAD` — 12 plików, ~1900 linii (w tym 400 linii klikacza)
- **Werdykt końcowy:** **APPROVE Z UWAGAMI** (po nawrocie do implementacji — pierwotny werdykt
  brzmiał ZMIANY WYMAGANE)

## 1. Jak recenzowano

Dwa niezależne przejścia: własne czytanie diffa oraz **recenzja świeżym okiem** (subagent
`omnia-reviewer`) prowadzona **na zbudowanej, działającej aplikacji** (`next start` na bazie e2e +
Chromium), a nie na samym kodzie. To drugie okazało się rozstrzygające: trzy najpoważniejsze
ustalenia to **zmierzone zachowanie**, którego nie pokazał ani zielony build, ani czternaście
bramek, ani pierwsza wersja klikacza 106.

## 2. Ustalenia blokujące (naprawione w tym przebiegu)

### U-1 · `AppShell.tsx` · correctness · **KRYTYCZNE**
Opakowanie `<main>` weszło do kolumnowego flexboksa **bez `min-h-0`**. Element flexowy ma
`min-height: auto`, co w kolumnie rozwiązuje się do **wysokości treści** — chyba że ma `overflow`
inny niż `visible`. Stary `<main>` był odporny przypadkiem (`overflow-hidden` → rozmiar minimalny 0);
opakowanie tej odporności nie odziedziczyło.

**Scenariusz awarii (zmierzony):** `/tasks` przy 360 × 640 — `<main>` **2028 px** zamiast 595,
wewnętrzny kontener przestaje być kontenerem przewijania (`scrollHeight == clientHeight`,
`scrollTop` stoi na `0`), a korzeń powłoki ma `overflow-hidden`, więc dokument też nie przewinie.
Efekt: **na telefonie w każdym module widać wyłącznie pierwszy ekran listy.**

**Dlaczego nie wyszło wcześniej:** na desktopie (`md:flex-row`) wysokość bierze się ze `stretch`,
więc problemu nie ma; projekt `mobile` klikaczy to WebKit, którego w tym środowisku nie da się
uruchomić, a testy `desktop` przy 360 px mierzyły dotąd wyłącznie nagłówek asystenta i niczego
nie przewijały.

**Poprawka:** `min-h-0` na opakowaniu. **Pilnuje:** `[106-R1]`.

### U-2 · `AICommandSheet.tsx` · correctness / C-31 · **BLOKUJĄCE**
Przełącznik dokowania miał `className="hidden lg:flex"` **i** `style={headerBtn}`, a `headerBtn`
dziedziczy z `iconBtn` `display: "flex"`. Styl w atrybucie wygrywa z klasą, więc przycisk **był
widoczny na telefonie**.

**Scenariusz awarii:** dotknięcie na telefonie zapisuje `presentation="content"` **na koncie**,
lokalnie nie robi nic (`isWide === false`), a przy następnym wejściu **na komputerze** asystent
otwiera się zadokowany, choć nikt o to tam nie prosił — wprost wbrew AC-18 („nie da się do niego
trafić przypadkiem").

**Ciężar tej pomyłki:** ostrzeżenie przed dokładnie tą pułapką stoi **160 linii wyżej w tym samym
pliku**, przy pływającej ikonie, gdzie przebieg 100 rozwiązał ten sam problem.

**Poprawka:** renderowanie warunkowe `{isWide && …}` zamiast chowania klasą. **Pilnuje:** `[106-R3]`.

### U-3 · `AICommandSheet.tsx` · correctness · **BLOKUJĄCE**
Pływająca ikona ma `zIndex: 41` (przy otwartym panelu roboczym 55), a zadokowany panel miał **30**.
W trybie okna nie miało to znaczenia (warstwa 9990 ją zasłaniała), w trybie treści — miało.

**Scenariusz awarii (zmierzony):** `elementFromPoint` w środku przycisku **„Wyślij"** zwraca FAB.
Czyli w trybie, który jest główną nową funkcją tego przebiegu, **wiadomości nie da się wysłać
kliknięciem** — zostaje `Ctrl+Enter`. Częściowo zasłonięty był też „Dyktuj".

**Powiązane (U-3b):** warstwa 30 leżała też poniżej `fixed z-40/z-50` z modułów (pasek akcji
zbiorczych Zadań, wskaźnik offline Zakupów). Takie elementy rysowałyby się na asystencie, a siedząc
w `inert` treści nie dałyby się już zamknąć.

**Poprawka:** warstwa **45** (ponad chromem modułów, poniżej `Modal` 50 i `AnchoredLayer` 9995)
oraz nierenderowanie FAB-a przy otwartym asystencie. **Pilnuje:** `[106-R2]`.

## 3. Ustalenia drobne (naprawione)

| # | Miejsce | Rzecz |
|---|---|---|
| U-4 | `AICommandSheet.tsx` (znacznik „auto") | `aria-label` na `<span>` **bez roli** nie jest wystawiane przez ARIA — czytnik ekranu nie przeczytałby nazwy akurat w wariancie ikonowym, dla którego ją napisano (AC-2). Dodane `role="img"`. |
| U-5 | `togglePresentation` | Wycofanie po błędzie zapisu brało wartość z domknięcia; przy dwóch szybkich przełączeniach wracało do stanu sprzed **pierwszego** kliknięcia. Teraz zapamiętana wartość. |
| U-6 | menu „Więcej" | `biezacaZapisana` liczyło się z list, które dociągają się dopiero po otwarciu menu — pierwsze kliknięcie mogło pójść w złą stronę. Pozycja wyłączona do czasu odpowiedzi. |
| U-7 | `aiConversations.ts` | Komentarz `deleteAiConversation` osiadł nad nową funkcją. Przesunięty. |

## 4. Sprawdzone i czyste

- **Migracja ↔ `schema.prisma`** — `IF NOT EXISTS` na obu kolumnach i indeksie, zero `DROP`,
  nazwa indeksu zgodna z konwencją Prismy, `String` + unia zamiast enuma (C-10..C-12, C-15).
- **C-20 / C-21** — `setAiConversationSaved`: `requireAuth()`, filtr `userId` w `updateMany`
  (cudza rozmowa jest **nietrafialna**, a nie „trafialna i sprawdzana osobno"), `revalidatePath("/")`.
- **`Esc` (AC-4)** — `AnchoredLayer` łapie klawisz w fazie przechwytywania i zatrzymuje zdarzenie;
  usunięcie gałęzi `showLevelMenu` z nasłuchu asystenta nie zostawia menu bez wyjścia.
- **`inert` / `aria-hidden`** — zmierzone: `<main>` ma oba, prostokąt panelu pokrywa się co do
  piksela z obszarem treści, nawigacja obok pozostaje klikalna; sprzątanie jest i przy wyjściu
  z trybu, i przy odmontowaniu.
- **Kolejność malowania** — sprawdzona osobno (`[106-AC14b]`): moja własna hipoteza, że pasek widoku
  modułu (`zIndex: 40`) przebije nad asystenta, okazała się **fałszywa** — test to potwierdził
  i został jako zabezpieczenie na przyszłe zmiany warstw.
- **Kształt `listAiConversations`** — jedyny konsument to `AICommandSheet`, obie gałęzie z jawnym
  `take`, zwrotka typowana (rozjazd złapałby `tsc`).

## 5. Uwagi niezablokowane (świadomie zostawione)

1. **Pływająca ikona zgłaszania błędu znika przy otwartym asystencie** (`FeedbackInspector` chowa
   ją na `assistantOpen`). W trybie treści asystent bywa otwarty na stałe, więc administrator traci
   ten przycisk na czas pracy — skrót `Ctrl+Shift+B` działa dalej. Poprawka wymagałaby zmiany pliku
   spoza zakresu tej funkcji dla wygody wyłącznie administratora, mając działającą alternatywę (C-53).
2. **Mignięcie przy otwarciu w trybie treści** — `useIsWideScreen()` startuje od `false`, więc przez
   pierwszą klatkę po hydratacji asystent renderuje się jako okno. Alternatywą byłoby wstrzykiwanie
   szerokości z serwera, czego zrobić się nie da.
3. **AC-2, AC-7 i AC-16 mają dowód z kodu, nie z uruchomienia** — tak, jak raportuje `verify.md`.
   U-4 pokazało, że ta ostrożność była słuszna: właśnie w AC-2 siedziała realna luka.

## 6. Bramki i regresje po poprawkach

| Sprawdzenie | Wynik |
|---|---|
| `next build` | ✅ exit 0 |
| `tsc --noEmit` (aplikacja i testy) | ✅ |
| `next lint --dir src` | ✅ |
| 14 bramek `check:*` (migracje, drift, i18n, paginacja, kontrakt widoku, kolumny własnościowe, logi, klient, akcje, pokrycie AI, e2e-waits, perf) | ✅ wszystkie |
| Klikacz 106 (`asystent-ergonomia.spec.ts`) | ✅ **14/14** |
| Pełny zestaw klikaczy | 225 przeszło / 14 padło |

**Porównanie z bazą (`745175e`, to samo środowisko):** baza 216/13, po zmianie 225/14 (przybyło
14 nowych testów). Różnica w zbiorze porażek to dwa testy ulubionych — `[vs-AC4]` i `[fav-AC4]` —
i **oba padają identycznie na bazie, gdy uruchomić ich specyfikację w izolacji** (`favorites.spec.ts`
na 745175e: 5 przeszło / 1 padł, ten sam test). To ta sama zastana zależność od stanu ulubionych,
którą nazywa padający w bazie `[fav-AC5]` („Nie udało się wyczyścić ulubionych w 40 iteracjach").
W drugą stronę: `[fav-AC5]` po zmianie przechodzi. **Regresji wprowadzonych przez 106: zero.**

## 7. Wniosek

Trzy blokery były realne, wszystkie zmierzone na działającej aplikacji, wszystkie naprawione
jedno- do trzyliniowo i **każdy ma teraz test, który go pilnuje**. Najcenniejsza obserwacja
z tego przebiegu nie dotyczy kodu, tylko metody: `min-h-0` i `display` w atrybucie `style` to
usterki, których **nie widać w diffie ani w zielonym buildzie** — widać je dopiero, gdy się aplikację
uruchomi i zmierzy. Trzy lekcje trafiły do `doświadczenia.md`, w tym ta o osieroconym `next start`,
przez którego czarna strona w klikaczach przez dobrą chwilę udawała awarię hydratacji.

**Werdykt: APPROVE Z UWAGAMI** — do merge do `develop` i promocji na `master`.
