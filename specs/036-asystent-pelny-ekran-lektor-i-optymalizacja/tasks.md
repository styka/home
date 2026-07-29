# Zadania: Asystent — pełny ekran na telefonie, lektor w trybie rozmowy i optymalizacja kosztów

- **Plan:** ./plan.md (036-asystent-pelny-ekran-lektor-i-optymalizacja)
- **Status:** todo
- **Data:** 2026-07-28

> **Zasada listy zadań:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Trzy
> rozłączne obszary (okno / lektor / koszty) — fazy 0–2 można weryfikować niezależnie od siebie.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Lektor w trybie rozmowy (Z2)

- [x] **T-1** — **Jeden odblokowany element audio** (plan §7): w `src/lib/tts.ts` zamień tworzenie
  `new Audio(url)` przy każdej wypowiedzi na **jeden trwały** `HTMLAudioElement`; dodaj eksportowane
  `primeSpeechPlayback()` (ustawia cichy dźwięk, `play()` + `pause()`), przeznaczone do wywołania
  **synchronicznie w geście użytkownika**. `stopServerAudio` zatrzymuje i zwalnia `objectURL`, ale
  **nie niszczy** elementu.
  *Gotowe, gdy:* `speakViaServer` odtwarza na współdzielonym elemencie, a odrzucone `play()` nadal
  zwraca `false` (zejście na głos przeglądarki). **(AC-9, AC-10, AC-11)**

- [x] **T-2** — **Odblokowanie w geście startu rozmowy** (plan §7): w `AICommandSheet.tsx` wywołaj
  `primeSpeechPlayback()` w obsłudze kliknięcia przycisku uruchamiającego tryb rozmowy głosowej —
  **przed** jakimkolwiek `await`, żeby nie stracić aktywacji użytkownika.
  *Gotowe, gdy:* wywołanie jest pierwszą instrukcją handlera, przed `startListening()`. **(AC-8)**

---

## Faza 1 — Okno asystenta na pełny ekran (Z1)

- [x] **T-3** — **Hook widocznego obszaru** (plan §5.1): nowy `src/hooks/useVisualViewport.ts` —
  zwraca `{ height, offsetTop }` z `window.visualViewport` (nasłuch `resize` + `scroll`, wygładzenie
  przez `requestAnimationFrame`), a przy braku API zwraca `null`.
  *Gotowe, gdy:* hook nie rzuca na serwerze (SSR), sprząta nasłuchy i degraduje się do `null`.

- [x] **T-4** — **Pełny ekran na telefonie** (plan §5.1): w `AICommandSheet.tsx` na `< md` arkusz
  dostaje `position: fixed`, `left: 0`, `width: 100%`, `top: <offsetTop>`, `height: <height>`,
  `borderRadius: 0`, bez uchwytu i bez przyciemnionego tła. Rozróżnienie mobile/desktop przez
  `matchMedia("(min-width: 768px)")` (wysokość ustawiamy inline, więc klasy nie wystarczą).
  *Gotowe, gdy:* na telefonie okno wypełnia ekran, a przy otwartej klawiaturze kurczy się wyłącznie
  obszar wiadomości; nagłówek i kompozytor pozostają widoczne. **(AC-1, AC-2, AC-3, AC-4)**

- [x] **T-5** — **Desktop bez zmian** (plan §5.1): potwierdź i zabezpiecz, że na `md:` zostaje
  wyśrodkowany panel `max-w-lg`, `85vh`, przyciemnione tło i zamykanie kliknięciem obok.
  *Gotowe, gdy:* gałąź desktopowa nie używa wartości z hooka. **(AC-6)**

- [x] **T-6** — **Inwentarz zabiegów na fokusie i karetce** (plan §5.1): przejrzyj komponent i wypisz
  **wszystkie** miejsca dotykające fokusu/karetki (autofokus, `setSelectionRange`, `caretColor`,
  `blur()`, cokolwiek na `pointerdown`). Wynik trafia do `verify.md` jako odpowiedź dla właściciela.
  *Gotowe, gdy:* lista jest kompletna i każde miejsce ma jednozdaniowe uzasadnienie albo jest usunięte.
  **(AC-5, AC-7)**

---

## Faza 2 — Przełącznik follow-upów (Z3)

- [x] **T-7** — **Migracja z wartością startową** (plan §2): `prisma/migrations/0214_asystent_followups_config/`
  — `INSERT … ON CONFLICT ("key") DO NOTHING` dla `assistant_followups_enabled` = `'1'`.
  *Gotowe, gdy:* `npm run check:migrations` przechodzi, migracja aplikuje się lokalnie i **powtórne
  uruchomienie nie nadpisuje** wartości ustawionej przez admina. **(AC-22)**

- [x] **T-8** — **Odczyt bez sesji + akcje admina** (plan §3): nowy `src/lib/ai/followups.ts`
  (`readFollowupsEnabled()` — czysty odczyt `Config`, brak wiersza → `true`); w
  `src/actions/llmConfig.ts` `getFollowupsEnabled` / `setFollowupsEnabled` z `requireAdmin`,
  `logAudit` i `revalidatePath("/admin/llm")`; wpisy w `action-coverage.json`.
  *Gotowe, gdy:* `npm run check:ai-coverage` przechodzi, a zmiana ustawienia zostawia ślad w
  `AuditLog`. **(AC-21)**

- [x] **T-9** — **Przełącznik w panelu admina** (plan §5.2): sekcja w `LlmConfigPanel.tsx` z
  wyjaśnieniem, że propozycje kolejnych pytań kosztują tokeny; `page.tsx` dociąga wartość.
  *Gotowe, gdy:* przełącznik zapisuje się i po odświeżeniu pokazuje aktualny stan. **(AC-18, AC-20)**

---

## Faza 3 — Optymalizacje P1, P2, P4 (Z3)

- [x] **T-10** — **Podział promptu na część stałą i zmienną** (plan §6.1): `buildSystemPrompt` zwraca
  `{ stable, variable }`; dotychczasowa forma (sklejenie) zostaje jako funkcja pomocnicza — służy za
  **dowód neutralności treści**. **Korekta z implementacji (C-54, plan §6.1):** katalog nawigacji
  **zostaje** w części zmiennej — przeniesienie go do prefiksu wypchnęłoby blok „ZASADY" przed
  katalogi, do których wprost się odwołuje. Częścią stałą jest wyłącznie wstęp + protokół, więc
  **kolejność ani treść się nie zmieniają**.
  *Gotowe, gdy:* `stable + variable` jest identyczne **co do znaku** z dotychczasowym promptem — dla
  wszystkich zestawów modułów (zmierzone: 5 zestawów, w tym pusty i pełny). **(AC-17)**

- [x] **T-11** — **Pamięć podręczna tylko na prefiksie stałym** (plan §6.1): `ChatOptions.systemBlocks`;
  `toAnthropicSystem` buduje dwa bloki i oznacza `cache_control` **wyłącznie na pierwszym**.
  Wywołania bez `systemBlocks` — bez zmian.
  *Gotowe, gdy:* prefiks stały nie zależy od wybranych modułów, więc powtarza się między poleceniami.
  **(AC-14)**

- [x] **T-12** — **Strażnik uprzejmości** (plan §6.2): `SMALL_TALK_RE` w `fastPath.ts` z kotwicami
  `^…$`; w `agent/route.ts` dopasowanie pomija `classifyIntent` **i** `routeModules`.
  *Gotowe, gdy:* „hej", „cześć", „dzięki" pomijają dwa wywołania, a „cześć, dodaj mleko" **nie**
  wpada w skrót. **(AC-12, AC-13, AC-16)**

- [x] **T-13** — **Katalog akcji warunkowo + ścieżka odwrotu** (plan §6.3):
  `buildSystemPrompt(modules, { includeActions })`; wyłączamy katalog dla uprzejmości i czystego
  odczytu; gdy agent mimo to zwróci `step: "plan"` — **ponów** przebieg z pełnym katalogiem.
  *Gotowe, gdy:* rozmowa nie dostaje katalogu akcji, a polecenie zmiany danych działa jak wcześniej
  (w razie pomyłki klasyfikacji — po ponowieniu). **(AC-15, AC-16)**

- [x] **T-14** — **Follow-upy sterowane ustawieniem** (plan §6.4): `buildSystemPrompt(..., { followups })`
  — przy wyłączonych fragment o `followups` znika z opisu kroku `answer`; `POST` czyta wartość przez
  `readFollowupsEnabled()`.
  *Gotowe, gdy:* przy wyłączonym ustawieniu instrukcja ich nie zamawia, a przy włączonym wracają.
  **(AC-19, AC-20)**

- [x] **T-15** — **Pomiar oszczędności** (plan §9): tymczasowy skrypt (`npx tsx`, kasowany po użyciu)
  liczy tokeny promptów dla „cześć" **przed i po** zmianach oraz sprawdza `SMALL_TALK_RE` na zestawie
  zdań (w tym „cześć, dodaj mleko").
  *Gotowe, gdy:* liczby trafiają do `verify.md`, a zestaw testowy nie ma fałszywych trafień.
  **(AC-12, AC-13, AC-16)**

---

## Faza 4 — Bramki i domknięcie

- [x] **T-16** — **Bramki**: `npm run check:migrations`, `npm run check:actions`,
  `npm run check:ai-coverage`, `npx next lint --dir src`, `npx next build` na **lokalnym** Postgresie
  (C-13, bez `scripts/migrate.js`).
  *Gotowe, gdy:* wszystkie zielone.

- [x] **T-17** — **Dokumentacja**: `CLAUDE.md` — przełącznik follow-upów, podział promptu na część
  stałą/zmienną i skrót przy uprzejmości.
  *Gotowe, gdy:* opis odpowiada stanowi kodu.

- [x] **T-18** — **Lekcje** (C-51): wpis do `doświadczenia.md` — (a) dlaczego lektor serwerowy milkł
  na telefonie w trybie rozmowy (aktywacja użytkownika a `new Audio()`), (b) dlaczego `vh`/`dvh` nie
  wystarcza przy klawiaturze i co daje przypięcie do visual viewport.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie | AC | Zadanie |
|----|---------|----|---------|
| AC-1 | T-4 | AC-12 | T-12, T-15 |
| AC-2 | T-4 | AC-13 | T-12, T-15 |
| AC-3 | T-4 | AC-14 | T-11 |
| AC-4 | T-4 | AC-15 | T-13 |
| AC-5 | T-4, T-6 | AC-16 | T-12, T-13, T-15 |
| AC-6 | T-5 | AC-17 | T-10 |
| AC-7 | T-6 | AC-18 | T-9 |
| AC-8 | T-2 | AC-19 | T-14 |
| AC-9 | T-1 | AC-20 | T-9, T-14 |
| AC-10 | T-1 | AC-21 | T-8 |
| AC-11 | T-1 | AC-22 | T-7 |

## Notatki / blokady
- T-13 zależy od T-10 (opcje budowania promptu), T-14 od T-8 (odczyt ustawienia) i T-10.
- T-11 zależy od T-10 — bez podziału nie ma czego cache'ować osobno.
- Fazy 0 i 1 nie dotykają bazy ani warstwy LLM, więc mogą iść niezależnie.
- **Uwaga na zakres:** żadne zadanie nie skraca treści promptów (P3 i P5 z raportu są świadomie poza
  zakresem); jedyna dopuszczona zmiana treści to warunkowy fragment o follow-upach (T-14).
