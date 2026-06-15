# Rozdział 9 — Wydajność i skalowalność (do 100M)

## Kontekst / stan z kodu

- **Strony list ładują całość.** Akcje `get*` zwracają komplet rekordów użytkownika (zadania,
  notatki, pozycje), a komponenty `*Page.tsx` renderują je naraz — **brak paginacji i wirtualizacji**.
  Działa świetnie dla 50–500 rekordów; degraduje się liniowo powyżej.
- **Agregator kalendarza** (`src/lib/calendar.ts` + `actions/calendar.ts`) odpytuje równolegle wiele
  modułów (`Promise.all`) — to dobry wzorzec, ale skanuje pełne zbiory per moduł.
- **Pulpit Home** (`TodaySnapshot`, ~755 linii) ciągnie dane z wielu modułów na każdym wejściu.
- **Brak warstwy cache** (poza cache Next dla tras). Zapytania trafiają do bazy za każdym razem.
- **Hosting:** Render free tier — **usypia po 15 min**, zimny start ~10–15 s; jedna mała instancja.
  Neon free tier — limit połączeń (patrz pooling, Rozdz. 7).
- **Brak paginacji w API LLM** i ciężkie operacje (OCR, plan tygodnia) wykonywane **synchronicznie**
  w żądaniu (ryzyko timeoutów i blokad).

## Głos Zespołu A — Strażnicy

**Piotr (SRE):** „Dwie liczby decydują o przeżyciu: **czas odpowiedzi** i **koszt na użytkownika**.
Dziś przy 50 userach obie są nieistotne. Ale »ładuj wszystko« + »free tier« + »brak cache« to trzy
mnożniki, które przy fali marketingowej dają **kaskadę**: wolne zapytania → długie połączenia →
wyczerpana pula → 503. Zimny start free tier doda do tego 15 s na pierwszym wejściu — zabójcze dla
konwersji.”

**Katarzyna (analityk):** „Trzeba **zmierzyć**, zanim zoptymalizujemy. Ale kierunek jest pewny:
paginacja list to **P0 operacyjne** — nie dlatego, że dziś boli, lecz dlatego, że jest warunkiem, by
ruch w ogóle dało się obsłużyć.”

**Marek (DBA):** „Paginacja bez indeksów (Rozdz. 7) to nadal full-scan z `LIMIT`. Kolejność: **najpierw
indeksy (Z-030), potem paginacja (keyset/cursor), potem cache** najgorętszych odczytów (pulpit).”

## Głos Zespołu B — Pionierzy

**Sandra (architekt):** „Nie budujmy Netfliksa dla 50 osób. Ale **paginacja i »załaduj więcej«** to
tani, lokalny refaktor, który robimy raz i mamy spokój — zróbmy go. Wirtualizację list zostawmy na
moduły, gdzie realnie pojawią się tysiące rekordów (zadania, magazyn).”

**Kamil (DevOps):** „Free tier to **świadomy wybór na etap odkrywania**. Plan skali jest prosty i nie
trzeba go budować teraz, wystarczy **mieć rozpisany**: Render hobby/standard (bez usypiania) → Neon
płatny z poolingiem → CDN dla statyki → kolejka dla ciężkich zadań AI. Przeskakujemy progi, gdy ruch
faktycznie rośnie, nie na zapas.”

**Weronika (DBA):** „Cache pulpitu i agregatów (np. 30–60 s TTL) da **natychmiastowy** efekt odczuwalny
przez użytkownika i zdejmie z bazy najcięższe, powtarzalne zapytania. Tani zysk.”

## Punkty sporne

- **Optymalizować teraz vs po pomiarze.** **Konsensus:** paginacja list + indeksy = robimy *proaktywnie*
  (warunek obsługi ruchu); resztę (wirtualizacja, sharding) — *reaktywnie* po metrykach.
- **Free tier: trzymać czy uciekać.** **Konsensus:** trzymać do pierwszej realnej fali; mieć **gotowy,
  rozpisany** plan migracji progowej (Z-082), by przeskok zajął godziny, nie dni.
- **Ciężkie AI: synchronicznie vs kolejka.** **Konsensus:** wprowadzić **trwałą kolejkę** dla OCR/planu
  tygodnia (Rozdz. 12) — i wydajnościowo, i kosztowo.

## Głos użytkowników

**Zofia (16):** „Jak coś się ładuje dłużej niż sekundę, zamykam.” → percepcja szybkości to retencja;
zimny start i „ładuj wszystko” uderzają najpierw w najmłodszych, mobilnych.

**Helena (68):** „U mnie się długo otwiera.” → wolny pierwszy render (zimny start) wyklucza mniej
cierpliwych; wydajność to też dostępność.

## Konsensus i zalecenia

- **Z-070** *(P0 · M)* — **Paginacja/keyset (cursor) dla wszystkich list ładujących całość** (zadania,
  notatki, zakupy, magazyn, usługi) + UI „załaduj więcej”/strony. Warunek obsługi ruchu przy skali.
- **Z-071** *(P1 · M)* — **Wirtualizacja długich list** (np. `@tanstack/virtual`) dla modułów z
  potencjałem tysięcy rekordów (zadania, magazyn, kontakty).
- **Z-072** *(P1 · M)* — **Cache najgorętszych odczytów** (pulpit Home, agregat kalendarza) z krótkim
  TTL i inwalidacją przy mutacji; rozważyć `unstable_cache`/warstwę KV przy skali.
- **Z-073** *(P1 · S)* — **Eliminacja N+1** w agregatorach (kalendarz, pulpit) — `include`/`select`
  zamiast pętli zapytań; pomiar EXPLAIN (Z-037).
- **Z-074** *(P1 · M)* — **Trwała kolejka dla ciężkich operacji AI** (OCR, plan tygodnia, analizy)
  zamiast pracy synchronicznej w żądaniu (szczegóły Rozdz. 12).
- **Z-075** *(P1 · S)* — **Wyjść z usypiającego free tier przed marketingiem** (Render bez sleep) —
  zimny start 15 s zabija konwersję pierwszej fali.
- **Z-076** *(P2 · M)* — **CDN/edge dla statyki i ikon** (PWA, obrazy) + nagłówki cache.
- **Z-082** *(P1 · S)* — **Rozpisać progowy plan skalowania infrastruktury** (50 → 1k → 10k → 100k →
  1M → 100M): co i kiedy włączamy (hosting, pooling, repliki, kolejka, CDN). Patrz Rozdz. 10 i 44.
- **Z-083** *(P2 · M)* — **Budżety wydajności** (np. czas TTFB, rozmiar payloadu list) mierzone i
  pilnowane, by regres był widoczny.

## Dobre vs złe praktyki

**Dobre:**
- Agregaty równoległe (`Promise.all`) zamiast sekwencyjnych zapytań.
- Stany ładowania (`loading.tsx` w 21 modułach) — dobra percepcja podczas oczekiwania.
- Świadomy wybór free tier na etap odkrywania (oszczędność, gdy ruchu nie ma).

**Złe / do poprawy:**
- „Ładuj wszystko” bez paginacji/wirtualizacji — liniowa degradacja przy skali (P0).
- Brak warstwy cache dla powtarzalnych, ciężkich odczytów (pulpit, kalendarz).
- Ciężkie operacje AI synchronicznie w żądaniu — ryzyko timeoutów i kosztów.
- Usypiający free tier jako stan na moment startu marketingu.
