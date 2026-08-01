# Recenzja: 040 — Wiadomości i Pogoda, poprawki UX po 039

- **Data:** 2026-08-01
- **Diff:** `origin/develop...HEAD` — 24 pliki, +1396 / −298, 14 commitów
- **Podstawa:** `spec.md` (20 AC), `plan.md`, `verify.md` (GOTOWE, 20/20)

Recenzja celowała w to, czego `/verify` z natury nie łapie: zachowania asynchroniczne, warunki
brzegowe i styki. Jeden defekt naprawiłem w trakcie recenzji; reszta to uwagi.

## Ustalenia

### 1. ❗ Wyścig przy szybkim przeglądaniu propozycji — cudzy opis i cudze `id` pod kartą — NAPRAWIONE
- **Plik:** `src/components/weather/IdeasPanel.tsx:109` (`openIdea`)
- **Kategoria:** correctness
- **Opis:** `openIdea` nie miał żadnego guardu na to, że użytkownik w trakcie ładowania kliknie inną
  propozycję. Wszystkie `set*` w `.then()` wykonywały się bezwarunkowo.
- **Scenariusz awarii:** propozycja A nie ma jeszcze zapisanego planu, więc `generateIdeaDetail`
  woła model — to kilkanaście sekund. Użytkownik nie czeka i klika propozycję B. Gdy odpowiedź dla A
  wraca: `setDetail(opisA)` wypisuje **opis A pod kartą B**, a
  `setOpen((o) => ({ ...o /* B */, id: r.id /* wiersz A */ }))` podmienia B jego `id`. Kliknięcie
  „Zapisz" w tym stanie zapisuje **propozycję A pod pozorem B**. Dodatkowo `.finally()` z A gasiło
  spinner B, więc B wyglądała na gotową z cudzą treścią.
- **Dlaczego to teraz istotne:** defekt istniał od 037, ale wtedy szczegóły renderowały się pod całą
  listą, więc przełączanie w trakcie ładowania było nietypowe. **040 czyni ten scenariusz
  domyślnym** — właściciel wprost prosił o możliwość przeglądania kolejnych propozycji, a szczegóły
  stoją teraz przy kartach.
- **Poprawka:** `openFingerprintRef` — znacznik „która propozycja jest otwarta", sprawdzany przed
  każdym `set*` (`isStillOpen()`). Ten sam wzorzec, którym `lib/tts.ts` unieważnia spóźnione
  wypowiedzi (`speechGeneration`), więc nie wprowadzam nowej konwencji. Trzy szczegóły:
  - `markConsidered` wykonuje się **zawsze** — plan zapisał się w bazie, więc praca modelu nie może
    przepaść tylko dlatego, że użytkownik zajrzał gdzie indziej;
  - komunikat błędu też jest za guardem (błąd porzuconego zapytania nie ma czego zgłaszać);
  - `closeIdea()` (zamknięcie i zablokowanie propozycji) czyści ref, żeby odpowiedź nie wróciła do
    karty, której już nie ma.

### 2. ⚠️ `SourceDescriptorInput` może nadpisać tekst pisany w trakcie zapisu innego pola
- **Plik:** `src/components/news/NewsSettings.tsx` (`useEffect` synchronizujący `draft` z `value`)
- **Kategoria:** correctness, **nie naprawione — ryzyko teoretyczne**
- **Opis:** po zapisie dowolnego źródła leci `router.refresh()`, więc wszystkie pola dostają nowe
  propsy. `useEffect([value])` nadpisze `draft` tylko wtedy, gdy **`value` tego konkretnego źródła**
  się zmieniło — czyli nie w trakcie pisania w innym polu.
- **Scenariusz:** żeby stracić tekst, użytkownik musiałby pisać w polu źródła A dokładnie w chwili,
  gdy kończy się zapis **tego samego** źródła A wywołany wcześniej. Wymaga to podwójnej edycji
  jednego pola w ciągu jednego round-tripu.
- **Dlaczego zostawiam:** naprawa (porównanie z ostatnią wysłaną wartością) dokłada stan i gałąź do
  komponentu, który ma 30 linii, dla przypadku wymagającego walki użytkownika z samym sobą. To
  wzorzec obecny w repo (`AICommandSheet` robi tak samo z draftem konwersacji).

### 3. ⚠️ Znacznik „Monitorowany" nie przeżywa odświeżenia strony
- **Plik:** `src/components/news/HotTopics.tsx` (stan `monitored`)
- **Kategoria:** convention, **świadomy kompromis**
- **Opis:** oznaczenie żyje w pamięci komponentu, więc po `F5` karta znów pokaże „Monitoruj ten
  temat", mimo że temat jest już monitorowany. Ponowne kliknięcie utworzy **drugi temat o tej samej
  nazwie** (`createTopic` nie sprawdza duplikatów — zachowanie sprzed 040).
- **Dlaczego nieblokujące:** AC-7 mówi o informacji zwrotnej **w trakcie przeglądu**, a przegląd to
  jedno posiedzenie. Trwałe oznaczenie wymagałoby porównywania gorących tematów z listą
  monitorowanych po odcisku — realna funkcja, ale poza zakresem tej partii zgłoszeń (C-53).
- **Sugestia na przyszłość:** przy okazji dodawania „doboru z puli dla nowego tematu" (uwaga z
  recenzji 039) porównać `fingerprintOf(topic.title)` z gorącymi tematami i oznaczać trwale.

### 4. ℹ️ `ViewTabs` ma `role="tablist"` bez `tabpanel`
- **Plik:** `src/components/news/NewsPage.tsx` (`ViewTabs`)
- **Kategoria:** convention
- **Opis:** zakładki deklarują `role="tab"` i `aria-selected`, ale panele treści nie mają
  `role="tabpanel"` ani `aria-controls`. Czytnik ekranu ogłosi zakładki poprawnie, lecz nie powiąże
  ich z treścią. Reszta repo nie używa pełnego wzorca ARIA tabs, więc nie wyłamuję się tutaj sam —
  zgłaszam jako dług.

## Czego szukałem i nie znalazłem

- **Spójność migracji ze schematem:** `prisma migrate diff` (żywa baza ↔ `schema.prisma`) nie
  pokazuje **żadnej** różnicy w `NewsSource`. Jedyna zgłoszona różnica dotyczy `UserLlmPref.updatedAt`
  i jest zaszłością sprzed 040.
- **Kolejność w migracji:** `UPDATE` stoi **przed** `DROP COLUMN` — odwrotna kolejność wyzerowałaby
  wszystkie opisy. Sprawdzone w pliku, nie tylko w planie.
- **Guardy dostępu (C-21):** `createSource`/`updateSource` nietknięte w części autoryzacyjnej —
  `requireAuth()` + sprawdzenie `ownerId` przed zapisem.
- **`revalidatePath` (C-20):** obecne w obu zmienionych mutacjach.
- **Pusty opis:** ścieżka `descriptor: ""` przechodzi przez `updateSource` (warunek `!== undefined`,
  nie prawdziwość), `sourceColor` (kolor neutralny) i UI (brak pustego badge'a). Sprawdzone też
  zachowaniem w `/verify`.
- **C-30:** `sourceColor` zwraca wyłącznie `var(--…)`; licznik na zakładce tematu używa
  `var(--on-accent)` zamiast dawnego `text-white`.
- **Martwy kod:** `TopicList` usunięty w całości; `ChevronRight` zniknął także z importów;
  `LEANING_META`/`Leaning` nie występują nigdzie w `src`.
- **Nowa nawigacja a poziomy scroll:** `overflow-x-auto` **i** `min-w-0` na kontenerze zakładek —
  czyli nowy pasek nie odtwarza usterki, którą to samo wydanie naprawia.

## Bramki po poprawce

| Krok | Wynik |
|---|---|
| `check:migrations` / `check:actions` / `check:ai-coverage` / `check:cost-badge` / `check:content-memory` | ✅ |
| `tsc --noEmit` | ✅ |
| `next lint --dir src` | ✅ 0 błędów |
| `next build` | ✅ „Compiled successfully" |
| `npm run test:unit` | ✅ 567/567, 0 pominiętych |

## Werdykt

**APPROVE Z UWAGAMI.**

Jeden realny defekt (wyścig przy przeglądaniu propozycji) naprawiony w recenzji — istotny, bo mógł
zapisać nie tę propozycję, którą użytkownik widzi na ekranie, a nowy układ czynił go typowym zamiast
wyjątkowym. Trzy pozostałe ustalenia są nieblokujące: jedno wymaga walki użytkownika z samym sobą,
jedno to świadomie odłożona funkcja, jedno to dług a11y wspólny dla całego repo.
