# Recenzja: Zgłoszenia bez czekania i pakiet poprawek UX

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md (099-zgloszenia-i-poprawki-ux)
- **Data:** 2026-08-24
- **Zakres:** `git diff bf79221..HEAD` — 27 plików, +1847 / −73 (w tym artefakty i klikacze).

## Ustalenia (od najpoważniejszego)

### 1. `resetConversation()` nie gasił trybu zgłoszenia — **naprawione tutaj**
- **Plik:** `src/components/assistant/AICommandSheet.tsx:975` (`resetConversation`)
- **Kategoria:** correctness
- **Opis:** „Nowa rozmowa" czyściła wątek, ale zostawiała `feedbackRef` i `feedbackShotRef`.
- **Scenariusz awarii:** admin wskazuje „robaczkiem" element w Pogodzie → asystent otwiera się
  w trybie zgłoszenia → admin klika **+** („Nowa rozmowa"), bo rozmyślił się i chce zapytać
  o coś innego → wpisuje pytanie → **powstaje zgłoszenie** opisane jego pytaniem, z kontekstem
  i zrzutem tamtego, porzuconego miejsca. Wada istniała przed 099 (dla samego kontekstu), ale
  **099 podnosi jej cenę**: nie ma już karty planu do odrzucenia — zadanie zapisuje się od razu.
- **Poprawka:** te same trzy linie, co w `handleClose` — tryb, kontekst i zrzut gasną razem z wątkiem.

### 2. Podgląd zrzutu rysowany ręcznie zamiast wspólnym `Modal` — **naprawione tutaj**
- **Plik:** `src/modules/tasks/ui/TaskDetail.tsx` (sekcja `TaskAttachments`)
- **Kategoria:** convention (C-35, C-31)
- **Opis:** własna nakładka `fixed inset-0` zamiast komponentu, który repo już ma — a plan
  §5.3 wprost mówił „podgląd w istniejącym `Modal`".
- **Skutek:** brak zamykania Escape, brak pułapki fokusu, brak marginesu na kreskę iPhone'a
  (087 dołożyło go do stopki `Modal`). Trzy rzeczy, które wspólny komponent daje za darmo.
- **Poprawka:** `<Modal open onClose … title={podglad.name} wide>`.

### 3. Kolejkowanie tytułu bez limitu uczciwości — **naprawione tutaj**
- **Plik:** `src/actions/feedback.ts` (wywołanie `enqueue`)
- **Kategoria:** correctness (odporność)
- **Opis:** `enqueue` bez `maxActivePerOwner`, podczas gdy sąsiedni moduł (Wiadomości) ustawia
  `MAX_ACTIVE_JOBS_PER_OWNER`.
- **Scenariusz:** seria zgłoszeń jednej osoby zapycha kolejkę zadaniami tytułów, opóźniając
  wszystkim resztę pracy w tle.
- **Poprawka:** limit ustawiony; przekroczenie łapie istniejący `catch` — **zgłoszenie i tak
  powstaje**, zostaje przy tytule roboczym. Degradacja, nie odmowa.

### 4. Komentarz mówił nieprawdę o zrzucie — **naprawione tutaj**
- **Plik:** `src/components/shell/FeedbackInspector.tsx` (`capture`)
- **Kategoria:** convention (komentarz jest w tym repo pamięcią, więc fałszywy szkodzi)
- **Opis:** komentarz twierdził, że bez zgaszenia podświetlenia ramka wskaźnika trafi na obraz.
  Nieprawda — nakładka jest **rodzeństwem** wskazanego elementu, a rasteryzujemy wyłącznie jego
  poddrzewo, więc i tak by się tam nie znalazła.
- **Poprawka:** komentarz mówi teraz prawdziwy powód (rasteryzacja trwa; bez zgaszenia tryb przez
  tę chwilę wygląda na zawieszony).

### 5. Przeporządkowany manifest pamięci treści — **naprawione tutaj**
- **Plik:** `src/lib/ai/content-memory-coverage.json`
- **Kategoria:** simplification (C-53 — „bez refaktorów przy okazji")
- **Opis:** zapis manifestu posortował istniejące wpisy: diff urósł do 38 linii zamiast 4,
  a przy równoległej gałęzi byłby to gwarantowany konflikt.
- **Poprawka:** oryginalna kolejność przywrócona, dopisany wyłącznie nowy wpis (4 linie).
  Tak samo przywrócono brak końcowej nowej linii w `action-coverage.json`.

### 6. Drobiazg redakcyjny — **naprawione tutaj**
- `src/actions/feedback.ts`: podwójna pusta linia po `SubmitFeedbackResult`.

## Czego NIE zgłaszam (sprawdzone i uznane za w porządku)

- **Zrzut jako `data:` URL w kolumnie tekstowej** — to zastany wzorzec repo (`NoteAttachment`,
  `HealthAttachment`, `VehicleAttachment`); nasz zapis jest **węższy** od tamtych (wyłącznie
  `data:image/`, twardy limit 1,5 MB), a render idzie przez `<img>`, gdzie nawet SVG nie wykonuje
  skryptów.
- **Wyjątek dostępowy skrzynki zgłoszeń** — nietknięty. Nowy odczyt załączników ma własny guard
  (`assertTaskAccess`), więc kto nie widzi zadania, nie widzi zrzutu.
- **`enqueue` w `try/catch`** — celowo połyka błąd: zadanie ma już pełnoprawny tytuł, a wywrócenie
  zgłoszenia z powodu kolejki byłoby dokładnie tą awarią, którą ta zmiana usuwa.
- **`Promise.race` nie anuluje rasteryzacji** — nie da się jej anulować, a osierocona praca kończy
  się sama i nie ma dokąd zapisać wyniku.
- **`html-to-image`** — jedyna nowa zależność, wybrana przez właściciela, ładowana leniwie;
  `check:perf` potwierdza brak wpływu na trasy.

## Bramki po poprawkach recenzenckich

| Sprawdzenie | Wynik |
|---|---|
| `tsc --noEmit` (`tsconfig.json`, `tsconfig.test.json`) | ✅ |
| `next lint --dir src` | ✅ bez błędów |
| `check:ui-contract`, `check:i18n`, `check:domain`, `check:content-memory`, `check:ai-coverage` | ✅ |
| `check:perf` | ✅ w paśmie ±5 % |
| Klikacze `zgloszenia-i-uklad` + `tasks` | ✅ **14/14** |

## Werdykt

**APPROVE Z UWAGAMI.**

Sześć ustaleń, wszystkie naniesione w tej recenzji; jedno z nich (nr 1) było prawdziwym błędem
zachowania, a nie kosmetyką. Uwagi, które zostają otwarte i **nie należą do tego pakietu**:

1. **11 klikaczy Wiadomości jest czerwonych od dawna** — potwierdzone pomiarem na commicie bazowym;
   przyczyną jest brak danych modułu w bazie klikaczy. Osobna praca: zasianie tych danych w seedzie
   e2e odsłoni prawdziwy stan tamtych scenariuszy.
2. **`favorites.spec.ts` bywa czerwony pod obciążeniem** — chwiejne sprzątanie ulubionych,
   niezwiązane z tą zmianą.
3. **Jedna nowa zależność w przeglądarce** (`html-to-image`) — świadoma decyzja właściciela.
