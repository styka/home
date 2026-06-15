# Rozdział 43 — Strategia podaplikacji branżowych

## Kontekst

Sedno wizji właściciela: **podaplikacje na życzenie małego biznesu — tanio dzięki AI — a potem
pogłębiane do potrzeb większego klienta**. Klucz: większość branżowych „nakładek” **wyrasta z modułów,
które już mamy**, więc koszt krańcowy nowej branży jest niski (reużywamy własność, RBAC, AI, kalendarz,
płatności). Wzorzec techniczny istnieje: **feature-flags/presety** (jak w module Pets:
`Pet.presetKey`/`featureFlags`).

## Głos Zespołu A — Strażnicy

**dr inż. Tomasz (architekt):** „»Tanio dzięki AI« jest prawdą, ale nie magią — każda branża to
**własna domena, walidacja, słownik i przypadki brzegowe**. Nie obiecujmy »dowolnej branży w tydzień«.
Zróbmy **jedną** porządnie, jako wzorzec (szablon nakładki), i dopiero replikujmy.”

**Katarzyna (analityk):** „Priorytetyzujmy po trzech osiach: **bliskość gotowości × wielkość rynku ×
ARPU/gotowość do płacenia**. Hodowca (z Pets) jest najbliżej gotowości i ma wysokie ARPU w niszy. To
oczywisty pierwszy kandydat.”

**Anna (security):** „Branże B2B = dane firmowe + faktury + czasem dane klientów wykonawcy. Każda
nakładka dziedziczy nasze wymogi RODO i dokłada własne (np. alergeny w gastro to bezpieczeństwo
żywności).”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „To jest **nasza droga do miliardów**: SaaS branżowy dla małych firm, których nie stać
na dedykowane systemy. Każda nakładka to nowy rynek przy **wspólnym rdzeniu**. Strategia: **»land« darmową
podstawą (organizacja), »expand« płatną głębią branżową**.”

**Sandra (architekt):** „Zbudujmy **silnik nakładek** raz: preset = (zestaw modułów + pola + słowniki +
domyślne AI-prompty + szablony). Wtedy nowa branża to **konfiguracja, nie nowy kod**. Pets już
udowodnił wzorzec — uogólnijmy go.”

**Hubert (AI/ML):** „AI obniża koszt **wejścia w branżę**: generujemy słowniki, szablony, walidacje,
onboarding pod daną branżę. »Powiedz, czym się zajmujesz« → AI konfiguruje nakładkę. To jest realny
»tanio dzięki AI«.”

**Nina (growth):** „Każda branża ma **własną społeczność** (grupy FB hodowców, forów gastro). To tanie,
celowane kanały marketingowe — wchodzimy tam z konkretnym rozwiązaniem, nie ogólną apką.”

## Punkty sporne

- **Silnik nakładek teraz vs po drugiej branży.** **Konsensus:** zrobić **pierwszą branżę ręcznie**
  (Hodowca), wyabstrahować silnik **przy drugiej** (gdy widać, co się powtarza) — uniknięcie
  przedwczesnej abstrakcji.
- **Ile branż naraz.** **Konsensus:** **jedna na raz**, do dojrzałości i pierwszych płacących, potem
  następna. Rozpraszanie zabije jakość.

## Tabela priorytetyzacji verticali

| Vertical | Wyrasta z | Bliskość gotowości | Rynek | ARPU | Priorytet |
|---|---|:---:|:---:|:---:|:---:|
| **V1 Hodowca** | Pets (genetyka/lęgi/sprzedaż) | wysoka | nisza | wysoki | **1** |
| **V2 Gastronomia** | Kitchen (food cost/menu/alergeny) | średnia | duży | średni/wysoki | 2 |
| **V3 Flota B2B** | Flota + Truck | średnia | duży | wysoki | 3 |
| **V5 Rolnictwo/ogród** | Pogoda + recurrence + pomiary | niska | średni | średni | 4 |
| Warsztat Pro | Warsztaty (już Dom/Pro) | wysoka | duży | średni | rozważyć |
| Magazyn Pro | Magazynowanie (już Dom/Pro) | wysoka | duży | średni | rozważyć |

> Uwaga: Warsztat i Magazyn **już mają tryb Pro** — to potencjalnie najszybsze „pół-branże” do
> domknięcia komercyjnego, równolegle do Hodowcy.

## Głos użytkowników

**Tadeusz (60, gastronomia):** „Dajcie mi food cost, kalkulację menu, alergeny i zamówienia do
dostawców — w jednym, taniej niż osobne systemy. Zapłacę miesięcznie.” → V2 ma realny popyt i ARPU.

**Krzysztof (52, warsztat):** „Warsztat Pro z przeglądami i magazynem części — to bym kupił.” → tryb Pro
warsztatu/magazynu jako szybka komercjalizacja.

## Konsensus i zalecenia

- **Z-490** *(P1 · L)* — **V1 Hodowca jako pierwsza branża** (rozwinięcie Pets: rodowody, lęgi,
  sprzedaż, certyfikaty, koszty/ROI hodowli). Najbliżej gotowości, wysoki ARPU. Dowód modelu „expand”.
- **Z-491** *(P2 · L)* — **Po Hodowcy wyabstrahować „silnik nakładek”** (preset = moduły + pola +
  słowniki + AI-prompty + szablony), uogólniając wzorzec Pets. Wtedy kolejne branże = konfiguracja.
- **Z-492** *(P1 · M)* — **Skomercjalizować istniejące tryby Pro** (Warsztat Pro, Magazyn Pro) jako
  najszybsze „pół-branże” — domknięcie funkcji premium + bramkowanie planem.
- **Z-493** *(P2 · L)* — **V2 Gastronomia** (food cost, kalkulacja menu, alergeny, zamówienia) — duży
  rynek, realny popyt; po Hodowcy lub równolegle, jeśli zasoby pozwolą.
- **Z-494** *(P2 · M)* — **Onboarding branżowy z AI** („powiedz, czym się zajmujesz” → AI konfiguruje
  nakładkę: słowniki, szablony, walidacje) — realizacja „tanio dzięki AI”.
- **Z-495** *(P2 · L)* — **V3 Flota B2B** (wiele pojazdów, kierowcy, trasowanie ORS, przeglądy
  regulacyjne) — łączy Flotę i Truck; wysoki ARPU, większa złożoność.

## Dobre vs złe praktyki

**Dobre:**
- Wzorzec presetów/feature-flags (Pets) już udowodniony — realna baza pod nakładki branżowe.
- Dwa moduły (Warsztat, Magazyn) już mają tryb Pro — szybka ścieżka do pierwszych płacących.
- Wspólny rdzeń (własność, RBAC, AI, kalendarz, płatności) = niski koszt krańcowy nowej branży.

**Złe / do poprawy:**
- Ryzyko rozproszenia (wiele branż naraz) — zabójcze dla jakości; trzymać „jedna na raz”.
- Pokusa przedwczesnego „silnika nakładek” przed poznaniem realnych różnic między branżami.
- Obietnice „dowolna branża błyskawicznie” — każda domena ma własną głębię i wymogi.
