-- 0148: odhaczenie H5 w master-planie (re-seed z md) + raport implementacyjny kosza.
INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — Master plan domknięcia: stan vs wymagania (2026-06-07)',
  'omnia-master-plan-domkniecie-2026-06-07',
  $omnia_master_plan$# Omnia — Master plan domknięcia: stan vs wymagania (2026-06-07)

> **Czym jest ten dokument.** Jedno, scalone źródło prawdy dla **kolejnej sesji Claude Code**.
> Powstał, bo dwa zgłoszenia administratora („marketplace konkurujący z Fixly/Booksy" oraz
> „dokończ wszystkie wskazania raportu architektury 2026-05-31") **zazębiają się**, odwołują do
> kilku starszych raportów, a w międzyczasie **część prac już wykonano** — zrobił się bałagan.
> Ten raport: (1) rekonstruuje pełną historię wymagań, (2) **weryfikuje faktyczny stan w kodzie na
> 2026-06-07**, (3) spisuje **całą** pozostałą pracę pozycja-po-pozycji z uzasadnieniem „dlaczego".
> Bierz pozycje wg faz i priorytetów. Nic nie zostało pominięte — pozycje odłożone są oznaczone.

---

## ▶ Dziennik realizacji (aktualizowany przy każdej sesji)

- **2026-06-07 — NM1 (Kalendarz) ✅ DOMKNIĘTE.** `getCalendarEvents` agreguje teraz także
  opiekę nad zwierzętami (`PetCareTask`/`PetTreatment.nextDueAt`) i powtórki SRS języków
  (`Vocabulary.dueAt`, grupowane per talia+dzień). Spełnia §18.5 „daty ze wszystkich modułów".
- **2026-06-07 — NM3 (Powiadomienia) ✅ ZROBIONE (rdzeń).** Model `Notification` (idempotentny
  po `dedupeKey`), akcje `syncReminders` (skan terminów pod free tier — bez crona, wołany przy
  logowaniu/otwarciu dzwonka; zaległe+nadchodzące z Zadań/Zdrowia/Floty/Zwierząt/Spiżarni/SRS/
  Usług), `getNotifications`/`markRead`/`markAllRead`/`notifyUser`. Globalny dzwonek
  (`NotificationBell`) w `AppShell`. **Web-push PWA** pozostaje jako rozszerzenie (model gotowy).
  Tym samym odblokowane: M6, T3, Z4, F2, K4, L5.
- **2026-06-07 — M6 (powiadomienia marketplace) 🟡 częściowo.** Zdarzeniowe haki: wykonawca
  dostaje powiadomienie o nowym zleceniu, klient o zmianie statusu. Reszta zdarzeń (czat/wycena/
  rezerwacja) dojdzie wraz z M1/M2/M3.

- **2026-06-07 — Marketplace Etap A: M1, M3, M4 ✅.** **M1 czat** (`ServiceMessage`, wątek
  zlecenia, dymki, auto-mark-read) · **M3 wyceny** (`ServiceQuote`: wykonawca wysyła →
  klient akceptuje/odrzuca → odrzucenie pozostałych + przejście zlecenia do ACCEPTED) ·
  **M4 portfolio** (`ServiceImage`, upload data-URL w panelu + galeria na profilu publicznym).
  Wszystko z powiadomieniami M6. UI: `RequestThread` (czat+wyceny) rozwijany w karcie zlecenia.
- **Pozostało w Etapie A:** M2 (rezerwacja slotów — Booksy) + M8 (czas trwania/warianty, warunek M2).

- **2026-06-07 — Marketplace Etap A: M2 ✅ + M8 🟡 (rdzeń Booksy).** Oferta ma `durationMin` +
  `bookingEnabled` (M8: czas trwania; **warianty cennika pozostają** → M8 🟡). Model
  `ServiceAvailability` (reguły tygodniowe) + czysta logika slotów (`src/lib/serviceSlots.ts`).
  Wykonawca ustawia dostępność (`AvailabilityEditor`), klient rezerwuje wolny slot
  (`BookingWidget`) → zlecenie od razu `SCHEDULED` + powiadomienie. Rezerwacje spięte z
  **Kalendarzem** (moduł `services`). **Etap A zamknięty w rdzeniu** (oba tory transakcyjne).

- **2026-06-07 — Marketplace Etap B start: M7 ✅ + M10 ✅.** **M7 weryfikacja**: `ServiceProvider.nip`
  + `verified`; wykonawca podaje NIP, admin nadaje badge zaufania (`setProviderVerified`,
  gated `module.admin`, + powiadomienie). `VerifiedBadge` w katalogu/profilu/panelu. **M10 filtry**:
  cena min/max, min. ocena, „z rezerwacją", „tylko zweryfikowani" + sortowanie (ocena/cena/najnowsze).

> Następna sesja: Etap B dalej — M5/M20 geo+mapa → M9 płatności/faktury → M12 reschedule → M18 onboarding. Potem NM9 (CRM).

- **2026-06-07 — Marketplace Etap B: M12 ✅ + M18 ✅.** **M12 reschedule**: `rescheduleRequest`
  (klient/wykonawca zmienia termin umówionego zlecenia; dla ofert z rezerwacją waliduje wolny
  slot z pominięciem bieżącego zlecenia) + UI `RescheduleControl`. **M18 onboarding**:
  `OnboardingChecklist` w panelu wykonawcy (profil → oferta → dostępność → portfolio z postępem).

> Następna sesja: Etap B dalej — M9 płatności/faktury (→Portfel) → M5/M20 geo+mapa. Potem NM9 (CRM).

- **2026-06-07 — Marketplace Etap B: M9 ✅ (płatności + Portfel).** Model `ServicePayment`
  (kwota/metoda/status/nr faktury, 1/zlecenie). Wykonawca ustala kwotę i oznacza opłacone z
  **opcjonalnym księgowaniem przychodu w Portfelu**; klient może zaksięgować swój **wydatek**.
  Spięcie z Portfelem opt-in po obu stronach (`addEntry`). UI: `PaymentSection` w wątku zlecenia.

- **2026-06-07 — Marketplace Etap B: M5/M20 ✅ (geo + promień).** `ServiceProvider.lat/lon`
  ustawiane **przeglądarkową geolokalizacją** (bez zewnętrznego geocodera/mapy — zgodnie z
  ograniczeniami sieci). Haversine w `src/lib/serviceGeo.ts`; `getListings` przyjmuje `near`
  (lat/lon/promień) → dystans, filtr po promieniu, sort po odległości. UI: `LocationControl`
  (panel wykonawcy „Użyj mojej lokalizacji"), filtr „W pobliżu" + promień w katalogu, dystans
  na kartach. **Interaktywna mapa** (kafelki) odłożona — wymaga biblioteki/tile-serwera.

> **Etap B marketplace zamknięty** (M5/M7/M9/M10/M12/M18 ✅; mapa-kafelki i depozyt to drobne reszty).
> Następna sesja: NM9 (Kontakty/CRM) lub Etap C (P2) lub backlog poza marketplace (T1/T2, R2/S2, Faza 3–4).

- **2026-06-07 — NM9 (Kontakty/CRM) ✅.** Nowy moduł `/contacts`: model `Contact` (własność
  3-poziom, tagi=JSON), akcje CRUD (`ownedByWhere`+`assertOwnership`, wyszukiwanie), `ContactsPage`
  (lista/szukajka/dodawanie/edycja, tel/mailto, tagi), uprawnienie `module.contacts` (+seed),
  rejestracja w `modules.tsx`. Fundament relacji klient↔wykonawca.

> Następna sesja: Zadania T1 (timeline) + T2 (Kanban), domknięcia R2/S2, potem Faza 3 / Etap C marketplace.

- **2026-06-07 — Zadania: T1 ✅ + T2 ✅.** Przełącznik **Lista/Kanban/Timeline** w `TasksPage`
  (additywny, nie rusza `TaskList`). **T2 Kanban**: kolumny = włączone statusy listy, karty
  przeciągane (HTML5 DnD) zmieniają status (`updateTask`); priorytet + termin na karcie.
  **T1 Timeline**: zadania pogrupowane po dniu terminu (zaległe→przyszłe, „Dziś/Jutro", bez
  terminu na końcu). Pliki: `KanbanBoard.tsx`, `TimelineView.tsx`, `TasksPage.tsx`.

> Następna sesja: domknięcia 🟡 R2 (szukanie raportów po treści) + S2 (podsumowanie zakupów), potem Faza 3 / Etap C marketplace.

- **2026-06-07 — Domknięcia: R2 ✅ + S2 ✅.** R2: serwerowe `searchReports` (tytuł+treść, debounce 300ms) zamiast filtra po tytule. S2: modal podsumowania zakupów (kupione/brakujące/pozostałe + razem) przed archiwizacją listy.

> Następna sesja: Faza 3 (Notatki N1–N4, Kuchnia K1/K2/K5, Zdrowie Z1/Z2, Języki L1–L3) lub Etap C marketplace (P2).

- **2026-06-07 — Nawyki: HA2 ✅ + HA3 ✅.** HA2: `Habit.weeklyGoal` (N×/tydzień, dowolne dni) — tryb celu w `getHabits`/UI. HA3: `createTaskFromHabit` + przycisk „→ Zadanie" w karcie nawyku.

> Następna sesja: Faza 3 dalej (Kuchnia K5 review-po-OCR, Zdrowie Z2 trendy badań, Notatki N1) lub Etap C marketplace.

- **2026-06-07 — Notatki: N1 ✅.** Live-preview markdown w edytorze notatki (przelacznik Podglad, split textarea+render), wzorzec edytora raportow R1.

> Nastepna sesja: Faza 3 dalej (Z2 trendy badan, K5 review-po-OCR, L3 gamifikacja) lub Etap C marketplace (P2).

- **2026-06-07 — Jezyki: L1 ✅.** Wymowa slowek przez Web Speech API (src/lib/tts.ts + SpeakButton) w liscie slowek i sesji nauki; mapowanie nazw jezykow na BCP-47. Bez sieci/zaleznosci.

> Nastepna sesja: Faza 3 dalej (Z2 trendy badan, K5 review-po-OCR, K2 kalorie, N2 wikilinks) lub Etap C marketplace (P2).

- **2026-06-07 — Marketplace Etap C: M11 ✅ + M13 ✅.** M11: ServiceFavorite (ulubieni wykonawcy) — serce na profilu + sekcja w katalogu. M13: getProviderStats (zlecenia/konwersja/przychod) — sekcja Statystyki w panelu wykonawcy.

> Nastepna sesja: Etap C dalej (M14 firma+pracownicy, M16 promocje, M19 SEO) lub Faza 3 (Z2/K2/N2).

- **2026-06-07 — Kuchnia: K2 ✅.** Wartosci odzywcze przepisu (kcal/bialko/wegle/tluszcz na porcje) — pola w RecipeEditor, wyswietlanie w RecipeView (na porcje + razem).

> Nastepna sesja: Faza 3 (Z2 trendy badan, N2 wikilinks, L3 gamifikacja) lub Etap C marketplace (M16/M19).

- **2026-06-07 — Zdrowie: Z2 ✅.** HealthEvent.numericValue+unit; getTestTrends grupuje badania po nazwie; sekcja Trendy badan ze sparkline (SVG) + delta. Bez zaleznosci wykresowej.

> Nastepna sesja: Faza 3 (N2 wikilinks, L2/L3, K1/K5) lub Etap C marketplace (M16/M17/M19) lub Faza 4.

- **2026-06-08 — Jezyki: L2 ✅.** Tryb pisania w StudySession (przelacznik Fiszki/Pisanie): wpisanie tlumaczenia + sprawdzenie z normalizacja (diakrytyki/interpunkcja/warianty) i informacja zwrotna; ocena SRS bez zmian.

> Nastepna sesja: Faza 3 (N2 wikilinks, L3 gamifikacja, K1/K5) lub Etap C marketplace (M16/M17/M19) lub Faza 4.

- **2026-06-08 — Jezyki L3 ✅ + Kuchnia K1 ✅ (weryfikacja).** L3: getStudyStreak (seria kolejnych dni z powtorka) + kafel Seria nauki. K1: skalowanie porcji do listy zakupow JUZ istnialo (shopForRecipe/ShopForRecipeDialog) — zweryfikowane i odhaczone.

> Nastepna sesja: Faza 3 (N2 wikilinks, K5 review-OCR, Z1/Z3, N3/N4) lub Etap C marketplace (M16/M17/M19) lub Faza 4.

- **2026-06-08 — Flota F3 ✅ + Zdrowie Z3 ✅ (weryfikacja).** F3: VehicleAttachment (faktury/dowod rej./OC) — upload data-URL + lista w VehicleDetailPage. Z3: leki/pielegnacja czlowieka JUZ istnieja (/health/leki + MedicationSchedule MEDICATION|CARE) — odhaczone.

> Nastepna sesja: Faza 3 (N2 wikilinks, K5 review-OCR, N3/N4, Z1) lub Etap C marketplace (M16/M17/M19) lub Faza 4.

- **2026-06-08 — Zdrowie Z1 ✅.** HealthAttachment (wyniki badan PDF/zdjecia, data-URL) — rozwijana sekcja Wyniki/zalaczniki w karcie wpisu, upload przez FileReader, pobieranie/usuwanie.

> Nastepna sesja: Faza 3 (N2 wikilinks, K5 review-OCR, N3/N4) lub Etap C marketplace (M16/M17/M19) lub Faza 4.

- **2026-06-08 — Notatki N3 ✅.** NoteAttachment (obrazy/pliki, data-URL) — w trybie edycji notatki miniatury + upload przez FileReader + usuwanie (wzorzec F3/Z1).

> Nastepna sesja: Faza 3 (N2 wikilinks, N4 wersjonowanie, K5 review-OCR) lub Etap C marketplace (M16/M17/M19) lub Faza 4.

- **2026-06-08 — Notatki N4 ✅.** Wersjonowanie/historia notatki: model `NoteRevision`,
  migawka POPRZEDNIEJ wersji przy kazdej zmianie tytulu/tresci w `updateNote` (limit 20 ostatnich),
  akcje `getNoteRevisions`/`restoreNoteRevision` (przywrocenie tez trafia do historii). UI: sekcja
  „Historia" w trybie edycji (lista wersji z data, podglad tresci, przycisk Przywroc).

> Nastepna sesja: Faza 3 (N2 wikilinks, K5 review-OCR) lub Etap C marketplace (M16/M17/M19) lub Faza 4.

- **2026-06-10 — Notatki N2 ✅.** Wikilinki `[[Tytul]]` laczace notatki: `src/lib/wikilinks.ts`
  (parsowanie, rozwiazywanie po tytule case-insensitive, backlinki). W trybie edycji sekcja
  „Powiazane": „Linkuje do" (rozwiazane→klikalne, nierozwiazane→wyszarzone) + „Linkuja tu"
  (backlinki) z nawigacja do notatki (`allNotes`+`onNavigateToNote` przekazywane przez liste).
  Wyszukiwarka notatek: wazone sortowanie wynikow (tytul dokladny>prefix>zawiera>tag>tresc).

> Nastepna sesja: Faza 3 (K5 review-OCR) lub Etap C marketplace (M16/M17/M19) lub Faza 4 (skala/branze V1-V5).

- **2026-06-10 — Kuchnia K5 ✅.** Rewizja przed zapisem po imporcie (OCR/URL/AI): importy nie
  tworza juz przepisu od razu — szkic (`CreateRecipeInput`) trafia do `sessionStorage`
  (`src/lib/kitchen/recipeImportDraft.ts`), a uzytkownik laduje na `/kitchen/recipes/new?import=1`
  (`RecipeImportReview` → `RecipeEditor` z `initialDraft` + baner „sprawdz i popraw"). Zapis dopiero
  po akceptacji w edytorze. Trzy dialogi (`ImportFromImage/Url/AIDialog`) przepiete na ten przeplyw.

> Nastepna sesja: Faza 3 domknieta (Notatki + Kuchnia). Dalej: Etap C marketplace (M14/M16/M17/M19)
> lub Faza 4 (skala/monetyzacja SC2-SC7, branze V1-V5, nowe dzialy NM2/NM4/NM6-8/NM10).

- **2026-06-10 — Portfel W1 ✅.** Budzety i cele oszczednosciowe. Modele `Budget`
  (kategoria+limit miesieczny, wlasnosc 3-poziom) i `FinanceGoal` (target+postep+termin).
  Akcje `portfelBudgets.ts`: budzet CRUD + `getBudgetsWithSpending` (wydatki biezacego miesiaca
  liczone z wpisow `expense` per kategoria, z elementow uzytkownika/zespolow), cele CRUD +
  `contributeGoal` (wplata/wycofanie, auto `achievedAt`). Strona `/portfel/budzety` (`BudgetsPage`)
  z paskami postepu (zielony/bursztyn≥80%/czerwony>100%), wejscie w pod-nawigacji + kafel na home.

> Nastepna sesja: finanse dalej (W3 raporty miesieczne, W4 auto-wydatki, W5 kursy) lub AI pro
> (H3/H4/H5) lub Etap C marketplace (M14/M16/M17/M19) lub Faza 4.

- **2026-06-10 — Portfel W3 ✅.** Raporty miesieczne „gdzie poszly pieniadze". Akcja
  `portfelReports.ts/getMonthlyReport(offset)`: agreguje wpisy income/expense danego miesiaca z
  elementow uzytkownika/zespolow → przychod/wydatek/bilans + podzial wydatkow per kategoria
  (malejaco, %) + porownanie wydatkow vs poprzedni miesiac + flaga `hasOlder` do nawigacji wstecz.
  Strona `/portfel/raporty` (`MonthlyReportPage`): kafle podsumowania, paski kategorii z paleta
  kolorow, przelacznik miesiaca (starszy/nowszy, on-demand fetch). Wejscie w pod-nawigacji + kafel.

> Nastepna sesja: finanse dalej (W4 auto-wydatki Zakupy/Flota/Kuchnia → Portfel, W5 kursy) lub
> AI pro (H3/H4/H5) lub Etap C marketplace (M14/M16/M17/M19) lub Faza 4.

- **2026-06-10 — Portfel W4 ✅ (silnik + Flota).** Auto-ksiegowanie wydatkow do Portfela.
  Generyczny silnik `src/lib/portfel/autoExpense.ts` (`bookAutoExpense`/`removeAutoExpense`,
  idempotentny po `WalletEntry.sourceModule`+`sourceId`, ksieguje tylko na PRYWATNE aktywne konto
  uzytkownika; aktualizacja koryguje saldo o roznice, usuniecie cofa). `FinanceSettings` per-user
  (wlacznik + konto docelowe) + strona `/portfel/ustawienia` (`PortfelSettingsPage`, autosave).
  Spiete z Flota: `addFuelLog` (koszt→„paliwo"), `addServiceRecord` (koszt→„serwis pojazdu",
  notka=typ), `deleteFuelLog`/`deleteServiceRecord` cofaja wpis. Zakupy/Kuchnia dolacza po S6
  (ceny pozycji). Wejscie w pod-nawigacji Portfela.

> Nastepna sesja: finanse (W5 kursy walut) lub S6 (ceny pozycji zakupow → domkniecie W4/F1) lub
> AI pro (H3/H4/H5) lub Etap C marketplace (M14/M16/M17/M19) lub Faza 4.

- **2026-06-10 — Portfel W5 ✅.** Wielowalutowosc: `FinanceSettings.baseCurrency` (waluta
  sprawozdawcza) + tabela `ExchangeRate` (per-user, `1 currency = rate × base`, source manual|nbp).
  `getWalletOverview` przelicza majatek netto i szereg czasowy na baze (`src/lib/portfel/currency.ts`
  `loadRates`/`toBase`), zwraca `missingRates` (waluty bez kursu liczone 1:1 + ostrzezenie na home).
  Akcje `portfelCurrency.ts`: base/kurs CRUD + `refreshRatesFromNBP` (best-effort, tabela A,
  przelicza wzgledem bazy; w sandboxie sieć zablokowana → czytelny blad, na prodzie dziala). UI:
  sekcja „Waluty i kursy" w `/portfel/ustawienia`.

> **Finanse domkniete** (W1/W3/W4/W5; W2 import banku = P2 odlozone). Nastepna sesja: AI pro
> (H3 transparentnosc/undo, H4 niezawodnosc, H5 kosz/soft-delete) lub Etap C marketplace
> (M14/M16/M17/M19) lub S6 (ceny zakupow) lub Faza 4.

- **2026-06-10 — AI pro H5 ✅ (infra + Notatki/Zadania).** Kosz / soft-delete. Model `TrashItem`
  (migawka JSON usunietej encji, per-user, retencja 30 dni). Helper `src/lib/trash.ts/recordTrash`
  (server-side, nie „use server") wolany w `deleteNote`/`deleteTask` PRZED twardym usunieciem
  (zapisuje pola + tagi). Akcje `trash.ts`: `getTrash`/`restoreTrashItem`/`purgeTrashItem`/
  `emptyTrash` z restoratorami per-modul (odtwarzaja encje z ORYGINALNYM id; nieistniejace
  referencje projekt/grupa/parent → null; tagi re-linkowane best-effort; podzadania/komentarze
  nie sa odtwarzane). Strona `/trash` (`TrashPage`) z przyciskami Przywroc/Usun trwale/Oprozdz;
  wejscie (ikona kosza) w naglowkach Notatek i Zadan. Kolejne moduly dolaczaja przez `recordTrash`
  + nowy case w restoratorze.

> Nastepna sesja: AI pro dalej (H3 transparentnosc/undo, H4 niezawodnosc/rate-limit) lub
> Etap C marketplace (M14/M16/M17/M19) lub S6 (ceny zakupow) lub Faza 4.

---

## 0. Jak używać tego raportu

- Każda pozycja ma **ID**, **priorytet** (P0/P1/P2), **fazę** (F1–F4) i **status** (✅ zrobione · 🟡 częściowo · ❌ niezrobione).
- Każda pozycja ma sekcję **„Dlaczego"** — uzasadnienie, po co ta zmiana (wymóg właściciela dla tego raportu).
- Realizuj **pofazowo i wg zależności** (rozdz. 8). Po każdej pozycji: `npm run build` zielony → klikanie E2E gdy zmiana widoczna → commit → merge `claude/* → develop`.
- **Najpierw przeczytaj rozdz. 1 (niezmienniki repo)** — łamanie ich generuje regresje opisane w `doświadczenia.md`.
- Po zrobieniu pozycji **odhacz ją** (zmień ❌/🟡 na ✅) w nowej migracji aktualizującej ten raport (wzór: `ON CONFLICT (slug) DO UPDATE`).

### Oś czasu wymagań (skąd ten bałagan)

| Data | Migracja | Co się stało |
|---|---|---|
| 2026-05-31 | `0049_architecture_full_report` | Pełna architektura — źródło wszystkich „co poprawić" (16 modułów + wizja). |
| 2026-05-31 | `0049_..._report_v2` | Domknięto tylko **Fazę 0** (design system, helpery własności, renderer markdown, docs). |
| 2026-05-31 | `0050_omnia_handoff_prompt` | **Handoff**: kolejka ~70 pozycji (Fazy 1–4) z gotowymi promptami. |
| 2026-05-31 | `0056_services_marketplace` | **Marketplace „Usługi" v1** (rdzeń CRUD) + **Kalendarz v1**. |
| 2026-05-31 | `0058_handoff_status_update` | Oznaczono V4 (marketplace) i NM1 (kalendarz) jako zrobione. |
| 2026-06-01 | `0060_gap_analysis_v2` / `0061_..._backlog` | **Uczciwy raport luk**: 13 ✅, 7 🟡, reszta ❌; marketplace = rdzeń, brak 20 funkcji. |
| 2026-06-01 → 06-07 | `0062`–`0098` | Doszły moduły: **Magazynowanie, Warsztaty, Wiadomości, Pogoda, Skiny** + przebudowa asystenta AI na **czat konwersacyjny** (agent z pętlą narzędzi). Raporty luk tego nie obejmowały — **niniejszy raport to nadrabia**. |

### Decyzje właściciela podjęte przy tworzeniu tego raportu (2026-06-07)

1. **Marketplace ma realizować OBA modele** — Fixly (zlecenia/zapytania ofertowe/wyceny) **oraz** Booksy (kalendarz dostępności + rezerwacja slotów). To kierunek docelowy „wygrać wszystkim".
2. **Powiadomienia projektujemy pod free tier** — silnik bez zewnętrznego crona: trigger przy logowaniu + on-demand skan + web-push PWA. Bez wymogu płatnej infry na start (płatny scheduler to opcjonalne ulepszenie w F4).
3. **Faza 4 (skala/monetyzacja/branże) jest pełnoprawna** w roadmapie — nie pomijamy jej, opisana z krokami.
4. Ta sesja wyprodukowała **wyłącznie ten raport** (zero zmian w kodzie produktu) — realizacja należy do kolejnych sesji.

---

## 1. Niezmienniki repo (przeczytaj ZAWSZE przed zmianą)

1. **Własność trójpoziomowa:** prywatny `ownerId` / zespołowy `ownerTeamId` / systemowy (oba null). Używaj helperów z `src/lib/ownership.ts` (`getUserScope()`, `ownedByWhere(userId, teamIds)`, `assertOwnership(...)`) reużywających `getUserTeamIds`/`requireUserId` z `server-utils.ts`.
2. **Mutacje = Server Actions** w `src/actions/*` kończące się `revalidatePath()`. Bez ręcznego cache gdziekolwiek indziej.
3. **RBAC:** uprawnienia `module.*` w `src/lib/permissions.ts`; nowy moduł wymaga wpisu uprawnienia + seeda ról w `scripts/migrate.js` + bramki trasy w `permissions.ts`.
4. **Statusy jako `String` + unia TS** (NIGDY enum Prisma — SQLite/zasada repo). Wzór: `Item.status`, `ServiceRequest.status`.
5. **Dwa źródła nawigacji:** rejestruj moduł w `src/lib/modules.tsx` (tablica `MODULES`) — to zasila `ModuleSidebar` desktop **i** mobilny wybór w `AppShell`. Pod-nawigację (jeśli jest) dodaj w switchu `ModuleSubNav` w `ModuleSidebar.tsx`.
6. **Design system:** używaj `src/components/ui/` (`Button/IconButton/Card/Surface/Badge/EmptyState`) i tokenów CSS (`var(--bg-*)`, `--text-*`, akcenty). NIE hardcoduj kolorów ani inline-style. Na kolorowych przyciskach używaj `var(--on-accent)` zamiast `#fff` (skiny).
7. **Migracje raportów:** `INSERT ... ON CONFLICT (slug) DO UPDATE` (idempotentnie), dollar-quoting treści (`$tag$...$tag$`), Postgres-only (`gen_random_uuid()::text`, `CURRENT_TIMESTAMP`).
8. **Git:** `claude/* → develop` (auto-deploy test) automatycznie po zielonym buildzie (standing authorization w `CLAUDE.md`); `master` tylko na wyraźną prośbę.
9. **Renderer markdown** (`src/lib/markdown.ts`) wspiera `h1–h6`, tabele, listy zagnieżdżone, kod, cytaty — bez surowego HTML (escapowany). Wykorzystuj w UI raportów/przepisów/AI.
10. **Lekcje:** każdy nieoczywisty problem/naprawa → wpis do `doświadczenia.md` (commit razem z poprawką).
11. **Asystent AI jest dziś agentem konwersacyjnym** (`AICommandSheet` + `/api/llm/home/agent`, `lib/ai/agentTools.ts`). Nowe akcje/odczyty dodawaj w **agentTools** + `execute/route.ts`, nie w starym `interpret` (legacy). Read-tools pokrywają już większość modułów.

---

## 2. Stan faktyczny 2026-06-07 — co zrobione, co nie (zweryfikowane w kodzie)

> Korekta względem raportu luk z 2026-06-01: poniższe zweryfikowano ponownie w kodzie 2026-06-07.

### 2.1 Zrobione w pełni ✅ (z Fazy 0 i sesji 05-31/06-01)
- `X1` Design system — prymitywy `Button/Card/Surface/Badge/EmptyState/IconButton` (`src/components/ui/`).
- Helpery własności `src/lib/ownership.ts`.
- `R4` Renderer markdown — nagłówki `h1–h6` + listy zagnieżdżone.
- `X7` Aktualizacja `CLAUDE.md` + dokumentacja E2E.
- `A4` `/admin/architecture` zsynchronizowane z realnym stanem.
- `H6`/`HA4` Akcje asystenta AI dla Nawyków/Portfela/Kuchni/Floty (`toggle_habit`, `add_expense`, `add_income`, `plan_meal`, `add_fuel_log`) — **i dalej rozbudowane**: agent czyta i pisze do większości modułów (`lib/ai/agentTools.ts`), w tym Magazynowanie/Warsztaty/Wiadomości/Pogoda.
- `HA1` Heatmapa nawyków miesięczna/roczna · `HA5` statystyki motywacyjne nawyków.
- `L4` Statystyki nauki języków · `R1` live-preview w edytorze raportów · `K3` „co ugotować z tego co mam" · `N5` AI Q&A notatek · `S3` brak `prompt()` (modale/inline).
- **Marketplace „Usługi" v1** (rdzeń CRUD, migracja 0056) — patrz rozdz. 3.
- **NM1 Kalendarz v1** — read-only agregacja (Zadania/Posiłki/Zdrowie/Pojazdy/Leki).
- **Nowe moduły (poza pierwotnym backlogiem):** Magazynowanie (Dom/Pro), Warsztaty (Dom/Pro), Wiadomości (news+KB), Pogoda, Skiny/motywy, AI-czat konwersacyjny z historią. To realnie **domyka część wizji §18.5** (np. tryby motywu częściowo przez skiny) i znacząco rozszerza zasięg asystenta.

### 2.2 Zrobione częściowo 🟡 (do domknięcia)
- `NM1` **Kalendarz** — ✅ DOMKNIĘTE 2026-06-07 (dodano opiekę nad zwierzętami i SRS). (Hist.: agregował Zadania/Posiłki/Zdrowie/Pojazdy/**Leki**, brakowało opieki nad zwierzętami (`PetCareTask`/`PetTreatment.nextDueAt`) ani SRS języków (`Vocabulary.dueAt`). §18.5 chce „daty ze **wszystkich** modułów". Domknięcie: dorzucić te dwa źródła + spiąć `/pets/calendar`.
- `R2` **Wyszukiwarka raportów** — ✅ DOMKNIĘTE 2026-06-07: serwerowe `searchReports` (tytuł+treść, debounce).
- `S2` **„Zakończ zakupy"** — ✅ DOMKNIĘTE 2026-06-07: modal podsumowania (kupione/brakujące/pozostałe) przed archiwizacją.
- `X1/X2/X3` Design system — prymitywy są, **propagacja niepełna** (część modułów wciąż inline-style); brak pełnych stanów ładowania/błędów i onboardingu.
- `S5` Mapy sklepów — generator AI jest; brak szablonów sieci i importu.
- `W4` Auto-wydatki — ✅ DOMKNIĘTE 2026-06-10 dla **Floty** (silnik + ustawienia); Zakupy/Kuchnia czekają na ceny pozycji (S6).
- `P3` Zwierzęta — wykresy trendów są; brak **eksportu** (PDF/dla weterynarza).
- `X6` Tryby motywu — **skiny** dają jasny/ciemny i warianty, ale to nie pełny przełącznik „light/system" wg preferencji OS; do oceny czy domknięte.

### 2.3 Niezrobione ❌ — patrz pełny backlog modułowy (rozdz. 4–7).

**Bilans 2026-06-07:** rdzeń marketplace istnieje, ale do poziomu „pokonać Fixly+Booksy" brakuje **20 funkcji (5×P0)**. Z pozostałego backlogu architektury domknięto fundament i kilkanaście pozycji; **krytyczne blokery `NM3` (powiadomienia) i `NM9` (CRM) wciąż nie istnieją** i blokują dużą część reszty.

---

## 3. Marketplace „Usługi" — pełna roadmapa do pokonania Fixly + Booksy

> **Wymóg właściciela:** dział ma **wygrać wszystkim** z Fixly i Booksy; użytkownik występuje
> jednocześnie jako **klient** i **wykonawca**; UX „najlepszy na świecie". Decyzja 2026-06-07:
> realizujemy **oba modele** — tor **Fixly** (zlecenia/zapytania ofertowe/wyceny) i tor **Booksy**
> (kalendarz dostępności + rezerwacja slotów). To najobszerniejsza część programu.

### 3.1 Co już jest (rdzeń, migracja 0056)
- Modele: `ServiceCategory` (3-poziom system/user/team), `ServiceProvider` (1/user, `@unique`, `ratingAvg/ratingCount`), `ServiceListing` (`priceModel` fixed|hourly|quote, `priceAmount` w groszach, `currency`), `ServiceRequest` (status `REQUESTED|ACCEPTED|DECLINED|SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED`), `ServiceReview` (1/request, rating 1–5, tylko po COMPLETED).
- Akcje `src/actions/services.ts`: `getServiceCategories`, `getMyProviderProfile`, `upsertServiceProvider`, `createListing/updateListing/deleteListing`, `getListings/getListing/getProviderPublic`, `createServiceRequest`, `advanceRequestStatus` (strażnik przejść), `cancelMyRequest`, `getMyRequests`, `addReview` (denormalizacja ocen).
- Trasy: `/services` (katalog+szukajka+filtr kategorii), `/services/[listingId]`, `/services/provider` (panel wykonawcy), `/services/providers/[id]` (profil publiczny), `/services/requests` (klient/wykonawca).
- Komponenty `src/components/services/*` (6), typy `src/lib/services.ts`, rejestracja w `src/lib/modules.tsx`, uprawnienie `module.services` (seed ADMIN/BETA_TESTER).
- **Dwustronność ról działa** (ten sam user jest klientem i wykonawcą).

### 3.2 Dwa tory produktowe (model docelowy)

- **Tor Fixly (zlecenia/lead-gen):** klient opisuje potrzebę → wykonawcy odpowiadają **wyceną** (M3) → czat (M1) → akceptacja → realizacja → ocena. Wariant „zapytanie do wielu wykonawców" (broadcast) jako rozszerzenie.
- **Tor Booksy (rezerwacje):** wykonawca publikuje **usługi z czasem trwania** (M8) i **dostępność** (M2) → klient **rezerwuje slot** w kalendarzu → potwierdzenie/reschedule (M12) → wizyta → ocena.
- **Wspólne dla obu:** profil/portfolio (M4), powiadomienia (M6), geo+mapa (M5/M20), weryfikacja (M7), płatności/faktury (M9), filtry (M10), statystyki (M13), moderacja (M17).
- **Przełącznik typu oferty** na `ServiceListing` (`engagementType: 'request' | 'booking'`) decyduje, którym torem idzie dany wpis — jeden moduł obsługuje oba światy.

### 3.3 Braki P0 — rdzeń transakcyjny (Etap A)

#### M1 — Czat / wiadomości klient↔wykonawca (P0 · F2) ✅ [2026-06-07]
- **Dev:** model `ServiceMessage { id, requestId, senderId, body, createdAt, readAt? }` (wątek per `ServiceRequest`; rozważ wątek przed-zleceniowy per `listing+client`). Akcje `sendServiceMessage`, `getThread(requestId)`, `markThreadRead`. UI wątku w `/services/requests/[id]` (oba role). Polling lub odświeżanie przy wejściu (realtime dopiero w F3/S4).
- **UX:** dymki user/wykonawca, licznik nieprzeczytanych, ciemny/klawiaturowy.
- **AC:** obie strony wymieniają wiadomości; nieprzeczytane sygnalizowane.
- **Dlaczego:** zarówno Fixly, jak i Booksy mają czat — bez niego nie da się ustalić szczegółów zlecenia/wizyty. To rdzeń zaufania i konwersji; dziś `ServiceRequest` jest jednokierunkowy (klient wysyła opis i koniec).

#### M2 — Kalendarz dostępności + rezerwacja slotów (P0 · F2) ✅ [2026-06-07] [rdzeń Booksy]
- **Dev:** model `ServiceAvailability { providerId, weekday, startMin, endMin }` (reguły tygodniowe) + `ServiceTimeOff { providerId, date, ... }` (wyjątki). Generowanie slotów z reguł − istniejące rezerwacje (`ServiceRequest.scheduledAt` + `durationMin` z M8). Akcje `setAvailability`, `getAvailableSlots(providerId, date, listingId)`, rezerwacja przez `createServiceRequest` z wybranym slotem (status od razu `SCHEDULED`). Spięcie z modułem **Kalendarz (NM1)** — wizyty jako `CalendarEvent module:"services"`.
- **UX:** wykonawca ustawia godziny pracy; klient widzi wolne sloty i klika rezerwację; mobilnie lista slotów.
- **AC:** klient rezerwuje wolny slot; podwójna rezerwacja niemożliwa; wizyta widoczna w kalendarzu wykonawcy.
- **Dlaczego:** to **istota Booksy** (branże beauty/barber/usługi terminowe). Bez rezerwacji slotów nie „wygramy z Booksy". Wymaga M8 (czas trwania usługi) i korzysta z NM1.

#### M3 — Wyceny (P0 · F2) ✅ [2026-06-07] [rdzeń Fixly]
- **Dev:** model `ServiceQuote { id, requestId, providerId, amount, currency, message, status('SENT'|'ACCEPTED'|'REJECTED'), validUntil?, createdAt }`. Akcje `sendQuote(requestId, ...)` (wykonawca), `acceptQuote/rejectQuote` (klient → przy akceptacji `ServiceRequest` przechodzi w `ACCEPTED/SCHEDULED`). UI w wątku zlecenia.
- **UX:** wykonawca podaje cenę i opis zakresu; klient akceptuje/odrzuca; historia wycen.
- **AC:** wykonawca wysyła wycenę, klient akceptuje, zlecenie zmienia status; tylko wykonawca zleceniobiorca może wyceniać.
- **Dlaczego:** to **istota Fixly** (zlecenie → oferty cenowe → wybór). Dziś `priceModel:'quote'` to tylko flaga bez przepływu. Bez wycen marketplace zleceń jest niepełny.

#### M4 — Zdjęcia / portfolio (P0 · F2) ✅ [2026-06-07]
- **Dev:** model `ServiceImage { id, providerId?, listingId?, requestId?, url, caption?, order }` (wzorzec `RecipeImage`). Upload zgodny z istniejącą obsługą obrazów (sprawdź jak Kuchnia/Magazynowanie trzymają `photoUrl`). Galeria na ofercie i profilu publicznym; zdjęcia realizacji przy zleceniu.
- **UX:** miniatury + lightbox; wykonawca zarządza portfolio.
- **AC:** oferta/profil pokazują zdjęcia; upload działa na mobile.
- **Dlaczego:** wybór wykonawcy jest **wizualny** (portfolio remontów, fryzur, paznokci). Fixly i Booksy mocno na tym stoją; tekstowa oferta nie konkuruje.

#### M6 — Powiadomienia o zleceniu/wiadomości/wizycie (P0 · F2) ❌ [wymaga NM3]
- **Dev:** po zbudowaniu silnika **NM3** (rozdz. 6) podłącz zdarzenia: nowe zlecenie, nowa wiadomość (M1), nowa/akceptowana wycena (M3), rezerwacja/zmiana terminu (M2/M12), zmiana statusu, prośba o ocenę po COMPLETED.
- **UX:** dzwonek + deep-link do wątku/wizyty; push PWA.
- **AC:** każde zdarzenie generuje powiadomienie do właściwej strony.
- **Dlaczego:** marketplace bez powiadomień „umiera" — wykonawca nie wie o zleceniu, klient o odpowiedzi. **Krytyczna zależność od NM3.**

### 3.4 Braki P1 — zaufanie i wygoda (Etap B)

- **M8 — usługi z czasem trwania + warianty cennika (P1) 🟡** [czas trwania ✅ 2026-06-07; warianty pozostają] [konieczne dla M2]. `ServiceListing.durationMin` + model `ServiceVariant { listingId, name, durationMin, priceAmount }`. *Dlaczego:* rezerwacja slotów wymaga znajomości czasu trwania; usługi mają warianty (np. strzyżenie damskie/męskie).
- **M5/M20 — geolokalizacja + mapa + promień (P1) ✅** [2026-06-07; geo+promień, mapa-kafelki odłożona]. Dodaj `lat/lon` do `ServiceProvider`/`ServiceListing` (dziś tylko `area` tekstem); filtr „w promieniu X km", widok mapy. *Dlaczego:* usługi są lokalne — „hydraulik w pobliżu" to podstawowe zapytanie; bez geo tracimy do obu konkurentów.
- **M7 — weryfikacja wykonawcy (P1) ✅** [2026-06-07]. `ServiceProvider.verified`, NIP/dokumenty, badge zaufania. *Dlaczego:* zaufanie to waluta marketplace; zweryfikowany badge podnosi konwersję i odróżnia od anonimowych ofert.
- **M9 — płatności / depozyt / faktury (P1) ✅** [2026-06-07; faktury+spięcie z Portfelem, depozyt pozostaje]. Spięcie z **Portfelem** (wpis `WalletEntry`), opcjonalny depozyt rezerwacyjny, faktura/paragon. *Dlaczego:* domknięcie transakcji w aplikacji (a nie poza nią) buduje przewagę i przychód; integracja z Portfelem to istniejąca synergia.
- **M10 — filtry zaawansowane (P1) ✅** [2026-06-07]. Cena/ocena/lokalizacja/dostępność/typ oferty. *Dlaczego:* przy wielu ofertach katalog bez filtrów jest bezużyteczny.
- **M12 — reschedule + polityka anulowania (P1) ✅** [2026-06-07; reschedule + istniejące anulowanie]. Zmiana terminu wizyty, reguły anulowania/okno. *Dlaczego:* Booksy bez przekładania wizyt nie istnieje; redukuje no-show.
- **M18 — onboarding wykonawcy (kreator profilu) (P1) ✅** [2026-06-07; checklista kroków]. Wieloetapowy kreator: profil → kategorie → usługi → dostępność → portfolio. *Dlaczego:* dziś prosty formularz; dobry onboarding = więcej aktywnych wykonawców (podaż napędza marketplace).

### 3.5 Braki P2 — skala i monetyzacja (Etap C)
- **M11 ulubieni/obserwowani ✅** [2026-06-07] — `ServiceFavorite`. *Dlaczego:* powroty klientów, retencja.
- **M13 statystyki wykonawcy ✅** [2026-06-07; zlecenia/konwersja/przychód] — *Dlaczego:* wykonawca-profesjonalista potrzebuje panelu biznesowego (przewaga nad Fixly).
- **M14 firma z wieloma pracownikami ❌** — dziś 1 provider/user (`userId @unique`); potrzeba `ServiceProvider` zespołowy + pracownicy/zasoby z osobnymi kalendarzami. *Dlaczego:* salony/warsztaty mają wielu pracowników — to model biznesowy Booksy.
- **M15 abonamenty/pakiety ❌**, **M16 promocje/rabaty/kody ❌**, **M17 moderacja/spory ❌**, **M19 profil publiczny/SEO ❌**. *Dlaczego:* monetyzacja, akwizycja (SEO), bezpieczeństwo transakcji przy skali.

### 3.6 Etapy realizacji marketplace
- **Etap A (P0, F2):** M1 czat · M2 dostępność+rezerwacja (z M8) · M3 wyceny · M4 portfolio · M6 powiadomienia (po NM3). Po tym etapie oba tory (Fixly + Booksy) są w pełni transakcyjne.
- **Etap B (P1, F2/F3):** M8 (jeśli nie w A) · M5/M20 geo+mapa · M7 weryfikacja · M9 płatności+faktury · M10 filtry · M12 reschedule · M18 onboarding.
- **Etap C (P2, F4):** M11 ulubieni · M13 statystyki · M14 firma+pracownicy · M15 abonamenty · M16 promocje · M17 moderacja · M19 SEO.
- **Zależności krytyczne:** M6 → **NM3**; M2 → M8 + NM1; relacje klient↔wykonawca korzystają z **NM9** (CRM) gdy trzeba kontaktów spoza platformy.
- **DoD marketplace:** pełny cykl każdego toru przeklikany E2E (`e2e/specs/services.spec.ts`): Fixly (zlecenie → wycena → akceptacja → COMPLETED → ocena) i Booksy (rezerwacja slotu → wizyta → COMPLETED → ocena).

---

## 4. Backlog modułowy — istniejące moduły (Fazy 1–3)

> Każda pozycja: status · priorytet · faza · krótki Dev/UX/AC · **Dlaczego**. Realizuj wg niezmienników (rozdz. 1).

### 4.1 Home / Asystent AI
- **H1 personalizacja dashboardu** ❌ (P2·F3) — przeciąganie/ukrywanie kafelków, układ per user. *Dlaczego:* power-user chce własnego pulpitu; dziś układ stały.
- **H3 transparentność AI** ❌ (P1·F2) — historia poleceń, **undo** akcji, licznik tokenów, „który model". *Dlaczego:* zaufanie i kontrola kosztów; agent działa, ale jest „czarną skrzynką".
- **H4 niezawodność AI** ❌ (P1·F2) — graceful degradation przy braku klucza/limicie + rate-limit per user + kolejka ciężkich operacji. *Dlaczego:* przy skali i kosztach LLM brak limitów = ryzyko awarii/rachunku.
- **H5 kosz / soft-delete + potwierdzenie** ✅ (P1·F2) [2026-06-10; infra + Notatki/Zadania] — model `TrashItem` (migawka JSON), `recordTrash` w akcjach delete + restoratory per-moduł odtwarzające encję z oryginalnym id, strona `/trash` (przywróć/usuń trwale/opróżnij, auto-czyszczenie po 30 dniach). *Dlaczego:* opt-in na usuwanie jest, ale twarde usunięcie bez „kosza" jest groźne. Kolejne moduły dołączają przez `recordTrash` + restorer.
- **H7 wejście głosowe asystenta** 🟡 (P2·F3) — dyktowanie jest w `SmartTextarea`; rozważyć pełny tryb głosowy. *Dlaczego:* keyboard-first + mobile → głos to naturalne wejście.

### 4.2 Zakupy
- **S1 drag-and-drop pozycji** ❌ (P1·F1) — pole `order` + reorder. *Dlaczego:* roadmapa CLAUDE.md, częsta potrzeba.
- **S2 „Zakończ zakupy" z podsumowaniem** ✅ (P1·F1) [2026-06-07] — modal podsumowania przed archiwizacją.
- **S4 realtime sync koszyka** ❌ (P2·F3) — kanał live przy zakupach we dwoje. *Dlaczego:* unikanie dublowania przy współdzieleniu.
- **S5 mapy: szablony/import** 🟡 (P2·F2) — generator AI jest; dodać szablony sieci/import. *Dlaczego:* obniża próg wejścia map sklepów.
- **S6 ceny pozycji → Portfel** ❌ (P1·F2) — `Item.price` + auto-wydatek (zależy od W4). *Dlaczego:* synergia Zakupy↔budżet.

### 4.3 Zadania
- **T1 widok timeline/kalendarz** ✅ (P1·F1) [2026-06-07] — po NM1 włącz zadania w kalendarzu + tryb timeline w `TasksPage`. *Dlaczego:* daty bez wizualizacji są martwe.
- **T2 tablica Kanban** ✅ (P1·F1) [2026-06-07] — kolumny per status + DnD → `updateTask({status})`. *Dlaczego:* statusy TODO/IN_PROGRESS/DONE proszą się o Kanban (wzrokowcy).
- **T3 powiadomienia o terminach** ❌ (P1·F2, →NM3) — eskalacja zaległych. *Dlaczego:* terminy bez przypomnień są nieskuteczne.
- **T4 zależności blocked-by** ❌ (P2·F3). *Dlaczego:* projekty mają kolejność zadań.
- **T5 wspólny silnik NL z Home** ❌ (P2·F3) — `AITaskInput` ujednolicić z agentem. *Dlaczego:* jeden silnik parsowania = spójność.
- **T6 audyt skrótów klawiszowych** 🟡 (P1·F1) — spójność j/k/x/e/d we wszystkich modułach. *Dlaczego:* keyboard-first to filar UX.

### 4.4 Notatki
- **N1 edytor WYSIWYG/live-preview** ✅ (P2·F3) [2026-06-07; live-preview markdown w edycji]. *Dlaczego:* dłuższe notatki bez podglądu są niewygodne.
- **N2 wikilinks `[[…]]` + ważony full-text** ✅ (P2·F3) [2026-06-10]. *Dlaczego:* krok w stronę „drugiego mózgu" (Obsidian/Notion). `src/lib/wikilinks.ts` (parsowanie `[[Tytuł]]`, rozwiązywanie po tytule, backlinki); sekcja „Powiązane" w edycji notatki (linkuje-do / linkują-tu, nawigacja), ważone sortowanie wyszukiwarki (tytuł>tag>treść).
- **N3 załączniki (obrazy/pliki)** ✅ (P2·F3) [2026-06-08]. *Dlaczego:* notatki bez plików są ograniczone.
- **N4 wersjonowanie/historia** ✅ (P2·F3). *Dlaczego:* wspólna edycja zespołowa wymaga historii. `NoteRevision` + migawki w `updateNote` + sekcja „Historia" (podgląd/przywróć).

### 4.5 Kuchnia
- **K1 skalowanie porcji → zakupy** ✅ (P2·F3) [2026-06-08; już w `shopForRecipe`/`ShopForRecipeDialog` — zweryfikowane]. *Dlaczego:* spójność cook mode ↔ lista zakupów.
- **K2 wartości odżywcze/kalorie** ✅ (P2·F3) [2026-06-07]. *Dlaczego:* konkurenci (Paprika/Mealime) to mają.
- **K4 alerty przeterminowania spiżarni** ❌ (P1·F2, →NM3). *Dlaczego:* `expireItems` jest, brak proaktywnych alertów „zużyj zanim się zepsuje".
- **K5 review przed zapisem po OCR/imporcie** ✅ (P1·F1) [2026-06-10]. *Dlaczego:* jakość OCR zmienna; potrzebna korekta przed zapisem. Importy (OCR/URL/AI) zamiast od razu tworzyć przepis przekazują szkic (sessionStorage) do `RecipeEditor` w trybie rewizji (`/kitchen/recipes/new?import=1`) z banerem ostrzegawczym — zapis dopiero po akceptacji.

### 4.6 Zwierzęta
- **P1 progressive disclosure funkcji pro** ❌ (P1·F1) — chowaj husbandry/breeding wg `featureFlags`/`presetKey`. *Dlaczego:* moduł obsługuje i kota, i hodowcę gadów; pro przytłacza zwykłego usera.
- **P2 alerty parametrów terrariów** ❌ (P2·F2) — alarm „temperatura poza zakresem". *Dlaczego:* odczyty mają zakresy docelowe, brak aktywnych alarmów.
- **P3 eksport pomiarów (PDF/wet.)** 🟡 (P2·F2). *Dlaczego:* dane proszą się o eksport dla weterynarza/kupującego.
- **P4 spięcie `/pets/calendar` z NM1** ❌ (P1·F1) — patrz NM1. *Dlaczego:* jedna warstwa kalendarza zamiast osobnych.

### 4.7 Zdrowie
- **Z1 repozytorium wyników (PDF/zdjęcia)** ✅ (P2·F3) [2026-06-08]. *Dlaczego:* brak miejsca na wyniki badań.
- **Z2 trendy badań w czasie** ✅ (P2·F2) [2026-06-07; wartość liczbowa + sparkline]. *Dlaczego:* morfologia w czasie to kluczowa wartość zdrowotna.
- **Z3 leki/suplementy człowieka** ✅ (P1·F2) [2026-06-08; zweryfikowane] — moduł „Leki i pielęgnacja" (`/health/leki`, `MedicationSchedule` MEDICATION|CARE) **już istnieje**; zweryfikować pokrycie vs pierwotne wskazanie i ewentualnie domknąć. *Dlaczego:* część zrobiona po raporcie — uniknąć duplikacji.
- **Z4 przypomnienia wizyt/badań** ❌ (P1·F2, →NM3). *Dlaczego:* przypomnienia powinny być proaktywne (push).

### 4.8 Nawyki
- **HA2 cele (np. 3×/tydzień)** ✅ (P2·F2) [2026-06-07]. *Dlaczego:* nie każdy nawyk to konkretne dni.
- **HA3 synergia z Zadaniami (nawyk→zadanie)** ✅ (P2·F2) [2026-06-07]. *Dlaczego:* spójność ekosystemu.

### 4.9 Flota
- **F1 TCO + Portfel** ❌ (P1·F2, ↔W4). *Dlaczego:* realny koszt posiadania pojazdu = synergia z budżetem.
- **F2 push przegląd/OC** ❌ (P1·F2, →NM3). *Dlaczego:* przegapiony przegląd/OC = realna kara.
- **F3 załączniki (faktury, dowód rej.)** ✅ (P2·F3) [2026-06-08]. *Dlaczego:* dokumenty pojazdu w jednym miejscu.

### 4.10 Portfel
- **W1 budżety + cele** ✅ (P1·F2) [2026-06-10] — `Budget { category, limitAmount, period }` + `FinanceGoal { targetAmount, currentAmount, deadline }`; strona `/portfel/budzety` (paski postępu, wydatki bieżącego miesiąca liczone z wpisów expense per kategoria; wpłaty do celów). *Dlaczego:* bez budżetów Portfel to tylko rejestr.
- **W2 import banku (CSV/API)** ❌ (P2·F3). *Dlaczego:* ręczne wpisywanie nie skaluje się.
- **W3 raporty miesięczne** ✅ (P1·F2) [2026-06-10] — „gdzie poszły pieniądze": `/portfel/raporty` (przychód/wydatek/bilans, podział wydatków na kategorie z paskami %, porównanie vs poprzedni miesiąc, nawigacja po miesiącach). *Dlaczego:* wartość analityczna.
- **W4 auto-wydatki (Zakupy/Flota/Kuchnia)** ✅ (P1·F2) [2026-06-10; silnik + Flota; Zakupy/Kuchnia czekają na ceny pozycji S6] — generyczny silnik `bookAutoExpense`/`removeAutoExpense` (`src/lib/portfel/autoExpense.ts`, idempotentny po `WalletEntry.sourceModule/sourceId`), `FinanceSettings` (włącznik + konto docelowe, `/portfel/ustawienia`), spięty z Flotą (tankowania→„paliwo", serwisy→„serwis pojazdu"; usunięcie cofa wpis). *Dlaczego:* automatyzacja to przewaga Omnia (wydatki z realnych zdarzeń). Zakupy/Kuchnia dołączą, gdy pozycje zyskają ceny (S6).
- **W5 kursy walut** ✅ (P2·F2) [2026-06-10] — waluta sprawozdawcza (`FinanceSettings.baseCurrency`) + tabela `ExchangeRate` (per-user, ręczne kursy + best-effort import z NBP); `getWalletOverview` przelicza majątek netto i szereg czasowy na bazę, oznacza waluty bez kursu. *Dlaczego:* wielowalutowość bez kursów jest niepełna.

### 4.11 Języki
- **L1 TTS/audio** ✅ (P2·F3) [2026-06-07; Web Speech API] · **L2 typy ćwiczeń** ✅ (P2·F2) [2026-06-08; tryb pisania] · **L3 gamifikacja** ✅ (P2·F3) [2026-06-08; seria nauki] · **L5 przypomnienia powtórek** ❌ (P1·F2, →NM3). *Dlaczego:* SRS to mocny fundament; bez przypomnień powtórki giną, bez audio/ćwiczeń ustępujemy Anki/Duolingo.

### 4.12 QA
- **Q1 powiązanie scenariuszy ↔ E2E + pokrycie** ❌ (P2·F3) · **Q2 przeniesienie pod admina** ❌ (P2·F3). *Dlaczego:* dla produktu masowego QA to narzędzie wewnętrzne, nie UI usera.

### 4.13 Truck
- **TR1 dokończyć UI trasowania** ❌ (P2·F3) · **TR2 spiąć z Flotą (profil pojazdu)** ❌ (P2·F3). *Dlaczego:* klient ORS jest, UI szkieletowy; kandydat na B2B logistyka.

### 4.14 Raporty
- **R2 wyszukiwarka po treści** ✅ (P1·F2) [2026-06-07] — serwerowe searchReports (tytuł+treść).
- **R3 eksport PDF** ❌ (P2·F3). *Dlaczego:* dzielenie się raportami poza aplikacją.

### 4.15 Ustawienia / Zespoły
- **SE1 preferencje (motyw/język/data/strefa/widoki)** 🟡 (P1·F2) — skiny dają motyw; brak języka/formatów/strefy. *Dlaczego:* podstawowa personalizacja; warunek i18n.
- **SE2 bezpieczeństwo/sesje** ❌ (P2·F3) · **SE3 eksport RODO + usunięcie konta** ❌ (P1·F3) · **SE4 onboarding zespołu** ❌ (P2·F3). *Dlaczego:* RODO to wymóg prawny przy realnych użytkownikach.

### 4.16 Admin
- **A1 audyt RBAC/config (`AuditLog`)** ❌ (P1·F2). *Dlaczego:* przy zespołach zmiany uprawnień muszą być śledzone.
- **A2 szyfrowanie kluczy API + maskowanie wszędzie** ❌ (P1·F2). *Dlaczego:* dziś klucze w `Config` plaintext — ryzyko bezpieczeństwa.
- **A3 panel zdrowia systemu (`/admin/health`)** ❌ (P2·F2) — status migracji/LLM/kosztów. *Dlaczego:* operacyjna widoczność przed skalą.

### 4.17 Cross-cutting
- **X2/X3 propagacja design systemu + stany puste/ładowania/błędów + onboarding** 🟡 (P0/P1·F1). *Dlaczego:* nierówna dojrzałość modułów psuje wrażenie profesjonalizmu.
- **X4 i18n (PL/EN) + formaty** ❌ (P2·F3). *Dlaczego:* dla skali konieczna lokalizacja.
- **X5 a11y (kontrast/focus/ARIA)** ❌ (P1·F2). *Dlaczego:* dostępność + jakość keyboard-first.
- **X6 tryby motywu light/system** 🟡 (P2·F3) — skiny częściowo pokrywają. *Dlaczego:* preferencja OS/jasny tryb.

---

## 5. (zarezerwowane — patrz rozdz. 4 i 6)

---

## 6. Nowe działy (NM1–NM10)

- **NM1 Kalendarz — DOMKNIĘCIE** ✅ (P0·F1) [2026-06-07] — dorzucić opiekę nad zwierzętami (`PetCareTask`/`PetTreatment.nextDueAt`) i SRS języków (`Vocabulary.dueAt`) do `getCalendarEvents`; spiąć `/pets/calendar`. *Dlaczego:* §18.5 — „daty ze **wszystkich** modułów"; dziś brakuje dwóch źródeł.
- **NM3 Silnik powiadomień — KRYTYCZNY** ✅ (P0·F2) [2026-06-07; web-push jako rozszerzenie] — **projekt pod free tier**: model `Notification { id, userId, module, title, body, dueAt, sentAt?, readAt?, href }` + opcjonalny `PushSubscription` (VAPID w `Config`); serwis `scheduleNotification/getPending/markRead`; **bez crona** — skan nadchodzących **przy logowaniu** + **on-demand** + web-push PWA (klient już rejestruje SW). Dzwonek w `AppShell` z licznikiem. *Dlaczego:* **blokuje M6 (marketplace) oraz T3/Z4/F2/K4/L5** — najwyższy efekt dźwigniowy. Pod free tier, bo Render nie ma schedulera (płatny cron = opcjonalne ulepszenie w F4).
- **NM9 Kontakty / osobisty CRM — fundament marketplace** ✅ (P1·F2) [2026-06-07] — `/contacts`, model `Contact { name, phone?, email?, tags, notes, ownerId/ownerTeamId }`, akcje z `ownedByWhere`, nawigacja (2 źródła), `module.contacts`. *Dlaczego:* §18.6 baza pod „mali usługodawcy"; relacje klient↔wykonawca i lekki CRM dla wykonawcy.
- **NM2 Praca/Work** ❌ (P2·F4) — dziś stub. *Dlaczego:* projekty zawodowe/czas pracy/dokumenty.
- **NM4 Dokumenty/pliki** ❌ (P1·F3) — załączniki spięte z encjami (umowy, gwarancje, wyniki, faktury). *Dlaczego:* wspólna potrzeba N3/Z1/F3/M4.
- **NM5 Budżet/cele** = W1 (patrz 4.10).
- **NM6 Podróże** ❌ (P2·F4) · **NM7 Dom (subskrypcje/gwarancje/IoT)** ❌ (P2·F4) · **NM8 Dziennik/Fitness** ❌ (P2·F4). *Dlaczego:* rozszerzenia ekosystemu „dom dla całego życia".
- **NM10 API publiczne / integracje** ❌ (P2·F4) — Google Calendar, open banking, webhooks. *Dlaczego:* integracje zewnętrzne podnoszą wartość i retencję.

---

## 7. Faza 4 — skala, monetyzacja, działy branżowe (pełnoprawnie)

> Decyzja właściciela: F4 jest pełnoprawna w roadmapie. Część to decyzje infra (poza kodem), część to moduły.

### 7.1 Skala i operacje (SC)
- **SC1 płatny hosting/DB** (decyzja infra) — read-repliki, PgBouncer/connection pooling, regiony. *Dlaczego:* free tier Render + jeden Neon nie udźwigną skali.
- **SC2 AI: limity/kolejki/cache** ❌ — rate-limit per user, kolejka ciężkich operacji (OCR/plan tygodnia), cache odpowiedzi, monitoring kosztów, fallback modeli. *Dlaczego:* AI to największy koszt i ryzyko przy wzroście.
- **SC3 wydajność** ❌ — paginacja list ładujących całość, wirtualizacja, cache dashboardu. *Dlaczego:* niektóre listy ładują wszystko.
- **SC4 observability** ❌ — logi/metryki/tracing/alerty + Sentry; zasila A3. *Dlaczego:* bez wglądu nie zarządza się produkcją.
- **SC5 RODO/backup/DR** ❌ — kopie, plan odtwarzania, polityka prywatności (łączy się z SE3). *Dlaczego:* wymóg prawny i ciągłość.
- **SC6 testy jednostkowe krytycznej logiki** ❌ — SRS, recurrence, stats, routing, slot-generation marketplace. *Dlaczego:* regresje w logice biznesowej są kosztowne; moduł QA daje strukturę.
- **SC7 monetyzacja/billing (free vs pro)** ❌ — subskrypcje, bo koszty AI rosną z użyciem. *Dlaczego:* utrzymanie kosztów AI; warianty pro marketplace (M15).

### 7.2 Działy branżowe (V) — konfigurowalne nakładki (feature flags jak w Pets)
- **V1 Hodowca/Breeder** ❌ — rozwinięcie Pets (genetyka/rodowody/lęgi/sprzedaż/certyfikaty/koszty). *Dlaczego:* najbliżej gotowości; nisza pro o wysokim ARPU.
- **V2 Gastronomia** ❌ — rozwinięcie Kuchni (food cost/menu/zamówienia/alergeny). *Dlaczego:* monetyzacja kompetencji kuchni.
- **V3 Flota B2B** ❌ — Flota+Truck (wiele pojazdów/kierowcy/trasowanie/przeglądy regulacyjne). *Dlaczego:* B2B logistyka.
- **V5 Rolnictwo/ogród** ❌ — pola/grządki, cykle siewu (recurrence), pomiary, pogoda, plony. *Dlaczego:* re-użycie wzorców Pets/Health/Pogoda.
- **F4 Flota firmowa** ❌ — wariant B2B Floty (= część V3).

---

## 8. Macierz zależności (wymuszona kolejność)

- **NM3** (powiadomienia) PRZED `M6`, `T3`, `Z4`, `F2`, `K4`, `L5` — wszystko to przypomnienia.
- **NM9** (CRM) PRZED zaawansowanymi relacjami marketplace (kontakty spoza platformy, lekki CRM wykonawcy).
- **NM1** (kalendarz) PRZED `T1` (timeline) i `P4` (kalendarz opieki) oraz wspiera `M2` (rezerwacje).
- **M8** (czas trwania usługi) PRZED `M2` (rezerwacja slotów).
- **W4** (auto-wydatki) wspiera `S6`/`F1` (ceny/TCO → Portfel) i `M9` (płatności marketplace → Portfel).
- **X1** (design system, ✅) PRZED `X2/X3` (propagacja + stany puste).
- **SE1** (preferencje) wspiera `X4` (i18n).

---

## 9. Rekomendowana kolejność realizacji (dla następnego Claude)

1. **NM3** — silnik powiadomień pod free tier (odblokowuje M6 + T3/Z4/F2/K4/L5). **Najwyższy priorytet.**
2. **NM1 domknięcie** — zwierzęta + języki w kalendarzu (małe, wysokie ROI, odblokowuje T1/P4).
3. **NM9** — Kontakty/CRM (fundament relacji marketplace).
4. **Marketplace Etap A** — M8 → M2 (Booksy) + M3 (Fixly) + M1 czat + M4 portfolio + M6 (po NM3). Oba tory transakcyjne.
5. **Domknięcia 🟡 szybkie** — R2 (szukaj po treści), S2 (podsumowanie zakupów), Z3 (weryfikacja leków), X2/X3 (propagacja UI + stany puste).
6. **Zadania** — T1 timeline + T2 Kanban (po NM1) + T6 audyt skrótów.
7. **Finanse** — W1 budżety/cele, W3 raporty, W4 auto-wydatki, W5 kursy (wspiera M9, S6, F1).
8. **AI pro** — H3 transparentność/undo, H4 niezawodność/rate-limit, H5 kosz/soft-delete.
9. **Marketplace Etap B** — M5/M20 geo+mapa, M7 weryfikacja, M9 płatności+faktury, M10 filtry, M12 reschedule, M18 onboarding.
10. **Bezpieczeństwo/Admin/a11y** — A1 audyt, A2 szyfrowanie kluczy, A3 zdrowie systemu, X5 a11y, SE3 RODO.
11. **Reszta F3** — Notatki (N1–N4), Kuchnia (K1/K2/K5), Zdrowie (Z1/Z2), Flota (F3), Języki (L1–L3), Truck (TR1/TR2), Raporty (R3), i18n (X4).
12. **Faza 4** — Marketplace Etap C (M11/M13/M14/M15/M16/M17/M19), SC2/SC3/SC4/SC6/SC7, działy branżowe V1–V5, nowe działy NM2/NM4/NM6/NM7/NM8/NM10.

---

## 10. Definition of Done (każda pozycja)

1. `npm run build` zielony (kompilacja + typy; pełny build z bazą wykonuje też `scripts/migrate.js`).
2. Klikany test E2E dla zmian widocznych (`npm run test:e2e:docker` / `scripts/e2e-web.sh` w kontenerze web) — przed mergem.
3. Wpis do `doświadczenia.md` przy każdej nieoczywistej naprawie.
4. Commit opisowy + merge `claude/* → develop` po zielonym buildzie.
5. **Odhaczenie pozycji w tym raporcie** (nowa migracja `ON CONFLICT (slug) DO UPDATE`, zmiana ❌/🟡 → ✅) + ewentualny nowy raport implementacji.

---

## 11. Załącznik — mapa źródeł (slugi raportów w bazie)

- `architektura-omnia-pelna-2026-05-31` — pełna architektura (źródło „co poprawić").
- `omnia-implementacja-2026-05-31-v2` — co domknęła Faza 0.
- `omnia-handoff-prompt-2026-05-31` — pierwotna kolejka ~70 pozycji (Fazy 1–4) + niezmienniki.
- `omnia-luki-wdrozeniowe-2026-06-01` (kategoria `backlog`, „🚧 BACKLOG LUK") — inwentaryzacja 2026-06-01.
- **`omnia-master-plan-domkniecie-2026-06-07`** — TEN dokument; scala i aktualizuje wszystkie powyższe do stanu 2026-06-07. **Używaj tego jako głównego źródła.**
$omnia_master_plan$, 'backlog', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "content"=EXCLUDED."content","updatedAt"=CURRENT_TIMESTAMP;

INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-10 (AI pro: H5 kosz / soft-delete)',
  'omnia-implementacja-2026-06-10-h5-kosz',
  $omnia_impl_0148$# Omnia — Raport implementacji 2026-06-10 (AI pro: H5 kosz / soft-delete)

Dwudziesta dziewiata porcja — Faza 2, cross-cutting (Home/AI + Notatki + Zadania).

## H5 — Kosz / soft-delete + przywracanie (infra + Notatki/Zadania)
**Diagnoza:** par 4.1 — opt-in na akcje destrukcyjne byl, ale twarde `prisma.delete` bez „kosza"
jest grozne: pomylkowe usuniecie notatki/zadania bylo nieodwracalne.
**Rozwiazanie:** generyczna infrastruktura kosza zamiast `deletedAt` na kazdym modelu (zero zmian
w zapytaniach listujacych — wiersz jest realnie usuwany, a przywracanie odtwarza go z migawki):
- Model `TrashItem { userId, module, entityId, title, payload(JSON), deletedAt }` (per-user,
  retencja 30 dni, sprzatane przy zapisie i przy wejsciu na /trash — free-tier bez crona).
- Helper `src/lib/trash.ts/recordTrash` (server-side, NIE „use server" → nie eksponowany do
  klienta) wolany w `deleteNote`/`deleteTask` PRZED usunieciem (zapisuje pola skalarne + tagi).
- Akcje `src/actions/trash.ts`: `getTrash`, `restoreTrashItem` (dispatch po module do restoratora),
  `purgeTrashItem`, `emptyTrash`. Restoratory odtwarzaja encje z ORYGINALNYM id (deep-linki dzialaja);
  nieistniejace referencje (projekt/grupa/parent) → null; tagi re-linkowane tylko gdy nadal istnieja;
  podzadania/komentarze/share NIE sa odtwarzane (swiadome ograniczenie).
- UI `/trash` (`TrashPage`): lista z ikona typu, Przywroc / Usun trwale (confirm) / Oprozdz kosz.
  Wejscie (ikona kosza) w naglowkach Notatek i Zadan.
**Rozszerzalnosc:** nowy modul = wywolac `recordTrash` w jego delete + dodac case w
`restoreTrashItem`. Wzorzec gotowy dla Zakupow/Kuchni/Pets itd.
**Pliki:** `prisma/schema.prisma`, `0147_trash_soft_delete`, `src/lib/trash.ts`,
`src/actions/trash.ts`, `src/actions/notes.ts`, `src/actions/tasks.ts`, `app/trash/page.tsx`,
`components/trash/TrashPage.tsx`, `NotesPage.tsx`, `TasksPage.tsx`.

## Weryfikacja
- `next build` zielony; migracja `0147` zastosowana lokalnie.

## Podsumowanie
AI pro: zostalo H3 (transparentnosc/undo/„ktory model") i H4 (niezawodnosc/rate-limit). Dalej:
Etap C marketplace (M14/M16/M17/M19), S6 (ceny zakupow), Faza 4.$omnia_impl_0148$, 'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "content"=EXCLUDED."content","updatedAt"=CURRENT_TIMESTAMP;
