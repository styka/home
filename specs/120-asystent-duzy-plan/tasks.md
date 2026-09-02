# Zadania: Asystent dowozi DUŻY plan

- **Plan:** ./plan.md (120-asystent-duzy-plan)
- **Status:** in-progress
- **Data:** 2026-09-01

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna
> z zależnościami**. Każde zadanie jest małe, samodzielne i **weryfikowalne**. Odhaczamy `[ ]` →
> `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

> **Uwaga o kształcie faz.** Szablon zakłada `migracja → akcje → UI → AI`. Ten feature **nie rusza
> schematu, nie dodaje Server Actions i nie dodaje żadnej `AIAction`** (plan §2–§4, §6) — więc fazy
> 0 i 1 są puste, a porządek narzuca **kolejność merytoryczna z planu §1: najpierw przestać marnować
> wywołania, potem podnieść budżet.** Odwrotnie podnieślibyśmy cenę sześciu odpowiedzi lecących do
> kosza.

---

## Faza 0 — Rozpoznanie ucięcia (musi być PRZED Fazą 1)

- [x] **T-1** — **Ucięcie przestaje udawać poprawną odpowiedź.**
  W `callAgent` (`src/app/api/llm/home/agent/route.ts`) zwracamy `result.content ?? ""` zamiast
  `result.content || "{}"`. Pusta treść ma wyglądać na pustą.
  *Gotowe, gdy:* test pokazuje, że pusta treść modelu daje `parsed === null`, oraz **próba
  mutacyjna** — przywrócenie `|| "{}"` musi wywalić ten test. Komentarz przy zmianie mówi, **dlaczego**
  (pusty obiekt parsuje się poprawnie, więc kasował flagę ucięcia i wyłączał strażnik). → **AC-1**

- [x] **T-2** — **Flaga ucięcia zerowana dopiero przy UŻYTECZNYM kroku.**
  Dziś `if (parsed) lastTruncated = false;` — wystarczy jakikolwiek sparsowany obiekt. Zerujemy
  dopiero, gdy odpowiedź niesie krok z protokołu (`query`/`clarify`/`answer`/`navigate`/`plan`/
  `report`).
  *Gotowe, gdy:* test — obiekt bez kroku **nie kasuje** informacji o ucięciu; obiekt z poprawnym
  krokiem ją kasuje (bez tego drugiego przypadku zepsulibyśmy dorobek 032). → **AC-1**
  *Zależy od:* T-1.

- [x] **T-3** — **Marnowanie wywołań ma twardy sufit.**
  Licznik odpowiedzi **bez użytecznego kroku**, bliźniaczy do istniejącego `truncationRetries`: po
  drugiej takiej odpowiedzi kończymy przebieg, zamiast dobijać do limitu iteracji. Dziś „Nieznany
  step…" nie ma żadnego licznika i to on spalił pięć iteracji.
  *Gotowe, gdy:* test na czystej funkcji decydującej odtwarza regułę; liczba wywołań zmarnowanych na
  odpowiedzi bez kroku jest **ograniczona i mała**. → **AC-2**
  *Zależy od:* T-2.

- [x] **T-4** `[P]` — **Komunikat mówi prawdę o przyczynie.**
  Po T-1/T-2 `describeBlocker` powinien już trafiać w gałąź ucięcia bez zmian w swoim pliku —
  **weryfikujemy to testem, zamiast zakładać**.
  *Gotowe, gdy:* test — log przebiegu zakończonego ucięciem daje komunikat o **limicie długości**,
  a nie „zabrakło kroków na dokończenie odpowiedzi". → **AC-3**

---

## Faza 1 — Budżet wyjścia dobierany do etapu tury

- [x] **T-5** — **Czysta polityka budżetu.**
  `budzetWyjscia({ maDaneWKontekscie, wsadowe, raport })` w `src/platform/ai/agentContext.ts` (obok
  `czyCachowacKatalog` — ten plik jest już „polityką pętli"). Zwraca **maksimum** z mających
  zastosowanie progów: brak danych → 1200, dane w kontekście → 4000, wsadowe → 4000, raport → 2800.
  *Gotowe, gdy:* test odtwarza całą tabelę z planu §6.3, w tym przypadki mieszane (raport + dane →
  4000). → **AC-4**, **AC-5**

- [x] **T-6** — **Budżet liczony PER WYWOŁANIE, nie raz przed pętlą.**
  W pętli agenta ustawiamy `maDaneWKontekscie` po **pierwszym udanym kroku `query`** i liczymy
  budżet tuż przed każdym `callAgent`.
  *Gotowe, gdy:* zwykła tura bez odczytu ma budżet **identyczny jak przed 120** (AC-5 to wymóg
  „bez zmian", nie „prawie bez zmian"); tura po odczycie ma większy. → **AC-4**, **AC-5**
  *Zależy od:* T-5.

- [x] **T-7** — **Domknięcie nie może mieć mniej miejsca niż krok, któremu go zabrakło.**
  `finishPartialRun` dostaje `Math.max(REPORT_MAX_TOKENS, budżet pętli)`. Dziś ma 2800 przy pętli
  4000, co jest odwrotnością sensu — i dlatego domykające wywołanie też wróciło ucięte.
  *Gotowe, gdy:* test/przegląd potwierdza, że budżet domknięcia ≥ budżet ostatniego wywołania pętli.
  → **AC-6**
  *Zależy od:* T-6.

---

## Faza 2 — Częściowy plan zamiast wyrzucenia całości

- [x] **T-8** — **Odzysk kompletnych akcji z uciętego planu.**
  Czysta funkcja `odzyskajAkcjeZUcietego(content)` w `src/platform/ai/agentProtocol.ts` — wyciąga
  **zbalansowane** obiekty z tablicy `"actions"`, pomijając urwany na końcu. Mechanika jak
  w istniejącym `firstBalancedObject` (świadomym stringów i escape'ów).
  *Gotowe, gdy:* testy — plan urwany po 3 kompletnych akcjach zwraca **3**; urwanie **wewnątrz
  stringu** nie psuje odzysku; brak tablicy `actions` → pusta lista; pełny plan → wszystkie akcje.
  → **AC-7**

- [x] **T-9** — **Wpięcie odzysku w obu miejscach, przez jeden helper.**
  Blok degradacji w pętli **oraz** `finishPartialRun`: gdy odpowiedź była **ucięta** i dało się
  odzyskać choć jedną akcję → zwracamy `step:"plan"` z polami `niepelny: true` i `pominietoAkcji`.
  Dwa wywołania tego samego helpera, żeby ścieżki nie rozjechały się przy pierwszej zmianie.
  *Gotowe, gdy:* plan częściowy idzie **istniejącą** ścieżką (`normalizeActions` → panel
  potwierdzenia), a `DESTRUCTIVE_ACTION_TYPES` i logika 041 są **nietknięte**. → **AC-7**, **AC-9**
  *Zależy od:* T-8.

- [x] **T-10** — **Użytkownik WIDZI, że plan jest niepełny.**
  `AICommandSheet` buduje turę planu z zaszytą treścią „Zaproponowano N akcji" i **ignoruje `thought`
  z serwera** — dlatego informacja musi iść osobnym polem (plan §5). Rozszerzamy treść tury o zdanie
  o niekompletności; tekst do `messages/pl.json`, czytany przez `useTranslations`.
  *Gotowe, gdy:* `npm run check:i18n` zielony (zero literałów w komponencie), a plan pełny wygląda
  **dokładnie jak dotąd**. → **AC-8**
  *Zależy od:* T-9.

---

## Faza 3 — Bramki i domknięcie

- [x] **T-11** — **Nie naruszyliśmy dorobku 112.**
  Przegląd diffu: zero zmian w `czyCachowacKatalog`, `compactToolResults`, `offsetOf` i w
  `list_tasks` (`offset`/`includeDescription`).
  *Gotowe, gdy:* `git diff` na tych obszarach jest pusty i zapisane w `verify.md`. → **AC-14**

- [x] **T-12** — **Bramki (C-50, lokalny Postgres — nigdy prod, C-13).**
  Kolejno: `check:migrations` · `check:actions` · `check:ai-coverage` · `check:cost-badge` ·
  `check:i18n` · `check:logs` · `check:boundaries` · `check:module-registry` · `check:ui-contract` ·
  `test:unit` · `tsc --noEmit -p tsconfig.test.json` · `next lint --dir src` · `next build` ·
  `check:perf`. **Zatrzymujemy się przed `scripts/migrate.js`.**
  *Gotowe, gdy:* wszystkie zielone.
  *Zależy od:* T-1…T-11.

- [x] **T-13** — **Rachunek: czy naprawdę taniej (bramka, nie formalność).**
  Przeliczenie zmierzonej sesji z liczników tokenów i cennika z `LlmModelPrice`; porównanie z
  **1,42 zł**. Wymagane: taniej, mimo większego budżetu wyjścia.
  *Gotowe, gdy:* liczby wpisane do `verify.md`. **Jeśli wyjdzie drożej** — obniż próg „po odczycie"
  do wartości wynikającej z rachunku i **zaktualizuj `spec.md`/`plan.md`** (C-54), zamiast zostawić
  rozjazd. → **AC-13**
  *Zależy od:* T-12.

- [x] **T-14** — **Ślad w dokumentacji projektu.**
  `doświadczenia.md` — lekcja wg C-51: **wartość domyślna, która ukrywa błąd** („jak nie ma treści,
  weź pusty obiekt") wyłączyła strażnik i zamieniła prawdziwą diagnozę w fałszywą; plus obserwacja,
  że budżet ustalany z treści **wiadomości** nie może przewidzieć rozmiaru **odpowiedzi**.
  `CLAUDE.md` — akapit o 120 w sekcji asystenta.
  *Gotowe, gdy:* oba pliki zaktualizowane i zacommitowane **razem z fixem** (C-51 — bez pytania
  o zgodę).

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) | AC | Zadanie(a) |
|---|---|---|---|
| AC-1 | T-1, T-2 | AC-8 | T-10 |
| AC-2 | T-3 | AC-9 | T-9 |
| AC-3 | T-4 | AC-10 | T-13 (scenariusz — patrz notatka) |
| AC-4 | T-5, T-6 | AC-11 | T-13 (scenariusz) |
| AC-5 | T-5, T-6 | AC-12 | T-13 (scenariusz) |
| AC-6 | T-7 | AC-13 | T-13 |
| AC-7 | T-8, T-9 | AC-14 | T-11 |

**Żaden AC nie został bez pokrycia** (14/14).

## Ścieżka krytyczna

```
T-1 → T-2 → T-3 ─┐
T-4 [P] ─────────┤
                 ├→ T-5 → T-6 → T-7 → T-8 → T-9 → T-10 → T-11 → T-12 → T-13 → T-14
```

- **T-1 → T-2 → T-3 to jedyna twarda kolejność merytoryczna**: dopóki pusty obiekt udaje poprawną
  odpowiedź, ani strażnik ucięcia, ani licznik odpowiedzi bez kroku nie mają się o co zaczepić.
- **Faza 0 przed Fazą 1** z tego samego powodu, dla którego 112 robiło pamięć podręczną przed
  podniesieniem budżetu odczytu: najpierw przestajemy marnować, potem dokładamy.
- **T-13 blokuje domknięcie** — o koszt pytało zgłoszenie, więc rachunek jest bramką.

## Notatki / blokady

- **AC-10, AC-11, AC-12 są zachowaniami MODELU** (plan zawierający profil zwierzęcia i przeniesione
  obowiązki, lista informacji nieprzenoszalnych, nienaruszone zadania źródłowe). Sandbox nie ma
  poświadczeń do dostawcy, a odtworzenie tury wydałoby realne pieniądze z konta właściciela.
  Weryfikujemy **mechanizm** (że plan ma gdzie się zmieścić i że częściowy plan dociera do panelu),
  a scenariusz na żywo zostaje właścicielowi na `develop`. To samo ograniczenie wystąpiło w 112 —
  zapisujemy je z góry, zamiast udawać na końcu, że AC są spełnione „na oko".
