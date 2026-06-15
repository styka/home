# Rozdział 8 — Bezpieczeństwo, RBAC, szyfrowanie, RODO/GDPR

## Kontekst / stan z kodu

- **Uwierzytelnianie:** wyłącznie NextAuth v5 + Google OAuth (`src/lib/auth.ts`); brak trybu
  anonimowego. Sesja niesie `user.id`, `user.roles`, `user.permissions`.
- **RBAC:** `src/lib/permissions.ts` — mapa `PERMISSIONS` (slug `module.*`), `hasPermission`,
  `permissionForPath`, `isPathLocked`. Role → `RolePermission` → uprawnienia. **Strażnik
  samo-wykluczenia admina** (`access.ts` `countAdminAccessHolders`) blokuje zmianę zostawiającą 0
  adminów.
- **Szyfrowanie sekretów:** `src/lib/crypto/secrets.ts` — AES-256-GCM, klucz z `CONFIG_SECRET`/
  `AUTH_SECRET`; klucze API providerów szyfrowane w spoczynku, **maskowane** w `/admin/config` i
  `/admin/llm`; deszyfrowane tylko do użycia (resolver/webSearch/ors).
- **Audyt:** `AuditLog` (+ `lib/audit.ts`) — zmiany RBAC/config; **bez FK do User** (zrzut e-maila
  aktora → historia przeżywa usunięcie konta).
- **Dane wrażliwe:** moduł Zdrowie (wizyty, wyniki badań, leki), Zwierzęta (weterynaria), Portfel
  (finanse), Kontakty — to **dane osobowe, część szczególnej kategorii (zdrowie)**.
- **LUKI RODO (z backlogu, potwierdzone):** **brak eksportu danych użytkownika** i **brak twardego
  usunięcia konta** (pozycja SE3, opisana jako „wymóg prawny”). Brak polityki retencji i (prawdopodobnie)
  publicznej polityki prywatności/zgód.

## Głos Zespołu A — Strażnicy

**Anna (security):** „Zacznę od rzeczy, która **zamyka drogę do publicznego startu**: bez **eksportu
danych (art. 15/20 RODO)** i **twardego usunięcia konta (art. 17)** nie wolno nam wpuścić publicznych
użytkowników w UE. To nie jest »miłe do mieć« — to obowiązek prawny i kara do 4% obrotu. To **P0**.”

**Anna (c.d.):** „Druga sprawa: czy **każda** Server Action sprawdza własność i uprawnienie? Mamy
helpery (`assertListAccess` itp.), ale przy 57 plikach akcji potrzebny jest **audyt pokrycia** —
jedna akcja bez `assert*` to podatność IDOR (dostęp do cudzego rekordu po ID).”

**Marek (DBA):** „Szyfrowanie kluczy jest dobre, ale **wiąże dane z `AUTH_SECRET`**. Rotacja sekretu =
utrata wszystkich zaszyfrowanych kluczy. To musi być **udokumentowane jako procedura** i `AUTH_SECRET`
trzymany jak złoto (menedżer sekretów, nie env w repo).”

**Grzegorz (delivery):** „Dochodzi cała warstwa **organizacyjna**: polityka prywatności, regulamin,
umowy powierzenia z podprocesorami (Google, Groq/LLM, Neon, Render), rejestr czynności przetwarzania.
Bez prawnika (DPO) nie ruszamy z reklamami i płatnościami.”

## Głos Zespołu B — Pionierzy

**Sebastian (security):** „Zgoda co do RODO — to twarde P0, ale **wykonalne offline** i nie tak duże:
eksport to agregacja danych usera do ZIP/JSON, usunięcie to kaskady. Zróbmy to w jednej-dwóch sesjach.
Reszta (sesje/urządzenia, 2FA) może poczekać — Google OAuth już daje nam silne logowanie za darmo.”

**Wojtek (PO):** „Reklamy kierowane, które wpisał właściciel w model biznesowy, **zderzają się czołowo
z prywatnością i RODO**. »Kierowane« = profilowanie = zgody, banner, ryzyko. Proponuję na start
**reklamy kontekstowe** (bez profilowania) — prościej prawnie i spójniej z naszą obietnicą zaufania.”

**Hubert (AI/ML):** „I uwaga na **dane w promptach LLM**: wysyłamy treści użytkownika do Groqa.
Potrzebujemy jasnej informacji, co i komu wysyłamy, oraz minimalizacji (nie wrzucać całych rekordów
zdrowotnych do modelu bez potrzeby). To i prywatność, i koszt.”

## Punkty sporne

- **Reklamy kierowane vs kontekstowe.** Strażnicy i część Pionierów: zacznijmy **kontekstowo** (bez
  profilowania) — mniej ryzyka RODO, spójniej z minimalistycznym, „zaufanym” UX. Decyzja właściciela
  do podjęcia w Części IV; rekomendacja audytu: **kontekstowe na start**.
- **Zakres bezpieczeństwa na etap.** Pionierzy: OAuth wystarczy, nie budujmy 2FA/zarządzania sesjami
  teraz. Strażnicy: zgoda, **pod warunkiem** że RODO i audyt pokrycia akcji są zrobione. **Konsensus:**
  RODO + audyt IDOR = teraz; 2FA/sesje = później.

## Głos użytkowników

**Agnieszka (38, rodzina):** „Trzymam tu dane dzieci i zdrowie rodziny. Chcę wiedzieć, że mogę to
**wyeksportować i skasować**, i że nikt postronny tego nie zobaczy.” → eksport/usunięcie i izolacja
tenantów to nie compliance-formalność, to **zaufanie**, bez którego rodzina nie wejdzie.

**Tadeusz (60, gastronomia):** „Jak płacę, to chcę fakturę i pewność, że moje dane firmowe są
bezpieczne.” → przy płatnościach dochodzą wymogi (PCI po stronie bramki, faktury).

## Konsensus i zalecenia

- **Z-050** *(P0 · M)* — **Eksport danych użytkownika (RODO art. 15/20).** Agregacja wszystkich danych
  usera (wszystkie moduły) do ZIP/JSON na żądanie z `/settings`. Wykonalne offline.
- **Z-051** *(P0 · M)* — **Twarde usunięcie konta (RODO art. 17).** Kaskadowe usunięcie/anonimizacja
  danych usera + potwierdzenie; spójne z polityką `onDelete` (Z-033). `AuditLog` zostaje (zrzut e-maila).
- **Z-052** *(P0 · M)* — **Audyt pokrycia autoryzacji w Server Actions.** Zweryfikować, że KAŻDA akcja
  mutująca/odczytująca cudze dane sprawdza własność (`assert*`) i uprawnienie; dodać brakujące. Ochrona
  przed IDOR. Rozważyć strażnik buildu (jak `check-action-coverage`).
- **Z-053** *(P0 · S)* — **Polityka prywatności + regulamin + zgody** (cookie/analityka/reklamy) i
  **rejestr przetwarzania** + umowy powierzenia z podprocesorami (Google, LLM, Neon, Render). Warunek
  publicznego startu; wymaga DPO/prawnika.
- **Z-054** *(P1 · S)* — **Udokumentować procedurę `AUTH_SECRET`/`CONFIG_SECRET`** (stałość, rotacja =
  re-szyfrowanie kluczy), trzymać w menedżerze sekretów hostingu, nie w repo.
- **Z-055** *(P1 · M)* — **Minimalizacja danych w promptach LLM** + informacja dla użytkownika, jakie
  dane i do jakiego dostawcy trafiają; opcja wyłączenia funkcji AI dla danych wrażliwych.
- **Z-056** *(P1 · S)* — **Reklamy kontekstowe (bez profilowania) jako domyślny model** na start —
  zgodność z RODO bez bannerów zgód na profilowanie; profilowanie dopiero za wyraźną zgodą.
- **Z-057** *(P1 · M)* — **Testy bezpieczeństwa ścieżek krytycznych** (auth, dostęp do cudzych
  zasobów, eskalacja uprawnień, płatności) — patrz Rozdz. 14.
- **Z-058** *(P2 · M)* — **Zarządzanie sesjami/urządzeniami + opcjonalne 2FA** — po fundamencie RODO.
- **Z-059** *(P1 · S)* — **Polityka retencji** (kosz, logi, dane nieaktywnych kont) i jej egzekwowanie.

## Dobre vs złe praktyki

**Dobre:**
- Szyfrowanie kluczy API w spoczynku + maskowanie w UI (rzadko spotykane na tym etapie).
- Dziennik audytu odporny na usunięcie użytkownika (zrzut e-maila aktora).
- Strażnik samo-wykluczenia admina; logowanie wyłącznie przez sprawdzonego dostawcę (Google).

**Złe / do poprawy:**
- **Brak eksportu i twardego usunięcia konta** — blokada prawna publicznego startu (P0).
- Brak potwierdzonego, pełnego pokrycia autoryzacji w akcjach (ryzyko IDOR) — wymaga audytu.
- Napięcie „reklamy kierowane” × RODO nierozwiązane na poziomie produktu.
- Zależność szyfrowania od `AUTH_SECRET` bez sformalizowanej procedury rotacji.
