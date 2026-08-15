# Recenzja: 069 — warstwa `domain/`

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-15
- **Diff:** 58 plików, +3076 / −261 względem `origin/master`

## Zakres i sposób recenzji

Diff jest duży, ale jednorodny: 16 nowych plików reguł + 16 plików testów + manifest + bramka,
i **15 plików akcji, w których zmiana ogranicza się do usunięcia ciała funkcji i dopisania importu**.
Recenzja skupiła się więc na trzech pytaniach, bo tylko one mogą tu coś zepsuć:

1. Czy przeniesienie **zmieniło zachowanie** którejkolwiek reguły?
2. Czy przy okazji **nie wyszła z akcji** decyzja o dostępie albo unieważnienie cache?
3. Czy warstwa **naprawdę** jest odcięta od infrastruktury, czy tylko tak się nazywa?

## Ustalenia

### 1. `src/actions/favoriteViews.ts:7-9` — martwe importy · simplification · **NAPRAWIONE W RECENZJI**
Po przeniesieniu `sanitizeColor`/`sanitizeIcon` do platformy w pliku zostały importy
`DEFAULT_FAVORITE_ICON` i `FAVORITE_COLORS`, z których nic już nie korzystało (po jednym wystąpieniu
w pliku — czyli sam import).
**Skutek:** martwy kod; `next lint` tego nie zgłasza, więc zostałby na stałe.
**Poprawka:** oba usunięte z listy importów. Przy okazji posprzątane podwójne puste linie, które
zostały po wyciętych funkcjach w 12 plikach akcji (`tsc` i lint czyste po zmianie).

### 2. `src/modules/portfel/actions/portfel.ts:18` — nieużywana zmienna · convention · **ZASTANE, NIE RUSZAM**
```ts
async function ownershipFilter(userId: string) {
  const teamIds = await getAccessibleTeamIds(userId, "portfel");   // ← nigdzie nie użyte
  return { OR: (await ownedOrAsync(userId)) };
}
```
`teamIds` jest liczone i wyrzucane — pozostałość po przełączeniu zakresów na przestrzenie (058).
**Skutek:** jedno zbędne zapytanie do bazy na każde wywołanie; **nie** błąd dostępu — `ownedOrAsync`
liczy zakres poprawnie i to jego wynik trafia do zapytania.
**Dlaczego nie naprawiam tutaj:** jest w `origin/master`, nie wprowadził tego ten przebieg, a usunięcie
zapytania to zmiana zachowania wydajnościowego poza zakresem 069 (C-53). Odnotowane w `verify.md`
i tutaj jako materiał na przebieg spłacający N+1 (zadanie 28 z checklisty, Faza 5).

### 3. `src/modules/health/actions/health.ts:77` — `startOfToday` w strefie serwera · correctness · **ŚWIADOMIE POZA ZAKRESEM**
```ts
function startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
```
Omnia ma `src/lib/userTime.ts` do granic doby w strefie użytkownika (kontrakt: „użyj tego do
today/overdue, nie dat serwerowych").
**Scenariusz awarii:** użytkownik w strefie różnej od serwerowej, o godzinie bliskiej północy,
dostaje agendę zdrowia dla **złego dnia** — wizyta „dzisiejsza" pokazuje się jako wczorajsza.
**Dlaczego nie naprawiam:** to zmiana **zachowania widocznego dla użytkownika**, a 069 z założenia
przenosi reguły bez ich zmiany (AC-10). Naprawa wymaga własnego przebiegu i rozstrzygnięcia, skąd
brać strefę w tym konkretnym miejscu. Zapisane w manifeście (`obserwacje.startOfToday`) i w dzienniku.

### 4. `habits/domain/harmonogram.ts:20` — pusty napis daje niedzielę · correctness · **UTRWALONE TESTEM, NIE NAPRAWIONE**
`normalizeDays("")` → `"0"`, bo `"".split(",")` daje `[""]`, a `Number("")` to zero.
**Scenariusz awarii:** użytkownik odznacza wszystkie dni tygodnia; formularz wysyła pusty napis;
nawyk zapisuje się jako **„tylko w niedziele"** zamiast „codziennie" albo „bez wskazania". Cicho —
nic nie sygnalizuje błędu, a nawyk po prostu przestaje przypominać przez sześć dni w tygodniu.
**Dlaczego nie naprawiam:** czym ma być pusty wybór, jest decyzją właściciela (dwie sensowne
odpowiedzi), a nie oczywistą poprawką. Zachowanie jest **przypięte testem z komentarzem**, więc
przyszła naprawa zapali czerwień świadomie. Zapisane w manifeście i dzienniku.
**Sugerowana poprawka na przyszłość:** rozróżnić „brak wskazania" (`null`) od „pustej listy" przed
wejściem do reguły, albo filtrować puste segmenty przed `Number()`.

### 5. Weryfikacja tożsamości zachowania · correctness · **CZYSTO**
Porównano ciała 11 wyprowadzonych reguł z oryginałami z `origin/master` (po usunięciu komentarzy
i białych znaków): **9 znakowo identycznych**. Dwie różnice, obie zamierzone i opisane:
- `slugify` — nawiasy wokół wyrażenia z `||`; semantyka bez zmian (`a || b` w nawiasie zwraca to samo);
- `resolveWhen` — dodany parametr `teraz = new Date()` (AC-8); wartość domyślna sprawia, że
  **wywołanie w akcji jest znakowo identyczne**.
Trzecia zmiana sygnatury: `roundedBrief` stracił **nieużywany** pierwszy parametr (`Forecast`) —
ciało korzystało wyłącznie z drugiego. Jedyne wywołanie zaktualizowane, sprawdzone `grep`-em.

### 6. Guardy dostępu i `revalidatePath` · security / C-20 / C-21 · **CZYSTO**
Policzone maszynowo przed i po we wszystkich 15 dotkniętych plikach akcji: liczba `revalidatePath`
oraz liczba `requireAuth` / `assert*Access` / `requireAccess` **identyczna w każdym pliku**.
Strukturalnie nie mogło być inaczej: wszystkie pomocniki dostępowe są **asynchroniczne i dotykają
bazy**, więc nie kwalifikowały się do warstwy reguł, a bramka dodatkowo zabrania w niej Prismy i sesji.

### 7. Granice modułów (C-36) · convention · **CZYSTO, JEDEN BŁĄD ZŁAPANY W TRAKCIE**
`grep "@/modules/"` po `src/modules/*/domain/` zwraca wyłącznie trafienie w komentarzu.
Importy warstwy to: typy (`@/types`), czysty współdzielony `@/lib/recurrence` i **własne** `../lib/*`
ścieżką względną. Pliki przekrojowe w `platform/` nie importują żadnego modułu.

Warto odnotować, bo to realny błąd wyłapany podczas implementacji: pierwsza wersja testu QA
importowała `slugify` z Kuchni **ścieżką względną** (`../../../kitchen/domain/slug`), żeby porównać
obie reguły sluga. Reguła lintu pilnuje aliasów `@/modules/*`, więc **ścieżka względna by ją
ominęła** — dokładnie ten scenariusz, przed którym ostrzega C-02. Zastąpione porównaniem wartości
po obu stronach, z komentarzem w obu testach.

### 8. Bramka `scripts/check-domain.js` · simplification · **UWAGA, ŚWIADOMA**
Bramka wymienia dwa pliki reguł platformy **z nazwy** (`REGULY_PLATFORMY`), zamiast skanować
`src/platform/**`. To celowe i opisane w kodzie: platforma jest w większości infrastrukturą, która
**ma prawo** wołać bazę i sesję, więc skan całości pilnowałby nie tego, co trzeba.
**Koszt:** trzecia reguła przekrojowa dodana w przyszłości nie zostanie objęta, dopóki ktoś nie
dopisze jej do listy. Bramka broni się przed cichą dezaktualizacją — plik z listy, który zniknie,
daje błąd. Przy trzeciej–czwartej pozycji warto zamienić listę na katalog `platform/rules/`.

### 9. Konwencje Omnia · **CZYSTO**
Brak enumów Prisma (C-12 — `MedicationFreqType` pozostaje `String`+union). Brak hardkodowanych
kolorów (C-30 — `sanitizeColor` wręcz tego **broni** i ma na to test). Zero zmian w UI, więc C-31
nie dotyczy. Wszystkie komentarze, nazwy testów i komunikaty bramki po polsku (C-32). Praca wyłącznie
w `worldofmag/` plus artefakty w `specs/` (C-01, C-03). Zero nowych zależności (C-53).

### 10. Bezpieczeństwo · **CZYSTO**
Brak kluczy, brak logowania sekretów, brak renderowania HTML. Warstwa reguł z definicji nie widzi
sesji ani uprawnień — a to jest **egzekwowane**, nie deklarowane.

## Jakość testów — to jest sedno tego przebiegu

Recenzja potwierdza ustalenie z `/verify`, bo jest ważniejsze niż którekolwiek ustalenie kodowe:
pierwsza runda weryfikacji zamknęła się **DO POPRAWY przy wszystkich 18 bramkach na zielono**.
130 testów, przypadki brzegowe w każdym pliku — a **cztery z nich przechodziły przy zepsutej regule**,
w tym oba progi klasyfikacji ABC (80 i 95), czyli dokładnie te liczby, dla których tę regułę warto
było wyodrębniać.

Winna była za każdym razem **fikstura, nie asercja**: wartości leżały obok brzegu, a nie na nim
(udziały narastające 80/95/100 **dokładnie w progach**, więc przesunięcie progu nic nie zmieniało;
`endDate` o 23:59 przy terminie o 10:00, więc `>` i `>=` dawały to samo; temperatury całkowite tam,
gdzie sprawdzano zaokrąglanie). Po naprawie: **24 mutacje, 24 złapane**.

Bez sprawdzenia mutacyjnego przebieg dowiózłby warstwę, która **wygląda** na przetestowaną. To
najpoważniejsza rzecz, jaką ta recenzja ma do powiedzenia — i jedyny powód, dla którego werdykt nie
jest czystym APPROVE bez uwag.

## Werdykt

**APPROVE Z UWAGAMI.**

Kod jest poprawny, zachowanie niezmienione (9 z 11 reguł znakowo identycznych, dwie różnice
zamierzone i opisane), guardy oraz `revalidatePath` nietknięte, granice modułów zachowane, wszystkie
bramki zielone: build **exit 0**, `test:unit` **879/879**, `next lint` **0 błędów**,
`check:domain` zielona, liczniki 160/553/35/35 bez ruchu, zapadka paginacji 263 bez ruchu.

**Naprawione w recenzji:** martwe importy w `favoriteViews.ts` + podwójne puste linie po wyciętych
funkcjach w 12 plikach.

**Uwagi przeniesione dalej, każda z zapisanym powodem** (nie blokują — wszystkie są zastane albo
wymagają decyzji właściciela):
1. `startOfToday` liczy dobę w strefie **serwera** — realny błąd dla użytkownika w innej strefie;
   wymaga własnego przebiegu, bo to zmiana widoczna.
2. Pusty wybór dni nawyku zapisuje **niedzielę**; przypięte testem, naprawa wymaga rozstrzygnięcia,
   czym ma być pusty wybór.
3. Nieużywane `teamIds` w `portfel/actions/portfel.ts` — zbędne zapytanie, zastane, materiał na
   zadanie 28 (audyt N+1).
4. Lista reguł platformy w bramce wymieniona z nazwy — przy trzeciej pozycji zamienić na katalog.
