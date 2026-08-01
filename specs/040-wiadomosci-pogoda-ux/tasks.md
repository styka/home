# Zadania: Wiadomości i Pogoda — poprawki UX po wdrożeniu 039

- **Plan:** ./plan.md (040-wiadomosci-pogoda-ux)
- **Status:** todo
- **Data:** 2026-08-01

> **Zasada listy:** od najłatwiejszego do najtrudniejszego, zgodnie z zależnościami. Zgłoszenia 2, 4
> i 6 są **całkowicie niezależne** od zmiany danych, więc idą pierwsze — każde zamyka jedno zgłoszenie
> właściciela i da się je wdrożyć osobno.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Zgłoszenia niezależne od zmiany danych

- [x] **T-1** `[P]` — **Poziomy scroll na telefonie.** `min-w-0` na `<span className="flex-1
      truncate">` z adresem RSS (`NewsSettings.tsx:98`) — `flex-1` daje `min-width:auto`, więc
      element nie może zwęzić się poniżej treści i `truncate` nigdy nie działa. Przegląd trzech
      widoków modułu pod tym samym wzorcem. **Bez** `overflow-x-hidden` na kontenerze strony.
      *Gotowe, gdy:* `grep` na `flex-1 truncate` bez `min-w-0` w module nie daje trafień, a w diffie
      nie ma nowego globalnego ukrycia przewijania. **(AC-15, AC-16)**

- [x] **T-2** `[P]` — **„Monitoruj temat" bez wyrzucania z listy.** `HotTopics.add()` przestaje
      wołać `onAdded()`; zamiast tego komunikat „Dodano temat „X" do monitorowanych" i lokalne
      oznaczenie karty jako monitorowanej (przycisk nieaktywny „Monitorowany"). Lista tematów w
      rodzicu odświeża się bez zmiany widoku.
      *Gotowe, gdy:* można oznaczyć kilka tematów pod rząd bez ani jednego powrotu do listy.
      **(AC-6, AC-7)**

- [x] **T-3** `[P]` — **Szczegóły propozycji w Pogodzie w miejscu kliknięcia.** Usunięcie przycisku
      `ChevronRight` („Pokaż szczegółowy plan") — klik w kartę robi to samo. `IdeaDetailSheet`
      renderowany bezpośrednio pod kliknięta pozycją zamiast pod całą listą; rozwinięta karta
      wyróżniona obramowaniem akcentem.
      *Gotowe, gdy:* skutek kliknięcia widać bez przewijania, naraz otwarta jest najwyżej jedna
      propozycja, a zamknięcie działa wprost. **(AC-17, AC-18, AC-19, AC-20)**

## Faza 1 — Fundament danych (opis źródła)

- [x] **T-4** — **Migracja `0219_opis_zrodla_wiadomosci`.** DDL wg planu §2.2 w kolejności:
      `ADD COLUMN "descriptor"` → `UPDATE` mapujący `left/center/right` na „Lewica"/„Centrum"/
      „Prawica" → `DROP COLUMN "leaning"`. Komentarz wprost o nieodwracalności `DROP` i o tym, że
      `UPDATE` musi go poprzedzać.
      *Gotowe, gdy:* `npm run check:migrations` przechodzi, `migrate deploy` na lokalnym Postgresie
      kończy się czysto, a żaden wiersz nie ma pustego `descriptor`. **(AC-4)**

- [x] **T-5** — **`schema.prisma`** zgodnie z migracją: `NewsSource.descriptor String @default("")`,
      `leaning` usunięte. Rodzaj jako `String` (C-12).
      *Gotowe, gdy:* `prisma generate` przechodzi bez rozjazdu ze schematem bazy.

## Faza 2 — Warstwa serwera

- [x] **T-6** `[P]` — **`src/lib/news/sourceColor.ts` + test.** `sourceColor(descriptor)` → nazwa
      zmiennej CSS z palety akcentów, wybierana stabilnie z tekstu znormalizowanego przez
      `fingerprintOf` (`lib/textKey.ts`); pusty opis → `--text-muted`.
      *Gotowe, gdy:* test pokrywa stabilność (ten sam opis → ten sam kolor), niewrażliwość na
      wielkość liter i diakrytyki, pusty opis i przynależność wyniku do palety. **(AC-3, AC-5)**

- [x] **T-7** — **`sources.ts` + `actions/news.ts` na `descriptor`.** Usunięcie `Leaning` i
      `LEANING_META`; `DEFAULT_SOURCES` z opisami po polsku (spójnie z migracją). W akcjach:
      `SourceDTO.descriptor`, `NewsItemDTO.sourceDescriptor`, `TimelineEntryDTO.sourceDescriptor`,
      `createSource`/`updateSource` przyjmują opis (przycięty do 60 znaków). `revalidatePath` bez
      zmian (C-20), guard bez zmian (C-21).
      *Gotowe, gdy:* `tsc --noEmit` nie zgłasza już `leaning` w warstwie akcji. **(AC-2)**

## Faza 3 — Warstwa AI

- [x] **T-8** — **Cztery miejsca warstwy AI na `descriptor`:** `agentPrompt.ts` (katalog akcji),
      `actionContract.ts` (`sel(...)` → kontrolka `text`, usunięcie `NEWS_LEANING_OPTIONS`),
      `executors/newsExecutor.ts` (walidacja z trzech wartości → dowolny tekst), `agentTools.ts`
      (`list_news_sources` zwraca opis).
      *Gotowe, gdy:* `npm run check:actions` i `npm run check:ai-coverage` przechodzą, a katalog
      akcji nie opisuje nieistniejącego pola. **(C-23)**

## Faza 4 — UI opisu źródła

- [x] **T-9** — **`NewsSettings`: pole tekstowe zamiast listy wyboru.** `<input type="text">` z
      `maxLength={60}` i podpowiedzią „np. pop-science, lewica", w wierszu źródła i w formularzu
      dodawania. Zapis jak dotąd.
      *Gotowe, gdy:* na ekranie nie ma już listy „Lewica/Centrum/Prawica", a wpisany opis zapisuje
      się i wraca po odświeżeniu. **(AC-1)**

- [x] **T-10** — **Opis i kolor w trzech miejscach prezentacji:** badge na karcie wiadomości
      (`NewsItemCard`), kropka przy zakładce źródła (`NewsPage`), kropka na osi czasu
      (`NewsTimeline`) — wszystkie przez `sourceColor(descriptor)`. Puste opisy nie zostawiają pustej
      plamy.
      *Gotowe, gdy:* źródła są rozróżnialne kolorem, a źródło bez opisu wygląda poprawnie.
      **(AC-2, AC-3, AC-5)**

## Faza 5 — Układ i nawigacja Wiadomości

- [x] **T-11** — **Pasek widoków modułu.** `Tematy` · `Gorące tematy` · `Źródła` jako poziomy pasek
      pod nagłówkiem, obecny w **każdym** trybie i wyraźnie oznaczający aktywny. Zastępuje dzisiejsze
      przyciski-przełączniki w nagłówku (nie dublujemy).
      *Gotowe, gdy:* z „Źródeł" i „Gorących tematów" wraca się jednym dotknięciem, także na telefonie,
      a z ekranu widać, gdzie się jest. **(AC-13, AC-14)**

- [x] **T-12** — **Zakładki tematów zamiast kolumny.** Usunięcie `md:grid-cols-[240px_1fr]`; tematy
      jako poziomy pasek zakładek z pełnymi nazwami (bez `truncate`) i licznikiem nowych, przewijany
      **we własnym kontenerze** (`overflow-x-auto`), nie stroną. Zarządzanie tematami (dodaj/edytuj/
      usuń) przenosi się do tego paska i do akcji przy aktywnym temacie.
      *Gotowe, gdy:* treść zajmuje pełną szerokość, długie nazwy są czytelne w całości, a strona
      nadal nie przewija się w poziomie. **(AC-8, AC-9, AC-12, AC-15)**

- [x] **T-13** — **Przełącznik treści tematu.** Dwa segmenty: `Nowe wiadomości (N)` /
      `Linia czasu (M)`, domyślnie wiadomości. Wybór trzymany niezależnie od wybranego tematu.
      *Gotowe, gdy:* po wejściu w temat pierwsze widać nowe wiadomości, a przełączenie na linię czasu
      przeżywa zmianę tematu. **(AC-10, AC-11)**

## Faza 6 — Bramki i domknięcie

- [ ] **T-14** — **Pełna sekwencja bramek na lokalnym Postgresie (C-13):** `copy-docs →
      check:actions → check:ai-coverage → check:cost-badge → check:content-memory →
      check:migrations → next lint → prisma generate → next build` + `npm run test:unit`.
      **Bez** `scripts/migrate.js`.
      *Gotowe, gdy:* wszystkie kroki zielone. **(C-50)**

- [ ] **T-15** — **Dokumentacja** — `CLAUDE.md`: moduł Wiadomości po zmianie układu (pasek widoków,
      zakładki tematów, przełącznik treści), `NewsSource.descriptor` w schemacie zamiast `leaning`.
      *Gotowe, gdy:* dokumentacja opisuje stan po zmianie.

- [ ] **T-16** — **`doświadczenia.md` (C-51)** — lekcja o `flex-1 truncate` bez `min-w-0` jako
      przyczynie poziomego przewijania („nie widać nawet co", bo tekst ucina krawędź ekranu, a nie
      `truncate`).

- [ ] **T-17** — **Mapowanie AC → wynik** jako wejście do `/verify`.

---

## Mapowanie kryteriów akceptacji na zadania

| AC | Zadanie(a) |
|---|---|
| AC-1 pole tekstowe zamiast listy wyboru | T-9 |
| AC-2 opis widoczny w prezentacji | T-7, T-10 |
| AC-3 kolor stabilny i rozróżnialny | T-6, T-10 |
| AC-4 migracja nie zostawia pustych opisów | T-4 |
| AC-5 pusty opis nie psuje widoku | T-6, T-10 |
| AC-6 „Monitoruj" nie wyrzuca z listy | T-2 |
| AC-7 potwierdzenie zapisu + oznaczenie | T-2 |
| AC-8 brak osobnej kolumny na desktopie | T-12 |
| AC-9 pełne nazwy tematów | T-12 |
| AC-10 najpierw nowe wiadomości | T-13 |
| AC-11 wybór widoku przeżywa zmianę tematu | T-13 |
| AC-12 jeden mechanizm nawigacji | T-12 |
| AC-13 powrót jednym dotknięciem | T-11 |
| AC-14 widać, gdzie jestem | T-11 |
| AC-15 brak poziomego scrolla | T-1, T-12 |
| AC-16 naprawa przyczyny, nie objawu | T-1 |
| AC-17 szczegóły w polu widzenia | T-3 |
| AC-18 brak dublującego przycisku | T-3 |
| AC-19 jedna rozwinięta propozycja | T-3 |
| AC-20 jawne zamknięcie szczegółów | T-3 |

## Ścieżka krytyczna

```
T-4 (migracja) → T-5 (schemat) → T-7 (akcje) → T-8 (AI)
                                      ↓
                              T-9, T-10 (UI opisu)

T-11 → T-12 → T-13   (układ; niezależne od gałęzi danych)

T-1, T-2, T-3        (bez żadnych zależności — mogą iść pierwsze)
```

- **Blokuje najwięcej:** `T-4`/`T-5` — bez nich `descriptor` nie istnieje w typach, więc `T-7`..`T-10`
  nie skompilują się.
- **Można zrównoleglić:** cała Faza 0 (`T-1`, `T-2`, `T-3`) oraz `T-6` (helper koloru nie zależy od
  schematu — bierze zwykły `string`).
- **`T-14` (bramki) musi być po wszystkim** — wcześniej `check:actions` świeciłby na czerwono przez
  rozjazd katalogu akcji z polem `descriptor`.

## Notatki / blokady

- **T-4 zawiera jedyny nieodwracalny krok** (`DROP COLUMN "leaning"`). Poprzedza go `UPDATE`
  przenoszący treść, ale rollback samego kodu **bez** rollbacku migracji nie zadziała — stary kod
  czyta nieistniejącą kolumnę.
- **T-12 może sam stać się źródłem poziomego scrolla**, który naprawia T-1. Weryfikacja AC-15 musi
  objąć widok „Tematy" po przebudowie, nie tylko „Źródła".
