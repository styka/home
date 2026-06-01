-- Raport adminowy: niezawodność wyszukiwarki internetowej w module Wiadomości
-- (budowanie bazowej bazy wiedzy) + rekomendacja klucza Brave Search.
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Wiadomości: niezawodność wyszukiwarki internetowej (Brave / DuckDuckGo)',
  'omnia-wiadomosci-wyszukiwarka-niezawodnosc',
  $omnia_news_search$# Omnia — Wiadomości: niezawodność wyszukiwarki internetowej

**Kategoria:** general · **Dotyczy:** moduł Wiadomości (`/wiadomosci`), budowanie *bazowej* bazy wiedzy

## Kontekst
Bazowa baza wiedzy o temacie powstaje, gdy z ostatnich 24 godzin nic nie znaleziono, a temat
nie ma jeszcze żadnej wiedzy z danego źródła. Wtedy moduł **doszukuje informacje w internecie**
(zamiast polegać tylko na RSS, który zawiera jedynie świeże pozycje):

1. najpierw w obrębie domeny źródła (`site:domena`) — sięga do **archiwum**, którego nie ma w RSS,
2. potem szerzej w internecie, by uzupełnić wiedzę,
3. łączy to z pozycjami RSS, dociąga treści i buduje **chronologiczny** opis stanu z osią czasu
   oraz wskazaniem ostatniej znanej informacji.

## Problem
Wyszukiwarka ma dwa tryby (`src/lib/news/webSearch.ts`):

- **Brave Search API** — używany, gdy w `Config` ustawiono `brave_search_api_key`.
- **DuckDuckGo (lite, bez klucza)** — fallback, gdy klucza brak.

**Fallback DuckDuckGo bywa zawodny z infrastruktury serwerowej.** Render (hosting produkcyjny)
korzysta z adresów IP centrum danych, a DuckDuckGo dla takich IP często zwraca pustą stronę lub
stronę z weryfikacją (rate‑limit / ochrona przed botami). Skutek: keyless‑fallback potrafi nie
zwrócić żadnych wyników, więc bazowa baza wiedzy powstaje wtedy wyłącznie z (ubogiego) RSS —
albo, gdy i RSS jest pusty, nie powstaje wcale.

> Mechanizm jest celowo **odporny na awarię**: brak wyników z wyszukiwarki nie wywala procesu —
> degraduje do trybu „tylko RSS". To znaczy, że problem objawia się jako *uboższa* baza wiedzy,
> a nie jako błąd.

## Rekomendacja
**Ustawić klucz Brave Search API**, który działa wiarygodnie również z IP serwerowni:

1. Załóż darmowy klucz na **brave.com/search/api** (tier bezpłatny ~2000 zapytań/miesiąc — z
   naddatkiem wystarcza, bo wyszukiwarka odpala się tylko przy *budowaniu bazy*, nie przy każdym
   odświeżeniu).
2. W aplikacji wejdź w **Admin → Konfiguracja systemu → „Wyszukiwarka internetowa (Wiadomości)"**
   i wklej klucz (zapisywany w `Config` pod kluczem `brave_search_api_key`, maskowany).
3. Od tej pory bazowa baza wiedzy korzysta z Brave; DuckDuckGo pozostaje jedynie awaryjnym
   fallbackiem.

## Stan obecny
- Bez klucza: działa (DuckDuckGo + RSS), ale na Render wyniki bywają puste → uboższa baza.
- Z kluczem Brave: stabilne wyszukiwanie, pełniejsza bazowa baza wiedzy z archiwum i szerszego
  internetu.

## Uwaga na przyszłość
Gdyby zależało nam na pełnej niezależności od zewnętrznych wyszukiwarek, alternatywą jest
własny indeks / płatne API (SerpAPI, Bing) — ale dla obecnej skali (jeden użytkownik, sporadyczne
budowanie bazy) **darmowy klucz Brave jest wystarczający i najtańszy**.
$omnia_news_search$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
