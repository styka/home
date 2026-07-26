# Recenzja: Asystent AI — czytelność, bezpieczeństwo i wymuszona walidacja akcji

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-25
- **Diff:** `origin/develop..HEAD` — 56 plików, +5778 / −824 (z czego ~1180 linii to artefakty
  pipeline'u i generowany `docs/ai/kontrola-dostepu.md`)

Recenzja skupiona na tym, czego `verify.md` nie mógł pokazać: poprawności warstwa-po-warstwie,
warunkach brzegowych i zgodności z konwencjami repo. Ustalenia posortowane od najpoważniejszego.
Trzy pierwsze **naprawione w trakcie recenzji** (drobne, bezpieczne poprawki — zgodnie z zasadami
etapu), z odnotowaniem poniżej.

---

## Ustalenia

### 1. `ActionDrawer` niszczył strukturę nietkniętych parametrów — NAPRAWIONE ✅
- **Plik:** `src/components/home/ActionDrawer.tsx:143–145, 198–215`
- **Kategoria:** correctness
- **Opis:** Stan edycji parametrów inicjalizował się jako `String(v ?? "")` dla **wszystkich**
  parametrów, a `handleConfirm` odsyłał ten stan do backendu, rzutując z powrotem tylko liczby
  i wartości logiczne. Tablice i obiekty traciły strukturę.
- **Scenariusz awarii:** „Otaguj zadanie X tagiem pilne" → agent proponuje
  `set_task_tags { tags: ["pilne"] }`. Użytkownik otwiera „Przejrzyj / popraw" (a moja zmiana
  właśnie zachęca do tego — pola mają teraz czytelne etykiety), **niczego nie zmienia**, klika
  „Wykonaj". Do egzekutora leci `tags: "pilne"` (string), `resolveTaskTagIds` robi
  `Array.isArray("pilne") === false` → pusta lista → **zadanie nie dostaje tagu, a akcja raportuje
  sukces**. To samo dotyczy `bulk_add_words.words` (`"[object Object]"`), `daysOfWeek: [1,3,5]`
  (`"1,3,5"`), `timesOfDay`, `projectNames`, `removeTags`.
- **Ocena wagi:** defekt istniał przed tą zmianą, ale leży w komponencie przepisanym w tym
  feature'cie i moja zmiana zwiększa szansę jego trafienia — więc naprawiam, a nie „zostawiam bo
  nie moje".
- **Poprawka (naniesiona):** dodany `touchedParams: Set<`${actionId}:${key}`>`; pole, którego
  użytkownik nie dotknął, wraca do backendu jako **oryginalna wartość**, nie jej reprezentacja
  tekstowa. Ta sama zasada w `errorsFor()`, żeby walidacja frontu widziała prawdziwe typy.

### 2. `toUserFacingError` zamazywał komunikaty pomocne dla agenta — NAPRAWIONE ✅
- **Plik:** `src/lib/ai/executors/shared.ts` (gałąź `NOT_FOUND_RE`)
- **Kategoria:** correctness (regresja wprowadzona w tym feature'cie)
- **Opis:** Mapowanie na jednolity tekst objęło nie tylko odmowy dostępu, ale też wszystkie „nie
  znaleziono" — a te komunikaty w Omnii są **celowo bogate**.
- **Scenariusz awarii:** Użytkownik: „Pokaż trzy najważniejsze zadania z projektu o mnie". Read-tool
  zwracał: „Nie znaleziono projektu o nazwie »o mnie«. Dostępne projekty: Raj, Pomysły, Mieszkanie,
  Omnia, LZ, AIA." — i agent dzięki tej liście zadawał trafne pytanie („Czy chodziło o **Omnia**?",
  widoczne w transkrypcie zgłoszenia nr 10). Po mojej zmianie agent dostawałby „Nie znaleziono
  takiego wpisu w Twoich danych." i **stracił** podstawę do sensownego dopytania — musiałby zgadywać
  albo wołać kolejne narzędzie (dodatkowy koszt i iteracja).
- **Poprawka (naniesiona):** gałąź `NOT_FOUND_RE` usunięta. Genericyzujemy **wyłącznie** odmowy
  dostępu (to jest cel AC-24); komunikaty „nie znaleziono" dotyczą danych, do których użytkownik
  ma dostęp, więc niczego nie ujawniają. Powód zapisany w komentarzu, żeby nikt tego nie „naprawił"
  z powrotem. Sprawdzone uruchomieniem: odmowa → tekst ogólny, podpowiedź z listą projektów → bez zmian.

### 3. Odczyt serwerowego TTS mógł zagrać po zatrzymaniu — NAPRAWIONE ✅
- **Plik:** `src/lib/tts.ts` (`speakViaServer` / `stopSpeaking`)
- **Kategoria:** correctness (wyścig)
- **Scenariusz awarii:** Użytkownik klika „odczytaj na głos" (głos serwerowy), po sekundzie klika
  ponownie, żeby przerwać. `stopSpeaking()` nie miało czego zatrzymać, bo `fetch("/api/tts")` był
  jeszcze w drodze. Gdy odpowiedź dotarła, tworzyła `Audio` i **zaczynała grać** — przycisk
  pokazywał stan „zatrzymane", a lektor mówił.
- **Poprawka (naniesiona):** licznik `speechGeneration` inkrementowany w `stopSpeaking()`;
  odpowiedź z nieaktualnej generacji jest porzucana (i nie odpala fallbacku do przeglądarki).

### 4. Martwy kod w `lib/tts.ts` — NAPRAWIONE ✅
- **Kategoria:** simplification (C-53)
- **Opis:** (a) `voiceCache` miał „zapobiegać miganiu listy", ale ponieważ zwracamy wyłącznie głosy
  obecne w aktualnej odpowiedzi silnika, cache wpływał jedynie na tożsamość obiektów — komentarz
  obiecywał więcej, niż kod robił. Realną naprawę zapewnia odsiew `localService === false` już przy
  pierwszym odczycie (użytkownik od razu widzi krótką, uczciwą listę). (b) `getServerVoiceId()`
  wyeksportowane, ale nieużywane w całym repo.
- **Poprawka (naniesiona):** cache i martwy eksport usunięte, komentarz sprowadzony do tego, co kod
  faktycznie gwarantuje.

### 5. Anthropic przypisany do typu operacji `speech` skończy się błędem 502
- **Plik:** `src/lib/tts/serverTts.ts:34`
- **Kategoria:** convention (obsługa błędu, nie defekt)
- **Opis:** `synthesizeSpeech` woła `{baseUrl}/audio/speech` niezależnie od `cfg.kind`. Jeśli admin
  przypisze do „Syntezy mowy" dostawcę Anthropic (`kind: "anthropic"`), trafimy w nieistniejący
  endpoint.
- **Skutek:** `res.ok === false` → wyjątek → `/api/tts` zwraca `502` → klient **po cichu wraca do
  głosów przeglądarki**. Czyli awaria jest w pełni obsłużona; brakuje tylko czytelnej informacji dla
  admina, że ten dostawca nie ma TTS.
- **Świadomie NIE naprawiam:** wymagałoby to albo filtrowania dostawców w panelu `/admin/llm` (nowa
  logika w UI poza zakresem tego speca), albo drugiej listy „kto potrafi TTS". Fallback działa,
  a `verify.md` (uwaga 2) mówi właścicielowi wprost, że potrzebny jest dostawca zgodny z OpenAI.
  Dopisanie tego do panelu to naturalny kolejny krok, nie brak w tym feature'cie.

### 6. Humanizacja usuwa identyfikatory także z treści raportu
- **Plik:** `src/app/api/llm/home/agent/route.ts:525–545` (klucz `content`)
- **Kategoria:** convention (świadomy kompromis)
- **Opis:** Sanitizer działa na `content` kroku `report`, więc raport zapisany do `/reports` też nie
  będzie zawierał identyfikatorów rekordów.
- **Skutek:** zgodne z AC-1 („w żadnym miejscu widocznym dla użytkownika"), ale gdyby ktoś kiedyś
  chciał raportu diagnostycznego z id — musi je wziąć z technicznego logu rozumowania (admin).
  Odnotowuję jako świadomą konsekwencję, nie defekt. Bloki kodu (``` ```) są nietknięte, więc raport
  z fragmentem JSON zachowa dane techniczne.

### 7. Kontrakt akcji opisuje pola wybiórczo — celowo
- **Plik:** `src/lib/ai/actionContract.ts`
- **Kategoria:** simplification (potwierdzenie decyzji, nie zastrzeżenie)
- **Opis:** Dla 160 typów akcji opisane są tylko pola wymagające innej kontrolki niż tekst; reszta
  spada na `PARAM_LABELS` + heurystykę `fieldSpec` (identyfikator → ukryty, data ISO → picker,
  liczba/bool → odpowiednia kontrolka). `validateActionParams` świadomie **nie** wymyśla reguł dla
  pól nieopisanych — inaczej asystent byłby ograniczany regułami, których nie ma w formularzach UI,
  co łamałoby zasadę „asystent może dokładnie tyle, co użytkownik".
- **Ocena:** właściwy kompromis (C-53). Bramka pilnuje kompletności `label`, więc żaden typ akcji nie
  pokaże technicznej nazwy; dokładność opisu pól można pogłębiać przyrostowo.

### Sprawdzone i **bez** zastrzeżeń

- **Migracja `0209_assistant_pref`** — addytywna, idempotentna (`IF NOT EXISTS`), FK z kaskadą,
  numer z `next:migration`, `schema.prisma` zgodny 1:1 z DDL, `level`/`voiceKind` jako `TEXT` + unie
  TS (C-10..C-12). Zaaplikowana na lokalnej bazie.
- **Wyjątek dostępowy skrzynki zgłoszeń** — najczulsze miejsce w całym diffie. Sprawdzone: dotyczy
  wyłącznie `submitFeedbackTask` (jedno `prisma.task.create`, żadnego odczytu), tylko jednego
  wyznaczonego projektu, z limitami długości i zapisem `createdById`; `canRead` liczone osobno przez
  istniejące `assertProjectAccess`. Brak uprawnienia RBAC, którym dałoby się to rozszerzyć.
  `getFeedbackInboxInfo` nie ujawnia nic poza `projectId` (który i tak jest bezużyteczny bez dostępu).
- **`notifyUser` → `lib/notify.ts`** — wszyscy wołający przepięci (9 plików), plik docelowy **nie**
  ma `"use server"`, więc funkcja przestała być zdalnym endpointem. `NotificationBell` nietknięty.
- **`orphanCategoryIcons`** — `session.user.id !== userId` → `Access denied`; wszyscy realni wołający
  przekazują id z sesji, więc zmiana nie psuje ścieżek (`categories.ts:225`).
- **Bramki** — nie są dekoracją: trzy próby sabotażu (brak `access`, brak wpisu w kontrakcie, akcja
  z deklaracją ale bez guardu) kończą się `exit=1` z instruktażowym komunikatem (`verify.md` §1).
  Mechanizm `guardedVia` weryfikuje, że deklarowana delegacja **faktycznie występuje** w kodzie.
- **C-30** — nowy kod używa wyłącznie zmiennych CSS; przy okazji naprawiony istniejący hardcode
  `color: "#fff"` na przycisku „Wykonaj" → `var(--on-accent)`.
- **C-41** — klucz TTS odszyfrowywany w resolverze i nigdy nie opuszcza serwera; treść błędu
  dostawcy zatrzymana (`/api/tts` zwraca własny komunikat).
- **Sanitizer nie rusza `params`** akcji — tylko `description`. To było kluczowe ryzyko (wartości
  techniczne w parametrach są wymagane) i jest poprawnie ominięte.
- **Brak nowych zależności npm.** `package.json`: jedna linia (alias `check:access`).

---

## Bramki po naniesionych poprawkach

| Komenda | Wynik |
|---|---|
| `npm run check:actions` | ✅ 160/160 z kontraktem |
| `npm run check:access` | ✅ 497 akcji z zakresem i guardem |
| `npm run check:migrations` | ✅ następny wolny numer 0210 |
| `next lint --dir src` | ✅ 0 błędów |
| `npm run test:unit` | ✅ **480 pass / 0 fail** |
| `npx next build` | ✅ przeszedł |

---

## Werdykt

**APPROVE Z UWAGAMI**

Cztery ustalenia naprawione w trakcie recenzji (dwa realne defekty korygujące zachowanie, jeden
wyścig, jedno uproszczenie), trzy pozostałe to świadome kompromisy udokumentowane wyżej — żadne nie
blokuje wdrożenia. Zmiana realizuje wszystkie 11 zgłoszeń administratora, nie łamie żadnej reguły
konstytucji, nie dokłada zależności i — co dla tej paczki najważniejsze — **zamienia obietnice na
bramki**: nowa akcja bez kontroli dostępu, bez reguł walidacji albo bez polskiej etykiety od teraz
przerywa build, a nie „powinna być poprawiona przy okazji".

Uwagi z `verify.md` (potrzeba potwierdzenia głosów na urządzeniach właściciela, konieczność
przypisania dostawcy TTS w `/admin/llm`, wspólne `NoteGroup`/`Tag`/`ItemHistory`) pozostają aktualne
i są przekazane właścicielowi wprost.
