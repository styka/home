# Spec: Odporność asystenta AI na limity szybkości (rate limit / 429)

- **ID:** 010-ai-chat-rate-limit
- **Status:** draft <!-- draft | planned | in-progress | verified | done -->
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-19
- **Moduł(y):** Home (asystent AI) + wspólna warstwa LLM

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba
Czat asystenta AI potrafi zwrócić użytkownikowi **surowy błąd dostawcy** zamiast odpowiedzi. Zgłoszenie
z 2026-07-19: na pytanie „pokaż mi wszystkie zadania otagowane »raj«" agent padł z komunikatem
`Rate limit reached for model llama-3.3-70b-versatile … tokens per minute (TPM): Limit 12000, Used 8761,
Requested 10243`. To techniczny szum: użytkownik nie wie, co zrobił źle, ani co ma zrobić dalej — a jego
polecenie po prostu przepadło. Limit tokenów-na-minutę u dostawcy (Groq) jest **przejściowy**: po chwili
(albo po zwolnieniu okna minuty) ten sam request przechodzi. Chcemy, by asystent sam się z tego podnosił,
a gdy naprawdę się nie da — mówił to po ludzku.

## 2. Cel i miary sukcesu
- Cel: przejściowy limit szybkości dostawcy LLM **nie kończy się surowym błędem** w oczach użytkownika —
  asystent najpierw próbuje sam dojść do odpowiedzi, a dopiero po wyczerpaniu prób pokazuje zrozumiały,
  polski komunikat z podpowiedzią „spróbuj za chwilę".
- Sukces mierzymy:
  - użytkownik **nigdy** nie widzi surowego tekstu w rodzaju „Rate limit reached for model …";
  - polecenie, które trafiło na chwilowy limit, **kończy się poprawną odpowiedzią** po automatycznej
    ponownej próbie w typowym przypadku (okno limitu zwalnia się w kilka sekund);
  - gdy mimo prób limit trwa, użytkownik dostaje **jeden, zrozumiały komunikat po polsku** i może
    powtórzyć polecenie jednym kliknięciem (istniejące Retry).

## 3. Historyjki użytkownika
- Jako użytkownik pytający asystenta o swoje dane chcę, żeby chwilowe przeciążenie modelu było
  **niewidoczne** — asystent po cichu spróbował jeszcze raz i zwrócił mi odpowiedź.
- Jako użytkownik, gdy asystent naprawdę nie może teraz odpowiedzieć, chcę **prostego komunikatu po
  polsku** („asystent jest chwilowo przeciążony, spróbuj za chwilę"), a nie technicznego błędu dostawcy.
- Jako właściciel systemu chcę, żeby przejściowe limity **nie generowały fałszywego wrażenia awarii**
  i nie zmuszały mnie do zgłaszania „buga", który jest tylko chwilowym limitem.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then — każde musi dać się zweryfikować w `/verify`.
- [ ] **AC-1** — Given dostawca LLM zwraca odpowiedź z limitem szybkości (status 429) na pierwsze
  wywołanie, but okno limitu zwalnia się po chwili, when użytkownik wyśle polecenie do asystenta, then
  asystent **automatycznie ponawia** wywołanie (z odczekaniem) i zwraca poprawną odpowiedź, bez pokazania
  błędu.
- [ ] **AC-2** — Given dostawca wskazuje, po jakim czasie ponowić (informacja „retry after"), when
  asystent ponawia, then **respektuje** wskazany czas oczekiwania (nie ponawia natychmiast), a liczba
  prób jest **ograniczona** (nie zapętla się w nieskończoność).
- [ ] **AC-3** — Given limit szybkości utrzymuje się mimo wyczerpania ponownych prób, when asystent
  kończy, then użytkownik widzi **zrozumiały komunikat po polsku** o chwilowym przeciążeniu i sugestię,
  by spróbować za moment — **nigdy** surowego tekstu dostawcy typu „Rate limit reached for model …".
- [ ] **AC-4** — Given odpowiedź asystenta w trybie strumieniowym (SSE) trafia na limit szybkości, when
  strumień się kończy, then użytkownik również dostaje **łagodny polski komunikat** (a nie surowy błąd),
  spójny z trybem bez streamingu.
- [ ] **AC-5** — Given błąd LLM **nieprzejściowy** (np. zły request 400, brak autoryzacji 401/403), when
  wystąpi, then asystent **nie ponawia** w kółko (ponawianie dotyczy tylko błędów przejściowych) i kończy
  bez zbędnej zwłoki.
- [ ] **AC-6** — Given istnieje skonfigurowany model zapasowy (łańcuch fallbacku), when pierwszy model
  zwróci limit szybkości, then zachowanie pozostaje **co najmniej tak dobre jak dziś** (najpierw próba
  fallbacku na inny model/dostawcę), a ponawianie z odczekaniem jest **uzupełnieniem**, nie regresją.

## 5. Zakres
**W zakresie:**
- Automatyczne **ponawianie z odczekaniem (backoff)** wywołań LLM, które trafiły na przejściowy limit
  szybkości, z **poszanowaniem wskazówki dostawcy o czasie ponowienia** i **ograniczoną** liczbą prób.
- **Łagodny, polski komunikat** dla użytkownika, gdy limit utrzymuje się mimo prób — zamiast surowego
  komunikatu dostawcy — spójnie w trybie zwykłym i strumieniowym (SSE) asystenta.
- Zachowanie obecnego łańcucha fallbacku na inny model/dostawcę (bez regresji).

**Poza zakresem (świadomie):**
- Zmiana samych limitów u dostawcy, zakup wyższego planu Groq ani przełączanie kont/kluczy.
- Trwałe „kolejkowanie" poleceń użytkownika do wykonania w tle po ustąpieniu limitu.
- Agresywne przycinanie promptu/historii/wyników narzędzi „pod TPM" (rozważane, ale odrzucone przez
  właściciela — ryzyko utraty kontekstu rozmowy; można wrócić osobnym zadaniem, jeśli limity będą
  częste).
- Zmiany w budżecie AI (`checkAiBudget`) i w limicie zapytań per użytkownik (`checkRateLimit`) — to
  osobne, wewnętrzne bramki i nie są przedmiotem tego zgłoszenia.

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — asystent działa w ramach `module.home`; nie dokładamy slugów.
- **Własność danych:** nie dotyczy — brak nowych modeli/danych; zmiana jest w warstwie obsługi błędów
  LLM.
- **Asystent AI:** dotyczy rdzenia asystenta (pętla agenta + wspólny klient LLM). **Nie** wymaga nowej
  `AIAction` ani read-toola (C-23 nie uruchamia się).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-01** — cała zmiana w `worldofmag/`.
- **C-40 — routing modeli DB-driven:** ponawianie i fallback nie mogą hardcodować providera/modelu —
  działają na łańcuchu rozwiązanym per typ operacji.
- **C-41 — klucze API maskowane/niepokazywane:** komunikat o błędzie dla użytkownika **nie może** ujawnić
  klucza ani surowej treści od dostawcy.
- **C-32 — teksty UI po polsku:** komunikat o przeciążeniu po polsku.
- **C-53 — minimalizm:** najmniejsza możliwa zmiana w istniejącej warstwie obsługi błędów LLM; bez nowych
  zależności i „przy okazji" refaktorów.
- **C-50 / C-52 — „gotowe" = zielony `build`, potem merge do `develop`.**
- **C-51 — wpis do `doświadczenia.md`** po naprawie.

## 8. Otwarte pytania / decyzje właściciela
- [x] **Strategia reakcji na 429/TPM** — właściciel wybrał: **retry z backoff (respektując wskazówkę
  dostawcy o czasie ponowienia, ograniczona liczba prób) + łagodny polski komunikat, gdy limit trwa**.
  Odrzucono: sam komunikat bez ponawiania oraz wariant z agresywnym cięciem kontekstu.
- Założenia domyślne (rozstrzygnięte bez pytania, do potwierdzenia w planie): ponawianie ma być
  **krótkie i ograniczone** (kilka sekund łącznie, kilka prób), żeby nie zablokować żądania na długo;
  gdy dostawca nie poda czasu ponowienia — użyć rozsądnego, rosnącego odczekania.

## 9. Ryzyka
- **Zbyt długie ponawianie** → użytkownik czeka i myśli, że asystent zawiesił się. Ograniczamy: mała,
  twarda liczba prób i krótki łączny czas; potem od razu łagodny komunikat.
- **Zapętlenie na błędzie nieprzejściowym** → ponawiamy **wyłącznie** błędy przejściowe (limit/5xx/sieć),
  nigdy 4xx poza 429 (AC-5).
- **Wyciek surowej treści dostawcy** do UI → komunikat użytkownika jest **naszym** tekstem po polsku, nie
  przepisanym błędem dostawcy (C-41).
- **Regresja fallbacku** → ponawianie jest **uzupełnieniem** istniejącego łańcucha, nie zastępuje go
  (AC-6).
