# Recenzja: YouTube — moduł „co warto obejrzeć", transkrypcje i streszczenia

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Gałąź:** `claude/security-audit-youtube-o3aiat` · **Data:** 2026-08-25
- **Zakres:** nowy moduł — 4 tabele, migracja `0262`, 22 pliki modułu, 4 trasy, 25 testów

## 1. Jak recenzowałem

Nowy moduł jest zbyt duży, żeby czytać go równomiernie, więc recenzja celowała w miejsca, w których
**błąd nie objawia się od razu**: pętle odpytujące, zapisy w pętli, ścieżki awaryjne integracji
i miejsca, gdzie moduł dotyka danych innego użytkownika. Rzeczy pokryte bramkami (granice modułu,
teksty, paginacja, kolumny własnościowe) sprawdziłem tylko tam, gdzie bramka mogła mieć martwe pole.

## 2. Ustalenia

### U-1 — wieczne „Odświeżam…" po anulowaniu zadania · **NAPRAWIONE**

- **Plik:** `src/modules/youtube/ui/YoutubePage.tsx` (pętla odpytująca postęp)
- **Kategoria:** correctness
- **Opis:** pętla kończyła się warunkiem `status === "DONE" || status === "FAILED"` — czyli **listą
  stanów końcowych**. Kolejka ma ich pięć: `QUEUED`, `RUNNING`, `DONE`, `FAILED` i **`CANCELLED`**,
  którego na tej liście nie było.
- **Scenariusz awarii:** administrator anuluje zadanie w `/admin/jobs` → status `CANCELLED` →
  warunek nigdy nie jest spełniony → napis „Odświeżam…" zostaje **na zawsze**, a przeglądarka
  odpytuje bazę **co dwie sekundy bez końca**, dopóki użytkownik nie zamknie karty.
- **Poprawka:** warunek odwrócony na **pozytywny** — „czy jeszcze trwa" (`QUEUED` albo `RUNNING`).
  Ta postać jest odporna także na każdy stan dołożony w przyszłości, a lista stanów końcowych
  wymagałaby pamiętania o niej przy każdej zmianie kolejki.

### U-2 — import subskrypcji: jeden zapis na kanał zamiast jednego na partię · **NAPRAWIONE**

- **Plik:** `src/modules/youtube/lib/zapisKanalow.ts`
- **Kategoria:** efficiency
- **Opis:** `createMany` stało w pętli po kanałach, z jednoelementową tablicą `data`.
- **Skutek:** konto z dwustoma subskrypcjami płaciło **dwieście podróży do bazy** zamiast jednej —
  a `skipDuplicates` odsiewa istniejące po stronie bazy, więc pętla dawała dokładnie ten sam wynik.
  To jest dokładnie ta operacja, którą użytkownik wykonuje **raz, zaraz po połączeniu konta**, więc
  wolny import byłby jego pierwszym wrażeniem z modułu.
- **Poprawka:** jeden `createMany` na całą partię.

### U-3 — nieudany import kończył się przyciskiem, który „nic nie robi" · **NAPRAWIONE**

- **Plik:** `src/modules/youtube/ui/KanalyPage.tsx`
- **Kategoria:** correctness (UX)
- **Opis:** `importujSubskrypcje()` zwraca `{ ok: false, powod: "brak-polaczenia" }`, gdy zgoda
  wygasła albo została cofnięta po stronie Google — a widok ten wynik **połykał**.
- **Scenariusz:** użytkownik cofa zgodę w ustawieniach Google, wraca do Omnii, klika „Zaimportuj
  subskrypcje" → nic się nie dzieje. Stan nie do odróżnienia od „konto nie ma nowych subskrypcji",
  więc użytkownik klika dalej, zamiast połączyć konto ponownie.
- **Poprawka:** komunikat mówiący wprost, co zrobić („Połącz konto ponownie").

### U-4 — reguła w warstwie serwerowej była niesprawdzalna · **NAPRAWIONE w trakcie implementacji**

Bramka `check:domain` zatrzymała build: pomocnik `naDto` w pliku `"use server"` podbił zapadkę
z 34 na 35. To ta sama sytuacja, którą opisuje wpis w `doświadczenia.md` z tego samego dnia.
Funkcja poszła do `domain/film.ts` **razem z testami** — i dopiero wtedy okazało się, że niesie
regułę wartą testu: `maTranskrypcje` liczy się z **treści**, nie ze stanu, bo retencja czyści
transkrypcje odrzuconych filmów, zostawiając stan `"jest"`. Flaga ze stanu obiecywałaby transkrypcję,
której już nie ma.

### U-5 — kod modułu poza jego katalogiem · **NAPRAWIONE w trakcie implementacji**

`oauth.ts` wylądował w `src/lib/youtube/`, bo skopiowałem rozmieszczenie działającego połączenia
z Dyskiem. Bramka rejestru słusznie to odrzuciła: `src/lib/drive/` pochodzi **sprzed** przebudowy
modułowej i nie jest wzorcem dla nowego kodu — kod w starym miejscu omija granicę, bo reguła ESLint
go tam nie pilnuje. Przy okazji trasy zrobiły się naprawdę cienkie: kontrakt wystawia **czynność**
(`przygotujZgode`, `zapiszZgode`), a nie kroki OAuth, więc kolejność kroków została w module.

### U-6 — token odświeżający Google · **świadome odejście od wzorca, zostaje**

`DriveConnection` trzyma token odświeżający otwartym tekstem; `YoutubeConnection` trzyma go
**zaszyfrowany** (`encryptSecret`). To odejście od sąsiedniego wzorca jest celowe i wąskie: token
odświeżający jest długowieczny i wymienialny na dostęp do konta Google, a pomocnik platformy leży
jeden import stąd (C-41). Nie jest to „przy okazji" nowa abstrakcja — to istniejące narzędzie użyte
tam, gdzie jest po to zbudowane. Odszyfrowanie jest wstecznie zgodne (wartość bez prefiksu wraca bez
zmian), więc nic nie psuje.

### U-7 — rozdział danych między użytkownikami · **sprawdzone, poprawne**

Wszystkie odczyty idą przez `filtrMoichRekordow` (wariant **wąski** — moduł jest osobisty; szerszy
`ownedWhereAsync` byłby cichym poszerzeniem dostępu, dziś niewidocznym, bo bez zespołów oba zwracają
te same wiersze). `ustawStan` używa `updateMany` z filtrem przestrzeni, więc **filtr jest
jednocześnie strażnikiem** — cudzy film nie pasuje do warunku i nie ma jak go zmienić bez osobnego
odczytu. Trasa szczegółu zwraca `notFound()` dla cudzego filmu, a nie „brak dostępu": ta druga
odpowiedź potwierdzałaby, że taki rekord istnieje. Potwierdzone dodatkowo próbą w bazie.

### U-8 — ścieżki awaryjne integracji · **sprawdzone, poprawne**

`pobierzTranskrypcje` nie rzuca w żadnym z czterech miejsc, w których może się nie udać (test tego
pilnuje), a `filmyKanalu` zwraca pustą listę przy błędzie — dzięki temu jeden niedostępny kanał nie
wywraca przebiegu obejmującego wszystkie pozostałe. Etapy 2 i 3 zadania są opakowane w `try`, więc
awaria modelu nie unieważnia etapu 1, w którym filmy są już zapisane. To jest właściwa hierarchia:
**pobranie listy jest tym, po co użytkownik kliknął**, reszta jest ulepszeniem.

## 3. Czego świadomie nie zmieniałem

- **Brak `dashboard.ts`** — żadne kryterium akceptacji nie wymaga kafelka na pulpicie, a każdy wkład
  to kolejne wpięcie do utrzymania (C-53). Łatwo dołożyć, gdy właściciel tego zechce.
- **Brak rozdziałów ze znacznikami czasu i przenoszenia treści do innych modułów** — właściciel
  wprost odłożył je na etapie pytań; są wypisane w specyfikacji jako świadomie poza zakresem.
- **Czas trwania filmu** nie jest pobierany: kanał RSS go nie podaje, a osobne odpytanie API dla
  każdego filmu kosztowałoby zapytanie na pozycję. Kolumna `durationSec` istnieje i czeka.

## 4. Konwencje

| Reguła | Ocena |
|---|---|
| C-01, C-02, C-36 | ✅ całość w `worldofmag/`; wnętrze modułu importowane ścieżką względną, kontrakt niesie 5 pozycji (nie „wszystko na wszelki wypadek") |
| C-10..C-15 | ✅ ręczna migracja, zero enumów, **diff przycięty do własnej zmiany** (C-15 zadziałało w praktyce) |
| C-20, C-21 | ✅ Server Actions z `revalidatePath`; własność przez `workspaceId`, wariant wąski |
| C-22, C-23, C-24 | ✅ slug + oba korzenie + bramka trasy; 3 akcje z egzekutorem; kosz z przywracaniem |
| C-30..C-34 | ✅ zmienne CSS, `var(--on-accent)`, wariant mobilny, `ModuleView` ze `state`, `confirmDialog({ destructive: true })`, zero literałów |
| C-40, C-41 | ✅ model po typie operacji; token zaszyfrowany, log bez wartości |
| C-53 | ✅ **zero nowych zależności**; `parseRss` i `resilientFetch` reużyte |
| C-54 | ✅ odstępstwa od planu odnotowane w artefaktach |

## 5. Werdykt

## ✅ APPROVE Z UWAGAMI

Moduł robi to, co obiecuje spec, i jest osadzony w konwencjach repozytorium — nie obok nich.
Recenzja znalazła **trzy realne usterki** (wieczna pętla odpytująca po anulowanym zadaniu, dwieście
zapisów zamiast jednego przy imporcie, milcząco połknięty błąd zgody) i **wszystkie trzy zostały
naprawione**; dwie dalsze (U-4, U-5) złapały bramki w trakcie implementacji.

**Uwagi przechodzące dalej — nieblokujące:**

1. **Sprawdzić na produkcji odsetek udanych pobrań transkrypcji** (`youtube.transkrypcje.skutecznosc`
   w logu). To jedyna rzecz, której nie dało się zweryfikować bez sieci, i jednocześnie największe
   ryzyko modułu. Jeśli odsetek okaże się niski — właściciel ma gotową decyzję do podjęcia
   (przeglądarka w tle), a nie zagadkę.
2. **Zakres `youtube.readonly` jest zakresem wrażliwym** — przed otwarciem aplikacji na wiele osób
   Google będzie wymagać weryfikacji aplikacji. Moduł działa bez tej zgody, więc to ogranicza
   wygodę, nie użyteczność. Odnotowane też w raporcie audytu (101).
3. **Kafelek na pulpicie** — naturalne następne wpięcie, gdy moduł się przyjmie.
