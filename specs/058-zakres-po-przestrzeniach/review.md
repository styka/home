# Recenzja: zakresy list idą po przestrzeniach — etap 3B krok 2

Zakres: `git diff` względem produkcji (`a40ec44c`). 52 pliki, z czego 48 to mechaniczne przejście
na wariant asynchroniczny; reszta to helper, dowód, dwa poprawione testy, dziennik i artefakty.

## Ustalenia

### 1. Gałąź awaryjna bez `workspaceId: null` unieważniłaby cały dowód
*`src/platform/auth/serverUtils.ts`* · **correctness** · **zaprojektowane od razu, odnotowane**

Najprostszy zapis gałęzi awaryjnych brzmiałby `{ ownerId: userId }` — bez warunku o pustej
przestrzeni. Działałby, i **to jest problem**: stara reguła obowiązywałaby wtedy **równolegle** do
nowej, więc zbiory wyszłyby równe **niezależnie od tego, czy gałąź po przestrzeniach cokolwiek
robi**. Dowód równości zbiorów stałby się tautologią.

To jest dokładnie pułapka z 056 („zielony test, który dowodził, że nowy kod się nie uruchomił"),
tylko w innym przebraniu. Tu została zamknięta z wyprzedzeniem: `workspaceId: null` w obu gałęziach
awaryjnych plus **czwarta asercja** sprawdzająca, że bez gałęzi po przestrzeniach zasób z wypełnioną
przestrzenią wypada ze zbioru.

### 2. Trzecia kopia tej samej reguły przetrwała 057
*`src/platform/auth/ownership.ts:20`* · **simplification** · **naprawione**

`ownedByWhere(userId, teamIds)` robiła dokładnie to, co helper z 057. 057 jej nie skonsolidowało,
bo szukało **wzorca zapytania**, a nie **duplikatu funkcji** — wzorzec w niej był, więc został
zamieciony jak wszędzie indziej i duplikat przeżył w postaci cienkiego opakowania. Teraz oba
prowadzą do jednej implementacji.

*Wniosek:* bramka pilnująca **wzorca** nie wykrywa **duplikatu abstrakcji**. To dwie różne rzeczy
i druga wymaga spojrzenia, nie skryptu.

### 3. Test pilnujący kształtu starej reguły
*`src/lib/__tests__/ownership.test.ts:8`* · **correctness (test)** · **naprawione**

Asercja `ownedByWhere("u1", []) === { OR: [{ ownerId: "u1" }] }` sprawdzała **kształt reguły, którą
ten przebieg zmienia**. Utrzymanie jej znaczyłoby pilnowanie stanu, który świadomie porzucamy —
ten sam ruch, który 053 wykonało z asercją o martwych projektach zespołowych. Zastąpiona
sprawdzeniem tego, co da się sprawdzić bez bazy (asynchroniczność sygnatury); równość zbiorów
przejął dowód integracyjny.

**Świadomie NIE zrobiłem** atrapy przestrzeni w tym teście: sprawdzałaby atrapę, nie regułę.

## Rzeczy sprawdzone, w których nie ma ustalenia

- **Liczba zapytań.** Zakres czyta kontekst memoizowany na czas żądania; poza żądaniem `perRequest`
  degraduje się do zwykłego wywołania (051), więc zadania w tle działają — `test:unit` obejmuje
  ścieżki bez runtime'u React.
- **Trzy wyjątki z manifestu 057** nietknięte i nadal zasadne; `sharingGuard.ts` zniknie w etapie 4.
- **`PetShare`** — nadal poza helperem, zgodnie z decyzją z 057. Gdyby wpadł, ten przebieg
  przełączyłby regułę udostępniania razem z własnością.
- **C-17.** Jedyna zmiana zachowania (właściciel zespołu bez `TeamMember`) była nazwana w 056
  i tu tylko rozciąga się na listy pozostałych modułów — zapisane w specu §4 **przed** zmianą.

## Werdykt

**APPROVE Z UWAGAMI.** Etap 3B domknięty. Najważniejsza rzecz do zapamiętania na etap 4: **gałąź
awaryjna, która nie jest wyraźnie zawężona do przypadku awaryjnego, unieważnia dowód** — bo pozwala
staremu mechanizmowi odpowiadać za nowy.
