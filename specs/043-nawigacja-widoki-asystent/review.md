# Recenzja: Nawigacja po widokach, widget asystenta i układ strony głównej

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (27/27) · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-03
- **Zakres diffa:** `origin/develop...HEAD` — **67 plików, +3523 / −477**
- **Werdykt:** **APPROVE Z UWAGAMI**

---

## 1. Ustalenia

Posortowane od najpoważniejszego. Kategorie: correctness / convention / simplification / security.

### R-1 — correctness — stan widoku przeżywał zmianę adresu bez przemontowania *(naprawione w recenzji)*

**Plik:** `src/hooks/useViewState.ts`

**Opis.** Przejście na inny adres w obrębie tej samej trasy — np. przełączenie listy zakupowej albo
projektu zadań `Link`iem w pasku bocznym — **nie przemontowuje komponentu** (Next reużywa ten sam
komponent trasy dla `/shopping/[listId]`). `useState` w `useViewState` inicjalizuje się tylko raz,
więc stan widoku zostawał z poprzedniej strony, podczas gdy adres był już czysty.

**Scenariusz awarii.** Ustaw w Zakupach filtr „Kupione" na liście A → kliknij listę B w pasku
bocznym → adres to `/shopping/B` (bez parametrów), ale widok nadal pokazuje „Kupione". Kliknięcie
gwiazdki zapisuje **adres**, więc ulubiony zapisuje się **bez filtra, który użytkownik widzi**.
To uderza dokładnie w AC-5 („adres odzwierciedla bieżący stan widoku") i w sens całej funkcji.

**Poprawka (naniesiona).** Efekt kluczowany po `usePathname()` przelicza stan z adresu po każdej
zmianie ścieżki. Widok i adres zawsze się zgadzają.

**Zmiana zachowania do odnotowania:** przełączenie listy/projektu **resetuje teraz filtry** do tego,
co niesie nowy adres (zwykle domyślne). Wcześniej filtr przechodził na kolejną listę. Uznaję to za
poprawę, nie regresję — dotychczasowe zachowanie było niespójne z adresem, a spójność jest sednem
tego specu. Zweryfikowane ponownie: `view-state`, `shortcuts`, `home-assistant` — **39/39 zielone**.

### R-2 — correctness — ściągawka skrótów mogła pokazać niepełną listę *(naprawione w recenzji)*

**Plik:** `src/components/shortcuts/ShortcutsCheatSheet.tsx`

**Opis.** Lista była liczona `getShortcuts()` **w trakcie renderu**, w momencie otwarcia. Strona
rejestruje swoje skróty w efekcie, więc otwarcie ściągawki tuż po wejściu na stronę mogło złapać
moment, w którym w rejestrze były jeszcze same skróty globalne — a raz policzona lista **nigdy się
nie odświeżała**, bo nic nie wymuszało ponownego renderu.

**Scenariusz awarii.** Wejdź na `/tasks/all` i natychmiast naciśnij `?` → sekcja „Ta strona" pusta,
mimo że skróty działają. Objawiło się realnie: `[sc-AC11]` padł raz przy równoległym obciążeniu,
a przeszedł przy powtórce — czyli klasyczny wyścig, nie „flaky test bez przyczyny".

**Poprawka (naniesiona).** Lista trzymana w stanie, czytana po otwarciu i **ponownie po 150 ms**.
Wyścig domknięty; test zielony w trzech kolejnych przebiegach.

### R-3 — correctness — pętla renderów w rejestrze skrótów *(znalezione i naprawione w trakcie implementacji)*

**Plik:** `src/components/shell/ShortcutsProvider.tsx`

Odnotowuję dla kompletności, bo defekt istniał w tym diffie i został naprawiony przed recenzją.
Pierwsza wersja prowidera trzymała listę skrótów w `useState`, przez co niestabilna tablica wpisów
dawała pętlę „rejestracja → `setState` → render → nowa tablica → rejestracja". Objaw był mylący:
padał klikacz **przełącznika ulubionych**, nie skrótów. Naprawione u przyczyny: prowider bez stanu,
rejestr trzyma referencje. Lekcja w `doświadczenia.md`.

### R-4 — convention — AC-2 zrealizowane z odstępstwem interpretacyjnym *(świadome, zaakceptowane)*

**Plik:** `src/components/favorites/FavoritesSidebarSection.tsx`, `plan.md` §5.1

Spec mówi „punkt zapisu wyraźnie widoczny **w pasku bieżącego widoku**". W Omnii **nie ma wspólnego
górnego paska na desktopie** — `AppShell` renderuje `<main>{children}</main>`, a nagłówek należy do
modułu. Zrealizowano jako pierwszy element sekcji ulubionych na górze nawigacji, z etykietą tekstową.

**Ocena recenzenta: akceptuję.** Alternatywa (globalny pasek nad `children`) oznaczałaby podwójne
nagłówki w ~20 modułach i utratę przestrzeni pionowej — wprost sprzeczne z C-53 i z „zero zbędnych
kliknięć". Decyzja została zapisana w planie **przed** implementacją i zgłoszona w `verify.md`, a nie
odkryta po fakcie. Intencja zgłoszenia („nie ma tego na komputerze") jest spełniona.

### R-5 — simplification — zakładki szczegółów Warsztatów i Zwierząt bez klikacza *(uwaga, nie blokuje)*

**Pliki:** `src/components/warsztaty/WorkshopDetail.tsx`, `src/components/pets/PetDetailPage.tsx`

Klikacze fazy B pokrywają 11 widoków, ale nie te dwa — wymagają istniejącego warsztatu/zwierzęcia
w bazie testowej, czego seed nie gwarantuje. Kod jest wpięty **identycznie** jak w 11 przetestowanych
widokach (ten sam `useViewState`, ta sama para `oneOf` + `setTab`), a `pokrycie-widokow.md` je
wymienia. Ryzyko oceniam jako niskie; odnotowuję jawnie zamiast udawać pełne pokrycie.

### R-6 — convention — angielskie etykiety zakładek w Zakupach *(zastane, poza zakresem)*

`FILTER_LABELS` renderuje „All / Needed / In Cart / Done / Missing" — niezgodne z C-32 (teksty PL).
**To stan zastany**, nietknięty przez ten feature; zauważone przy pisaniu klikacza. Nie poprawiam
w tym diffie, bo to „refaktor przy okazji" (C-53). Warto zgłosić jako osobne zadanie.

---

## 2. Sprawdzone i **bez** ustaleń

| Obszar | Wynik |
|--------|-------|
| **C-12** enumy Prisma | brak zmian schematu; wszystkie unie to typy TS |
| **C-14** migracja raportu | idempotentna, dollar-quoting, slug globalnie unikalny, `ON CONFLICT DO UPDATE`; bez DDL, więc rollback zbędny |
| **C-20 / C-21** Server Actions i guardy | **zero nowych i zmienionych akcji** — cały feature jest kliencki plus jeden seed SQL; nie ma więc gdzie zgubić `revalidatePath` ani guardu |
| **C-23** `AIAction` bez egzekutora | brak nowych akcji AI; `check:actions` zielone |
| **C-30** hardcode kolorów | nowe komponenty wyłącznie `var(--…)`, `color-mix` na tokenie akcentu, `var(--on-accent)` na kolorowym przycisku |
| **C-31** mobile | widget widoczny na każdej szerokości (sedno zgłoszenia), cele dotyku ≥32 px, brak drugiego sidebara |
| **C-41 / bezpieczeństwo** | brak obsługi kluczy, brak nowego renderu HTML/markdown; ulubione dalej filtrowane przez `isPathLocked`, więc skrót `Alt+N` nie omija RBAC |
| **Martwy kod** | usunięte propsy `initialFilter`/`initialModule` nie mają już żadnych użyć (zostały tylko komentarze wyjaśniające); `HomeAssistantColumn.tsx` skasowany |
| **Sanityzacja adresu** | `oneOf` odrzuca wartości spoza listy, `parseViewParams` nigdy nie rzuca — ręcznie podmieniony adres nie wywraca widoku |
| **Stabilność adresu** | `buildViewQuery` iteruje po kluczach `spec`, więc ten sam widok zawsze daje ten sam adres — warunek konieczny dla `@@unique([ownerId, path])` w ulubionych |

---

## 3. Bramki po poprawkach recenzenckich

| Komenda | Wynik |
|---------|-------|
| `npx tsc --noEmit` | ✅ |
| `npx next lint --dir src` | ✅ 0 błędów, 16 ostrzeżeń (= stan sprzed feature'a) |
| `npx next build` | ✅ |
| E2E `view-state \| shortcuts \| home-assistant` | ✅ **39/39** |
| E2E `view-state-faza-b` | ✅ 23/23 |

`[fav-AC7]` pozostaje czerwony — potwierdzone twardo, że **pada również na kodzie sprzed 043**
(`git checkout 9e34ee6 -- worldofmag/src`), więc nie jest regresją tego specu.

---

## 4. Werdykt: **APPROVE Z UWAGAMI**

Dwa realne defekty (R-1, R-2) znalezione i naprawione w recenzji, oba potwierdzone testami. Trzeci
(R-3) naprawiony wcześniej i udokumentowany. Uwagi R-4, R-5 i R-6 są świadome, opisane i nie blokują.

Feature realizuje wszystkie cztery zgłoszenia właściciela u przyczyny, a nie objawowo: ulubione
przestały być niewidzialne (usunięty `return null`), stan widoku żyje w adresie w **17 widokach**
przez jeden wspólny mechanizm, kolizja `Alt+1` naprawiona jedną regułą w jednym miejscu zamiast łatki
w dwóch listenerach, a widget asystenta jest pierwszy i widoczny na telefonie. Piąte zgłoszenie —
raport administracyjny — mówi właścicielowi wprost także to, czego nie chce usłyszeć: że najdroższy
wariant rozwiązuje problem, którego ta aplikacja nie ma.
