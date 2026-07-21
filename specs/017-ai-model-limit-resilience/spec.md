# Spec: Odporność asystenta AI na wyczerpanie limitu modelu (degradacja + uczciwy komunikat)

- **ID:** 017-ai-model-limit-resilience
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-21
- **Moduł(y):** Home (asystent AI) + wspólna warstwa LLM

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

> **Kontekst wobec 010 i 016 (C-54).** 010 dodał retry + ludzki komunikat (założenie: limit chwilowy).
> 016 zredukował prompt i dodał pacing minutowy (TPM). Produkcyjne logi z `/admin/ai-calls` (21.07,
> ~22:16–22:23) pokazują jednak **inny** rodzaj limitu: **dzienny** (TPD — tokens-per-day: Limit 100000,
> Used ~98300) na darmowym modelu reasoning Groqa. Każde wywołanie reasoning kosztuje 6000–8000 tokenów,
> więc ~13–16 interakcji wyczerpuje **cały dzienny budżet**; potem każde zapytanie pada 429 aż do resetu
> o północy UTC. **Ani retry, ani pacing minutowy tego nie naprawią** — dziennego okna nie da się
> „przeczekać" w kilka sekund. Ten spec dokłada brakującą warstwę: **degradację na lżejszy, dostępny
> model** + **uczciwy komunikat rozróżniający limit minutowy od dziennego**.

## 1. Problem / potrzeba
Asystent nadal potrafi całkiem przestać odpowiadać: po ~13–16 zapytaniach w ciągu dnia darmowy model
reasoning (Groq `llama-3.3-70b-versatile`) wyczerpuje **dzienny** limit tokenów i każde kolejne polecenie
pada z 429, a użytkownik widzi „chwilowy limit… spróbuj za chwilę" — co jest **nieprawdą** (to nie
chwilowe, reset dopiero o północy UTC). Jednocześnie lżejszy model (`llama-3.1-8b-instant`, używany do
prostej klasyfikacji) **działał bez przerwy** — ma osobny budżet. Marnujemy więc dostępny model i
zostawiamy użytkownika z martwym asystentem oraz mylącym komunikatem.

## 2. Cel i miary sukcesu
- Cel: wyczerpanie limitu jednego modelu **nie zabija asystenta** — próbuje on **innego, dostępnego
  modelu**, a gdy naprawdę nic nie działa, mówi **prawdę** (co się stało i co zrobić), po polsku.
- Sukces mierzymy:
  - gdy główny model reasoning zwraca 429 (dzienny TPD **lub** minutowy TPM), asystent **automatycznie
    próbuje lżejszego dostępnego modelu** i — jeśli ten odpowiada — **zwraca wynik** zamiast błędu;
  - gdy żaden model nie może obsłużyć zapytania, użytkownik dostaje **jeden, zrozumiały komunikat po
    polsku**, **rozróżniający**: limit **minutowy** („spróbuj za chwilę") od **dziennego** („wyczerpany
    dzienny limit darmowego modelu — użyj płatnego modelu w ustawieniach LLM albo spróbuj po północy");
  - użytkownik **nigdy** nie widzi surowego tekstu dostawcy („Rate limit reached for model …").

## 3. Historyjki użytkownika
- Jako użytkownik, gdy „mocny" model wyczerpał limit, chcę żeby asystent **spróbował słabszego** i mimo
  wszystko mi odpowiedział — wolę słabszą odpowiedź niż żadną.
- Jako użytkownik, gdy naprawdę nie da się teraz odpowiedzieć, chcę **prawdziwej informacji**: czy to
  chwilowo (poczekać minutę), czy dzienny limit (poczekać do jutra / przełączyć na płatny model).
- Jako właściciel chcę, żeby na darmowym Groqu asystent **działał jak najdłużej** (degradacja do
  lżejszego modelu), a docelowo żebym mógł ustawić płatny model bez dziennego limitu i mieć spokój.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde weryfikowalne w `/verify`.
- [ ] **AC-1** — Given główny model reasoning zwraca 429 (limit), a w konfiguracji jest dostępny **lżejszy**
  model, when użytkownik wyśle polecenie wymagające reasoning, then asystent **automatycznie** ponawia na
  lżejszym modelu i — gdy ten odpowie — **zwraca poprawny wynik** (bez pokazania błędu).
- [ ] **AC-2** — Given 429 dotyczy limitu **dziennego** (sygnał „per day/TPD"), when asystent wyczerpie
  wszystkie dostępne modele, then komunikat dla użytkownika mówi **wprost o limicie dziennym** i sugeruje
  płatny model (ustawienia LLM) lub próbę po resecie — **nie** „spróbuj za chwilę".
- [ ] **AC-3** — Given 429 dotyczy limitu **minutowego** (sygnał „per minute/TPM") i nie ma innego
  modelu, when asystent kończy, then komunikat mówi o **chwilowym** przeciążeniu i „spróbuj za chwilę".
- [ ] **AC-4** — Given jakikolwiek błąd/limit dostawcy, when asystent go raportuje użytkownikowi, then
  **nigdy** nie pokazuje surowego tekstu dostawcy (np. „Rate limit reached for model …") — zawsze polski,
  zrozumiały komunikat (C-41/C-32).
- [ ] **AC-5** — Given administrator ustawił **płatny** model (Anthropic) dla operacji reasoning w
  ustawieniach LLM, when użytkownik korzysta z asystenta, then zapytania idą tym modelem, a mechanizm
  degradacji/limitu nie przeszkadza normalnej pracy (brak regresji dla płatnej ścieżki).
- [ ] **AC-6** — Given istniejące ścieżki asystenta (proste dodawanie/edycja, raporty, rozmowa, pacing z
  016, retry z 010), when użytkownik ich używa, then działają jak dotąd (brak regresji); diagnostyka w
  `/admin/ai-calls` nadal loguje próby (w tym degradację i porażki).

## 5. Zakres
**W zakresie:**
- **Degradacja modelu**: gdy główny model danej operacji (zwł. reasoning) zwraca limit (429 TPD/TPM),
  asystent próbuje **kolejnego, dostępnego, lżejszego** modelu, zanim się podda.
- **Uczciwy komunikat**: rozróżnienie limitu **minutowego** vs **dziennego** i dopasowana, polska treść
  z sensowną podpowiedzią; nigdy surowy tekst dostawcy.
- Utrzymanie odporności z 010 (retry) i 016 (pacing TPM, redukcja promptu, diagnostyka) — degradacja jest
  **kolejną** warstwą, nie zastępuje tamtych.

**Poza zakresem (świadomie):**
- Konfiguracja konkretnego płatnego klucza/modelu Anthropic — to **ustawienie administratora** w panelu
  LLM, nie kod tej zmiany (spec jedynie zapewnia, że taka ścieżka działa i jest sugerowana w komunikacie).
- Trwałe zapamiętywanie „model X wyczerpany do północy" (globalny licznik dzienny per model) — możliwa
  przyszła optymalizacja; tutaj wystarcza reakcja na 429 w locie.
- Zmiana jakości/treści odpowiedzi lżejszego modelu (akceptujemy, że bywa słabszy — świadoma decyzja
  właściciela: „lepiej słabsza odpowiedź niż żadna").
- Zmiany UX czatu (bąbelki, historia, Retry) poza samą treścią komunikatu błędu.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — asystent na `/` (`module.home`); brak nowego slugu.
- **Własność danych:** bez zmian — brak nowych danych użytkownika; odczyty respektują istniejący dostęp.
- **Asystent AI:** rdzeń zmiany to warstwa LLM/agent (C-40) — bez nowej `AIAction`; chodzi o dobór modelu
  i treść komunikatu przy limicie.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-40** (routing modeli DB-driven) — degradacja działa **w ramach** istniejącego łańcucha konfiguracji
  modeli per operacja; nie hardkodujemy providera na sztywno w logice funkcji (dobór z konfiguracji).
- **C-41 / C-32** — komunikaty po polsku, nigdy surowy tekst/klucz dostawcy.
- **C-53** (minimalizm) — najmniejsza zmiana realizująca cel; bez nowych zależności; reuse istniejącego
  łańcucha fallbacku i warstwy komunikatów.
- **C-54** — spec świadomie koryguje założenie 010/016 (limit bywa **dzienny**, nie tylko chwilowy/minutowy).
- **C-50/C-51/C-52** — „gotowe" = build zielony; wpis do `doświadczenia.md`; merge do `develop` (+ ewentualna
  promocja na `master` wg reguł).

## 8. Otwarte pytania / decyzje właściciela
- **Rozstrzygnięte (AskUserQuestion, 21.07):** przy wyczerpaniu limitu głównego modelu — **degraduj na
  lżejszy dostępny model, a dopiero potem pokaż uczciwy komunikat** (opcja zalecana). Akceptacja niższej
  jakości odpowiedzi lżejszego modelu: „lepiej słabsza odpowiedź niż żadna".
- **Założenia domyślne:** lżejszy model degradacji to model już skonfigurowany/dostępny w systemie (np.
  ten używany do szybkiej klasyfikacji), o osobnym budżecie; docelowo administrator może ustawić płatny
  model reasoning w panelu LLM — wtedy degradacja praktycznie nie jest potrzebna.

## 9. Ryzyka
- **Lżejszy model daje gorszą odpowiedź** → świadoma akceptacja właściciela; komunikat/kontekst może
  zaznaczyć, że użyto modelu zapasowego (opcjonalnie). AC-6 pilnuje braku regresji płatnej ścieżki.
- **Błędne rozpoznanie typu limitu (dzienny vs minutowy)** → opieramy się na sygnale dostawcy; gdy
  niejednoznaczny, wybieramy komunikat bezpieczniejszy (chwilowy „spróbuj za chwilę"), by nie straszyć
  użytkownika dziennym limitem bez pewności.
- **Degradacja maskuje realny problem konfiguracji** → diagnostyka w `/admin/ai-calls` (z 016) nadal
  loguje każdą próbę i porażkę, więc widać, że model główny jest wyczerpany.
