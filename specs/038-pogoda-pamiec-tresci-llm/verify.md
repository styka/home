# Weryfikacja: Pogoda — dopracowanie + przekrojowa pamięć treści AI

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (23/23 odhaczone)
- **Data:** 2026-07-31

## 1. Bramki techniczne

Wszystko na **lokalnym Postgresie** (`omnia_dev`), nigdy przeciw produkcyjnej bazie (C-13).
`scripts/migrate.js` — ostatni krok `npm run build` — **świadomie pominięty**, bo rusza bazę Neon.

| Komenda | Wynik |
|---|---|
| `npx prisma migrate deploy` | ✅ `0216_pamiec_tresci_ai_i_nasiona_pomyslow` zaaplikowana czysto |
| `npm run check:migrations` | ✅ „następny wolny numer: 0217" |
| `npm run check:actions` | ✅ 160 akcji, wszystkie z egzekutorem i kontraktem |
| `npm run check:ai-coverage` | ✅ 520 akcji sklasyfikowanych, każda z guardem |
| `npm run check:cost-badge` | ✅ 32 pliki, każdy przekazuje zużycie |
| `npm run check:content-memory` (**nowa**) | ✅ 32 pliki sklasyfikowane (4 z pamięcią treści, 28 narzędzi na żądanie) |
| `npx next lint --dir src` | ✅ 16 ostrzeżeń — **wszystkie zastane**, żadne w plikach tej zmiany |
| `npx next build` | ✅ „Compiled successfully" |
| `npm run test:unit` | ✅ 468 pass / **0 fail** / 27 skipped — w tym 5 nowych testów faz księżyca |
| `npx tsc --noEmit` | ✅ czysto |

## 2. Kryteria akceptacji

Legenda: ✅ spełnione · ⚠️ z zastrzeżeniem · ❌ niespełnione · 🔍 zweryfikowane przez prześledzenie
kodu (bez uruchomienia UI — patrz §5) · ▶️ **zweryfikowane wykonaniem na żywej bazie**.

### Dowód wykonania mechanizmu pamięci (podstawa dla AC-4, AC-5, AC-6)

Skrypt uruchomiony na lokalnym Postgresie, licznik `calls` zlicza **rzeczywiste wywołania funkcji
generującej**. Konto testowe utworzone i usunięte:

```
1. pierwsze wywołanie → {"tips":["wersja 1"]} | model wołany: 1 | z pamięci: false
2. powrót na stronę   → {"tips":["wersja 1"]} | model wołany: 1 | z pamięci: true  | nieaktualne: false
3. zmienione warunki  → {"tips":["wersja 1"]} | model wołany: 1 | nieaktualne: true (treść ta sama = NIE generowano samo z siebie)
4. jawne odświeżenie  → {"tips":["wersja 2"]} | model wołany: 2 | odświeżeń: 1
5. znów powrót        → {"tips":["wersja 2"]} | model wołany: 2 | nieaktualne: false
6. kaskada po usunięciu użytkownika, pozostało wpisów: 0
```

Wiersz 3 jest tu najważniejszy: mimo zmienionych warunków treść **nie została wygenerowana od nowa** —
mechanizm tylko zapalił znacznik nieaktualności. To dokładnie zasada, o którą prosił właściciel.

### Naprawa „Brak propozycji"

| AC | Werdykt | Dowód |
|---|---|---|
| AC-1 lista dla każdej pory, także nocnej | ✅ 🔍 | Prompt zawiera wprost: *„Pora nocna NIE jest powodem, by nie proponować niczego… Pusta lista jest ZAWSZE złą odpowiedzią"*; `resolveWhen` przy porze bez godzin schodzi na cały dzień, więc dane zawsze są |
| AC-2 awaria ≠ „brak propozycji" | ✅ | Trzy warstwy: `chat.ts:319` `if (cacheKey && !res.truncated)` (uszkodzona odpowiedź nie utrwala się w pamięci podręcznej), `weather.ts:597` `if (res.truncated) throw`, `weather.ts:605` `if (parsed == null) throw`; UI ma osobny stan błędu z ikoną i obwódką `--accent-amber`, wizualnie różny od stanu pustego |
| AC-3 pora, która minęła | ✅ 🔍 | `resolveWhen`: gdy filtr godzin dla pory daje pustkę, bierze wszystkie godziny wybranego dnia — zachowanie zastane, potwierdzone przeglądem |

### Pamięć treści AI

| AC | Werdykt | Dowód |
|---|---|---|
| AC-4 powrót bez kosztu | ✅ ▶️ | Wiersz 2 dowodu: `model wołany: 1` po drugim wejściu, `z pamięci: true` |
| AC-5 zmiana na znane parametry bez kosztu | ✅ ▶️ | Wiersz 5; `scopeKey` zawiera dzień i porę, więc każdy zestaw ma własny wpis, a powrót do znanego trafia w pamięć |
| AC-6 oznaczenie nieaktualności bez samoczynnej generacji | ✅ ▶️ | Wiersz 3: `nieaktualne: true`, treść **niezmieniona**, licznik wywołań **niezmieniony** |
| AC-7 jeden przycisk generowania | ✅ 🔍 | `IdeasPanel`: w nagłówku jeden `Button` „Nowe propozycje" (`RefreshCw`); biblioteka to teraz odnośnik tekstowy „Zapisane pomysły →" w stopce, wizualnie odróżniony |
| AC-8 pamięć w innych modułach + data + odświeżenie | ✅ 🔍 | `AiContentMeta` (wspólny komponent) w: `IdeasPanel`, `StorageAnalytics` („Nowe wnioski"), `WelfareSuggestions`, `PlanWeekDialog` („Nowy plan"). Handlery `magazynInsights`, `petsInsights`, `kitchenPlanWeek` przechodzą przez `rememberedContent` |
| AC-9 bramka na nowe treści | ✅ | `scripts/check-content-memory.js` w `build` i jako `npm run check:content-memory`; wymaga jawnej klasyfikacji **i** sprawdza, że plik oznaczony `remembered` faktycznie używa `rememberedContent` — sama deklaracja nie wystarczy |

### Leniwe generowanie i zapis pomysłu

| AC | Werdykt | Dowód |
|---|---|---|
| AC-10 zapis z listy bez kosztu | ✅ ⚠️ | `saveIdeaFromList` nie zawiera **żadnego** wywołania modelu (weryfikacja: brak `chatComplete` w ciele funkcji) — robi `upsert` + zapis nasion. **Zastrzeżenie uczciwości:** funkcja woła `buildSeed` → `fetchForecast`, czyli jedno zapytanie do Open-Meteo. To usługa **darmowa i bez klucza**, więc „bez kosztu" w sensie rachunku za AI jest spełnione, ale nie jest to operacja czysto lokalna |
| AC-11 opis przy pierwszym wejściu | ✅ 🔍 | `IdeasPanel.openIdea` pyta najpierw `getIdeaDetail` (czysty odczyt z bazy) i tylko przy braku zapisu woła `generateIdeaDetail` |
| AC-12 opis z warunków z chwili zaproponowania | ✅ | `generateIdeaDetail` używa `existing.seedWeather`, gdy istnieje, i tylko przy jego braku sięga po bieżącą prognozę. Kolumny `seedDate`/`seedPart`/`seedWeather` zapisuje zarówno `saveIdeaFromList`, jak i pierwsza generacja opisu |

### Dane astronomiczne i ikony

| AC | Werdykt | Dowód |
|---|---|---|
| AC-13 wschód/zachód + faza księżyca | ✅ | Pasek w `ForecastNow` z `today.sunrise`/`today.sunset` (dane **już pobierane**, wcześniej nieużywane) + `moonPhase()`. **Test jednostkowy** na trzech rzeczywistych nowiach, trzech pełniach i obu kwadrach — przechodzi |
| AC-14 mieści się na telefonie | ✅ 🔍 | `flex flex-wrap gap-x-4 gap-y-1` + `whitespace-nowrap` na pojedynczych pozycjach — zawija się do kolejnego wiersza zamiast rozpychać kontener |
| AC-15 ikony nocne w pasku godzin | ✅ | `ForecastView:90` `wmo(h.code, !h.isDay)`; `is_day` dołożone do parametrów godzinowych zapytania, `HourPoint.isDay` mapowane w `openMeteo.ts:186` |
| AC-16 ikona nocna w „Teraz" | ✅ | `ForecastView:25` `wmo(cur.code, !cur.isDay)` — `current.isDay` było pobierane od zawsze i **nieużywane**, co było bezpośrednią przyczyną słońca o drugiej w nocy |

### Mobile

| AC | Werdykt | Dowód |
|---|---|---|
| AC-17 kafelek obserwatora na telefonie | ✅ 🔍 | Tytuł w osobnym bloku z `break-words`, znaczniki (status + horyzont) w `flex-wrap` pod nim, akcje w `shrink-0` z celami `p-2` |
| AC-18 górny margines bezpieczny | ✅ | `IdeaDetailSheet:67` `pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3`. Dolny margines istniał od 037 — brakowało **wyłącznie** górnego, stąd nagłówek pod zegarem i kamerką |
| AC-19 spójność biblioteki pomysłów | ✅ 🔍 | Strona używa `pageContainerStyle` + `pageInnerStyle` + `PageHeader` — tych samych elementów co `/portfel/budzety` i pozostałe podstrony działów — zamiast własnego nagłówka |

**Podsumowanie:** 19 × ✅ (w tym jedno z zastrzeżeniem uczciwości przy AC-10), 0 × ❌.

## 3. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01 / C-02 | ✅ praca w `worldofmag/`, importy przez alias |
| C-10 / C-11 | ✅ ręczna migracja `0216`, numer z `next:migration`, bramka zielona |
| C-12 zero enumów | ✅ `AiContentKind` i `seedPart` jako `String` + union TS |
| C-13 nigdy prod DB | ✅ wszystko lokalnie, `migrate.js` pominięty |
| C-20 Server Actions + `revalidatePath` | ✅ `saveIdeaFromList` rewaliduje `/pogoda` i `/pogoda/pomysly` |
| C-21 własność + guard | ✅ `rememberedContent` przyjmuje `ownerId` i kluczuje po nim; `saveIdeaFromList` przez `requireAuth` |
| C-22 RBAC | ✅ bez nowych slugów |
| C-23 `AIAction` | ✅ żadnej nowej akcji AI; `check:actions` bez zmian |
| C-24 kosz | ✅ zapamiętana treść jest odtwarzalna, więc świadomie **nie** wchodzi do kosza (decyzja ze spec §6) |
| C-30 zmienne CSS | ✅ zero hexów; znacznik nieaktualności i stan błędu na `var(--accent-amber)` |
| C-31 mobile | ✅ trzy zgłoszenia mobilne to sedno tej zmiany; `safe-area` góra **i** dół, cele `p-2`/`py-3`, zawijanie zamiast przewijania w poziomie |
| C-32 teksty PL | ✅ całe UI, komunikaty błędów i nazwy faz księżyca |
| C-40 routing modeli | ✅ wyłącznie `chatComplete({op})` |
| C-50 / C-51 | ✅ komplet bramek + testy; dwa wpisy w `doświadczenia.md` |
| C-53 minimalizm | ✅ **jeden** generyczny model pamięci zamiast kolumn w trzech modułach; **jeden** komponent `AiContentMeta` zamiast czterech kopii tej samej linijki; wschód/zachód z danych już pobieranych; ikony nocne jako parametr istniejącej funkcji; **zapowiadana akcja `getWeatherAstro` skreślona** jako zbędna; zero nowych zależności |
| C-54 spójność | ✅ skreślenie `getWeatherAstro` odnotowane w `plan.md` i `tasks.md` z uzasadnieniem |

**Naruszenia: brak.**

## 4. Regresje

| Obszar | Sprawdzenie | Wynik |
|---|---|---|
| Zmiana w `chat.ts` | Dotyka **wszystkich** konsumentów `cache: true`. Zmiana jest zawężająca (mniej wpisów w cache) | ✅ najgorszy możliwy skutek to jedno dodatkowe wywołanie modelu; nigdy błędna treść |
| Migracja a stara wersja kodu | Wyłącznie addytywna (nowa tabela + kolumny `NULL`) | ✅ rollback bez kroku wstecz na bazie |
| Kaskada usunięcia użytkownika | Test na żywej bazie (wiersz 6 dowodu) | ✅ `AiContent` znika razem z `User` |
| `wmo()` — nowy parametr | Domyślnie `false`, więc **wszystkie** istniejące wywołania zachowują się identycznie | ✅ `tsc` czysto, brak zmian w pozostałych konsumentach |
| `onClick={loadTips}` w Magazynie | Po dodaniu parametru `force` przekazywałby `MouseEvent` jako `force` — czyli każde kliknięcie wymuszałoby generowanie | ✅ **złapane przez typy i naprawione** (`onClick={() => loadTips()}`); ten sam wzorzec poprawiony w `PlanWeekDialog` |
| Zapamiętana treść a blokowanie pomysłów | Pamiętamy **surową** listę od modelu, stan użytkownika dokładamy przy odczycie | ✅ zablokowanie pozycji usuwa ją natychmiast, bez generowania czegokolwiek |
| Plan tygodnia Kuchni | Pierwsze „Generuj plan" korzysta z pamięci; „Nowy plan" wymusza | ✅ ponowne otwarcie okna dla tego samego tygodnia nie kosztuje |
| Pozostałe moduły | Sklasyfikowane jako `on-demand`, bez zmian zachowania | ✅ narzędzia (tagi, parsowanie, wyszukiwanie) działają jak dotąd |

## 5. Ograniczenia weryfikacji (uczciwie)

- **Nie uruchamiałem aplikacji w przeglądarce.** Kryteria wymagające oceny wzrokowej — układ kafelka
  obserwatora na wąskim ekranie (AC-17), widoczność nagłówka pod wcięciem na kamerkę (AC-18),
  spójność stylistyczna biblioteki (AC-19), zawijanie paska astronomicznego (AC-14) — są **poprawne
  w kodzie**, ale nie zostały obejrzane na żywym ekranie. Zwłaszcza AC-18 warto potwierdzić na
  prawdziwym telefonie z wcięciem, bo `env(safe-area-inset-top)` zwraca 0 w emulatorach bez wcięcia.
- **Nie wywoływałem prawdziwego modelu.** AC-1 (niepusta lista dla pory nocnej) zweryfikowałem na
  poziomie **promptu**, który teraz wprost zakazuje pustej odpowiedzi i nakazuje propozycje domowe
  lub nocne. Czy model faktycznie posłucha — pokaże użycie. Natomiast **przyczyna zgłoszenia była
  inna niż jakość promptu** (utrwalona w cache ucięta odpowiedź) i ta jest naprawiona dowodliwie.
- **AC-10 — zastrzeżenie zapisane wprost w tabeli:** zapis pomysłu nie kosztuje AI, ale wykonuje
  jedno darmowe zapytanie pogodowe. Nie nazywam tego „zerowym kosztem", żeby nie ukrywać faktu.
- **Zakres:** ten przebieg celowo **nie obejmuje** modułu Wiadomości (zgłoszenia 1, 2, 3, 12) ani
  bazy wiedzy o użytkowniku (zgłoszenie 10) — decyzja właściciela z etapu `/specify`, wypisana w
  `spec.md` §5 wraz z już podjętymi decyzjami projektowymi dla tamtych zadań.

## 6. Werdykt końcowy

**GOTOWE.**

Wszystkie bramki przechodzą, wszystkie 19 kryteriów akceptacji jest spełnionych, żadne nie jest
niespełnione. Kluczowe zgłoszenie („Brak propozycji", ponad pięć prób) ma naprawę **udowodnioną co do
przyczyny**, nie zgadniętą: awaria utrwalała się w pamięci podręcznej, bo zapisywaliśmy tam odpowiedzi
ucięte mimo posiadania flagi `truncated`. Naprawa siedzi u źródła i obejmuje wszystkich konsumentów
pamięci podręcznej, nie tylko Pogodę.

Mechanizm pamięci treści działa zgodnie z zasadą, o którą prosił właściciel — co pokazuje dowód
wykonania: zmiana warunków **oznacza** treść jako nieaktualną, ale **nie generuje** jej od nowa.

Jedyne zastrzeżenie (AC-10, darmowe zapytanie pogodowe przy zapisie) jest odnotowane jawnie, nie
zamiecione.

Przechodzę do `/review`.
