# Plan techniczny: Asystent — pełny ekran na telefonie, lektor w trybie rozmowy i optymalizacja kosztów

- **Spec:** ./spec.md (036-asystent-pelny-ekran-lektor-i-optymalizacja)
- **Status:** draft
- **Data:** 2026-07-28

> **Zasada planu:** to jest **JAK**. Wzorce: `setCostAlertThreshold`/`setUsdPlnRate` w
> `src/actions/llmConfig.ts` (ustawienie systemowe w `Config` + audyt + `revalidatePath`),
> `READ_INTENT_RE` w `src/lib/ai/fastPath.ts` (lokalny strażnik bez wołania modelu),
> `toAnthropicSystem` w `src/lib/llm/chat.ts` (składanie bloków systemowych).

## 1. Podejście

Trzy rozłączne obszary, robione w kolejności rosnącego ryzyka:
**(A) okno na telefonie** (Z1) — arkusz przypięty do **visual viewport** zamiast `85vh`, pełny ekran
na mobile, desktop bez zmian; **(B) lektor** (Z2) — jeden, „odblokowany" w geście element audio
zamiast tworzenia nowego `Audio()` przy każdej wypowiedzi; **(C) koszty** (Z3) — trzy optymalizacje
z raportu (P1/P2/P4), z których **żadna nie rusza treści promptów**, plus systemowy przełącznik
follow-upów w konfiguracji modeli.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Przełącznik follow-upów to wiersz w istniejącej tabeli `Config` —
dokładnie tak, jak `ai_cost_daily_alert_usd` i `usd_pln_rate`.

- **Migracja (C-10, C-11, C-14):**
  - Numer z `npm run next:migration`: **0214**
  - Katalog: `prisma/migrations/0214_asystent_followups_config/migration.sql`
  - Treść: idempotentny seed wartości startowej, żeby po wdrożeniu zachowanie było **takie jak dziś**
    (AC-22):
    ```sql
    INSERT INTO "Config" ("key","value","updatedAt")
    VALUES ('assistant_followups_enabled','1',CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO NOTHING;
    ```
  - `DO NOTHING`, nie `DO UPDATE` — ponowne uruchomienie migracji nie może cofnąć decyzji admina.
  - Wartość to `"1"`/`"0"` w kolumnie tekstowej (C-12 — żadnych enumów).

## 3. Warstwa serwera (Server Actions — C-20)

`src/actions/llmConfig.ts` (wzorzec 1:1 z `setCostAlertThreshold`):

- `getFollowupsEnabled(): Promise<boolean>` — odczyt `Config`, brak wiersza → `true` (zgodność
  wsteczna). **Wariant bez `requireAdmin`** potrzebny też po stronie agenta → funkcja pomocnicza
  `readFollowupsEnabled()` ląduje w `src/lib/ai/followups.ts` (czysty odczyt `Config`, bez sesji),
  a akcja admina jest jej cienką nakładką z `requireAdmin`.
- `setFollowupsEnabled(enabled: boolean): Promise<void>` — `requireAdmin` → `Config.upsert` →
  `logAudit("config", "assistant_followups.set", …)` (C-25, AC-21) → `revalidatePath("/admin/llm")`.

Manifest `src/lib/ai/action-coverage.json` dostaje wpisy dla obu akcji (`status: excluded`,
`reason: admin`, `access: admin`) — bez tego `check:ai-coverage` wywali build.

## 4. RBAC / rejestr modułu (C-22)

Bez nowego sluga i bez zmian w `modules.tsx`/`ModuleSidebar`. Przełącznik siedzi w `/admin/llm`
(`module.admin`).

## 5. UI (C-30, C-31, C-32)

### 5.1 Okno asystenta na pełny ekran (Z1) — `AICommandSheet.tsx`

Dziś: `fixed inset-0 flex items-end md:items-center` + panel `h-85vh`, `borderRadius: "16px 16px 0 0"`,
uchwyt `md:hidden`, przyciemnione tło z zamykaniem kliknięciem obok.

Zmiana:
- **Nowy hook** `src/hooks/useVisualViewport.ts` — zwraca `{ height, offsetTop }` z
  `window.visualViewport` (nasłuch `resize` + `scroll`, `requestAnimationFrame` na wygładzenie),
  a gdy API nie istnieje → `null` (degradacja do dzisiejszego zachowania, ryzyko z §9).
- **Mobile** (`< md`): overlay bez tła i bez `items-end`; panel `position: fixed`, `left: 0`,
  `width: 100%`, `top: offsetTop`, `height: <visualViewport.height>`, `borderRadius: 0`, bez uchwytu.
  Dzięki temu klawiatura **zmniejsza okno**, zamiast je przesuwać (AC-2, AC-3, AC-4): nagłówek zostaje
  u góry, kompozytor tuż nad klawiaturą, a kurczy się wyłącznie `flex-1 overflow-y-auto` z wiadomościami.
- **Desktop** (`md:`): wszystko po staremu — wyśrodkowany panel `max-w-lg`, `85vh`, przyciemnione tło,
  zamykanie kliknięciem obok (AC-6). Rozróżnienie przez `matchMedia("(min-width: 768px)")` w hooku
  (a nie przez klasy), bo wysokość i pozycję ustawiamy inline.
- Uchwyt (`md:hidden` „pigułka") i zaokrąglenie górnych rogów **znikają na mobile** — zgodnie z decyzją
  właściciela o wzorcu ChatGPT/Claude.
- `env(safe-area-inset-bottom)` w kompozytorze **zostaje bez zmian** (C-31) — przy otwartej klawiaturze
  `visualViewport.height` już uwzględnia klawiaturę, a margines na systemową kreskę jest potrzebny przy
  zamkniętej.

**Kursor (AC-5, AC-7).** Rekonesans potwierdzi to w kodzie, ale stan na dziś: po 034 i 035 w komponencie
**nie ma już żadnego zabiegu na fokusie ani karetce** poza jednym — efekt autofokusu po otwarciu, który
ustawia zaznaczenie na końcu przywróconego brudnopisu (`setSelectionRange(len, len)`); to nie ma
wpływu na pozycję rysowania karetki. Hipoteza przyczyny: `85vh` liczone z **layout viewport**, który
przy klawiaturze się nie kurczy → iOS przewija stronę, żeby odsłonić pole → pole wizualnie jedzie
względem arkusza i karetka „nie trafia". Przypięcie do visual viewport usuwa powód do przewijania.
Weryfikacja obejmuje **wypisanie w `verify.md` pełnej listy** miejsc dotykających fokusu/karetki (AC-7).

### 5.2 Przełącznik follow-upów (Z3) — `LlmConfigPanel.tsx`

Nowa, mała sekcja obok cennika: przełącznik + zdanie wyjaśniające, że propozycje kolejnych pytań
kosztują tokeny przy każdej odpowiedzi (AC-18). Kontrolka `<input type="checkbox">` 20×20 px (C-31),
kolory ze zmiennych CSS, tekst po polsku. Strona `src/app/admin/llm/page.tsx` dociąga wartość i
przekazuje propem.

## 6. Optymalizacja kosztów (Z3) — P1, P2, P4

### 6.1 P1 — pamięć podręczna promptu: podział na część stałą i zmienną

Dziś `toAnthropicSystem` pakuje **cały** prompt w jeden blok z `cache_control: ephemeral`. Prompt
zawiera katalog akcji wybranych modułów, więc prefiks zmienia się między poleceniami (w logach
`5284/0`, choć przy powtórzeniu w tej samej rozmowie bywa `0/10053` — czyli trafia, gdy router wybrał
te same moduły).

Zmiana w `src/lib/llm/chat.ts` + `src/lib/ai/agentPrompt.ts`:
- `buildSystemPrompt` zwraca **dwie części**: `stable` (protokół + zasady + katalog nawigacji —
  ~9,6 tys. znaków identycznych przy każdym wywołaniu) i `variable` (katalog narzędzi odczytu +
  katalog akcji wybranych modułów). Dotychczasowa funkcja zostaje jako `buildSystemPrompt()` zwracająca
  `stable + variable` (zgodność i **dowód neutralności treści** — AC-17).
- `ChatOptions` zyskuje opcjonalne `systemBlocks?: { stable: string; variable: string }`; gdy podane,
  `toAnthropicSystem` buduje **dwa** bloki tekstu, `cache_control` **tylko na pierwszym** (stałym).
  Dla pozostałych wywołań (bez `systemBlocks`) zachowanie bez zmian.
- **Uwaga o kolejności:** blok stały musi iść **pierwszy**, bo pamięć podręczna działa na prefiksie.
  Dziś kolejność w prompcie to `zasady → narzędzia → akcje → nawigacja → …`; podział wymaga
  **przestawienia** nawigacji do części stałej. To **zmiana kolejności bloków, nie treści** —
  AC-17 mówi o identyczności *zasad zachowania*, więc weryfikacja porówna zbiór bloków, a nie ich
  kolejność, i odnotuje to wprost. **(C-54: to ustalenie planu, nieprzewidziane w specu — zapisane tutaj.)**

### 6.2 P2 — zwykła uprzejmość bez klasyfikatora i routera

`src/lib/ai/fastPath.ts` — obok `READ_INTENT_RE` nowy `SMALL_TALK_RE`, dopasowujący **całą**
wiadomość (kotwice `^…$`), bez żadnej dodatkowej treści:
```
/^\s*(hej|cześć|czesc|siema|witaj|dzień dobry|dobry wieczór|hello|hi|yo|dzięki|dzieki|dziękuję|dziekuje|ok|okej|spoko|pa|do zobaczenia|dobranoc)[\s!.,…]*$/i
```
Kotwica `$` jest kluczowa: „cześć, dodaj mleko" **nie** pasuje (AC-16).

`src/app/api/llm/home/agent/route.ts`: gdy `SMALL_TALK_RE` pasuje → pomijamy `classifyIntent`
**i** `routeModules`, wchodzimy prosto w pętlę agenta z **pustą listą modułów** (czyli bez katalogu
akcji — patrz P4). Oszczędność: 2 wywołania modelu (~1748 tokenów, AC-12, AC-13).

### 6.3 P4 — katalog akcji tylko wtedy, gdy może być potrzebny

Klasyfikator i router już „wiedzą", że polecenie jest rozmową — ta wiedza była wyrzucana.
- `buildSystemPrompt(modules, { includeActions })` — przy `includeActions: false` część zmienna
  zawiera **tylko katalog narzędzi odczytu**, bez katalogu akcji zapisu (~1099 tok.) i bez katalogu
  nawigacji (~355 tok.).
- Włączamy to dla `SMALL_TALK_RE` (P2) oraz gdy `READ_INTENT_RE` uznał polecenie za czysty odczyt.
- **Ścieżka odwrotu (AC-15):** gdy agent mimo to zwróci `step: "plan"` (czyli jednak chce akcji),
  route **ponawia** przebieg z pełnym katalogiem. Kosztuje jedno dodatkowe wywołanie w rzadkim
  przypadku, a chroni przed „asystent nie potrafi już nic zrobić".
- Prompt informuje o braku katalogu **tym samym zdaniem, które już w nim jest** („Twórz akcje tylko
  dla modułów, których katalog masz wyżej: …") — przy pustej liście modułów brzmi ono naturalnie, więc
  **nie dopisujemy nowej treści** (AC-17).

### 6.4 Follow-upy sterowane konfiguracją

- `buildSystemPrompt(..., { followups })` — gdy wyłączone, fragment o `followups` **znika** z opisu
  kroku `answer`. To jedyna dopuszczona zmiana treści promptu, bo **wynika wprost ze zgłoszenia**
  (Z3) i jest sterowana przełącznikiem; AC-17 dotyczy zasad zachowania, nie tej opcji — odnotowane.
- Wartość czytana raz na żądanie w `POST` (`readFollowupsEnabled()`), przekazywana do budowania promptu.
- Dodatkowo **klient**: `followups` z odpowiedzi renderujemy jak dziś — gdy prompt ich nie zamawia,
  model ich nie zwraca, więc UI nie wymaga zmian (AC-19).
- **Uwaga na P1:** przełącznik zmienia część **stałą** promptu, ale zmienia się tylko przy edycji
  ustawienia — prefiks pozostaje stabilny między wywołaniami, więc pamięć podręczna nadal działa.

## 7. Lektor w trybie rozmowy (Z2) — `src/lib/tts.ts`

**Przyczyna:** `speakViaServer` tworzy `new Audio(url)` i woła `play()` **po** zakończeniu `fetch`.
Na iOS odtwarzanie wymaga aktywacji użytkownika: przy przycisku „czytaj" gest jest tuż obok, więc
przechodzi; w trybie rozmowy mowa startuje długo po ostatnim geście → `play()` jest odrzucane →
`catch` zwraca `false` → ciche zejście na głos przeglądarki (dokładnie objaw ze zgłoszenia).

Rozwiązanie (standardowy wzorzec „odblokowanego" elementu):
- Moduł trzyma **jeden** trwały `HTMLAudioElement` (`unlockedAudio`), tworzony leniwie.
- Nowa eksportowana funkcja `primeSpeechPlayback()` — wołana **synchronicznie w geście** startu trybu
  rozmowy (przycisk mikrofonu w `AICommandSheet`): ustawia krótki, cichy dźwięk (data-URI), woła
  `play()` i natychmiast `pause()`. Od tej chwili element jest „odblokowany" i wolno mu grać później.
- `speakViaServer` odtwarza na **tym samym** elemencie (`audio.src = url; audio.play()`), zamiast
  tworzyć nowy — dzięki temu każda kolejna wypowiedź w sesji też przechodzi (AC-9).
- `stopServerAudio` zatrzymuje i zwalnia `objectURL` bez niszczenia elementu (AC-11).
- Gdy `play()` mimo wszystko odrzuci — bez zmian: `false` → głos przeglądarki (AC-10).

## 8. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/hooks/useVisualViewport.ts` | **nowy** | wysokość i przesunięcie widocznego obszaru (klawiatura) |
| `src/components/home/AICommandSheet.tsx` | edycja | pełny ekran na mobile, przypięcie do visual viewport, `primeSpeechPlayback()` w geście |
| `src/lib/tts.ts` | edycja | jeden odblokowany element audio + `primeSpeechPlayback` |
| `src/lib/ai/agentPrompt.ts` | edycja | podział promptu na część stałą i zmienną, opcje `includeActions`/`followups` |
| `src/lib/llm/chat.ts` | edycja | `systemBlocks` + `cache_control` tylko na bloku stałym |
| `src/lib/ai/fastPath.ts` | edycja | `SMALL_TALK_RE` |
| `src/app/api/llm/home/agent/route.ts` | edycja | pominięcie wywołań przy uprzejmości, katalog akcji warunkowo, ścieżka odwrotu, odczyt follow-upów |
| `src/lib/ai/followups.ts` | **nowy** | odczyt ustawienia bez sesji (dla agenta) |
| `src/actions/llmConfig.ts` | edycja | `getFollowupsEnabled` / `setFollowupsEnabled` + audyt |
| `src/components/admin/LlmConfigPanel.tsx` | edycja | przełącznik follow-upów |
| `src/app/admin/llm/page.tsx` | edycja | dociągnięcie wartości |
| `src/lib/ai/action-coverage.json` | edycja | wpisy dla nowych akcji |
| `prisma/migrations/0214_asystent_followups_config/migration.sql` | **nowy** | wartość startowa ustawienia |
| `doświadczenia.md`, `CLAUDE.md` | edycja | lekcje + opis przełącznika i podziału promptu |

## 9. Bramki i weryfikacja (C-50)

- Lokalny Postgres + `npx prisma migrate deploy` (C-13 — nigdy prod DB); sprawdzenie wiersza `Config`
  i idempotentności.
- `npm run check:migrations`, `npm run check:actions`, `npm run check:ai-coverage`, `next lint`,
  `next build`.
- Mapowanie AC: AC-1…AC-4, AC-6 → inspekcja układu + logiki hooka; AC-5, AC-7 → **wypisanie w
  `verify.md` listy wszystkich miejsc dotykających fokusu/karetki** (odpowiedź dla właściciela);
  AC-8…AC-11 → prześledzenie ścieżki odtwarzania + potwierdzenie, że `speakViaServer` nie tworzy
  nowego elementu; AC-12, AC-13 → skrypt liczący tokeny dla „cześć" przed i po (ten sam warsztat co
  w 035); AC-14 → analiza podziału bloków + weryfikacja, że prefiks stały nie zależy od modułów;
  AC-15, AC-16 → prześledzenie ścieżki odwrotu i testy `SMALL_TALK_RE` na zestawie zdań;
  AC-17 → **porównanie treści** promptu przed/po (zbiór bloków), jak w 035; AC-18…AC-22 → migracja na
  lokalnej bazie + odczyt wartości + wpis w `AuditLog`.

## 10. Ryzyka techniczne i plan wycofania

- **Visual viewport bywa kapryśny** (migotanie, „uciekające" okno przy przewijaniu strony pod spodem).
  → Wartości czytamy przez `requestAnimationFrame`, a brak API = dzisiejsze zachowanie. Desktop
  całkowicie nietknięty, więc awaria dotyczy wyłącznie telefonu.
- **`SMALL_TALK_RE` za szeroki** → przechwyciłby prawdziwe polecenie. Mitygacja: kotwice `^…$`,
  zamknięta lista słów, test na zestawie zdań w weryfikacji (AC-16).
- **Ścieżka odwrotu przy P4** może podwoić koszt rzadkiego przypadku. → Uruchamia się tylko, gdy agent
  zwróci `plan` mimo braku katalogu; przy poleceniach rozmownych to nie powinno się zdarzać.
- **Podział pamięci podręcznej może pogorszyć trafialność**, jeśli blok stały okaże się niestabilny
  (np. przez przełącznik follow-upów zmieniany w trakcie). → AC-14 wymaga **zmierzonych odczytów**;
  gdyby wyszło gorzej, wycofanie to jeden warunek w `toAnthropicSystem`.
- **Kolejność bloków w prompcie się zmienia** (nawigacja wędruje do części stałej). → Odnotowane w
  §6.1 jako świadome; weryfikacja porównuje **zbiór** bloków, nie kolejność, i mówi o tym wprost.
- Rollback: zmiany UI i LLM cofalne commitem; migracja dodaje jeden wiersz `Config` — jej wycofanie to
  `DELETE FROM "Config" WHERE key = 'assistant_followups_enabled'`.

## 11. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — jedna idempotentna migracja (`DO NOTHING`), wartość jako tekst, bez enumów,
      weryfikacja na lokalnym Postgresie.
- [x] **C-20, C-25** — zapis ustawienia Server Action z `revalidatePath` + wpis w `AuditLog`.
- [x] **C-22** — bez nowego sluga; przełącznik pod `module.admin`.
- [x] **C-23** — brak nowych `AIAction`; katalog akcji nadal spójny z egzekutorem (bramka pilnuje).
- [x] **C-30..C-32** — zmienne CSS, mobile-first (pełny ekran, safe-area, cele dotyku), teksty PL.
- [x] **C-40** — dobór modeli nadal po stronie konfiguracji.
- [x] **C-53** — korzystamy z istniejących wzorców (`Config` + audyt, strażnik lokalny, jeden element
      audio) zamiast nowych bytów; zero nowych zależności.
- [x] **C-54** — dwa ustalenia planu nieprzewidziane w specu (zmiana kolejności bloków promptu;
      warunkowy fragment o follow-upach jako jedyna dopuszczona zmiana treści) zapisane w §6.1 i §6.4.
