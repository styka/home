# Plan techniczny: Skrzynka odbiorcza i komunikator zespołowy

- **Spec:** ./spec.md (107-skrzynka-i-komunikator)
- **Status:** draft
- **Data:** 2026-08-27

> **Zasada planu:** to jest **JAK**. Plan pisany pod istniejący kod — wzorcem jest moduł **YouTube**
> (102), najświeższy moduł zbudowany w całości pod dzisiejsze bramki.

## 1. Podejście

Trzy warstwy, każda samodzielnie użyteczna i wdrażalna, w tej kolejności:

1. **Panel asystenta** (najmniejsza całość, zero schematu) — przełącznik wychodzi z kontenera
   przewijania, ikona i jej opis zmieniają nazwę na nadrzędną.
2. **Skrzynka** — `Notification` dostaje kolumnę `rodzaj` (`zadanie` | `relacja`), a `NotificationBell`
   zamienia się w skrzynkę z `PrzelacznikSegmentowy` (ten sam komponent, którym 100/106 rozwiązało
   dokładnie ten problem) i akcjami przyjmij/odrzuć wykonywanymi na miejscu.
3. **Moduł Czat** — nowy moduł `src/modules/czat/` wzorowany 1:1 na module YouTube (deklaracja,
   trasa w `src/app/czat/` z bramką w `layout.tsx`, akcje, widok przez `ModuleView`), plus ikona
   w chromie z podglądem rozmów.

**Czas rzeczywisty na istniejącej szynie, bez outboxu.** `platform/events/bus.ts` ma już kanał
`user:<id>` liczony z sesji w `/api/events` — wystarczy z akcji wysyłki wywołać `rozglos` na kanały
uczestników. Ścieżka przez `DomainEvent` (outbox → worker co 5 s → `dispatch`) kosztowałaby wpis
w `events-coverage.json`, subskrybenta z manifestem idempotencji i dodatkowe opóźnienie — dla
sygnału, którego jedynym zadaniem jest powiedzieć „odśwież się" (C-53). Ładunek zostaje **ubogi**
(rodzaj + identyfikator rozmowy), treść klient pobiera z serwera, który sprawdza uczestnictwo — to
zamyka drogę do wycieku cudzej rozmowy kanałem (ryzyko ze speca).

## 2. Model danych (Prisma)

### 2.1 Zmiana istniejącego modelu

- **`Notification`** — nowa kolumna `rodzaj String @default("zadanie")` (C-12: tekst + union TS,
  **nigdy** enum). Nowy indeks `@@index([userId, rodzaj, readAt])` — skrzynka liczy nieprzeczytane
  per rodzaj przy każdym renderze powłoki.
  Union: `export type RodzajPowiadomienia = "zadanie" | "relacja";`

### 2.2 Nowe modele (moduł Czat)

```prisma
model ChatConversation {
  id                String   @id @default(cuid())
  rodzaj            String   // "prywatna" | "zespol"
  workspaceId       String?  // ustawione dla rozmowy zespołowej; NULL dla prywatnej
  tytul             String?  // tylko rozmowa zespołowa (nazwa zespołu w chwili założenia)
  ostatniaAktywnosc DateTime @default(now())
  createdAt         DateTime @default(now())
  workspace    Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  uczestnicy   ChatParticipant[]
  wiadomosci   ChatMessage[]
  @@unique([workspaceId])            // dokładnie JEDEN kanał na przestrzeń zespołu
  @@index([ostatniaAktywnosc])
}

model ChatParticipant {
  id             String    @id @default(cuid())
  conversationId String
  userId         String
  przeczytaneDo  DateTime?   // znacznik czasu ostatniej przeczytanej wiadomości
  pisalAt        DateTime?   // wskaźnik pisania (TTL po stronie odczytu)
  createdAt      DateTime  @default(now())
  conversation ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([conversationId, userId])
  @@index([userId])
}

model ChatMessage {
  id             String    @id @default(cuid())
  conversationId String
  autorId        String
  tresc          String
  odpowiedzNaId  String?     // cytat (AC-22)
  editedAt       DateTime?
  deletedAt      DateTime?   // miękkie usunięcie (C-24)
  createdAt      DateTime  @default(now())
  conversation ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  autor        User             @relation(fields: [autorId], references: [id], onDelete: Cascade)
  odpowiedzNa  ChatMessage?     @relation("Odpowiedzi", fields: [odpowiedzNaId], references: [id], onDelete: SetNull)
  odpowiedzi   ChatMessage[]    @relation("Odpowiedzi")
  reakcje      ChatReaction[]
  @@index([conversationId, createdAt])
}

model ChatReaction {
  id        String   @id @default(cuid())
  messageId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())
  message ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([messageId, userId, emoji])   // ta sama reakcja drugi raz = jej cofnięcie (AC-23)
  @@index([messageId])
}
```

**Dlaczego rozmowa nie ma `ownerId`/`ownerTeamId` ani wymaganego `workspaceId`:** dostęp do rozmowy
wynika z **uczestnictwa**, nie z własności. Kolumna `workspaceId` jest tu tożsamością kanału
zespołowego (jak w `WorkspaceMember`/`ResourceGrant`), a nie lustrem własności — dlatego jest
**nullowalna bez wyzwalacza** i bramka `check:workspace-fill` jej nie obejmuje (obejmuje wyłącznie
modele mające **jednocześnie** `workspaceId` i kolumny właściciela; sprawdzone w kodzie bramki).
Kaskada z `Workspace` realizuje AC-25 i połowę AC-32.

### 2.3 Migracja (C-10, C-11, C-14)

- Numer z `npm run next:migration`: **0268**
- Katalog: `prisma/migrations/0268_skrzynka_i_czat/migration.sql`
- Zawartość, w tej kolejności:
  1. `ALTER TABLE "Notification" ADD COLUMN "rodzaj" TEXT NOT NULL DEFAULT 'zadanie';`
  2. `CREATE INDEX "Notification_userId_rodzaj_readAt_idx" ON "Notification"("userId","rodzaj","readAt");`
  3. **Backfill istniejących wierszy:** `UPDATE "Notification" SET "rodzaj" = 'relacja' WHERE "module" = 'sharing';`
     — udostępnienia już dziś powiadamiają (`lib/sharingGrants.ts`), więc bez tego wpadłyby do
     „Do zrobienia". Wszystko inne zostaje `zadanie` — bezpieczna wartość domyślna z ryzyka w specu.
  4. `CREATE TABLE` × 4 + indeksy + klucze obce (DDL wzorowany na 0262).
  5. Seed uprawnienia (idempotentnie, wzorzec 0262):
     `INSERT INTO "Permission" … 'module.czat' … ON CONFLICT ("slug") DO NOTHING;`
     + `INSERT INTO "RolePermission" … 'ADMIN' … ON CONFLICT DO NOTHING;`
- **C-15:** DDL bierzemy z `prisma migrate diff`, ale **przepisujemy tylko instrukcje tej zmiany**;
  po wygenerowaniu obowiązkowy `grep -E "^(DROP|ALTER)"` — diff zawsze proponuje skasować indeksy
  `pg_trgm` z `schema-drift-allowed.json`.
- **C-13:** weryfikacja wyłącznie na lokalnym Postgresie; `scripts/migrate.js` nie odpalamy.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 Skrzynka — `src/actions/notifications.ts` (edycja)

| Funkcja | Zmiana |
|---|---|
| `getNotifications(opcje?: { rodzaj?: RodzajPowiadomienia; limit?: number })` | filtr po `rodzaj`; `take` zostaje (C-pagination) |
| `getLicznikiSkrzynki()` | **nowa** — `{ zadania: number; relacje: number; zaproszenia: number }`; `zaproszenia` z `getPendingInvitationsCount()`, reszta z `notification.count` (count, nie `findMany` — bramka paginacji dotyczy `findMany`) |
| `markNotificationRead` / `markAllNotificationsRead` | `markAllNotificationsRead(rodzaj?)` — „oznacz wszystkie" ma dotyczyć **oglądanej listy**, nie cudzej |

`src/lib/notify.ts` (helper serwerowy, nie akcja):
- `NotifyInput` zyskuje `rodzaj?: RodzajPowiadomienia` (domyślnie `"zadanie"`),
- oraz `aktualizuj?: boolean` — dla zbiorczego sygnału z rozmowy (AC-27) `upsert` musi **nadpisać**
  tytuł/treść i wyzerować `readAt`; dzisiejsze `update: {}` jest poprawne dla przypomnień
  (nie „odczytuj ponownie"), ale dla licznika „3 nowe wiadomości" byłoby zamrożeniem pierwszej.

`src/lib/sharingGrants.ts`: trzy wywołania `notifyUser` dostają `rodzaj: "relacja"`.

### 3.2 Zaproszenia — `src/actions/invitations.ts` (edycja)

Bez nowych funkcji. `acceptInvitation`/`rejectInvitation`/`getPendingInvitations` są już akcjami
z guardem — panel skrzynki woła **te same**, więc AC-9 („jedno źródło prawdy, dwa widoki") wychodzi
z konstrukcji, a nie z dyscypliny. Dokładamy jedynie `revalidatePath("/")` tam, gdzie go brak, żeby
powłoka przeliczyła liczniki po przyjęciu (AC-6).

**Świadoma decyzja:** zaproszeń do zespołu **nie materializujemy** jako wierszy `Notification`.
Segment „Relacje" składa listę z dwóch źródeł — żywych zaproszeń (`TeamInvitation` PENDING) i wierszy
`Notification` o `rodzaj = "relacja"` (nadania zasobów, zbiorcze sygnały z rozmów). Kopia
zaproszenia w tabeli powiadomień byłaby drugim nośnikiem tego samego stanu i mogłaby przeżyć
przyjęcie — dokładnie rozjazd, przed którym ostrzega ryzyko w specu.

### 3.3 Czat — `src/modules/czat/actions/`

**`rozmowy.ts`** (nazwa pliku globalnie unikalna — klucz manifestu pokrycia to sama nazwa pliku):

| Funkcja | Rola | Guard |
|---|---|---|
| `getRozmowy()` | lista rozmów użytkownika + nieprzeczytane + ostatnia wiadomość; **zapewnia kanał** dla każdego zespołu, do którego należy (AC-14) | `auth()` |
| `getRozmowa(id)` | nagłówek rozmowy (uczestnicy, stan przeczytania, pisanie) | `assertUczestnik` |
| `getRozmowcy()` | osoby, z którymi łączy mnie zespół albo nadanie zasobu (AC-15) | `auth()` |
| `getLicznikNieprzeczytanych()` | liczba rozmów z nieprzeczytanymi — dla ikony w chromie | `auth()` |
| `otworzRozmowePrywatna(userId)` | znajdź albo załóż rozmowę 1:1 | `assertMozeRozmawiac` |
| `oznaczPrzeczytane(rozmowaId)` | ustawia `przeczytaneDo`, kasuje zbiorcze powiadomienie rozmowy | `assertUczestnik` |
| `zglosPisanie(rozmowaId)` | `pisalAt = now()`, dławione po stronie klienta do 1 zapisu / 3 s | `assertUczestnik` |

**`wiadomosci.ts`**:

| Funkcja | Rola | Guard |
|---|---|---|
| `getWiadomosci(rozmowaId, kursor?)` | strona wiadomości, `...zapytanieKursorowe({ kursor, rozmiar })` (AC-26) | `assertUczestnik` |
| `wyslijWiadomosc(rozmowaId, tresc, odpowiedzNaId?)` | zapis + `ostatniaAktywnosc` + sygnał + zbiorcze powiadomienie pozostałym | `assertUczestnik` |
| `edytujWiadomosc(id, tresc)` | tylko własna (AC-20/AC-21) | `assertAutor` |
| `usunWiadomosc(id)` | `deletedAt` + snapshot do `TrashItem` (C-24) | `assertAutor` |
| `przelaczReakcje(id, emoji)` | `create` albo `delete` po `@@unique` (AC-23) | `assertUczestnik` |

Każda mutacja kończy się `revalidatePath("/czat")` (C-20) i — poza `zglosPisanie` — wywołaniem
`sygnalRozmowy(...)`.

**`src/modules/czat/lib/dostep.ts`** — guardy modułu:
`assertUczestnik(userId, rozmowaId)`, `assertAutor(userId, wiadomoscId)`, `assertMozeRozmawiac(a, b)`
(wspólny zespół albo istniejące nadanie zasobu). Wszystkie rzucają, wszystkie są w ciele akcji —
bramka `check:ai-coverage` sprawdza obecność wywołania guardu, nie samą deklarację.

**`src/modules/czat/lib/sygnal.ts`** — `sygnalRozmowy(rozmowaId, uczestnicy)` →
`rozglos(uczestnicy.map(id => \`user:${id}\`), { type: "czat.rozmowa", rozmowaId })`.
`SygnalKanalu.workspaceId` staje się **opcjonalne** (rozmowa prywatna nie leży w żadnej przestrzeni);
`dispatch.ts` podaje je jak dotąd. Dokładamy `rozmowaId?: string` — nadal ubogi ładunek, bez treści.

### 3.4 Kasowanie konta — `src/lib/privacy/purge.ts` (edycja)

Kaskady FK zabierają uczestnictwo, wiadomości i reakcje. Zostaje **rozmowa prywatna bez drugiej
strony** — po usunięciu konta domykamy ją jawnie: skasuj `ChatConversation` o `rodzaj = "prywatna"`,
które nie mają już co najmniej dwóch uczestników (AC-32, „bez osieroconych rekordów").

## 4. RBAC / rejestr modułu (C-22, C-36)

- **Nowy slug `module.czat`** — seed w migracji 0268 (pkt 2.3).
- `src/modules/czat/module.ts` — `defineModule({ id: "czat", label: "Czat", href: "/czat",
  permission: "module.czat", color: "var(--accent-green)", Icon: MessageCircle, defaultEnabled: true,
  szybkieCele: [{ id: "rozmowy", href: "/czat", … }, { id: "nowa", href: "/czat?akcja=nowa", … }] })`.
  `szybkieCele` są **wymagane** przez 9. kontrolę `check:module-registry` i muszą leżeć wewnątrz tras
  modułu.
- Wpięcie w korzeń kompozycji `src/lib/modules.tsx`: import + `DECLARED` + pozycja w `MODULE_ORDER`
  (po `contacts` — moduł „ludzki", nie narzędziowy). `permissionForPath` i nawigacja (sidebar,
  menu mobilne, `PasekKciuka`, `WachlarzNawigacji`) biorą wszystko z deklaracji — **żadnych
  równoległych list** (C-36).
- **Brak `module.server.ts`** — moduł nie wnosi akcji asystenta ani zadań w tle (decyzja ze speca:
  „Asystent AI — nie dotyczy"). Bramka 4b sprawdza wpięcie tylko wtedy, gdy plik istnieje.
- `src/lib/sharing-classification.json` — wpis `"czat": { "rodzaj": "zakres", "powod": "Dostęp wynika
  z uczestnictwa w rozmowie; brak decyzji per-rekord bogatszej niż «czy jestem uczestnikiem», więc
  deklaracja `sharing.ts` byłaby plikiem bez konsumenta (C-35)." }` — bramka rejestru wymaga
  rozstrzygnięcia dla **każdego** modułu.
- `src/lib/domain-coverage.json` — wpis `"czat": { "rodzaj": "domena", "pliki": [...] }`
  (reguły w `domain/rozmowa.ts`, patrz §5.3).
- `src/lib/ui/view-contract.json` — `"czat": { "status": "done", "entries": ["src/modules/czat/ui/CzatPage.tsx"] }`.
- `src/lib/ai/action-coverage.json` — wpis dla **każdej** akcji z §3.3 i dla nowego
  `notifications:getLicznikiSkrzynki`: `status: "excluded"`, `reason: "interactive"` (rozmowa jest
  interaktywna; asystent świadomie jej nie dotyka), `access: "owner"` dla rozmów i `"self"` dla
  liczników. Bez tych wpisów build pada.

## 5. UI (C-30, C-31, C-32, C-33)

### 5.1 Skrzynka — `src/components/shell/NotificationBell.tsx` (przebudowa)

- Pod nagłówkiem panelu staje `PrzelacznikSegmentowy` z dwoma segmentami: „Do zrobienia" i
  „Relacje", każdy z licznikiem; oba `wylaczona: false` **jawnie** — pusta lista „Relacje" jest
  jedynym miejscem, gdzie widać, że taka lista w ogóle istnieje (lekcja 106).
- Przełącznik i nagłówek są **poza** obszarem przewijania (`flex-shrink-0`), lista przewija się pod
  nimi — ta sama poprawka, którą robimy w asystencie (§5.4).
- Segment „Relacje" renderuje najpierw **zaproszenia do zespołu** (nazwa zespołu, kto zaprasza,
  przyciski „Przyjmij" / „Odrzuć"), potem powiadomienia `rodzaj = "relacja"`.
  „Odrzuć" idzie przez `confirmDialog({ destructive: true })` (C-34).
- Znacznik rodzaju przy pozycji (AC-4): kropka modułu zostaje, dochodzi ikona rodzaju
  (`Bell` / `Users`), kolory wyłącznie z tokenów (C-30).
- `AppShell` (telefon): **czerwona kropka zaproszeń znika z hamburgera** — jej rolę przejmuje licznik
  skrzynki; `invitationCount` przestaje być tam potrzebny.

### 5.2 Ikona czatu w chromie — `src/components/shell/IkonaCzatu.tsx` (nowy)

- Warianty `topbar` / `chrome` — dokładnie te same, którymi posługuje się `NotificationBell`, więc
  ikona wchodzi obok niej w `AppShell` (górny pasek telefonu) i w `ModuleSidebar` (rząd nad
  nawigacją). Kolejność: dzwonek, potem czat (AC-10, AC-11); rząd i tak lustrzy się klasą
  `.omnia-chrom-konta` za `html[data-reka]`, więc ręka dominująca działa bez dodatkowej pracy.
- Cel dotyku 44 × 44 px **w wariancie `topbar`** (telefon — C-31); w rzędzie chromu na komputerze
  zostaje 34 px ustalone w 086, bo tam celuje mysz, a podniesienie jednej ikony rozjechałoby rząd
  z czterema sąsiadkami. Doprecyzowane razem z AC-13 na etapie implementacji (C-54).
- Panel: `AnchoredLayer` z listą rozmów (nieprzeczytane u góry) + stopka „Otwórz Czat" → `/czat`.
- Dane bierze z **kontraktu** modułu (`@/modules/czat/contract`), nigdy z jego wnętrza (C-36).

### 5.3 Moduł Czat — trasa i widok

```
src/app/czat/layout.tsx   → await wymagajDostepuDoModulu(czatModule.permission)   (bramka check:route-gating)
src/app/czat/page.tsx     → server: getRozmowy() → <CzatPage poczatkowe={…} viewParams={…} />
src/modules/czat/ui/CzatPage.tsx     → ModuleView layout="fill" density="compact" state=…
src/modules/czat/ui/ListaRozmow.tsx
src/modules/czat/ui/WatekRozmowy.tsx   (bąbelki, cytat, reakcje, „przeczytano", wskaźnik pisania)
src/modules/czat/ui/PoleWiadomosci.tsx (kompozytor)
src/modules/czat/domain/rozmowa.ts + domain/__tests__/rozmowa.test.ts
```

- **`ModuleView` z `layout="fill"`** (jak Zadania/Notatki/Zakupy): lista rozmów i wątek mają osobne
  przewijanie. Stany brzegowe **wyłącznie** przez `state`/`empty` (C-33) — nigdy rysowane ręcznie.
- **Telefon (AC-28):** poniżej `md` widoczna jest **jedna** kolumna — lista albo wątek (wybór
  w adresie: `/czat?r=<id>`, dzięki czemu wątek jest odnośnikiem i wraca przyciskiem „wstecz”).
  Kompozytor przykleja się do dołu z `padding-bottom: env(safe-area-inset-bottom)`; przyciski pod
  polem używają `onPointerDown` + `preventDefault`, żeby pierwsze tapnięcie nie chowało klawiatury
  (wzorzec z asystenta, opisany w `doświadczenia.md`).
- **`domain/rozmowa.ts`** — reguły czyste, bez Prismy/Reacta/sesji, z testem (bramka
  `check:domain`): `czyMozeEdytowac(wiadomosc, userId)`, `czyPisze(pisalAt, teraz)` (TTL 6 s),
  `stanPrzeczytania(wiadomosc, uczestnicy)`, `podsumujNieprzeczytane(rozmowa, userId)`,
  `etykietaRozmowy(rozmowa, uczestnicy, jaId)`.
- **Czas rzeczywisty po stronie klienta:** `src/platform/events/sygnalKlienta.ts` — mikro-magistrala
  (`opublikujSygnal`/`subskrybujSygnal`), publikowana przez `DataFreshness` przy zdarzeniu `zmiana`,
  konsumowana przez `WatekRozmowy` (dociąga nowe wiadomości) i `IkonaCzatu` (odświeża licznik).
  Dowożona **razem z konsumentami** (C-35) — 085 skasowało poprzedniczkę dokładnie dlatego, że
  konsumenta straciła. `router.refresh()` zostaje nietknięty.
- **Teksty** (C-32): `messages/pl.json` → `modules.czat.*`, `components.shell.NotificationBell.*`,
  `components.shell.IkonaCzatu.*`. **Zero literałów w komponentach** — bramka `check:i18n` jest
  regułą bezwzględną od 097.

### 5.4 Panel rozmów asystenta — `src/components/assistant/AICommandSheet.tsx`

- `PrzelacznikSegmentowy` **wychodzi** z `<div className="flex-1 overflow-y-auto …">` i staje się
  osobnym, nieprzewijanym blokiem nad nim (AC-29). Zawartość przełącznika bez zmian.
- Ikona nagłówka (`History`, linia ~1894): `title`/`aria-label` przechodzą na **„Rozmowy"** przez
  `t()` (dziś literał w wyrażeniu klamrowym, którego bramka i18n nie widzi — poprawiamy przy okazji,
  bo to ten sam napis). Ikona zmienia się na `MessagesSquare` — `History` nazywa jedną z dwóch list,
  więc wprowadzała w błąd (AC-30).

## 6. AI / integracje

**Nie dotyczy** (decyzja ze speca §6). Żadnej nowej `AIAction`, żadnego read-toola, żadnego wkładu
do kalendarza ani do pulpitu. `check:actions` i `check:content-memory` nie mają tu czego sprawdzać;
`check:ai-coverage` wymaga wyłącznie **klasyfikacji** nowych akcji (§4).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|---|---|---|
| `prisma/schema.prisma` | edycja | `Notification.rodzaj` + 4 modele czatu + relacje w `User`/`Workspace` |
| `prisma/migrations/0268_skrzynka_i_czat/migration.sql` | nowy | kolumna + backfill + tabele + seed `module.czat` |
| `src/types/index.ts` | edycja | `RodzajPowiadomienia` (plik akcji nie może eksportować nie-funkcji) |
| `src/lib/notify.ts` | edycja | `rodzaj` + `aktualizuj` w `NotifyInput` |
| `src/actions/notifications.ts` | edycja | filtr po rodzaju, `getLicznikiSkrzynki`, `markAll(rodzaj)` |
| `src/actions/invitations.ts` | edycja | `revalidatePath("/")` po przyjęciu/odrzuceniu |
| `src/lib/sharingGrants.ts` | edycja | `rodzaj: "relacja"` w trzech powiadomieniach |
| `src/lib/privacy/purge.ts` | edycja | domknięcie osieroconych rozmów prywatnych |
| `src/platform/events/bus.ts` | edycja | `workspaceId` opcjonalne + `rozmowaId` w sygnale |
| `src/platform/events/sygnalKlienta.ts` | nowy | magistrala sygnału w przeglądarce |
| `src/components/shell/DataFreshness.tsx` | edycja | publikuje sygnał obok `router.refresh()` |
| `src/components/shell/NotificationBell.tsx` | edycja | skrzynka: segmenty + zaproszenia + akcje |
| `src/components/shell/IkonaCzatu.tsx` | nowy | ikona + podgląd rozmów w chromie |
| `src/components/shell/AppShell.tsx` | edycja | ikona czatu w górnym pasku; kropka z hamburgera znika |
| `src/components/shell/ModuleSidebar.tsx` | edycja | ikona czatu w rzędzie chromu |
| `src/components/assistant/AICommandSheet.tsx` | edycja | przyklejony przełącznik + nazwa „Rozmowy" |
| `src/modules/czat/{module,contract}.ts` | nowe | deklaracja + granica modułu |
| `src/modules/czat/actions/{rozmowy,wiadomosci}.ts` | nowe | Server Actions |
| `src/modules/czat/lib/{dostep,sygnal}.ts` | nowe | guardy + rozgłoszenie |
| `src/modules/czat/domain/rozmowa.ts` + `__tests__` | nowe | reguły czyste + test (C-domain) |
| `src/modules/czat/ui/{CzatPage,ListaRozmow,WatekRozmowy,PoleWiadomosci}.tsx` | nowe | widok |
| `src/app/czat/{layout,page}.tsx` | nowe | trasa cienka + bramka uprawnienia |
| `src/lib/modules.tsx` | edycja | import, `DECLARED`, `MODULE_ORDER` |
| `src/lib/{sharing-classification,domain-coverage}.json` | edycja | rozstrzygnięcia dla `czat` |
| `src/lib/ui/view-contract.json` | edycja | wpis widoku |
| `src/lib/ai/action-coverage.json` | edycja | klasyfikacja nowych akcji |
| `messages/pl.json` | edycja | teksty PL |
| `src/lib/ui/perf-baseline.json` | edycja | `sumaB` po zmierzeniu (nowa trasa = więcej JS) |
| `doświadczenia.md` | edycja | wpisy z pułapek napotkanych po drodze (C-51) |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13 — nigdy prod DB):** lokalny Postgres 16 (`pg_ctlcluster 16 main start`),
`DATABASE_URL`/`DIRECT_URL` na `127.0.0.1:5432` wyeksportowane **do powłoki**, `npx prisma migrate deploy`.

**Bramki bierzemy z `package.json`, nie z pamięci** (lekcja z 2026-08-27) — wszystkie kroki `build`
**poza ostatnim** (`scripts/migrate.js`):

```bash
python3 -c "import json;print('\n'.join(k.strip() for k in json.load(open('package.json'))['scripts']['build'].split('&&')))"
```

Krytyczne dla tej zmiany: `check:migrations`, `check:schema-drift`, `check:module-registry`,
`check:boundaries`, `check:route-gating`, `check:ui-contract`, `check:ai-coverage`, `check:domain`,
`check:i18n`, `check:pagination`, `check:owner-columns`, `check:workspace-fill`, `check:logs`,
`check:client-safe`, `check:realtime`, `check:tailwind`, `tsc`, `next lint`, `next build`,
`check:perf` (po buildzie; próg `sumaB` podnosimy do zmierzonej wartości).

**Mapowanie AC → sposób weryfikacji**

| AC | Jak sprawdzamy |
|---|---|
| AC-1..AC-4 | ręcznie w panelu dzwonka (dwa segmenty, liczniki, segment z zerem widoczny, znacznik rodzaju) |
| AC-5..AC-7 | konto z zaproszeniem do zespołu + nadaniem zasobu: przyjmij/odrzuć w panelu; nadanie prowadzi do zasobu (AC-7 zawężone na etapie weryfikacji — patrz spec) |
| AC-8 | konto bez zaproszeń → brak licznika |
| AC-9 | przyjęcie na `/invitations` → panel pokazuje ten sam stan (wspólne akcje) |
| AC-10..AC-13 | oględziny chromu na 360 px i na komputerze + pomiar celu dotyku w narzędziach przeglądarki |
| AC-14, AC-15 | konto w zespole widzi kanał bez zakładania; lista rozmówców ograniczona do powiązanych |
| AC-16 | dwie karty/dwa konta — wiadomość pojawia się bez odświeżenia |
| AC-17, AC-18, AC-19 | liczniki, „przeczytano", wskaźnik pisania na dwóch sesjach |
| AC-20, AC-21 | edycja/usunięcie własnej; **próba na cudzej wywołana bezpośrednio akcją** musi rzucić |
| AC-22, AC-23 | odpowiedź z cytatem, reakcja i jej cofnięcie |
| AC-24, AC-25 | wywołanie `getWiadomosci` cudzej rozmowy → odmowa; po opuszczeniu zespołu kanał znika |
| AC-26, AC-28 | długa rozmowa: pozycja startowa i doczytywanie; telefon 360 × 640 z klawiaturą |
| AC-27 | trzy wiadomości bez odczytu → **jedna** pozycja w skrzynce |
| AC-29, AC-30 | panel asystenta z 20 rozmowami — przełącznik nie ucieka; nazwa ikony |
| AC-31 | `check:i18n` + `check:ui-contract` (kontrola hexów) |
| AC-32 | usunięcie konta testowego i zespołu → brak osieroconych wierszy |
| AC-33 | pełna lista bramek jak wyżej |
| reguły czyste | `npm run test:unit` — `domain/__tests__/rozmowa.test.ts` |

## 9. Ryzyka techniczne i plan wycofania

- **Szyna działa w jednym procesie.** Karta podłączona do innej instancji nie dostanie sygnału.
  Mitygacja: istniejąca siatka bezpieczeństwa (awaryjne odpytywanie co 5 minut + odświeżenie przy
  powrocie do karty) oraz to, że **treść zawsze pochodzi z serwera** — sygnał może się zgubić,
  wiadomość nie.
- **Zapis przy każdym „piszę…".** `zglosPisanie` to `UPDATE` jednej kolumny; dławimy do 1 zapisu na
  3 s na rozmowę i wyłącznie przy aktywnym polu. Gdyby okazało się kosztowne — wskaźnik pisania da
  się wyłączyć jedną flagą w kompozytorze bez ruszania schematu.
- **Backfill `rodzaj`.** `UPDATE … WHERE module = 'sharing'` jest jednorazowy i idempotentny;
  błędne zaklasyfikowanie nie gubi danych — najwyżej pozycja stoi w drugim segmencie.
- **Wzrost paczki JS.** Nowa trasa podnosi `sumaB`; próg podnosimy **po pomiarze**, nie „na zapas"
  (pasmo ±5 % działa w obie strony).
- **Rollback:** kod cofa się rewertem gałęzi. Migracja 0268 jest **addytywna** (nowa kolumna
  z wartością domyślną + nowe tabele), więc stary kod działa na nowym schemacie bez zmian — nie ma
  potrzeby migracji wstecznej. Nowe tabele zostają puste; w razie potrzeby kasuje je osobna,
  świadoma migracja (runbook `docs/devops/runbook-deploy-rollback.md`).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-15** — ręczna migracja 0268 z `next:migration`, `String` + union zamiast enumów,
      seed uprawnienia idempotentny, DDL z diffa **czytany** przed wklejeniem, zero builda na prod DB.
- [x] **C-16/C-17/C-21** — nie ruszamy lustra zespołów ani katalogu zasobów; dostęp do rozmowy to
      **uczestnictwo**, rozstrzygane guardem modułu, a klasyfikacja `zakres` mówi to wprost.
- [x] **C-20** — wszystkie mutacje to Server Actions z `revalidatePath`.
- [x] **C-22** — nowy slug `module.czat` zaseedowany migracją, moduł wpięty **jedną deklaracją**.
- [x] **C-23** — brak nowych `AIAction` (świadomie); nowe akcje sklasyfikowane w manifeście pokrycia.
- [x] **C-24** — usunięcie wiadomości przez `TrashItem`, nie twarde `delete`.
- [x] **C-25** — bez zmian RBAC/konfiguracji w czasie działania, więc bez wpisów audytu
      (nadania zasobów logują się jak dotąd).
- [x] **C-30/C-31/C-32/C-33/C-34/C-35** — tokeny CSS, `env(safe-area-inset-bottom)`, 44 px, teksty
      w `pl.json`, `ModuleView` ze `state`, `confirmDialog({ destructive: true })`, nowa magistrala
      sygnału dowożona z konsumentami.
- [x] **C-36** — moduł widzi świat przez `contract.ts`, własne wnętrze importuje ścieżką względną;
      powłoka sięga po kontrakt, nie po wnętrze; platforma nie poznaje modułu Czat.
- [x] **C-53** — bez nowych zależności; czas rzeczywisty na istniejącej szynie zamiast outboxu;
      zaproszenia czytane z istniejącej tabeli zamiast kopiowane do powiadomień.
