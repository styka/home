# Zadania: Fala poprawek — bugi i UX

- **Plan:** ./plan.md (080-poprawki-bugow-ux)
- **Status:** todo
- **Data:** 2026-08-19

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna
> z zależnościami** (migracja → akcje → UI → AI → bramki). Każde zadanie jest małe, samodzielne
> i **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Fundament danych

- [x] **T-1** — Migracja `0253_poprawki_bugow_ux` wg planu §2: trzy kolumny
  (`AssistantPref.readerRate` DOUBLE PRECISION DEFAULT 0.95, `AssistantPref.readerFollow` BOOLEAN
  DEFAULT true, `UserMenuPref.favoritesCollapsed` BOOLEAN DEFAULT true), wszystkie
  `ADD COLUMN IF NOT EXISTS`. DDL pisany ręcznie — **nie** z `migrate diff` (C-15).
  **Gotowe, gdy:** `npm run check:migrations` przechodzi, a `grep -E "^(DROP|ALTER TABLE .* DROP)"`
  na nowej migracji nie zwraca nic.
- [x] **T-2** — `schema.prisma`: te same trzy kolumny na `AssistantPref` i `UserMenuPref`.
  **Gotowe, gdy:** `npx prisma generate` czysto i `npm run check:schema-drift` nie zgłasza rozjazdu
  (na lokalnym Postgresie — C-13).

---

## Faza 1 — Naprawy serwerowe niezależne od siebie

Wszystkie cztery zadania tej fazy dotykają rozłącznych plików i nie zależą od Fazy 0.

- [x] **T-3** `[P]` — **Z5: ponowienie semantyczne przy pobieraniu treści.** `src/lib/news/article.ts`:
  pętla do 3 prób na poziomie artykułu; odpowiedź 200 z tekstem krótszym od progu użyteczności liczy
  się jako **nieudana** i jest ponawiana z narastającym odstępem (wspólny helper odstępu, nie druga
  implementacja obok `resilientFetch`).
  **Gotowe, gdy:** test jednostkowy z podstawionym `fetch` pokazuje **3 próby** dla 200+pusta treść
  i 1 próbę dla sukcesu. *(AC-11, część 1)*
- [x] **T-4** `[P]` — **Z5: ponowienie streszczeń.** `src/modules/news/jobs/newsRefresh.ts`
  (`summarizeItems`): pozycje bez streszczenia po pierwszym przebiegu wracają do modelu, łącznie do
  3 prób; postęp przez `ctx.progress`.
  **Gotowe, gdy:** przegląd kodu potwierdza, że do kolejnego podejścia idą **wyłącznie** pozycje
  bez streszczenia, a podejście, które nie ruszyło ani jednej, **przerywa pętlę** (kolejne
  wyglądałoby identycznie i kosztowało tyle samo). *(AC-11, część 2)*
  > **Zmiana wobec planu (C-54):** planowany test jednostkowy odpada. `summarizeItems` jest funkcją
  > prywatną, która pisze do bazy i woła model przez `llmJson` — podstawienie Prismy i kanału LLM
  > byłoby konstrukcją większą niż sama zmiana (C-53). Weryfikacja idzie przez przegląd kodu
  > i ścieżkę Wiadomości w `/verify`. Ponowienie na poziomie pobierania treści (T-3), gdzie
  > zależności są wstrzykiwalne, **jest** pokryte testem.
- [x] **T-5** `[P]` — **Z10: ponowienie i uczciwy komunikat generatora skórek.**
  `src/platform/jobs/handlers/skinGenerate.ts`: przy zerze poprawnych tokenów **jedno automatyczne
  ponowienie** z komunikatem korygującym wymieniającym odrzucone klucze; komunikat porażki podaje
  liczbę i nazwy odrzuconych kluczy. **`validateTokens` bez zmian** — nie ruszamy bramki
  bezpieczeństwa (whitelist chroni przed wstrzyknięciem CSS).
  **Gotowe, gdy:** test jednostkowy — pierwsza odpowiedź bez poprawnych tokenów wyzwala ponowienie,
  a komunikat po porażce zawiera liczbę i nazwy kluczy. *(AC-19)*
- [x] **T-6** `[P]` — **Z4: kod przyczyny odmowy lektora.** `src/lib/tts/serverTts.ts` niesie kod
  wyprowadzony ze statusu dostawcy (`auth`/`model`/`quota`/`provider`/`network`);
  `src/app/api/tts/route.ts` zwraca **kod**, nigdy treści od dostawcy.
  **Gotowe, gdy:** test odwzorowania statusów **plus asercja negatywna: klucz API nie występuje
  w odpowiedzi** (C-41). *(AC-10, część 1)*

---

## Faza 2 — Lektor: głos zapasowy i prędkość

Zależy od T-6 (kod przyczyny) po stronie panelu administratora; T-7 nie zależy od niczego.

- [x] **T-7** — **Z4: zatrzask porażki głosu serwerowego.** `src/lib/tts.ts`: po pierwszej odmowie
  ścieżki serwerowej `speak()` idzie **od razu, synchronicznie** do przeglądarki — w geście
  użytkownika i bez żądania sieciowego. Zatrzask kasuje zmiana głosu/konfiguracji. Jednorazowe,
  nieblokujące powiadomienie o zejściu na głos systemowy.
  **Gotowe, gdy:** test jednostkowy — pierwsze wywołanie schodzi na przeglądarkę, **drugie nie
  wykonuje już żądania**. *(AC-8)*
- [x] **T-8** — **Z4: głos systemowy jako wybór administratora.** `Config.speech_force_browser`
  (`"1"`/`"0"`, brak wiersza = `"0"`) czytany na wejściu `synthesizeSpeech`; odczyt/zapis
  w `src/actions/llmConfig.ts` **z wpisem do `AuditLog`** (C-25); opcja w `SpeechAssignmentRow`.
  W tym samym zadaniu: panel tłumaczy kody przyczyny z T-6 na polskie zdania zamiast jednego
  „Sprawdź klucz API i wybrany model".
  **Gotowe, gdy:** przy `speech_force_browser=1` trasa zwraca 501 i powstaje wpis audytu; komunikat
  próbki rozróżnia odrzucony klucz od nieznanego modelu. *(AC-9, AC-10 część 2)*
- [x] **T-9** — **Z12: prędkość czytania.** `src/actions/assistantPrefs.ts` obsługuje `readerRate`
  i `readerFollow`; `src/lib/tts.ts` przyjmuje prędkość na **obu** ścieżkach (`u.rate` zamiast
  zaszytego `0.95`; `playbackRate` na współdzielonym elemencie audio).
  **Gotowe, gdy:** zmiana prędkości działa dla głosu przeglądarki i serwerowego, a użytkownik bez
  ustawienia słyszy dokładnie to co dziś (0.95). *(AC-22, część 1)* — **zależy od T-1, T-2**

---

## Faza 3 — Pogoda: obserwatory na żądanie

- [x] **T-10** — **Z11: rodzaj sekcji.** `weather.watchers` w `AiContentKind`
  (`src/platform/ai/contentMemory.ts`), w `AI_SECTION_KINDS` i `AI_SECTION_LABELS`
  (`src/platform/ai/sectionMode.ts`, etykieta „Pogoda — obserwatory").
  **Gotowe, gdy:** sekcja pojawia się w ustawieniach trybu odświeżania u użytkownika i administratora.
- [x] **T-11** — **Z11: obserwatory przez pamięć treści.** `evaluateWatchers`
  (`src/modules/weather/actions/weather.ts`) opakowane w `rememberedContent` z `scopeKey` = id
  lokalizacji i `hashInputs` = (obserwatory + skrót prognozy + `userContextStamp`); wariant
  `PendingContent` przy trybie „na żądanie". Uzupełniony `reason` w
  `src/lib/ai/content-memory-coverage.json` (C-54 — opis ma mówić prawdę).
  **Gotowe, gdy:** `npm run check:content-memory` i `npm run check:cost-badge` przechodzą.
  *(AC-21)* — **zależy od T-10**
- [x] **T-12** — **Z11: panel bez automatycznego wywołania.** `WatchersPanel.tsx`: usunięty
  auto-`useEffect`, `AiContentPending` w stanie oczekiwania, `AiContentMeta` (data, znacznik
  „nieaktualne", koszt, przycisk odświeżenia). Stan brzegowy **wyłącznie** przez istniejące
  komponenty, nie rysowany ręcznie (C-33).
  **Gotowe, gdy:** wejście na `/pogoda` nie generuje **ani jednego** wywołania modelu; klik generuje
  i wynik wraca z pamięci przy kolejnym wejściu. *(AC-20)* — **zależy od T-11**

---

## Faza 4 — Wspólna warstwa przyklejona (sedno fali)

- [x] **T-13** — **Z7: komponent `AnchoredLayer`.** `src/components/ui/AnchoredLayer.tsx` — portal do
  `document.body`, pozycja z `getBoundingClientRect()` wyzwalacza i zmierzonego panelu, **odbicie
  w pionie** + **przesunięcie w poziomie**, przeliczenie przy przewijaniu i zmianie rozmiaru;
  `Esc`, klik poza obszarem, `aria-expanded`, zwrot ogniskowania (C-31); wyłącznie zmienne CSS
  (C-30); `z-index` uzgodniony z `useOverlayState`.
  **Gotowe, gdy:** test jednostkowy pozycjonowania — wyzwalacz przy **górnej** i przy **dolnej**
  krawędzi, panel w obu wypadkach mieści się w oknie. *(AC-14 — mechanizm)*
- [x] **T-14** — **Z7: wpis do galerii komponentów.** `src/lib/ui/playground/registry.tsx` —
  warianty brzegowe (wyzwalacz u góry / u dołu) i podgląd pod skórką „Terminal".
  **Gotowe, gdy:** komponent widoczny w `/admin/playground`, a warianty brzegowe dają się obejrzeć
  bez czytania kodu. — **zależy od T-13**
- [x] **T-15** — **Z7: konsument zgłoszony — koszt LLM.** `src/components/ui/AiCostBadge.tsx` traci
  własne `position:absolute` i `bottom: calc(100% + 6px)`, przechodzi na `AnchoredLayer`.
  **Gotowe, gdy:** popover na `/wiadomosci` otwiera się w widoku niezależnie od pozycji przycisku.
  *(AC-14 — miejsce zgłoszone)* — **zależy od T-13**
- [x] **T-16** — **Z2: panele paska zbiorczego + układ desktop.**
  `src/modules/tasks/ui/BulkActionBar.tsx`: sześć paneli na `AnchoredLayer`; pasek na desktopie
  ograniczony szerokością i wyśrodkowany (mobile bez zmian, `env(safe-area-inset-bottom)` zostaje).
  **Najpierw odtwórz błąd**, potem naprawiaj — przyczyny nie ustalono z kodu (plan §5.1).
  **Gotowe, gdy:** okienka statusu i daty są w całości widoczne przy każdej pozycji przewinięcia,
  a pasek nie rozciąga się na całą szerokość okna. *(AC-2, AC-3)* — **zależy od T-13**
- [x] **T-17** `[P]` — **Z7: pozostali trzej konsumenci.** `NotificationBell.tsx`,
  `ProjectActionsMenu.tsx`, `RecipeList.tsx` — każdy traci własne `absolute`.
  **Gotowe, gdy:** żadne z pięciu miejsc nie ma już własnego pozycjonowania warstwy, a wszystkie
  zamykają się `Esc` i kliknięciem poza obszarem. *(AC-15)* — **zależy od T-13**

---

## Faza 5 — Drobne poprawki układu

- [x] **T-18** `[P]` — **Z9: kolejność na stronie głównej.** `src/modules/home/ui/HomePage.tsx` —
  blok powitania przed `HomeAssistantCard`; oba **poza** listą sekcji personalizowanych, więc
  `DASHBOARD_SECTIONS` i `DashboardPref` nietknięte. Komentarz z 043 **zaktualizowany** (C-54).
  **Gotowe, gdy:** powitanie pierwsze, asystent zaraz po nim, a zapisana kolejność sekcji
  użytkownika bez zmian. *(AC-18)*
- [x] **T-19** `[P]` — **Z1: kolumna zaznaczeń.** `src/modules/tasks/ui/TaskRow.tsx` — poza trybem
  zaznaczania checkbox **nie jest renderowany** (dziś jest, tylko przezroczysty, i zajmuje miejsce).
  Świadome cofnięcie ujawniania przy najechaniu z 042 — komentarz w pliku zaktualizowany.
  **Gotowe, gdy:** klikacz potwierdza **brak elementu w DOM** poza trybem i obecność w trybie;
  wyjście z trybu czyści zaznaczenia. *(AC-1)*
- [x] **T-20** — **Z8: zwijana sekcja ulubionych.**
  `src/components/favorites/FavoritesSidebarSection.tsx` — nagłówek staje się przyciskiem zwijania
  z licznikiem; stan z `UserMenuPref.favoritesCollapsed`, zapis przez `src/actions/menuPrefs.ts`
  (`revalidatePath`, C-20); przekazanie stanu w `ModuleSidebar.tsx`. Ten sam komponent obsługuje
  nakładkę mobilną, więc desktop i mobile wychodzą z jednej zmiany (`py-3`, cele dotyku — C-31).
  Sekcja **nadal renderuje się przy zerze wpisów** (decyzja z 043).
  **Gotowe, gdy:** po wejściu sekcja zajmuje jeden wiersz, moduły są widoczne bez przewijania,
  a rozwinięcie przeżywa przeładowanie i przejście na inną stronę. *(AC-16, AC-17)*
  — **zależy od T-1, T-2**
  > **Ustalenie z kodu (C-54):** na mobile **nie było czego naprawiać**. Nakładka menu
  > (`AppShell`) nigdy nie renderowała sekcji ulubionych — zaczyna się od razu od modułów;
  > ulubione są tam jedną ikoną w górnym pasku. AC-17 jest więc spełnione przez stan istniejący,
  > a dokładanie tam sekcji ulubionych „dla symetrii" pogorszyłoby dokładnie to, na co skarżył się
  > właściciel. Zmiana dotyczy paska bocznego (desktop), bo tylko tam problem istniał.

---

## Faza 6 — Lektor Wiadomości: przewijanie i nawigacja

- [x] **T-21** — **Z12: jeden właściciel przewijania.** `NewsReader.tsx` — przewijanie do zdania
  ograniczone do **własnego kontenera** (jawny `scrollTop`, nie `scrollIntoView` na elemencie);
  `NewsStream.tsx` — przewijanie strony wyłącznie w `handleBlockChange`. Oba pod przełącznikiem
  `readerFollow`; wyłączony ⇒ strona nie rusza się wcale.
  **Gotowe, gdy:** przy wyłączonym „podążaj" pozycja przewinięcia strony **nie zmienia się** przy
  przejściu do kolejnej wiadomości; przy włączonym widok jedzie do wiadomości **i tam zostaje**.
  *(AC-23)* — **zależy od T-9**
- [x] **T-22** — **Z12: pasek sterowania lektora.** `NewsReader.tsx` — jeden rząd z grupami
  (nawigacja | odtwarzanie | prędkość | podążanie), zawijanie tylko na wąskim ekranie (dzisiejszy
  `flex-wrap` rozbija pasek na kilka rzędów na desktopie). Suwak prędkości i przełącznik zapisywane
  w `AssistantPref`.
  **Gotowe, gdy:** wybrana prędkość wraca po przeładowaniu; pasek na desktopie mieści się w jednym
  rzędzie. *(AC-22, część 2)* — **zależy od T-9, T-21**
- [x] **T-23** — **Z12: nawigacja tematów.** `NewsStream.tsx` — łagodniejszy próg gestu
  (`SWIPE_MIN_PX` 60→40, `SWIPE_DOMINANCE` 1.5→1.2); `TopicPicker.tsx` — **widoczne** strzałki ‹ ›
  przy nazwie tematu wołające tę samą funkcję skoku co gest (jedna implementacja, dwie drogi).
  **Gotowe, gdy:** temat da się zmienić bez znajomości gestu; test progu na wartościach granicznych.
  *(AC-24)*

---

## Faza 7 — Zadania: zakres widoku i ujednolicenie (najtrudniejsze)

Najpierw regresja, potem przebudowa — żeby naprawa buga nie czekała na większą zmianę.

- [x] **T-24** — **Z3: trasa zestawu na segmencie ścieżki.**
  `src/app/tasks/zestaw/[zestawId]/page.tsx` — zakres z `params`, nigdy z `searchParams`; widok przez
  `ModuleView` ze `state` (C-33). `revalidatePath` dla nowej trasy w
  `src/modules/tasks/actions/tasks.ts` (C-20).
  **Gotowe, gdy:** **klikacz regresyjny** — wejście na zestaw, zmiana statusu zadania, lista
  **nadal niepusta**; `npm run check:route-gating` i `check:owner-columns` przechodzą.
  *(AC-4)* — **to jest naprawa zgłoszonego buga**
- [x] **T-25** — **Z3: zgodność wstecz.** `src/app/tasks/[projectId]/page.tsx` — `/tasks/multi?group=<id>`
  → `redirect("/tasks/zestaw/<id>")`, `/tasks/multi?projects=a,b` → `redirect("/tasks/all?projekty=a,b")`.
  **Gotowe, gdy:** stare adresy (w tym zapisane ulubione widoki właściciela) otwierają **ten sam
  zakres** co przed zmianą. *(AC-6)* — **zależy od T-24**
- [x] **T-26** — **Z3: multiselect projektów w filtrze.** `src/modules/tasks/ui/TasksPage.tsx` —
  wybór wielu projektów zawężający listę **po stronie klienta** w widokach zbiorczych, odbijany do
  adresu przez `useViewState` kluczem `projekty`. **Utrata parametru degraduje do „wszystkie
  projekty", nigdy do „żadnego"** — to jest reguła, dla której cała ta faza istnieje.
  **Gotowe, gdy:** zaznaczenie projektów zawęża listę, a wyczyszczenie adresu pokazuje wszystko,
  nie pustkę. *(AC-5, część 1)* — **zależy od T-24**
- [x] **T-27** — **Z3: „zapisz ten wybór" + wspólny nagłówek.** Przycisk zapisu woła istniejące
  `createProjectGroup`/`updateProjectGroup` i nawiguje na `/tasks/zestaw/<id>` (zero nowych akcji,
  zero migracji danych). Widok projektu i widok zestawu dostają **ten sam** nagłówek `ModuleView`,
  te same ikony i te same akcje.
  **Gotowe, gdy:** zapisany zestaw da się wybrać ponownie i przywraca dokładnie te projekty;
  porównanie obu widoków nie pokazuje różnic poza nazwą i zakresem. *(AC-5 część 2, AC-7)*
  — **zależy od T-26**

---

## Faza 8 — Asystent: zlecenie wsadowe

- [x] **T-28** — **Z6: akcja `add_items`.** Typ w `src/platform/ai/aiAction.ts`, egzekutor
  w `src/modules/shopping/ai/executor.ts` (rozbicie `rawText` po liniach → istniejące `addItem`,
  zwrot liczby dodanych), opis w `src/modules/shopping/ai/catalog.ts` (przy wielu pozycjach użyj
  `add_items`, nie powtarzaj `add_item`), wpis w `src/platform/ai/actionContract.ts`, klasyfikacja
  wraz z `access` w `src/lib/ai/action-coverage.json`. **Nie** trafia do `DESTRUCTIVE_ACTION_TYPES`.
  **Gotowe, gdy:** `npm run check:actions` i `npm run check:ai-coverage` przechodzą; test
  jednostkowy egzekutora na ~100 liniach dodaje komplet i zwraca liczbę. *(AC-13)*
- [x] **T-29** — **Z6: limit wyjścia dla długiego planu.** `src/app/api/llm/home/agent/route.ts` —
  limit wyjścia kroku planu podniesiony do rzędu `REPORT_MAX_TOKENS` (istniejący precedens w tym
  pliku). Limit dotyczy **wyjścia**, więc rośnie tylko przy realnie długim planie.
  **Gotowe, gdy:** szacunek tokenów planu na ~100 pozycji mieści się poniżej limitu; zlecenie
  kończy się kompletnym planem, nie komunikatem „zabrakło kroków". *(AC-12)* — **zależy od T-28**

---

## Faza 9 — Bramki i domknięcie

- [x] **T-30** — **Testy jednostkowe zebrane.** `npm run check:test-types` + `npm run test:unit`
  zielone (nowe testy: pozycjonowanie `AnchoredLayer`, zatrzask lektora, kody przyczyny bez klucza,
  ponowienia artykułu i streszczeń, ponowienie skórki, egzekutor `add_items`, próg gestu).
- [~] **T-31** — **Klikacz e2e.** Nowe/zaktualizowane scenariusze dla AC-1, AC-2, AC-3, AC-4, AC-5,
  AC-16, AC-17, AC-18, AC-20, AC-23, AC-24. Uruchamiany `nohup bash scripts/e2e-web.sh`, **nigdy**
  `test:e2e:local`. **Żadnego `networkidle`** — aplikacja trzyma otwarty strumień zdarzeń od 072,
  więc takie oczekiwanie może się skończyć wyłącznie przekroczeniem czasu (`check:e2e-waits`).
- [x] **T-32** — **Pełne bramki.** `next lint --dir src` + `next build` na **lokalnym** Postgresie.
  **C-13: zatrzymujemy się na `next build`** — kolejny krok (`migrate.js`) ruszyłby produkcyjną bazę.
  Świadomie sprawdzane: `check:migrations`, `check:schema-drift`, `check:actions`,
  `check:ai-coverage`, `check:content-memory`, `check:cost-badge`, `check:ui-contract`,
  `check:i18n`, `check:route-gating`, `check:owner-columns`, `check:pagination`,
  `check:client-safe`, `check:tailwind`, `check:e2e-waits`, `check:perf`.
- [ ] **T-33** — **Mapowanie AC → wynik** (wejście do `/verify`): tabela z sekcji poniżej wypełniona
  faktycznym wynikiem każdego kryterium.
- [x] **T-34** — **Wpisy do `doświadczenia.md`** (C-51) — po jednym dla: zakresu widoku ginącego
  z `searchParams` (Z3), ścieżki zapasowej lektora działającej poza gestem (Z4), planu ucinanego
  limitem wyjścia (Z6), warstwy pozycjonowanej tylko w jednej osi (Z7), sekcji AI wołanej
  z `useEffect` przy wejściu (Z11) oraz cofnięcia ujawniania kolumny przy najechaniu (Z1) — żeby
  następna osoba nie przywróciła 042 jako „regresji".

---

## Pokrycie kryteriów akceptacji

| AC | Zgłoszenie | Zadania |
|---|---|---|
| AC-1 | Z1 | T-19, T-31 |
| AC-2 | Z2 | T-13, T-16, T-31 |
| AC-3 | Z2 | T-16, T-31 |
| AC-4 | Z3 | **T-24**, T-31 |
| AC-5 | Z3 | T-26, T-27, T-31 |
| AC-6 | Z3 | T-25 |
| AC-7 | Z3 | T-27 |
| AC-8 | Z4 | T-7, T-30 |
| AC-9 | Z4 | T-8 |
| AC-10 | Z4 | T-6, T-8, T-30 |
| AC-11 | Z5 | T-3, T-4, T-30 |
| AC-12 | Z6 | T-29 |
| AC-13 | Z6 | T-28, T-30 |
| AC-14 | Z7 | T-13, T-15, T-30 |
| AC-15 | Z7 | T-17 |
| AC-16 | Z8 | T-20, T-31 |
| AC-17 | Z8 | T-20, T-31 |
| AC-18 | Z9 | T-18, T-31 |
| AC-19 | Z10 | T-5, T-30 |
| AC-20 | Z11 | T-12, T-31 |
| AC-21 | Z11 | T-11 |
| AC-22 | Z12 | T-9, T-22, T-31 |
| AC-23 | Z12 | T-21, T-31 |
| AC-24 | Z12 | T-23, T-30, T-31 |

**Każde z 24 kryteriów ma pokrycie.** Żadne zadanie nie wychodzi poza plan (C-53).

---

## Notatki / blokady

- **T-16 i T-5 startują od odtworzenia błędu.** Przyczyn Z2 (panel poniżej widoku) i Z10 (brak
  poprawnych tokenów dla opisu „Star Trek") nie dało się ustalić z samego kodu. Naprawa w obu
  wypadkach celuje w **klasę** przyczyn, ale odtworzenie jest warunkiem uznania zadania za zrobione —
  inaczej nie wiadomo, czy naprawiliśmy to, co bolało.
- **T-24 jest naprawą zgłoszonego buga i nie czeka na resztę Fazy 7.** Gdyby przebudowa widoku
  okazała się większa, niż zakłada plan, T-24 i T-25 dowożą wartość same.
- **Ścieżka krytyczna:** T-1 → T-2 → T-9 → T-21 → T-22 (lektor) oraz T-13 → T-16 (warstwy) oraz
  T-24 → T-25 → T-26 → T-27 (Zadania). Te trzy nitki są wzajemnie niezależne.
