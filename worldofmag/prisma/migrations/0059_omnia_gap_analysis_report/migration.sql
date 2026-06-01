-- Raport luk wdrożeniowych względem raportu architektury (2026-06-01).
-- Idempotentny upsert po slug (DO UPDATE). Inwentaryzacja: co zrobiono, czego nie,
-- ze szczególnym naciskiem na marketplace „Usługi" jako konkurenta Fixly/Booksy.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport luk wdrożeniowych (2026-06-01)',
  'omnia-luki-wdrozeniowe-2026-06-01',
  $omnia_gap$# Omnia — Raport luk wdrożeniowych vs raport architektury (2026-06-01)

> **Cel:** uczciwa inwentaryzacja — które wskazania z raportu „Omnia — Pełna
> architektura aplikacji (stan 2026-05-31)" są **zrealizowane**, a które **NIE**.
> Stan zweryfikowany w kodzie (nie z pamięci sesji). Szczególny nacisk: marketplace
> „Usługi" jako bezpośrednia konkurencja dla **Fixly/Booksy**.

---

## 1. Co zrealizowano (zweryfikowane w repo)

**Fundament (Faza 0, wcześniejsze sesje)**
- `X1` Design system — prymitywy `Button/Card/Surface/Badge/EmptyState/IconButton` w `src/components/ui/`.
- Helpery własności (`src/lib/ownership.ts`), refaktor reprezentatywnych akcji.
- `R4` Renderer markdown — listy zagnieżdżone + nagłówki `####`/`#####`/`######`.
- Dokumentacja E2E (kiedy/jak klikać) + aktualizacja `CLAUDE.md` do realnego stanu (~15 modułów).

**Nowe działy**
- `NM1` **Kalendarz** (`/calendar`) — warstwa spinająca terminy: Zadania + Posiłki + Zdrowie + Pojazdy (read-only agregacja, siatka miesiąca, deep-linki).
- `V4` **Marketplace „Usługi"** (`/services`) — wersja **v1** (szczegóły i luki w sekcji 2).

**Ta sesja (2026-06-01)**
- `R2` Wyszukiwarka w raportach (filtr po tytule).
- `S3` Modal zamiast `prompt()` (hodowla zwierząt) — w całym repo nie ma już `prompt()`.
- `A4` `/admin/architecture` zsynchronizowane z realnym stanem (17 modułów, 12 domen DB).
- `HA1` Toggle okresu heatmapy nawyków (3m/6m/1r) + `HA5` % ukończenia (`completionRate`).
- `L4` Statystyki nauki języków (przeczone słówka, pasek postępu per talia).
- `H6`/`HA4` Akcje asystenta AI dla **Nawyków/Portfela/Kuchni/Floty** (`toggle_habit`, `add_expense`, `add_income`, `plan_meal`, `add_fuel_log`).
- `R1` Podgląd live Markdown w edytorze raportów (edytor/split/podgląd).
- `S2` „Zakończ zakupy" (archiwizacja po skompletowaniu listy).
- `K3` „Co ugotować z tego co mam?" — przycisk AI w Kuchni.

---

## 2. Marketplace „Usługi" — analiza vs Fixly/Booksy (KLUCZOWE)

Wymaganie właściciela: nowy dział ma być **bezpośrednią konkurencją dla Fixly/Booksy**,
użytkownik występuje **jednocześnie jako klient i wykonawca**, funkcjonalność ma
**wygrać wszystkim** z konkurencją, a UX ma być najlepszy na świecie.

### 2.1 Stan obecny (v1 — co DZIAŁA)
- Model: `ServiceProvider` (1/usera), `ServiceListing`, `ServiceRequest` (cykl statusów `REQUESTED→ACCEPTED→DECLINED→SCHEDULED→IN_PROGRESS→COMPLETED→CANCELLED`), `ServiceReview`, `ServiceCategory` (3-poziom: system/user/team).
- Katalog ofert: szukajka (tytuł/opis/wykonawca) + filtr kategorii, sortowanie po ocenie.
- Panel wykonawcy: profil, CRUD ofert, zarządzanie zleceniami (przejścia statusów z guardem).
- Zlecenia klienta + oceny (1–5) po zakończeniu, denormalizowana średnia.
- Dwustronność ról: ten sam user może być klientem i wykonawcą (osobne widoki).

### 2.2 Czego BRAKUJE, by „wygrać wszystkim" (zweryfikowane: NIE istnieje)

| # | Luka | Fixly | Booksy | Priorytet |
|---|------|:---:|:---:|:---:|
| M1 | **Czat / wiadomości** klient↔wykonawca (rdzeń obu serwisów) | ✓ | ✓ | P0 |
| M2 | **Kalendarz dostępności + rezerwacja slotów** (rdzeń Booksy) | — | ✓ | P0 |
| M3 | **System ofert/wycen** — wykonawca odpowiada ceną na zapytanie, klient akceptuje | ✓ | — | P0 |
| M4 | **Zdjęcia/portfolio** ofert i realizacji (galeria) | ✓ | ✓ | P0 |
| M5 | **Geolokalizacja + mapa + promień** (dziś tylko `area` jako tekst) | ✓ | ✓ | P1 |
| M6 | **Powiadomienia** o nowym zleceniu/wiadomości/przypomnieniu wizyty | ✓ | ✓ | P0 (zależy od NM3) |
| M7 | **Weryfikacja wykonawcy** (badge „zweryfikowany", NIP/dokumenty) | ✓ | ✓ | P1 |
| M8 | **Usługi z czasem trwania + warianty cennika** (do bookingu) | — | ✓ | P1 |
| M9 | **Płatności / depozyt / faktury** (integracja Portfel) | częśc. | ✓ | P1 |
| M10 | **Filtry zaawansowane** (cena, ocena, lokalizacja, dostępność, sort) | ✓ | ✓ | P1 |
| M11 | **Ulubione / obserwowani wykonawcy** | ✓ | ✓ | P2 |
| M12 | **Reschedule i anulowanie z polityką** (dziś tylko provider ustala termin) | ✓ | ✓ | P1 |
| M13 | **Statystyki wykonawcy** (przychód, konwersja, obłożenie) | ✓ | ✓ | P2 |
| M14 | **Firma z wieloma pracownikami** (dziś 1 provider/user) | częśc. | ✓ | P2 |
| M15 | **Usługi cykliczne / abonamenty / pakiety** | — | ✓ | P2 |
| M16 | **Promocje / rabaty / kody** | — | ✓ | P2 |
| M17 | **Zgłoszenia / moderacja / rozstrzyganie sporów** | ✓ | ✓ | P2 |
| M18 | **Onboarding wykonawcy** (kreator profilu krok-po-kroku) | ✓ | ✓ | P1 |
| M19 | **Publiczny profil z linkiem do udostępnienia / SEO** | ✓ | ✓ | P2 |
| M20 | **Wyszukiwanie po lokalizacji + „blisko mnie" + sortowanie geo** | ✓ | ✓ | P1 |

### 2.3 Rekomendowana roadmapa marketplace (3 etapy)

**Etap A — „rdzeń transakcyjny" (P0):** M1 czat (`ServiceMessage`, wątek per zlecenie),
M2 dostępność+rezerwacja (`ServiceAvailability` + sloty, kalendarz wykonawcy spięty z `NM1`),
M3 wyceny (`ServiceQuote` na `ServiceRequest`), M4 zdjęcia (`ServiceImage` — reużyć wzorzec `RecipeImage`),
M6 powiadomienia (wymaga **NM3** — silnik push/email).

**Etap B — „zaufanie i wygoda" (P1):** M5/M20 geo+mapa, M7 weryfikacja, M8 usługi z czasem trwania,
M9 płatności+faktury (spięcie z Portfelem), M10 filtry zaawansowane, M12 reschedule/polityki, M18 onboarding.

**Etap C — „skala i monetyzacja" (P2):** M11 ulubione, M13 statystyki, M14 firma+pracownicy,
M15 abonamenty, M16 promocje, M17 moderacja/spory, M19 profil publiczny/SEO.

**Zależność krytyczna:** M6 (powiadomienia marketplace) wymaga **NM3** (silnik powiadomień),
którego dziś NIE ma (jest tylko lokalne `showLocalNotification` na kliencie). NM3 jest też
warunkiem dla `T3/Z4/F2/K4/L5`. Dlatego NM3 powinien poprzedzić Etap A marketplace.

---

## 3. Pozostałe luki backlogu (Fazy 2–4) — NIE zrealizowane

**Home/AI:** `H3` transparentność (historia/undo/licznik tokenów/model), `H4` niezawodność
(rate-limit/kolejka/degradacja), `H5` kosz/soft-delete+potwierdzenie, `H1` personalizacja
dashboardu, `H7` wejście głosowe.

**Zakupy:** `S1` drag-and-drop pozycji, `S4` realtime sync, `S5` szablony/import map,
`S6` ceny→Portfel.

**Zadania:** `T1` timeline/kalendarz, `T2` Kanban, `T3` powiadomienia terminów (→NM3),
`T4` blocked-by, `T5` wspólny silnik NL z Home, `T6` audyt skrótów.

**Notatki:** `N1` WYSIWYG/live-preview, `N2` wikilinks+ważony FTS, `N3` załączniki, `N4` wersjonowanie.
(`N5` AI Q&A — JEST.)

**Kuchnia:** `K1` skalowanie porcji→zakupy, `K2` kalorie/wartości odżywcze, `K4` alerty
przeterminowania (push, →NM3), `K5` review przed zapisem OCR.

**Zwierzęta:** `P1` progressive disclosure, `P2` alerty parametrów, `P3` wykresy+eksport,
`P4` spięcie /pets/calendar z `NM1`.

**Zdrowie:** `Z1` repozytorium wyników (PDF/zdjęcia), `Z2` trendy badań, `Z3` leki/suplementy,
`Z4` proaktywne przypomnienia (→NM3).

**Nawyki:** `HA2` cele (3×/tydz), `HA3` synergia z Zadaniami. (`HA1/HA4/HA5` — JEST.)

**Flota:** `F1` TCO+Portfel, `F2` push przegląd/OC (→NM3), `F3` załączniki, `F4` B2B.

**Portfel:** `W1` budżety+cele, `W2` import banku, `W3` raporty miesięczne, `W4` auto-wydatki
(Zakupy/Flota/Kuchnia), `W5` kursy walut. (Jest tylko trend `monthlyRate`.)

**Języki:** `L1` TTS, `L2` typy ćwiczeń, `L3` gamifikacja, `L5` przypomnienia powtórek (→NM3).
(`L4` — JEST.)

**QA:** `Q1` powiązanie scenariuszy↔E2E + pokrycie, `Q2` przeniesienie pod admina.

**Truck:** `TR1` dokończyć UI (mapa/profil/wynik), `TR2` spiąć z Flotą.

**Raporty:** `R3` eksport PDF. (`R1/R2/R4` — JEST.)

**Ustawienia/Zespoły:** `SE1` preferencje (motyw/język/data/strefa/widoki), `SE2` bezpieczeństwo/sesje,
`SE3` eksport RODO, `SE4` onboarding zespołu.

**Admin:** `A1` audyt RBAC/config, `A2` szyfrowanie kluczy API+maskowanie wszędzie,
`A3` panel zdrowia (LLM/błędy/koszty/migracje). (`A4` — JEST.)

**Cross-cutting:** `X2` wzorce interakcji (częściowo), `X3` stany puste/ładowania/błędów
(częściowo), `X4` i18n, `X5` a11y, `X6` tryby motywu light/system.

**Nowe działy:** `NM2` Praca, `NM3` **Silnik powiadomień** (push PWA + e-mail — KRYTYCZNY,
blokuje wszystkie przypomnienia i M6), `NM4` Dokumenty/pliki, `NM5` Budżet/cele (=W1),
`NM6` Podróże, `NM7` Dom, `NM8` Dziennik/Fitness, `NM9` **Kontakty/CRM** (fundament marketplace),
`NM10` API publiczne.

**Skala:** `SC1` hosting/DB płatny, `SC2` AI limity/kolejki/cache, `SC3` wydajność
(paginacja/wirtualizacja), `SC4` observability/Sentry, `SC5` RODO/backup/DR, `SC6` testy
jednostkowe (SRS/recurrence/stats/routing), `SC7` monetyzacja.

**Branże pro:** `V1` Hodowca, `V2` Gastronomia, `V3` Flota B2B, `V5` Rolnictwo.

---

## 4. Rekomendowana kolejność dalszej realizacji

1. **NM3 — Silnik powiadomień** (odblokowuje M6 marketplace + T3/Z4/F2/K4/L5).
2. **NM9 — Kontakty/CRM** (fundament pod relacje klient↔wykonawca w marketplace).
3. **Marketplace Etap A** (M1 czat, M2 rezerwacja+dostępność, M3 wyceny, M4 zdjęcia, M6 powiadomienia).
4. **Marketplace Etap B** (geo, weryfikacja, płatności+faktury, filtry, onboarding).
5. **Finanse F2** (W1/W3/W4/W5) — wspiera płatności marketplace i auto-wydatki.
6. **AI pro** (H3/H4/H5) + **Zadania** (T1/T2) + **cross-cutting** (X3/X5).
7. **Marketplace Etap C** + branże pro + skala (SC2/SC3/SC4).

**Podsumowanie liczbowe:** z ~70 pozycji backlogu zrealizowano **~18** (fundament + Kalendarz
+ marketplace v1 + 9 pozycji tej sesji). Marketplace ma **rdzeń CRUD**, ale do poziomu
„wygrać z Fixly/Booksy" brakuje **20 funkcji** (sekcja 2.2), z czego 5 to P0 (czat, rezerwacja,
wyceny, zdjęcia, powiadomienia).
$omnia_gap$,
  'proposal',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "content" = EXCLUDED."content",
  "category" = EXCLUDED."category",
  "updatedAt" = CURRENT_TIMESTAMP;
