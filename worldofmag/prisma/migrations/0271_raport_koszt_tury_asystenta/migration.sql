-- 112 — RAPORT: ROZBICIE RACHUNKU ZA TURĘ ASYSTENTA.
--
-- Odpowiedź na zgłoszenie właściciela „czemu taka prosta operacja kosztowała 30 groszy? czy to błąd
-- twojego liczenia czy coś działa nie optymalnie?". Raport podaje sposób liczenia, przelicza obie
-- zmierzone sesje na cenniku z bazy i mówi wprost, że wycena była POPRAWNA — nieoptymalne było
-- zużycie. Stoi w aplikacji, a nie tylko w rozmowie, bo pytanie „czy kwota jest policzona dobrze"
-- wróci przy każdej kolejnej drogiej turze.
--
-- Migracja NIE zmienia kształtu bazy: jeden `INSERT` z `ON CONFLICT DO NOTHING` (C-14).
-- Treść nie zawiera żadnego sekretu ani adresu bazy (C-41).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "storage", "authorId", "teamId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Asystent — za co płacimy w jednej turze',
  'asystent-koszt-tury-rozbicie',
  $koszt_tury$# Asystent — za co płacimy w jednej turze

Właściciel zapytał wprost: **„czemu taka prosta operacja kosztowała 30 groszy? czy to błąd twojego
liczenia, czy coś działa nieoptymalnie?"**

Odpowiedź brzmi: **to nie był błąd liczenia.** Obie zmierzone kwoty zgadzają się co do czwartego
miejsca po przecinku. Nieoptymalne było **zużycie** — i to właśnie naprawił przebieg 112.

---

## 1. Jak liczymy koszt

Koszt tury to suma **wszystkich** wywołań modelu, jakie ta tura wykonała. Każde wywołanie ma cztery
składniki, wyceniane osobno (`estimateCost`, cennik w `LlmModelPrice`, edytowalny w `/admin/llm`):

| Składnik | Co to jest | Cena |
|---|---|---|
| wejście | tokeny promptu **nie** pobrane z pamięci podręcznej | stawka wejściowa modelu |
| wyjście | tokeny odpowiedzi, **w tym tokeny myślenia** | stawka wyjściowa (zwykle 5× wyższa) |
| zapis do pamięci | prefiks promptu zapisany do pamięci podręcznej | **1,25×** stawki wejściowej |
| odczyt z pamięci | prefiks odczytany zamiast przesłany | **0,1×** stawki wejściowej |

Dwie rzeczy, które najczęściej budzą podejrzenie o podwójne liczenie — a go nie ma:

- **Tokeny z pamięci podręcznej nie są liczone dwa razy.** Dostawca raportuje wejście *bez* tokenów
  cache, a my zapisujemy dokładnie tę wartość. Wejście, zapis i odczyt to rozłączne zbiory.
- **Wysiłek modelu nie zmienia ceny za token** — podnosi *liczbę* tokenów wyjścia, bo myślenie jest
  rozliczane jako wyjście. Rachunek już to uwzględnia.

Model spoza cennika daje **„koszt nieznany"**, nigdy „0 zł".

## 2. Sesja „30 groszy" — rachunek co do grosza

Jedno zdanie użytkownika, jeden krok asystenta. Trzy wywołania modelu:

| Wywołanie | Model | Wejście | Wyjście | Zapis cache | Koszt |
|---|---|---|---|---|---|
| rozpoznanie intencji | Haiku 4.5 | 1 373 | 494 | — | $0,0038 |
| wybór modułów | Haiku 4.5 | 648 | **1 326** | — | $0,0073 |
| właściwa odpowiedź | Sonnet 5 | **19 446** | 468 | 1 276 | $0,0701 |
| **razem** | | | | | **$0,0813** |

Aplikacja pokazała **$0,0813**. Rachunek się zgadza.

Widać w nim jednak trzy rzeczy, które nie kupowały żadnej pracy:

1. **19 446 tokenów wejścia (72 % rachunku)** to niemal w całości katalog narzędzi i akcji
   w prompcie systemowym.
2. **1 326 tokenów wyjścia na wybór modułów** — decyzja klasyfikacyjna, dla której zadeklarowano
   budżet 120 tokenów. Trwała 15 sekund i kosztowała 8 % całej tury.
3. **1 276 tokenów zapisanych do pamięci podręcznej, z której odczytano 0.** Zapłacone 1,25× za nic.

## 3. Sesja „pies Raj" — 1,36 zł i zero wyniku

Ta sama tura, w której asystent wykonał jedenaście odczytów w sześciu iteracjach i skończył
komunikatem „nie dokończyłem". Osiem wywołań modelu, razem **$0,3560** — i ta kwota również zgadza
się co do czwartego miejsca po przecinku.

Rozkład jest tu jeszcze wymowniejszy:

- **~12–13 tys. tokenów katalogu opłacano w PEŁNEJ cenie w każdej z sześciu iteracji.** Prompt
  systemowy jest budowany raz i we wszystkich wywołaniach identyczny co do znaku, ale oznaczony jako
  trwały był wyłącznie krótki wstęp (1 276 tokenów). To **~67 % rachunku**.
- **Ostatnie wywołanie zapisało 11 860 tokenów do pamięci podręcznej** ($0,0445), po czym przebieg
  się zakończył i nikt tej pamięci nie odczytał.

## 4. Co zmienił przebieg 112

| Zmiana | Skutek |
|---|---|
| drugi punkt cięcia pamięci podręcznej na katalogu, włączany **od drugiego** wywołania | katalog w przebiegu 6-wywołaniowym: **6,0× → 2,65×** ceny wejścia |
| nigdy nie zapisujemy pamięci w wywołaniu domykającym | koniec z płaceniem 1,25× za pamięć, której nikt nie odczyta |
| wyłączone rozszerzone myślenie w decyzjach klasyfikacyjnych | wybór modułów mieści się w zadeklarowanym budżecie wyjścia |
| pominięcie klasyfikacji dla wiadomości, które nie mogą być „prostą operacją" | jedno wywołanie modelu mniej na turę |
| naprawa granicy słowa w strażnikach intencji | „pokaż zadania" nie trafia już do płatnego klasyfikatora |
| większy budżet wyników odczytu + stronicowanie | koniec spirali „zawęź zapytanie"; komplet danych w ≤ 3 iteracjach |
| domknięcie przebiegu **dokańcza zadanie** zamiast streszczać porażkę | tura kończy się planem, a nie komunikatem „nie dokończyłem" |

**Ważne zastrzeżenie:** dokładnie ta ścieżka, która kosztowała 30 groszy, **już nie istnieje** —
od przebiegu 099 zgłoszenie z trybu wskazywania elementu zapisuje się natychmiast, bez pytania
modelu. Zgłoszenie zachowało jednak pełną moc, bo wskazane przez nie nieoptymalności obciążały
**każdą zwykłą turę**, nie tylko tamtą.

## 5. Czego świadomie NIE zrobiliśmy

**Nie ukryliśmy kwot ani ich nie zaniżyliśmy.** Wskaźnik kosztu, próg jego widoczności i sposób
raportowania zużycia zostały nietknięte. Pytanie brzmiało „czy liczycie dobrze" — odpowiedź brzmi
„tak", więc chowanie liczby byłoby odpowiedzią na niezadane pytanie. Poprawiamy zużycie, nie
prezentację.
$koszt_tury$,
  'system',
  'db',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
