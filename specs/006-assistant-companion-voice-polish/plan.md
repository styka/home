# Plan techniczny: Asystent-kompan — rozmowa, dopracowany głos, czysty composer

- **Spec:** ./spec.md (006-assistant-companion-voice-polish)
- **Status:** draft
- **Data:** 2026-07-16

> **Zasada planu:** to jest **JAK**, pod istniejący kod agenta (`api/llm/home/agent/route.ts`,
> `lib/ai/fastPath.ts`) i Asystenta (`home/AICommandSheet.tsx`, `home/ActionDrawer.tsx`). Naśladujemy
> istniejące wzorce; rozwijamy 004/005. **Bez zmian w schemacie i bez nowej `AIAction`.**

## 1. Podejście (2–4 zdania)
Trzy skoordynowane zmiany, wszystkie w istniejących plikach Home/AI (wzorzec = sam ten moduł):
(1) **tuning promptu agenta** — persona „kompana", domyślnie rozmowa/odpowiedź, plan tylko przy
wyraźnej intencji zmiany, clarify gdy cel niejednoznaczny; (2) **przeprojektowanie pętli głosowej** w
`AICommandSheet` — po wykryciu planu **nie pauzujemy** i **nie otwieramy** zasłaniającego `ActionDrawer`;
karta akcji zostaje w wątku (z szybkim „Zatwierdź/Popraw/Odrzuć"), rozmowa toczy się dalej, a komendy
głosowe (zatwierdź/odrzuć/korekta) sterują kartą; dochodzi **nie-zasłaniający wskaźnik trybu**; (3)
**redesign composera** mobile-first (szersze pole, drugorzędne akcje w „+"). Zero migracji, zero nowych
akcji AI — zmieniamy **instrukcje** agenta i **warstwę UX**.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Rozmowa (pisana i głosowa) dalej zapisuje się przez istniejące
`persist`→`appendAiMessage`→`AiMessage`. Stan trybu głosowego i „aktywnej karty planu" jest **ulotny,
kliencki** (React). → **brak migracji** (C-10/C-11/C-12 nie dotyczą; `check:migrations` zielone bez zmian).

## 3. Warstwa serwera (Server Actions — C-20)
**Brak nowych/zmienionych Server Actions.** Wykonanie akcji dalej przez istniejący `/api/llm/home/execute`
(+ istniejące executory z `revalidatePath`); persystencja przez istniejące `aiConversations`. Zmiana
zachowania agenta to **treść promptu** w route’cie API (nie mutacja danych).

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Wszystko w istniejącym Asystencie (`module.home`); brak nowego sluga, brak wpięć w
`permissions.ts`/`modules.tsx`/`ModuleSidebar`.

## 5. UI / logika (C-30, C-31, C-32)

### 5.1 Asystent-kompan — prompt agenta (obszar 1)
Plik: `src/app/api/llm/home/agent/route.ts` (funkcja budująca system prompt, ok. L207–248) oraz
drobny tuning `src/lib/ai/fastPath.ts`.
- **Persona:** dopisać na początku promptu, że Asystent jest **kompanem** — rozmawia naturalnie, po
  ludzku, z dostępem do danych; **domyślnie odpowiada/rozmawia**, a nie „produkuje akcje".
- **Reguła decyzji (wzmocniona):**
  - Wypowiedzi opisowe/emocjonalne/small-talk/opinie/pytania → **`answer`** (konwersacja), **nie `plan`**.
  - **`plan`** tylko gdy użytkownik **wyraźnie** chce zmienić dane (dodaj/utwórz/zmień/oznacz/usuń/
    przesuń…).
  - **`clarify`** gdy polecenie zmiany **nie wskazuje jednoznacznie celu**, a istnieje **wiele**
    kandydatów (np. kilka list zadań/projektów/zwierząt) — **najpierw dopytaj**, nie zgaduj.
  - Zachować dotychczasową trafność jednoznacznych poleceń: gdy cel jest jasny („…do listy Zakupy") →
    od razu `plan`, bez zbędnego pytania (AC-5).
- **fastPath:** wzmocnić instrukcję klasyfikatora, by przy container-scoped tworzeniu (np.
  `tasks:create_task`) zwracał **`complex`**, gdy użytkownik zdaje się chcieć konkretnej, lecz
  **nienazwanej** listy/projektu (oddaj sterowanie pętli agenta → clarify). Proste, jednoznaczne „dodaj
  X" zostaje „simple" (bez regresu szybkiej ścieżki).
- Teksty promptu po polsku (C-32); bez zmian w routingu modeli (C-40) — tylko instrukcje.

### 5.2 Dopracowany tryb głosowy + widoczne/korygowalne akcje (obszar 2)
Plik: `src/components/home/AICommandSheet.tsx` (pętla z 005) + `ActionDrawer.tsx` (współdzielona detekcja
akcji niszczących).
- **Koniec twardej pauzy na plan.** Usuwamy stan `review`/auto-otwarcie `ActionDrawer` w trybie
  głosowym. Gdy agent zwróci `plan` w trybie głosowym: karta planu ląduje w wątku (jak dziś renderuje
  `TurnView`), Asystent **wypowiada krótką zapowiedź** („Przygotowałem N akcji — są w czacie; powiedz
  „zatwierdź", „odrzuć" albo podaj poprawkę") i **wraca do nasłuchu** (pętla płynie dalej — AC-7).
  Zapamiętujemy **id aktywnej, niepotwierdzonej karty planu** (`pendingPlanIdRef`).
- **Turn-taking po pauzie (AC-6)** — bez zmian mechaniki z 005 (`SpeechRecognition` kończy na ciszy →
  `onFinal`); dopracowanie: krótsze/wyraźne stany.
- **Routing wypowiedzi w trybie głosowym** (`onFinal`), gdy istnieje aktywna karta planu:
  - **Potwierdzenie** (dopasowanie do listy fraz PL: „zatwierdź", „wykonaj", „potwierdzam", „zrób to",
    „tak zrób", „dobra rób") → wykonaj akcje **nie-niszczące** aktywnej karty przez istniejące
    `handleExecute` (akcje niszczące zostają na karcie do świadomego dotknięcia — zachowanie destructive
    opt-in; Asystent to wypowiada). → tura `results` (AC-9).
  - **Odrzucenie** („odrzuć", „anuluj", „nie rób", „zostaw to") → oznacz kartę jako odrzuconą/`done`.
  - **W innym razie** → zwykła rozmowa: `handleSend(utterance)` z **wstrzykniętą do kontekstu treścią
    aktywnej karty** (patrz `buildHistory` niżej), dzięki czemu agent może **poprawić** akcje (nowa/
    zaktualizowana karta) albo po prostu odpowiedzieć (AC-8). Rozmowa płynie dalej.
  - Gdy **brak** aktywnej karty — jak dotąd (handleSend / submitClarify dla clarify).
- **Widoczność korekty:** `buildHistory()` rozszerzamy tak, by dla `plan` wstawiał **skrót treści akcji**
  (np. „(proponowane akcje: Dodaj „mleko" do Zakupy; …)"), nie tylko licznik — aby korekta głosem
  („nie, do listy Apteka") była dla agenta zrozumiała.
- **Karta planu w wątku — szybkie akcje (oba tryby):** w `TurnView` dla `kind==="plan"` dokładamy
  kompaktowy rząd **„Zatwierdź" / „Popraw" / „Odrzuć"** obok istniejącego „Przejrzyj i wykonaj":
  - „Zatwierdź" (inline) → wykonaj nie-niszczące akcje (jak wyżej); „Przejrzyj i wykonaj" → pełny
    `ActionDrawer` (kontrola szczegółowa + destructive opt-in) — bez zmian.
  - „Popraw" → pole/na głos: przekazuje korektę do `handleRefine` (istnieje).
  - „Odrzuć" → zamknij kartę.
  Tak samo działa w trybie pisanym (spójność, lepszy UX, bez regresu drawera).
- **Detekcja akcji niszczących — reuse:** przenieść `DESTRUCTIVE_TYPES`/`isDestructiveAction` z
  `ActionDrawer.tsx` do współdzielonego miejsca (np. `src/lib/ai/aiAction.ts`) i użyć w obu (drawer +
  szybkie „Zatwierdź"). Minimalny refactor pod reuse (C-53), bez zmiany zachowania drawera.
- **Nie-zasłaniający wskaźnik trybu (AC-10):** zamiast (potencjalnego) pełnoekranowego orba —
  **kompaktowy, subtelnie animowany wskaźnik** trybu głosowego zintegrowany z composerem/nagłówkiem
  (np. pulsująca kropka/pierścień przy przełączniku + krótki stan „Słucham/Mówię"), tak by **nie
  zakrywał** wątku ani kart akcji. Kolory z tokenów CSS (C-30). Prosty CSS keyframe (bez bibliotek).
- **Bez zmian:** zapis rozmowy jako czat tekstowy (AC-11), degradacja bez wsparcia (AC-12), zwolnienie
  mikrofonu przy zamknięciu/zmianie rozmowy (poprawka z 005 zostaje).

### 5.3 Redesign composera (obszar 3) — mobile-first
Plik: `src/components/home/AICommandSheet.tsx` (blok composera) + ewentualnie drobiazg w
`ui/SmartTextarea.tsx` (tylko jeśli konieczne dla szerokości — domyślnie nietykany).
- **Układ jednego rzędu:** `[ „+" popover ] · [ SmartTextarea (flex-1, min-w-0) ] · [ przełącznik
  rozmowy głosowej ] · [ Wyślij/Stop ]`. Pole tekstowe dostaje `flex:1; min-width:0`, kontrolki
  `flex-shrink:0`, mniejsze cele na wąskim ekranie (utrzymać ≥ wygodny dotyk), spójne wyrównanie do dołu,
  `env(safe-area-inset-bottom)`.
- **„+" popover** grupuje **drugorzędne** akcje: **Zdjęcie** (dzisiejszy `ImagePlus`) oraz — dla
  odchudzenia nagłówka na mobile — opcjonalnie **Stałe preferencje**; nic nie znika (AC-14), tylko się
  porządkuje. Popover: prosty, na zmiennych CSS, zamykany `Esc`/klik poza.
- **Przełącznik rozmowy głosowej** zostaje dedykowanym przyciskiem (to główny tryb) — z wbudowanym
  **wskaźnikiem** (5.2). Dyktowanie (własny mikrofon `SmartTextarea`) zostaje wewnątrz pola (tryb
  pisania) — po poszerzeniu pola mieści się czytelnie.
- **Desktop (AC-15):** ten sam układ pozostaje estetyczny (więcej miejsca); redesign nie psuje szerokiego
  widoku. Teksty/aria PL (C-32), tylko zmienne CSS (C-30).

## 6. AI / integracje (C-23, C-40)
- **Brak nowej `AIAction`**, brak zmian w `agentTools.ts`/executorach → `check:actions` zielone bez zmian
  (C-23). Zmiana dotyczy **instrukcji** agenta i **UX**, nie katalogu akcji.
- **Routing modeli bez zmian** (C-40) — korzystamy z istniejącego `/api/llm/home/agent` (`op:"reasoning"`)
  i `fastPath` (`op:"dispatch"`). Wykonanie akcji przez istniejący `/execute`.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/app/api/llm/home/agent/route.ts` | edycja | Prompt: persona-kompan + reguły answer/clarify vs plan (obszar 1) |
| `src/lib/ai/fastPath.ts` | edycja | Klasyfikator częściej `complex` przy nienazwanym celu (oddaj clarify agentowi) |
| `src/components/home/AICommandSheet.tsx` | edycja | Pętla głosowa bez pauzy na plan; routing komend głosowych (zatwierdź/odrzuć/korekta); `pendingPlanIdRef`; zapowiedź; `buildHistory` z treścią akcji; szybkie „Zatwierdź/Popraw/Odrzuć" na karcie planu; nie-zasłaniający wskaźnik; **redesign composera** + „+" popover |
| `src/components/home/ActionDrawer.tsx` | edycja | Wyjęcie `DESTRUCTIVE_TYPES`/`isDestructiveAction` do reuse (bez zmiany zachowania) |
| `src/lib/ai/aiAction.ts` | edycja | Dom na współdzielony helper `isDestructiveAction` (import w drawer + sheet) |
| `doświadczenia.md` | edycja (jeśli problem) | Lekcja przy nieoczywistym bugu (C-51) |
| `specs/006-*/*.md` | artefakty | Pipeline (C-03) |

*(SmartTextarea domyślnie nietykany — C-53; ruszamy tylko jeśli szerokość pola tego wymaga.)*

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie** (lokalny Postgres, C-13, **do `next build`**, bez `migrate.js`): `check:migrations`,
  `check:actions`, `next lint --dir src`, `next build`. Brak migracji/akcji ⇒ obie `check:*` zielone.
- **Weryfikacja funkcjonalna:**
  - **Obszar 1 (kompan)** — sprawdzalne bez mikrofonu: scenariusze czatu pisanego (pytanie→answer;
    „dodaj mleko do Zakupy"→plan; „dodaj zadanie" przy wielu listach→clarify; small-talk→answer). Można
    zweryfikować logikę promptu i (jeśli sensowne) mały test jednostkowy dla `fastPath` (defer→complex).
  - **Obszar 2/3 (głos/composer)** — pętla głosowa i wskaźnik: **ręcznie w Chrome** (Web Speech poza
    headless CI); routing komend (zatwierdź/odrzuć/korekta) i szybkie przyciski karty — **prześledzenie
    logiki** + build; composer: wizualnie desktop + wąski ekran (dev tools).
- **Mapowanie AC → sposób:** AC-1..AC-5 (prompt agenta + fastPath; scenariusze pisane), AC-6..AC-12
  (pętla/karty/wskaźnik; logika + ręczny test), AC-13..AC-15 (composer; wizualnie mobile+desktop).

## 9. Ryzyka techniczne i plan wycofania
- **Nadmierne rozluźnienie/nadmierne dopytywanie agenta** → reguła: plan przy wyraźnej intencji, clarify
  tylko przy realnej wieloznaczności celu; AC-2/AC-5 pilnują braku regresu jednoznacznych poleceń.
  Iteracja promptu tania (tekst).
- **Routing komend głosowych myli korektę z rozmową** → lista fraz confirm/cancel wąska i jednoznaczna;
  wszystko inne → rozmowa/korekta przez agenta; nic nie wykonuje się bez confirm (bezpieczne).
- **Akcje niszczące przy „zatwierdź" głosem** → wykonujemy tylko nie-niszczące; niszczące wymagają
  dotknięcia (reuse `isDestructiveAction`) — zachowany destructive opt-in (AC-9).
- **Regres composera na desktopie** → AC-15; układ jednorzędowy działa w obu szerokościach; brak drugiego
  sidebaru (C-31).
- **Web Speech (Safari/iOS)** → degradacja jak 005 (AC-12).
- **Rollback:** czysto kodowy (brak migracji) — rewert commita/PR na `develop` cofa całość bez śladu w DB.

## 10. Zgodność z konstytucją — checklista
- [x] **C-10..C-14 (migracje)** — brak zmian w schemacie; brak migracji.
- [x] **C-20..C-25 (server/RBAC/AI/trash/audit)** — brak nowych akcji/sluga/`AIAction`; wykonanie i
  persystencja przez istniejące ścieżki; soft-delete niszczących bez zmian; `check:actions` zielone.
- [x] **C-30..C-32 (UX)** — tokeny CSS, mobile-first composer + nie-zasłaniający wskaźnik, teksty/aria PL,
  prompt PL.
- [x] **C-53 (minimalizm)** — zmiany w istniejących plikach; reuse `ActionDrawer`/`handleExecute`/
  `handleRefine`/pętli 005; jeden mały refactor (wyjęcie `isDestructiveAction`) pod reuse; zero nowych
  zależności; brak animacji-bibliotek (czysty CSS keyframe).
- [x] **C-54** — spec 006 świadomie zmienia decyzję 005 (pauza→przepływ); artefakty spójne.
- [x] **C-50/C-52** — „gotowe" = zielony build; auto-merge `develop`; pytanie domykające o `master`.
