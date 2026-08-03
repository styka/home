# Wstęp — czym jest ten dokument

## To jest opis stanu docelowego

**Ten dokument opisuje Omnię taką, jaka ma powstać po przebudowie architektonicznej** — nie taką,
jaka jest dzisiaj. Czas teraźniejszy w rozdziałach 7–12 jest celowy: opisuje kontrakt, do którego
doprowadzamy aplikację, a nie stan zastany.

Wersja powstająca z tej przebudowy nazywa się **Omnia 🧐**.

Rozdziały dzielą się na dwie części:

| Rozdziały | Charakter | Czas |
|-----------|-----------|------|
| 2–6 | **analiza i decyzja** — punkt wyjścia, diagnoza, rozważone warianty | przeszły / teraźniejszy |
| 7–12 | **specyfikacja architektury docelowej** — jak Omnia ma działać po przebudowie | teraźniejszy (docelowy) |
| 13–14 | **plan wykonania** — fazy, kolejność, kryteria wyjścia | tryb rozkazujący |

## Dla kogo

**Właściciel** — rozdziały 2 (werdykt), 4 (diagnoza), 6 (warianty) i 13 (plan, koszty, ryzyka).
Odpowiadają na pytanie „czy to robić i co z tego wyjdzie".

**Claude Code** — rozdziały 7–14 to **instrukcja robocza**: konkretne pliki, konkretne reguły,
konkretne kryteria wyjścia. Rozdział 14 jest checklistą do odhaczania.

## Jak uruchomić tę przebudowę

Na górze czytnika jest **ikona kopiowania** (📋). Kopiuje ona cały dokument opakowany w prompt
uruchamiający **spec-driven pipeline Omnii**. Wklej go do Claude Code — pipeline rozbije przebudowę
na fazy, a każdą fazę przeprowadzi przez `/specify → /plan → /tasks → /implement → /verify →
/review` z automatycznym merge do `develop` i promocją na `master`.

**Zasada nadrzędna dla wykonawcy:** jedna faza = jeden przebieg pipeline'u. Nigdy dwie naraz.

## Warunki brzegowe, w których ta przebudowa się odbywa

| Warunek | Wartość | Konsekwencja dla architektury |
|---------|---------|-------------------------------|
| Użytkownicy dziś | 2 (testowi, w tym admin) | brak presji ruchu — okno na zmiany strukturalne |
| Produkcja najbliższa | 3–15 testerów | priorytet: wiarygodność, nie wydajność |
| Cel średni | ~100 tys. użytkowników | warstwa operacyjna musi powstać teraz |
| Cel daleki | miliony (rynki zagraniczne) | architektura ma to *umożliwiać*, nie *zawierać* |
| Zespół | 1 osoba + Claude Code | odrzucamy wszystko, co wymaga zespołu do utrzymania |
| Okno | kilka dni zamrożenia developmentu | preferujemy prace generujące konflikty scaleń |
| Stan repo | 147 modeli, 545 akcji, 21 modułów, 90 plików testów | to nie jest prototyp — to działający system |

## Trzy rzeczy, które ten dokument koryguje względem wcześniejszych analiz

Poprzedni raport (`omnia-architektura-zdarzeniowa-cofanie-live`) i jego rozwinięcie zawierały dwa
błędy, które ten dokument prostuje wprost — bo dokument, który nie przyznaje się do zmienionej
przesłanki, jest bezużyteczny przy następnej decyzji.

1. **„Omnia jest systemem w praktyce jednoosobowym"** — nieprawda. Opisywało stan dzisiejszy,
   nie docelowy.
2. **„Dane Omnii są prywatne per użytkownik, więc współbieżność nie występuje"** — **fałszywe
   uogólnienie i najpoważniejszy błąd tamtych analiz.** W Omnii praktycznie każdy zasób ma sens
   udostępniać — projekt zadań, notatkę, listę zakupów, zwierzę, przepis. Współpraca jest częścią
   produktu, a nie wyjątkiem. Rozdział 5 rozbiera to na czynniki pierwsze i pokazuje, co z tego
   naprawdę wynika (a co nie).
3. **„Odpytywanie co 45 s to drobiazg do optymalizacji"** — przy 100 tys. użytkowników **i** przy
   współdzielonych zasobach to jednocześnie zagrożenie wydajnościowe i wada produktowa.

## Czego ta przebudowa nie obejmuje

Świadomie, z uzasadnieniem w rozdziale 13:

- **nowych funkcji dla użytkownika** — ani jednej; wartością tej wersji jest fundament;
- **tłumaczeń na inne języki** — powstaje *możliwość*, nie zawartość;
- **shardingu, replik geograficznych, wielu regionów** — to Próg C (miliony);
- **zmiany frameworka** — Next.js App Router pozostaje.
