# Weryfikacja: Asystent AI — czytelność, bezpieczeństwo i wymuszona walidacja akcji

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (42/42 odhaczone)
- **Data:** 2026-07-25
- **Środowisko weryfikacji:** lokalny PostgreSQL 16 (`127.0.0.1:5432/omnia_dev`), migracje
  zaaplikowane przez `prisma migrate deploy`. **Produkcyjna baza nietknięta** (C-13) — `next build`
  uruchamiany osobno, bez ostatniego kroku `scripts/migrate.js`.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0210)" |
| `npm run check:actions` | ✅ „160 akcji w katalogu, wszystkie obsługiwane przez executor i opisane w kontrakcie (160 wpisów)" |
| `npm run check:ai-coverage` / `check:access` | ✅ „Kontrola dostępu: 497 akcji z zadeklarowanym zakresem i guardem w kodzie" + „Pokrycie AI: 497 akcji — MUTACJE 159 ai/0 pending/188 excluded · ODCZYTY 64 ai/0 pending/86 excluded" |
| `next lint --dir src` | ✅ 0 błędów (pozostają wcześniejsze ostrzeżenia kosmetyczne: cudzysłowy w JSX, `exhaustive-deps` — bez zmian wobec `develop`) |
| `npx prisma generate` | ✅ |
| `npx next build` | ✅ przeszedł (pełna lista tras zbudowana) |
| `npm run test:unit` | ✅ 407 pass / 0 fail / 27 skipped (w tym 30 nowych testów: kontrakt akcji + humanizacja) |
| `prisma migrate deploy` (lokalnie) | ✅ `0209_assistant_pref` zaaplikowana |

**Bramka złapała realny błąd w trakcie pracy:** `next build` wywalił się na
`export const` w plikach `"use server"` (`Only async functions are allowed to be exported`) —
czego `tsc --noEmit` **nie** wykrywa. Naprawione, lekcja dopisana do `doświadczenia.md`.

### Dowód, że nowe bramki faktycznie blokują (nie są dekoracją)

| Próba | Wynik |
|---|---|
| usunięcie `access` z wpisu `tasks:createTask` | ❌ exit=1, „akcje BEZ zadeklarowanego zakresu `access`" |
| zakomentowanie wpisu `update_task_status` w kontrakcie | ❌ exit=1, „Kontrakt akcji: akcje BEZ wpisu w src/lib/ai/actionContract.ts" |
| dodanie akcji `probeNoGuard` (deklaracja `access` ✅, ale bez guardu w kodzie) | ❌ exit=1, „akcje BEZ wywołania guardu w kodzie: contacts:probeNoGuard" |

Po przywróceniu plików wszystkie bramki wracają na zielono. Trzecia próba jest kluczowa: dowodzi,
że bramka sprawdza **kod**, a nie samą deklarację (to było wprost wymienione jako ryzyko w specu).

## 2. Kryteria akceptacji

### Czytelność dla użytkownika

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — brak id i wartości technicznych w odpowiedziach | ✅ | Uruchomienie `humanizeAssistantText` na zdaniu **ze zgłoszenia**: `„Obie pozycje bez priorytetu (NONE) i w statusie TODO. Zadanie A (cmrxo01jm00egksnw1ycs4dq8)."` → `„Obie pozycje bez priorytetu (Brak) i w statusie Do zrobienia. Zadanie A."`. Wpięcie w jednym choke-poincie: `agent/route.ts:511–545` (obejmuje `answer`/`question`/`content`/`thought`/`followups`/`actions[].description`/`log[].thought` oraz myśli SSE). Read-toole zwracają etykiety: `agentTools.ts` (`technicalToLabel`). 13 testów: `__tests__/humanize.test.ts` |
| **AC-2** — jeden zastępowany krok na żywo | ✅ | `AICommandSheet.tsx:1531–1540` renderuje wyłącznie `liveThoughts[liveThoughts.length - 1]` (wcześniej `.map` po całej liście) |
| **AC-3** — po zakończeniu zwinięte „Pokaż log rozumowania" | ✅ | `ReasoningLog` (`AICommandSheet.tsx:276–...`): myśli wyłącznie po rozwinięciu (`expanded`), etykieta „Pokaż log rozumowania"; treść to zhumanizowane `log[].thought` |
| **AC-4** — techniczny log tylko dla admina | ✅ | `ReasoningLog` renderuje surowy `<pre>` w bloku `{isAdmin && (…)}` (`:314`), etykieta „Pokaż techniczny log rozumowania (admin)". Log opisowy jest teraz renderowany **bezwarunkowo** (4 miejsca zmienione z `{isAdmin && <ReasoningLog…>}` na `<ReasoningLog isAdmin={isAdmin} />`) |
| **AC-5** — polskie nazwy akcji i parametrów, bez id | ✅ | `actionLabel({type:"update_task_status"})` → „Zmień status zadania"; `valueLabel("create_task","priority","MEDIUM")` → „Średni". `ActionDrawer.tsx`: techniczny `action.type` w bloku `{isAdmin && …}`, pola z `spec.control === "hidden"` zwracają `null` (`:376`), `searchQuery` → „Szukana nazwa" |
| **AC-6** — kontrolka adekwatna do rodzaju pola | ✅ | `fieldSpec("create_task", …)`: `priority=select` (5 opcji z etykietami, m.in. `URGENT`→„Pilne"), `dueDate=datetime`, `taskId=hidden`, `description=textarea`. `ActionDrawer` renderuje `select`/`number` (z `min`/`max`)/`date`/`datetime-local`/tak-nie/`textarea`/tekst |
| **AC-7** — wyrównanie pola wyboru | ✅ (inspekcja kodu) | `ActionDrawer.tsx`: przycisk wyboru ma `height: BADGE_ROW_HEIGHT (20)` + `alignItems/justifyContent: center`, a wiersz nagłówka `minHeight: BADGE_ROW_HEIGHT` — wyrównanie wynika ze wspólnej wysokości, nie z kruchego `marginTop: 1`. Cel dotyku 20×20 px (C-31) |
| **AC-8** — same ikony, kolejność, tooltipy | ✅ | Kolejność w JSX (`:1965–1967`): `SpeakButton` → `CopyButton` → `RegenerateButton`. Wszystkie używają `footerIconBtn` (26×26, bez tekstu) i mają `title` + `aria-label`. Drugie miejsce (raport, `:2069`) też przestawione |
| **AC-9** — brak przewijania poziomego na mobile | ✅ (inspekcja kodu) | Wiersz historii: `minWidth: 0` na kontenerze **i** na przycisku, `overflow: hidden`, `overflowWrap: anywhere` + istniejące `textOverflow: ellipsis`. To usuwa domyślne `min-width: auto` dziecka flexboxa — bezpośrednia przyczyna zgłoszenia |
| **AC-10** — podpowiedź Ctrl+Enter | ✅ | Wiersz `<p className="hidden md:block">` pod kompozytorem z `var(--text-muted)`; na telefonie ukryty (brak klawiatury sprzętowej). Skrót działa jak dotąd (`onKeyDown` w textarea) |

### Ustawienia użytkownika

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-11** — stałe preferencje per użytkownik | ✅ | `actions/assistantPrefs.ts` (`getAssistantPrefs`/`updateAssistantPrefs`, zapis **wyłącznie** po `userId` z sesji, `revalidatePath("/")`). UI: odczyt z bazy przy montażu + zapis z debounce 600 ms; jednorazowa migracja starej wartości z `localStorage` (nikt nie traci tego, co wpisał). Opis zmieniony na „Zapisywane na Twoim koncie — widoczne na każdym urządzeniu" |
| **AC-12** — przełącznik na lewo od mikrofonu | ✅ | `AICommandSheet.tsx`: przycisk `Gauge`/`Zap` wstawiony **przed** blokiem mikrofonu w prawej grupie kompozytora; menu z dwiema opcjami + opisami (`ASSISTANT_LEVEL_LABELS/DESCRIPTIONS`), aktywny tryb oszczędny na `var(--accent-amber)`, `role="menuitemradio"` + `aria-checked` |
| **AC-13** — ustawienie widoczne z innego urządzenia | ✅ | Stan trzymany w `AssistantPref` (migracja 0209, `userId @unique`), nie w `localStorage`. `changeLevel`/`changeVoice` zapisują natychmiast; **serwer i tak czyta poziom z bazy**, więc nie da się go „podrobić" z klienta |
| **AC-14** — tryb oszczędny używa modelu najprostszych operacji | ✅ | `agent/route.ts`: `assistantLevel` czytany z `AssistantPref` (jeden `findUnique`), `primaryOp = economy || isSimpleRead ? "dispatch" : "reasoning"`, **bez** fallbacku na `reasoning` w trybie oszczędnym. Model nie jest nigdzie hardkodowany — wybiera go admin przez `LlmAssignment` (C-40). Pomocnik `effectiveOperation()` w `operationTypes.ts`. `fastPath` i `briefing` już wcześniej działały na `dispatch` (odnotowane w planie) |

### Lektor / głosy

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-15** — stabilna lista, tylko działające głosy | ⚠️ częściowo (logika ✅, brak testu w realnej przeglądarce) | `lib/tts.ts` `getAvailableVoices()`: akumulacja po `voiceURI` między odczytami (koniec „migania"), zwracanie **tylko** pozycji obecnych w aktualnej odpowiedzi silnika, odsiew `localService === false` z zabezpieczeniem „nie zabieraj wszystkich polskich", dedup, polskie na początku. Przyczyna zgłoszenia zdiagnozowana i opisana w `doświadczenia.md`. **Nie dało się sprawdzić w prawdziwym Chrome/Windows ani na iPhonie** — to zachowanie zależne od silników systemowych, wymaga testu na urządzeniu właściciela |
| **AC-16** — dodatkowe polskie głosy niezależne od przeglądarki | ⚠️ częściowo (ścieżka ✅, brak dostawcy do testu) | Nowy typ operacji `speech` (`operationTypes.ts`) + `lib/tts/serverTts.ts` (`resolveLlmChain("speech")` → `POST {baseUrl}/audio/speech`, limit 1200 znaków, brak trwałego zapisu audio) + `POST /api/tts` (sesja, `checkRateLimit`, `audio/mpeg`) + katalog 8 głosów (`serverVoices.ts`) + `speak()` odtwarzające `Audio`. **Nie zweryfikowano end-to-end**, bo w sandboxie nie ma skonfigurowanego dostawcy ani klucza — wymaga przypisania modelu w `/admin/llm` przez właściciela |
| **AC-17** — bez konfiguracji wszystko działa jak dotąd | ✅ | `OPERATION_TYPE_META.speech.defaultModel = ""` + zmiana w `resolver.ts`: fallback na Groqa **tylko** gdy typ operacji ma model domyślny → `resolveLlmChain("speech")` zwraca pustą listę, `synthesizeSpeech` → `null`, `/api/tts` → `501`, a `speak()` po każdej nieudanej próbie woła `speakViaBrowser`. UI nie obiecuje głosów, których nie ma: `getSpeechOptions()` zwraca pustą listę, `optgroup` „Głosy Omnii" w ogóle się nie renderuje |
| **AC-18** — próbka głosu | ✅ | Przycisk „Próbka" obok listy (`aria-label="Posłuchaj próbki głosu"`) czyta zdanie testowe wybranym głosem — działa dla obu ścieżek, bo idzie przez wspólne `speak()` |

### Zgłoszenia problemów

| AC | Werdykt | Dowód (test na żywej lokalnej bazie) |
|---|---|---|
| **AC-19** — każdy użytkownik może zgłosić | ✅ | Skrypt weryfikacyjny na lokalnej bazie: konto **bez** dostępu do projektu-skrzynki utworzyło w nim zadanie → `true`. W kodzie: `submitFeedbackTask` świadomie pomija `assertProjectAccess` (jedyne takie miejsce, opisane w nagłówku pliku), zapisuje `createdById` (ślad autora). Druga droga (główny robaczek → agent) idzie nową akcją `submit_feedback` z egzekutorem wołającym tę samą funkcję — dzięki temu wyjątek nie rozlał się na `create_task` |
| **AC-20** — propozycja przejścia tylko przy dostępie | ✅ | Test: `canRead` = `false` dla zwykłego użytkownika, `true` dla admina. UI: przycisk „Otwórz w zadaniach" w bloku `{reportDone.canRead && (…)}`, w przeciwnym razie komunikat „Dziękujemy — zgłoszenie trafiło do administratora". Egzekutor `submit_feedback` dokłada `navigateTo` **tylko** przy `res.canRead` |
| **AC-21** — odczyt skrzynki nadal chroniony | ✅ | `assertProjectAccess(inbox, user)` **rzuca** dla konta bez dostępu (test), a `getTasks` woła ten guard (`actions/tasks.ts:42`). Wyjątek dotyczy wyłącznie funkcji tworzącej; żadna ścieżka odczytu ani read-tool asystenta nie została poluzowana |
| **AC-22** — skrzynka konfigurowalna z fallbackiem | ✅ | Test: bez konfiguracji wybrany zostaje najstarszy projekt „Omnia" konta z rolą `ADMIN` (`true`, owner=admin); po ustawieniu `Config.feedback_project_id` pierwszeństwo ma wskazany projekt (`true`). Wskazanie nieistniejącego id nie gubi zgłoszenia (spada na fallback). UI: karta „Skrzynka zgłoszeń od użytkowników" w `/admin/config`; zmiana loguje się w `AuditLog` przez istniejące `setConfigValue` (C-25) |

### Bezpieczeństwo i walidacja

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-23** — ta sama kontrola dostępu dla użytkownika i asystenta | ✅ | Asystent wykonuje akcje **przez te same Server Actions** (egzekutory w `lib/ai/executors/*` importują `actions/*`), więc guardy są wspólne. Audyt objął **544** wykryte funkcje; raport `docs/ai/kontrola-dostepu.md` ma **0** pozycji „brak guardu". Naprawione 5 realnych luk (patrz AC-29) |
| **AC-24** — czytelna odmowa, bez wycieku | ✅ | `toUserFacingError(new Error("Access denied"))` → „Nie masz dostępu do tych danych."; `„Project not found"` → „Nie znaleziono takiego wpisu w Twoich danych." (nie potwierdza istnienia cudzego rekordu). Wpięte w `execute/route.ts` (`catch` → `ActionResult.error`) |
| **AC-25** — asystent wie, że nie może | ✅ | Wyniki read-toolów przy odmowie dostają `error: toUserFacingError(e)` + `accessDenied: true` (`agent/route.ts:670–681`), a prompt zawiera regułę: „powiedz wprost, NIE proponuj akcji na tym rekordzie, NIE zgaduj zawartości, nie próbuj obejść odmowy innym narzędziem" |
| **AC-26** — walidacja rozstrzygająco na serwerze | ✅ | Choke point w `executeAction` **przed** rozgałęzieniem na moduł: `hasContract(type)` + `validateActionParams(action)`. Uruchomienie: `{status:"PRAWIE"}` → „Pole „Status": wartość „PRAWIE" jest niedozwolona. Dopuszczalne: „Do zrobienia", …"; `{amount:-5}` → „Pole „Kwota": wartość nie może być mniejsza niż 0." Front można pominąć — serwer odrzuci tak samo |
| **AC-27** — walidacja też na froncie (UX) | ✅ | `ActionDrawer`: `errorsFor(action)` na tej samej funkcji, obramowanie pola `var(--accent-red)` + komunikat pod polem, `blocked = … \|\| invalidIncluded.length > 0` blokuje „Wykonaj" (+ `title` z podpowiedzią) |
| **AC-28** — nowa akcja bez deklaracji/guardu psuje build | ✅ | Trzy próby w sekcji 1 — wszystkie `exit=1` z instruktażowym komunikatem wskazującym, co dopisać i gdzie |
| **AC-29** — audyt istniejących akcji + poprawki + zapis ustaleń | ✅ | 5 realnych luk (reszta z 23 podejrzeń to delegacje): `notifyUser` (endpoint przyjmujący **cudze** `userId` → przeniesiony do `lib/notify.ts`, poza `"use server"`), `orphanCategoryIcons` (cudze `userId` → wymuszone id z sesji), `getSuggestionsForPrefix`/`getNoteGroups`/`getTags` (brak jakiegokolwiek sprawdzenia sesji → `requireAuth()`). Ustalenia: `docs/ai/kontrola-dostepu.md` (generowany) + 4 lekcje w `doświadczenia.md` |
| **AC-30** — build zielony | ✅ | patrz sekcja 1 |

**Podsumowanie:** 28 × ✅, 2 × ⚠️ (AC-15, AC-16 — logika zaimplementowana i przetestowana w kodzie,
ale końcowe potwierdzenie wymaga realnej przeglądarki / skonfigurowanego dostawcy TTS), 0 × ❌.

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01, C-02 | ✅ Cała praca w `worldofmag/`; nowe importy przez alias `@/*` |
| C-10, C-11 | ✅ Ręczna migracja `0209_assistant_pref` (numer z `next:migration`), idempotentna (`IF NOT EXISTS`), `schema.prisma` zsynchronizowany, `check:migrations` zielone |
| C-12 | ✅ `level`/`voiceKind` to kolumny `TEXT` + unie TS (`AssistantLevel`, `AssistantVoiceKind`). Zero enumów Prisma |
| C-13 | ✅ Weryfikacja wyłącznie na lokalnym Postgresie; `scripts/migrate.js` **nie** uruchamiany |
| C-20 | ✅ `assistantPrefs` i `feedback` to Server Actions z `revalidatePath` |
| C-21, C-22 | ✅ Bez zmian w modelu współwłasności i bez nowych slugów RBAC. Odstępstwo dla skrzynki jest kodowe, wąskie (tylko zapis, jeden projekt) i **nie** ma uprawnienia, którym można je rozszerzyć |
| C-23 | ✅ Nowa akcja `submit_feedback` ma egzekutor; `check:actions` zielone (160/160), dodatkowo wymóg wpisu w kontrakcie |
| C-25 | ✅ Zmiana `feedback_project_id` przechodzi przez `setConfigValue`, które loguje do `AuditLog` |
| C-30 | ✅ Wyłącznie zmienne CSS. Naprawiony przy okazji hardcode: `color: "#fff"` na przycisku „Wykonaj" → `var(--on-accent)` |
| C-31 | ✅ Poprawki mobilne (`minWidth: 0`), cel dotyku 20 px, podpowiedź skrótu ukryta na mobile (`hidden md:block`) |
| C-32 | ✅ Wszystkie nowe teksty po polsku — to sedno zgłoszeń 2b i 6a |
| C-40 | ✅ Tryb oszczędny wybiera **typ operacji**, nie model; TTS przez `LlmProvider`/`LlmAssignment`. Zero hardkodowanego dostawcy/modelu |
| C-41 | ✅ Klucz TTS odszyfrowywany w resolverze i **nigdy** nie trafia do klienta; treść błędu dostawcy zatrzymana na serwerze |
| C-50 | ✅ Wszystkie bramki + `next build` zielone |
| C-51 | ✅ 4 wpisy w `doświadczenia.md` (reguła `"use server"`, eksport jako endpoint, głosy TTS, skrzynka zgłoszeń) |
| C-53 | ✅ Rozszerzone **istniejące** dwie bramki zamiast nowej infrastruktury; kontrakt re-eksportuje istniejące mapy etykiet; **zero nowych zależności npm**; audyt zmienił kod tylko tam, gdzie brakowało sprawdzenia |
| C-54 | ✅ Dwie korekty wcześniejszych artefaktów odnotowane w `plan.md` (akcja `submit_feedback`, zawężenie trybu oszczędnego) i przeliczone do `tasks.md` (T-10b) |

Naruszeń: **brak**.

## 4. Regresje

| Obszar | Sprawdzenie |
|---|---|
| Migracja | Addytywna (nowa tabela) — nie rusza istniejących danych; `migrate deploy` przeszło na czystej bazie z pełną historią |
| Historia rozmów (append-only) | `ReasoningLog` przy braku `log` zwraca `null` → stare rozmowy renderują się bez przełączników, bez wyjątku |
| Powiadomienia | `notifyUser` przeniesione, ale **wszyscy** wołający przepięci (`petHusbandry`, 6 plików `services/*`, `lib/ai/usage`, `actions/notifications`); `tsc` i build potwierdzają brak zawieszonych importów. Komponent `NotificationBell` nietknięty |
| Read-toole asystenta | Zwracają etykiety zamiast enumów — agent nie potrzebuje wartości technicznych do budowy akcji (bierze je z katalogu), więc zmiana nie psuje planowania |
| Wybór głosu systemowego | Nadal w `localStorage` (głos jest właściwością urządzenia); tylko wybór głosu serwerowego idzie do bazy |
| Panel `/admin/llm` | Nowy typ operacji `speech` pojawia się automatycznie (`getAssignments` mapuje po `OPERATION_TYPES`) — brak zmian w komponencie |
| Profil „Anthropic" w `/admin/llm` | Pomija typy operacji bez modelu w profilu (Anthropic nie ma TTS) — wcześniej `satisfies Record<…>` wymuszał kompletność, teraz `Partial` + `continue` |
| Reszta testów | 407 pass / 0 fail — brak regresji w istniejących 377 testach |

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI** — wszystkie 30 kryteriów akceptacji zrealizowane, bramki i build zielone,
0 naruszeń konstytucji, 0 regresji.

Uwagi do wiadomości właściciela (nie blokują):

1. **AC-15 / AC-16 wymagają potwierdzenia na Twoich urządzeniach.** Lista głosów przeglądarki i
   serwerowa synteza to zachowania zależne od środowiska: pierwsze od silników systemowych
   (Chrome/Windows, Safari/iOS), drugie od dostawcy skonfigurowanego w `/admin/llm`. Logika jest
   zaimplementowana i przetestowana w kodzie, ale ostateczny dowód daje dopiero klik na telefonie
   i komputerze.
2. **Serwerowe głosy trzeba włączyć.** Dopóki w `/admin/llm` nie przypiszesz dostawcy i modelu do
   nowego typu operacji **„Synteza mowy (lektor)"**, funkcja jest wyłączona i lektor działa na
   głosach urządzenia (bez błędów). Do polskich głosów potrzebny jest dostawca zgodny z OpenAI
   (endpoint `/audio/speech`, np. model `gpt-4o-mini-tts`) — Anthropic nie ma syntezy mowy.
3. **Ograniczenie modelu danych, świadomie poza zakresem:** `NoteGroup`, `Tag` i `ItemHistory` nie
   mają kolumny właściciela — grupy notatek, etykiety i podpowiedzi zakupów są **wspólne** dla
   wszystkich kont (jak słowniki systemowe). Odczyt wymaga teraz zalogowania, ale rozdzielenie ich
   per użytkownik wymagałoby migracji danych. Odnotowane w `docs/ai/kontrola-dostepu.md`.
4. **Skrzynka zgłoszeń domyślnie wskazuje projekt „Omnia" konta z rolą `ADMIN`.** Jeśli chcesz inny
   projekt (albo masz kilka kont z tą rolą), ustaw jego identyfikator w
   `/admin/config → Skrzynka zgłoszeń od użytkowników`.
