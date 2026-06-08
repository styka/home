-- 0111: odhaczenie M9 w master-planie (re-seed z md) + raport implementacyjny płatności.
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

> Następna sesja: M5/M20 (geo+mapa) — ostatnia duża luka Etapu B. Potem NM9 (CRM) i backlog poza marketplace.

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
- `R2` **Wyszukiwarka raportów** — filtr tylko po tytule; `getReportsMeta` nie zwraca `content`. Domknięcie: zwrócić/zindeksować treść i filtrować po niej.
- `S2` **„Zakończ zakupy"** — archiwizacja działa, brak ekranu **podsumowania** (ile pozycji/koszt).
- `X1/X2/X3` Design system — prymitywy są, **propagacja niepełna** (część modułów wciąż inline-style); brak pełnych stanów ładowania/błędów i onboardingu.
- `S5` Mapy sklepów — generator AI jest; brak szablonów sieci i importu.
- `W4` Auto-wydatki — AI `add_expense` dodaje ręcznie; brak **automatycznej** integracji Zakupy/Flota/Kuchnia → Portfel.
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
- **M5/M20 — geolokalizacja + mapa + promień (P1) ❌**. Dodaj `lat/lon` do `ServiceProvider`/`ServiceListing` (dziś tylko `area` tekstem); filtr „w promieniu X km", widok mapy. *Dlaczego:* usługi są lokalne — „hydraulik w pobliżu" to podstawowe zapytanie; bez geo tracimy do obu konkurentów.
- **M7 — weryfikacja wykonawcy (P1) ✅** [2026-06-07]. `ServiceProvider.verified`, NIP/dokumenty, badge zaufania. *Dlaczego:* zaufanie to waluta marketplace; zweryfikowany badge podnosi konwersję i odróżnia od anonimowych ofert.
- **M9 — płatności / depozyt / faktury (P1) ✅** [2026-06-07; faktury+spięcie z Portfelem, depozyt pozostaje]. Spięcie z **Portfelem** (wpis `WalletEntry`), opcjonalny depozyt rezerwacyjny, faktura/paragon. *Dlaczego:* domknięcie transakcji w aplikacji (a nie poza nią) buduje przewagę i przychód; integracja z Portfelem to istniejąca synergia.
- **M10 — filtry zaawansowane (P1) ✅** [2026-06-07]. Cena/ocena/lokalizacja/dostępność/typ oferty. *Dlaczego:* przy wielu ofertach katalog bez filtrów jest bezużyteczny.
- **M12 — reschedule + polityka anulowania (P1) ✅** [2026-06-07; reschedule + istniejące anulowanie]. Zmiana terminu wizyty, reguły anulowania/okno. *Dlaczego:* Booksy bez przekładania wizyt nie istnieje; redukuje no-show.
- **M18 — onboarding wykonawcy (kreator profilu) (P1) ✅** [2026-06-07; checklista kroków]. Wieloetapowy kreator: profil → kategorie → usługi → dostępność → portfolio. *Dlaczego:* dziś prosty formularz; dobry onboarding = więcej aktywnych wykonawców (podaż napędza marketplace).

### 3.5 Braki P2 — skala i monetyzacja (Etap C)
- **M11 ulubieni/obserwowani ❌** — `ServiceFavorite { userId, providerId }`. *Dlaczego:* powroty klientów, retencja.
- **M13 statystyki wykonawcy ❌** — przychód/konwersja/obłożenie/czas odpowiedzi (dziś tylko oceny). *Dlaczego:* wykonawca-profesjonalista potrzebuje panelu biznesowego (przewaga nad Fixly).
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
- **H5 kosz / soft-delete + potwierdzenie** ❌ (P1·F2) — `deletedAt` + przywracanie dla akcji destrukcyjnych. *Dlaczego:* opt-in na usuwanie jest, ale twarde usunięcie bez „kosza" jest groźne.
- **H7 wejście głosowe asystenta** 🟡 (P2·F3) — dyktowanie jest w `SmartTextarea`; rozważyć pełny tryb głosowy. *Dlaczego:* keyboard-first + mobile → głos to naturalne wejście.

### 4.2 Zakupy
- **S1 drag-and-drop pozycji** ❌ (P1·F1) — pole `order` + reorder. *Dlaczego:* roadmapa CLAUDE.md, częsta potrzeba.
- **S2 „Zakończ zakupy" z podsumowaniem** 🟡 (P1·F1) — dodać ekran podsumowania (liczba/koszt). *Dlaczego:* domyka cykl listy.
- **S4 realtime sync koszyka** ❌ (P2·F3) — kanał live przy zakupach we dwoje. *Dlaczego:* unikanie dublowania przy współdzieleniu.
- **S5 mapy: szablony/import** 🟡 (P2·F2) — generator AI jest; dodać szablony sieci/import. *Dlaczego:* obniża próg wejścia map sklepów.
- **S6 ceny pozycji → Portfel** ❌ (P1·F2) — `Item.price` + auto-wydatek (zależy od W4). *Dlaczego:* synergia Zakupy↔budżet.

### 4.3 Zadania
- **T1 widok timeline/kalendarz** ❌ (P1·F1) — po NM1 włącz zadania w kalendarzu + tryb timeline w `TasksPage`. *Dlaczego:* daty bez wizualizacji są martwe.
- **T2 tablica Kanban** ❌ (P1·F1) — kolumny per status + DnD → `updateTask({status})`. *Dlaczego:* statusy TODO/IN_PROGRESS/DONE proszą się o Kanban (wzrokowcy).
- **T3 powiadomienia o terminach** ❌ (P1·F2, →NM3) — eskalacja zaległych. *Dlaczego:* terminy bez przypomnień są nieskuteczne.
- **T4 zależności blocked-by** ❌ (P2·F3). *Dlaczego:* projekty mają kolejność zadań.
- **T5 wspólny silnik NL z Home** ❌ (P2·F3) — `AITaskInput` ujednolicić z agentem. *Dlaczego:* jeden silnik parsowania = spójność.
- **T6 audyt skrótów klawiszowych** 🟡 (P1·F1) — spójność j/k/x/e/d we wszystkich modułach. *Dlaczego:* keyboard-first to filar UX.

### 4.4 Notatki
- **N1 edytor WYSIWYG/live-preview** ❌ (P2·F3). *Dlaczego:* dłuższe notatki bez podglądu są niewygodne.
- **N2 wikilinks `[[…]]` + ważony full-text** ❌ (P2·F3). *Dlaczego:* krok w stronę „drugiego mózgu" (Obsidian/Notion).
- **N3 załączniki (obrazy/pliki)** ❌ (P2·F3, ↔NM4). *Dlaczego:* notatki bez plików są ograniczone.
- **N4 wersjonowanie/historia** ❌ (P2·F3). *Dlaczego:* wspólna edycja zespołowa wymaga historii.

### 4.5 Kuchnia
- **K1 skalowanie porcji → zakupy** ❌ (P2·F3). *Dlaczego:* spójność cook mode ↔ lista zakupów.
- **K2 wartości odżywcze/kalorie** ❌ (P2·F3). *Dlaczego:* konkurenci (Paprika/Mealime) to mają.
- **K4 alerty przeterminowania spiżarni** ❌ (P1·F2, →NM3). *Dlaczego:* `expireItems` jest, brak proaktywnych alertów „zużyj zanim się zepsuje".
- **K5 review przed zapisem po OCR/imporcie** ❌ (P1·F1). *Dlaczego:* jakość OCR zmienna; potrzebna korekta przed zapisem.

### 4.6 Zwierzęta
- **P1 progressive disclosure funkcji pro** ❌ (P1·F1) — chowaj husbandry/breeding wg `featureFlags`/`presetKey`. *Dlaczego:* moduł obsługuje i kota, i hodowcę gadów; pro przytłacza zwykłego usera.
- **P2 alerty parametrów terrariów** ❌ (P2·F2) — alarm „temperatura poza zakresem". *Dlaczego:* odczyty mają zakresy docelowe, brak aktywnych alarmów.
- **P3 eksport pomiarów (PDF/wet.)** 🟡 (P2·F2). *Dlaczego:* dane proszą się o eksport dla weterynarza/kupującego.
- **P4 spięcie `/pets/calendar` z NM1** ❌ (P1·F1) — patrz NM1. *Dlaczego:* jedna warstwa kalendarza zamiast osobnych.

### 4.7 Zdrowie
- **Z1 repozytorium wyników (PDF/zdjęcia)** ❌ (P2·F3, ↔NM4). *Dlaczego:* brak miejsca na wyniki badań.
- **Z2 trendy badań w czasie** ❌ (P2·F2). *Dlaczego:* morfologia w czasie to kluczowa wartość zdrowotna.
- **Z3 leki/suplementy człowieka** 🟡 (P1·F2) — moduł „Leki i pielęgnacja" (`/health/leki`, `MedicationSchedule`) **już istnieje**; zweryfikować pokrycie vs pierwotne wskazanie i ewentualnie domknąć. *Dlaczego:* część zrobiona po raporcie — uniknąć duplikacji.
- **Z4 przypomnienia wizyt/badań** ❌ (P1·F2, →NM3). *Dlaczego:* przypomnienia powinny być proaktywne (push).

### 4.8 Nawyki
- **HA2 cele (np. 3×/tydzień)** ❌ (P2·F2). *Dlaczego:* nie każdy nawyk to konkretne dni.
- **HA3 synergia z Zadaniami (nawyk→zadanie)** ❌ (P2·F2). *Dlaczego:* spójność ekosystemu.

### 4.9 Flota
- **F1 TCO + Portfel** ❌ (P1·F2, ↔W4). *Dlaczego:* realny koszt posiadania pojazdu = synergia z budżetem.
- **F2 push przegląd/OC** ❌ (P1·F2, →NM3). *Dlaczego:* przegapiony przegląd/OC = realna kara.
- **F3 załączniki (faktury, dowód rej.)** ❌ (P2·F3, ↔NM4). *Dlaczego:* dokumenty pojazdu w jednym miejscu.

### 4.10 Portfel
- **W1 budżety + cele** ❌ (P1·F2) — `Budget { category, limit, period }` + cele. *Dlaczego:* bez budżetów Portfel to tylko rejestr.
- **W2 import banku (CSV/API)** ❌ (P2·F3). *Dlaczego:* ręczne wpisywanie nie skaluje się.
- **W3 raporty miesięczne** ❌ (P1·F2) — „gdzie poszły pieniądze". *Dlaczego:* wartość analityczna.
- **W4 auto-wydatki (Zakupy/Flota/Kuchnia)** 🟡 (P1·F2) — dziś tylko ręcznie przez AI. *Dlaczego:* automatyzacja to przewaga Omnia (wydatki z realnych zakupów).
- **W5 kursy walut** ❌ (P2·F2) — przeliczenie sumarycznego majątku. *Dlaczego:* wielowalutowość bez kursów jest niepełna.

### 4.11 Języki
- **L1 TTS/audio** ❌ (P2·F3) · **L2 typy ćwiczeń** ❌ (P2·F2) · **L3 gamifikacja** ❌ (P2·F3) · **L5 przypomnienia powtórek** ❌ (P1·F2, →NM3). *Dlaczego:* SRS to mocny fundament; bez przypomnień powtórki giną, bez audio/ćwiczeń ustępujemy Anki/Duolingo.

### 4.12 QA
- **Q1 powiązanie scenariuszy ↔ E2E + pokrycie** ❌ (P2·F3) · **Q2 przeniesienie pod admina** ❌ (P2·F3). *Dlaczego:* dla produktu masowego QA to narzędzie wewnętrzne, nie UI usera.

### 4.13 Truck
- **TR1 dokończyć UI trasowania** ❌ (P2·F3) · **TR2 spiąć z Flotą (profil pojazdu)** ❌ (P2·F3). *Dlaczego:* klient ORS jest, UI szkieletowy; kandydat na B2B logistyka.

### 4.14 Raporty
- **R2 wyszukiwarka po treści** 🟡 (P1·F2) — patrz 2.2. *Dlaczego:* przy wielu raportach filtr tylko po tytule nie wystarcza.
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
- **NM9 Kontakty / osobisty CRM — fundament marketplace** ❌ (P1·F2) — `/contacts`, model `Contact { name, phone?, email?, tags, notes, ownerId/ownerTeamId }`, akcje z `ownedByWhere`, nawigacja (2 źródła), `module.contacts`. *Dlaczego:* §18.6 baza pod „mali usługodawcy"; relacje klient↔wykonawca i lekki CRM dla wykonawcy.
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
  'Omnia — Raport implementacji 2026-06-07 (Marketplace Etap B: M9 płatności)',
  'omnia-implementacja-2026-06-07-marketplace-b3',
  $omnia_impl_0607f$# Omnia — Raport implementacji 2026-06-07 (Marketplace Etap B: M9 płatności + Portfel)

Szósta porcja — domknięcie transakcji w aplikacji (synergia z Portfelem).

## M9 — Płatności + faktury + spięcie z Portfelem (✅; depozyt pozostaje)
**Diagnoza:** domknięcie transakcji w aplikacji (a nie poza nią) buduje przewagę i przychód;
Portfel już istnieje, więc integracja to naturalna synergia Omnia.
**Rozwiązanie (i dlaczego tak):** model `ServicePayment` (1/zlecenie: kwota w groszach, metoda
cash/transfer/card/other, status UNPAID/PAID, nr faktury). Wykonawca ustala kwotę
(`setServicePayment`) i oznacza opłacone (`markPaymentPaid`) z **opcjonalnym** księgowaniem
przychodu w wybranym elemencie Portfela; klient może zaksięgować swój **wydatek**
(`bookClientExpense`). Spięcie z Portfelem zrobione przez istniejące `addEntry` (waliduje
własność elementu, liczy saldo) — bez duplikowania logiki księgowania. Integracja jest
**opt-in po obu stronach** (nie wymuszamy konta w Portfelu), więc nie blokuje użycia bez Portfela.
Depozyt rezerwacyjny świadomie odłożony (mniejsza wartość, większa złożoność).
**Pliki:** `prisma/schema.prisma`, `0110_service_payment`, `src/lib/services.ts`,
`src/actions/services.ts`, `src/components/services/RequestThread.tsx` (PaymentSection).

## Weryfikacja
- `next build` zielony; migracja zaaplikowana lokalnie.

## Podsumowanie
Marketplace ma teraz pełen cykl transakcyjny z rozliczeniem: zapytanie/rezerwacja → wycena →
realizacja → **płatność (z księgowaniem w Portfelu)** → ocena. Z 20 luk domkniętych 11.
Ostatnia duża luka Etapu B: M5/M20 (geo + mapa + promień).$omnia_impl_0607f$, 'general', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "content"=EXCLUDED."content","updatedAt"=CURRENT_TIMESTAMP;
