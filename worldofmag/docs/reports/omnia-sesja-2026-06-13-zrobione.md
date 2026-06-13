# Omnia — Raport sesji 2026-06-13: co zostało zrobione

> **Dla kolejnej sesji Claude Code.** To pełny przegląd zmian na gałęzi roboczej
> `claude/nifty-noether-C9D9D` względem `master` (138 commitów). Wszystko jest już zmergowane do
> `develop` (środowisko testowe, auto-deploy). `master` = produkcja (promocja tylko na wyraźną prośbę).
> Towarzyszący raport: **„Omnia — Raport sesji 2026-06-13: co odłożone"** (slug
> `omnia-sesja-2026-06-13-odlozone`) opisuje resztę backlogu. Źródło prawdy o statusach pozycji to
> **`omnia-master-plan-domkniecie-2026-06-07`** (kategoria `backlog`) — tam każda pozycja ma ✅/🟡/❌.

## 0. Jak czytać ten raport
- Praca szła **pozycja po pozycji** z master-planu; każda kończyła się: kod → `npm run build`
  zielony → commit → merge `claude/* → develop` → migracja seedująca raport implementacyjny.
- Migracje raportów: `prisma/migrations/0099…0173` (dollar-quoting, `ON CONFLICT (slug) DO UPDATE`).
  Każda pozycja ma własny raport implementacyjny w `/reports` (kategoria `general`).
- Build weryfikowany lokalnie na **Postgresie 16** (sandbox nie ma prod-DATABASE_URL). Testy
  jednostkowe: `npm run test:unit` (node:test + tsx, 42 testy).

## 1. Niezmienniki repo (przestrzegane przez całą sesję — trzymaj się ich dalej)
1. Własność 3-poziomowa: `ownerId` / `ownerTeamId` / systemowe (oba null); helpery `src/lib/ownership.ts`.
2. Mutacje = Server Actions w `src/actions/*` kończące się `revalidatePath()`.
3. RBAC: uprawnienia `module.*` w `src/lib/permissions.ts`; nowy moduł = wpis uprawnienia + seed ról
   w `scripts/migrate.js` + bramka trasy.
4. Statusy jako `String` + unia TS (NIGDY enum Prisma — SQLite/zasada repo).
5. Dwa źródła nawigacji: `src/lib/modules.tsx` (sidebar desktop + mobile) + switch `ModuleSubNav`.
6. Design system `src/components/ui/` + tokeny CSS; na akcentach `var(--on-accent)` zamiast `#fff`.
7. Migracje raportów Postgres-only, dollar-quoted, idempotentne.
8. Git: `claude/* → develop` automatycznie po zielonym buildzie; `master` tylko na prośbę.
9. **„Pro" to NIE płatność** — to nazwa techniczna/tryb pracy. Nic nie jest za paywallem; dostęp = RBAC.
   Monetyzacja (SC7, M15) świadomie odłożona do Fazy 4.

## 2. Środowisko buildu/testów (ważne — oszczędza czas następnej sesji)
- Komendy uruchamiaj z **`cd /home/user/home/worldofmag && …`** w jednej linii (cwd Basha potrafi się
  zresetować między turami; `next`/`prisma` tylko z `worldofmag/`).
- Lokalny Postgres do weryfikacji buildu bywa „down" → `sudo pg_ctlcluster 16 main start`.
  `DATABASE_URL="postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev"`, `DIRECT_URL` = to samo.
- `npx next build` (sam kompilator+typy) NIE potrzebuje DB; pełny `npm run build` (z `migrate.js`)
  potrzebuje DB — rób przed mergem.
- Pliki `*.test.ts` są wykluczone z `next build` w `tsconfig.exclude`.

## 3. Co zrobiono — wg obszarów

### 3.1 Nowe moduły / duże funkcje (wcześniejsza część gałęzi, przed master-planem)
- **Grupy projektów + trwałe widoki zadań** (`ProjectGroup`/`TaskView`), **pełne zarządzanie
  statusami listy zadań** (własne statusy obok systemowych).
- **Skórki/motywy** (`Skin`/`UserSkinPref`, 5 systemowych + własne/współdzielone; `/admin/skins`,
  `SkinPicker`; tokeny CSS inline na `<html>` w `layout.tsx`).
- **Warsztaty** (`/warsztaty`, tryby Dom/Pro, `Workshop`/`WorkshopItem`/`WorkshopProject`).
- **Tryb wskazywania** (admin: wskaż element → zgłoś), pływający FAB świadomy modali.

### 3.2 Marketplace „Usługi" — Etapy A/B/C (model Fixly + Booksy) — ZAMKNIĘTE
- **Etap A:** M1 czat (`ServiceMessage`), M3 wyceny (`ServiceQuote`), M4 portfolio (`ServiceImage`),
  M2 rezerwacja slotów + M8 czas trwania (`ServiceAvailability`, `lib/serviceSlots.ts`), M6
  powiadomienia (zdarzeniowe haki, 🟡 — patrz raport „odłożone").
- **Etap B:** M7 weryfikacja (NIP+badge, admin), M10 filtry zaawansowane, M12 reschedule, M18
  onboarding wykonawcy, M9 płatności+faktury (`ServicePayment`, spięcie z Portfelem), M5/M20 geo
  (`lat/lon`, haversine `lib/serviceGeo.ts`, filtr w promieniu; mapa-kafelki odłożona).
- **Etap C:** M11 ulubieni (`ServiceFavorite`), M13 statystyki wykonawcy, **M16 kody rabatowe**
  (`ServicePromoCode` percent|amount, `ServicePayment.promoCode/discount`), **M17 moderacja/spory**
  (`ServiceDispute`, `/services/moderation` admin), **M19 profil/SEO** (`ServiceProvider.slug+tagline`,
  `generateMetadata`, „Udostępnij"), **M14 firma+pracownicy** (`ServiceStaff`, per-staff harmonogram
  i rezerwacje; `BookingWidget` z wyborem pracownika; `StaffManager` w panelu).
- Odłożone w marketplace: M6 pełne (część zdarzeń), M8 warianty cennika, M15 abonamenty (monetyzacja),
  mapa-kafelki, tryb „dowolny pracownik".

### 3.3 Kalendarz, powiadomienia, CRM (nowe działy)
- **NM1 Kalendarz** domknięty: `getCalendarEvents` agreguje Zadania/Posiłki/Zdrowie/Pojazdy/Leki +
  opiekę nad zwierzętami (`PetCareTask`/`PetTreatment`) + SRS (`Vocabulary.dueAt`); `/calendar`
  z **filtrem modułu** (klikalna legenda + `?module=`).
- **NM3 Powiadomienia** (pod free tier, bez crona): model `Notification` (idempotentny po `dedupeKey`),
  `syncReminders` (skan terminów przy logowaniu/otwarciu dzwonka), `NotificationBell` w `AppShell`.
  Odblokował M6/T3/Z4/F2/K4/L5 (część z nich nadal niezrealizowana — patrz „odłożone").
- **NM9 Kontakty/CRM** (`/contacts`, model `Contact`, własność 3-poziom).

### 3.4 Faza 3 — domknięcia modułowe
- **Zadania:** T1 timeline + T2 Kanban (przełącznik widoku; DnD HTML5).
- **Notatki:** N1 live-preview markdown, N2 wikilinki `[[…]]`+backlinki (`lib/wikilinks.ts`) + ważone
  wyszukiwanie, N3 załączniki (`NoteAttachment`), N4 wersjonowanie (`NoteRevision`, historia+przywróć).
- **Kuchnia:** K1 skalowanie→zakupy (weryfikacja, już było), K2 wartości odżywcze przepisu,
  K5 rewizja przed zapisem po imporcie (OCR/URL/AI → `RecipeImportReview` + `recipeImportDraft`).
- **Zdrowie:** Z1 załączniki wyników (`HealthAttachment`), Z2 trendy badań (`numericValue`+sparkline),
  Z3 leki (weryfikacja — `/health/leki` już było).
- **Nawyki:** HA2 cele tygodniowe (`Habit.weeklyGoal`), HA3 nawyk→zadanie.
- **Języki:** L1 TTS (Web Speech), L2 tryb pisania, L3 seria nauki.
- **Flota:** F3 załączniki pojazdu (`VehicleAttachment`).

### 3.5 Finanse (Portfel) — DOMKNIĘTE
- **W1 budżety+cele** (`Budget`, `FinanceGoal`; `/portfel/budzety`).
- **W3 raporty miesięczne** (`getMonthlyReport`; `/portfel/raporty`).
- **W4 auto-wydatki** (silnik `lib/portfel/autoExpense.ts`, `FinanceSettings`, idempotentny po
  `WalletEntry.sourceModule/sourceId`; spięty z Flotą i — przez S6 — z Zakupami).
- **W5 wielowalutowość** (`baseCurrency`, `ExchangeRate`; `getWalletOverview` przelicza na bazę +
  `missingRates`; best-effort `refreshRatesFromNBP` — działa na prodzie, w sandboxie sieć blokowana).
- **S6 ceny pozycji zakupów** (`Item.price`; „Zakończ zakupy" księguje sumę w Portfelu).

### 3.6 AI pro (hardening asystenta)
- **H1 personalizacja pulpitu** (`DashboardPref`, tryb „Dostosuj pulpit": kolejność ↑/↓ + ukrywanie).
- **H3 transparentność** (`chatComplete` zwraca model+usage; agent sumuje tokeny → `meta`;
  `MetaFooter` „model · N tok."). Historia (AiConversation) i undo (undoActions + kosz H5) już były.
- **H4 niezawodność** (`lib/ai/rateLimit.ts`: rate-limit 20/min+250/h + strażnik współbieżności
  max 2; trasa agenta → 429 + graceful degradation).
- **H5 kosz/soft-delete** (`TrashItem`, `lib/trash.ts/recordTrash`, `/trash`, restoratory per-moduł;
  podpięte do `deleteNote`/`deleteTask` — w tym usunięcia przez AI są odwracalne).

### 3.7 Bezpieczeństwo / Admin — DOMKNIĘTE
- **A1 audyt** (`AuditLog`, `lib/audit.ts/logAudit` w mutacjach RBAC/config; `/admin/audit`).
- **A2 szyfrowanie kluczy API** (`lib/crypto/secrets.ts` AES-256-GCM, klucz z `CONFIG_SECRET`/
  `AUTH_SECRET`, wstecznie kompatybilne; UI nigdy nie dostaje surowego klucza; resolver/webSearch/ors
  deszyfrują do użycia). **Operacyjnie: `AUTH_SECRET` musi być stały** (rotacja = ponowne wpisanie kluczy).
- **A3 zdrowie systemu** (`/admin/health`: DB latencja/migracje, LLM, integracje, build, liczby, audyt).

### 3.8 Zwierzęta — DOMKNIĘTE (P1–P4)
- **P1 progressive disclosure** (weryfikacja — `petPresets` + `featureFlags` już działały).
- **P2 alerty parametrów terrariów** (`addEnvironmentReading` → `classifyValue` → powiadomienie NM3).
- **P3 eksport** (`lib/petExport.ts`: karta HTML do druku→PDF + CSV pomiarów).
- **P4 spięcie `/pets/calendar` z NM1** (filtr modułu w `/calendar`, link „Widok miesięczny").

### 3.9 Cross-cutting / jakość
- **X3 stany ładowania** (wspólny `LoadingState` + `loading.tsx` w 21 działach).
- **SC6 testy jednostkowe** (start): `npm run test:unit`, 42 testy (srs, recurrence, serviceSlots,
  wikilinks, parseQuantity, petEnvironment, serviceGeo).

## 4. Nowe modele Prisma w tej gałęzi (skrót)
`Notification`, `ServiceMessage`, `ServiceQuote`, `ServiceImage`, `ServiceAvailability`,
`ServicePayment`, `ServiceFavorite`, `ServicePromoCode`, `ServiceDispute`, `ServiceStaff`,
`Contact`, `NoteAttachment`, `NoteRevision`, `HealthAttachment`, `VehicleAttachment`,
`Budget`, `FinanceGoal`, `FinanceSettings`, `ExchangeRate`, `TrashItem`, `AuditLog`,
`DashboardPref`, `Skin`, `UserSkinPref`, `Workshop`/`WorkshopItem`/`WorkshopProject`, `ProjectGroup`.
Rozszerzenia pól: `ServiceProvider.{nip,verified,lat,lon,slug,tagline}`,
`ServiceListing.{durationMin,bookingEnabled}`, `ServiceAvailability.staffId`,
`ServiceRequest.staffId`, `ServicePayment.{promoCode,discount}`, `Item.price`,
`Recipe.{kcal,protein,carbs,fat}`, `Habit.weeklyGoal`, `HealthEvent.{numericValue,unit}`,
`Pet.{presetKey,featureFlags,...}`.

## 5. Lekcje (dopisane do `doświadczenia.md`)
- Regex `u`-flag/`\p{}` zakazane (target < es6) → `normalize("NFD").replace(/[̀-ͯ]/g,"")`.
- Iteracja Map → `Array.from(map.values())`.
- cwd Basha się resetuje → prefiksuj `cd …/worldofmag &&`; root repo NIE ignoruje `.next/`.
- Lokalny Postgres bywa „down" → `pg_ctlcluster 16 main start`.
- A2: szyfrowanie wiąże dane z env-sekretem — nie rotuj `AUTH_SECRET` bez planu.
- Pusta migracja zapisana jako „applied" blokuje późniejsze dopełnienie → twórz migracje z pełną
  treścią od razu; ratunek: `migrate resolve --rolled-back` → `--applied`.

## 6. Stan końcowy
Master-plan **domknięty produktowo**: marketplace A/B/C, Finanse, AI pro, Bezpieczeństwo/Admin,
Zwierzęta, Faza 3, NM1/NM3/NM9, kalendarz, kosz, personalizacja, stany ładowania, testy.
Pozostały głównie pozycje **Fazy 4** (infra/monetyzacja/branże), wymagające sieci lub dużych
nakładek, oraz pojedyncze przypomnienia zależne od NM3 — szczegóły w raporcie „co odłożone".
