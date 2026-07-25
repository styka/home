# Zadania: Asystent AI — czytelność, bezpieczeństwo i wymuszona walidacja akcji

- **Plan:** ./plan.md (031-asystent-ux-bezpieczenstwo-walidacja)
- **Status:** todo
- **Data:** 2026-07-25

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami** (migracja → akcje → UI → AI → bramki). Każde zadanie jest małe, samodzielne i
> **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Szybkie poprawki UI (bez zależności)

- [x] **T-1** `[P]` — **Wyrównanie pól wyboru w `ActionDrawer`.** Przycisk wyboru pozycji dostaje
  stałą wysokość równą wierszowi nagłówka (ikona modułu + etykieta) i wyśrodkowanie w pionie zamiast
  `marginTop: 1`; cel dotyku ≥20×20 px.
  *Gotowe, gdy:* pole wyboru jest optycznie w jednej linii z ikoną i nazwą akcji (AC-7).

- [x] **T-2** `[P]` — **Stopka odpowiedzi: same ikony + nowa kolejność.** Usuń etykiety tekstowe z
  „Kopiuj"/„Odczytaj na głos"/„Ponów", zostaw ikony z `title` + `aria-label`; kolejność w JSX:
  odczytaj na głos → kopiuj → ponów. Stan „skopiowano" sygnalizuje ikona + zmiana `title`.
  *Gotowe, gdy:* w stopce są trzy ikony bez tekstu, w zadanej kolejności, każda z podpowiedzią (AC-8).

- [x] **T-3** `[P]` — **Historia rozmów nie wyjeżdża poza ekran na telefonie.** `minWidth: 0` na
  kontenerze wiersza i na przycisku tytułu, `overflow: hidden`, `overflow-wrap: anywhere`.
  *Gotowe, gdy:* przy szerokości 375 px lista rozmów nie powoduje przewijania poziomego (AC-9).

- [x] **T-4** `[P]` — **Podpowiedź „Ctrl+Enter wysyła".** Dyskretny tekst pod kompozytorem
  (`var(--text-muted)`), widoczny na desktopie (`hidden md:block`), ukryty na telefonie.
  *Gotowe, gdy:* podpowiedź widoczna na desktopie, brak jej na mobile, layout kompozytora bez zmian (AC-10).

## Faza 1 — Fundament danych

- [ ] **T-5** — **Migracja `0209_assistant_pref`.** Ręczny `migration.sql` wg planu §2.3 (tabela
  `AssistantPref`, unikat na `userId`, FK `ON DELETE CASCADE`, idempotentnie).
  *Gotowe, gdy:* `npm run check:migrations` przechodzi, migracja aplikuje się na lokalnym Postgresie.

- [ ] **T-6** — **`schema.prisma` + typy TS.** Model `AssistantPref` zgodny z DDL, relacja w `User`;
  `AssistantLevel` i `AssistantVoiceKind` w `src/types/index.ts` jako unie stringów (C-12).
  *Gotowe, gdy:* `npx prisma generate` czysto, brak enumów Prisma.

## Faza 2 — Warstwa serwera: ustawienia i skrzynka zgłoszeń

- [ ] **T-7** — **`src/actions/assistantPrefs.ts`.** `getAssistantPrefs()` (domyślne w locie) +
  `updateAssistantPrefs(input)` z walidacją wartości i `revalidatePath("/")`; zapis wyłącznie po
  `userId` z sesji.
  *Gotowe, gdy:* akcje działają, wartość spoza unii jest odrzucana z polskim komunikatem (AC-11, AC-13).

- [ ] **T-8** — **`src/actions/feedback.ts`.** `submitFeedbackTask({title, description})` —
  wyznaczenie skrzynki (`Config.feedback_project_id` → fallback: projekt „Omnia" admina), zapis z
  pominięciem guardu projektu, limity długości, `revalidatePath("/tasks")`. Plus
  `getFeedbackInboxInfo()` → `{ projectId, canRead }` (dostęp sprawdzany istniejącym
  `assertProjectAccess`).
  *Gotowe, gdy:* użytkownik bez dostępu tworzy zgłoszenie, ale `canRead === false` (AC-19, AC-22).

- [ ] **T-9** `[P]` — **Klucz `feedback_project_id` w panelu admina.** Pole w `AdminConfigForm` +
  odczyt w `page.tsx`, opis „puste = projekt »Omnia« administratora".
  *Gotowe, gdy:* admin ustawia id projektu, zmiana trafia do `AuditLog` (C-25, AC-22).

- [ ] **T-10** — **Wpięcie zgłoszeń w UI.** `AICommandSheet` i `FeedbackInspector` wołają
  `submitFeedbackTask()` zamiast `ensureOmniaProject()` + `createTask()`; przycisk „Otwórz w
  zadaniach" renderowany **tylko** przy `canRead === true`, inaczej komunikat podziękowania.
  *Gotowe, gdy:* konto bez dostępu nie widzi propozycji przejścia do zadania (AC-20).

- [ ] **T-11** — **Odczyt skrzynki pozostaje chroniony.** Weryfikacja, że listowanie/odczyt/edycja
  zadań skrzynki przez UI i przez read-toole asystenta nadal wymaga dostępu; test ręczny na koncie
  bez uprawnień.
  *Gotowe, gdy:* każda droga poza `submitFeedbackTask` odmawia dostępu (AC-21).

## Faza 3 — Kontrakt akcji (rdzeń)

- [ ] **T-12** — **Szkielet `src/lib/ai/actionContract.ts`.** Typy `FieldControl`/`FieldSpec`/
  `ActionContract`, wspólny `PARAM_LABELS`, `fieldSpec()` z fallbackiem, `actionLabel()`,
  `validateActionParams()`. Re-eksport istniejących map etykiet (`TASK_STATUS_LABELS`,
  `TASK_PRIORITY_LABELS`, etykiety modułowe) — bez duplikowania słowników (C-53).
  *Gotowe, gdy:* moduł kompiluje się i ma testy jednostkowe walidacji na kilku przypadkach.

- [ ] **T-13** — **Kontrakty: zakupy, zadania, notatki.** Wpisy dla wszystkich typów akcji tych
  modułów (etykieta + pola enum/data/liczba/bool; identyfikatory jako `hidden`).
  *Gotowe, gdy:* każdy typ z egzekutorów tych modułów ma wpis.

- [ ] **T-14** `[P]` — **Kontrakty: zwierzęta, zdrowie, nawyki, kuchnia.**
  *Gotowe, gdy:* jw. dla tych modułów.

- [ ] **T-15** `[P]` — **Kontrakty: portfel, flota, magazynowanie, warsztaty.**
  *Gotowe, gdy:* jw. dla tych modułów.

- [ ] **T-16** `[P]` — **Kontrakty: języki, wiadomości, pogoda, kontakty, raporty.**
  *Gotowe, gdy:* jw. — łącznie wszystkie 159 typów mają wpis.

- [ ] **T-17** — **Bramka kontraktu.** Rozszerz `scripts/check-action-coverage.js`: każdy typ akcji
  z katalogu agenta musi mieć wpis w `ACTION_CONTRACTS`; komunikat błędu wskazuje, gdzie dopisać.
  *Gotowe, gdy:* `npm run check:actions` przechodzi, a usunięcie wpisu na próbę wywala bramkę.

## Faza 4 — Humanizacja wyjścia asystenta

- [ ] **T-18** — **`src/lib/ai/humanize.ts`.** `humanizeAssistantText()` — mapowanie tokenów
  technicznych na etykiety (całe słowa, poza blokami kodu) i usuwanie gołych identyfikatorów
  (cuid) wraz z osieroconymi nawiasami; testy jednostkowe przypadków granicznych.
  *Gotowe, gdy:* testy zielone, tekst użytkownika ze słowem „NONE" w zdaniu nie jest psuty (AC-1).

- [ ] **T-19** — **Wpięcie humanizacji w agenta.** Jeden choke point w `agent/route.ts` na krokach
  `answer`/`report`/`clarify` + krótka reguła w promptcie („nie cytuj identyfikatorów ani wartości
  technicznych").
  *Gotowe, gdy:* odpowiedź z listą zadań nie zawiera `TODO`/`NONE`/id (AC-1).

- [ ] **T-20** `[P]` — **Etykiety w wynikach read-toolów.** `agentTools.ts` zwraca statusy i
  priorytety już jako etykiety; identyfikatory zostają (agent ich potrzebuje).
  *Gotowe, gdy:* wyniki narzędzi nie wnoszą wartości technicznych do treści odpowiedzi (AC-1).

## Faza 5 — Log rozumowania i panel akcji dla użytkownika

- [ ] **T-21** — **Przebudowa logu rozumowania.** Na żywo tylko ostatnia myśl (zastępowana); po
  zakończeniu zwinięte „Pokaż log rozumowania" z myślami po humanizacji; surowy log za drugim
  przełącznikiem „Pokaż techniczny log rozumowania (admin)", widocznym tylko przy `isAdmin`. Stare
  rozmowy bez logu renderują się bez przełączników.
  *Gotowe, gdy:* AC-2, AC-3, AC-4 spełnione, a historia starych rozmów działa bez wyjątku.

- [ ] **T-22** — **`ActionDrawer` na kontrakcie.** Etykieta akcji zamiast technicznego typu
  (techniczny typ tylko dla admina), etykiety parametrów, pola `hidden` niewidoczne, kontrolki wg
  `control` (select/date/datetime/number/boolean/text), `searchQuery` → „Szukana nazwa".
  *Gotowe, gdy:* plan z polami enum/data/liczba/bool renderuje właściwe kontrolki i żadnego id (AC-5, AC-6).

- [ ] **T-23** — **Walidacja na froncie w `ActionDrawer`.** `validateActionParams` przy edycji; pole
  z błędem obramowane `var(--accent-red)` + komunikat; „Wykonaj" zablokowane przy błędach.
  *Gotowe, gdy:* nie da się zatwierdzić planu z niepoprawną wartością (AC-27).

## Faza 6 — Walidacja i autoryzacja po stronie serwera

- [ ] **T-24** — **Walidacja w egzekutorze (choke point).** W `executeAction`:
  `assertActionContract` + `validateActionParams` przed rozgałęzieniem na moduł; naruszenie →
  `success:false` z polskim komunikatem wskazującym pole i regułę.
  *Gotowe, gdy:* akcja z wartością spoza słownika jest odrzucana także przy pominięciu frontu (AC-26).

- [ ] **T-25** — **Jednolita odmowa dostępu.** `toAccessError` w `executors/shared.ts` + mapowanie
  wyjątków guardów na komunikat „Nie masz dostępu do tych danych." (bez ujawniania cudzych treści);
  wynik trafia do `ActionResult`.
  *Gotowe, gdy:* akcja na cudzym rekordzie kończy się czytelną odmową, nie błędem technicznym (AC-23, AC-24).

- [ ] **T-26** — **Asystent wie o odmowie.** Wynik odmowy wraca do pętli agenta w formie, na
  podstawie której nie obiecuje wykonania i informuje użytkownika o braku dostępu.
  *Gotowe, gdy:* w przebiegu z odmową agent nie twierdzi, że akcja się powiodła (AC-25).

## Faza 7 — Bramka kontroli dostępu i audyt

- [ ] **T-27** — **Rozszerzenie manifestu o `access`.** Pole `access` (`owner|self|admin|open|internal`)
  w `src/lib/ai/action-coverage.json`; `open` wymaga `accessReason`. Uzupełnienie wpisów dla nowych
  akcji z T-7/T-8.
  *Gotowe, gdy:* manifest zawiera `access` dla każdego wpisu.

- [ ] **T-28** — **Bramka `check:ai-coverage` + heurystyka guardu.** Skrypt wymaga `access`,
  sprawdza obecność wywołania guardu w ciele akcji (biała lista helperów), `--report` generuje
  `docs/ai/kontrola-dostepu.md`; alias `check:access` w `package.json`.
  *Gotowe, gdy:* akcja testowa bez `access` wywala build, a raport się generuje (AC-28).

- [ ] **T-29** — **Audyt akcji: moduły danych osobistych** (zakupy, zadania, notatki, kuchnia,
  zwierzęta, zdrowie, nawyki). Nadanie `access`, weryfikacja faktycznego guardu, poprawki tam, gdzie
  sprawdzenia brakuje.
  *Gotowe, gdy:* brak pozycji „brak guardu" w raporcie dla tych modułów.

- [ ] **T-30** — **Audyt akcji: pozostałe moduły i systemowe** (portfel, flota, magazynowanie,
  warsztaty, języki, wiadomości, pogoda, kontakty, usługi, raporty, teams, trash, drive, admin).
  *Gotowe, gdy:* raport `docs/ai/kontrola-dostepu.md` bez pozycji „brak guardu" (AC-29).

## Faza 8 — Tryb oszczędny

- [ ] **T-31** — **`effectiveOperation(op, level)`** w `src/lib/llm/operationTypes.ts` + wpięcie w
  `agent/route.ts`, `fastPath.ts` i briefing; poziom czytany raz na żądanie z `AssistantPref`.
  *Gotowe, gdy:* w trybie oszczędnym log `AiCall` pokazuje model przypisany do `dispatch` (AC-14).

- [ ] **T-32** — **Przełącznik poziomu w kompozytorze.** Kontrolka na lewo od mikrofonu, dwie opcje
  („Standardowy" / „Oszczędny") z krótkimi opisami, zapis natychmiast do bazy, aktywny tryb
  oszczędny podświetlony.
  *Gotowe, gdy:* wybór widoczny po przeładowaniu i na innym urządzeniu (AC-12, AC-13).

- [ ] **T-33** — **Stałe preferencje per użytkownik.** Panel ustawień na `getAssistantPrefs`/
  `updateAssistantPrefs` (debounce), jednorazowa migracja treści z `localStorage`, nowy opis
  „Zapisywane na Twoim koncie — widoczne na każdym urządzeniu."
  *Gotowe, gdy:* preferencje widoczne po zalogowaniu na innym urządzeniu, brak mylącego opisu (AC-11).

## Faza 9 — Lektor: naprawa listy i serwerowa synteza

- [ ] **T-34** — **Naprawa listy głosów przeglądarki.** `getAvailableVoices()` sumuje odczyty po
  `voiceschanged` zamiast zastępować, deduplikuje po `voiceURI`, odsiewa głosy niedziałające,
  sortuje polskie najpierw; komunikat, gdy lista pusta.
  *Gotowe, gdy:* lista nie „znika" po chwili i zawiera tylko głosy odtwarzalne (AC-15).

- [ ] **T-35** — **Typ operacji `speech` + katalog głosów.** `OPERATION_TYPES`/`OPERATION_TYPE_META`
  + obsługa w `/admin/llm`; `src/lib/tts/serverVoices.ts` z polskimi opisami głosów.
  *Gotowe, gdy:* admin może przypisać dostawcę i model dla syntezy mowy.

- [ ] **T-36** — **Synteza serwerowa.** `src/lib/tts/serverTts.ts` (`resolveLlmChain("speech")`,
  limit 1200 znaków, brak trwałego zapisu audio) + `src/app/api/tts/route.ts` (sesja, limit żądań,
  `audio/mpeg`, `501` przy braku konfiguracji).
  *Gotowe, gdy:* przy skonfigurowanym dostawcy endpoint zwraca dźwięk, bez konfiguracji `501` (AC-16, AC-17).

- [ ] **T-37** — **Rozgałęzienie `speak()` + wybór głosu w UI.** Głos serwerowy → `/api/tts` +
  `Audio`, awaria/brak → Web Speech; `stopSpeaking()` zatrzymuje obie ścieżki; lista wyboru łączy
  głosy serwerowe i przeglądarki, przycisk „Posłuchaj próbki"; wybór głosu serwerowego zapisywany w
  `AssistantPref`.
  *Gotowe, gdy:* AC-16, AC-17, AC-18 spełnione, a brak konfiguracji nie powoduje błędu w UI.

## Faza 10 — Bramki i domknięcie

- [ ] **T-38** — **Bramki lokalnie.** `npm run check:migrations`, `npm run check:actions`,
  `npm run check:ai-coverage`, `next lint --dir src`, `npx next build` na **lokalnym** Postgresie
  (C-13 — bez `scripts/migrate.js`).
  *Gotowe, gdy:* wszystkie kroki zielone (AC-30).

- [ ] **T-39** — **Dokumentacja projektu.** `CLAUDE.md`: model `AssistantPref`, akcje
  `assistantPrefs`/`feedback`, nowa bramka kontroli dostępu, typ operacji `speech`, kontrakt akcji.
  *Gotowe, gdy:* opis w `CLAUDE.md` zgadza się z kodem.

- [ ] **T-40** — **Mapowanie AC → wynik** (input do `/verify`): dla każdego z AC-1..AC-30 wskazanie
  zadania i sposobu sprawdzenia.
  *Gotowe, gdy:* żaden AC nie zostaje bez pokrycia.

- [ ] **T-41** — **Wpis(y) do `doświadczenia.md`** (C-51) dla nieoczywistych problemów napotkanych po
  drodze (m.in. przyczyna „znikania" głosów, pułapka `minWidth:0` we flexboksie, deterministyczne
  domykanie wyjścia modelu).
  *Gotowe, gdy:* lekcje dopisane po polsku we właściwym formacie i zacommitowane z fixem.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 | T-18, T-19, T-20 |
| AC-2, AC-3, AC-4 | T-21 |
| AC-5, AC-6 | T-12..T-17, T-22 |
| AC-7 | T-1 |
| AC-8 | T-2 |
| AC-9 | T-3 |
| AC-10 | T-4 |
| AC-11 | T-7, T-33 |
| AC-12 | T-32 |
| AC-13 | T-7, T-32, T-33 |
| AC-14 | T-31 |
| AC-15 | T-34 |
| AC-16, AC-17 | T-35, T-36, T-37 |
| AC-18 | T-37 |
| AC-19 | T-8 |
| AC-20 | T-10 |
| AC-21 | T-11 |
| AC-22 | T-8, T-9 |
| AC-23, AC-24 | T-25, T-29, T-30 |
| AC-25 | T-26 |
| AC-26 | T-24 |
| AC-27 | T-23 |
| AC-28 | T-27, T-28 |
| AC-29 | T-29, T-30 |
| AC-30 | T-38 |

## Ścieżka krytyczna

`T-5 → T-6 → T-7 → (T-32, T-33)` — ustawienia użytkownika blokują przełącznik poziomu i preferencje.
`T-12 → T-13..T-16 → T-17 → (T-22, T-23, T-24)` — kontrakt blokuje panel akcji i walidację serwerową.
`T-18 → (T-19, T-21)` — humanizacja blokuje log rozumowania i wyjście agenta.
`T-27 → T-28 → (T-29, T-30)` — bramka dostępu blokuje audyt.
`T-35 → T-36 → T-37` — konfiguracja syntezy blokuje odtwarzanie serwerowe.
Wszystko zbiega się w **T-38** (bramki), potem T-39..T-41.

Faza 0 (T-1..T-4) jest w pełni niezależna — można ją zrobić od razu i zacommitować osobno.

## Notatki / blokady
- (brak)
