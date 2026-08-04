# Dziennik przebudowy — co zrobiono

> **Po co ten rozdział.** Reszta dokumentu opisuje stan **docelowy**. Ten opisuje stan
> **faktyczny**: co z 46 zadań checklisty zostało zrobione, a co nie. Bez niego kolejna sesja
> musiałaby wnioskować o postępie z historii gita — czyli zgadywać.
>
> **Zasada prowadzenia:** każdy przebieg pipeline'u dopisuje tu swój wpis i aktualizuje tabelę
> statusów. To część definicji „gotowe", nie dobra wola.

---

## Gdzie jesteśmy

**Żadna z faz 0–9 nie jest ukończona.** Przebieg 045 dowiózł warstwę, która w checkliście nie ma
numeru (rozdz. 10.4–10.5 — system komponentów i kontrakt widoku), i przygotował grunt pod resztę.

**Następny krok jest jednoznaczny: Faza 0 — siatka bezpieczeństwa** (zadania 1–3). Dokument nazywa
je „bezwarunkowo pierwszymi", a rozdz. 13 dodaje: *refaktor bez siatki bezpieczeństwa to nie
refaktor, tylko przepisywanie z nadzieją*. Fazy 1 i 2 przenoszą setki plików i migrują dane na 46
modelach — bez klikaczy i testu izolacji najemcy regresję zgłosiłby użytkownik, nie bramka.

---

## Status 46 zadań

Legenda: ✅ zrobione · 🟡 częściowo · ⬜ nietknięte

### Faza 0 — Siatka bezpieczeństwa

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 1 | Klikacz ścieżki szczęśliwej dla 21/21 modułów | ⬜ | Istnieje 20 plików scenariuszy, pokrycie niepełne i niezweryfikowane wobec listy modułów |
| 2 | Generowany test izolacji najemcy z manifestu 545 akcji | ⬜ | Manifest `action-coverage.json` istnieje i jest kompletny — jest z czego generować |
| 3 | Bramka rozjazdu `schema.prisma` ↔ migracje | ⬜ | |

### Faza 1 — Granice modułów

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 4 | `src/platform/` — przeniesienie wspólnych zdolności | ⬜ | |
| 5 | `src/modules/<x>/` — moduł po module | ⬜ | |
| 6 | `contract.ts` + reguła ESLint blokująca import przez granicę | ⬜ | **Nie jest opcjonalna** (rozdz. 14) |
| 7 | `defineModule` + wyprowadzenie rejestru, uprawnień, nawigacji | ⬜ | |
| 8 | Migracja asystenta AI na katalog składany z deklaracji | ⬜ | |

### Faza 2 — Współdzielenie i współbieżność

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 9 | Modele `Workspace`, `WorkspaceMember`, `ResourceGrant`, `ResourceInvitation` | ⬜ | |
| 10 | `platform/sharing` — `requireAccess`, dziedziczenie, cache | ⬜ | |
| 11 | Migracja `ownerId`/`ownerTeamId` → `workspaceId` na 46 modelach | ⬜ | **Najgroźniejsze zadanie całej przebudowy** |
| 12 | Migracja `TaskProjectMember`/`TaskShare`/`PetShare` → `ResourceGrant` | ⬜ | |
| 13 | Deklaracje `resources` w `module.ts` | ⬜ | |
| 14 | `ShareDialog`, „Udostępnione mi", „Co udostępniłem" | ⬜ | Kontrakt widoku przyjmuje już prop `resource` — patrz wpis 045 |
| 15 | Kolumna `version` + `updateMany` z warunkiem na wersji | ⬜ | |
| 16 | `ConflictDialog` | ⬜ | j.w. |
| 17 | Test odwołania dostępu | ⬜ | |
| 18 | Test kontraktowy read-tooli AI | ⬜ | |

### Faza 3 — Domena i paginacja

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 19 | `domain/` w każdym module + testy bez bazy | ⬜ | |
| 20 | Paginacja kursorowa we wszystkich widokach listowych | ⬜ | `DataList` ma gotowy `onEndReached` — patrz wpis 045 |

### Faza 4 — Zdarzenia i koniec odpytywania

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 21 | `DomainEvent` + zapis w tej samej transakcji | ⬜ | |
| 22 | Publikacja przez worker | ⬜ | |
| 23 | SSE `/api/events` | ⬜ | |
| 24 | Usunięcie `setInterval` z `DataFreshness` | ⬜ | Interwał 45 s **nadal działa**; 045 tylko go uwidocznił |
| 25 | Subskrypcje międzymodułowe | ⬜ | |

### Faza 5 — Skala i koszt

| # | Zadanie | Status |
|---|---------|--------|
| 26 | Współdzielony rate-limit | ⬜ |
| 27 | Budżety AI | ⬜ |
| 28 | Pula połączeń, audyt N+1, indeksy | ⬜ |
| 29 | Cache agregatów i rozstrzygnięć dostępu | ⬜ |
| 30 | Retencja danych | ⬜ |

### Faza 6 — Obserwowalność i procesy

| # | Zadanie | Status |
|---|---------|--------|
| 31 | Logi strukturalne | ⬜ |
| 32 | Metryki na `/admin/health` | ⬜ |
| 33 | Rozdzielenie `web` / `worker` / `cron` | ⬜ |

### Faza 7 — Wielojęzyczność

| # | Zadanie | Status |
|---|---------|--------|
| 34 | `next-intl` | ⬜ |
| 35 | Wyciągnięcie tekstów do `messages/pl.json` | ⬜ |
| 36 | Zmiana `C-32` w konstytucji | ⬜ |
| 37 | Formatowanie `Intl` + język przestrzeni | ⬜ |
| 38 | Język przestrzeni w promptach AI | ⬜ |

### Faza 8 — Gotowość produkcyjna

| # | Zadanie | Status | Uwagi |
|---|---------|--------|-------|
| 39 | Eksport danych użytkownika | ⬜ | |
| 40 | Usunięcie konta | ⬜ | |
| 41 | Próba odtworzenia z kopii + runbook | ⬜ | |
| 42 | **Stany błędów i puste w każdym module** | 🟡 | Komponenty i bramka gotowe; migracja modułów 12/21 |
| 43 | Budżet wydajnościowy w CI | ⬜ | |

### Faza 9 — Domknięcie

| # | Zadanie | Status |
|---|---------|--------|
| 44 | Aktualizacja `CLAUDE.md` i konstytucji | ⬜ |
| 45 | Aktualizacja `/admin/architecture` i tego dokumentu | 🟡 |
| 46 | Wersja **Omnia 🧐** — wpis w historii wersji | ⬜ |

---

## Luka w dokumencie źródłowym

**Rozdz. 10.4 i 10.5 — system komponentów i kontrakt widoku — nie mają numeru w checkliście**,
choć rozdz. 10 opisuje je jako konkretny, udokumentowany dług (przycisk zapisu widoku z wersji 043).
Checklista wspomina o nich tylko pośrednio, przez zadanie 42 („stany błędów i puste w każdym module").

To jest przeoczenie w dokumencie, nie w planie. Odnotowane, żeby kolejna sesja nie uznała tej pracy
za samowolkę spoza zakresu.

---

## Wpisy przebiegów

### 045 — System komponentów, kontrakt widoku i silnik skórek · 2026-08-04

**Specyfikacja:** `specs/045-system-komponentow-i-skorki/`

**Co zrobiono**

- **Kontrakt widoku** (`components/ui/view/`): `ModuleView`, `ViewBar`, `ViewChrome`, `ViewState`,
  `ChromeFrame`. Moduł deklaruje tytuł, filtry, akcje i stan; ramę rysuje powłoka.
  Rozwiązanie odwraca zależność opisaną w 043: `AppShell` nie rysuje paska (nie zna tytułu modułu,
  więc dostałby podwójne nagłówki w ~20 modułach), tylko **udostępnia jego zawartość** przez
  `ViewChromeProvider`. Gwiazdka „zapisz widok", wskaźnik świeżości i wejście do ściągawki skrótów
  pojawiają się w pasku bez wiedzy modułu — **dług z 043 spłacony**.
- **Prop `resource`** przyjmowany od początku, choć dziś nieaktywny — żeby `ShareDialog`,
  `ConflictDialog` i awatary obecności (zadania 14, 16) dało się dołożyć bez wracania do 21 modułów.
- **Komponenty wspólne:** `ConfirmDialog`, `Field`, `DataList` (j/k, zaznaczanie; `onEndReached`
  gotowe pod zadanie 20), `BulkActionBar`.
- **Silnik skórek** rozszerzony daleko poza kolory: typografia, gęstość, zaokrąglenia, obramowania,
  cienie, tło (gradienty CSS), ruch, chrom powłoki. **Bez zmiany schematu** — `Skin.tokens` to JSON.
  Sanityzacja przepisana na whitelisty per rodzaj: `linear-gradient(` przechodzi, `url(`, `paint(`,
  `attr(` nie.
- **Skórki flagowe „Mostek" i „Papier"** (migracja 0224) z kontrastem **liczonym w testach**, nie
  ocenianym wzrokiem.
- **Generowanie skórki opisem słownym przez AI** — zakres dodany przez właściciela w trakcie
  przebiegu. Model **proponuje, nigdy nie zapisuje**; wynik przechodzi tę samą sanityzację co import
  pliku, bo model jest źródłem równie obcym.
- **Playground napisany od zera** — wywodzi listę z rejestru, więc nowy komponent pojawia się w nim
  sam; sterowanie właściwościami na żywo, warianty brzegowe, lokalny przełącznik skórki.
- **Bramka `check:ui-contract`** wpięta w `build`.

**Czego świadomie NIE zrobiono**

- **Migracja modułów na `ModuleView`: 12 z 21.** Pozostałe 9 widoków jest **jawnie wypisanych**
  w `src/lib/ui/view-contract.json` ze statusem `pending` — bramka pilnuje, że żaden nie zniknie
  z listy, a nowy moduł bez wpisu wywala build. Są to strony szczegółu z ręcznie pisanym `<h1>`
  (Flota, Języki, Zwierzęta, Portfel, QA, Warsztaty) i trzy widoki wielopanelowe (Zadania, Notatki,
  Zakupy). Każdy wymaga indywidualnej zamiany nagłówka, a nie mechanicznej podmiany opakowania —
  dlatego nie poszły partią.
- **Sweep zaszytych kolorów**: 50 plików oznaczonych jako `do-poprawy` w tym samym manifeście.
  Bramka wypisuje je przy każdym budowaniu, więc dług jest widoczny, a nie przemilczany.
- Faza 0 i pozostałe fazy przebudowy — zgodnie z zasadą „jedna faza = jeden przebieg".

**Punkt kontrolny kontraktu (C-54)**

Plan zakładał sprawdzian: jeśli `ModuleView` nie uniesie Wiadomości i Magazynowania, wracamy do planu
zamiast obchodzić problem w module. **Nie uniósł** — moduły wielopanelowe mają osobne przewijanie
panelu bocznego i listy, a kolumnowa rama narzuciłaby im jeden scroll na całość. Kontrakt został
więc **poszerzony** o `layout="fill"` (nagłówek i pasek w stałym pasku u góry, treść dostaje resztę
wysokości i przewija się sama) oraz o prop `breadcrumb`, który powtarzał się w ośmiu widokach
podrzędnych. Obie zmiany są w kontrakcie, nie w modułach.

**Decyzje warte zapamiętania**

- `--font-family-*` to **słowo kluczowe z zamkniętej listy**, nie dowolny stos czcionek. Dowolny
  `font-family` jest najtrudniejszym do sanityzacji tokenem (cudzysłowy i przecinki są w nim
  legalne), a stosy systemowe nie powodują żądań do sieci.
- Zaokrąglenia i gęstość zostały **wąskie** (px, max 3 cyfry). Promień w `em` skaluje się z tekstem,
  a `1000px` to nie zaokrąglenie, tylko awaria układu.
- Widoczność ramek narożnych rozstrzyga atrybut `data-chrome-frame` renderowany **serwerowo**, a nie
  odczyt tokenu w `useEffect` — inaczej dekoracja mignęłaby po hydratacji.
- `.omnia-skeleton` przeniesione z tekstowego dziecka `<style>` do `globals.css`. React escapuje tam
  cudzysłowy tylko na serwerze, a rozjazd hydratacji kładzie **całą** aplikację.

**Następny przebieg:** Faza 0, zadania 1–3.
