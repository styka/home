# Plan techniczny: Przepisanie kompozytora asystenta AI (układ jak „Chat with Claude")

- **Spec:** ./spec.md (019-assistant-composer-rewrite)
- **Status:** draft
- **Data:** 2026-07-22

> **Zasada planu:** to jest **JAK**. Zmiana jest **wyłącznie w UI** jednego komponentu
> (`AICommandSheet.tsx`) — bez schematu, Server Actions, RBAC, AI. Zachowujemy istniejące handlery.

## 1. Podejście
Przepisujemy **tylko blok kompozytora** w `src/components/home/AICommandSheet.tsx` z jednowierszowej
„pigułki" na **dwuwierszową kartę** (jak „Chat with Claude"): pole tekstowe u góry (pełna szerokość,
auto-rozrost), a pod nim **wiersz akcji** (lewo: aparat + galeria; prawo: mikrofon + główny przycisk).
Ikonę „Ustawienia asystenta" przenosimy z menu „+" kompozytora do **górnego paska nagłówka** (panel
`showPrefs` już renderuje się u góry — przenosimy tylko jego wyzwalacz). Usuwamy menu „+" i stan
`showPlus`. Zachowujemy WSZYSTKIE handlery (`handleSend`, `sendImage`, `onPickImage`, `dictation`,
`toggleVoice`, `stopGeneration`, auto-rozrost `useEffect`). Wzorzec wizualny = referencyjne screeny
Claude + istniejące tokeny CSS Omnii.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Brak nowych modeli/kolumn, brak migracji, `npm run check:migrations` zostaje
zielony.

## 3. Warstwa serwera (Server Actions — C-20)
**Bez zmian.** Zero mutacji/akcji. Cała zmiana jest kliencka (prezentacja/układ). Logika wysyłki
tekstu i obrazu (istniejące `handleSend`/`sendImage`) bez zmian.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Asystent działa w istniejącym kontekście; brak nowych slugów/wpięć.

## 5. UI (C-30, C-31, C-32) — sedno zmiany
Plik: `src/components/home/AICommandSheet.tsx`.

### 5.1 Nowy układ karty kompozytora (AC-2, AC-3, AC-4)
Zastępujemy dzisiejszą „pigułkę" (`<div flex items-end … borderRadius:26>` z polem `flex:1` między
przyciskami, ~linie 1470–1557) kartą **dwuwierszową**:
- **Karta:** `display:flex; flexDirection:column; gap`, `border:1px solid var(--border)`,
  `background: var(--bg-elevated)`, `borderRadius: var(--radius-lg)` (~zaokrąglona), `padding` (np.
  `8px 10px`).
- **Wiersz 1 — pole tekstowe (pełna szerokość):** `<textarea>` (ten sam `composerRef`, `value`,
  `onChange`, `onKeyDown`, `onFocus/onBlur`, `placeholder`, `rows={1}`, `aria-label`). Style:
  `width:100%`, `resize:none`, tło/obwódka none, `color:var(--text-primary)`, `fontSize:16`
  (spójnie z globalną regułą anty-zoom — bez wymuszania mniejszego inline), `lineHeight:1.4`,
  `padding` pionowy dobrany tak, by linia 16px mieściła się bez obcięcia, `minHeight` na jedną linię,
  `maxHeight:~140`, `overflowY:auto`, `caretColor:var(--accent-blue)`. Auto-rozrost: zostaje istniejący
  `useEffect` na `scrollHeight` (`height=auto` → `min(scrollHeight,140)`), bez sztywnej `height`.
- **Wiersz 2 — akcje:** `display:flex; alignItems:center; justifyContent:space-between`.
  - **Lewy klaster:** przycisk **aparat** (`Camera`, „Zrób zdjęcie") → klik ukrytego inputu z
    `capture="environment"`; przycisk **galeria** (`ImagePlus`, „Dodaj zdjęcie") → klik ukrytego inputu
    bez `capture`. Oba → `onPickImage` → `attachedImage`.
  - **Prawy klaster:** **mikrofon** (dyktowanie, istniejący `dictation.toggle`, `Mic`/`MicOff`) +
    **główny okrągły przycisk** wg dzisiejszej logiki: `busy` → Stop (`Square`, `accent-red`);
    `inputText.trim()||attachedImage` → **Wyślij** (`ArrowUp`, `accent-blue`, tekst `var(--on-accent)`);
    puste → **rozmowa głosowa** (`AudioLines`/`Square`, `accent-blue`).
  - Wszystkie przyciski: koła 38×38, kolory z tokenów (C-30), `var(--on-accent)` na akcentach.

### 5.2 Naprawa karetki iOS (AC-1, AC-8) — strukturalnie
- Pole tekstowe **nie jest** przy samej dolnej krawędzi karty — pod nim jest statyczny wiersz akcji.
  To usuwa mechanizm z lekcji (dynamiczny/duży dolny padding pod fokusowanym polem rozjeżdżał
  scroll-into-view iOS i karetkę).
- Margines na kreskę iPhone zostaje na **zewnętrznej stopce** (`px-4 py-3` wrapper), nadal warunkowo:
  `paddingBottom: composerFocused ? undefined : "max(0.75rem, env(safe-area-inset-bottom))"` —
  przy pisaniu (fokus) geometria bez dodatkowego insetu; przy zamkniętej klawiaturze czyści kreskę.
  **Karta** ma tylko **statyczny** padding (żadnego `env()` pod polem).
- Zachowujemy `composerFocused` (`onFocus/onBlur`).

### 5.3 Płynne przewijanie (AC-6)
- Brak dynamicznej zmiany wysokości sheeta/karty na zdarzeniach przewijania (VisualViewport już
  usunięty). Wysokość sheeta zostaje `85vh`/`maxHeight:85vh`, wątek ma własny scroll. Nic nie
  przelicza się na `scroll`.

### 5.4 Ustawienia do nagłówka (AC-5)
- W nagłówku (`flex … justify-between px-5 py-3`, prawy klaster ikon, ~linia 1220) **dodajemy** przycisk
  `Settings` (`title/aria-label="Ustawienia asystenta"`, `style=iconBtn`, kolor `accent-blue` gdy
  `prefs.trim()`), `onClick={() => setShowPrefs(v=>!v)}`, `aria-expanded={showPrefs}`. Umieszczamy przy
  Historii/Nowej rozmowie/Zamknij.
- **Usuwamy** z kompozytora: całe menu „+", stan `showPlus` (+ `setShowPlus`) i pozycję „Ustawienia
  asystenta" z tego menu. Pozycja „Zdjęcie" z menu „+" zostaje zastąpiona przez dwie ikony w wierszu
  akcji (5.1).

### 5.5 Ikony (import)
- Do importu z `lucide-react` dodać `Camera` i `ArrowUp` (send jak strzałka w górę u Claude). `Plus`
  może zostać (nadal używany w nagłówku „Nowa rozmowa"). `ImagePlus`, `Mic`, `MicOff`, `AudioLines`,
  `Square`, `Settings` już są.
- Teksty/aria po polsku (C-32): „Zrób zdjęcie", „Dodaj zdjęcie", „Dyktuj", „Wyślij", „Rozmowa
  głosowa", „Zatrzymaj", „Ustawienia asystenta".

## 6. AI / integracje (C-23, C-40)
**Nie dotyczy.** Brak nowej `AIAction`/egzekutora/read-toola. `check:actions` zostaje zielony.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/components/home/AICommandSheet.tsx` | edycja | Przepisanie bloku kompozytora na kartę dwuwierszową; 2 ukryte inputy (aparat/galeria); przeniesienie ikony Ustawień do nagłówka; usunięcie menu „+"/`showPlus`; import `Camera`/`ArrowUp` |
| `doświadczenia.md` (root) | edycja | C-51: lekcja o strukturalnej naprawie karetki (pole nie przy dolnej krawędzi; brak `env()` pod fokusowanym polem) i o przepisaniu kompozytora |

## 8. Bramki i weryfikacja (C-50)
- Lokalnie do kroku `next build` (bez `migrate.js` — C-13). Zmiana czysto kliencka; build kompiluje.
- `npm run check:migrations` (brak migracji → zielone), `npm run check:actions` (brak `AIAction` →
  zielone), `next lint --dir src`, `next build`.
- Mapowanie AC → weryfikacja:
  - **AC-1/AC-8 (karetka, kreska)** — inspekcja układu: pole u góry karty, wiersz akcji pod nim; brak
    `env()` pod polem; `composerFocused`-warunkowy inset na stopce. Weryfikacja zachowania iOS →
    właściciel na `develop` (nie do sprawdzenia w sandboxie).
  - **AC-2 (auto-rozrost)** — `useEffect` na `scrollHeight` działa; po wysłaniu `inputText=""` → wraca
    do 1 linii.
  - **AC-3/AC-4 (układ, akcje)** — inspekcja: karta 2-wierszowa; lewo aparat+galeria (2 inputy:
    `capture` vs brak), prawo mikrofon + główny przycisk (Stop/Wyślij/Głos wg stanu).
  - **AC-5 (ustawienia w nagłówku)** — przycisk `Settings` w nagłówku togluje `showPrefs`; brak menu
    „+" w kompozytorze.
  - **AC-6 (scroll)** — brak przeliczeń wysokości na scroll.
  - **AC-7 (funkcje)** — te same handlery: send/stop, dyktowanie, głos, podgląd/wysyłka zdjęcia,
    prefs, historia, nowa rozmowa, zgłoszenie (admin), streaming.
  - **AC-9 (desktop)** — autofokus i wysyłka bez zmian; `env()`=0 na desktopie.

## 9. Ryzyka techniczne i plan wycofania
- **Karetka iOS nadal zła** (nie do zweryfikowania w sandboxie). Mitygacja: układ strukturalny (pole
  nie przy krawędzi, brak `env()` pod polem) + test właściciela na `develop` przed promocją. Rollback:
  revert komponentu (jeden plik).
- **Regresja funkcji przy przepisaniu** (dyktowanie/głos/obraz/streaming). Mitygacja: nie ruszamy
  handlerów ani stanu poza `showPlus`; tylko układ i wyzwalacze. Weryfikacja w `/verify`.
- **Aparat na webie:** `capture="environment"` działa na mobile Safari/Chrome; na desktopie po prostu
  otwiera picker plików — akceptowalne (desktop i tak używa galerii).
- Rollback całości: zmiana w 1 pliku komponentu (+ lekcja) → zwykły revert kodu, brak migracji.

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak schematu; jawnie zapisane).
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — **nie dotyczy** (brak mutacji/akcji/AI).
- [x] C-30 (kolory przez zmienne CSS) — karta/przyciski/ikony na tokenach; `var(--on-accent)` na akcentach.
- [x] C-31 (mobile-first, safe-area, klawiatura) — AC-1/AC-3/AC-6/AC-8 wprost; inset tylko poza fokusem.
- [x] C-32 (teksty PL) — etykiety/aria po polsku.
- [x] C-50 (build zielony) — weryfikacja do `next build`.
- [x] C-51 (wpis do `doświadczenia.md`) — ujęty w plikach do zmiany.
- [x] C-53 (minimalizm) — jeden komponent, bez nowych zależności (tylko 2 ikony z już używanego
  `lucide-react`), bez zmian w agencie.
