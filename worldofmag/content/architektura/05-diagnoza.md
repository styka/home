# Diagnoza — co się złamie, dlaczego i kiedy

> Uszeregowane wg iloczynu **prawdopodobieństwo × szkoda**. Każdy punkt ma **dowód w kodzie**
> i **scenariusz awarii** (wejście → zły wynik), a nie ogólnikowe „może być problem".

---

## 🔴 P0 — blokujące otwarcie

### 5.1. Cicha utrata pracy przy współdzieleniu

**Dowód.** Żaden ze 147 modeli nie ma kolumny wersji. Każdy zapis to `UPDATE … SET …`.

**Scenariusz awarii.** Anna i Marek mają wspólny projekt zadań. Oboje otwierają zadanie „Zamówić
materiały". Anna zmienia termin na piątek i zapisuje. Marek — który widział stary stan — zmienia
opis i zapisuje. **Zmiana Anny znika bez śladu.** Nikt nie dostaje ostrzeżenia, nie ma czego cofnąć,
a Anna dowie się o tym najwcześniej w piątek.

**Dlaczego to jest P0, a nie P1:** to nie jest awaria techniczna, tylko **utrata danych
użytkownika** — najgorsza kategoria błędu, jaka istnieje. I jest **niewidoczna w testach z jednym
kontem**, czyli dokładnie w tych, które dziś mamy.

**Naprawa:** rozdział 8.5 — wersjonowanie rekordu + wykrywanie konfliktu.

---

### 5.2. Odpytywanie co 45 sekund

**Dowód.** `src/components/shell/DataFreshness.tsx` — `setInterval(…, 45_000)` wywołujący
`router.refresh()`; komponent montowany raz w `AppShell`, czyli **na każdej stronie**.

**Scenariusz awarii — techniczny.** Rachunek z 4.5: 5 000 kart → ~110 przeładowań RSC/s →
1 500–2 000 zapytań/s z bezczynności. Baza się przewróci, a rachunek przyjdzie za ruch, którego nikt
nie zamówił. Każde `router.refresh()` to też pełny re-render drzewa serwerowego — skalowanie
poziome ten koszt **mnoży**, nie dzieli.

**Scenariusz awarii — produktowy.** Dwie osoby przy wspólnej liście zakupów w sklepie. Jedna
odhacza mleko; druga widzi to **po 45 sekundach** i kupuje drugie. Współdzielenie bez wypychania
zmian jest funkcją, która działa „prawie".

**Naprawa:** rozdział 11.1.

---

### 5.3. Rate-limit i strażnik współbieżności są per proces

**Dowód.** `src/lib/ai/rateLimit.ts` — `Map` w pamięci procesu; komentarz w pliku uczciwie mówi
o potrzebie Redisa przy wielu instancjach.

**Scenariusz awarii.** Skalujemy web do 4 instancji → limit 20/min staje się faktycznie **80/min**,
a „maks. 2 równoległe" — ośmioma. Jeden zapętlony klient generuje ośmiokrotność zakładanego kosztu.

**Dlaczego gorsze niż brak limitu:** daje **fałszywe poczucie kontroli**. Nikt nie sprawdza
mechanizmu, o którym „wiadomo, że działa".

---

### 5.4. Brak twardych budżetów kosztu AI

**Dowód.** Rozliczanie kosztów jest wzorcowe (`estimateCost`, `LlmModelPrice`, `AiCall`, bramka
`check:cost-badge`), ale służy **pokazywaniu** kosztu, nie **zatrzymywaniu** wydatku.

**Scenariusz awarii.** 10 % ze 100 tys. użytkowników używa asystenta 2×/dobę:
`20 000 wywołań × 0,005 USD ≈ 100 USD/dobę ≈ 3 000 USD/mies.` — przy aplikacji, która jeszcze nic
nie zarabia. Wystarczy jeden użytkownik odkrywający, że „zrób raport" da się wołać w pętli.
**Rachunek przychodzi po fakcie.**

---

### 5.5. Pula połączeń do bazy

**Dowód.** `.env.example` ma `pgbouncer=true`, ale **nie ma `connection_limit`**; schemat nie
konfiguruje puli. Prisma otwiera pulę **na instancję**.

**Scenariusz awarii.** 4 instancje web + worker → zbliżamy się do limitów planu Neona. Objaw jest
mylący: aplikacja „losowo" zwraca błędy połączenia pod obciążeniem, choć baza raportuje wolne zasoby.
Diagnoza bez metryk (5.7) zajmuje dni.

---

## 🟠 P1 — poważne

### 5.6. Współdzielenie jest rozproszone i niekompletne

**Dowód.** Rozdział 3.3 — pięć mechanizmów, trzy słowniki ról, per-zasobowe udostępnianie tylko
w **3 z 21** modułów.

**Scenariusz.** Użytkownik udostępnia projekt zadań i oczekuje, że tak samo udostępni notatkę oraz
listę zakupów. **Nie może.** Dowiaduje się o tym metodą prób. A gdy już udostępni projekt — nie ma
jednego miejsca, w którym zobaczy, komu i co udostępnił, ani jak to cofnąć.

**Koszt architektoniczny:** każdy nowy moduł, który ma wspierać współdzielenie, wymaga napisania
własnej tabeli, własnych ról i własnych guardów. **To jest podatek od każdej przyszłej funkcji
współpracy.**

---

### 5.7. Brak obserwowalności

**Dowód.** Jest `reportServerError` i `/admin/health` (liczony na żywo), ale **brak metryk, tracingu
i logów strukturalnych**.

**Scenariusz.** Demo, ktoś mówi „u mnie długo się ładuje". Bez metryk jedyną odpowiedzią jest „u mnie
działa". Przy 100 tys. użytkowników to **niemożność prowadzenia produktu** — nie wiadomo, co
optymalizować ani czy zmiana pomogła.

---

### 5.8. Sprzężenie modułów hamuje rozwój

**Dowód.** Rozdział 3.4 — bezpośrednie importy, kalendarz agregujący sześć modułów, asystent
sięgający do wszystkich, 545 akcji w jednej przestrzeni nazw.

**Scenariusz — dzieje się już teraz, tylko powoli.** Dodanie modułu wymaga ośmiu miejsc, z których
żadne nie jest wymuszone typami. Zapomnienie o którymkolwiek daje moduł działający „prawie" — bez
wpisu w kalendarzu, bez dostępu asystenta albo bez kafelka na pulpicie.

**Koszt liczony w czasie:** dziś kilka godzin „obok" właściwej pracy. Przy 40 modułach — dzień.
**To podatek od każdej przyszłej funkcji.**

---

### 5.9. Retencja danych

**Dowód.** `cleanupOldJobs` (24 h) to **jedyna** systemowa retencja. Rosną bez ograniczeń:
`AuditLog`, `UserActivity`, `AiMessage`, `AiConversation`, `NewsArticle`, `ItemHistory`, `AiCall`.

**Scenariusz.** 100 tys. użytkowników × kilkadziesiąt wpisów aktywności dziennie = **dziesiątki
milionów wierszy rocznie** w tabeli, z której czyta się „ostatnie 10". Rośnie rozmiar bazy, koszt
kopii i czas odtworzenia po awarii.

---

### 5.10. Brak wielojęzyczności

**Dowód.** Teksty zaszyte w komponentach (konwencja `C-32` mówi wprost, że tak ma być). Zero
bibliotek i18n.

**To nie awaria — to ściana** o nietypowej krzywej kosztu: **liniowej względem rozmiaru kodu
i niezależnej od liczby użytkowników**. Każdy tydzień rozwoju to więcej tekstów do wyciągnięcia
i więcej miejsc, gdzie nowy kod wprowadzi je z powrotem.

---

## 🟡 P2 — istotne, możliwe do odłożenia

### 5.11. Brak paginacji w widokach listowych
Większość list pobiera **wszystko** i filtruje na kliencie. Nie zależy od liczby użytkowników, tylko
od jednego „ciężkiego": 5 000 zadań albo 20 000 pozycji magazynowych → wielomegabajtowa odpowiedź RSC.
**Jeden testujący magazynier wystarczy, żeby zobaczyć to na demie.**

### 5.12. Brak eksportu i usunięcia danych użytkownika
Przy 100 tys. kont w UE to **obowiązek prawny**, nie funkcja.

---

## Podsumowanie priorytetów

| # | Zagrożenie | Priorytet | Faza naprawy |
|---|-----------|-----------|--------------|
| 5.1 | Cicha utrata pracy przy współdzieleniu | 🔴 P0 | **Faza 2** |
| 5.2 | Odpytywanie co 45 s | 🔴 P0 | Faza 4 |
| 5.3 | Rate-limit per proces | 🔴 P0 | Faza 5 |
| 5.4 | Brak budżetów AI | 🔴 P0 | Faza 5 |
| 5.5 | Pula połączeń | 🔴 P0 | Faza 5 |
| 5.6 | Rozproszone współdzielenie | 🟠 P1 | **Faza 2** |
| 5.7 | Obserwowalność | 🟠 P1 | Faza 6 |
| 5.8 | Sprzężenie modułów | 🟠 P1 | **Faza 1 — rdzeń** |
| 5.9 | Retencja | 🟠 P1 | Faza 5 |
| 5.10 | i18n | 🟠 P1 | Faza 7 |
| 5.11 | Paginacja | 🟡 P2 | Faza 3 |
| 5.12 | RODO | 🟡 P2 | Faza 8 |

**Uwaga o kolejności.** 5.8 ma priorytet P1, ale naprawiane jest **jako pierwsze** — nie dlatego,
że jest najpilniejsze, tylko dlatego, że **wszystkie pozostałe naprawy są po nim tańsze**. Jednolite
współdzielenie, cache per zasób, zdarzenia domenowe i deklaratywna rejestracja wymagają istnienia
granic, do których można je przypiąć.
