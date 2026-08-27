# Weryfikacja: Profesjonalny system przewodników użytkownika

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (108-system-przewodnikow)
- **Data:** 2026-08-27
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`, `127.0.0.1:5432`) — **nigdy prod** (C-13).
  `scripts/migrate.js` **nie był uruchamiany**.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| 35 skryptów kontrolnych z `build` (`copy-*` ×6, `check-*` ×29) | ✅ wszystkie zielone, `FAIL=0` |
| `check:migrations` | ✅ (brak nowych migracji — feature nie rusza schematu) |
| `check:actions` (`check-action-coverage`) | ✅ (brak nowych `AIAction`) |
| `check:ui-contract` | ✅ `24/24 modułów na ModuleView; 28 plików z zadeklarowanymi kolorami` |
| `check:i18n` | ✅ `zero tekstów zaszytych w komponentach` |
| `check:schema-drift` | ✅ `brak rozjazdu` (na lokalnej bazie, nie skip) |
| `check:boundaries`, `check:module-registry` | ✅ |
| `next lint --dir src` | ✅ zero błędów; zero ostrzeżeń w plikach tej zmiany (~64 kosmetyczne ostrzeżenia sprzed zmiany zostają) |
| `tsc --noEmit` (aplikacja) | ✅ czysto |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto |
| `tsc --noEmit -p e2e/tsconfig.json` | ✅ czysto |
| `next build` (lokalny Postgres) | ✅ przeszedł; `/guide` 10,7 kB / 147 kB, `/guide/[slug]` 6,81 kB / 119 kB |
| `check:perf` | ✅ `najcięższa trasa 1174 kB, suma 68881 kB — w paśmie ±5%` → **próg nietknięty** |
| `npm run test:unit` | ⚠️ 965 przechodzi, **1 pada** — patrz „Regresje" (porażka sprzed zmiany) |
| E2E (`scripts/e2e-web.sh --project=desktop e2e/specs/przewodniki.spec.ts`) | ✅ **15/15 passed (11,0 s)** |

## 2. Kryteria akceptacji

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — ikona pomocy w Notatkach otwiera przewodnik po Notatkach | ✅ | E2E `[AC-1]`: na `/notes/all` widoczny `link[name="Przewodnik po Notatkach"]`, klik → `/guide/notatki`. Kod: `NotesPage.tsx:217,239` (`hrefPrzewodnikaModulu("notes")` → prop `help`), `ViewBar.tsx:178` (`PrzyciskPomocy`) |
| **AC-2** — moduł bez przewodnika nie ma ikony | ✅ | E2E `[AC-2]`: na `/habits` `link[name=/^Przewodnik po/]` ma `count 0`. Test jednostkowy: `hrefPrzewodnikaModulu("habits") === undefined`. Mechanizm jest **typowy, nie warunkowy** — `help` jest opcjonalny, więc `undefined` znaczy „brak ikony" |
| **AC-3** — dział z rozróżnieniem „gotowe"/„wkrótce" | ✅ | E2E `[AC-3]` ×2: `/guide` pokazuje nagłówki „Gotowe przewodniki" i „Wkrótce"; klik w kafelek Notatek → `/guide/notatki` z widoczną treścią. Lista „wkrótce" liczona z `MODULES` (`src/app/guide/page.tsx:52`) |
| **AC-4** — wejście z Ustawień | ✅ | E2E `[AC-4]`: `link[name="Otwórz przewodniki"]` z `href="/guide"`. Kod: `src/app/settings/page.tsx` (sekcja „Pomoc i przewodniki" nad „Prywatność i dane") |
| **AC-5** — spis treści przechodzi do rozdziału i wskazuje bieżący | ✅ | E2E `[AC-5]`: przed klikiem `#11-pomysly` ma `top > 1000 px`, po kliknięciu pozycji spisu `top < 300 px`. Wskazanie bieżącego: `IntersectionObserver` + `aria-current` (`PrzewodnikReader.tsx:63–79, 158`) |
| **AC-6** — wyszukiwanie wskazuje rozdział | ✅ | E2E ×3: „wikilink" → wynik z `href` zawierającym `#04-wikilinki`; „zalacznik" (bez ogonków, wielkimi) → trafia w „Załączniki"; „zyrafanarowerze" → stan pusty. Testy jednostkowe `szukajWPrzewodnikach` ×4 |
| **AC-7** — komplet funkcji modułu opisany | ✅ | Przegląd treści: markdown+podgląd (3 pliki), foldery (9), tagi (9), wikilinki (5), wyszukiwanie (5), załączniki (5), historia wersji (4), udostępnianie (7), asystent (6), kosz (4), skróty (5). Fakty sprawdzane w kodzie, nie z pamięci — stąd limit 2,5 MB, 20 wersji, 30 dni retencji |
| **AC-8** — zachowania brzegowe (≥5) | ✅ | Wszystkie pięć obecne: wikilink do nieistniejącej notatki (`04`, `12`), zmiana tytułu zrywa odnośniki (`04`, `12`), co widzi obdarowany (`07`, `12`), usunięcie → kosz + 30 dni (`09`, `12`), tag vs folder (`03`, `12`). Dodatkowo: dwie notatki o tym samym tytule → pierwsza z brzegu, HTML ekranowany, limit załącznika |
| **AC-9** — ≥10 pomysłów | ✅ | `11-pomysly.md` — **16** ponumerowanych zastosowań (`grep -c '^\*\*[0-9]\+\.'`), od hasła do wifi po CRM na wikilinkach i dziennik decyzji |
| **AC-10** — czytelność przy 360 px | ✅ | E2E `[AC-10]` przy `360×720`: przycisk „Spis treści" widoczny, `scrollWidth − clientWidth ≤ 1 px` (brak przewijania w poziomie) |
| **AC-11** — odnośniki wewnętrzne bez przeładowania | ✅ | E2E `[AC-11]`: znacznik na `window` ustawiony przed klikiem **przeżywa** nawigację `/guide/asystent` → `/guide/notatki`, co dowodzi nawigacji SPA (pełne przeładowanie by go skasowało). Kod: `PrzewodnikReader.tsx:100` |
| **AC-12** — moduł bez uprawnienia nie jest podsuwany | ✅ | E2E `[AC-12]` na koncie z samym `module.home`: kafelek Notatek **widoczny** z komunikatem „Nie masz dostępu do tego modułu", ale `link[name=/Notatki/]` ma `count 0`; przewodnik niemodułowy (Asystent) pozostaje odnośnikiem |
| **AC-13** — bramki zielone | ✅ | Tabela w §1. Jedyny minus to porażka testu jednostkowego sprzed zmiany (§4) |

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** | ✅ cały kod w `worldofmag/`; artefakty pipeline'u w `specs/` (C-03) |
| **C-10..C-14** | ✅ nie dotyczy — zero zmian schematu, zero migracji (uzasadnione w planie §2). `check:schema-drift` i `check:migrations` zielone |
| **C-13** | ✅ build i migracje wyłącznie na lokalnym Postgresie; `migrate.js` nietknięty |
| **C-20, C-21** | ✅ nie dotyczy — brak mutacji i brak zasobu użytkownika |
| **C-22** | ✅ bez nowego sluga i bez wpisu w rejestrze modułów; obie trasy wymagają sesji (`redirect("/auth/signin")`) |
| **C-23, C-40, C-41** | ✅ nie dotyczy |
| **C-30** | ✅ zero hexów w nowych komponentach — potwierdza `check:ui-contract` (trzecia kontrola) |
| **C-31** | ✅ spis treści ma wariant mobilny (przycisk + `AnchoredLayer`), pozycje spisu `minHeight: 44`, `Esc` zamyka warstwę (obsługa `AnchoredLayer`) |
| **C-32** | ✅ wszystkie etykiety przez `t()` w `messages/pl.json`; data przez `formatujDate`, nie `toLocaleDateString("pl-PL")`. Treść przewodnika jest **dokumentem**, nie interfejsem — bramka skanuje wyłącznie `.tsx`, więc granica wynika z zakresu bramki, a nie z wyjątku |
| **C-33** | ✅ oba widoki przez `ModuleView` ze `state`; wejście z modułu to **poszerzenie ramy** (slot `help`), nie wyjątek w Notatkach |
| **C-34** | ✅ nie dodano potwierdzeń; **poprawiono** dwa istniejące (patrz §4) |
| **C-35** | ✅ slot `help` dowieziony razem z pierwszym konsumentem (Notatki) |
| **C-36** | ✅ trasy cienkie; `check:boundaries` i `check:module-registry` zielone; `lib/przewodniki.ts` nie sięga do wnętrza modułu, a lista „wkrótce" jest liczona — żadnej równoległej listy modułów |
| **C-50** | ✅ `next build` zielony (bez `migrate.js`, zgodnie z C-13) |
| **C-51** | ✅ wpis „Pisanie przewodnika jako audyt…" w `doświadczenia.md`, zacommitowany razem z poprawką |
| **C-53** | ✅ zero nowych zależności; reużyte `markdownToHtml`, `MARKDOWN_STYLES`, `ModuleView`, `AnchoredLayer`; normalizacja frazy w jednym miejscu dla serwera i klienta |
| **C-54** | ✅ artefakty spójne — `tasks.md` odhaczony z notatkami o wyniku T-21 i o znalezisku spoza zakresu |

## 4. Regresje i znaleziska

- **Wspólna rama widoku (21 modułów).** Zmiana dotyka `ModuleView`/`ViewBar`, więc ryzyko jest
  szerokie. Widok bez `help` renderuje się jak dotąd — potwierdzone przez `next build` (wszystkie
  trasy) oraz przez to, że dodane warunki są **rozszerzeniem alternatywy** (`|| !!help`), a nie
  zmianą istniejących gałęzi. Notatki są przypadkiem granicznym (brak `actions` i `settings`)
  i właśnie na nich E2E potwierdza, że ikona się rysuje.
- **Poprawka wykryta przy pisaniu treści (w zakresie).** Oba okna potwierdzenia usunięcia notatki
  (`NotesPage.tsx`, `NoteRow.tsx`) twierdziły „Tej operacji nie można cofnąć", choć `deleteNote`
  zapisuje migawkę do kosza z 30-dniową retencją. Komunikaty mówią teraz to, co robi kod — inaczej
  przewodnik stałby w sprzeczności z aplikacją. Lekcja w `doświadczenia.md` (C-51).
- **Porażka testu jednostkowego sprzed zmiany.** `assertOwnership: tłumaczy rozstrzygnięcie na
  wyjątki i wymaga odczytu kontekstu (078)` pada **także na czystym drzewie** — sprawdzone przez
  `git stash` (identyczny wynik: 965 pass / 1 fail przed i po). Nie jest skutkiem tej zmiany i nie
  był naprawiany; odnotowany jako zastany dług.
- **Usterka w pierwszej wersji testu, nie w produkcie.** `page.locator("#11-pomysly")` rzuca
  wyjątkiem, bo identyfikator zaczynający się cyfrą nie jest poprawnym **selektorem CSS** (choć jest
  legalnym identyfikatorem HTML5 i działa w `getElementById` oraz w kotwicy adresu — a właśnie tego
  używa czytnik). Test poprawiony na selektor atrybutowy; produkt bez zmian.
- **Budżet wydajnościowy bez zmiany progu.** Indeks wyszukiwania jedzie do przeglądarki jako dane
  RSC, nie jako paczka JS, więc kod trasy `/guide` to 10,7 kB. Suma zmieściła się w paśmie ±5 %,
  więc `perf-baseline.json` nie był ruszany.

## 5. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 13 kryteriów akceptacji spełnione i **behawioralnie** potwierdzone (15 testów E2E na
zbudowanej aplikacji plus 8 testów jednostkowych), wszystkie bramki zielone, budżet wydajnościowy
w paśmie.

Uwagi, żadna nieblokująca:
1. Jeden test jednostkowy pada **sprzed tej zmiany** (`assertOwnership`, 078) — udowodnione przez
   `git stash`. Zastany dług, poza zakresem tego feature'a.
2. Przy okazji poprawiono dwa komunikaty potwierdzenia w Notatkach, które kłamały o nieodwracalności
   usunięcia. Zmiana jest w duchu feature'a (przewodnik nie może być sprzeczny z aplikacją), ale
   formalnie wykracza poza pierwotny zakres speca — odnotowane świadomie, a nie po cichu.
3. Testy E2E biegły w projekcie `desktop`; projekt `mobile` używa WebKita, którego nie ma w tym
   środowisku i nie da się pobrać. AC-10 zweryfikowano przez ustawienie okna 360×720 w Chromium —
   to sprawdza układ, ale nie silnik Safari.
