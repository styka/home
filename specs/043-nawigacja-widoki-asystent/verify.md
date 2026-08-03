# Weryfikacja: Nawigacja po widokach, widget asystenta i układ strony głównej

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (27/27 odhaczonych — 26 z planu + T-27 z zawrotu)
- **Data:** 2026-08-03
- **Werdykt:** **GOTOWE Z UWAGAMI** — po zawrocie do `/implement` (T-27) domknięty jedyny brak.
- **Historia:** przebieg 1 → **DO POPRAWY** (AC-7 zweryfikowane tylko dla Notatek) → `/implement`
  T-27 → przebieg 2 → **GOTOWE Z UWAGAMI**.

---

## 1. Bramki techniczne

Wszystko na **lokalnym Postgresie** (C-13 — prod DB nietknięte; `scripts/migrate.js` świadomie
nieuruchamiany, weryfikacja do kroku `next build` włącznie, zgodnie z C-50).

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ Numeracja OK, następny wolny numer 0223 |
| `npm run check:actions` | ✅ 160 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 545 akcji z zadeklarowanym zakresem dostępu i guardem |
| `npm run check:cost-badge` | ✅ 34 pliki wołające model |
| `npm run check:content-memory` | ✅ 34 pliki sklasyfikowane |
| `npx next lint --dir src` | ✅ 0 błędów, **16 ostrzeżeń** |
| `npx next build` | ✅ przechodzi (pełna tabela tras wygenerowana) |
| `npx prisma migrate deploy` | ✅ migracja `0222_raport_architektura_zdarzeniowa` zaaplikowana |

**Ostrzeżenia lintera nie wzrosły.** Sprawdzone twardo, nie „na oko": `git stash` → lint na kodzie
bez zmian → **16**; z powrotem → **16**. Feature nie dołożył ani jednego ostrzeżenia.

**Manifesty pokrycia AI nie wymagały żadnej zmiany**, dokładnie jak zakładał plan §3 (feature nie
dodaje Server Actions ani wywołań `chatComplete`/`chatStream`). Plan traktował żądanie wpisu jako
sygnał rozjazdu zakresu — sygnał nie wystąpił.

---

## 2. Kryteria akceptacji

Legenda dowodów: **[E2E]** = test Playwright (nazwa testu), **[kod]** = prześledzenie ścieżki w
kodzie, **[DB]** = sprawdzenie w bazie.

### Ulubione — odkrywalność i zarządzanie

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — sekcja + zachęta + zarządzanie przy zerze wpisów | ✅ | [E2E] `favorites.spec.ts [fav043-AC1-AC2]` — po wyczyszczeniu ulubionych widoczne: nagłówek „Ulubione", tekst „Nie masz jeszcze zapisanych widoków…", ikona zarządzania. [kod] `FavoritesSidebarSection.tsx` — usunięty `if (accessible.length === 0) return null;` |
| **AC-2** — punkt zapisu wyraźnie widoczny, nie na dole nawigacji | ⚠️ **spełnione z odstępstwem interpretacyjnym** | [E2E] `[fav043-AC1-AC2]` — widoczna etykieta „Zapisz ten widok" (nie sama ikona); [kod] `ModuleSidebar.tsx` — gwiazdka usunięta z dołu paska. **Odstępstwo:** spec mówi „w pasku bieżącego widoku", a w Omnii **nie istnieje wspólny górny pasek na desktopie** (`AppShell` renderuje `<main>{children}</main>`, nagłówek należy do modułu). Punkt zapisu jest **pierwszym elementem sekcji ulubionych na górze nawigacji**. Powód odrzucenia alternatywy (globalny pasek nad `children`): podwójne nagłówki w ~20 modułach i utrata przestrzeni pionowej — sprzeczne z C-53. Decyzja opisana w `plan.md` §5.1 **przed** implementacją. |
| **AC-3** — jedno miejsce do zmiany nazwy/ikony/koloru/kolejności/usunięcia | ✅ | [E2E] `[fav043-AC3]` — klik „Zarządzaj ulubionymi" → `/settings`, sekcja `#ulubione` widoczna; edytor `FavoriteViewsEditor` z 042 bez zmian |

### Zapisywanie widoku z filtrami

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-4** — zapisany widok odtwarza wszystkie ustawienia | ✅ | [E2E] `view-state.spec.ts [vs-AC4]` — `/tasks/all?layout=kanban` → zapis gwiazdką → wyjście na `/notes/all` → powrót z ulubionych → `layout=kanban` odtworzone |
| **AC-5** — adres odzwierciedla stan i da się go skopiować | ✅ | [E2E] `[vs-AC5]` (klik „Kanban" → `layout=kanban` w adresie) i `[vs-AC5b]` (otwarcie `/tasks/all?layout=kanban` → parametr NIE ginie przy starcie widoku) |
| **AC-6** — „wstecz" wraca do poprzedniego stanu filtrów | ✅ | [E2E] `[vs-AC6]` — Kanban → Timeline → `goBack()` → Kanban → `goBack()` → adres czysty |
| **AC-7** — to samo w Zakupach i Notatkach | ✅ **(domknięte w przebiegu 2)** | Notatki: [E2E] `[vs-AC7]` — tryb siatki → `view=grid`, ponowne otwarcie adresu daje ten sam tryb. Zakupy: [E2E] `[vs-AC7-zakupy]` (T-27) — na realnej liście: wejście bez parametrów zostaje czyste, klik zakładki → `filter=NEEDED`, a adres `?filter=DONE&sort=product` otwiera ten sam widok |
| **AC-8** — wejście bez parametrów bez regresji | ✅ | [E2E] `[vs-AC8]` (`/tasks/all`, `/notes/all` → `search === ""`) oraz **11 modułów** w `view-state-faza-b.spec.ts` (pierwsza asercja każdego testu) |
| **AC-8a** — mechanizm działa w pozostałych modułach | ✅ | [E2E] `view-state-faza-b.spec.ts` — **23/23 zielone, zero pominięć** (Zdrowie, Kalendarz, Wiadomości, Usługi ×2, Pogoda/Pomysły, Kontakty, Raporty, Magazynowanie, Kuchnia ×2) |
| **AC-8b** — każdy moduł pokryty albo z uzasadnieniem | ✅ | Artefakt `pokrycie-widokow.md` — przegląd **wszystkich 21 pozycji** z `src/lib/modules.tsx`: 17 widoków pokrytych, 8 modułów pominiętych z powodem, osobno uzasadnione pominięcie panelu filtrów zaawansowanych w Usługach i stanu kroku pracy |

### Skróty klawiszowe

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-9** — skrót ulubionego nie zmienia zakładki | ✅ | [E2E] `shortcuts.spec.ts [sc-AC9]` — `Alt+1` na `/tasks/all` → skok na `/notes/all`, a `status` w adresie **pozostaje `null`**. [kod] `registry.ts` `matchShortcut` — goły klawisz wymaga `!altKey && !ctrlKey && !metaKey` |
| **AC-10** — goła cyfra przełącza zakładkę | ✅ | [E2E] `[sc-AC10]` — `2` na `/notes/all` → `filter=PINNED` |
| **AC-11** — ściągawka z listą skrótów strony i globalnych | ✅ | [E2E] `[sc-AC11]` — `?` otwiera nakładkę z sekcjami „Ta strona" i „Globalne" oraz realnym wpisem „Zakładka filtra 1"; `Esc` zamyka. Lista pochodzi z rejestru (`getShortcuts()`), nie ze stałej |
| **AC-12** — pisanie nie jest przechwytywane | ✅ | [E2E] `[sc-AC12]` — w polu wyszukiwarki wpisane „2d" zostaje tekstem, `status` w adresie `null`. [kod] reguła „`Shift` nie blokuje, `Alt+…` wymaga `!ctrlKey` (AltGr = Ctrl+Alt)" w jednym miejscu |

### Widget asystenta

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-13** — widoczny bez przewijania i pierwszy na telefonie | ✅ | [E2E] `home-assistant.spec.ts [ha-AC13]` na profilu `devices["Pixel 5"]` — `boundingBox().y < viewport.height` |
| **AC-14** — pierwszy także na komputerze | ✅ | [E2E] `[ha-AC14-AC15]` — `compareDocumentPosition` potwierdza, że `<h1>` powitania występuje **po** widgecie. [kod] `HomePage.tsx` — zero wystąpień `hidden xl:block` |
| **AC-15** — brak pola tekstowego | ✅ | [E2E] `[ha-AC14-AC15]` — `widget.locator("textarea, input")` ma **0** elementów. [kod] jedyne wystąpienie słowa „textarea" w `HomeAssistantCard.tsx` to komentarz wyjaśniający, dlaczego go nie ma |
| **AC-16** — akcja uruchamiana od razu | ✅ | [E2E] `[ha-AC16]` — klik akcji → panel asystenta otwarty **i** treść polecenia widoczna w wątku, bez pisania |
| **AC-17** — akcje z jednego źródła | ✅ | [kod] statycznie: jedyna lista to `src/lib/ai/assistantStarters.ts`; dwa importy (`AICommandSheet.tsx:31`, `HomePage.tsx:19`) i **zero** innych definicji (grep po `STARTER_CHIPS` nie zwraca już nic poza modułem źródłowym) |

### Układ pulpitu

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-18** — kafelki bez pustych dziur | ✅ | [E2E] `[ha-AC18]` — pomiar `boundingBox` kafelków w każdej kolumnie: żaden odstęp pionowy nie przekracza 24 px (zadany odstęp to 16 px). Przed zmianą siatka zostawiała dziurę na całą różnicę wysokości wiersza |
| **AC-19** — poza trybem edycji co najmniej równie uporządkowany | ✅ | [kod] tryb edycji = `columns-1` (liniowo, jak dotąd), poza nim `md:columns-2` z ciasnym pakowaniem; brak dziur potwierdzony testem AC-18 |
| **AC-20** — brak poziomego przewijania, sensowna kolejność | ✅ | [E2E] `[ha-AC20]` — 360/768/1440 px, `scrollWidth - clientWidth ≤ 1`. Kolejność: na wąskim ekranie jedna kolumna = dokładnie kolejność użytkownika |

### Raport architektoniczny

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-21** — raport ocenia stan faktyczny | ✅ | [DB] `Report` slug `omnia-architektura-zdarzeniowa-cofanie-live-2026-08-03`, 14 964 znaków. Rozdziały 2–4 odpowiadają na trzy pytania wprost, ze wskazaniem plików |
| **AC-22** — wskazanie miejsc w aplikacji + warianty z kosztem i ryzykiem | ✅ | Rozdział 5 — warianty (a)–(e) z kosztem („godziny"/„dni"/„miesiące") i ryzykiem; rozdział 8 — tabela plików do zmiany |
| **AC-23** — jawnie nazwane, czego nie da się osiągnąć tanio | ✅ | Rozdział 6 — sześć punktów, w tym najważniejszy: przy jednym aktywnym użytkowniku najdroższy wariant **rozwiązuje problem, którego ta aplikacja nie ma** |

**Korekta wobec pierwotnego szkicu planu (C-54).** Plan zakładał, że odświeżanie danych między
urządzeniami nie istnieje. Rekonesans pokazał, że **istnieje częściowo** —
`src/components/shell/DataFreshness.tsx` robi `router.refresh()` przy powrocie do karty i cyklicznie
co 45 s. Plan §5.6 został poprawiony **przed** napisaniem raportu, a raport nazywa ten stan wprost,
zamiast sprzedawać jako nowość coś, co właściciel ma od dawna.

---

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|--------|-------|
| **C-01** praca w `worldofmag/` | ✅ jedyne pliki poza nim to artefakty `specs/` (dozwolone przez C-03) i `doświadczenia.md` (wymagane przez C-51) |
| **C-02** alias `@/*` | ✅ wszystkie nowe importy przez alias |
| **C-03** artefakty w `specs/<NNN-slug>/` | ✅ + dodatkowy `pokrycie-widokow.md` jako dowód AC-8b |
| **C-10, C-11, C-14** migracje | ✅ jedna ręczna migracja `0222`, numer z `next:migration`, dollar-quoting, `ON CONFLICT DO UPDATE`, slug globalnie unikalny |
| **C-12** zero enumów Prisma | ✅ brak zmian schematu |
| **C-13** nigdy prod DB | ✅ wszystko na lokalnym Postgresie; `migrate.js` nieuruchamiany |
| **C-20, C-21** Server Actions / własność | ✅ brak nowych i zmienionych akcji — feature jest w całości kliencki plus jeden seed SQL |
| **C-22** RBAC | ✅ bez nowego sluga; ulubione nadal filtrowane przez `isPathLocked` |
| **C-23** `AIAction` + egzekutor | ✅ brak nowych akcji AI; `check:actions` zielone |
| **C-30** motyw przez zmienne CSS | ✅ nowe komponenty używają wyłącznie `var(--…)`, `color-mix` na tokenie akcentu, `var(--on-accent)` na kolorowym przycisku |
| **C-31** mobile-first / keyboard-first | ✅ widget widoczny na każdej szerokości (sedno zgłoszenia), cele dotyku ≥32 px, skróty uporządkowane i udokumentowane ściągawką |
| **C-32** teksty po polsku | ✅ wszystkie nowe napisy i komunikaty |
| **C-51** dziennik doświadczeń | ✅ trzy wpisy: pętla renderów w rejestrze, skróty na gołe cyfry, dziury po wyrównywaniu wierszy w CSS Grid |
| **C-53** minimalizm | ✅ zero nowych zależności; jeden wspólny mechanizm stanu widoku zamiast implementacji per moduł; `useKeyboardShortcuts` z **niezmienioną sygnaturą**, więc żaden z kilkunastu modułów jej używających nie wymagał zmian; AC-3 zrealizowane dowiązaniem do istniejącego edytora |
| **C-54** spójność artefaktów | ✅ dwie korekty wstecz: plan §5.6 (istniejący `DataFreshness`) i testy 042 dla dokowanej kolumny asystenta, przepisane na kontrakt 043 |
| **C-55** jeden moment pytań | ✅ po `/specify` nie zadano żadnego pytania |

**Brak naruszeń blokujących.**

---

## 4. Regresje

| Obszar | Wynik |
|--------|-------|
| **Moduły używające `useKeyboardShortcuts`** | ✅ sygnatura niezmieniona, zero zmian w plikach modułów; `[sc-AC10]` i `[sc-AC12]` pilnują dotychczasowego zachowania |
| **Wejście na moduły bez parametrów** | ✅ 13 widoków sprawdzonych testem (`vs-AC8` + pierwsza asercja każdego testu fazy B) — adres zostaje czysty |
| **Zapamiętane preferencje przeglądarki** (grupowanie zadań, sortowanie zakupów, tryb notatek) | ✅ zachowane; adres ma pierwszeństwo, przywrócenie idzie przez `replace`, więc nie zaśmieca historii |
| **Deep-linki asystenta `?status=`** | ✅ działają dalej, a **dodatkowo** obsługują teraz własne statusy listy, których serwerowa lista `TASK_STATUS_FILTERS` nie znała |
| **Migracja `0222`** | ✅ bez DDL, idempotentna — ponowne wdrożenie odświeża treść zamiast duplikować |
| **`[fav-AC7]` (zarządzanie ulubionymi)** | ❌ czerwony, ale **pada również na kodzie sprzed 043** — sprawdzone twardo przez `git checkout 9e34ee6 -- worldofmag/src` i uruchomienie tego samego zestawu. **Nie jest regresją tego specu**; to wcześniejsza niestabilność testu |

### Defekt znaleziony i naprawiony w trakcie weryfikacji

Pierwsza wersja `ShortcutsProvider` trzymała listę skrótów w `useState` i publikowała ją przy każdej
rejestracji → komponent przekazujący niestabilną tablicę wpadał w **pętlę renderów**. Objaw był
mylący: padał klikacz **przełącznika ulubionych** („`router.push` nie nawiguje"), a nie nic
związanego ze skrótami. Przyczynę pokazał dopiero `Maximum update depth exceeded` w konsoli
przeglądarki. Naprawione u źródła: prowider bez stanu, rejestr trzyma referencje, migawka liczona na
żądanie. Lekcja w `doświadczenia.md`.

---

## 5. Werdykt końcowy: **GOTOWE Z UWAGAMI**

**Wszystkie 25 kryteriów akceptacji (AC-1..AC-23 + AC-8a + AC-8b) spełnione**, bramki zielone,
zero naruszeń konstytucji.

### Domknięcie zawrotu z przebiegu 1

Przebieg 1 dał **DO POPRAWY**: AC-7 wymienia Zakupy z nazwy, a klikacze pokrywały tylko Notatki.
Nie było dowodu na wadę — był dowód na **nieprzetestowanie**, a zaliczanie AC „na oko" jest dokładnie
tym, czego ten etap ma nie robić. Brak nie wynikał z błędnego speca ani planu (plan przewidywał
Zakupy w fazie A i tak je zaimplementowano), więc nie było potrzeby cofać się do `spec.md`/`plan.md`
(C-54) — wystarczyło dopisać **T-27** i wrócić do implementacji.

**T-27 wykonane, `view-state.spec.ts` 30/30 zielone.** Trzy potknięcia były po stronie samego testu,
nie aplikacji, i wszystkie są udokumentowane w kodzie testu:
1. formularz „Nowa lista" jest w tym środowisku niestabilny (wywraca też `shopping.spec.ts`) → test
   bierze **istniejącą** listę, a przy jej braku pomija się z jawnym powodem;
2. czekanie na `networkidle` zjadało limit czasu, bo powłoka odświeża dane w tle co 45 s
   (`DataFreshness`) → `domcontentloaded`;
3. widoczny przycisk **nie znaczy zhydratowany** — pierwszy klik trafiał w martwy jeszcze element →
   klik ponawiany w `expect.poll`.

### Stan bramek w przebiegu 2

`src/` **nie zmieniło się od zielonego builda** (`git diff 9a54e39..HEAD -- worldofmag/src` = 0 plików;
zmieniły się wyłącznie artefakty `specs/` i jeden plik E2E). Ponownie uruchomione szybkie bramki:
`check:migrations` ✅, `check:actions` ✅, `next lint --dir src` ✅ 16 ostrzeżeń (bez zmian),
`tsc --noEmit -p e2e/tsconfig.json` ✅.

### Uwaga do rozstrzygnięcia na `/review` (nie blokująca)

**AC-2** zrealizowano z odstępstwem interpretacyjnym opisanym w §2 i w `plan.md` §5.1 (brak wspólnego
górnego paska na desktopie → punkt zapisu na górze nawigacji zamiast w nagłówku modułu). Zgłaszam to
jawnie, żeby recenzja podjęła decyzję świadomie, a nie odkryła to po fakcie.
