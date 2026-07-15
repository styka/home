# Plan techniczny: Odczytywanie postów Asystenta na głos

- **Spec:** ./spec.md (004-assistant-tts-read-aloud)
- **Status:** draft
- **Data:** 2026-07-15

> **Zasada planu:** to jest **JAK**, pod istniejący kod `AICommandSheet` i helper `@/lib/tts`.

## 1. Podejście (2–4 zdania)
Funkcja jest **czysto kliencka** (przeglądarkowa synteza mowy) — nie rusza bazy, Server Actions ani
RBAC. Wzorcem jest istniejący `CopyButton` w `src/components/home/AICommandSheet.tsx` (lokalny,
samodzielny przycisk akcji przy poście) oraz sposób przekazywania akcji do `ChatTurn` (`onRegenerate`,
`onFollowup`). Dodajemy przycisk „odczytaj na głos" (`SpeakButton`) obok istniejących akcji bąbelków
Asystenta i lekki, globalny stan „który post jest teraz czytany", żeby gwarantować jeden głos naraz.
Odczyt realizujemy przez rozszerzony minimalnie `@/lib/tts` (Web Speech API — już używany w Languages).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Funkcja nic nie zapisuje (brak modelu, kolumny, migracji). C-10/C-11/C-12
nie dotyczą.

## 3. Warstwa serwera (Server Actions — C-20)
**Nie dotyczy** — brak mutacji danych i brak akcji serwera. Cała logika w komponencie klienckim +
helperze `lib/tts.ts`. C-20/C-21 nie mają zastosowania (brak własności danych).

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Funkcja żyje wewnątrz istniejącego Asystenta (dostępny w `AppShell` dla zalogowanych,
kontekst `module.home`). Brak nowego sluga, brak wpięć w `permissions.ts`/`modules.tsx`/`ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
Wszystko w `src/components/home/AICommandSheet.tsx` + `src/lib/tts.ts`.

- **`src/lib/tts.ts` — minimalne rozszerzenie (reużycie, nie duplikacja):**
  - `speak(text, lang?, opts?)` — dodać opcjonalny 3. argument `{ onEnd?: () => void }`; wpiąć
    `u.onend`/`u.onerror` → `onEnd()`. Zachować dotychczasową sygnaturę (Languages woła `speak(text, lang)` bez zmian).
  - `stopSpeaking()` — nowy helper: `window.speechSynthesis.cancel()` (bezpieczny, guardowany `ttsSupported()`).
  - `speechTextFromMarkdown(md): string` — nowy helper: zdejmuje znaczniki markdown (`#`, `*`, `` ` ``,
    `[tekst](url)` → `tekst`, `![...]()` usuń, `|` tabel, `>` cytatów, `---`) i zwraca czytelny tekst mowy.
    Powód: bąbelki renderują markdown (`markdownToHtml`), więc surowy `turn.content` zawiera symbole,
    których lektor nie powinien czytać (ryzyko z §9 spec).
  - Odczyt po polsku: `speak(text, "pl")` (UI Omnii jest po polsku — C-32).

- **`SpeakButton` (nowy lokalny komponent w `AICommandSheet.tsx`, wzorzec `CopyButton`):**
  - Props: `{ text: string; speaking: boolean; onToggle: () => void }`.
  - Ikona z `lucide-react`: `Volume2` (bezczynny) ↔ `Square`/`VolumeX` (trwa odczyt). `Square` jest już
    importowany w pliku — użyć go jako „stop", by nie dokładać importów ponad potrzebę.
  - Stan wizualny przez zmienne CSS (C-30): idle `color: var(--text-muted)`, aktywny `color: var(--accent-blue)`.
    Etykiety/`title`/`aria-label` po polsku: „Odczytaj na głos" / „Zatrzymaj odczyt".
  - Rozmiar/padding spójny z `CopyButton` (dotyk mobilny — C-31), umieszczony w tym samym rzędzie akcji.

- **Globalny „jeden głos naraz" — stan podniesiony do body `AICommandSheet`:**
  - `const [speakingId, setSpeakingId] = useState<string | null>(null)` w komponencie sheeta.
  - `toggleSpeak(id, text)`:
    - jeśli `speakingId === id` → `stopSpeaking()`, `setSpeakingId(null)` (AC-3);
    - w przeciwnym razie → `stopSpeaking()` (przerwij poprzedni, AC-4), `speak(speechTextFromMarkdown(text), "pl", { onEnd: () => setSpeakingId((cur) => cur === id ? null : cur) })`, `setSpeakingId(id)` (AC-2, AC-6).
  - Przekazać `speakingId` i `onToggleSpeak` w dół do `ChatTurn` (jak `onRegenerate`).
  - **Sprzątanie (ryzyko §9 spec):** `useEffect` — na zamknięcie arkusza (`open === false`) i na zmianę
    konwersacji wołać `stopSpeaking()` + `setSpeakingId(null)`; `useEffect` cleanup przy unmount też stopuje.

- **Wpięcie w bąbelki Asystenta (`ChatTurn`)** — dodać `SpeakButton` przy kindach z czytelną treścią:
  - `answer` — do rzędu akcji obok `CopyButton` (linia ~1084).
  - `report` — do rzędu obok `CopyButton` (linia ~1165), tekst = `turn.content` (bez tytułu lub z tytułem — z tytułem: „{title}. {content}").
  - `navigate`, `plan`, `clarify` — dodać mały `SpeakButton` na treści (`turn.content`); pominąć, gdy treść pusta.
  - `results` — **pominąć** (to lista statusów akcji, nie „post" do słuchania) — zgodne z „czytelna treść tekstowa" (AC-5).
  - Posty użytkownika (`role === "user"`) — bez przycisku (AC-7).
  - Gdy `!ttsSupported()` — `SpeakButton` nie renderuje się (AC-5). Sprawdzenie zrobić w `SpeakButton`
    (np. `const [supported] = useState(ttsSupported)`), żeby uniknąć rozjazdu SSR/hydration.

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction`/egzekutora (warstwa prezentacji istniejących postów, nie nowa
zdolność agenta), brak read-toola, brak kalendarza/powiadomień. `check:actions` nie jest naruszony.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/lib/tts.ts` | edycja | `speak` z `onEnd`, `stopSpeaking()`, `speechTextFromMarkdown()` |
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | `SpeakButton`, stan `speakingId` + `toggleSpeak`, wpięcie w bąbelki Asystenta, sprzątanie odczytu |
| `doświadczenia.md` | edycja (jeśli wypłynie nietrywialny problem) | wpis wg C-51 |

## 8. Bramki i weryfikacja (C-50)
- Zmiana **frontendowa, bez schematu** → weryfikacja do kroku `next build`/`next lint`, bez `migrate.js`
  (C-13 — nie dotykać prod DB; lokalny Postgres niepotrzebny, bo brak migracji).
- `npm run check:migrations` (brak nowej migracji → zielone), `npm run check:actions` (brak nowej akcji → zielone).
- `next lint` + `next build` muszą przejść (TypeScript strict — poprawne typy propsów `SpeakButton`, sygnatury `tts`).
- **Mapowanie AC → weryfikacja (manualna w przeglądarce na `develop`/lokalnie + rewizja kodu):**
  - AC-1 → przy poście Asystenta widoczna ikona głośnika.
  - AC-2 → klik uruchamia mowę; ikona → stan aktywny.
  - AC-3 → drugi klik tego samego posta zatrzymuje (`speakingId===id` → stop).
  - AC-4 → klik na innym poście przerywa poprzedni (`stopSpeaking()` przed `speak`).
  - AC-5 → brak wsparcia / brak treści → brak/nieaktywna ikona; `results` bez ikony.
  - AC-6 → `onEnd` zeruje `speakingId` po naturalnym końcu.
  - AC-7 → bąbel użytkownika bez ikony.

## 9. Ryzyka techniczne i plan wycofania
- **Hydration mismatch** przy `ttsSupported()` (SSR nie ma `window`) → sprawdzać wsparcie w efekcie/lazy
  init stanu, nie inline w renderze SSR.
- **`speechSynthesis` na iOS/Safari** bywa kapryśne (wymaga gestu użytkownika) → start zawsze z kliknięcia
  (gest jest), degradacja gdy brak wsparcia.
- **Wiszący `onend`** gdy komponent się odmontuje w trakcie → cleanup `useEffect` woła `stopSpeaking()`.
- **Rollback:** czysto kodowy (rewert 2 plików) — brak migracji, brak stanu w bazie, zero ryzyka danych.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — nie dotyczy (brak zmian schematu), odnotowane wprost.
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — nie dotyczy (brak mutacji/akcji/AIAction), odnotowane.
- [x] C-30..C-32 (UX) — kolory z tokenów CSS, dotyk mobilny, teksty/aria po polsku.
- [x] C-53 (minimalizm) — reużycie `CopyButton`/`@/lib/tts`, zero nowych zależności, 2 pliki zmienione.
