# Recenzja — 036 Asystent: pełny ekran, lektor i optymalizacja

Data: 2026-07-29 · diff `origin/develop...claude/omnia-admin-tasks-batch-3wchwc`
Zakres: 19 plików, +1414 / −83 (z czego 784 linie to artefakty pipeline'u i dokumentacja).

Zakres recenzji celowo pomija to, co pokrył `verify.md` (bramki, kryteria akceptacji, pomiary) —
tu patrzę na **poprawność kodu, konwencje i uproszczenia** świeżym okiem.

## Ustalenia

### 1. `src/lib/tts.ts:246` — correctness — uchwyty poprzedniej wypowiedzi wiszą na współdzielonym elemencie ✔ **naprawione w recenzji**

Element `<audio>` jest teraz **jeden na całą stronę**, więc `onended`/`onerror` ustawione dla poprzedniej
wypowiedzi zostają na nim aż do nadpisania.

*Scenariusz awarii:* tryb rozmowy, asystent mówi odpowiedź A. Użytkownik przerywa (barge-in) →
`stopSpeaking()` → `stopServerAudio()` robi `removeAttribute("src")` + `load()`. Przeładowanie elementu
**bez źródła** potrafi wyemitować zdarzenie `error`, które trafia w `onerror` **wypowiedzi A** → `done()`
→ `opts.onEnd()` z tamtej wypowiedzi. W trybie rozmowy `onEnd` restartuje nasłuch, więc mikrofon mógłby
ruszyć w momencie, w którym stan mówi co innego.

*Poprawka (naniesiona):* `stopServerAudio()` zeruje `onended`/`onerror` **przed** `pause()`/`load()`.
Nowa wypowiedź i tak ustawia własne uchwyty tuż po tym wywołaniu, a wszystkie `onEnd` w
`AICommandSheet.tsx` (`:432`, `:560`, `:613`) i tak strzegą się stanem (`voiceStateRef.current`), więc
brak wywołania po jawnym zatrzymaniu jest zachowaniem pożądanym, nie regresją.

### 2. `src/app/api/llm/home/agent/route.ts:840,866` — obserwacja (bez zmiany) — w skrajnym przypadku trzy przebiegi pętli

Tura odczytowa ma jednocześnie `baselineMessages` (fallback `dispatch`→`reasoning` z 030) **i**
`noCatalogBaseline` (ścieżka odwrotu z 036). Teoretycznie: przebieg 1 (`dispatch`) → degradacja →
przebieg 2 (`reasoning`) → zwraca `plan` → przebieg 3 (pełny katalog).

*Dlaczego zostaje:* każdy z tych przebiegów wymaga osobnego, rzadkiego warunku (najpierw awaria formatu
lub limit kroków, potem błędna klasyfikacja odczytu jako polecenia zmiany). Wariant alternatywny —
rezygnacja ze ścieżki odwrotu — łamie AC-15. Koszt jest ograniczony (`MAX_ITERATIONS`, budżet dzienny,
`acquireSlot`), a `meta` sumuje wszystkie wywołania, więc użytkownik widzi prawdziwy koszt.

### 3. `src/app/api/llm/home/agent/route.ts:743` — obserwacja (bez zmiany) — „ok" jako odpowiedź na pytanie asystenta

`SMALL_TALK_RE` łapie samotne „ok"/„spoko". Jeśli asystent zada pytanie **w zwykłej odpowiedzi** (nie
przez krok `clarify`), a użytkownik odpowie samym „ok", tura pójdzie bez katalogu akcji.

*Dlaczego to nie jest defekt:* wznowienia po `clarify`/`refine` idą przez `body.messages`, więc
`freshText` jest wtedy pusty i skrót **nie działa** (`:669`) — czyli właściwa ścieżka doprecyzowania
jest bezpieczna. Dla pozostałych przypadków ratuje ścieżka odwrotu (ustalenie 2): koszt to jedno
dodatkowe wywołanie, nigdy błędny wynik.

### 4. `src/lib/tts.ts:283` — obserwacja (bez zmiany) — jeden blob URL może przeżyć odrzucone `play()`

Gdy `audio.play()` zostanie mimo wszystko zablokowane, `catch` zwraca `false` (poprawnie — spadamy na
głos przeglądarki), ale `currentObjectUrl` nadal wskazuje na nieodtworzone nagranie.

*Skutek:* jeden blob (rzędu dziesiątek/setek kB) czeka na zwolnienie. Nie rośnie: `speak()` zawsze
zaczyna od `stopSpeaking()` → `stopServerAudio()` → `releaseObjectUrl()`, więc najbliższa wypowiedź
albo jawne zatrzymanie go zwalnia. Naprawa wymagałaby wyniesienia `url` poza `try` — więcej kodu niż
warta jest korzyść (C-53).

## Sprawdzone i czyste

- **Guard podziału promptu** (`chat.ts:449`) — `stable + variable === system` jest twardym warunkiem;
  gdy trasa doda drugą wiadomość systemową (`toAnthropic` skleja je przez `\n\n`), równość nie
  zachodzi i wracamy do jednego bloku. **Nie da się po cichu podmienić promptu przez błędny split**,
  i nie ma ryzyka wysłania treści dwa razy.
- **Wywołania bez `systemBlocks`** — `toAnthropicSystem(system)` zachowuje się identycznie jak przed
  zmianą (jeden blok z `cache_control`). Pozostałe ścieżki LLM (notatki, kuchnia, magazyn, wizja,
  TTS) nietknięte.
- **C-20 / C-22** — `setFollowupsEnabled` ma `requireAdmin()`, `logAudit` i `revalidatePath`;
  `getFollowupsEnabled` też jest za `requireAdmin()`. Odczyt bez sesji (`lib/ai/followups.ts`) jest
  świadomie osobny, bo woła go trasa agenta — i **nie** przyjmuje żadnego wejścia użytkownika.
- **C-30** — w nowym UI zero hexów: `var(--bg-surface)`, `var(--border)`, `var(--text-primary)`,
  `var(--text-muted)`, `var(--accent-blue)`, `var(--accent-red)`.
- **C-31** — przełącznik ma `py-3` i checkbox 20×20; okno asystenta na `md:` bez zmian
  (`fullScreen` wymaga `matchMedia("(max-width: 767px)")`).
- **C-12** — przełącznik żyje jako `Config.value` typu `String` (`"1"`/`"0"`), bez enuma.
- **C-14** — migracja idempotentna (`ON CONFLICT DO NOTHING`), więc ponowny przebieg nie cofnie
  decyzji administratora.
- **Martwy kod** — usunięty nieużywany import `NAVIGATION_CATALOG` z trasy agenta (pozostałość po
  przeniesieniu promptów w 035). `buildSystemPrompt` zostaje mimo braku wywołań w produkcyjnym kodzie —
  to świadomy „dowód neutralności treści" wymagany przez AC-17, udokumentowany w komentarzu.
- **Bezpieczeństwo** — brak nowych ścieżek renderujących HTML, brak logowania kluczy, brak nowych
  parametrów przyjmowanych od klienta (`includeActions`/`followups` liczy **serwer**, klient nie ma
  na nie wpływu — istotne, bo inaczej dałoby się z zewnątrz wyłączyć katalog akcji).

## Werdykt

**APPROVE Z UWAGAMI.**

Jedno realne ustalenie (stale uchwyty na współdzielonym elemencie audio) naprawione w trakcie recenzji;
pozostałe trzy to świadome, uzasadnione kompromisy, nie defekty. Bramki po poprawce nadal zielone
(`tsc --noEmit`, `next lint` bez nowych ostrzeżeń). Uwaga z `verify.md` §5 (AC-14 — odczyty pamięci
podręcznej zależne od progu dostawcy) pozostaje aktualna i jest jedyną rzeczą, którą warto zweryfikować
na żywych danych po wdrożeniu.
