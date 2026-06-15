# Rozdział 13 — Integracje zewnętrzne

## Kontekst / stan z kodu

- **Google Drive** (`src/lib/drive/{client,oauth}.ts`, `actions/drive.ts`, API `/api/drive/*`):
  per-użytkownik OAuth (scope `drive.file`), folder „Omnia” + podfoldery modułów, rejestr `DriveFile`.
  Raporty mogą trzymać treść na Drive (`Report.storage = db|drive`).
- **Pogoda:** `src/lib/weather/openMeteo.ts` (Open-Meteo, bez klucza).
- **Wiadomości / web-search:** `src/lib/news/{rss,webSearch,article,sources}.ts` (RSS + Brave→DDG).
- **Trasowanie:** `src/lib/ors.ts` (OpenRouteService — Truck), `src/lib/overpass.ts` (OSM POI),
  `src/lib/googleMaps.ts` (geokodowanie/places).
- **Logowanie:** Google OAuth (NextAuth) — czyli **konto Google użytkownika już jest podłączone**.
- **Czego brak (kluczowe):** **Gmail**, **Google Calendar** (dwukierunkowo), **web-push na żywo**,
  **webhooks**, **publiczne API / feed iCal**, **import banku** (open banking / CSV).
- **Zasada projektu:** „graceful degradation” — integracje sieciowe działają na produkcji (Render ma
  otwartą sieć), a w sandboxie zwracają czytelny błąd (sieć blokowana).

## Głos Zespołu A — Strażnicy

**dr inż. Tomasz (architekt):** „Każda integracja to **nowy punkt awarii i zależność od cudzego API**
(limity, zmiany, koszty, OAuth). Róbmy je za **abstrakcją** (jak `ors.ts`/`drive`), z timeoutami,
retry i degradacją — nigdy »na sztywno«. I uwaga na **zakresy OAuth**: Gmail/Calendar to wrażliwe
scope’y, wymagają **weryfikacji aplikacji przez Google** (CASA, ekran zgody) — to tygodnie procesu, nie
wieczór kodu.”

**Anna (security):** „Gmail/Calendar = dostęp do bardzo wrażliwych danych. Tokeny trzymamy szyfrowane
(jak Drive), minimalny scope (`calendar.events`, nie pełny `gmail`), jasna zgoda i możliwość odpięcia.
Webhooks/publiczne API to z kolei **powierzchnia ataku** — uwierzytelnianie, rate-limit, podpisy.”

**Grzegorz (delivery):** „Priorytetyzujmy po **wartości × koszcie wdrożenia**. Calendar dwukierunkowo
to ogromna wartość, ale i duży koszt (weryfikacja Google, sync, konflikty). iCal (jednokierunkowy feed)
daje 70% wartości za 10% kosztu — i bez weryfikacji.”

## Głos Zespołu B — Pionierzy

**Damian (senior dev):** „Mamy już konto Google zalogowanego usera — **Calendar i Gmail są na wyciągnięcie
ręki** i to jest dokładnie to, czego chce Marek i połowa rynku. Zacznijmy od **eksportu iCal** (trywialne,
bez weryfikacji) i **odczytu Google Calendar do naszej agendy**, potem zapis dwukierunkowy.”

**Sandra (architekt):** „Open banking jest drogi i regulowany — ale **import CSV z banku** robimy
offline, dziś, bez nikogo. To 80% wartości »widzę wydatki w Portfelu« za ułamek kosztu.”

**Nina (growth):** „Integracje to **argument marketingowy i retencyjny**: »spina się z Twoim
kalendarzem i mailem«. Plus **webhooks/API** otwierają ekosystem (Zapier/Make) — to dźwignia wzrostu
B2B i deweloperskiego.”

## Punkty sporne

- **Google Calendar: dwukierunkowo od razu vs etapami.** **Konsensus:** etapami — (1) eksport iCal
  (feed), (2) odczyt do agendy, (3) zapis dwukierunkowy z rozwiązywaniem konfliktów. Pierwsze dwa szybko,
  trzecie po weryfikacji Google.
- **Gmail: zakres.** **Konsensus:** tylko jeśli jest konkretny przypadek użycia (np. zamiana maila w
  zadanie/notatkę) i **minimalny scope**; nie „bo można”.
- **Publiczne API: teraz vs później.** **Konsensus:** po fundamencie (auth/rate-limit); najpierw iCal i
  webhooks wychodzące dla kluczowych zdarzeń.

## Głos użytkowników

**Marek (29):** „To jest mój numer jeden: **dwukierunkowy Google Calendar** i zamiana maila w zadanie.
Bez tego trzymam terminy gdzie indziej.” → integracja kalendarza to dla early adoptera warunek
„zamieszkania” w aplikacji.

**Agnieszka (38):** „Chcę, żeby terminy rodziny były w jednym kalendarzu, który widzę też w telefonie.”
→ iCal/Calendar to spójność rodzinnej agendy (łączy się z Rozdz. 15).

## Konsensus i zalecenia

- **Z-150** *(P1 · S)* — **Eksport agendy jako feed iCal** (`.ics`) — szybkie, bez weryfikacji Google,
  duża wartość (kalendarz w telefonie/Google/Apple). Pierwszy krok integracji kalendarza.
- **Z-151** *(P1 · M)* — **Odczyt Google Calendar do zunifikowanej agendy** (scope `calendar.readonly`)
  — wydarzenia Google obok zadań/posiłków/leków w `/calendar`.
- **Z-152** *(P2 · L)* — **Zapis dwukierunkowy Google Calendar** (scope `calendar.events`) z obsługą
  konfliktów — po weryfikacji aplikacji przez Google.
- **Z-153** *(P1 · M)* — **Import wyciągów bankowych z CSV** (parser + mapowanie kolumn → `WalletEntry`)
  — offline, bez open bankingu; duża wartość dla Portfela.
- **Z-154** *(P2 · M)* — **Webhooks wychodzące** dla kluczowych zdarzeń (nowe zlecenie, płatność,
  przypomnienie) + integracja z Zapier/Make — dźwignia ekosystemu i B2B.
- **Z-155** *(P2 · L)* — **Publiczne API (REST) z kluczami, rate-limitem i podpisami** — po fundamencie
  bezpieczeństwa; otwiera integracje deweloperskie.
- **Z-156** *(P1 · S)* — **Gmail tylko pod konkretny przypadek** (np. „mail → zadanie/notatka”), scope
  minimalny, tokeny szyfrowane, jawna zgoda i odpięcie.
- **Z-157** *(P1 · S)* — **Ujednolicić warstwę integracji** (timeout, retry, degradacja, szyfrowane
  tokeny) jako wspólny wzorzec dla wszystkich klientów zewnętrznych.
- **Z-158** *(P2 · M)* — **Web-push na żywo** (Web Push API) jako uzupełnienie powiadomień bez crona
  (Rozdz. 34) — realne przypomnienia na urządzeniu.

## Dobre vs złe praktyki

**Dobre:**
- Integracje za abstrakcją (`ors`, `drive`, `openMeteo`, `webSearch`) z zasadą graceful degradation.
- Drive: per-user OAuth z minimalnym scope `drive.file` i rejestrem plików.
- Wykorzystanie tanich/bezpłatnych API (Open-Meteo, OSM, DDG) tam, gdzie się da.

**Złe / do poprawy:**
- Brak integracji najbardziej pożądanych przez użytkowników (Google Calendar dwukierunkowo, Gmail).
- Brak feedu iCal i web-push — „szybkie wygrane” wciąż niezrobione.
- Brak publicznego API/webhooks — zamknięty ekosystem (bariera dla B2B/integratorów).
