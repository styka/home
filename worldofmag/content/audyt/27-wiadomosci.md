# Rozdział 27 — Wiadomości (News + baza wiedzy)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/news.ts` (854 linie); modele `NewsSource`, `NewsTopic`, `NewsKnowledge`
  (wersjonowana baza wiedzy `@@unique[topicId, sourceId, version]`), `NewsItem` (dedup po URL), `NewsPref`.
- **Funkcje:** RSS + **filtrowanie LLM** (semantyczne tematy), per-temat/per-źródło **wersjonowana baza
  wiedzy**, web-search baseline (`src/lib/news/webSearch.ts`, Brave→DDG), hot topics, świeżość 24 h.

## Mocne strony

- **Wersjonowana baza wiedzy** — nie tylko czytnik RSS, ale narastający, wersjonowany zasób.
- **Filtrowanie LLM + web-search** z fallbackiem (Brave→DDG) i graceful degradation.

## Głos Zespołu A — Strażnicy

**dr Natalia (AI/ML):** „To moduł **sieciowo- i tokenowo-ciężki**: RSS, web-search, filtrowanie LLM.
Koszt rośnie z liczbą tematów/userów. Bez **cache** (Z-132) i limitów to droga pozycja w rachunku AI.
Plus zależność od sieci (Brave/DDG) — pilnować degradacji.”

**Anna (security):** „Treści zewnętrzne (RSS/web) renderowane userowi — przez bezpieczny renderer (OK),
ale pilnować linków/obrazów z niezaufanych źródeł.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „**Baza wiedzy to paliwo SEO** (Z-531): wersjonowane, narastające treści per temat to
gotowy content marketing. Plus AI: »streść mi dzień«, »co nowego w temacie X« — briefing tematyczny.”

## Punkty sporne

- **Ile automatycznego pobierania.** **Konsensus:** ograniczać częstotliwość/liczbę tematów dla
  darmowych (koszt), więcej w premium; cache agresywnie.

## Głos użytkowników

**Marek (29):** „Briefing tematyczny »co nowego w AI« codziennie rano — tak.”

## Konsensus i zalecenia

- **Z-320** *(P1 · M)* — **Cache + limity pobierania/LLM** dla tematów (Z-132/Z-130) — kontrola kosztu sieci/tokenów.
- **Z-321** *(P1 · S)* — **Twarda degradacja przy braku sieci** (Brave/DDG/RSS) — czytelny stan, nie błąd.
- **Z-322** *(P2 · M)* — **Baza wiedzy → treści SEO** (Z-531) — wykorzystać narastający content do akwizycji.
- **Z-323** *(P2 · S)* — **Briefing tematyczny AI** („co nowego w temacie X”).

## Dobre vs złe praktyki

**Dobre:** wersjonowana baza wiedzy, filtrowanie LLM, web-search z fallbackiem.
**Złe / do poprawy:** wysoki koszt sieci/tokenów bez agresywnego cache i limitów; niewykorzystany content do SEO.
