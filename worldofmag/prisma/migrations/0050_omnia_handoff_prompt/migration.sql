-- Raport-handoff 2026-05-31: precyzyjny prompt dla Claude Code na kolejne sesje.
-- Zawiera CAŁY backlog wyekstrahowany z raportu architektury, z analizą dla
-- developera/UX/analityka i gotowymi fragmentami poleceń. Idempotentny upsert.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Handoff / prompt dla Claude Code (2026-05-31)',
  'omnia-handoff-prompt-2026-05-31',
  $omnia_handoff$# Omnia — Handoff / prompt dla Claude Code (2026-05-31)

## Jak używać tego dokumentu
To jest **kolejka pracy i prompt** dla następnych sesji Claude Code. Realizacja całego
raportu architektury („Omnia — Pełna architektura aplikacji") to ~70 pozycji — program
wielosesyjny. Sesja 2026-05-31 domknęła **Fazę 0** (patrz raport `omnia-implementacja-2026-05-31-v2`).
Tu opisana jest **cała reszta**, pofazowo. Każda pozycja ma: **ID — nazwa (moduł · priorytet · faza)**,
**Kontekst**, **Dev** (pliki/modele/kroki), **UX**, **Analityk** (kryteria akceptacji/ryzyka)
i **Prompt** (gotowe polecenie). Bierz pozycje wg faz i priorytetów; po każdej: `npm run build`
zielony + commit + (jeśli zmiana widoczna) klikanie E2E przed mergem do `develop`.

## Niezmienniki repo (przeczytaj ZAWSZE przed zmianą)
1. **Własność trójpoziomowa:** prywatny `ownerId` / zespołowy `ownerTeamId` / systemowy (oba null).
   Używaj helperów z `src/lib/ownership.ts`: `getUserScope()`, `ownedByWhere(userId, teamIds)`,
   `assertOwnership(entity, userId, teamIds)` (reużywają `getUserTeamIds`/`requireUserId` z `server-utils.ts`).
2. **Mutacje = Server Actions** w `src/actions/*` kończące się `revalidatePath()`. Bez ręcznego cache.
3. **RBAC:** uprawnienia `module.*` w `src/lib/permissions.ts`; nowe moduły wymagają wpisu uprawnienia
   + seeda w `scripts/migrate.js` + bramki trasy.
4. **Statusy jako `String` + unia TS** (NIE enum Prisma — SQLite/zasada repo). Wzór: `Item.status`.
5. **Dwa źródła nawigacji:** każdy nowy moduł rejestruj w `src/components/shell/ModuleSidebar.tsx`
   **oraz** w mobilnym wyborze w `src/components/shell/AppShell.tsx` (lekcja z `doświadczenia.md`).
6. **Design system:** używaj `src/components/ui/` (`Button/IconButton/Card/Surface/Badge/EmptyState`)
   i tokenów CSS (`var(--bg-*)`, `--text-*`, akcenty) — NIE hardcoduj kolorów ani inline-style.
7. **Migracje raportów:** `INSERT ... ON CONFLICT (slug) DO UPDATE` (idempotentnie), dollar-quoting treści.
8. **Git:** `claude/* → develop` (auto-deploy test) automatycznie po zielonym buildzie; `master` tylko na prośbę.
9. **Klikanie:** w gołym kontenerze użyj `npm run test:e2e:docker` (Playwright w obrazie z zależnościami).
10. **Renderer markdown** wspiera teraz `h1–h6` i listy zagnieżdżone (`src/lib/markdown.ts`).

## Macierz zależności (kolejność wymuszona)
- `NM1` (Kalendarz) PRZED `T1` (timeline zadań) i `P4` (kalendarz opieki) — to warstwa spinająca.
- `NM3` (silnik powiadomień) PRZED `T3`, `Z4`, `F2`, `K4`, `L5` (wszystkie to powiadomienia).
- `NM9` (Kontakty/CRM) PRZED `V4`/Zad.4 (Marketplace bazuje na CRM).
- `X1` (design system, ZROBIONE) PRZED `X2`/`X3` (propagacja wzorców i stanów pustych).
- Portfel `W1/W3/W4/W5` spięte; `S6`/`F1` zależą od `W4` (auto-wydatki).

---

# FAZA 1 — Kalendarz + spójność (najwyższy priorytet)

## NM1 — Moduł Kalendarz (Nowy dział · P0 · F1)
**Kontekst:** §18.5 — „najwyższy priorytet, warstwa spinająca daty wszystkich modułów". Dziś
Kalendarz to stub („wkrótce"). Zadania mają `dueDate`, posiłki `MealPlan.date`, opieka `dueAt`,
zdrowie `scheduledAt`, flota `inspectionDue/insuranceDue`, języki `dueAt` (SRS) — wszystko rozproszone.
**Dev:** Nowy `src/actions/calendar.ts` agregujący zdarzenia z istniejących modeli (read-only widok,
bez nowej tabeli na start): funkcja `getCalendarEvents(range)` zbiera z `Task`, `MealPlan`,
`CareTask`/`Treatment`, `HealthEvent`, `Vehicle`, due-cards języków — mapuje na wspólny typ
`CalendarEvent { id, module, title, date, href, accent }`. Trasy `/calendar` (miesiąc) i `/calendar/[date]`.
Komponenty `src/components/calendar/*` (siatka miesiąca, lista dnia) na prymitywach UI. Odblokuj w
nawigacji (`ModuleSidebar` + `AppShell`), uprawnienie `module.calendar` (seed). Respektuj `ownedByWhere`.
**UX:** widok miesiąca (klawiatura: strzałki/`j`/`k` między dniami), kropki kolorem akcentu modułu,
klik dnia → lista zdarzeń z linkami do źródeł; pusty dzień → `EmptyState`; mobilnie lista zamiast siatki.
**Analityk:** AC: zdarzenia ze wszystkich modułów widoczne w jednym widoku; klik prowadzi do źródła;
zakres miesiąca ładuje się < 500 ms dla typowych danych. Ryzyko: wydajność agregacji → ogranicz zakres
zapytań do widocznego miesiąca, indeksy po datach już są. Zależność: blokuje `T1`, `P4`.
**Prompt:** „Claude Code, dodaj moduł Kalendarz: `src/actions/calendar.ts` z `getCalendarEvents(range)`
agregującym Task/MealPlan/opiekę/HealthEvent/przeglądy floty/SRS do typu CalendarEvent; trasy `/calendar`
i `/calendar/[date]`; komponenty siatki miesiąca i listy dnia na `src/components/ui`; rejestracja w
ModuleSidebar i AppShell; uprawnienie `module.calendar` z seedem w scripts/migrate.js; klikanie E2E."

## T1 — Widok timeline/kalendarz zadań (Zadania · P1 · F1)
**Kontekst:** §3.5 — zadania mają daty, brak wizualizacji. **Dev:** po `NM1` dodaj filtr modułu
„tasks" w kalendarzu + tryb „timeline" w `TasksPage` (grupowanie po dniach z `getAllUserTasks`).
**UX:** przełącznik lista/timeline; zaległe na czerwono. **Analityk:** AC: zadania z `dueDate` widoczne
w kalendarzu i timeline. **Prompt:** „Dodaj tryb timeline do TasksPage i włącz zadania w module Kalendarz."

## T2 — Tablica Kanban (Zadania · P1 · F1)
**Kontekst:** statusy TODO/IN_PROGRESS/DONE proszą się o Kanban. **Dev:** nowy widok w `TasksPage`
(kolumny per status), drag między kolumnami → `updateTask({status})` (HTML5 DnD, bez nowej zależności).
**UX:** kolumny przewijane, licznik w nagłówku, mobilnie zakładki statusów. **Analityk:** AC: przeciągnięcie
karty zmienia status i utrwala się; klawiatura: `x` cykluje status zaznaczonej karty. **Prompt:** „Dodaj
widok Kanban do modułu Zadania z DnD zmieniającym status przez updateTask."

## N5 — Ekspozycja AI Q&A „zapytaj swoje notatki" (Notatki · P1 · F1)
**Kontekst:** `llm.notes.qa` istnieje, brak wejścia w UI. **Dev:** przycisk/sekcja w `NotesPage` →
`/api/llm/notes` (qa) na widocznych notatkach. **UX:** pole pytania + odpowiedź z cytatami. **Analityk:**
AC: pytanie zwraca odpowiedź opartą o notatki użytkownika. **Prompt:** „Wyeksponuj notes.qa jako panel
‘Zapytaj swoje notatki’ w NotesPage."

## K3 — „Co ugotować z tego, co mam" jako główny przepływ (Kuchnia · P1 · F1)
**Kontekst:** `suggest-from-pantry` istnieje, schowane. **Dev:** kafel/CTA w `/kitchen` → wynik z
`/api/llm/kitchen/suggest-from-pantry` (czyta spiżarnię). **UX:** lista propozycji z brakującymi składnikami
→ „dodaj do zakupów". **Analityk:** AC: propozycje uwzględniają stan spiżarni. **Prompt:** „Wyeksponuj
suggest-from-pantry jako główny przepływ w Kuchni z akcją dodania braków do listy zakupów."

## K5 — Review przed zapisem po OCR/imporcie (Kuchnia · P1 · F1)
**Kontekst:** §5.5 — jakość OCR zmienna, brak korekty. **Dev:** w dialogach importu dodaj krok edycji
sparsowanego przepisu przed `createRecipe`. **UX:** formularz z polami do poprawy, podgląd. **Analityk:**
AC: użytkownik może poprawić dane przed zapisem; nic nie zapisuje się automatycznie. **Prompt:** „Dodaj
ekran weryfikacji/edycji wyniku OCR/importu przed zapisaniem przepisu."

## HA1 — Heatmapa miesięczna/roczna nawyków (Nawyki · P1 · F1)
**Kontekst:** dziś heatmapa tygodniowa. **Dev:** rozszerz `src/lib/habitStats.ts` o agregaty msc/rok;
komponent heatmapy (GitHub-style) z przełącznikiem zakresu. **UX:** kafelki intensywności, tooltip z datą.
**Analityk:** AC: widok msc i rok renderują poprawne wartości. **Prompt:** „Dodaj heatmapę miesięczną i
roczną do modułu Nawyki na bazie habitStats."

## L4 — Statystyki nauki języków (Języki · P1 · F1)
**Kontekst:** SRS jest, brak statystyk. **Dev:** funkcja agregująca review/dueCards per talia; widok w
`/languages`. **UX:** liczba do powtórki dziś, skuteczność, seria. **Analityk:** AC: statystyki zgodne z
danymi SRS. **Prompt:** „Dodaj statystyki nauki (do powtórki dziś, skuteczność, seria) w module Języki."

## P1 — Progressive disclosure funkcji pro (Zwierzęta · P1 · F1)
**Kontekst:** §6.5 — moduł obsługuje i kota, i hodowcę gadów; pro przytłacza zwykłego usera. **Dev:**
oprzyj widoczność sekcji (husbandry/breeding/genetyka) o `featureFlags`/`presetKey` zwierzęcia; domyślnie
chowaj pro. **UX:** „Tryb zaawansowany"/odkrywanie sekcji. **Analityk:** AC: profil companion nie pokazuje
sekcji hodowlanych domyślnie. **Prompt:** „Wprowadź progressive disclosure funkcji pro w module Zwierzęta
wg featureFlags/preset."

## S1 — Drag-and-drop pozycji zakupów (Zakupy · P1 · F1)
**Kontekst:** roadmapa CLAUDE.md. **Dev:** HTML5 DnD w `ItemRow`/liście → `reorder` (dodaj pole `order`
do `Item` jeśli brak, migracja). **UX:** uchwyt, zachowanie pozycji po reload. **Analityk:** AC: kolejność
utrwalona per lista. **Prompt:** „Dodaj ręczne porządkowanie pozycji zakupów (DnD + pole order + akcja reorder)."

## S2 — „Zakończ zakupy" (archiwizacja z podsumowaniem) (Zakupy · P1 · F1)
**Kontekst:** roadmapa. **Dev:** akcja `completeShopping(listId)` → podsumowanie (ile pozycji/koszt jeśli
ceny) + `archiveList`. **UX:** przycisk + ekran podsumowania. **Analityk:** AC: lista trafia do archiwum z
podsumowaniem. **Prompt:** „Dodaj akcję ‘Zakończ zakupy’ z podsumowaniem i archiwizacją listy."

## R1 — Edytor raportów z podglądem na żywo (Raporty · P1 · F1)
**Kontekst:** §14 — brak live-preview. **Dev:** w `/admin/reports/[slug]/edit` split: textarea + render
`markdownToHtml` na żywo. **UX:** dwie kolumny, mobilnie zakładki edytuj/podgląd. **Analityk:** AC: podgląd
odświeża się przy pisaniu. **Prompt:** „Dodaj live-preview markdown w edytorze raportów (reużyj markdownToHtml)."

## T6 / X2 / X3 — Audyt skrótów + propagacja design systemu + stany puste (Cross · P0/P1 · F1)
**Kontekst:** §18.2 — nierówna dojrzałość modułów. **Dev:** przepisz pozostałe komponenty z inline-style
na `src/components/ui` (zacznij od `home/*`, potem listy modułów); ujednolić skróty (`useKeyboardShortcuts`);
wpinaj `EmptyState` we wszystkie puste listy. **UX:** spójne listy/akcje/filtry/mobile. **Analityk:** AC:
brak inline-style w refaktorowanych plikach; każda lista ma stan pusty. **Prompt:** „Przepisz komponenty
home/* i listy modułów na prymitywy z src/components/ui, dodaj EmptyState wszędzie, ujednolić skróty."

---

# FAZA 2 — AI pro, powiadomienia, finanse, CRM, Marketplace

## H6 — Rozszerzenie akcji asystenta AI na moduły (Home/AI · P0 · F2) [przeniesione z F0]
**Kontekst:** §1.3 — asystent zna tylko zakupy/zadania/notatki/zwierzęta. Brak Kuchni/Portfela/Nawyków/Floty.
**Dev:** w `src/lib/llm/home-interpreter.ts` rozszerz schemat akcji (zod) o `toggle_habit`, `add_expense`,
`plan_meal`, `add_fuel_log`; w `src/app/api/llm/home/interpret/route.ts` dodaj je do promptu (z przykładami
PL); w `execute/route.ts` zmapuj na `habits.toggleHabitDay`, `portfel.addEntry`, `mealPlans.setMealPlanEntry`,
`flota.addFuelLog`; w `src/components/home/ActionDrawer.tsx` dodaj render nowych akcji (zachowaj opt-in dla
destrukcyjnych, pola `*Id` read-only). UWAGA: te pliki mają ciężkie UTF-8 — czytaj je w całości przed edycją
(np. przez obraz Docker/inną sesję) i nie psuj istniejącego kontraktu JSON.
**UX:** nowe akcje w szufladzie z możliwością edycji parametrów przed wykonaniem. **Analityk:** AC: „odhacz
trening", „dodaj wydatek 50 zł paliwo", „zaplanuj obiad na jutro", „zatankowałem 40 l" tworzą poprawne akcje.
Ryzyko: rozjazd kontraktu interpret↔execute → testy każdej akcji. **Prompt:** „Rozszerz asystenta AI o akcje
toggle_habit/add_expense/plan_meal/add_fuel_log w interpret+execute+ActionDrawer, zachowując opt-in i kontrakt."

## NM3 — Silnik powiadomień (Nowy dział · P1 · F2) [blokuje T3/Z4/F2/K4/L5]
**Kontekst:** §18.5 — push (PWA zarejestrowane) + e-mail; centralny silnik na bazie `notifications.ts`.
**Dev:** model `Notification { id, userId, module, title, body, dueAt, sentAt?, readAt?, href }`; serwis
`scheduleNotification`/`getPending`/`markRead`; web-push (klucze VAPID w Config) + opcjonalnie e-mail; cron/
hook w `scripts/migrate.js` lub endpoint wyzwalany. **UX:** dzwonek w AppShell z licznikiem, lista powiadomień,
zgoda na push. **Analityk:** AC: zaplanowane powiadomienie dochodzi i znika po przeczytaniu. Ryzyko: brak
schedulera na Render free → rozważ trigger przy logowaniu + przyszły cron. **Prompt:** „Zbuduj centralny silnik
powiadomień (model + serwis + web-push VAPID + dzwonek w AppShell), na nim oprzyj przypomnienia modułów."

## T3 / Z4 / F2 / K4 / L5 — Przypomnienia modułowe na silniku NM3 (P1 · F2)
**Kontekst:** terminy zadań (T3, eskalacja zaległych), wizyty/badania zdrowia (Z4), przegląd/OC floty (F2),
przeterminowanie spiżarni (K4), powtórki SRS (L5). **Dev:** dla każdego modułu dorzuć `scheduleNotification`
przy zapisie encji z datą + job dobowy skanujący nadchodzące. **UX:** wpis w dzwonku + deep-link. **Analityk:**
AC: każda kategoria generuje powiadomienie w właściwym czasie. **Prompt:** „Podłącz przypomnienia Zadań/Zdrowia/
Floty/Spiżarni/Języków do silnika powiadomień NM3."

## W1/W3/W4/W5 + NM5 + S6/F1 — Finanse: budżety, raporty, auto-wydatki, kursy (Portfel · P1 · F2)
**Kontekst:** §10/§18.5. **Dev:** `Budget { category, limit, period }` + cele; raport miesięczny
(agregacja `WalletEntry` po kategorii); auto-wydatki: po `completeShopping`/`addFuelLog`/planie posiłków
twórz `WalletEntry(expense)` (S6 wymaga cen pozycji — dodaj `price` do `Item`); kursy walut (tabela kursów +
przeliczenie `getWalletOverview`). **UX:** paski budżetu, wykres „gdzie poszły pieniądze". **Analityk:** AC:
przekroczenie budżetu sygnalizowane; zakup z ceną tworzy wydatek. Ryzyko: źródło kursów (cache dzienny).
**Prompt:** „Dodaj budżety+cele, raport miesięczny, auto-wydatki z Zakupów/Floty/Kuchni i kursy walut w Portfelu."

## NM9 — Kontakty / osobisty CRM (Nowy dział · P1 · F2) [fundament Zad.4]
**Kontekst:** §18.5/§18.6 — baza pod „mali usługodawcy". **Dev:** moduł `/contacts`: model `Contact
{ name, phone?, email?, tags, notes, ownerId/ownerTeamId }`, akcje CRUD z `ownedByWhere`, nawigacja (2 źródła),
`module.contacts`. **UX:** lista + szczybki dodawanie + szczegóły. **Analityk:** AC: CRUD + współwłasność
zespołowa. **Prompt:** „Dodaj moduł Kontakty/CRM (model+akcje+trasy+nawigacja+uprawnienie) wg wzorca modułu."

## V4 / Zadanie 4 — Marketplace „Usługi" (Fixly/Booksy) (Branże · P1 · F2)
**Kontekst:** Zad. 4 administratora + §18.6. Klient ↔ wykonawca; nakładka na CRM(NM9)+Zadania+Portfel+Kalendarz.
**Dev:** modele Prisma (statusy jako `String`+unia TS):
- `ServiceCategory` (3-poziom: system/user/team, jak `Category`).
- `ServiceProvider { userId/teamId, displayName, bio, area, rateInfo, visible }`.
- `ServiceListing { providerId, title, description, categoryId, priceModel('fixed'|'hourly'|'quote'), active }`.
- `ServiceRequest { clientId, providerId, listingId?, description, preferredAt?, status, scheduledAt? }`,
  status `'REQUESTED'|'ACCEPTED'|'DECLINED'|'SCHEDULED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'`.
- `ServiceReview { requestId, rating(1-5), comment }` (tylko po COMPLETED, tylko klient).
`src/actions/services.ts`: `upsertServiceProvider`, `get/CRUD listing`, `createServiceRequest` (klient),
`respondToRequest`/`advanceRequestStatus` (wykonawca), `addReview`. Trasy `/services`, `/services/[listingId]`,
`/services/providers/[id]`, `/services/requests` (zakładki klient/wykonawca), `/services/provider` (panel).
Nawigacja w `ModuleSidebar` + `AppShell`; `module.services` + seed. Migracja schematu + seed kategorii.
Spec `e2e/specs/services.spec.ts` (klient tworzy zlecenie → wykonawca akceptuje → COMPLETED → ocena).
**UX:** przeglądarka ofert z filtrem kategorii; profil wykonawcy z ocenami; przepływ zlecenia ze statusami;
ciemny, klawiaturowy, mobilny. **Analityk:** AC: pełny cykl zlecenia działa i jest przeklikalny; oceny tylko po
COMPLETED; widoczność wg ownership. Ryzyko: zakres — najpierw MVP (bez płatności/czatu/geo), potem rozszerzenia.
**Prompt:** „Zbuduj moduł Usługi (marketplace): modele ServiceCategory/Provider/Listing/Request/Review + migracja,
src/actions/services.ts, trasy /services*, nawigacja w 2 źródłach, module.services, statusy zlecenia jako String+unia,
oraz e2e/specs/services.spec.ts; przeklikaj przez npm run test:e2e:docker."

## H3/H4/H5 — AI: transparentność, niezawodność, kosz/undo (Home/AI · P1 · F2)
**Kontekst:** §1.3. **Dev:** H3: log historii poleceń + który model + licznik tokenów (z odpowiedzi LLM);
H4: graceful degradation gdy brak klucza/limit (komunikat zamiast błędu) + prosty rate-limit per user; H5:
soft-delete (`deletedAt`) + „kosz" z przywracaniem dla akcji destrukcyjnych. **UX:** panel historii, toasty
zamiast błędów, undo. **Analityk:** AC: brak klucza nie wywala UI; usunięte da się przywrócić. **Prompt:** „Dodaj
historię+undo+licznik tokenów do asystenta, graceful degradation i rate-limit, oraz soft-delete z koszem."

## A1/A2/A3 + SC2/SC3/SC4 — Admin/skala: audyt, sekrety, zdrowie, wydajność, observability (P1 · F2)
**Kontekst:** §16.6/§18.3. **Dev:** A1 `AuditLog` dla zmian RBAC/Config; A2 szyfrowanie kluczy API at-rest +
maskowanie wszędzie; A3 `/admin/health` (status migracji/LLM/koszty); SC2 limity/kolejki/cache LLM; SC3
paginacja list ładujących całość + cache dashboardu; SC4 Sentry + logi. **UX:** panele admina. **Analityk:** AC:
zmiana RBAC zapisuje audyt; klucze nigdy w plaintext w UI. **Prompt:** „Dodaj AuditLog, szyfrowanie kluczy API,
panel /admin/health, rate-limit/cache LLM, paginację list i integrację Sentry."

## Pozostałe F2 (kompakt)
- **R2 — wyszukiwarka raportów (Raporty·P0):** filtr po title+content w `/reports` i `/admin/reports`. Prompt:
  „Dodaj pole wyszukiwania filtrujące raporty po tytule i treści." (przeniesione z F0).
- **A4 — `/admin/architecture` z realną mapą (Admin·P0):** zasil stronę treścią z raportu architektury +
  linki do tras. Prompt: „Przepisz /admin/architecture na aktualną mapę modułów/tras/modeli." (przeniesione z F0).
- **S3 — modal tworzenia listy zamiast `prompt()` (Zakupy·P0):** w `src/components/shopping/ShoppingListsPage.tsx`
  (2× `window.prompt`) zastąp modalem z `Surface`+`Button`. Prompt: „Zamień window.prompt na modal tworzenia listy."
- **S5 — mapy sklepów: szablony/generator/import:** wyeksponuj `/api/llm/stores/generate`.
- **P2 — alerty parametrów terrariów; P3 — wykresy+eksport pomiarów (Zwierzęta).**
- **Z2 — trendy badań (Zdrowie); HA2 — cele nawyków; HA3 — nawyk→zadanie; L2 — typy ćwiczeń; Q2 — QA pod admina;
  SE1 — preferencje (motyw/język/data/strefa); SE4 — onboarding zespołu; R3 — eksport PDF raportu; X5 — a11y.**
  Dla każdej: realizuj wg niezmienników repo; prompt = „Zrealizuj <ID> z raportu architektury wg sekcji <moduł>."

---

# FAZA 3 — treść, edytory, prawo
- **N1** edytor notatek WYSIWYG/live-preview · **N2** wikilinks `[[…]]` + ważony full-text · **N3** załączniki ·
  **N4** wersjonowanie/historia notatek.
- **NM4** moduł Dokumenty/pliki (załączniki spięte z encjami) · **Z1** repozytorium wyników (PDF) · **Z3** leki/
  suplementy człowieka (re-użyj wzorców z Pets) · **F3** załączniki floty · **K2** wartości odżywcze/kalorie.
- **H1** personalizacja dashboardu · **H7** wejście głosowe · **S4** realtime sync koszyka · **L1** TTS · **L3**
  gamifikacja · **X4** i18n PL/EN + formaty · **X6** tryby motywu light/system.
- **SE2** bezpieczeństwo/sesje · **SE3** eksport danych RODO + usunięcie konta · **SC5** RODO/backup/DR · **W2**
  import banku (CSV/API) · **T4** zależności blocked-by · **TR1** dokończ UI Trucka · **TR2** spięcie Truck↔Flota.
Każda: prompt = „Zrealizuj <ID> wg raportu architektury, zachowując niezmienniki repo i dodając klikany test."

---

# FAZA 4 — skala, monetyzacja, działy branżowe
- **SC1** płatny hosting/DB (repliki, PgBouncer) — decyzja infra, poza kodem · **SC7** monetyzacja (billing free/pro).
- **NM2** Praca/Work · **NM6** Podróże · **NM7** Dom (subskrypcje/gwarancje/IoT) · **NM8** Dziennik/Fitness ·
  **NM10** API publiczne/integracje (Google Calendar, open banking, webhooks).
- **V1** Hodowca/Breeder (rozwinięcie Pets) · **V2** Gastronomia (food cost/menu/alergeny) · **V3** Flota B2B
  (Flota+Truck) · **V5** Rolnictwo/ogród · **F4** Flota firmowa.
Zasada §18.6: działy branżowe jako **konfigurowalne nakładki na istniejące moduły** (feature flags jak w Pets).

---

## Definition of Done (każda pozycja)
1. `npm run build` zielony (lokalnie kompilacja+typy; pełny build z bazą na Render).
2. Klikany test E2E dla zmian widocznych (`npm run test:e2e:docker` w kontenerze) — przed mergem.
3. Wpis do `doświadczenia.md` przy każdej nieoczywistej naprawie.
4. Commit opisowy + merge `claude/* → develop`.
5. Aktualizacja tego handoffu (odhacz ID jako zrobione) i ewentualny nowy raport implementacji.
$omnia_handoff$,
  'general',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE
  SET "title" = EXCLUDED."title",
      "content" = EXCLUDED."content",
      "category" = EXCLUDED."category",
      "updatedAt" = NOW();
