# Omnia — Raport sesji 2026-06-13: co NIE zostało zrobione (odłożone)

> **Dla kolejnej sesji Claude Code.** To kompletny, uczciwy spis pozycji **niezrealizowanych (❌)**
> i **częściowych (🟡)** na koniec sesji 2026-06-13, z opisem „o co chodziło" i dlaczego odłożono.
> Towarzyszy raportowi „co zrobione" (slug `omnia-sesja-2026-06-13-zrobione`). Pełne statusy
> wszystkich pozycji: **`omnia-master-plan-domkniecie-2026-06-07`** (kategoria `backlog`).
> Legenda: **❌** niezrobione · **🟡** częściowe. Priorytety P0/P1/P2, fazy F1–F4.

## 0. Dlaczego te rzeczy zostały — trzy kategorie blokad
1. **Wymagają sieci** (sandbox blokuje większość wyjść — „Host not in allowlist"): integracje
   bankowe, kursy online, Sentry, Google Calendar, web-push na żywo. Działają dopiero na prodzie
   (Render ma otwartą sieć) — trudne do zweryfikowania w sesji.
2. **Decyzje infra/biznesowe poza kodem**: płatny hosting, monetyzacja, RODO/backup — wymagają
   decyzji właściciela (właściciel: „na razie BEZ podziału płatne/bezpłatne — wszystko dostępne").
3. **Duże nakładki/refaktory**: działy branżowe (V1–V5), i18n, propagacja design-systemu — wieloetapowe.

> **Zasada na przyszłość:** najpierw bierz pozycje, które są w pełni wykonalne i weryfikowalne w
> sandboxie (logika + UI bez sieci). Pozycje „wymagają sieci" implementuj z **graceful degradation**
> (działa na prodzie, w sandboxie czytelny błąd), tak jak zrobiono W5 (NBP) i Wiadomości (Brave/DDG).

---

## 1. Marketplace „Usługi" — reszta
- **M6 powiadomienia marketplace** 🟡 (P0·F2). Jest: wykonawca dostaje powiadomienie o nowym
  zleceniu, klient o zmianie statusu (przez NM3). **Brakuje:** powiadomień dla wszystkich zdarzeń
  (nowa wiadomość czatu M1, nowa/akceptowana wycena M3, rezerwacja/reschedule, prośba o ocenę po
  COMPLETED). *Plan:* dołożyć `notifyUser` w `sendServiceMessage`, `sendQuote`/`respondToQuote`,
  `bookSlot`/`rescheduleRequest`, przy przejściu do COMPLETED.
- **M8 warianty cennika** 🟡 (P1). Jest `ServiceListing.durationMin`. **Brakuje** modelu
  `ServiceVariant { listingId, name, durationMin, priceAmount }` (np. „strzyżenie damskie/męskie")
  — różne czasy/ceny w jednej ofercie; rezerwacja powinna wybierać wariant.
- **M15 abonamenty/pakiety** ❌ (P2·F4) — **monetyzacja, świadomie odłożona** (właściciel: bez
  płatne/bezpłatne na raze). Pakiety usług (np. „10 wizyt"), subskrypcje.
- **Mapa-kafelki** (część M5/M20) ❌ — interaktywna mapa wymaga biblioteki/tile-serwera (sieć).
  Dziś: geo + filtr w promieniu + dystans (bez mapy).
- **Tryb „dowolny pracownik"** (rozszerzenie M14) ❌ — auto-przypisanie pierwszego wolnego pracownika
  (union slotów wielu osób). Dziś klient wybiera konkretną osobę. *Plan:* w `computeSlots` policzyć
  sumę wolnych slotów aktywnych pracowników; w `bookSlot` z `staffId=null` przy salonie wybrać
  pierwszego wolnego na dany slot.

## 2. Przypomnienia zależne od NM3 (silnik jest — brakuje podpięć)
Silnik powiadomień `NM3` istnieje (`syncReminders` + `notifyUser` + dzwonek). Te pozycje to
DOPIĘCIE konkretnych źródeł — wszystkie wykonalne w sandboxie:
- **T3 powiadomienia o terminach zadań** ❌ (P1) — eskalacja zaległych/nadchodzących (`Task.dueDate`).
- **Z4 przypomnienia wizyt/badań** ❌ (P1) — `HealthEvent.scheduledAt`/`reminderAt`.
- **F2 push przegląd/OC** ❌ (P1) — terminy przeglądu/OC pojazdu (Flota).
- **K4 alerty przeterminowania spiżarni** ❌ (P1) — `PantryItem` zbliżające się daty ważności.
- **L5 przypomnienia powtórek SRS** ❌ (P1) — `Vocabulary.dueAt` (zaległe powtórki).
> *Uwaga:* część z tych źródeł `syncReminders` MOŻE już skanować (sprawdź `src/actions/notifications.ts`
> — przy NM3 dodano Zadania/Zdrowie/Flotę/Zwierzęta/Spiżarnię/SRS/Usługi). Zweryfikuj, co realnie
> jest skanowane, i dołóż brakujące źródła + ewentualne preferencje per-typ.

## 3. Zakupy / Zadania / Kuchnia — reszta
- **S1 drag-and-drop pozycji** ❌ (P1·F1) — pole `Item.order` + reorder (HTML5 DnD jak Kanban T2).
- **S4 realtime sync koszyka** ❌ (P2·F3) — kanał live przy współdzielonych zakupach (świadomie
  odrzucony realtime na free tier; ewentualnie polling jak `DataFreshness`).
- **S5 mapy sklepów: szablony/import** 🟡 (P2) — generator AI jest; dodać szablony sieci handlowych.
- **T4 zależności blocked-by** ❌ (P2·F3) — kolejność zadań w projekcie (graf zależności).
- **T5 wspólny silnik NL z Home** ❌ (P2·F3) — ujednolicić `AITaskInput` z agentem (jeden parser).
- **T6 audyt skrótów klawiszowych** 🟡 (P1) — spójność j/k/x/e/d we wszystkich modułach.

## 4. Finanse / Flota — reszta
- **W2 import banku (CSV/API)** ❌ (P2·F3) — CSV wykonalny offline (parser + mapowanie kolumn →
  `WalletEntry`); API banków wymaga sieci/open bankingu.
- **F1 TCO + Portfel** ❌ (P1·F2) — całkowity koszt posiadania pojazdu (paliwo+serwis+ubezpieczenia)
  i synergia z budżetem. Silnik auto-wydatków W4 już księguje paliwo/serwis — TCO to agregacja+widok.

## 5. Raporty / Truck / QA
- **R3 eksport PDF raportów** ❌ (P2·F3) — wzorzec gotowy: print-to-PDF jak P3 (`buildVetCardHtml`).
- **TR1 dokończyć UI trasowania** ❌ (P2·F3) — klient ORS gotowy (`lib/ors.ts`), UI szkieletowy.
- **TR2 spiąć Truck z Flotą** ❌ (P2·F3) — profil pojazdu z Floty do trasowania.
- **Q1/Q2 QA** ❌ (P2·F3) — powiązanie scenariuszy ↔ E2E, przeniesienie QA pod admina.

## 6. Ustawienia / Bezpieczeństwo użytkownika
- **SE1 preferencje (język/format daty/strefa/widoki)** 🟡 (P1) — skiny dają motyw; brak języka/
  formatów/strefy (warunek i18n X4).
- **SE2 bezpieczeństwo/sesje** ❌ (P2·F3) — zarządzanie sesjami/urządzeniami.
- **SE3 eksport RODO + usunięcie konta** ❌ (P1·F3) — **wymóg prawny**; eksport danych usera (ZIP/JSON)
  + twarde usunięcie konta. Wykonalne offline (agregacja danych usera + kaskady).
- **SE4 onboarding zespołu** ❌ (P2·F3).

## 7. Cross-cutting (X)
- **X2 propagacja design-systemu + stany puste/błędów** 🟡 (P0/P1·F1) — stany ŁADOWANIA zrobione
  (`LoadingState` + `loading.tsx` w 21 działach). **Brakuje:** eliminacji inline-style w modułach
  (użycie `Button/Card/Surface/Badge` wszędzie), spójnych stanów BŁĘDÓW (route-level `error.tsx`),
  i pełnego pokrycia `EmptyState`. To duży, rozproszony, ale niskoryzykowny refaktor.
- **X4 i18n (PL/EN) + formaty** ❌ (P2·F3) — lokalizacja; warunek skali. Duży.
- **X5 a11y (kontrast/focus/ARIA)** ❌ (P1·F2) — dostępność; wykonalne i wartościowe w sandboxie
  (audyt + poprawki kontrastu/focus-visible/aria-label/role). **Dobry kandydat na następną sesję.**
- **X6 tryby motywu light/system** 🟡 (P2) — skiny częściowo pokrywają; brak przełącznika wg OS.
- **H7 pełny tryb głosowy asystenta** 🟡 (P2) — dyktowanie jest w `SmartTextarea`.

## 8. Nowe działy (NM)
- **NM2 Praca/Work** ❌ (P2·F4) — dziś stub; projekty zawodowe/czas pracy/dokumenty.
- **NM4 Dokumenty/pliki** ❌ (P1·F3) — wspólna warstwa załączników spiętych z encjami (umowy,
  gwarancje, wyniki, faktury). Konsoliduje N3/Z1/F3/M4. Wykonalne offline (data-URL/Blob jak dotąd).
- **NM6 Podróże · NM7 Dom (subskrypcje/gwarancje/IoT) · NM8 Dziennik/Fitness** ❌ (P2·F4) — nowe moduły.
- **NM10 API publiczne / integracje** ❌ (P2·F4) — Google Calendar, open banking, webhooks (sieć).

## 9. Faza 4 — skala, monetyzacja, branże
### 9.1 Skala/operacje (SC)
- **SC1 płatny hosting/DB** ❌ — decyzja infra (read-repliki, pooling). Poza kodem.
- **SC2 AI: limity/kolejki/cache** ❌ — **częściowo zrobione w H4** (rate-limit + strażnik
  współbieżności in-memory). **Brakuje:** trwałej kolejki ciężkich operacji (OCR/plan-tygodnia),
  cache odpowiedzi, monitoringu kosztów, fallbacku modeli. Trwały limiter/kolejka = Redis/DB (infra).
- **SC3 wydajność** ❌ — paginacja list ładujących całość, wirtualizacja, cache dashboardu.
  Wykonalne offline (paginacja zapytań + UI „załaduj więcej").
- **SC4 observability** ❌ — logi/metryki/tracing/alerty + Sentry (sieć). A3 (zdrowie systemu) to
  początek widoczności.
- **SC5 RODO/backup/DR** ❌ — łączy się z SE3; backupy/DR to infra.
- **SC6 testy jednostkowe** 🟡 — **42 testy zrobione** (srs/recurrence/serviceSlots/wikilinks/
  parseQuantity/petEnvironment/serviceGeo). **Dalej:** stats wykonawcy (`getProviderStats`),
  `medicationSchedule.ts`, więcej slot-generation/granicznych przypadków. **Łatwa kontynuacja:
  `npm run test:unit`.** Uwaga: `currency.ts/toBase` value-importuje prisma → alias „@/"
  nierozwiązywalny w tsx bez dodatkowej konfiguracji (albo skonfiguruj tsx paths, albo wydziel
  czystą funkcję bez importu prisma).
- **SC7 monetyzacja/billing (free vs pro)** ❌ — **świadomie odłożone** (decyzja właściciela: brak
  podziału płatne/bezpłatne na razie).

### 9.2 Działy branżowe (V) — konfigurowalne nakładki (wzorzec feature-flags jak w Pets)
- **V1 Hodowca/Breeder** ❌ — rozwinięcie Pets (genetyka/rodowody/lęgi/sprzedaż/certyfikaty/koszty).
  **Najbliżej gotowości** (Pets ma już presety/featureFlags, breeding, genetykę) — dobry kandydat na
  pierwszą branżę. Nisza pro o wysokim ARPU.
- **V2 Gastronomia** ❌ — rozwinięcie Kuchni (food cost/menu/zamówienia/alergeny).
- **V3 Flota B2B** ❌ — Flota+Truck (wiele pojazdów/kierowcy/trasowanie/przeglądy regulacyjne).
- **V5 Rolnictwo/ogród** ❌ — pola/grządki, cykle siewu (recurrence), pomiary, pogoda, plony.
- **F4 Flota firmowa** ❌ — wariant B2B Floty (= część V3).

## 10. Rekomendowana kolejność dla następnej sesji (z perspektywy wykonalności w sandboxie)
1. **Przypomnienia NM3** (rozdz. 2: T3/Z4/F2/K4/L5) — szybkie, wysokie ROI, w pełni testowalne;
   najpierw zweryfikuj, co `syncReminders` już skanuje.
2. **M6 pełne** (dopięcie powiadomień marketplace do wszystkich zdarzeń).
3. **X5 a11y** — szeroko odczuwalna jakość, bez sieci.
4. **SE3 (RODO eksport/usunięcie konta)** — wymóg prawny, wykonalne offline.
5. **NM4 Dokumenty** — konsoliduje istniejące załączniki; offline.
6. **SC6 c.d.** + **SC3 paginacja** — twarda jakość/wydajność.
7. **V1 Hodowca** — pierwsza branża (Pets jest najbliżej), gdy będzie apetyt na duży feature.
8. Pozycje „wymagają sieci/infra/monetyzacja" (SC1/SC4/SC5/SC7, M15, NM10, W2-API, X4) — dopiero gdy
   właściciel zdecyduje i/lub na prodzie.

> **Niezmienniki i środowisko buildu/testów** — patrz raport „co zrobione" (rozdz. 1–2). Trzymaj
> się ich. Po każdej pozycji: `npm run build` zielony → commit → merge `claude/* → develop` →
> migracja seedująca raport + odhaczenie w master-planie.
