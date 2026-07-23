# Spec: Log diagnostyki AI w zgłoszeniu błędu z czatu asystenta

- **ID:** 024-assistant-bug-report-ai-diagnostics
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-23
- **Moduł(y):** Home / Asystent AI (zgłaszanie błędów) + Admin (Diagnostyka asystenta AI)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba
Gdy administrator zgłasza błąd z poziomu czatu asystenta AI (ikoną robaczka w górnej części okna
asystenta), powstaje zadanie w projekcie „Omnia" z opisem defektu: opisem od zgłaszającego, zrzutem
rozmowy i klienckim logiem rozumowania agenta. Brakuje w nim jednak **serwerowego logu diagnostycznego
wywołań modelu** — tego samego, który admin ogląda w panelu **Diagnostyka asystenta AI** (surowy log
wywołań LLM: status dostawcy, treść błędu, liczba prób, tokeny, koszt/latencja, w tym wywołania
**nieudane**). Dziś, żeby dołączyć ten kontekst do zgłoszenia, admin musi ręcznie przejść do panelu
diagnostyki, przefiltrować po `conversationId`, skopiować przebieg i wkleić — łatwo o tym zapomnieć, a
to często najważniejszy trop przy błędach asystenta.

## 2. Cel i miary sukcesu
- Cel: zgłoszenie błędu z czatu automatycznie zawiera log diagnostyki AI dla tej rozmowy — bez ręcznego
  kopiowania z panelu admina.
- Sukces mierzymy: po utworzeniu zadania błędu z rozmowy, która wykonała wywołania modelu, opis zadania
  zawiera sekcję z diagnostyką tych wywołań (te same dane, które pokazuje panel „Diagnostyka asystenta
  AI" po odfiltrowaniu tej rozmowy) — w **zero** dodatkowych kliknięć ponad obecne zgłoszenie.

## 3. Historyjki użytkownika
- Jako administrator zgłaszający błąd asystenta chcę, żeby w zgłoszeniu automatycznie znalazł się log
  diagnostyki AI dla tej rozmowy, żebym nie musiał osobno wchodzić do panelu diagnostyki i wklejać go
  ręcznie.
- Jako osoba naprawiająca zgłoszony błąd (np. w Claude Code) chcę mieć w jednym miejscu opis, zrzut
  rozmowy i serwerowy log wywołań modelu (z porażkami, statusami i liczbą prób), żeby od razu widzieć,
  co realnie poszło nie tak.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1** — Given rozmowa z asystentem, w której wykonano co najmniej jedno wywołanie modelu,
  when administrator zgłasza błąd ikoną robaczka (z opisem lub bez), then opis utworzonego zadania w
  projekcie „Omnia" zawiera wyodrębnioną sekcję z logiem diagnostyki AI dla tej rozmowy.
- [ ] **AC-2** — Given zgłoszenie z AC-1, when czytam dołączoną sekcję diagnostyki, then dla każdego
  wywołania widzę te same kluczowe pola co panel „Diagnostyka asystenta AI": czas, źródło, typ operacji,
  dostawcę/model, wynik (OK/porażka ze statusem), liczbę prób, tokeny, latencję oraz treść błędu przy
  wywołaniach nieudanych.
- [ ] **AC-3** — Given rozmowa jeszcze niezapisana w historii (brak identyfikatora rozmowy) lub rozmowa
  bez żadnych zarejestrowanych wywołań modelu, when administrator zgłasza błąd, then zgłoszenie
  powstaje poprawnie, a sekcja diagnostyki zawiera czytelną adnotację o braku danych (zgłoszenie nigdy
  nie kończy się błędem tylko z powodu braku logu).
- [ ] **AC-4** — Given wcześniejsza zawartość zgłoszenia (opis problemu, zrzut rozmowy, kliencki log
  rozumowania, ostatni błąd, stopka z metadanymi), when dołączamy diagnostykę AI, then cała dotychczasowa
  zawartość zgłoszenia pozostaje bez zmian — nowa sekcja jest **dodatkiem**, nie zamiennikiem.
- [ ] **AC-5** — Given bardzo długi log diagnostyki, when trafia do opisu zadania, then jego objętość jest
  rozsądnie ograniczona (skrócenie z wyraźnym oznaczeniem ucięcia), tak jak inne obszerne fragmenty
  zgłoszenia, aby opis zadania pozostał czytelny.

## 5. Zakres
**W zakresie:**
- Dołączanie logu diagnostyki AI (serwerowego logu wywołań modelu dla bieżącej rozmowy) do treści
  zadania tworzonego przez zgłoszenie błędu z czatu asystenta (ikona robaczka / panel zgłoszenia).
- Czytelne, jednoznaczne sformatowanie tej sekcji w opisie zadania oraz obsługa przypadków brzegowych
  (brak identyfikatora rozmowy, brak wywołań, bardzo długi log).

**Poza zakresem (świadomie):**
- Zmiany w samym panelu „Diagnostyka asystenta AI" (`/admin/ai-calls`) — pozostaje jak jest.
- Zmiana zakresu ani wyglądu istniejących sekcji zgłoszenia (opis, zrzut rozmowy, kliencki log
  rozumowania) poza dodaniem nowej sekcji.
- Udostępnienie zgłaszania błędów lub diagnostyki AI użytkownikom nie-adminom (funkcja pozostaje
  admin-only, jak dziś).
- Zbieranie/rozszerzanie zakresu danych zapisywanych o wywołaniach modelu — korzystamy z tego, co już
  jest rejestrowane.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez nowego slugu. Zgłaszanie błędów z czatu i diagnostyka AI są już
  **admin-only**; dołączanie logu diagnostyki działa w tym samym, istniejącym reżimie dostępu (C-22).
- **Własność danych:** bez zmian — zgłoszenie to zadanie w projekcie „Omnia" zgłaszającego; log
  diagnostyki jest globalnym logiem wywołań widocznym tylko dla admina.
- **Asystent AI:** nie dotyczy w sensie nowej `AIAction`/read-toola — to zgłoszenie tworzone
  bezpośrednio (nie przez pętlę agenta). Odczyt logu korzysta z istniejącej, admin-gated ścieżki danych
  diagnostyki (C-23 nie wymaga tu nowej akcji AI).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-20** — jeśli potrzebny będzie odczyt logu po stronie serwera, robimy to przez istniejący/rozszerzony
  Server Action, bez ręcznej inwalidacji cache.
- **C-22** — zachowujemy admin-only reżim (zgłaszanie + diagnostyka są tylko dla admina).
- **C-30 / C-32** — ewentualne komunikaty w UI po polsku, kolory przez zmienne CSS (choć zmiana jest
  głównie w treści opisu zadania, nie w nowym UI).
- **C-53** — minimalizm: reużywamy istniejącej ścieżki danych diagnostyki i istniejącego mechanizmu
  budowania raportu zgłoszenia; żadnych nowych zależności ani modeli.
- **C-50 / C-52** — „gotowe" = zielony `npm run build`; na koniec automatyczny merge do `develop` i
  promocja `develop → master`.

## 8. Otwarte pytania / decyzje właściciela
Brak pytań do właściciela — pomysł jest jednoznaczny i czysto addytywny. Przyjęte założenia (rozsądne
domyślne, C-55):
- Log dołączamy **dla bieżącej rozmowy** (po jej identyfikatorze), spójnie z filtrowaniem panelu
  diagnostyki po `conversationId`; dołączamy **wszystkie** zarejestrowane wywołania tej rozmowy (w tym
  nieudane), a nie tylko porażki.
- Gdy rozmowa nie ma jeszcze identyfikatora albo nie zarejestrowano żadnych wywołań — zgłoszenie i tak
  powstaje, z adnotacją o braku danych (AC-3).
- Zestaw pól i format sekcji odwzorowuje to, co pokazuje panel „Diagnostyka asystenta AI" (AC-2),
  z rozsądnym skróceniem długiego logu (AC-5).

## 9. Ryzyka
- **Obszerny log rozdmuchuje opis zadania** → limitujemy długość z wyraźnym oznaczeniem ucięcia (AC-5),
  jak inne duże fragmenty zgłoszenia.
- **Brak identyfikatora rozmowy / brak wywołań** → jawnie obsłużone jako brak danych, bez wywracania
  zgłoszenia (AC-3).
- **Rozjazd z panelem diagnostyki** (inny zestaw pól niż to, co widzi admin) → AC-2 wiąże format sekcji
  z tym, co pokazuje istniejący panel, więc oba źródła prezentują te same dane.
