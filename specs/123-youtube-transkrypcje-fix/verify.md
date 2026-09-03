# Weryfikacja: Transkrypcje YouTube — naprawa pobierania

- **Spec:** ./spec.md (123-youtube-transkrypcje-fix)
- **Data:** 2026-09-03

## Bramki

| Komenda | Wynik |
|---------|-------|
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0290)" |
| `npm run check:actions` | ✅ 168 akcji, wszystkie z egzekutorem i kontraktem |
| `next lint --dir src` | ✅ „No ESLint warnings or errors" (w pełnym buildzie) |
| pełny `npm run build` (lokalny Postgres, C-13) | ✅ exit 0 — wszystkie bramki + `next build` + `migrate.js`/seed na lokalnej bazie |
| `npm run test:unit` | ✅ 1190 pass / 0 fail merytorycznych (jedyny wcześniejszy fail — `ownership.test.ts` — wynikał z braku `DATABASE_URL`; po postawieniu lokalnej bazy 3/3 pass) |
| testy transkrypcji (celowane) | ✅ 18/18 pass |

## Kryteria akceptacji

- **AC-1 — film z napisami dostaje transkrypcję: ⚠️ częściowo (z przyczyn środowiskowych, nie kodu).**
  Sandbox nie ma dostępu sieciowego do youtube.com (proxy odrzuca CONNECT 403 — sprawdzone
  empirycznie), więc pobrania „na żywo" nie da się tu wykonać; spec przewiduje to wprost (korekta
  C-54 w §9): pełne potwierdzenie = log `youtube.transkrypcje.skutecznosc` po deployu na `develop`.
  Zastępczo zweryfikowane zachowanie łańcucha na wstrzykniętym fetcherze: pusty timedtext (objaw POT)
  spuszcza do drogi `player` i zwraca pełny tekst + język + `zrodlo` (test „pusty timedtext (POT)
  spuszcza łańcuch do drogi player"), a przy porażce dwóch dróg tekst przynosi `panel` (test „gdy
  strona i player zawodzą…"). Żądania niosą właściwe dane (asercje na `videoId`, klienta ANDROID
  i `params` w ciałach POST).
- **AC-2 — testy na próbkach obecnych odpowiedzi: ✅.** `transkrypcja.test.ts` — próbki HTML strony,
  player response (ANDROID), odpowiedzi `get_transcript`, timedtext XML/JSON i pustych/uszkodzonych
  wariantów; 18/18 zielone.
- **AC-3 — rekwalifikacja „niedostepna": ✅.** Migracja `0289_youtube_transkrypcje_ponowna_proba`
  aplikuje się czysto (`migrate deploy` — komplet 289); test danych na lokalnej bazie (transakcja z
  rollbackiem): `niedostepna`→`oczekuje`, `jest` i `oczekuje` nietknięte. Etap 2 joba pobiera
  `transkrypcjaStan: "oczekuje"` bez zmian (`youtubeRefresh.ts:100`), więc zawrócone filmy dobiorą
  się same, po 25/przebieg.
- **AC-4 — brak napisów = stan, nie awaria: ✅.** Testy „każde niepowodzenie kończy się wartością
  null — NIGDY wyjątkiem" (4 scenariusze) + nowe warianty uszkodzonych odpowiedzi player/panel;
  etap 2 joba dalej w `try/catch` z logiem `youtube.transkrypcje.etap_nieudany`.
- **AC-5 — preferencja pl→en, autorskie>auto: ✅.** `wybierzSciezke` niezmieniona, wspólna dla dróg
  `strona` i `player` (asercja w teście drogi player); istniejące testy preferencji przechodzą.
- **AC-6 — log skuteczności: ✅.** `youtubeRefresh.ts` emituje
  `youtube.transkrypcje.skutecznosc {probowano, udane, odsetek, zrodloStrona, zrodloPlayer,
  zrodloPanel}` — rozbicie po źródle jako pola płaskie (korekta z review: `oczysc` logów
  strukturalnych spłaszcza obiekty do „[obiekt N pól]", więc zagnieżdżony rekord zgubiłby liczniki),
  dotychczasowe pola zachowane.
- **AC-7 — Notatki/Fiszki korzystają z transkrypcji: ✅ (przegląd kodu).** Jedynym konsumentem
  `pobierzTranskrypcje` jest job; wszyscy pozostali (streszczenie/Q&A w `actions/ai.ts:52,139`,
  zapis do Notatek, „Fiszki z filmu") czytają kolumnę `transkrypcja` — dostaną dane bez żadnych
  zmian po swojej stronie, gdy tylko kolumna się wypełni.

## Zgodność z konstytucją

- **C-01/C-36** ✅ — zmiany wyłącznie w `worldofmag/`, wewnątrz modułu YouTube (importy względne);
  kontrakt nietknięty; platforma nietknięta.
- **C-10/C-11/C-12** ✅ — ręczna migracja danych 0289, numer sekwencyjny, zero enumów (stany bez
  nowych wartości).
- **C-13** ✅ — build i migracje wyłącznie na lokalnym Postgresie.
- **C-20..C-25** ✅ — bez zmian w Server Actions/RBAC/AI/trash/audit (żadne nie było potrzebne).
- **C-30..C-32** ✅ — UI nietknięte, zero nowych literałów.
- **C-51** ✅ — wpis w `doświadczenia.md` (2026-09-03) zacommitowany razem z fixem.
- **C-53** ✅ — bez nowych zależności (protobuf ręcznie, 3 linie); jedyny naddatek (`zrodlo`)
  uzasadniony w planie brakiem innej drogi weryfikacji po deployu.

## Regresje

- `PobierzTresc` rozszerzone **wstecznie zgodnie** (drugi parametr opcjonalny) — wszystkie stare
  wywołania i testy z `(url) => …` przechodzą bez zmian; jedyny produkcyjny konsument to
  `youtubeRefresh.ts` (grep po repo).
- Pełny suite jednostkowy (1288 testów) bez nowych failów; pełny build zielony — bramki wspólne
  (boundaries, module-registry, pagination, logs, i18n itd.) nietknięte.
- Migracja 0289 dotyka jednej kolumny jednej tabeli modułu YouTube — brak wpływu na sąsiednie moduły.

## Werdykt końcowy

**GOTOWE Z UWAGAMI.** Jedna uwaga: ostateczne potwierdzenie AC-1 (skuteczność na żywych filmach)
jest możliwe wyłącznie po deployu na `develop` — przez uruchomienie „Odśwież" w `/youtube` i odczyt
logu `youtube.transkrypcje.skutecznosc` (rozbicie `zrodla` wskaże drogę niosącą ruch). Środowisko
budowy nie ma sieci do YouTube; to ograniczenie środowiska, przewidziane w specu/planie, nie brak
implementacji.
