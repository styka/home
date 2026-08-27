# Zadania: Skrzynka odbiorcza i komunikator zespołowy

- **Plan:** ./plan.md (107-skrzynka-i-komunikator)
- **Status:** todo
- **Data:** 2026-08-27

> **Zasada listy zadań:** kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami.
> Każde zadanie ≈ jeden spójny commit, z jasnym „gotowe, gdy…".

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Panel rozmów asystenta (najmniejsza samodzielna całość, zero schematu)

- [x] **T-1** — `AICommandSheet.tsx`: `PrzelacznikSegmentowy` wychodzi z kontenera
  `flex-1 overflow-y-auto` i staje się nieprzewijanym blokiem nad listą; ikona nagłówka `History` →
  `MessagesSquare`, a jej `title`/`aria-label` idą przez `t()` na nadrzędne **„Rozmowy"**. Teksty
  do `messages/pl.json`.
  **Gotowe, gdy:** przy 20 rozmowach przełącznik zostaje widoczny przez całe przewijanie listy,
  a nagłówek nie nazywa całości nazwą jednej z dwóch list. *(AC-29, AC-30)*

## Faza 1 — Fundament danych

- [x] **T-2** — Migracja `prisma/migrations/0268_skrzynka_i_czat/migration.sql` wg planu §2.3:
  kolumna `Notification.rodzaj` z domyślną `'zadanie'`, indeks `(userId, rodzaj, readAt)`, backfill
  `module = 'sharing'` → `'relacja'`, cztery tabele czatu z indeksami i kluczami obcymi, seed
  `module.czat` + `RolePermission` dla `ADMIN` (idempotentnie, wzorzec 0262).
  **Uwaga C-15:** po wygenerowaniu DDL obowiązkowy `grep -E "^(DROP|ALTER)"` — z diffa zostają
  wyłącznie instrukcje tej zmiany.
  **Gotowe, gdy:** `npm run check:migrations` przechodzi, a migracja aplikuje się na lokalnym
  Postgresie (`npx prisma migrate deploy`).
- [x] **T-3** — `prisma/schema.prisma`: `Notification.rodzaj`, modele `ChatConversation`,
  `ChatParticipant`, `ChatMessage`, `ChatReaction` + relacje odwrotne w `User` i `Workspace`.
  **Gotowe, gdy:** `npx prisma generate` czysto i `npm run check:schema-drift` nie zgłasza rozjazdu.

## Faza 2 — Skrzynka: warstwa serwera

- [x] **T-4** — `src/types/index.ts`: `export type RodzajPowiadomienia = "zadanie" | "relacja";`
  (plik `"use server"` nie może eksportować nie-funkcji). `src/lib/notify.ts`: `NotifyInput` zyskuje
  `rodzaj?` (domyślnie `"zadanie"`) i `aktualizuj?: boolean` — przy `true` `upsert` nadpisuje
  tytuł/treść i zeruje `readAt` (dla zbiorczego sygnału z rozmowy).
  **Gotowe, gdy:** `tsc --noEmit -p tsconfig.test.json` czysto, dotychczasowe wywołania `notifyUser`
  działają bez zmian.
- [x] **T-5** — `src/actions/notifications.ts`: `getNotifications({ rodzaj?, limit? })`,
  nowa `getLicznikiSkrzynki()` (`{ zadania, relacje, zaproszenia }`), `markAllNotificationsRead(rodzaj?)`.
  Wpis `notifications:getLicznikiSkrzynki` do `src/lib/ai/action-coverage.json`
  (`status: "excluded"`, `reason: "settings"`, `access: "self"`).
  **Gotowe, gdy:** `npm run check:ai-coverage` przechodzi, a `getLicznikiSkrzynki` liczy przez
  `count()` (nie `findMany` — bez naruszenia bramki paginacji).
- [ ] **T-6** `[P]` — `src/lib/sharingGrants.ts`: trzy wywołania `notifyUser` dostają
  `rodzaj: "relacja"`. `src/actions/invitations.ts`: `revalidatePath("/")` po przyjęciu i odrzuceniu,
  żeby powłoka przeliczyła liczniki.
  **Gotowe, gdy:** nadanie zasobu tworzy powiadomienie rodzaju `relacja`; przyjęcie zaproszenia
  odświeża licznik bez ręcznego przeładowania. *(AC-6, AC-7)*

## Faza 3 — Skrzynka: interfejs

- [x] **T-7** — `src/components/shell/NotificationBell.tsx` → skrzynka: `PrzelacznikSegmentowy`
  („Do zrobienia" / „Relacje", oba `wylaczona: false` jawnie) **poza** obszarem przewijania; segment
  „Relacje" renderuje najpierw żywe zaproszenia do zespołu z przyciskami „Przyjmij"/„Odrzuć"
  (`confirmDialog({ destructive: true })` przy odrzuceniu), potem powiadomienia rodzaju `relacja`;
  znacznik rodzaju przy pozycji; cel dotyku 44 × 44 px; wszystkie teksty przez `t()`.
  **Gotowe, gdy:** oba segmenty widoczne z licznikami także przy zerze, przyjęcie/odrzucenie działa
  bez opuszczania panelu, a stan zgadza się ze stroną `/invitations`. *(AC-1..AC-5, AC-8, AC-9, AC-13)*
- [ ] **T-8** `[P]` — `src/components/shell/AppShell.tsx`: czerwona kropka zaproszeń znika
  z hamburgera (jej rolę przejął licznik skrzynki); `invitationCount` przestaje być tam potrzebny.
  **Gotowe, gdy:** na telefonie zaproszenie widać przy dzwonku z licznikiem, a nie jako bezimienna
  kropka na menu. *(AC-8, AC-11)*

## Faza 4 — Moduł Czat: rdzeń serwerowy

- [ ] **T-9** — `src/modules/czat/domain/rozmowa.ts` + `domain/__tests__/rozmowa.test.ts`:
  `czyMozeEdytowac`, `czyPisze` (TTL 6 s), `stanPrzeczytania`, `podsumujNieprzeczytane`,
  `etykietaRozmowy`. Wpis `"czat"` w `src/lib/domain-coverage.json` (`rodzaj: "domena"`).
  **Gotowe, gdy:** `npm run check:domain` przechodzi, `npm run test:unit` zielony, plik reguł nie
  importuje Prismy, Reacta ani sesji.
- [ ] **T-10** — `src/modules/czat/module.ts` (`defineModule` z `szybkieCele` wewnątrz tras modułu)
  + `contract.ts` (tylko to, czego używa chrom: licznik i podgląd rozmów) + wpięcie w
  `src/lib/modules.tsx` (import, `DECLARED`, `MODULE_ORDER` po `contacts`) + wpis `"czat"` w
  `src/lib/sharing-classification.json` (`rodzaj: "zakres"` z powodem).
  **Gotowe, gdy:** `npm run check:module-registry` i `npm run check:boundaries` przechodzą, a moduł
  pojawia się w nawigacji, wachlarzu i mapowaniu ścieżka → uprawnienie.
- [ ] **T-11** — `src/platform/events/bus.ts`: `SygnalKanalu.workspaceId` staje się opcjonalne,
  dochodzi `rozmowaId?`. `src/modules/czat/lib/sygnal.ts` — `sygnalRozmowy(rozmowaId, uczestnicy)`
  rozgłasza na kanały `user:<id>`. `src/modules/czat/lib/dostep.ts` — `assertUczestnik`,
  `assertAutor`, `assertMozeRozmawiac`.
  **Gotowe, gdy:** `npm run check:realtime` przechodzi (trasa strumienia nietknięta, szyna nadal
  zwraca odsubskrybowanie), a ładunek sygnału nie niesie treści wiadomości.
- [ ] **T-12** — `src/modules/czat/actions/rozmowy.ts`: `getRozmowy` (zapewnia kanał każdego zespołu
  użytkownika), `getRozmowa`, `getRozmowcy` (tylko osoby powiązane zespołem albo nadaniem),
  `getLicznikNieprzeczytanych`, `otworzRozmowePrywatna`, `oznaczPrzeczytane`, `zglosPisanie`.
  Każda mutacja: guard + `revalidatePath("/czat")`. Wpisy w `action-coverage.json`.
  **Gotowe, gdy:** `npm run check:ai-coverage` i `npm run check:owner-columns` przechodzą, a lista
  rozmówców nie ujawnia kont niepowiązanych. *(AC-14, AC-15, AC-24, AC-25)*
- [ ] **T-13** — `src/modules/czat/actions/wiadomosci.ts`: `getWiadomosci` z
  `...zapytanieKursorowe({ kursor, rozmiar })`, `wyslijWiadomosc` (+ `ostatniaAktywnosc`, sygnał),
  `edytujWiadomosc`, `usunWiadomosc` (miękkie, snapshot do `TrashItem` — C-24), `przelaczReakcje`.
  Wpisy w `action-coverage.json`.
  **Gotowe, gdy:** `npm run check:pagination` przechodzi, a próba edycji/usunięcia cudzej wiadomości
  **wywołana wprost akcją** kończy się odmową. *(AC-20, AC-21, AC-22, AC-23, AC-26)*

## Faza 5 — Moduł Czat: interfejs

- [ ] **T-14** — `src/app/czat/layout.tsx` (`await wymagajDostepuDoModulu(czatModule.permission)`)
  + `src/app/czat/page.tsx` (cienki wrapper: sesja → dane → render) + wpis `"czat"` w
  `src/lib/ui/view-contract.json`.
  **Gotowe, gdy:** `npm run check:route-gating` i `npm run check:ui-contract` przechodzą, a wpisanie
  `/czat` z ręki bez uprawnienia przekierowuje na `/`.
- [ ] **T-15** — `src/modules/czat/ui/CzatPage.tsx` + `ListaRozmow.tsx`: `ModuleView` z
  `layout="fill"`, `density="compact"` i stanami brzegowymi **wyłącznie** przez `state`/`empty`;
  wybrana rozmowa w adresie (`/czat?r=<id>`); poniżej `md` widoczna jedna kolumna.
  **Gotowe, gdy:** na 360 × 640 widać albo listę, albo wątek (nigdy dwóch paneli), a powrót
  z wątku działa przyciskiem „wstecz". *(AC-28)*
- [ ] **T-16** — `src/modules/czat/ui/WatekRozmowy.tsx`: bąbelki, cytat odpowiedzi z przewinięciem
  do oryginału, reakcje emoji z licznikiem, oznaczenie „przeczytano", wskaźnik pisania, pozycja
  startowa na pierwszej nieprzeczytanej i doczytywanie starszych przy przewijaniu w górę.
  **Gotowe, gdy:** wszystkie kolory z tokenów CSS, wszystkie teksty przez `t()`.
  *(AC-18, AC-19, AC-22, AC-23, AC-26)*
- [ ] **T-17** — `src/modules/czat/ui/PoleWiadomosci.tsx`: wysyłka, edycja i usunięcie własnej
  wiadomości (`confirmDialog({ destructive: true })`), odpowiedź z cytatem, dławienie `zglosPisanie`
  do 1 zapisu / 3 s; `padding-bottom: env(safe-area-inset-bottom)`; przyciski pod polem na
  `onPointerDown` + `preventDefault`, żeby pierwsze tapnięcie nie chowało klawiatury.
  **Gotowe, gdy:** na telefonie pole nie zasłania ostatniej wiadomości, a klawiatura nie znika przy
  pierwszym tapnięciu w przycisk. *(AC-20, AC-28)*
- [ ] **T-18** — `src/platform/events/sygnalKlienta.ts` (mikro-magistrala w przeglądarce) +
  `DataFreshness.tsx` publikuje sygnał obok `router.refresh()` + konsumenci: `WatekRozmowy`
  (dociąga nowe wiadomości) i licznik w chromie.
  **Gotowe, gdy:** wiadomość wysłana w jednej karcie pojawia się w drugiej bez odświeżenia, a przy
  zerwanym strumieniu dochodzi najpóźniej awaryjnym odpytywaniem. *(AC-16)*

## Faza 6 — Spięcie skrzynki z czatem

- [ ] **T-19** — `src/components/shell/IkonaCzatu.tsx` (warianty `topbar` / `chrome`, licznik,
  `AnchoredLayer` z listą rozmów i wejściem do modułu) + wpięcie w `AppShell` (górny pasek telefonu)
  i `ModuleSidebar` (rząd nad nawigacją), za dzwonkiem. Dane **z kontraktu** modułu, nigdy z wnętrza.
  **Gotowe, gdy:** obie ikony stoją w tej samej kolejności na telefonie i komputerze, lustrzą się
  z ustawieniem ręki dominującej i mają cel dotyku 44 × 44 px. *(AC-10, AC-11, AC-12, AC-13)*
- [ ] **T-20** — Zbiorczy sygnał z rozmowy: `wyslijWiadomosc` woła `notifyUser` z
  `rodzaj: "relacja"`, `aktualizuj: true` i `dedupeKey: "czat-<rozmowaId>"` (jedna pozycja na
  rozmowę, treść „N nowych wiadomości od …"); `oznaczPrzeczytane` oznacza to powiadomienie jako
  przeczytane.
  **Gotowe, gdy:** trzy nieprzeczytane wiadomości dają **jedną** pozycję w skrzynce, a wejście do
  rozmowy ją gasi i licznik nie wraca po zmianie ekranu. *(AC-17, AC-27)*

## Faza 7 — Domknięcie i bramki

- [ ] **T-21** — `src/lib/privacy/purge.ts`: po usunięciu konta domykamy rozmowy prywatne, którym
  zostało mniej niż dwóch uczestników.
  **Gotowe, gdy:** po usunięciu konta testowego nie zostaje ani jedna osierocona rozmowa. *(AC-32)*
- [ ] **T-22** — Komplet tekstów w `messages/pl.json` (`modules.czat.*`,
  `components.shell.NotificationBell.*`, `components.shell.IkonaCzatu.*`) i zero literałów
  w komponentach.
  **Gotowe, gdy:** `npm run check:i18n` przechodzi, a każde `t("klucz")` rozwiązuje się do
  istniejącego wpisu. *(AC-31)*
- [ ] **T-23** — **Pełna lista bramek wzięta z `package.json`, nie z pamięci** (lekcja z 2026-08-27):
  ```bash
  python3 -c "import json;print('\n'.join(k.strip() for k in json.load(open('package.json'))['scripts']['build'].split('&&')))"
  ```
  Uruchamiamy **wszystkie kroki poza ostatnim** (`scripts/migrate.js` — C-13), na lokalnym
  Postgresie. Po `next build` podnosimy `sumaB` w `src/lib/ui/perf-baseline.json` do **zmierzonej**
  wartości (nowa trasa = więcej JS; pasmo ±5 % działa w obie strony).
  **Gotowe, gdy:** wszystkie bramki zielone, `next build` przechodzi. *(AC-33)*
- [ ] **T-24** — Mapowanie każdego AC ze speca na wynik obserwacji (wejście do `/verify`).
  **Gotowe, gdy:** żadne AC nie zostaje bez pokrycia albo bez jawnie zapisanego powodu.
- [ ] **T-25** — Wpisy do `doświadczenia.md` (C-51) dla każdej nieoczywistej pułapki napotkanej
  po drodze, po polsku, w formacie `## YYYY-MM-DD — tytuł` / Problem / Rozwiązanie / Lekcja.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadania |
|---|---|
| AC-1, AC-2, AC-3, AC-4 | T-5, T-7 |
| AC-5 | T-7 |
| AC-6, AC-7 | T-6, T-7 |
| AC-8 | T-5, T-7, T-8 |
| AC-9 | T-7 |
| AC-10, AC-11 | T-8, T-19 |
| AC-12 | T-19 |
| AC-13 | T-7, T-19 |
| AC-14, AC-15 | T-12 |
| AC-16 | T-11, T-18 |
| AC-17 | T-12, T-20 |
| AC-18, AC-19 | T-9, T-12, T-16 |
| AC-20, AC-21 | T-13, T-17 |
| AC-22, AC-23 | T-13, T-16 |
| AC-24, AC-25 | T-11, T-12 |
| AC-26 | T-13, T-16 |
| AC-27 | T-20 |
| AC-28 | T-15, T-17 |
| AC-29, AC-30 | T-1 |
| AC-31 | T-22 (+ kontrola hexów w T-23) |
| AC-32 | T-2 (kaskady), T-21 |
| AC-33 | T-23 |

## Notatki / blokady

- **Ścieżka krytyczna:** T-2 → T-3 → (T-4 → T-5 → T-7) oraz T-3 → (T-9, T-10, T-11) → T-12 → T-13 →
  T-14 → T-15 → T-16/T-17 → T-18 → T-19 → T-20 → T-23. T-1 jest **poza** ścieżką krytyczną i może
  wejść pierwszy jako samodzielna poprawka.
- T-6 i T-8 są równoległe do sąsiadów (osobne pliki, brak wspólnego stanu).
- T-23 wymaga lokalnego Postgresa; `scripts/migrate.js` **nie jest** uruchamiany (C-13).
