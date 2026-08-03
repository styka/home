# Skala i współdzielenie — analiza, na której stoi cała reszta

> To rozdział, w którym prostuję najpoważniejszy błąd wcześniejszych analiz. Wnioski są **inne** niż
> poprzednio, choć nie wszystkie się zmieniły — i pokazuję dokładnie, które i dlaczego.

## 1. Fałszywe uogólnienie, które trzeba wycofać

Wcześniejsze raporty twierdziły: *„dane Omnii są prywatne per użytkownik, więc współbieżna edycja
tej samej encji praktycznie nie występuje"*.

**To nieprawda.** W Omnii sens ma udostępnienie prawie każdego zasobu:

- projekt zadań udostępniony współpracownikowi, który **dodaje do niego zadania**;
- lista zakupów udostępniona domownikowi, który **odhacza pozycje w sklepie**;
- notatka udostępniona do wspólnej redakcji;
- przepis, zwierzę, magazyn, warsztat, plan posiłków — wszystko, co ma sens dzielić;
- zespoły (`ownerTeamId`) obejmujące ~46 modeli.

**Współpraca jest częścią produktu, a nie wyjątkiem.** Przy 100 tys. użytkowników konflikty edycyjne
**wystąpią** — i to regularnie.

## 2. Co z tego naprawdę wynika — trzy kształty współbieżności

Błąd poprzednich analiz polegał na potraktowaniu „współbieżności" jako jednej rzeczy. To trzy różne
problemy o **skrajnie różnym koszcie rozwiązania**.

### Kształt A — kolekcja (dominujący w Omnii)

Dwie osoby **dodają różne elementy** do wspólnego zbioru: zadania do projektu, pozycje do listy
zakupów, wpisy do magazynu, zdjęcia do galerii zwierzęcia.

**Konflikt:** żaden. To niezależne `INSERT`-y.
**Rozwiązanie:** baza danych. Nie potrzeba niczego.
**Czego potrzeba:** żeby druga osoba **zobaczyła** nową pozycję szybko — czyli wypychania zmian
(rozdział 11.1). To wymóg **produktowy**, nie techniczny.

### Kształt B — pole skalarne (istotny, rozwiązywalny tanio)

Dwie osoby zmieniają **to samo pole tego samego rekordu**: status zadania, termin, ilość, priorytet.

**Konflikt:** realny. Dziś rozstrzygany **cicho na korzyść ostatniego zapisu** — bez śladu i bez
możliwości odzyskania.
**Rozwiązanie:** **kontrola współbieżności przez wersjonowanie** (rozdz. 8.5) — rekord ma kolumnę
`version`, zapis zawiera wersję odczytaną, a niezgodność zwraca konflikt zamiast nadpisywać.
**Koszt:** jedna kolumna, jeden wzorzec w akcjach, jeden komponent UI. **Dni, nie miesiące.**

### Kształt C — wspólny tekst edytowany jednocześnie (rzadki, wąski)

Dwie osoby piszą **w tym samym polu tekstowym w tej samej chwili**: treść notatki, opis zadania,
notatki z wizyty.

**Konflikt:** realny i **nierozwiązywalny przez wersjonowanie** — bo blokada „ktoś inny zmienił"
przy współredagowaniu tekstu jest bezużyteczna.
**Rozwiązanie:** CRDT.
**Koszt:** wysoki — ale **dotyczy dającego się wskazać, wąskiego zbioru pól**: `Note.content`,
`Task.description`, `HealthEvent.notes`. To **kilka pól**, nie 147 modeli.

### 2.1. Rozkład w Omnii

Szacunek na podstawie przeglądu 545 akcji i tego, co realnie robią użytkownicy współdzielonych
zasobów:

| Kształt | Udział operacji | Rozwiązanie | Koszt |
|---------|-----------------|-------------|-------|
| **A — kolekcja** | ~90 % | baza + wypychanie zmian | niski |
| **B — pole skalarne** | ~9 % | wersjonowanie + UI konfliktu | niski |
| **C — wspólny tekst** | ~1 % | CRDT, opcjonalnie, per pole | wysoki, **odroczony** |

> **Wniosek, który zastępuje poprzedni:** współdzielenie **wymaga** kontroli współbieżności
> i wypychania zmian — obu tych rzeczy dziś nie ma. **Nie wymaga** natomiast przepisania warstwy
> danych na event sourcing, bo 99 % operacji rozwiązują mechanizmy kosztujące dni, nie miesiące.

## 3. Co się zmienia w decyzjach architektonicznych

| Decyzja | Poprzednio | Teraz | Powód zmiany |
|---------|------------|-------|--------------|
| Jednolity model współdzielenia | nieomawiany | ✅ **fundament (D4)** | 5 mechanizmów, 3 słowniki ról, 3/21 modułów |
| Kontrola współbieżności (wersjonowanie) | nieomawiana | ✅ **wymagana (D5)** | cicha utrata pracy przy współdzieleniu |
| Wypychanie zmian (SSE) | „optymalizacja kosztu" | ✅ **wymóg poprawności (D6)** | 45 s opóźnienia na wspólnej liście zakupów to wada produktu |
| Obecność / kto jeszcze patrzy | nieomawiana | 🟡 **przewidziana, odroczona** | tania nadbudowa nad SSE |
| CRDT | „odrzucony" | 🟡 **odroczony, per pole** | dotyczy ~1 % operacji, ale realnie istnieje |
| Event sourcing | „odrzucony" | ❌ **nadal odrzucony** | żaden z trzech kształtów go nie wymaga |
| Mikroserwisy | „odrzucone" | ❌ **nadal odrzucone** | współdzielenie **wzmacnia** argument — ACL rozproszone po usługach to koszmar |

**Uwaga o ostatnim wierszu:** korekta o współdzieleniu **wzmacnia** odrzucenie mikroserwisów.
Sprawdzenie „czy user X może edytować zasób Y" musi być spójne, natychmiastowe i tanie — a rozproszone
po 21 usługach staje się albo wolne, albo niespójne.

## 4. Skala ruchu — trzy progi

### Próg A — testerzy (3–15 osób), najbliższe tygodnie
Wąskim gardłem jest **wiarygodność**, nie wydajność. Potrzebne: obserwowalność, stany brzegowe,
granice modułów (bo teraz tanie), i18n rozpoczęte (bo później drożeje), **jednolite współdzielenie**
(bo migracja danych z pięciu mechanizmów jest dziś operacją na pustej bazie).

### Próg B — otwarcie (~100 tys. kont)
Wąskim gardłem jest **koszt jednostkowy i liczba zapytań**. Potrzebne: koniec odpytywania,
współdzielony rate-limit, budżety AI, pula połączeń, cache, retencja, skalowanie poziome.

### Próg C — rynki zagraniczne (miliony)
Wąskim gardłem jest **geografia i izolacja**. Repliki odczytu, regiony, partycjonowanie, CDN,
kolejka poza bazą, prawdziwe tłumaczenia.

> **Nic z Progu C nie wchodzi do tej przebudowy.** Ma być tylko *możliwe* bez kolejnego przepisywania.

### 4.1. Uwaga o partycjonowaniu przy współdzieleniu

Wcześniejsza teza „dane prywatne = łatwy sharding po `ownerId`" **wymaga korekty**. Zasób
współdzielony między użytkownikami z różnych partycji łamie naiwny podział.

**Rozwiązanie, które architektura docelowa przewiduje:** kluczem partycjonowania nie jest
`ownerId`, tylko **`workspaceId`** (rozdział 8.2) — przestrzeń, w której zasób żyje i w obrębie
której jest współdzielony. Użytkownik należy do wielu przestrzeni; zasób do dokładnie jednej.
**To jest jedyny element Progu C, który musi być przewidziany w modelu danych już teraz** — dodanie
takiego klucza później oznaczałoby migrację wszystkich 147 modeli.

## 5. Rachunek, który przekonuje o pilności

**Założenia ostrożne:** 100 tys. kont, 5 % jednocześnie aktywnych (5 000 kart), odświeżanie co 45 s,
strona główna wykonująca kilkanaście zapytań.

```
5 000 kart / 45 s     ≈  111 przeładowań komponentów serwerowych na sekundę
111 × ~15 zapytań     ≈  1 500–2 000 zapytań do bazy na sekundę
```

To ruch wygenerowany przez **samo bezczynne siedzenie w aplikacji**. Nikt niczego nie kliknął.

**Dlaczego to jest podstępne:** przy 15 testerach ten sam mechanizm daje ~0,3 przeładowania/s.
Wszystko wygląda dobrze. **Nic nie zapowiada awarii aż do momentu, w którym jest za późno** — a wzrost
liniowy oznacza, że awaria przyjdzie dokładnie wtedy, gdy przyjdą użytkownicy.

**A przy współdzieleniu jest jeszcze gorzej:** te 45 s to nie tylko koszt, ale i **opóźnienie
widoczności zmiany współpracownika**. Dwie osoby przy jednej liście zakupów w sklepie zobaczą swoje
odhaczenia po pół minuty. To nie jest wada wydajności — to **wada produktu**.
