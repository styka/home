# Rozdział 3 — Realna ocena etapu projektu

> Ten rozdział ma być **uczciwy**, nie pochlebny. Strażnicy Jakości pilnują, by nie pomylić
> „funkcjonalnie kompletne” z „gotowe na produkcję dla milionów”.

## Jednozdaniowa diagnoza

Omnia jest **dojrzałym produktowo MVP+ jednego, bardzo wydajnego twórcy**: szerokość funkcji jak u
dojrzałego zespołu, ale **głębokość operacyjna (skala, observability, monetyzacja, zgodność prawna,
testy) jest na wczesnym etapie**. To projekt po „**Fazie 3 — domknięcia funkcjonalne**”, u progu
„**Fazy 4 — skala, monetyzacja, branże**”.

## Twarde metryki (2026-06-14)

| Metryka | Wartość | Interpretacja |
|---|---|---|
| Modele Prisma | ~130 | Bardzo szeroki model danych (10+ domen) |
| Migracje | ~196 | Intensywna, systematyczna ewolucja |
| Katalogi tras | ~34 | Pełna nawigacja wielomodułowa |
| Pliki akcji serwerowych | ~57 | Scentralizowana warstwa mutacji |
| Komponenty React | ~227 | Pokaźna biblioteka UI |
| Testy jednostkowe | ~42 | **Start** pokrycia (srs, recurrence, sloty, geo…) |
| Testy E2E | szkielet (Playwright) | Istnieje, ale nie jako bramka CI |

## Co jest naprawdę mocne

- **Spójność architektury** — jeden wzorzec mutacji, własność 3-poziomowa, RBAC, DB-driven LLM.
- **Bezpieczeństwo podstaw** — szyfrowanie kluczy API (AES-256-GCM), audyt RBAC/config, strażnik
  samo-wykluczenia admina, maskowanie sekretów.
- **AI realnie użyteczne** — agent czyta i modyfikuje wszystkie moduły, z przeglądem akcji,
  odwracalnością (kosz) i transparentnością kosztu (model + tokeny).
- **Higiena procesu** — strażniki w buildzie (pokrycie akcji AI, numeracja migracji), raporty
  implementacyjne per zmiana, dziennik „doświadczeń”.
- **UX power-usera** — skróty, paleta poleceń, skórki, personalizacja pulpitu i menu.

## Co jest realnym ryzykiem (luki etapu)

1. **Skala bazy/aplikacji nieudowodniona** — listy ładujące całość bez paginacji/wirtualizacji;
   brak read-replik, poolingu, indeksów pod zapytania wielodostępne. (Rozdz. 7, 9)
2. **Observability szczątkowa** — `/admin/health` to początek; brak logów strukturalnych, metryk,
   tracingu, alertów (Sentry odłożony). (Rozdz. 10)
3. **Koszty AI niekontrolowane w skali** — rate-limit i strażnik współbieżności są **in-memory**;
   brak trwałej kolejki, cache odpowiedzi, monitoringu kosztów, fallbacku modeli. (Rozdz. 12)
4. **Zgodność prawna** — brak eksportu danych RODO i twardego usunięcia konta (wymóg prawny przy
   publicznych użytkownikach). (Rozdz. 8)
5. **Testy jako bramka** — 42 testy to start; E2E nie pilnuje regresji w CI. (Rozdz. 14)
6. **Jednolitość UI** — sporo inline-style zamiast design-systemu; niepełne stany błędów/pustych;
   a11y nieaudytowane; brak i18n. (Rozdz. 11)
7. **Monetyzacja = 0** — świadomie odłożona; ale bez niej nie ma „skali biznesowej”. (Rozdz. 42–44)
8. **Hosting free-tier** — usypianie, brak SLA; nie udźwignie ruchu marketingowego. (Rozdz. 10)

## Macierz dojrzałości modułów

Skala: **0** brak · **1** szkielet · **2** działa, wąsko · **3** dojrzałe (rdzeń) · **4** dojrzałe +
zaawansowane · **5** klasy produkcyjnej dla wielu użytkowników.
„Skala?” = czy moduł jest gotowy na masowy ruch bez przeróbek (✅/⚠️/❌).

| Moduł | Dojrzałość | Skala? | Uwaga |
|---|:---:|:---:|---|
| Home / Asystent AI | 4 | ⚠️ | Bogaty; koszt/kolejki AI to ryzyko skali |
| Zakupy | 4 | ⚠️ | Dojrzałe; brak DnD i realtime; listy bez paginacji |
| Zadania | 4 | ⚠️ | Kanban/Timeline/cykliczność; brak zależności blocked-by |
| Notatki | 4 | ⚠️ | Wikilinki/wersje/załączniki; wyszukiwanie nie pełnotekstowe DB |
| Kuchnia | 4 | ⚠️ | Bogate; import AI/OCR; zależne od kosztów LLM |
| Zwierzęta | 4 | ⚠️ | Genetyka/alarmy/eksport; najbliżej branży „Hodowca” |
| Zdrowie + Leki | 4 | ⚠️ | Repozytorium badań + trendy; dane wrażliwe → RODO |
| Nawyki | 3 | ✅ | Solidny rdzeń, lekki |
| Flota | 3 | ✅ | Pojazdy/paliwo/serwis/załączniki; brak TCO |
| Portfel | 4 | ⚠️ | Budżety/wielowaluta/auto-wydatki; import banku brak |
| Języki | 4 | ✅ | SRS/TTS/pisanie; samowystarczalny |
| Wiadomości | 3 | ⚠️ | RSS+LLM+web-search; zależne od sieci i kosztów |
| Pogoda | 3 | ✅ | Open-Meteo + LLM; tanie |
| Magazynowanie | 4 | ⚠️ | Dom/Pro, OCR, FEFO; ciężkie operacje AI |
| Warsztaty | 3 | ✅ | Dom/Pro, katalog statyczny |
| Usługi (Marketplace) | 4 | ❌ | Bardzo bogate; marketplace = własna gra skali, płatności, sporów |
| Kontakty / CRM | 2 | ✅ | Lekki, świadomie minimalny |
| Kalendarz | 3 | ⚠️ | Agregat wielu modułów; brak integracji Google Calendar |
| Powiadomienia | 3 | ⚠️ | Bez crona; brak web-push na żywo, niepełne źródła |
| Kosz / Undo | 3 | ✅ | Solidny wzorzec soft-delete |
| Skórki | 4 | ✅ | Dojrzałe, walidowane |
| Raporty | 3 | ✅ | DB/Drive; brak eksportu PDF |
| QA | 2 | ✅ | Narzędzie wewnętrzne |
| Truck | 1 | ❌ | Klient ORS gotowy, UI szkieletowy |
| Praca / Work | 0 | — | Stub |
| Panel Admina | 4 | ✅ | RBAC/audyt/health/LLM/docs — bogaty |

**Czytanie macierzy:** większość modułów jest na poziomie **3–4** (działają, często z zaawansowanymi
opcjami), ale kolumna „Skala?” pełna jest ⚠️ — bo **dojrzałość funkcjonalna ≠ gotowość na masę**.
Wąskie gardła skali są **przekrojowe** (baza, AI-koszty, observability, hosting), nie modułowe — i
dlatego najwięcej zaleceń P0 trafi do Części II, nie III.

## Stanowiska zespołów (skrót)

**Strażnicy (Basia, Tomasz, Anna, Piotr):** „To świetne MVP, ale nazywanie tego »gotowym na 100M«
byłoby nieuczciwe. Zanim ruszy marketing, musimy mieć: RODO, paginację, kontrolę kosztów AI, plan
hostingu i bramkę testów. Inaczej pierwsza fala użytkowników nas przewróci.”

**Pionierzy (Wojtek, Sandra, Damian, Hubert):** „Zgoda co do listy, ale nie zamrażajmy produktu na
pół roku »hardeningu«. Większość tych rzeczy wdraża się **etapami i pod feature-flagami**. Ruszajmy z
małą grupą, mierzmy realny ruch i skalujmy to, co faktycznie boli — a nie wszystko naraz »na zapas«.”

**Konsensus:** etap to **»dojrzałe MVP przed twardą Fazą 4«**. Kolejność: najpierw **fundament
bezpieczeństwa i kosztów** (P0 z Części II), równolegle **pierwsza monetyzacja i jedna branża** jako
dowód modelu — wszystko etapami, mierząc realny ruch. Szczegóły: Dodatek A.
