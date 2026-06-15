# Rozdział 4 — Dwa zespoły: skład i charaktery

Cały audyt jest prowadzony jako debata **dwóch kompletnych zespołów**. Ten rozdział przedstawia ich
skład — to „dramatis personae”, do których odwołują się kolejne rozdziały. Oba zespoły są
profesjonalne, doświadczone i nastawione na świetny UX. Różni je **temperament**, nie kompetencje.

> **Po co aż tylu ludzi?** Bo realny projekt na tę skalę wymaga każdej z tych ról — od pierwszego
> spotkania, przez wdrożenie, aż do pół roku życia na produkcji przy rosnącym ruchu. Symulując pełną
> obsadę, wyłapujemy ryzyka i pomysły, które w pojedynczej głowie by nie powstały.

---

## Zespół A — „Strażnicy Jakości”

Perfekcjoniści. We wszystkim szukają ryzyka, długu i luk. Ich pytanie przewodnie: **„Co może pójść
nie tak — i jak to udźwignie 100 milionów użytkowników?”**

| Rola | Osoba | Wiek | Charakter |
|---|---|---|---|
| Product Owner | Barbara „Basia” Wójcik | 44 | Dyscyplina zakresu. Mówi „nie” funkcjom bez uzasadnienia metrykami. |
| Architekt | dr inż. Tomasz Lewandowski | 51 | Pryncypia i granice modułów. Alergiczny na skróty „na teraz”. |
| Senior Developer / Tech Lead | Michał Zawadzki | 38 | „Działające ≠ skończone”. Czytelność, testy, brak magii. |
| Tester / QA | Ewa Kaczmarek | 33 | Myśli przypadkami brzegowymi. Kocha checklisty i scenariusze negatywne. |
| UX Designer | Joanna „Aśka” Nowak | 35 | Spójność i redukcja tarcia. Każdy klik musi mieć powód. |
| Grafik / UI | Rafał Sikora | 29 | Pixel-perfect, dyscyplina tokenów, obsesyjnie pilnuje kontrastu. |
| Analityk (biznes/dane) | Katarzyna Mazur | 41 | „Pokaż dane”. Bez liczby nie ma decyzji. |
| Delivery Manager | Grzegorz Pawlak | 47 | Ryzyka, zależności, realne terminy. Wróg optymizmu w estymatach. |
| Security Engineer | Anna Dąbrowska | 39 | Model zagrożeń, najmniejszy przywilej, RODO jako domyślny tryb myślenia. |
| DevOps / SRE | Piotr Górski | 36 | SLO i budżet błędów. Pyta „co się stanie o 3 w nocy”. |
| DBA / Data Engineer | Marek Kowalczyk | 49 | Indeksy, plany zapytań, migracje bez downtime. Nie ufa ORM-owi na słowo. |
| AI/ML Engineer | dr Natalia Wiśniewska | 34 | Koszty tokenów, ewaluacja jakości, polowanie na halucynacje. |
| Growth / Marketing | Łukasz Adamski | 40 | Pozycjonowanie tak, ale „nie obiecuj, czego produkt nie ma”. |

**Użytkownicy testowi Zespołu A**
- **Helena, 68** — emerytka, mało techniczna. Ceni prostotę, duże fonty, brak niespodzianek.
- **Krzysztof, 52** — właściciel małego warsztatu samochodowego. Chce konkretów, nie znosi „bajerów”.
- **Zofia, 16** — uczennica. Szybka, wyłącznie mobilna, niecierpliwa wobec wolnego UI.

---

## Zespół B — „Pionierzy”

Ułańska fantazja i ciekawe pomysły. Ich pytanie przewodnie: **„A co gdyby — i jak zachwycić
użytkownika, zanim zrobi to konkurencja?”**

| Rola | Osoba | Wiek | Charakter |
|---|---|---|---|
| Product Owner | Wojciech „Wojtek” Krawczyk | 31 | Wizjoner. Lubi śmiałe zakłady produktowe i szybkie odkrywanie. |
| Architekt | Sandra Jabłońska | 37 | Pragmatyczka. „Wystarczająco dobre” dziś bije „idealne” za rok. Ewolucja > rewolucja. |
| Senior Developer / Tech Lead | Damian Wróbel | 33 | Szybkie prototypy, feature flags, „ship and iterate”. |
| Tester / QA | Bartosz Lis | 28 | Automatyzacja. Testy mają być siatką bezpieczeństwa, nie kajdanami. |
| UX Designer | Ola Sokołowska | 30 | Zachwyt i mikrointerakcje. „Radość użytkowania” jako metryka. |
| Grafik / UI | Kuba Mróz | 26 | Śmiały wizualnie, branding, motywy, charakter marki. |
| Analityk (biznes/dane) | Patryk Zięba | 32 | Eksperymenty A/B, growth, „zmierzymy w boju”. |
| Delivery Manager | Magda Sobczak | 39 | Tempo i MVP. „Lepiej wypuszczone niż idealne w szufladzie”. |
| Security Engineer | Sebastian Duda | 35 | Security adekwatne do etapu — solidne, ale bez paraliżu. |
| DevOps / SRE | Kamil Baran | 34 | Infrastruktura jako kod, automatyzacja, „skalujmy, gdy faktycznie trzeba”. |
| DBA / Data Engineer | Weronika Pawłowska | 30 | Denormalizacja i cache dla szybkości, gdy to się opłaca. |
| AI/ML Engineer | dr Hubert Stefański | 38 | Agent-first. „Niech AI robi nudną robotę za użytkownika”. |
| Growth / Marketing | Nina Kowal | 27 | Viral, social, storytelling. „Opowiedzmy historię, nie listę funkcji”. |

**Użytkownicy testowi Zespołu B**
- **Marek, 29** — freelancer, early adopter. Kocha nowości i integracje (kalendarz, e-mail, AI).
- **Agnieszka, 38** — mama dwójki dzieci. Organizuje całą rodzinę; kluczowe są współdzielenie i kalendarz.
- **Tadeusz, 60** — przedsiębiorca prowadzący małą gastronomię. Myśli kosztami i ROI każdej funkcji.

---

## Obsada cyklu życia (poza dwoma zespołami)

Od pomysłu do „pół roku na produkcji” potrzeba też ról, które nie biorą udziału w każdej debacie
technicznej, ale są niezbędne, by produkt **przeżył i urósł**. Pojawiają się w rozdziałach
biznesowych (Część IV) i w planach wdrożeniowych (Dodatek A):

- **Customer Support Lead** — pierwsza linia kontaktu, zamienia zgłoszenia w backlog.
- **Community Manager** — buduje społeczność, zbiera feedback, moderuje.
- **Radca prawny / RODO (DPO)** — zgodność, polityka prywatności, umowy powierzenia, retencja.
- **Księgowość / Finanse** — rozliczenia, podatki, prognozy cash-flow, faktury (także B2B).
- **Sprzedaż B2B** — dla podaplikacji branżowych (gastronomia, hodowla, flota firmowa).
- **Content / SEO** — treści, baza wiedzy, pozyskiwanie ruchu organicznego.
- **Specjalista ds. płatności / billing** — bramki płatnicze, faktury, zarządzanie subskrypcjami.

---

## Jak zespoły rozmawiają w tym dokumencie

W każdym rozdziale **nie wszyscy** zabierają głos — tylko osoby istotne dla tematu (np. w rozdziale o
bazie danych dominują DBA, architekci i SRE; w rozdziale o marketingu — growth, PO i analitycy).
Użytkownicy wchodzą tam, gdzie decyzja realnie ich dotyka. Dzięki temu debaty są **skupione**, a nie
chóralne.

Reguła rozstrzygania sporów: **Strażnicy mają prawo weta wobec ryzyk P0** (bezpieczeństwo, dane,
zgodność), **Pionierzy mają inicjatywę w odkrywaniu** (eksperymenty, MVP, kolejność funkcji). Tam,
gdzie konsensus jest niemożliwy, zapisujemy obie opcje i rekomendację z uzasadnieniem — to też bywa
cenniejsze niż sztuczna jednomyślność.
