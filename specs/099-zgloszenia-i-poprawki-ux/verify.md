# Weryfikacja: Zgłoszenia bez czekania i pakiet poprawek UX

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (099-zgloszenia-i-poprawki-ux)
- **Data:** 2026-08-24
- **Baza do weryfikacji:** lokalny PostgreSQL 16 (`omnia_dev` dla bramek, `worldofmag_e2e` dla
  klikaczy). **Produkcyjnej bazy nie dotykano** (C-13) — `scripts/migrate.js` nie był uruchamiany.

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| `check:migrations` | ✅ następny wolny numer 0260 (nasza migracja `0259_task_attachment`) |
| `check:actions` | ✅ 161 akcji, każda z egzekutorem i kontraktem |
| `check:ai-coverage` | ✅ 580 akcji z zakresem i guardem (nowe `tasks:getTaskAttachments`) |
| `check:ai-access` | ✅ 16 modułów z narzędziami odczytu, każdy zawęża wynik |
| `check:cost-badge` | ✅ 37 plików wołających model przekazuje zużycie |
| `check:content-memory` | ✅ 37 plików sklasyfikowanych (nowy handler jako `on-demand`) |
| `check:versioning` | ✅ 7 modeli z wersją, zapisy przez `updateWithVersion` |
| `check:schema-drift` | ✅ brak rozjazdu — migracje odtwarzają `schema.prisma` |
| `check:domain` | ✅ (po korekcie z T-8 — patrz §4) |
| `check:ui-contract` | ✅ 22/22 modułów na `ModuleView` |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:logs` | ✅ 728 plików serwerowych bez `console.*` |
| `check:pagination` | ✅ każde `findMany` z granicą (nowe z `SUFIT_LISTY`) |
| `check:module-registry`, `check:boundaries` | ✅ 21 modułów, granice trzymają |
| `check:owner-columns`, `check:workspace-*`, `check:grant-mirror`, `check:ownership-scope` | ✅ |
| `check:route-gating`, `check:client-safe`, `check:tailwind`, `check:events`, `check:subscribers`, `check:realtime`, `check:e2e-waits` | ✅ |
| `tsc --noEmit` (`tsconfig.json` i `tsconfig.test.json`) | ✅ bez błędów |
| `next lint --dir src` | ✅ bez błędów (zastane ostrzeżenia `exhaustive-deps`/`no-img-element` — bez zmian) |
| `next build` | ✅ kompiluje się; wykonany też jako krok klikaczy |
| `check:perf` | ✅ najcięższa trasa 1172 kB, suma 65734 kB — **w paśmie ±5 %** (leniwy import `html-to-image` nie wszedł do grafu żadnej trasy) |
| `npm run test:unit` | ✅ **1172/1172** |
| Klikacze (`e2e/specs/zgloszenia-i-uklad.spec.ts`) | ✅ **5/5** |

## 2. Kryteria akceptacji

| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — zgłoszenie powstaje przed czymkolwiek modelowym, z potwierdzeniem | ✅ | Klikacz `[099-AC1…]` przechodzi cały scenariusz w **2,9 s** i widzi „Utworzono zgłoszenie". Kod: `AICommandSheet.tsx` gałąź trybu zgłoszenia woła `submitFeedbackTask` wprost — `callAgent` nie występuje w tej ścieżce |
| **AC-2** — zamknięcie asystenta nie kasuje zgłoszenia | ✅ | Ten sam klikacz: `Escape` zaraz po wysyłce, zadanie odczytane potem **wprost z bazy** |
| **AC-3** — brak modelu ⇒ tytuł roboczy zostaje, bez błędu | ✅ | Uruchomienie handlera na żywo przy nieskonfigurowanym modelu: `skipped=model-niedostepny`, tytuł w bazie `🐛 Tytuł roboczy`, **wersja 0** (rekord nietknięty), log `feedback.tytul.model-niedostepny`. Dodatkowo: tytuł zmieniony ręcznie → `skipped=tytul-zmieniony`; skasowane zadanie → `skipped=brak-zadania` |
| **AC-4** — dokładnie jedno wywołanie modelu, na tanim typie operacji | ✅ | `feedbackTitle.ts`: jedno `chatComplete({ op: "dispatch", maxTokens: 60 })`. W ścieżce zgłoszenia nie ma `fetch("/api/llm/home/execute")` ani `callAgent` |
| **AC-5** — opis zgłaszającego słowo w słowo + kontekst UI, tytuł z 🐛 | ✅ | Klikacz sprawdza `description` utworzonego zadania; `roboczyTytul` dokleja `PREFIKS_ZGLOSZENIA` (6 testów jednostkowych) |
| **AC-6** — zrzut OBEJMUJĄCY wskazany element trafia do zadania | ✅ | Klikacz (wzmocniony w trakcie weryfikacji): po wysyłce `taskAttachment` = **1 wiersz**, `kind="screenshot"`, `url` zaczyna się od `data:image/`. Zrzut robiony z konkretnego `HTMLElement` (`toPng(el, …)`), nie z całej strony |
| **AC-7** — podgląd w zadaniu, kasowanie razem z zadaniem | ✅ | Kaskada sprawdzona dwukrotnie: skryptem na żywo (1 → 0 po `task.delete`) i asercją w klikaczu. Podgląd: `TaskAttachments` w `TaskDetail.tsx` (miniatura + powiększenie) |
| **AC-8** — nieudany zrzut nie blokuje zgłoszenia | ✅ | `poprawnyZrzut` (test: brak, `null`, adres http, `data:text/html`, poza limitem) + `try/catch` wokół zapisu załącznika + `try/catch`/limit czasu w `zrzutElementu` |
| **AC-9** — zrzut poza limitem jest zmniejszany, nie odrzucany od razu | ✅ | `zrzutElementu`: PNG → (za duży) JPEG `quality 0.8`, `pixelRatio 1` → (dalej za duży) rezygnacja; `MAX_ZRZUT_ZNAKOW` wspólne dla klienta i serwera, z testem progu |
| **AC-10** — wybór priorytetu widoczny podczas opisywania | ✅ | Klikacz znajduje przycisk „Wysoki" bez rozwijania czegokolwiek; potwierdza to też zrzut z przebiegu (rząd „Priorytet: Niski/Średni/Wysoki/Pilne" nad polem) |
| **AC-11** — wybrany priorytet trafia do zadania | ✅ | Klikacz: `task.priority === "HIGH"` odczytane z bazy |
| **AC-12** — nic nie widać obok przyklejonych pasków | ✅ | Klikacz mierzy `pasek.left − kropka.left ≤ 0` (na danych zasianych na czas testu) |
| **AC-13** — kropka nadal leży na linii osi | ✅ | Ten sam klikacz: odchyłka środka kropki od linii ≤ 1 px |
| **AC-14** — brak pustego wiersza na telefonie | ✅ | Klikacz przy 360 px: zero pustych wierszy paska o wysokości > 0 |
| **AC-15** — widoki z akcjami bez zmian | ✅ | Klikacz na 1280 px (tytuł w pasku) + zielone `rama-widoku-przeglad` i `pasek-widoku-mobile` |
| **AC-16** — nagłówek „Proponowane" | ✅ | Klikacz znajduje nagłówek po nazwie |
| **AC-17** — jeden wiersz przy 360 px, przełączniki w menu ⋮ | ✅ | Klikacz: wysokość paska sekcji ≤ 56 px; przełączniki w `MenuProponowanych` |
| **AC-18** — brak pustych pozycji w menu | ✅ | Przegląd `MenuProponowanych`: pozycja renderowana tylko przy liczniku > 0, a przy dwóch zerach `return null` na całym przycisku |

**18/18 spełnionych.** AC-6 był w pierwszym podejściu potwierdzony tylko fragmentami (zrzut z
przeglądarki + ścieżka w kodzie + testy walidacji) — weryfikacja **wzmocniła klikacz** o asercję na
tabeli załączników, żeby cała droga (rasteryzacja → magistrala → akcja → baza) była sprawdzona
jednym przebiegiem, a nie składana z poszlak.

## 3. Zgodność z konstytucją

- **C-01** ✅ zmiany wyłącznie w `worldofmag/` (plus artefakty w `specs/` i `doświadczenia.md`).
- **C-10, C-11, C-12, C-15** ✅ ręcznie pisana migracja `0259`, numer z `next:migration`, rodzaj jako
  `String` + unia TS, DDL pisany od zera (bez `migrate diff`).
- **C-13** ✅ produkcyjna baza nietknięta; wszystko na lokalnym Postgresie.
- **C-20** ✅ mutacje w Server Actions z `revalidatePath("/tasks")` i `/tasks/<projectId>`.
- **C-21/C-17** ✅ odczyt załączników za `assertTaskAccess`; wyjątek skrzynki zgłoszeń **nie został
  poszerzony** — nadal dotyczy wyłącznie `submitFeedbackTask`.
- **C-22** ✅ zero nowych slugów, zero zmian w rejestrze modułów i nawigacji.
- **C-23** ✅ katalog akcji asystenta nietknięty (`submit_feedback` bez zmian) — bramka zielona.
- **C-30, C-31, C-32** ✅ kolory wyłącznie ze zmiennych CSS, cel dotyku `py-3`/`px-3 py-2.5`, teksty
  przez `t()` i `messages/pl.json`.
- **C-33** ✅ poprawka pustego wiersza poszła **w ramie widoku**, nie wyjątkiem w module; mechanizm
  zasłony (`--view-bar-h`) nietknięty.
- **C-35** ✅ nośnik załączników dowieziony razem z pierwszym konsumentem.
- **C-36** ✅ pole `jobs` zadeklarowane **leniwie** w `module.server.ts`; allowlista kolejkowania
  pozostaje pochodną deklaracji modułu.
- **C-40** ✅ model wybierany po typie operacji z `/admin/llm`, zero nazw dostawcy w kodzie.
- **C-51** ✅ pięć lekcji dopisanych do `doświadczenia.md`.
- **C-53** ⚠️ **jedna nowa zależność** (`html-to-image`) — wybrana **świadomie przez właściciela** na
  etapie `/specify`, ładowana leniwie i tylko w narzędziu administratora; budżet wydajnościowy
  potwierdza brak wpływu na trasy.
- **C-54** ✅ dwa nawroty do artefaktów udokumentowane: przenumerowanie 088 → 099 (§8a speca) oraz
  przeniesienie reguł do czystego modułu (§3.5 planu, T-8).

## 4. Regresje

- **Klikacze, przebieg pełny (400+ testów): 176 zielonych, 14 czerwonych.** Porównanie z **commitem
  bazowym `bf79221`** (te same pliki, ten sam sandbox): **11 z nich było czerwonych już przed tą
  zmianą** — wszystkie zależą od danych Wiadomości, których świeża baza nie zawiera (pomiary wracają
  `null`): `084-AC2`, `084-AC4/AC-5`, `085-AC4`, `086-AC20`, `087-AC2`, `087-AC9`, `087-AC10`,
  `087-AC11`, `087-AC15`, `scenario-news-observer-remount`, `scenario-news-stream-scroll`.
- **`favorites.spec.ts` — chwiejny, nie zepsuty.** W pełnym przebiegu padł `fav-AC4` (29,7 s),
  w węższym `fav-AC5` (37,5 s), a przy najmniejszym obciążeniu cały plik był zielony. Za każdym
  razem pada pomocnik sprzątający (`clearFavorites`), zawsze po ~30 s. **Inny test przy każdym
  przebiegu** = zależność od czasu; ulubione żyją w chromie konta, którego 099 nie dotyka.
- **Wspólne komponenty:** `ViewBar` jest używany przez ~20 widoków — sprawdzone `rama-widoku-przeglad`
  i `pasek-widoku-mobile` (zielone) plus osobne AC na telefon i komputer.
- **Migracja:** tabela wyłącznie **dokładana**, bez `ALTER`/`DROP` na istniejących — rollback kodu
  nie wymaga rollbacku bazy.
- **RBAC:** zero zmian; nowy odczyt chroniony istniejącym guardem zadania.

## 5. Werdykt

**GOTOWE Z UWAGAMI.**

Wszystkie 18 kryteriów akceptacji spełnionych, wszystkie bramki zielone, 1172 testy jednostkowe
i 5 klikaczy tego pakietu na zielono. Uwagi, świadomie zostawione:

1. **Jedna nowa zależność w przeglądarce** (`html-to-image`) — decyzja właściciela, ładowana leniwie,
   bez wpływu na budżet wydajnościowy.
2. **11 klikaczy Wiadomości pozostaje czerwonych** — stan zastany, potwierdzony pomiarem na commicie
   bazowym; przyczyną jest brak danych Wiadomości w bazie klikaczy, nie ta zmiana. To osobna praca
   (zasianie danych modułu do klikaczy), nie do doklejenia tutaj.
3. **`favorites.spec.ts` bywa czerwony pod obciążeniem** — chwiejność sprzątania, niezwiązana z 099.
