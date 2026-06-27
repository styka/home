# Dodatek A.15 — Raport stanu projektu (zrobione / do zrobienia)

> **Migawka na 2026-06-27.** Dwie części:
> - **Część I** — co zostało już zrobione (synteza z żywego trackera A.13 „Status wdrożeń").
> - **Część II** — co zostało i jakich **akcji właściciela** wymaga.
>
> Operacyjna, **uporządkowana lista „co robić dalej i w jakiej kolejności"** (od najprostszych do
> najtrudniejszych, ze statusami do odhaczania) jest w osobnym rozdziale **A.16 — Plan realizacji
> (TRACKER ROBOCZY)**. Tamten rozdział jest od teraz **naszym głównym trackerem**; A.13 zostaje jako
> szczegółowy dziennik per `Z-NNN`.

---

## Część I — Co zostało zrobione

### Fundament bezpieczeństwa i zgodności (P0 — 22/22 ✅)
Wszystkie zalecenia P0 domknięte:
- **RODO/prywatność:** eksport danych (`exportMyData`), twarde usunięcie konta (`purgeUserData` +
  `deleteMyAccount`), mechanizm zgód (`UserConsent`, baner, strony `/legal/*`, rejestr podprocesorów),
  audyt autoryzacji Server Actions (anty-IDOR) + audyt izolacji tenantów + testy BOLA/IDOR.
- **Koszty AI:** trwały dzienny budżet per user (`AiUsage`), twarde limity per plan + cache odpowiedzi,
  pomiar ekonomiki (`/admin/metrics` — realny koszt AI/MAU).
- **Odporność:** granice błędu (`error.tsx`/`global-error.tsx`/404), `/api/health`, seam Sentry,
  anty-prompt-injection agenta + gwarantowane zwolnienie slotu AI, AI opt-in dla danych zdrowotnych.
- **Operacyjne:** brakujące indeksy własności + magazynu, keyset-paginacja, CI `verify` (typy+testy+
  strażniki+build, Postgres jako usługa) + szkielet e2e-smoke.

### Obszary przekrojowe (P1 — wybrane ✅)
- **Architektura:** rozbicie egzekutora AI (`execute/route.ts` 1467→148 linii, 15 executorów) i
  `actions/services.ts` (1400→barrel + 11 plików obszarów) — Z-010, Z-213/361 ZAKOŃCZONE.
- **Dane/Prisma:** indeksy zapytań (Z-031), **jawna polityka `onDelete` dla 10 modeli własności
  (Z-033)** + **spójność `updatedAt` (Z-036, drift 0/0)** — *ta sesja*.
- **Bezpieczeństwo:** testy renderera markdown/XSS, retencja kosza + endpoint cron, procedura sekretów
  (Z-054), minimalizacja danych wrażliwych w promptach (finanse opt-out, zdrowie opt-in).
- **Wydajność:** keyset (Z-070), eliminacja N+1 (Z-073).
- **DevOps:** CI verify (Z-091), logi strukturalne (Z-096), runbook deploy/rollback + DR (częściowo).
- **UX/a11y:** dostępny `ui/Modal` (Z-110) + **migracja 22 modali (Z-114)** + **ujednolicony EmptyState
  (Z-112/113)** + globalne granice błędu (Z-111).
- **AI/LLM:** cache deterministycznych operacji (Z-132), łańcuch fallbacku modeli (Z-133).
- **Integracje:** feed iCal z tokenem (Z-150), ujednolicona warstwa `resilientFetch` (Z-157).
- **Współdzielenie:** preset „gospodarstwo domowe" + onboarding rodziny (Z-191/192/195).
- **Testy:** ~50+ testów czystej logiki i DB-gated (izolacja, waluty, SRS, recurrence, genetyka,
  RODO-purge, slot-booking, **flota + slugify** *ta sesja*) — suite **319/319** (lokalny Postgres).

### Moduły (P1/P2 ✅ „przy okazji")
Skróty klawiszowe (Z-232), TCO floty (Z-291), import CSV Portfela (Z-300), food-cost przepisów (Z-252),
cache porad pogody (Z-330), powiadomienia o terminach (zadania/leki/flota/SRS/nawyki), autoryzacja
załączników (Z-241), okno historii czatu AI (Z-215), walidacja sekcji pulpitu (Z-218), Truck-banner
(Z-442), RODO PetSale/Contact/ServiceFavorite (Z-264/370), kontakty w RODO.

### Co zrobiono w tej sesji (2026-06-27)
1. **Z-033 + Z-036** — jawna polityka `onDelete=Cascade` dla 10 modeli własności (koniec „cichych
   sierot" pod RODO; migracja `0196`, 200/200 FK jawne) + spójność `updatedAt` (drift 0/0).
2. **Testy + fix** — `flota` (deadlineStatus/computeConsumption), `slugify` + **naprawa `ł→l`**
   (polskie „ł" nie rozkłada się w NFD → „Łódź" robiło się „odz").

> **Statystyka zbiorcza (przybliżona — źródłem prawdy są wiersze obszarowe A.13):**
> P0 **22/22** ✅ · P1 **~35** ✅ z 129 · P2 **~6** ✅ z 95.

---

## Część II — Co zostało i czego od Ciebie potrzebuję

Pozostałe ~88 P1 + ~89 P2 **nie są już „łatwe i autonomiczne"** — dzielą się na kategorie. Pełna,
uporządkowana lista zadań (z numerami `T-NN` i statusami do odhaczania) jest w **A.16**; tu skrót „dlaczego
to nie jest po prostu zrobione".

1. **Wymaga Twojej decyzji (biznes/prawo/kierunek)** — 11 pozycji przeniesionych tu z dawnego rozdziału
   „Decyzje właściciela": treść prawna (Z-053), płatności + linia free/premium (Z-473/470), 2FA (Z-058),
   field-encryption danych zdrowotnych (Z-270), reklamy (Z-474), DnD zakupów (Z-221), ESLint (Z-011/015),
   reguła zespołu przy usuwaniu konta (Z-051), pierwszy vertical (Z-490), ARPU/CAC/LTV (Z-510). **Dla
   każdej kod jest już przygotowany** — czeka tylko na Twoją decyzję/treść.

2. **Wymaga Twojego konta/klucza/konfiguracji (zewnętrzne)** — Sentry DSN + uptime-monitor + alert 5xx
   (Z-090), scope OAuth Google + weryfikacja ekranu zgody dla Gmail/Kalendarza (Z-150/151/156), włączenie
   PITR na Neon + przećwiczenie restore (Z-093), release-command na Render do pełnego odsprzężenia
   build↔migracja (Z-092). Kod/seam/runbook gotowe — brak tylko konta/klucza/przełącznika.

3. **Wymaga deployu, żebyś zweryfikował zachowanie** — rzeczy, które **zrobię w kodzie**, ale których
   „czy działa/wygląda dobrze" potwierdzisz dopiero na test-env: **weryfikacja modali/EmptyState/slugów
   po deployu** (Z-114 — ruszone, czeka na Twoje oko), cache Home (Z-072), ujednolicony „Udostępnij"
   (Z-193), wirtualizacja list (Z-071), role rodzic/dziecko (Z-194).

4. **Trudne/architektoniczne (większy nakład, ja)** — FTS notatek (Z-240, walczy z Prisma/driftem),
   kolejka Job dla ciężkiego AI (Z-131), warstwa i18n (Z-115).

5. **Strategia/biznes (do omówienia, nie kod)** — całe obszary: strategia podaplikacji (Z-490–495),
   model ilościowy (Z-512–515), marketing (Z-530–535).

> **Najmniejsza akcja o największym odblokowaniu:** gdy odnowi się limit pipeline'ów Render → zrób
> deploy `develop` i przejrzyj wizualnie modale/EmptyState/slugi (zadanie **T-01** w A.16). To zamyka
> jedyne „ruszone, ale niedokończone" zadanie czysto-kodowe.
