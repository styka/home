# Weryfikacja: Odporność generatora skórek AI na kształt odpowiedzi modelu (117)

- **Spec:** ./spec.md · **Zadania:** ./tasks.md (5/5 odhaczone)
- **Data:** 2026-08-30
- **Środowisko:** sandbox Claude on web, lokalny Postgres 16 (`omnia_dev`), bez prod DB (C-13)

## Bramki (C-50)

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ (feature bez migracji — następny wolny numer 0286, bez zmian) |
| `npm run check:actions` | ✅ 168 akcji, komplet egzekutorów |
| `tsc --noEmit -p tsconfig.test.json` | ✅ |
| `npm run test:unit` (pełny) | ✅ fail 0 (w tym 18 testów `skinGenerate.test.ts` — 9 nowych) |
| `next lint --dir src` | ✅ „No ESLint warnings or errors" |
| `next build` (lokalny Postgres) | ✅ „Compiled successfully" |

Uwaga procesowa: pierwszy przebieg pełnego `test:unit` pokazał 109 porażek — przyczyną
był **niedziałający lokalny Postgres po restarcie kontenera** (testy integracyjne DB nie
łączyły się z bazą), nie kod 117; po `pg_ctlcluster 16 main start` cały zestaw zielony.

## Kryteria akceptacji

- **AC-1 (płotki / tekst wokół JSON-a) — ✅.** Testy `117/odczyt: płotki markdown
  z językiem`, `znak nowej linii PO płotku zamykającym` (dokładnie kształt, na którym padał
  stary regex `/```$/`) i `tekst przed i po obiekcie JSON` — wszystkie przechodzą przez
  `odczytajOdpowiedzJson`, wpięty w OBA tryby (`skinGenerate.ts`, oba miejsca po dawnym
  `JSON.parse`).
- **AC-2 (luźny odczyt + pojemniki tokenów) — ✅.** Odczyt stoi na istniejącym
  `parseJsonLoose` (płotki, wycięcie pierwszego `{…}`); tryb prosty czyta mapę przez
  `wyodrebnijTokeny` — test `117/tryb prosty: mapa tokenów w pojemniku variables`
  + istniejące testy `mapowanie.test.ts` (kształty 081) bez zmian oczekiwań.
- **AC-3 (ucięta odpowiedź → ponowienie, nie enigmatyczny błąd) — ✅.** Rozpoznanie
  ucięcia z flagi `truncated` (test `odpowiedź ucięta w połowie obiektu → „ucieta"`);
  w pętli obu trybów nieudany odczyt przy pierwszym podejściu dokłada `korektaFormatu`
  i robi `continue` (ślad kodu — dokładnie wzorzec pętli 080 stojącej obok), a po
  wyczerpaniu podejść leci `opisPorazkiFormatu` z przyczyną; dosłowny komunikat „Model
  zwrócił nieprawidłowy format" **zniknął z pliku** (grep: zostało tylko odwołanie
  w komentarzu). Ponowienie na poziomie pętli zweryfikowane śladem kodu (test przez
  mockowanie `chatComplete` byłby nowym wzorcem w repo — testy handlera są czysto
  funkcyjne; uczciwie odnotowane).
- **AC-4 (rozróżnienie przyczyn porażki) — ✅.** Test `porażka formatu rozróżnia ucięcie
  od braku JSON-a i wskazuje panel LLM` (+ asercja, że stary komunikat nie wraca);
  istniejący `opisPorazki` (brak treści vs treść odrzucona walidacją, z wyliczeniem
  nazw) bez zmian — jego testy z 080 przechodzą.
- **AC-5 (regresja zero) — ✅.** Wszystkie istniejące testy generatora (9 z 080/081)
  i skórek przechodzą **bez modyfikacji oczekiwań**; pełny `test:unit` fail 0; ścieżki
  sukcesu (poprawny JSON, odmowa `not-a-theme`) nietknięte.
- **AC-6 (testy odtwarzające zgłoszone przypadki) — ✅.** 9 nowych testów `117/*`
  odtwarza dokładnie kształty kończące się wcześniej „błędem formatu": płotki (2 warianty),
  proza wokół, ucięcie, śmieci, tablica/pusta odpowiedź, komunikaty, pojemnik tokenów.

## Zgodność z konstytucją

C-01/02 ✅ · C-10..C-15 — bez zmian schematu ✅ · C-20..C-25 — bez nowych akcji/RBAC ✅ ·
C-30..C-32 — bez zmian UI (komunikaty serwerowe wg zastanego wzorca `opisPorazki`) ✅ ·
C-40 — bez hardcodowania modeli, budżety bez zmian ✅ · C-51 — lekcja w `doświadczenia.md`
(martwy import ≠ wpięta ochrona; diagnoza z flagi transportu) ✅ · C-53 — jeden plik kodu
+ testy, reużycie `parseJsonLoose`/`truncated`/wzorca 080 ✅.

## Regresje

- Zmiana zamknięta w `skinGenerate.ts` + jego testach; żaden inny konsument
  `parseJsonLoose`/`wyodrebnijTokeny` nie został dotknięty.
- Tolerancja dotyczy WYŁĄCZNIE opakowania — odzyskana treść przechodzi tę samą pełną
  walidację 116 co wcześniej (bez zmiany powierzchni bezpieczeństwa).
- Pełny `test:unit` + lint + build zielone (tabela wyżej).

## Werdykt końcowy

**GOTOWE Z UWAGAMI**:
1. Ponowienie na poziomie pętli (AC-3) dowiedzione śladem kodu + testami helpera, bez
   testu z mockiem `chatComplete` (nowy wzorzec testowy poza zakresem — C-53).
2. Żywej generacji z modelem nie wykonano (sandbox bez klucza providera) — jak przy 116;
   do obejrzenia na `develop` po deployu.
