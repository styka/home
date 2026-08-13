# Recenzja: wersjonowanie — zadanie 15

## Ustalenia

### 1. Dodatkowy odczyt po zapisie — koszt przyjęty świadomie
*`src/modules/tasks/actions/tasks.ts:306`, `notes.ts:148`* · **wydajność** · **bez zmian, odnotowane**

`updateMany` nie zwraca zmienionego wiersza, więc obie akcje robią teraz `findUniqueOrThrow` po
zapisie — jedno zapytanie więcej na edycję. Alternatywą było `update` z warunkiem na wersji, ale
wtedy **znika odróżnialność konfliktu od braku rekordu**, czyli sedno mechanizmu (rozdz. 8.5.1).

Koszt jest realny i mały: odczyt po kluczu głównym, w tej samej transakcji sieciowej co reszta
akcji. Gdyby kiedyś zaczął ciążyć, właściwą odpowiedzią jest `RETURNING` przez surowy SQL, a nie
rezygnacja z rozróżnienia.

### 2. Bramka czyta zbiór modeli ze schematu, nie z własnej listy
*`scripts/check-versioning.js:26`* · **process** · **zaprojektowane tak od razu**

Lista w skrypcie byłaby drugim miejscem do pamiętania: ktoś dokłada `version` do trzeciego modelu,
bramka nadal pilnuje dwóch, a trzeci można zapisywać dowolnie. Zbiór wyprowadzany ze
`schema.prisma` znika ten problem — i jest to ta sama zasada, która w 054 kazała wyprowadzić listę
tabel testu kompletności ze schematu zamiast ją powtarzać.

### 3. Bramka sprawdza IMPORT, nie każde wywołanie
*`scripts/check-versioning.js`* · **granica narzędzia** · **odnotowane**

Jak lustra przestrzeni i nadań, ta bramka wymaga, żeby plik zapisujący model z wersją **znał**
mechanizm — nie weryfikuje, czy każde pojedyncze `update` przez niego przechodzi. To świadoma
granica: pełna analiza wymagałaby przejścia po AST, a doświadczenie z trzema poprzednimi bramkami
mówi, że wartość jest w wychwyceniu **nowego pliku**, który o mechanizmie nie wie.

Warto to nazwać, bo łatwo przecenić, co bramka gwarantuje.

## Rzeczy sprawdzone

- **`increment` zamiast `expectedVersion + 1`** — gdyby dwa zapisy bez kontroli przeszły
  równolegle, licznik zostaje spójny.
- **Komunikat konfliktu po polsku i bez żargonu** (C-32) — trafia do UI, dopóki zadanie 16 nie
  dowiezie dialogu.
- **`ConflictError` niesie aktualną wersję** — zadanie 16 potrzebuje jej, żeby pokazać różnice;
  osobna asercja.
- **C-12** — `version` to `Int`, nie enum; **C-20** — `revalidatePath` nietknięte.

## Werdykt

**APPROVE Z UWAGAMI.** Mechanizm dowiedziony na równoległym zapisie, pilot na dwóch kształtach
danych, bramka pilnuje rozszerzeń. Zadanie 16 ma teraz na czym stanąć.
