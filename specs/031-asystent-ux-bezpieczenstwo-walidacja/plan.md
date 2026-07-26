# Plan techniczny: Asystent AI — czytelność, bezpieczeństwo i wymuszona walidacja akcji

- **Spec:** ./spec.md (031-asystent-ux-bezpieczenstwo-walidacja)
- **Status:** draft
- **Data:** 2026-07-25

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście

Sercem zmiany jest **jeden kontrakt akcji** (`src/lib/ai/actionContract.ts`) — rejestr opisujący
każdy typ `AIAction` (dziś 159 typów): polską etykietę akcji, polskie etykiety parametrów, rodzaj
kontrolki, słownik wartości technicznych → widocznych oraz reguły walidacji. Ten sam rejestr zasila
`ActionDrawer` (prezentacja + kontrolki), egzekutor (walidacja serwerowa w jednym choke-poincie
`executeAction`) i humanizację odpowiedzi. Wzorcem dla **bramek** są istniejące skrypty
`scripts/check-action-coverage.js` (spójność katalog↔egzekutor) i `scripts/check-ai-coverage.js`
(manifest `action-coverage.json` z klasyfikacją każdej Server Action) — rozszerzamy je zamiast
tworzyć nową infrastrukturę: kontrakt dopisujemy do pierwszej bramki, deklarację kontroli dostępu
(pole `access`) do manifestu drugiej. Wzorcem dla nowego modelu ustawień jest `DashboardPref`
(per-user, `userId @unique`, akcje z `revalidatePath`). Reszta to punktowe poprawki UI w
`AICommandSheet.tsx` / `ActionDrawer.tsx` oraz nowa, opcjonalna serwerowa synteza mowy wpięta w
istniejący, DB-driven model konfiguracji LLM (C-40).

Kolejność prac: **A. Kontrakt + humanizacja** → **B. Bramki i audyt dostępu** → **C. Ustawienia
użytkownika (model + akcje)** → **D. UI asystenta** → **E. Skrzynka zgłoszeń** → **F. Serwerowe TTS**.

## 2. Model danych (Prisma)

### 2.1 Nowy model `AssistantPref` (per użytkownik — wzorzec `DashboardPref`)

```prisma
model AssistantPref {
  id           String   @id @default(cuid())
  userId       String   @unique
  instructions String   @default("")   // stałe preferencje („custom instructions")
  level        String   @default("standard") // AssistantLevel: "standard" | "economy" (C-12: String + union TS)
  voiceKind    String   @default("browser")  // AssistantVoiceKind: "browser" | "server"
  voiceId      String?                        // id głosu serwerowego (dla voiceKind="server")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation("UserAssistantPref", fields: [userId], references: [id], onDelete: Cascade)
}
```

- W `model User` dochodzi `assistantPref AssistantPref? @relation("UserAssistantPref")`.
- Typy TS (**bez enumów Prisma**, C-12) w `src/types/index.ts`:
  `export type AssistantLevel = "standard" | "economy"`,
  `export type AssistantVoiceKind = "browser" | "server"`.
- Wybór głosu **systemowego** (przeglądarki) zostaje w `localStorage` (jest specyficzny dla
  urządzenia — tak stanowi spec, pkt 8 „Założenia"); w bazie trzymamy tylko wybór głosu serwerowego.

### 2.2 Konfiguracja systemowa (bez nowego modelu)

- `Config.feedback_project_id` — id projektu-skrzynki zgłoszeń (klucz jawny, **nie** sekret; brak
  wpisu = zachowanie dotychczasowe: projekt „Omnia" administratora).
- Serwerowe TTS korzysta z istniejących `LlmProvider` + `LlmAssignment` — dochodzi **nowy typ
  operacji** `speech` (patrz pkt 6.4). To tylko nowy wiersz w `LlmAssignment`, **bez zmian
  schematu**.

### 2.3 Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **0209**
- Katalog: `prisma/migrations/0209_assistant_pref/migration.sql`
- Szkic DDL (idempotentnie):

```sql
CREATE TABLE IF NOT EXISTS "AssistantPref" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "instructions" TEXT NOT NULL DEFAULT '',
  "level"        TEXT NOT NULL DEFAULT 'standard',
  "voiceKind"    TEXT NOT NULL DEFAULT 'browser',
  "voiceId"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssistantPref_userId_key" ON "AssistantPref"("userId");
ALTER TABLE "AssistantPref" DROP CONSTRAINT IF EXISTS "AssistantPref_userId_fkey";
ALTER TABLE "AssistantPref" ADD CONSTRAINT "AssistantPref_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- **Bez migracji danych** dla dotychczasowych preferencji z `localStorage`: przy pierwszym otwarciu
  ustawień klient, jeśli baza jest pusta a `localStorage` ma treść, jednorazowo ją wysyła i czyści
  klucz lokalny (jednorazowy „upgrade" bez utraty tego, co użytkownik już wpisał).

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 `src/actions/assistantPrefs.ts` (nowy)

| Funkcja | Rola | Guard | `revalidatePath` |
|---|---|---|---|
| `getAssistantPrefs()` | odczyt preferencji zalogowanego użytkownika (tworzy domyślne w locie, bez zapisu) | `requireAuth()` — zakres wyłącznie własny (`access: "self"`) | — (odczyt) |
| `updateAssistantPrefs(input)` | zapis instrukcji / poziomu / głosu serwerowego | `requireAuth()` + zapis **tylko** po `userId` z sesji | `revalidatePath("/")` |

`input` waliduje `level ∈ AssistantLevel`, `voiceKind ∈ AssistantVoiceKind`, `instructions` do 2000
znaków; niepoprawne wartości → błąd z polskim komunikatem.

### 3.2 `src/actions/feedback.ts` (nowy — skrzynka zgłoszeń)

| Funkcja | Rola | Guard |
|---|---|---|
| `submitFeedbackTask({ title, description })` | **jedyna** droga zapisu zgłoszenia do skrzynki; sam wyznacza projekt docelowy (`Config.feedback_project_id` → fallback: projekt „Omnia" admina) i tworzy zadanie z pominięciem zwykłego guardu projektu | `requireAuth()`; wyjątek jest **wąski**: tylko `create`, tylko do wyznaczonego projektu, tytuł/opis obcinane do limitów; `access: "open"` z uzasadnieniem w manifeście |
| `getFeedbackInboxInfo()` | zwraca `{ projectId, canRead }` — czy zalogowany użytkownik może zobaczyć skrzynkę (właściciel / członek / zespół / admin) | `requireAuth()`; sprawdzenie dostępu przez istniejący `assertProjectAccess` (złapane w `try`) |

- `revalidatePath("/tasks")` po utworzeniu zgłoszenia.
- Klient (`AICommandSheet`, `FeedbackInspector`) przestaje wołać `ensureOmniaProject()` +
  `createTask()` i woła `submitFeedbackTask()`. `ensureOmniaProject()` zostaje jako helper
  administratora (tworzenie skrzynki), używany po stronie serwera w fallbacku.
- **Korekta planu (C-54, odkryte w trakcie implementacji):** panel „Zgłoś problem z Asystentem AI"
  woła akcję serwerową bezpośrednio, ale **główny robaczek** (tryb wskazywania elementu) tworzy
  zgłoszenie **przez agenta** — prompt każe mu zaproponować `create_task` z
  `params.projectName="Omnia"`, co dla zwykłego użytkownika kończy się utworzeniem *własnego*
  projektu „Omnia" (zgłoszenie nigdy nie dociera do admina) albo odmową dostępu. Dlatego dokładamy
  **nowy typ akcji `submit_feedback`** (moduł `tasks`), którego egzekutor woła `submitFeedbackTask()`.
  Tryb zgłoszeniowy proponuje **tę** akcję zamiast `create_task`; wyjątek dostępowy zostaje w jednym
  miejscu (jedna akcja serwerowa), a recenzja w `ActionDrawer` działa jak dotąd. Wymaga: wpisu w
  katalogu agenta, egzekutora (bramka C-23) i wpisu w kontrakcie akcji.
- **AC-21**: odczyt zadań skrzynki nadal idzie przez `assertProjectAccess` — wyjątek nie dotyka
  ścieżek odczytu ani read-toolów asystenta.

### 3.3 Kontrola dostępu w egzekutorze akcji

`src/app/api/llm/home/execute/route.ts` — w `executeAction` **przed** rozgałęzieniem na moduł:

1. `assertActionContract(action)` — typ musi istnieć w kontrakcie (inaczej `Nieznana akcja`),
2. `validateActionParams(action)` — reguły z kontraktu; naruszenie → `ActionResult.success=false`
   z polskim komunikatem wskazującym pole i regułę (AC-26),
3. wykonanie przez istniejące egzekutory → istniejące guardy modułów (C-21),
4. mapowanie wyjątku dostępu na jednolity komunikat `Nie masz dostępu do tych danych.` (bez
   ujawniania treści cudzych rekordów — AC-24); mapowanie w `src/lib/ai/executors/shared.ts`
   (`toAccessError`).

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowych slugów** `module.*` i bez nowego modułu w `modules.tsx` / `ModuleSidebar`.
- Wykorzystujemy istniejące: `PERMISSIONS.ADMIN` (techniczny log rozumowania, konfiguracja),
  `module.tasks` (dostęp do skrzynki zgłoszeń przy „Otwórz w zadaniach").
- Wyjątek zapisu do skrzynki jest **kodowy i wąski** (pkt 3.2), nie nowe uprawnienie — dzięki temu
  nie da się go przypadkiem rozszerzyć przez panel RBAC.
- Zmiana `Config.feedback_project_id` trafia do `AuditLog` automatycznie (`setConfigValue` już
  loguje — C-25).

## 5. UI (C-30, C-31, C-32)

Wszystkie kolory z `var(--*)`, teksty po polsku, brak nowych tras.

### 5.1 `src/components/home/ActionDrawer.tsx`

- **AC-7 (wyrównanie):** kontener pozycji zostaje `align-items: flex-start`, ale przycisk wyboru
  dostaje `height: 20; display:flex; align-items:center` równy wysokości wiersza nagłówka
  (ikona modułu 15px + etykieta), zamiast `marginTop: 1`. Cel dotyku ≥20×20 px (C-31).
- **AC-5 (nazwy):** `action.type` w monospace znika z widoku użytkownika; zamiast niego etykieta z
  kontraktu (`contract.label`, np. „Dodaj zadanie"). Techniczny typ pokazujemy **tylko** dla admina
  (`isAdmin` przekazany z `AICommandSheet`) — diagnostyka nie ginie.
- **AC-5/AC-6 (parametry):** render pól przez kontrakt:
  - `control: "hidden"` (identyfikatory, pola techniczne) → w ogóle nie renderujemy, wartość
    przechodzi bez zmian do egzekutora (dotychczasowa heurystyka `ID_KEY` zostaje jako domyślna dla
    pól nieopisanych),
  - `"select"` → `<select>` z `options` (wartość techniczna w `value`, polska etykieta w treści),
  - `"date"`/`"datetime"` → istniejąca logika pickerów (zostaje),
  - `"number"` → `<input type="number">` z `min`/`max`,
  - `"boolean"` → przełącznik tak/nie,
  - `"text"`/`"textarea"` → jak dziś, z etykietą z kontraktu zamiast surowego klucza.
- **Walidacja na froncie (AC-27):** ten sam `validateActionParams` uruchamiany przy edycji; błędne
  pole dostaje obramowanie `var(--accent-red)` i komunikat, a przycisk „Wykonaj" jest zablokowany.
- `searchQuery` dostaje etykietę „Szukana nazwa" (dziś: monospace `searchQuery`).

### 5.2 `src/components/home/AICommandSheet.tsx`

- **AC-2/AC-3/AC-4 (log rozumowania):**
  - na żywo (`liveThoughts`) renderujemy **tylko ostatnią** myśl (jeden wiersz zastępowany kolejnym),
  - `ReasoningLog` po zakończeniu: zamiast listy myśli — zwinięty przełącznik
    „Pokaż log rozumowania" → lista myśli przepuszczonych przez `humanizeAssistantText`,
  - dotychczasowy surowy `<pre>` (JSON narzędzi/wyników) chowamy za drugim przełącznikiem
    „Pokaż techniczny log rozumowania (admin)", renderowanym **tylko** gdy `isAdmin`
    (`ReasoningLog` dostaje prop `isAdmin`).
- **AC-8 (stopka):** `CopyButton` / `SpeakButton` / „Ponów" tracą etykiety tekstowe, zostają same
  ikony z `title` + `aria-label`; kolejność w JSX: **odczytaj na głos → kopiuj → ponów**. Stan
  „Skopiowano" sygnalizuje ikona `Check` + zmiana `title`.
- **AC-9 (mobile):** wiersz historii rozmów — `minWidth: 0` na kontenerze `div` i na przycisku
  tytułu (klasyczna przyczyna wychodzenia flexboxa poza ekran), `overflow: hidden` + istniejący
  `text-overflow: ellipsis`. Dodatkowo `overflow-wrap: anywhere` na tytule.
- **AC-10 (skrót):** pod kompozytorem dyskretna podpowiedź `var(--text-muted)`, 10.5 px:
  „Ctrl+Enter wysyła" — widoczna na `md:` (desktop) i po fokusie pola; na telefonie ukryta
  (`hidden md:block`), bo skrót nie ma tam zastosowania i zabiera miejsce.
- **AC-11/AC-12/AC-13 (ustawienia + przełącznik):**
  - panel ustawień czyta/zapisuje przez `getAssistantPrefs`/`updateAssistantPrefs` (debounce 600 ms),
    tekst „Zapisywane na tym urządzeniu." → „Zapisywane na Twoim koncie — widoczne na każdym
    urządzeniu.",
  - w kompozytorze, w prawej grupie **na lewo od mikrofonu**, przełącznik poziomu: ikona
    `Gauge`/`Zap` + menu z dwiema opcjami „Standardowy" (opis: „modele wg ustawień administratora")
    i „Oszczędny" (opis: „najprostszy, najtańszy model do wszystkiego"); wybór zapisywany
    natychmiast do bazy, aktywny tryb oszczędny podświetlony `var(--accent-amber)`.
- **AC-15..AC-18 (głosy):** lista głosów = głosy serwerowe (jeśli skonfigurowane) + **przefiltrowane**
  głosy przeglądarki; przycisk „Posłuchaj próbki" przy wybranym głosie; komunikat, gdy głosów brak.

### 5.3 `src/components/shell/FeedbackInspector.tsx` / `AICommandSheet` — zgłoszenia

- **AC-19/AC-20:** po `submitFeedbackTask()` klient sprawdza `canRead` z `getFeedbackInboxInfo()`;
  przycisk „Otwórz w zadaniach" renderujemy **tylko** gdy `canRead === true`. W przeciwnym razie sam
  komunikat: „Dziękujemy — zgłoszenie trafiło do administratora."

### 5.4 `src/app/admin/config/AdminConfigForm.tsx`

- Nowe pole `configKey="feedback_project_id"` z etykietą „Projekt-skrzynka zgłoszeń (id)" i opisem,
  że puste = projekt „Omnia" administratora.

## 6. AI / integracje (C-23, C-40)

### 6.1 Kontrakt akcji — `src/lib/ai/actionContract.ts` (nowy)

```ts
export type FieldControl = "text" | "textarea" | "select" | "date" | "datetime" | "number" | "boolean" | "hidden";

export interface FieldSpec {
  label: string;                 // PL, np. „Priorytet"
  control: FieldControl;
  options?: { value: string; label: string }[]; // techniczne → widoczne (np. MEDIUM → „Średni")
  required?: boolean;
  min?: number; max?: number; maxLength?: number;
}

export interface ActionContract {
  label: string;                 // PL, np. „Dodaj zadanie"
  fields?: Record<string, FieldSpec>; // tylko pola wymagające opisu; reszta → PARAM_LABELS + text
}

export const ACTION_CONTRACTS: Record<string, ActionContract>;
export const PARAM_LABELS: Record<string, string>;      // wspólny słownik (title→„Tytuł", dueDate→„Termin"…)
export function fieldSpec(type: string, key: string): FieldSpec;          // z fallbackiem
export function validateActionParams(action: AIAction): string[];         // [] = OK, inaczej komunikaty PL
export function actionLabel(action: AIAction): string;
```

- **Zero nowych zależności.** Słowniki wartości bierzemy z istniejących map:
  `TASK_STATUS_LABELS`, `TASK_PRIORITY_LABELS` (`src/types`), etykiety modułowe (pets, services,
  warsztaty) — kontrakt je **re-eksportuje**, nie duplikuje (C-53).
- 159 typów: pełne opisy pól piszemy dla typów z polami enum/liczbowymi/logicznymi; pozostałe
  dostają `label` + domyślne mapowanie z `PARAM_LABELS`. Bramka wymaga **co najmniej `label`**.

### 6.2 Humanizacja odpowiedzi — `src/lib/ai/humanize.ts` (nowy)

- `humanizeAssistantText(text: string): string` — zamienia znane tokeny techniczne na etykiety
  (`TODO`→„Do zrobienia", `NONE`→„Brak", `MEDIUM`→„Średni"…) i usuwa gołe identyfikatory
  (`/\b[a-z0-9]{25,}\b/` — format cuid) razem z osieroconymi nawiasami.
- Wołany w **jednym choke-poincie** w `src/app/api/llm/home/agent/route.ts` — na tekście kroków
  `answer`/`report`/`clarify` tuż przed wysłaniem do klienta (lekcja z `doświadczenia.md`
  2026-07-25: „nie zostawiaj tego na łasce modelu — wymuś deterministycznie").
- Dodatkowo prompt agenta dostaje krótką regułę „nie cytuj identyfikatorów ani wartości
  technicznych" (tania profilaktyka, sanitizer jest domknięciem).
- Read-toole w `agentTools.ts`: pola statusów/priorytetów zwracamy **już z etykietą**
  (`status: "Do zrobienia"`), identyfikatory zostają (agent ich potrzebuje do akcji) — sanitizer
  zdejmuje je z tekstu odpowiedzi.

### 6.3 Tryb oszczędny (AC-14)

- `src/lib/llm/operationTypes.ts`: helper `effectiveOperation(op, level)` →
  `level === "economy" ? "dispatch" : op`.
- Wpięcie w miejscach, gdzie asystent woła model: `agent/route.ts` (pętla agenta),
  `fastPath.ts`, `briefing`. Poziom czytamy raz na żądanie z `AssistantPref` (jeden `findUnique`).
- **Brak hardcodowania modelu** — tryb oszczędny wybiera *typ operacji*, model dalej rozstrzyga
  admin w `/admin/llm` (C-40).

### 6.4 Serwerowa synteza mowy (AC-16, AC-17, AC-18)

- Nowy typ operacji `speech` w `OPERATION_TYPES` + `OPERATION_TYPE_META` (etykieta „Synteza mowy
  (lektor)"); `defaultModel` pusty → **brak przypisania = funkcja wyłączona** (AC-17).
- `src/lib/tts/serverTts.ts` — `synthesizeSpeech({ text, voiceId })`: rozwiązuje dostawcę przez
  `resolveLlmChain("speech")` (klucz odszyfrowany, C-41), woła endpoint audio dostawcy
  (OpenAI-compatible `/audio/speech`), zwraca `ArrayBuffer` (mp3). Limit `text` do 1200 znaków
  (ochrona kosztów), brak trwałego zapisu audio.
- `src/lib/tts/serverVoices.ts` — katalog głosów z polskimi opisami
  (`{ id, label, description }`), używany przez listę wyboru.
- `src/app/api/tts/route.ts` — `POST { text, voiceId }`; wymaga sesji, korzysta z istniejącego
  `src/lib/ai/rateLimit.ts` (ten sam wzorzec limitu per użytkownik), zwraca `audio/mpeg`. Brak
  konfiguracji → `501` + klient płynnie wraca do głosów przeglądarki.
- `src/lib/tts.ts` — `speak()` rozgałęzia się: głos serwerowy → `fetch("/api/tts")` + `Audio`;
  brak/awaria → dotychczasowa ścieżka Web Speech. `stopSpeaking()` zatrzymuje obie ścieżki.
- **Naprawa listy głosów przeglądarki (AC-15):** `getAvailableVoices()` przestaje zwracać surową
  listę — (a) czeka na `voiceschanged` i **sumuje** kolejne odczyty zamiast je zastępować (stąd
  „znikanie" głosów), (b) odsiewa duplikaty po `voiceURI`, (c) odsiewa głosy zdalne
  (`localService === false`) na platformach, gdzie nie dają dźwięku, (d) sortuje: polskie najpierw.

### 6.5 Bramki (C-23 + nowa)

1. `scripts/check-action-coverage.js` — **rozszerzenie**: każdy typ akcji z katalogu musi mieć wpis
   w `ACTION_CONTRACTS` (parsowanie statyczne kluczy rejestru). Brak → build pada z instrukcją,
   gdzie dopisać wpis.
2. `scripts/check-ai-coverage.js` — **rozszerzenie o kontrolę dostępu (AC-28)**:
   - każdy wpis w `src/lib/ai/action-coverage.json` musi mieć pole
     `"access": "owner" | "self" | "admin" | "open" | "internal"`,
   - `"open"` wymaga dodatkowo `"accessReason"` (świadome odstępstwo, np. skrzynka zgłoszeń),
   - **heurystyka na kodzie** (nie sama deklaracja): ciało akcji musi zawierać wywołanie guardu
     (`requireAuth|requireAdmin|assert\w+Access|getUserScope|getUserTeamIds|auth\(\)`); brak przy
     `access ≠ "open"` → build pada. To odpowiedź na ryzyko „fałszywego poczucia bezpieczeństwa"
     ze speca,
   - `--report` dopisuje `docs/ai/kontrola-dostepu.md` (tabela per moduł).
3. Obie bramki są już wpięte w `build` — nie zmieniamy `package.json` poza dodaniem skrótu
   `check:access` (alias na `check:ai-coverage`) dla wygody.

### 6.6 Audyt istniejących akcji (AC-29)

Przechodzimy przez wszystkie akcje w `src/actions/*` (dziś ~600 funkcji w manifeście), nadając
`access` i weryfikując faktyczny guard. Miejsca z realnym brakiem sprawdzenia **poprawiamy**
(dodanie `requireAuth`/`assert…Access` wg wzorca modułu). Ustalenia lądują w
`docs/ai/kontrola-dostepu.md` (generowane) + krótkie podsumowanie w `doświadczenia.md` (C-51).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | model `AssistantPref` + relacja w `User` |
| `prisma/migrations/0209_assistant_pref/migration.sql` | nowy | tabela `AssistantPref` (C-10) |
| `src/types/index.ts` | edycja | `AssistantLevel`, `AssistantVoiceKind` (C-12) |
| `src/actions/assistantPrefs.ts` | nowy | odczyt/zapis preferencji asystenta (C-20) |
| `src/actions/feedback.ts` | nowy | `submitFeedbackTask`, `getFeedbackInboxInfo` |
| `src/actions/taskProjects.ts` | edycja | `ensureOmniaProject` → helper serwerowy skrzynki |
| `src/lib/ai/actionContract.ts` | nowy | kontrakt akcji: etykiety, kontrolki, słowniki, walidacja |
| `src/lib/ai/humanize.ts` | nowy | deterministyczna humanizacja tekstu odpowiedzi i myśli |
| `src/lib/ai/action-coverage.json` | edycja | pole `access` (+ `accessReason`) dla każdego wpisu |
| `src/lib/ai/agentTools.ts` | edycja | etykiety zamiast wartości technicznych w wynikach odczytu |
| `src/lib/ai/executors/shared.ts` | edycja | `toAccessError` — jednolity komunikat braku dostępu |
| `src/app/api/llm/home/execute/route.ts` | edycja | kontrakt + walidacja + mapowanie odmowy (choke point) |
| `src/app/api/llm/home/agent/route.ts` | edycja | humanizacja wyjścia, reguła w promptcie, tryb oszczędny |
| `src/lib/ai/fastPath.ts` | edycja | tryb oszczędny |
| `src/lib/llm/operationTypes.ts` | edycja | typ operacji `speech` + `effectiveOperation()` |
| `src/lib/tts/serverTts.ts` | nowy | synteza mowy u dostawcy (C-40, C-41) |
| `src/lib/tts/serverVoices.ts` | nowy | katalog głosów serwerowych (PL) |
| `src/app/api/tts/route.ts` | nowy | endpoint syntezy (sesja + limit) |
| `src/lib/tts.ts` | edycja | rozgałęzienie serwer/przeglądarka + naprawa listy głosów |
| `src/components/home/ActionDrawer.tsx` | edycja | wyrównanie, etykiety, kontrolki, walidacja |
| `src/components/home/AICommandSheet.tsx` | edycja | log rozumowania, stopka, mobile, skrót, ustawienia, przełącznik, głosy, zgłoszenia |
| `src/components/shell/FeedbackInspector.tsx` | edycja | zgłoszenie przez `submitFeedbackTask` |
| `src/app/admin/config/AdminConfigForm.tsx` + `page.tsx` | edycja | klucz `feedback_project_id` |
| `src/app/admin/llm/*` | edycja | obsługa nowego typu operacji `speech` (lista typów) |
| `scripts/check-action-coverage.js` | edycja | bramka: każdy typ akcji ma kontrakt |
| `scripts/check-ai-coverage.js` | edycja | bramka: `access` + heurystyka guardu (AC-28) |
| `package.json` | edycja | skrót `check:access` |
| `docs/ai/kontrola-dostepu.md` | generowany | raport audytu dostępu (AC-29) |
| `doświadczenia.md` | edycja | lekcje z tej paczki (C-51) |
| `CLAUDE.md` | edycja | model `AssistantPref`, nowe akcje, nowa bramka, typ operacji `speech` |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13 — nigdy prod DB):** `pg_ctlcluster 16 main start`, `.env.local` na
`127.0.0.1:5432`, `npx prisma migrate deploy`, potem `npm run check:actions`,
`npm run check:ai-coverage`, `npm run check:migrations`, `next lint --dir src`, `npx next build`
(**bez** `scripts/migrate.js`).

| AC | Sposób weryfikacji |
|---|---|
| AC-1 | test jednostkowy `humanizeAssistantText` (mapowania + usuwanie id) + przegląd odpowiedzi w UI |
| AC-2, AC-3 | przegląd `AICommandSheet`: jeden wiersz na żywo, zwinięty log po zakończeniu |
| AC-4 | render z `isAdmin=false` — brak technicznego logu; `isAdmin=true` — jest |
| AC-5, AC-6 | przegląd `ActionDrawer` na planie z polami enum/data/liczba/bool |
| AC-7 | inspekcja wyrównania pola wyboru z wierszem nagłówka |
| AC-8 | inspekcja stopki: brak etykiet, kolejność, `title` + `aria-label` |
| AC-9 | 375 px szerokości: brak przewijania poziomego w historii rozmów |
| AC-10 | podpowiedź widoczna na desktopie, ukryta na mobile |
| AC-11, AC-13 | zapis w jednej sesji → odczyt po `getAssistantPrefs()` (druga sesja/urządzenie) |
| AC-12, AC-14 | przełącznik obok mikrofonu; log `AiCall` pokazuje model z przypisania `dispatch` |
| AC-15, AC-18 | lista głosów stabilna po `voiceschanged`; próbka odtwarzalna |
| AC-16, AC-17 | z przypisaniem `speech` → głosy serwerowe działają; bez → `501` i fallback bez błędu |
| AC-19, AC-20, AC-21 | zgłoszenie z konta bez dostępu: zadanie powstaje, brak przycisku „Otwórz", odczyt odmawia |
| AC-22 | ustawienie `feedback_project_id` → zgłoszenie ląduje we wskazanym projekcie |
| AC-23, AC-24 | próba akcji na cudzym rekordzie → `success:false` + komunikat o braku dostępu |
| AC-25 | agent dostaje informację o odmowie i nie obiecuje wykonania (przegląd promptu + przebieg) |
| AC-26, AC-27 | akcja z wartością spoza słownika → odrzucona na serwerze; front blokuje „Wykonaj" |
| AC-28 | celowo dodana akcja testowa bez `access` → `npm run check:ai-coverage` kończy się błędem |
| AC-29 | `docs/ai/kontrola-dostepu.md` bez pozycji „brak guardu" |
| AC-30 | `npm run check:*` + `next lint` + `npx next build` zielone |

## 9. Ryzyka techniczne i plan wycofania

- **159 wpisów kontraktu to duża, mechaniczna praca** → dzielimy per moduł (kolejność jak w
  egzekutorach); bramka pilnuje kompletności, więc nic nie umknie. Ryzyko literówek ograniczamy
  re-eksportem istniejących map etykiet zamiast przepisywania.
- **Heurystyka guardu daje fałszywe alarmy** (akcja woła guard przez helper) → biała lista nazw
  helperów w skrypcie + możliwość `"access": "open"` z uzasadnieniem; komunikat błędu wskazuje obie
  drogi.
- **Sanitizer zje coś potrzebnego** (np. tekst użytkownika zawierający słowo „NONE") → mapujemy
  tylko tokeny w kontekście (całe słowo, wielkie litery, poza blokami kodu); testy jednostkowe na
  przypadkach granicznych.
- **Serwerowe TTS: koszt i awaria dostawcy** → limit długości tekstu, limit żądań per użytkownik,
  brak automatycznego czytania (tylko na kliknięcie / w trybie rozmowy), twardy fallback do
  przeglądarki przy każdym błędzie.
- **Regresja w historii rozmów** przy zmianie renderu logu → stare rekordy `AiMessage` renderujemy
  tą samą ścieżką (log opcjonalny), więc brak logu = brak przełącznika, bez wyjątku.
- **Rollback:** kod — `git revert` zakresu; migracja `0209` jest **addytywna** (nowa tabela), więc
  cofnięcie kodu nie wymaga cofania migracji (osierocona tabela jest nieszkodliwa). Zgodnie z
  `docs/devops/runbook-deploy-rollback.md` nie cofamy migracji na produkcji.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — ręczna migracja `0209_assistant_pref` (numer z `next:migration`), statusy jako
  `String` + union TS, brak enumów Prisma, brak builda przeciw prod DB, konfiguracja idempotentna.
- [x] **C-20..C-25** — mutacje przez Server Actions z `revalidatePath`; dostęp przez istniejące
  guardy i model `ownerId`/`ownerTeamId`; brak nowych slugów RBAC; każda `AIAction` ma egzekutor
  (bramka bez zmian) + nowy wymóg kontraktu; zmiany konfiguracji w `AuditLog`.
- [x] **C-30..C-32** — wyłącznie zmienne CSS, poprawki mobilne (brak przewijania poziomego, cele
  dotyku), wszystkie teksty po polsku.
- [x] **C-40, C-41** — tryb oszczędny zmienia *typ operacji*, nie model; TTS przez `LlmProvider` +
  `LlmAssignment`; klucze szyfrowane i maskowane.
- [x] **C-53** — rozszerzamy dwie istniejące bramki zamiast tworzyć nowe; kontrakt re-eksportuje
  istniejące słowniki etykiet; brak nowych zależności npm; audyt zmienia kod tylko tam, gdzie
  faktycznie brakuje sprawdzenia.
- [x] **C-54** — spec pozostaje spójny z planem; przy odkryciach na etapie implementacji wracamy do
  `plan.md`/`spec.md` przed zmianą kodu.
