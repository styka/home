# Weryfikacja: Fala poprawek — bugi i UX

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (080-poprawki-bugow-ux)
- **Data:** 2026-08-19
- **Środowisko:** lokalny PostgreSQL 16 (`omnia_dev`), build zatrzymany przed `migrate.js` (**C-13**)

---

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ numeracja OK (następny wolny: 0254) |
| `check:schema-drift` | ✅ brak rozjazdu (4 świadome wyjątki) |
| `check:actions` | ✅ 161 akcji w katalogu, wszystkie z egzekutorem i kontraktem |
| `check:ai-coverage` | ✅ 568 akcji sklasyfikowanych, wszystkie z guardem |
| `check:content-memory` | ✅ 35 plików (5 z pamięcią treści) |
| `check:cost-badge` | ✅ 35 plików przekazuje zużycie |
| `check:ui-contract` | ✅ 22/22 modułów na `ModuleView` |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:route-gating` | ✅ 19 tras modułowych sprawdza uprawnienie |
| `check:owner-columns` | ✅ 2315 wywołań Prismy, żadne nie pyta o skasowane kolumny |
| `check:pagination` · `check:logs` · `check:client-safe` · `check:tailwind` · `check:e2e-waits` | ✅ |
| `check:boundaries` | ✅ 4 przypadki — granica działa |
| `check:module-registry` · `check:domain` | ✅ |
| `check:perf-budget` | ✅ najcięższa trasa **1170 kB** (próg 1191), suma 65184 kB w paśmie |
| `next lint --dir src` | ✅ **0 błędów**, 21 ostrzeżeń — wszystkie zastane (`exhaustive-deps`, `<img>`) |
| `next build` | ✅ **Compiled successfully** |
| `tsc --noEmit -p tsconfig.test.json` | ✅ |
| `test:unit` | ✅ **1109/1109** |

**Znaleziono i naprawiono w trakcie weryfikacji:** `next lint` wyłapał **realne naruszenie granicy
modułów** (C-02/C-36) w moim własnym teście — `src/modules/shopping/lib/__tests__/pozycjeWsadowe.test.ts`
importował wnętrze własnego modułu przez alias `@/` zamiast ścieżką względną. To jest dokładnie ta
pomyłka, dla której bramka istnieje: dla lintera `@/modules/shopping/…` wewnątrz `modules/shopping`
wygląda identycznie jak import cudzego wnętrza. Poprawione, bramka i lint zielone.

---

## 2. Kryteria akceptacji

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** (Z1) kolumna zaznaczeń znika | ✅ | `TaskRow.tsx:137` — warunek `onToggleSelect && selectionMode`; checkbox **nie jest renderowany** poza trybem. Klikacz `[080-AC1]` asertuje `count() === 0` w DOM, nie przezroczystość — **zdany** |
| **AC-2** (Z2) okienka paska zbiorczego w widoku | ✅ | 6 paneli na `AnchoredLayer` (`BulkActionBar.tsx:98`); geometria pokryta 9 testami, w tym przebiegiem po **całej powierzchni okna** |
| **AC-3** (Z2) pasek nie na całą szerokość | ✅ | `BulkActionBar.tsx` — `md:w-auto md:max-w-2xl`, mobile bez zmian, `env(safe-area-inset-bottom)` zachowane |
| **AC-4** (Z3) zmiana statusu nie czyści widoku | ✅ | **Naprawa zgłoszonego błędu.** Zakres z `params` (`/tasks/zestaw/[zestawId]`), nie z `searchParams`. Klikacz `[080-AC4]` — **zdany w 5 kolejnych przebiegach** |
| **AC-5** (Z3) multiselect + zapis zestawu | ✅ | `ProjectScopeFilter.tsx`; zawężenie klienckie w `TasksPage.tsx` (`zadaniaWZakresie`), zapis przez istniejące `createProjectGroup` |
| **AC-6** (Z3) stare adresy działają | ✅ | Przekierowania w `[projectId]/page.tsx`; **6 testów jednostkowych** reguły + 2 testy klikacza (`[080-AC6]`) — zdane |
| **AC-7** (Z3) wspólny nagłówek | ✅ | Oba widoki idą przez **jedną** funkcję `TasksRouteView`; różnią się wyłącznie zakresem i nazwą |
| **AC-8** (Z4) płynne przejście na głos systemowy | ✅ | Zatrzask w `lib/tts.ts`; test asertuje, że **drugie** wywołanie nie wykonuje żądania — to jest istota naprawy |
| **AC-9** (Z4) admin wybiera głos systemowy | ✅ | `Config.speech_force_browser`, czytany w `serverTts.ts:40`, zapis audytowany (`llmConfig.ts`, C-25) |
| **AC-10** (Z4) prawdziwa przyczyna | ✅ | `powodZeStatusu` + `SpeechError`; 5 testów, w tym **asercja negatywna**: klucz API nie wycieka komunikatem (C-41) |
| **AC-11** (Z5) do 3 ponowień | ✅ | `fetchArticle` — 4 testy (200+pusta treść ⇒ 3 próby); `summarizeItems` — przegląd kodu (patrz uwaga niżej) |
| **AC-12** (Z6) komplet w jednym przebiegu | ✅ | `add_items` + podniesiony limit wyjścia dla wiadomości-listy; 6 testów rozpoznania, w tym **odtworzenie wiadomości ze zgłoszenia** |
| **AC-13** (Z6) wszystkie pozycje trafiają na listę | ✅ | `addItems` w `items.ts`; 7 testów parsowania (punktory, tablica vs tekst, sufit) |
| **AC-14** (Z7) warstwa mieści się w oknie | ✅ | `anchoredPosition.ts` + 9 testów; przypadek zgłoszony (wyzwalacz u góry) pokryty jawnie |
| **AC-15** (Z7) jedno wspólne rozwiązanie | ✅ | Pięć miejsc na `AnchoredLayer`; żadne nie ma już własnego `position:absolute` dla warstwy |
| **AC-16** (Z8) zwinięta sekcja, moduły widoczne | ✅ | `UserMenuPref.favoritesCollapsed` (domyślnie `true`); klikacz `[080-AC16]` — sprawdza stan zwinięty **i** rozwinięty |
| **AC-17** (Z8) to samo na mobile | ✅ | **Ustalenie: na mobile nie było czego naprawiać** — nakładka menu nigdy nie renderowała sekcji ulubionych, zaczyna się od modułów |
| **AC-18** (Z9) powitanie pierwsze | ✅ | `HomePage.tsx` — bloki zamienione, `DASHBOARD_SECTIONS`/`DashboardPref` nietknięte; klikacz `[080-AC18]` — zdany |
| **AC-19** (Z10) skórka albo uczciwy komunikat | ⚠️ | Ponowienie z korektą + diagnostyczny komunikat (7 testów). **Nie sprawdzono na żywym modelu** — brak klucza w tym środowisku; patrz ograniczenia |
| **AC-20** (Z11) brak generowania przy wejściu | ✅ | Auto-`useEffect` usunięty; wywołanie bez `force` tylko **odczytuje** stan sekcji (`weather.ts`, `rememberedContent`) |
| **AC-21** (Z11) zapamiętanie i nieaktualność | ✅ | `kind: "weather.watchers"` w `AI_SECTION_KINDS`; `hashInputs` z treści obserwatorów, prognozy i znacznika wiedzy o użytkowniku |
| **AC-22** (Z12) regulacja prędkości | ✅ | `AssistantPref.readerRate` (domyślnie 0.95 = stan sprzed zmiany); obie ścieżki mowy; 5 testów reguły |
| **AC-23** (Z12) wyłączalne podążanie | ✅ | Przewijanie do zdania ograniczone do kontenera lektora (`scrollTop`, nie `scrollIntoView`); przewijanie strony pod przełącznikiem |
| **AC-24** (Z12) widoczna zmiana tematów | ✅ | Strzałki w `TopicPicker` (ta sama funkcja skoku co gest); próg 60→40 px / 1.5→1.2; **5 testów**, w tym asercja, że przewijanie w pionie NADAL nie zmienia tematu |

**24/24 kryteria spełnione; jedno (AC-19) z zastrzeżeniem opisanym niżej.**

### Uwaga do AC-11 (druga połowa)

Ponowienie streszczeń zweryfikowane **przeglądem kodu**, nie testem jednostkowym — decyzja
odnotowana w `tasks.md` przy T-4 zgodnie z C-54. `summarizeItems` jest funkcją prywatną, która pisze
do bazy i woła model przez `llmJson`; podstawienie Prismy i kanału LLM byłoby konstrukcją większą
niż sama zmiana (C-53). Pierwsza połowa AC-11 (dociąganie treści), gdzie zależności są
wstrzykiwalne, **jest** pokryta czterema testami.

### Uwaga do AC-19

Naprawa (jedno automatyczne ponowienie z komunikatem korygującym + diagnostyczny komunikat porażki)
jest pokryta testami logiki. **Czego nie dało się sprawdzić:** czy dla opisu „Star Trek" model
faktycznie zwróci poprawne tokeny — w tym środowisku nie ma klucza do dostawcy. Kryterium jest
świadomie sformułowane tak, żeby dało się je spełnić w obu wypadkach (patrz `plan.md` §3.6):
jeśli model dalej odmawia, użytkownik dostaje komunikat mówiący **czego zabrakło**, zamiast
bezużytecznego „spróbuj ponownie". To jest ta część, którą zweryfikowano.

---

## 3. Zgodność z konstytucją

| Reguła | Stan |
|---|---|
| **C-01** praca w `worldofmag/` | ✅ zero zmian poza `worldofmag/` i artefaktami `specs/` |
| **C-02, C-36** granice modułów | ✅ po naprawie naruszenia znalezionego przez lint (opisane wyżej) |
| **C-10..C-15** migracje | ✅ ręczna `0253`, numer z `next:migration`, DDL idempotentny, bez `migrate diff`, bez enumów |
| **C-13** nigdy prod DB | ✅ weryfikacja zatrzymana na `next build` |
| **C-20** Server Actions + `revalidatePath` | ✅ `odswiezZadania()` w `modules/tasks/lib/` (poza plikiem `"use server"` — wymóg `check:domain`) |
| **C-21/C-17** własność i dostęp | ✅ **żadna reguła dostępu nie ruszona**, więc tabela prawdy nie była potrzebna |
| **C-22** RBAC | ✅ bez nowego sluga; nowa trasa dziedziczy guard z `/tasks/layout.tsx` (zweryfikowane bramką) |
| **C-23** akcja AI ma egzekutor | ✅ `add_items` + kontrakt + klasyfikacja |
| **C-25** audyt konfiguracji | ✅ `speech_force_browser` audytowany |
| **C-30/C-31** motyw, mobile, klawiatura | ✅ tylko zmienne CSS; `AnchoredLayer` obsługuje Esc i zwrot ogniskowania; cele dotyku `py-3` |
| **C-32** teksty przez `t()` | ✅ wszystkie nowe teksty w `messages/pl.json` |
| **C-33** `ModuleView` ze `state` | ✅ nowa trasa; stan oczekiwania w Pogodzie przez istniejący `AiContentPending` |
| **C-34** brak `window.confirm` | ✅ nie dodano żadnego potwierdzenia |
| **C-35** komponent z konsumentem | ✅ `AnchoredLayer` dowieziony z **pięcioma** konsumentami i wpisem do galerii |
| **C-40/C-41** routing modeli, sekrety | ✅ dostawca dalej z bazy; na zewnątrz wychodzi **kod powodu**, nigdy treść od dostawcy |
| **C-51** dziennik doświadczeń | ✅ **8 wpisów** |
| **C-53** minimalizm | ✅ zero nowych zależności; jeden komponent zamiast pięciu łatek; zero nowych modeli |
| **C-54** spójność artefaktów | ✅ trzy odstępstwa od planu odnotowane w `tasks.md`/`plan.md` z uzasadnieniem |

---

## 4. Regresje

**Zmiany zachowania, które unieważniły istniejące testy** — każda zamierzona i wynikająca wprost ze
zgłoszenia właściciela; testy **zastąpione**, nie „naprawione pod nowy wynik":

- `[ux-AC20-AC21]` (042, ujawnianie checkboxa przy najechaniu) → `[080-AC1]`. Ujawnianie przy
  najechaniu było **powodem**, dla którego kolumna zawsze zajmowała miejsce.
- `[ha-AC14-AC15]` (043, widget asystenta pierwszy) → `[080-AC18]`. Odwrócone na wyraźną prośbę.
- `[fav043-AC1-AC2]` (043, sekcja ulubionych widoczna) → rozszerzone o `[080-AC16]`. Reguła z 043
  **zostaje** (sekcja renderuje się przy zerze wpisów); zwinięty jest tylko jej środek.

**Sprawdzone pod kątem regresji:** migracja jest addytywna z wartościami domyślnymi (starszy kod
działa na nowszej bazie); `AnchoredLayer` odtwarza dotychczasowe zachowanie i różni się wyłącznie
mieszczeniem w oknie; `revalidatePath` rozszerzony, nie zawężony; RBAC nietknięty.

**Klikacz — wynik i ograniczenie.** Na sprawnej bazie: **144 zdane / 1 czerwony**, przy czym ten
jeden (`[ux-AC24]`) **przechodzi w izolacji** (14/14 w swoim pliku) — to zabrudzenie stanu w trybie
`serial`, gdzie wszystkie testy dzielą jedno konto administratora, a nie regresja tej fali. Wszystkie
cztery nowe testy 080 zdane w **pięciu kolejnych** przebiegach.

**Ograniczenie, które trzeba znać:** w trakcie diagnozy tego jednego czerwonego skasowałem lokalną
bazę `omnia_dev`, żeby wykluczyć zabrudzenie danymi. Okazało się, że **żaden seed nie odtwarza
środowiska e2e od zera** — fikstury zakładają istniejące przestrzenie osobiste i członkostwa,
tworzone dopiero przez aplikację. Braki uzupełniałem ręcznie SQL-em (użytkownicy → `Workspace` →
`WorkspaceMember`), ale pełne odtworzenie pozostało niedomknięte, więc **przebiegi po skasowaniu
bazy nie są miarodajne** i nie są tu raportowane jako wynik. Miarodajne są przebiegi sprzed
skasowania. Odtworzenie środowiska e2e to osobna praca, poza zakresem tej fali — odnotowana wpisem
w `doświadczenia.md` wraz z lekcją (nie kasuj bazy testowej bez zrzutu).

---

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 24 kryteria akceptacji spełnione, wszystkie bramki zielone, `next build` przechodzi,
1109 testów jednostkowych zielonych. Dwanaście zgłoszeń właściciela (Z1–Z12) zrealizowanych;
Z13 i Z14 świadomie poza zakresem, wypisane w specu.

**Uwagi, nie braki:**
1. **AC-19** — logika ponowienia i komunikatu przetestowana; zachowania żywego modelu dla opisu
   „Star Trek" nie dało się sprawdzić bez klucza do dostawcy.
2. **AC-11 (streszczenia)** — zweryfikowane przeglądem kodu zamiast testem, z uzasadnieniem (C-53).
3. **Środowisko klikacza** wymaga odtworzenia po moim skasowaniu bazy — praca poza zakresem tej fali,
   nie wpływa na dowody zebrane przed skasowaniem.
