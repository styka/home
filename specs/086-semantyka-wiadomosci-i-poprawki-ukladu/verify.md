# Weryfikacja: Semantyka akcji w Wiadomościach, świeże gorące tematy i poprawki układu

- **Feature:** 086-semantyka-wiadomosci-i-poprawki-ukladu
- **Data:** 2026-08-24
- **Gałąź:** `claude/worldofmag-news-weather-tasks-a02ui9`
- **Podstawa:** `spec.md` (21 kryteriów), `plan.md`, `tasks.md` (27 zadań, wszystkie odhaczone)

---

## 1. Bramki

Wszystko na **lokalnym** Postgresie (`127.0.0.1:5432/omnia_dev`) — prod DB nietknięta (C-13).

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ `Numeracja migracji OK (następny wolny numer: 0259)` |
| `npm run check:actions` | ✅ `161 akcji w katalogu, wszystkie obsługiwane przez executor` |
| `next lint --dir src` | ✅ 0 błędów, 19 ostrzeżeń kosmetycznych (`react-hooks/exhaustive-deps`, polskie cudzysłowy) — stan zastany, pozycja z roadmapy |
| `next build` | ✅ `Compiled successfully`, 137 stron |
| Pozostałe 30 bramek `check:*` | ✅ wszystkie zielone — m.in. `check:ui-contract` (22/22 modułów), `check:i18n` (zero tekstów zaszytych w komponentach), `check:content-memory` (36 plików sklasyfikowanych), `check:cost-badge`, `check:schema-drift` (brak rozjazdu), `check:boundaries`, `check:owner-columns` (2353 wywołania Prismy) |
| `check:perf` | ✅ najcięższa trasa 1171 kB, suma 65 678 kB — w paśmie ±5 % |
| `npm run test:unit` | ✅ 1029 pass / 0 fail / 35 skipped |
| Klikacz (pełna suita, `scripts/e2e-web.sh`) | ✅ **180 zielonych, 0 czerwonych** |

**Uczciwe zastrzeżenie do klikacza:** projekt `mobile` (WebKit) jest w sandboxie pomijany — brak
silnika w obrazie. Sekcja obserwatorów Pogody renderuje się dopiero po pobraniu prognozy z
Open-Meteo, a sieć wychodząca jest zablokowana, więc testy 085 dotyczące treści oceny pomijają się
z jawnym powodem. Nie dotyczy to kryteriów 086 — te mierzą układ, który renderuje się bez sieci.

**Pierwszy przebieg klikacza wykazał REGRESJĘ**, której nie wykrywał żaden test naprawianego
zgłoszenia: `[085-rama] /calendar` — sufit `max-width: 55 %` nałożony w T-5 na akcję nagłówka
przycinał nawigator miesiąca, który nie potrafi się zwęzić (182 px treści w pudełku 180 px).
Naprawione (podłoga dla tytułu zamiast sufitu dla akcji), dołożony test `[086-AC18]` z kontrolą
negatywną. Szczegóły w `doświadczenia.md`.

---

## 2. Punkt odniesienia (T-1) i pomiar po zmianie

| Miara | PRZED | PO |
|---|---|---|
| Tytuł „Pogoda" przy 360 px (widoczne / treść) | **10 px / 81 px** — przycięty do jednej litery | **81 px / 81 px** — czytelny w całości |
| Przycisk lokalizacji przy 360 px | 274 px, bez możliwości zwężenia | 185 px, przycina nazwę (pełna w podpowiedzi) |
| Zasłona przyklejonych nagłówków w Wiadomościach, przewinięcie zero | 107 px (= 48 + 59, wartość **poprawna**) | 107 px — bez zmian |
| …ta sama zasłona, gdy nad paskiem modułu stanie element 40 px | **147 px** (miara pozycyjna rośnie o wszystko powyżej) | **107 px** (suma wysokości obu pasków) |
| Górna krawędź powiadomienia o koszcie | `12px + env(safe-area-inset-top)` | `28px + env(safe-area-inset-top)` |

Pierwsza diagnoza z T-1 („nagłówki 58 px za nisko") była **nadinterpretacją pomiaru** — 107 px to
poprawne 48 + 59. Kryterium AC-20 zostało z tego powodu przeredagowane w `spec.md`, a `plan.md`
dostał sprostowanie (C-54). Różnica między miarą pozycyjną a wysokościową ujawnia się dopiero, gdy
między paski coś wejdzie — u właściciela pasek stanu odświeżania.

---

## 3. Kryteria akceptacji

### A. Semantyka akcji w Wiadomościach

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — jedna akcja zamykająca | ✅ | `src/modules/news/ui/NewsItemCard.tsx:187-195` — został jeden przycisk („Przeczytane”). `dismissItem` usunięty z `src/modules/news/actions/news.ts`. Klikacz: `[086-AC4]`. |
| **AC-2** — zamknięcie nie kasuje treści | ✅ | Akcja ustawia `status: "ACKNOWLEDGED"` na `NewsItem`; `NewsArticle` (pula) i `NewsTimelineEntry` (linia czasu) nietknięte — brak jakiegokolwiek `delete` na ścieżce `acknowledgeItem`. Migracja `0258_news_item_bez_dismissed` **przepisuje** stare `DISMISSED` na `ACKNOWLEDGED`, nie usuwa wierszy. |
| **AC-3** — podpowiedź mówi o mojej liście | ✅ | `messages/pl.json` → `modules.news.NewsItemCard.przeczytaneOpis` = „Zdejmuje wiadomość z Twojej listy nowych. Nic nie kasuje — zostaje w linii czasu tematu.”, wpięte jako `title` w `NewsItemCard.tsx:190`. |
| **AC-4** — „Odrzuć” nie istnieje | ✅ | Klikacz `[086-AC4] akcja Odrzuć nie istnieje nigdzie w module` — zielony. `grep -r "Odrzuć" src/modules/news` zwraca wyłącznie komentarz historyczny. |

### B. Potwierdzenia w całej aplikacji

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-5** — operacja nieusuwająca ma neutralny przycisk | ✅ | `ConfirmProvider.tsx:77` — `confirmLabel ?? (destructive ? "Usuń" : "Potwierdź")`. Klikacz `[086-AC5]` (oznaczenie wszystkich jako przeczytanych). |
| **AC-6** — usuwanie nadal czerwone „Usuń” | ✅ | `ConfirmProvider.tsx:79` — `destructive={options.destructive === true}`. Klikacz `[086-AC6]` (usunięcie tematu). |
| **AC-7** — świadoma etykieta w każdym miejscu | ✅ | Przegląd **54 wywołań** `confirmDialog` (55 trafień grepa minus jedno w zapieczonym tekście konstytucji, `src/generated/spec-pipeline.ts`): **50 z `destructive: true`**, **4 świadomie neutralne** — patrz tabela niżej. |

**Cztery wywołania świadomie neutralne** (żadne nic nie usuwa):

| Plik | Operacja |
|---|---|
| `modules/shopping/ui/ShoppingHomePage.tsx:304` | „Przywrócić listę z archiwum?” |
| `modules/notes/ui/NoteRow.tsx:689` | „Przywrócić tę wersję? Aktualna treść trafi do historii.” |
| `modules/news/ui/NewsStream.tsx:210` | „Oznaczyć wszystkie nowe wiadomości jako przeczytane?” — **zgłoszenie 9 właściciela** |
| `modules/pets/ui/PetHusbandry.tsx:62` | „Odłączyć zwierzę od tego zbiornika? Zbiornik i jego pomiary pozostaną.” |

Pozostałe 50 rozkłada się na 40 plików (kilka ma po 2–3 wywołania: `QaAdminTree` ×3, `TrashPage`,
`ContactsPage`, `VehicleDetailPage`, `HealthHomePage`, `SuppliersPage`, `ProviderPanelPage`,
`TasksPage`, `TasksSideNav` ×2) — każde usuwa rekord i deklaruje `destructive: true` jawnie.

### C. Świeże gorące tematy

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-8** — przeliczenie w przebiegu pobierania | ✅ | `src/modules/news/jobs/newsRefresh.ts:754` — piąty etap po linii czasu, `etapGoracychTematow({ pobrano: pool.fetched, przelicz: () => przeliczGoraceTematy(ownerId, { force: true }) })`. Rdzeń bez sesji w `src/modules/news/lib/goraceTematy.ts`; `getHotTopics` jest teraz cienką nakładką na ten sam rdzeń, więc widok czyta dokładnie to, co zapisał przebieg. |
| **AC-9** — brak nowych materiałów = brak kosztu | ✅ | `etapGoracychTematow` zwraca `false` bez wywołania `przelicz`, gdy `pobrano <= 0`. Test jednostkowy `goraceTematy.test.ts` — „brak materiałów → nie wołamy” oraz „ujemna liczba jak zero”. |
| **AC-10** — widać, kiedy lista powstała; ręczne zostaje | ✅ | `HotTopics.tsx:195-199` — `AiContentMeta` z `generatedAt` i `onRefresh={() => load(true)}`. Ścieżka pamięci treści (`rememberedContent`) niezmieniona, wpis w `content-memory-coverage.json` przeniesiony na nowy plik rdzenia. |
| **AC-11** — awaria etapu nie cofa pobrania | ✅ | `etapGoracychTematow` łapie wyjątek, raportuje przez `onBlad` (`logEvent("warn", "news.hotTopics.failed")`) i zwraca `false` — wyjątek **nie wychodzi** poza etap. Test jednostkowy „awaria nie wychodzi na zewnątrz”. Etap stoi za zapisem artykułów i linii czasu, więc nawet bez tego zabezpieczenia nie mógłby ich cofnąć. |

### D. Tryb administratora

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-12** — koszt widoczny przy wyłączonym trybie admina | ✅ | `KosztToasts.tsx` — bramka `useTrybAdmina` usunięta; toast zależy już tylko od tego, czy serwer w ogóle przysłał dane o zużyciu. Klikacz `[086-AC12]`. |
| **AC-13** — nie-admin nadal bez kosztu | ✅ | Bez zmian po stronie serwera: `platform/ai/costVisibility.ts:39-47` — `visibleUsage` zwraca `undefined`, gdy sesja nie ma `PERMISSIONS.ADMIN` albo licznik jest wyłączony w `Config`. Dane o modelu i tokenach nie opuszczają serwera, więc toast nie ma z czego powstać. |
| **AC-14** — techniczny log tylko w trybie admina | ✅ | `AICommandSheet.tsx:281` — `{isAdmin && trybAdmina && (…)}`; log opisany po ludzku renderuje się poza tym warunkiem, dla wszystkich. |
| **AC-15** — zapas pod wcięciem aparatu | ✅ | `KosztToasts.tsx:131` — `top: "calc(28px + env(safe-area-inset-top))"` (było `12px`). ⚠️ **Nie dało się sprawdzić na urządzeniu**: sandbox nie ma WebKita, a `env(safe-area-inset-top)` w Chromium desktop wynosi 0. Zweryfikowane jako zmiana wartości, nie jako wygląd na iPhonie — potwierdzenie należy do właściciela na jego telefonie. |

### E. Układ i nazewnictwo

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-16** — odstęp nad chipsami w Pomysłach | ✅ | `IdeaLibraryPage.tsx:120` — `mt-2` na kontenerze chipsów. |
| **AC-17** — informacja o odświeżaniu nad ikonami układu | ✅ | `WatchersPanel.tsx:337-360` — `flex-col`: `AiContentMeta` pierwsze, wybór układu pod nim. Komplet propsów niezmieniony; warunek „ikony dopiero przy >1 obserwatorze” zachowany. |
| **AC-18** — długa nazwa lokalizacji nie zjada tytułu | ✅ | `PageHeader.tsx` — podłoga `min-width: 40 %` na bloku tytułu, akcja tylko `flex-shrink: 1` + `min-width: 0`; `WeatherPage.tsx` — przycisk `min-w-0 max-w-full` + `truncate` + pełna nazwa w `title`. Klikacz `[086-AC18]`: tytuł 81/81, akcja 185/185. **Kontrola negatywna:** po cofnięciu naprawy test pada (tytuł 10 px przy 81 px treści). |
| **AC-19** — rząd ikon konta pod nazwą aplikacji | ✅ | `ModuleSidebar.tsx:297-302` — rząd chromu **przed** `<nav>` (linia 304), z `border-b`. `NotificationBell` i `FavoriteStarButton` w wariancie `chrome` otwierają panele **w dół** (wcześniej w górę — ze stopki). Klikacz `[086-AC19]`: gwiazdka wyżej niż „Strona główna”. |
| **AC-20** — nagłówki nie zsuwają się niżej | ✅ | `NewsPage.tsx` — zasłona liczona jako `--view-bar-h` + `offsetHeight` własnego paska, nie jako odległość od góry ramy. Klikacz `[086-AC20]`: po wstawieniu 40 px nad paskiem zasłona zostaje 107 px; ze starą miarą rośnie do 147 px. Test **wymusza przeliczenie** zmianą szerokości okna — `ResizeObserver` pilnuje paska i ramy, więc wstawienie czegoś NAD nimi samo z siebie go nie budzi (to był drugi bezwartościowy wariant tego testu). |
| **AC-21** — nazwa kontrolki nawigacji | ✅ | `NewsPage.tsx` — `etykietaStala={t("przejdzDoTematu")}` → „Przejdź do tematu” zamiast „Tematy”. Klikacz `[086-AC21]`. |

**Podsumowanie: 21 / 21 spełnionych**, jedno (AC-15) z jawnym ograniczeniem środowiska.

---

## 4. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** praca tylko w `worldofmag/` | ✅ poza nim ruszone wyłącznie artefakty `specs/`, `doświadczenia.md`, `CLAUDE.md` i konstytucja |
| **C-10 / C-11** migracja ręczna, numer unikalny | ✅ `0258_news_item_bez_dismissed`, `check:migrations` zielone, `check:schema-drift` bez rozjazdu |
| **C-12** zero enumów Prisma | ✅ `ItemStatus` zawężony do `"PENDING" \| "ACKNOWLEDGED"` jako union TS, kolumna nadal `String` |
| **C-13** nigdy prod DB | ✅ build i migracje wyłącznie na lokalnym Postgresie |
| **C-20** Server Actions z `revalidatePath` | ✅ `acknowledgeItem` i pozostałe akcje Wiadomości bez zmian w tym zakresie |
| **C-21 / C-17** własność i dostęp | ✅ rdzeń `przeliczGoraceTematy(ownerId)` dostaje właściciela **parametrem**; sesję rozstrzyga wyłącznie nakładka `getHotTopics` (`requireAuth`). Zadanie w tle nie ma sesji — dlatego rdzeń musiał ją stracić, a nie odwrotnie |
| **C-30** motyw przez zmienne CSS | ✅ żadnego hexa; `check:ui-contract` zielone |
| **C-32** teksty przez `t()`, polski | ✅ `check:i18n`: zero literałów w komponentach; nowe teksty w `messages/pl.json` |
| **C-33** `ModuleView` + zasłona jako suma wysokości | ✅ zaktualizowana w konstytucji i `CLAUDE.md` razem ze zmianą kodu |
| **C-34** potwierdzenia z neutralną domyślnością | ✅ reguła dopisana do konstytucji; 54 wywołania sklasyfikowane |
| **C-50** definicja „gotowe” | ✅ build zielony |
| **C-51** wpis do `doświadczenia.md` | ✅ **trzy** wpisy: miara pozycyjna vs wysokościowa, test którego nikt nie obudził, sufit na sąsiedzie zamiast podłogi dla siebie |
| **C-53** minimalizm | ✅ zero nowych zależności; jedyny nowy plik z logiką (`lib/goraceTematy.ts`) to przeniesiony rdzeń istniejącej akcji |
| **C-54** spójność artefaktów | ✅ `spec.md` (AC-20) i `plan.md` (§5) poprawione, gdy pomiar obalił pierwotną diagnozę; `tasks.md` przeliczone w dół |
| **C-55** jeden moment pytań | ✅ cztery decyzje właściciela zebrane raz, na `/specify`; dalsze etapy bez pytań |

Naruszeń brak.

---

## 5. Regresje

- **Znaleziona i naprawiona:** `/calendar` — patrz §1. Jedyny czerwony wynik w całym przebiegu; nie
  dotyczył żadnego ze zgłoszeń, tylko skutku ubocznego naprawy AC-18 na **wspólnym** komponencie.
- **`ConfirmProvider` (54 konsumentów)** — zmiana domyślnej etykiety dotyka całej aplikacji. Ryzyko
  odwrotne (usuwanie z neutralnym przyciskiem) zabezpieczone jawnym `destructive: true` w 50
  wywołaniach i testem `[086-AC6]`.
- **`PageHeader` (wszystkie moduły)** — po naprawie sprawdzony przeglądem ramy na dziesięciu trasach
  różnych klas (`rama-widoku-przeglad`), wszystkie zielone.
- **Migracja 0258** — wyłącznie `UPDATE` na kolumnie statusu; nie zmienia kształtu tabeli, nie ma
  czego cofać poza wartościami, które i tak nigdzie nie były odczytywane.
- **Chrom konta w panelu bocznym** — panele dzwonka i gwiazdki otwierały się w górę (ze stopki);
  po przeniesieniu nad nawigację otwierają się w dół. Sprawdzone klikaczem `[086-AC19]`.
- **RBAC / `revalidatePath`** — bez zmian; `check:route-gating` (19 tras), `check:ai-access`
  (16 modułów) i `check:owner-columns` zielone.

---

## 6. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 21 kryteriów spełnione, wszystkie bramki zielone, 180 testów klikacza i 1029 jednostkowych
bez czerwieni. Jedna uwaga, świadomie zostawiona jako ograniczenie środowiska, nie jako brak:

- **AC-15** (zapas pod wcięciem aparatu iPhone'a) zweryfikowany jako zmiana wartości
  (`12px → 28px` ponad `env(safe-area-inset-top)`), nie jako wygląd na urządzeniu — w sandboxie nie
  ma WebKita, a w Chromium desktop `env(safe-area-inset-top)` wynosi zero. Ostateczne potwierdzenie
  należy do właściciela na jego telefonie, po wdrożeniu na środowisko testowe.
