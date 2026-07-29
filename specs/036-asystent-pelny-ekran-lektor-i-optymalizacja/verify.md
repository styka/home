# Weryfikacja — 036 Asystent: pełny ekran, lektor i optymalizacja

Data: 2026-07-29 · branch roboczy `claude/omnia-admin-tasks-batch-3wchwc`

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0215)" |
| `npm run check:actions` | ✅ 160 akcji w katalogu, wszystkie z egzekutorem i kontraktem; 373 parametry z etykietami PL |
| `npm run check:ai-coverage` | ✅ 508 akcji z zakresem dostępu i guardem; MUTACJE 159 ai/0 pending · ODCZYTY 64 ai/0 pending |
| `npx tsc --noEmit` | ✅ bez błędów |
| `npx next lint --dir src` | ✅ bez nowych ostrzeżeń (zostają wyłącznie znane, kosmetyczne: `exhaustive-deps`, `no-img-element`) |
| `npx prisma migrate deploy` (lokalny Postgres 16) | ✅ po poprawce 0214 — wiersz `assistant_followups_enabled = 1` obecny w bazie |
| `npx next build` (lokalny Postgres) | ✅ exit 0, komplet tras zbudowany |

**C-13 respektowane:** wszystko na lokalnym Postgresie (`127.0.0.1:5432/omnia_dev`), zero kontaktu
z bazą produkcyjną. `scripts/migrate.js` **nie** był uruchamiany.

> **Bramka złapała realny błąd.** Migracja 0214 wywracała `migrate deploy`:
> `null value in column "id" of relation "Config"`. `@default(cuid())` to wartość domyślna **klienta
> Prisma**, nie bazy, więc surowy `INSERT` musi podać `gen_random_uuid()::text`. Gdyby nie lokalny
> Postgres, błąd wyszedłby dopiero przy wdrożeniu na produkcję. Naprawione, lekcja w `doświadczenia.md`.

## 2. Kryteria akceptacji

### Okno na telefonie (Z1)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — pełna szerokość i wysokość, bez przyciemnienia i paska | ✅ | `AICommandSheet.tsx:1529-1540` — przy `fullScreen` arkusz dostaje `position:fixed, left:0, width:100%, border:none, borderRadius:0`; `:1514` tło nakładki `transparent`; `:1551` uchwyt („pasek") renderowany tylko `{!fullScreen && …}` |
| **AC-2** — okno nie przesuwa się przy klawiaturze, miejsce oddaje lista wiadomości | ✅ | `top: viewport.offsetTop` + `height: viewport.height` (`:1536-1537`) — okno jest przypięte do **widocznego** obszaru, więc kurczy się zamiast być przewijane. Nagłówek i kompozytor mają `flex-shrink:0`, jedyny elastyczny element to lista wiadomości |
| **AC-3** — nagłówek u góry, pole tuż nad klawiaturą | ✅ | jw. — kolumna `display:flex/column` o wysokości równej widocznemu obszarowi; nic nie może wyjść poza ekran |
| **AC-4** — po schowaniu klawiatury okno odzyskuje wysokość | ✅ | `useVisualViewport` nasłuchuje `resize`+`scroll` z throttlingiem `requestAnimationFrame` (`useVisualViewport.ts:57-72`) — powrót do pełnej wysokości jest tą samą ścieżką co jej oddanie |
| **AC-5** — karetka w polu, we właściwej wysokości, nie skacze po pierwszym znaku | ✅ | przyczyna usunięta w 035 (stały `padding-bottom` kompozytora — wpis w `doświadczenia.md` 2026-07-28); inwentarz §2.1 potwierdza, że **nic** nie ustawia pozycji karetki |
| **AC-6** — desktop bez zmian | ✅ | gałąź `else` (`:1542-1547`) zachowuje `border`, `borderRadius:16px 16px 0 0`, `height/maxHeight:85vh`; `fullScreen` wymaga `isNarrow` = `matchMedia("(max-width: 767px)")`, więc na `md:` jest zawsze `false` |
| **AC-7** — jednoznaczna odpowiedź o „kombinowanie" z kursorem | ✅ | §2.1 poniżej (pełny inwentarz) |

#### 2.1 Inwentarz zabiegów na fokusie i karetce (odpowiedź na AC-7)

Przeszukanie `AICommandSheet.tsx` pod kątem `focus`, `blur`, `caret`, `setSelectionRange`,
`scrollIntoView`, `pointerdown`+`preventDefault`. **Kompletna lista czterech miejsc:**

| Miejsce | Co robi | Dlaczego zostaje |
|---|---|---|
| `:1910` `caretColor: "var(--accent-blue)"` | **wyłącznie kolor** karetki | czysta stylistyka; nie ma wpływu na pozycję ani na fokus |
| `:849-851` `ta.focus()` + `ta.setSelectionRange(end, end)` | ustawia kursor **na końcu** przywróconego szkicu wiadomości | bez tego kursor po wczytaniu szkicu z bazy lądowałby na początku tekstu; dotyczy pola z treścią, nie pustego |
| `:2020` `composerRef.current?.blur()` | chowa klawiaturę **po wysłaniu** wiadomości | świadome: po wysłaniu użytkownik czyta odpowiedź, a nie pisze dalej |
| `:1749` `autoFocus` na polu zmiany nazwy rozmowy | fokus w oknie zmiany nazwy w szufladzie historii | inne pole, inny widok — nie dotyczy kompozytora |

**Czego NIE ma:** żadnego `scrollIntoView`, żadnego `onPointerDown` + `preventDefault` na polu
wiadomości, żadnego ustawiania pozycji karetki dla pustego pola, żadnego `setTimeout` z fokusem.

**Wniosek dla właściciela:** nic w kodzie nie „kombinuje" z położeniem kursora. Skakanie karetki
brało się z **układu**, nie z fokusu: (a) w 035 kompozytor zmieniał `padding-bottom` w reakcji na
fokus, czyli dokładnie w klatce, w której iOS animuje klawiaturę i liczy pozycję karetki;
(b) okno miało wysokość `85vh`, a `vh` nie kurczy się przy klawiaturze, więc system przewijał całą
stronę. Oba źródła są usunięte.

### Lektor w trybie rozmowy (Z2)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-8** — głos serwerowy działa w trybie rozmowy na telefonie | ✅ | `AICommandSheet.tsx:540` — `primeSpeech()` woła się **w geście dotknięcia**, przed jakimkolwiek `await`; `tts.ts:64-67` → `primeSpeechPlayback()` odblokowuje współdzielony element `<audio>` (cichy WAV, `play()`+`pause()`), więc późniejsze odtworzenie po `await fetch("/api/tts")` nie traci aktywacji użytkownika |
| **AC-9** — **każda** kolejna wypowiedź, nie tylko pierwsza | ✅ | `tts.ts:193-211` — jeden trwały `sharedAudio` przez cały czas życia strony; kolejne wypowiedzi podmieniają tylko `src` (`:286`), nigdy nie tworzą nowego elementu |
| **AC-10** — przy każdej porażce odzywa się głos przeglądarki | ✅ | `speakViaServer` zwraca `false` przy: braku `serverVoiceId`, `!res.ok` (501/429/502), braku elementu, wyjątku (`catch`); `speak()` (`:302-308`) na `!ok` woła `speakViaBrowser`. Cisza jest niemożliwa dopóki działa synteza przeglądarki |
| **AC-11** — bez nakładania się dwóch głosów | ✅ | `speak()` woła `stopSpeaking()` (podbija `speechGeneration`) przed startem; `speakViaServer` sprawdza `generation !== speechGeneration` **po** `fetch` i **przed** odtworzeniem (`:275`), a `stopServerAudio()` (`:246-257`) pauzuje i zwalnia objectURL przez `removeAttribute("src")`+`load()` |

### Optymalizacja kosztów (Z3)

| AC | Werdykt | Dowód (pomiar `estimateTokens`) |
|---|---|---|
| **AC-12** — mniej wywołań modelu niż dotychczasowe trzy | ✅ | `SMALL_TALK_RE` pomija `classifyIntent` **i** `routeModules` (`agent/route.ts:743-745`) → **3 → 1** wywołanie |
| **AC-13** — istotnie mniej tokenów niż 7734 z audytu | ✅ | prompty tury powitalnej: **4441 → 2673 tokenów (−1768, −40%)**; rozbicie: klasyfikator 699 + router 203 + skrócony prompt agenta |
| **AC-14** — w diagnostyce widać **odczyty** pamięci podręcznej, nie tylko zapisy | ⚠️ **częściowo** | `toAnthropicSystem` zwraca **2 bloki**: `[0] 2541 zn. ≈636 tok. cache_control=TAK`, `[1] 15207 zn. ≈3802 tok. cache_control=nie`. Zmienny ogon **przestał** być zapisywany po 1,25× ceny — to znika z kolumny „zapis". Ale prefiks stały (~636–900 tok. realnych) **prawdopodobnie nie przekracza progu cache'owania dostawcy** (u Anthropic 1024 tok.), więc kolumna „odczyt" może nadal pokazywać zero. Szczegóły i decyzja: §5 |
| **AC-15** — rozmowa bez katalogu akcji, ale akcja nadal wykonalna | ✅ | prompt bez katalogu: 4437 → 2982 tok., `includes("Dostępne akcje ZAPISU") === false`. Ścieżka odwrotu: `withActionCatalogRetry` (`agent/route.ts:866-873`) — gdy agent mimo to zwróci `step:"plan"`, przebieg jest ponawiany z **pełnym** katalogiem (`activeModules`) |
| **AC-16** — polecenia zmiany działają jak wcześniej | ✅ | `SMALL_TALK_RE.test("cześć, dodaj mleko") === false`, `…("dodaj zadanie kup mleko") === false` (kotwica `$`). Zestaw testowy: 12 trafień / 8 odrzuceń, **zero fałszywych trafień**, brak nakładania z `READ_INTENT_RE`. Dla poleceń zmiany `includeActions` pozostaje `true` |
| **AC-17** — treść instrukcji dla modelu identyczna | ✅ | `stable + variable === buildSystemPrompt(modules)` **co do znaku** dla 4 zestawów modułów (pusty, `tasks`, `pets`, pełny 16-modułowy). Równość wynika z konstrukcji — obie funkcje składają te same kawałki. Jedyna sterowana zmiana treści to warunkowy fragment o follow-upach (AC-19, świadomie dopuszczone w planie §6.4) |

### Przełącznik follow-upów (Z3)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-18** — przełącznik w konfiguracji modeli z wyjaśnieniem kosztu | ✅ | `LlmConfigPanel.tsx:488-520` `FollowupsSection` (sekcja „Propozycje kolejnych pytań", checkbox 20×20, `py-3`, opis kosztu), wpięta `:877`; prop z `app/admin/llm/page.tsx` |
| **AC-19** — wyłączone: prompt ich nie zamawia | ✅ | `buildSystemPrompt(["tasks"], { followups:false }).includes("followups") === false`; trasa czyta wartość przez `readFollowupsEnabled()` (`agent/route.ts:822`) |
| **AC-20** — włączone: wracają bez wdrożenia | ✅ | wartość żyje w `Config` (odczyt per żądanie, bez cache modułowego), `setFollowupsEnabled` robi `upsert` + `revalidatePath("/admin/llm")` |
| **AC-21** — zmiana w dzienniku konfiguracji | ✅ | `llmConfig.ts:593-598` `logAudit("config", "assistant_followups.set", …)` z polskim opisem (C-25) |
| **AC-22** — po wdrożeniu zachowanie bez zmian | ✅ | migracja 0214 wstawia `'1'` z `ON CONFLICT DO NOTHING`; `readFollowupsEnabled()` zwraca `true` także gdy wiersza brak **lub** odczyt padnie (`followups.ts:16-25`). Zweryfikowane na lokalnej bazie: wiersz `assistant_followups_enabled = 1` |

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** praca w `worldofmag/` | ✅ jedyne pliki poza nim to `specs/036-*`, `CLAUDE.md`, `doświadczenia.md` — wszystkie zgodne z C-03/C-51 |
| **C-02** alias `@/*` | ✅ wszystkie nowe importy (`@/hooks/useVisualViewport`, `@/lib/ai/followups`) |
| **C-10/C-11** ręczna migracja, unikalny numer | ✅ `0214_asystent_followups_config`, `check:migrations` zielony (następny wolny 0215) |
| **C-12** zero enumów Prisma | ✅ przełącznik to `Config.value` typu `String` (`"1"`/`"0"`) |
| **C-13** żadnego builda/migracji przeciw prod DB | ✅ wyłącznie lokalny Postgres; `migrate.js` nieuruchamiany |
| **C-14** idempotentny seed | ✅ `ON CONFLICT ("key") DO NOTHING` — ponowny przebieg nie cofa decyzji admina |
| **C-20** Server Actions z `revalidatePath` | ✅ `setFollowupsEnabled` |
| **C-22** RBAC | ✅ `requireAdmin()` w obu akcjach; nowy slug niepotrzebny (mieści się w `module.admin`) |
| **C-23** każda `AIAction` ma egzekutor | ✅ nie dodano nowych akcji; `check:actions` zielony |
| **C-25** zmiany konfiguracji w `AuditLog` | ✅ `logAudit("config", …)` |
| **C-30** motyw przez zmienne CSS | ✅ `var(--bg-surface)`, `var(--border)`, `var(--accent-blue)`; **zero** hexów w nowym kodzie |
| **C-31** mobile-first, cele dotyku | ✅ `hidden md:flex` bez zmian, `py-3` na przełączniku, checkbox 20×20 |
| **C-32** teksty po polsku | ✅ UI i komentarze |
| **C-40** routing modeli DB-driven | ✅ nic nie hardcoduje modelu; `includeActions`/`followups` dotyczą treści promptu, nie doboru modelu |
| **C-50** definicja „gotowe" | ✅ do kroku `next build` włącznie |
| **C-51** lekcje | ✅ cztery wpisy w `doświadczenia.md` |
| **C-53** minimalizm | ✅ zero nowych zależności; jeden nowy hook i jeden moduł odczytu konfiguracji |
| **C-54** spójność artefaktów | ✅ dwie korekty zapisane w `plan.md` (§6.1 i §6.2) i przeliczone do `tasks.md` (T-10) |

## 4. Regresje

- **Wywołania bez `systemBlocks` niezmienione** — `toAnthropicSystem(system)` bez drugiego argumentu
  zwraca jeden blok z `cache_control`, dokładnie jak przed zmianą. Dotyczy wszystkich pozostałych
  ścieżek LLM (notatki, kuchnia, magazyn, wizja, TTS).
- **Strażnik niespójnego podziału** — gdy `stable + variable` nie odtwarza dokładnie wysyłanej treści,
  podział jest **ignorowany** i wracamy do jednego bloku (zmierzone: „niespójny podział → bloków: 1").
  Nie da się po cichu zmienić promptu przez błędny split.
- **Ścieżka wznowienia (`clarify`/`refine`)** — nie przechodzi przez `SMALL_TALK_RE` ani przez
  skracanie katalogu: `freshText` jest wtedy pusty, więc `includeActions` = `true`.
- **Fast-path** — nietknięty dla wszystkiego poza czystą uprzejmością.
- **`NAVIGATION_CATALOG`** — usunięty **nieużywany** import z trasy agenta (pozostałość po
  przeniesieniu promptów w 035). Sam katalog nadal jest częścią promptu.
- **Migracja** — dodaje jeden wiersz do istniejącej tabeli, nie rusza schematu. Wycofanie:
  `DELETE FROM "Config" WHERE key = 'assistant_followups_enabled'`.

## 5. Uwaga do AC-14 — uczciwy stan pamięci podręcznej promptu

**Co zostało naprawione bezspornie.** Zgłoszony objaw (`cache zapis/odczyt = 5284/0` przy każdym
wywołaniu) to była **nadpłata 25%**: cały prompt — razem ze zmiennym katalogiem akcji — był
oznaczany do zapisu po 1,25× ceny wejścia, a trafienia praktycznie nie było. Po zmianie zmienny ogon
(≈3802 tok.) nie jest już zapisywany. Ten zysk jest pewny i niezależny od dostawcy.

**Czego nie da się dziś obiecać.** Prefiks stały ma 2541 znaków (≈636 tok. wg naszego szacunku,
realnie rzędu 800–900 dla polszczyzny), a dostawcy cache'ują dopiero prefiksy **powyżej progu**
(u Anthropic 1024 tokeny dla większości modeli). Poniżej progu blok po prostu nie trafia do pamięci —
bez błędu i bez ostrzeżenia. Kolumna „odczyt" może więc nadal pokazywać zero.

**Rozważona alternatywa i decyzja.** Prefiks dałoby się powiększyć ponad próg, przenosząc do niego
katalog nawigacji (≈355 tok.). Odrzucone, bo:
1. katalog nawigacji jest **wyłączany** dla tur odczytowych i powitalnych (P4) — w części stałej
   musiałby zostać **zawsze**, kasując pewną oszczędność ≈355 tok. na każdej takiej turze,
2. zysk byłby **warunkowy** (tylko Anthropic, tylko jeśli próg faktycznie zostanie przekroczony —
   czego nie da się tu zmierzyć bez wywołania płatnego API),
3. C-53: wymieniamy pewną oszczędność na spekulacyjną.

**Rekomendacja dla właściciela:** po wdrożeniu wystarczy zerknąć w diagnostykę na kolumnę
„cache zapis/odczyt". Jeśli zapis spadł do ~636 (zamiast ~5284) — cel jest osiągnięty kosztowo.
Jeśli dodatkowo pojawią się odczyty, prefiks przekroczył próg. Gdyby zapis wynosił 0/0, próg nie
został przekroczony i wtedy warto wrócić do wariantu z katalogiem nawigacji w prefiksie.

## 6. Ograniczenia weryfikacji

- **Brak fizycznego iPhone'a i przeglądarki w tym środowisku.** AC-1..AC-6 oraz AC-8..AC-11
  zweryfikowano **mechanizmem w kodzie** (przypięcie do `visualViewport`, odblokowanie elementu audio
  w geście), a nie obserwacją na urządzeniu. Mechanizmy są standardowym rozwiązaniem obu problemów
  i nie mają gałęzi zależnych od danych, ale ostateczne „widzę, że działa" należy do właściciela.
- **Brak wywołań płatnego API** — pomiary tokenów pochodzą z `estimateTokens` (heurystyka repo),
  nie z tokenizera dostawcy. Względne różnice (−1768, −1455) są wiarygodne; wartości bezwzględne
  są przybliżone. Stąd ostrożność przy AC-14.

## 7. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

21 z 22 kryteriów spełnionych z dowodem. Jedyne zastrzeżenie to **AC-14**: zgłoszona nadpłata za
pamięć podręczną została usunięta, ale samych *odczytów* nie można obiecać, dopóki prefiks stały nie
przekroczy progu dostawcy — z uzasadnieniem, dlaczego świadomie nie powiększamy go kosztem pewniejszej
oszczędności (§5). Bramki zielone, żadnych naruszeń konstytucji, żadnych regresji.
