# Weryfikacja: Przepisanie kompozytora asystenta AI (układ jak „Chat with Claude")

- **Spec:** ./spec.md (019-assistant-composer-rewrite)
- **Data:** 2026-07-22
- **Weryfikujący:** Claude Code (etap /verify)

## Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ `OK (następny wolny numer: 0207)` — brak migracji |
| `npm run check:actions` | ✅ `159 akcji, wszystkie obsługiwane przez executor` |
| `next lint --dir src` | ✅ zero błędów; jedyny warning w pliku to **wcześniej istniejący** `no-unescaped-entities` (linia 1237) — nie z tej zmiany |
| `next build` (lokalny Postgres, C-13) | ✅ `Compiled successfully` + `Generating static pages (130/130)` |

## Kryteria akceptacji
| AC | Werdykt | Dowód / jak sprawdzono |
|----|---------|------------------------|
| **AC-1 (karetka od razu w polu, iOS)** | ✅ strukturalnie (runtime iOS → do potwierdzenia przez właściciela) | `AICommandSheet.tsx:1475` karta `flexDirection:column`; pole (`:1487`) jest u góry, a **pod nim** statyczny wiersz akcji (`:1491`) — pole NIE przy dolnej krawędzi. Brak `env()` pod fokusowanym polem; margines safe-area tylko na zewnętrznej stopce warunkowo od fokusu (`:1429`). To usuwa mechanizm z lekcji 2026-07-22 (inset pod fokusowanym polem). Zachowania iOS nie da się odtworzyć w sandboxie — wymaga testu na urządzeniu. |
| **AC-2 (auto-rozrost)** | ✅ | Istniejący `useEffect` (`:606–611`) ustawia `height=auto`→`min(scrollHeight,140)` na każdą zmianę `inputText`. Pole `:1488` bez sztywnej `height`, `minHeight:36` (mieści linię 16px/1.4 = 34.4px), `overflowY:auto`. Po wysłaniu `inputText=""` → efekt wraca do 1 linii. |
| **AC-3 (układ dwuwierszowy)** | ✅ | `:1475` karta kolumnowa (`bg-elevated`, `border`, `borderRadius:var(--radius-lg)`); wiersz 1 = pole, wiersz 2 = akcje (`:1490` `justify-content:space-between`). |
| **AC-4 (akcje w dolnym wierszu)** | ✅ | Lewo: **aparat** (`:1493`, `Camera`, → `cameraRef` input `capture="environment"` `:1470`) + **galeria** (`:1496`, `ImagePlus`, → `fileRef` `:1469`). Prawo: **mikrofon** (`:1503` `dictation.toggle`) + **główny przycisk**: `busy`→Stop (`:1515`), tekst/obraz→Wyślij (`:1519` `ArrowUp`), puste→rozmowa głosowa (`:1524` `AudioLines`). Obie ikony zdjęć → `onPickImage` (istniejący pipeline). |
| **AC-5 (ustawienia w nagłówku)** | ✅ | `:1222` przycisk `Settings` w prawym klastrze nagłówka togluje `showPrefs` (panel renderuje się u góry, `:~1278`). W kompozytorze **nie ma** menu „+" ani `showPlus` (grep: brak wystąpień). |
| **AC-6 (płynne przewijanie)** | ✅ | VisualViewport/`keyboardInset` **usunięte** (grep: brak) — brak przeliczeń wysokości sheeta na zdarzeniach `scroll`; sheet ma stałe `85vh`. |
| **AC-7 (zachowana funkcjonalność)** | ✅ | Te same handlery: `handleSend`/`stopGeneration`/`sendImage`/`onPickImage`/`dictation`/`toggleVoice`; panel `showPrefs`, historia, nowa rozmowa, zgłoszenie (admin), streaming myśli — nietknięte (zmiana tylko układu kompozytora + wyzwalacz ustawień). Podgląd `attachedImage` (`:1458`) zachowany. |
| **AC-8 (kreska iPhone bez psucia karetki)** | ✅ strukturalnie | Stopka `:1429` `paddingBottom: composerFocused ? undefined : max(0.75rem, env(safe-area-inset-bottom))` — czyści kreskę przy zamkniętej klawiaturze, a przy fokusie nie dokłada insetu pod polem. |
| **AC-9 (desktop bez regresji)** | ✅ | Autofokus (`:653`), wysyłka, handlery bez zmian; `env()`=0 na desktopie; `capture` na desktopie degraduje do zwykłego pickera. Build zielony. |

## Zgodność z konstytucją
- **C-30 (zmienne CSS):** ✅ karta/przyciski/ikony na tokenach (`--bg-elevated`, `--border`, `--accent-*`,
  `--on-accent`, `--radius-lg`, `--text-muted`); zero hardcodu koloru.
- **C-31 (mobile-first, safe-area, klawiatura):** ✅ AC-1/AC-3/AC-6/AC-8.
- **C-32 (teksty PL):** ✅ „Zrób zdjęcie", „Dodaj zdjęcie", „Dyktuj", „Wyślij", „Rozmowa głosowa",
  „Zatrzymaj", „Ustawienia asystenta".
- **C-53 (minimalizm):** ✅ jeden komponent; 2 ikony z już używanego `lucide-react` (bez nowych
  zależności); usunięty kod (`showPlus`, menu „+"), a nie dołożony.
- **C-50 (build):** ✅. **C-51 (lekcja):** ✅ dopisana. **C-10..C-25/C-40 (dane/akcje/AI):** nie dotyczą.

## Regresje
- **Import `Send`:** usunięty (zastąpiony `ArrowUp`); grep potwierdza brak innych użyć → brak martwego
  importu. `Plus` nadal używany (nagłówek + drawer historii) — pozostawiony.
- **Panel `showPrefs`:** ten sam komponent, teraz wyzwalany z nagłówka — bez zmian treści/logiki.
- **Brak zmian** w agencie/route/schema/RBAC → brak wpływu na inne moduły.
- **Uwaga (nie-defekt):** `maxHeight:160` na `<textarea>` jest wyżej niż limit auto-rozrostu 140px z
  `useEffect` — efektywny sufit to 140px (efekt wygrywa dla wzrostu); CSS `maxHeight` to nieszkodliwa
  rezerwa. Zachowanie zgodne z AC-2.

## Werdykt końcowy
**GOTOWE** (z jawną uwagą). Wszystkie bramki zielone; AC-2..AC-9 spełnione z dowodem w kodzie; AC-1
i AC-8 spełnione **strukturalnie** (warunki układu, które eliminują błąd karetki), a ich **runtime na
iOS** nie da się zweryfikować w sandboxie — wymaga testu właściciela na urządzeniu na `develop` przed
promocją na `master`. Brak regresji. Przejście do `/review`.
