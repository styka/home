# Recenzja: „Udostępnione mi" i „Co udostępniłem"

## Ustalenia

### 1. Przycisk, którego nie ma — i to jest właściwa decyzja
**UX / correctness** · **odnotowane**

Rozdz. 8.7 wymienia „odwołanie dostępu jednym kliknięciem", więc jego brak wygląda na
niedokończenie. Jest odwrotnie: dostęp rozstrzygają dziś **dawne tabele** udostępnień (etap 2
zadania 12 przed nami), więc usunięcie samego nadania **nie odebrałoby dostępu**. Przycisk
działałby, znikałby wiersz z listy, a współpracownik nadal by widział zasób.

Fałszywe potwierdzenie w kwestii **bezpieczeństwa** jest gorsze niż brak funkcji. Ekran mówi to
wprost zamiast milczeć — użytkownik dowiaduje się, czego jeszcze nie ma, zamiast odkrywać to na
własnej skórze.

### 2. Etykiety z deklaracji, nie z mapy w widoku
*`src/actions/sharing.ts`* · **architektura** · **zaprojektowane od razu**

Mapa `"tasks.project" → "Projekt zadań"` w widoku byłaby **szóstym** miejscem pamiętającym o typie
zasobu (po deklaracji, korzeniu kompozycji, klasyfikacji, migracji nadań i lustrze). Widok pyta
katalog o `label` — nowy typ pojawia się na liście sam.

### 3. „Co udostępniłem" po przestrzeni, nie po autorze nadania
*`getSharedByMe`* · **correctness** · **rozstrzygnięte świadomie**

`createdById` wygląda na naturalny filtr i dawałby **niepełną** listę: nadania z migracji 0229/0230
mają tam właściciela zasobu, a nadanie wystawione przez współpracownika w moim projekcie w ogóle by
nie wyszło. Pytanie brzmi „co z moich rzeczy jest udostępnione", więc filtr idzie po przestrzeni
zasobu.

Wykluczenie nadań dla siebie samego (`NOT subjectId = ja`) jest potrzebne z tego samego powodu:
własny dostęp nie jest udostępnieniem.

## Rzeczy sprawdzone

- **`expiresAt`** — ten sam warunek co w `resolveRole`; lista i rzeczywistość się nie rozjeżdżają.
- **Limit 200** — lista jest przeglądem, nie eksportem; paginacja kursorowa to zadanie 20.
- **Klasyfikacja AI** — `pending`, nie `excluded`: asystent **powinien** umieć odpowiedzieć „co mi
  udostępniono?", więc to luka do zrobienia, a nie decyzja, że nie jego sprawa.
- **C-33** — `ModuleView` ze `state`, wpis w manifeście kontraktu widoku.

## Werdykt

**APPROVE.**
