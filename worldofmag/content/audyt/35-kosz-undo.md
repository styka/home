# Rozdział 35 — Kosz / Soft-delete + Undo

## Kontekst / stan z kodu

- **Rdzeń:** model `TrashItem` (zrzut JSON encji + dni retencji), `src/lib/trash.ts` (`recordTrash`),
  `src/actions/trash.ts`, strona `/trash` (authenticated-only, bez slug uprawnienia).
- **Mechanizm:** usunięcia w modułach zapisują migawkę JSON do `TrashItem`; user przywraca z `/trash`
  (odliczanie retencji). **Podpięte m.in. do `deleteNote`/`deleteTask`** — w tym usunięcia przez AI są
  odwracalne.

## Mocne strony

- **Zunifikowany soft-delete** z migawką JSON i retencją — bezpieczeństwo danych i spokój użytkownika.
- **Odwracalność akcji AI** — kluczowy element zaufania do asystenta (kasuje, ale można cofnąć).

## Głos Zespołu A — Strażnicy

**dr inż. Tomasz (architekt):** „Wzorzec jest dobry, ale pytanie: **czy WSZYSTKIE moduły** piszą do
kosza przy usuwaniu? Jeśli część kasuje twardo, mamy niespójność (»w notatkach cofnę, w fakturach nie«).
Potrzebny audyt pokrycia — kosz powinien być **domyślną ścieżką usuwania**.”

**Anna (security):** „Retencja vs RODO: przy **twardym usunięciu konta** (Z-051) kosz też musi być
czyszczony. I migawka JSON może zawierać dane wrażliwe — objąć ją szyfrowaniem/usuwaniem.”

## Głos Zespołu B — Pionierzy

**Damian (senior dev):** „Uogólnijmy: **jeden helper `recordTrash` dla każdego `delete*`** w aktualnych
i przyszłych modułach — tani, spójny wzorzec. Plus »cofnij« (toast z Undo) zaraz po akcji, nie tylko
przez `/trash`.”

## Punkty sporne

- **Twardy delete vs zawsze kosz.** **Konsensus:** kosz jako **domyślny** dla danych użytkownika; twarde
  usunięcie tylko dla wygaszonej retencji i usunięcia konta.

## Głos użytkowników

**Helena (68):** „Boję się, że coś skasuję — to dobrze, że jest kosz.” → kosz obniża lęk = wyższe zaufanie.

## Konsensus i zalecenia

- **Z-400** *(P1 · M)* — **Audyt pokrycia soft-delete:** każdy `delete*` przechodzi przez `recordTrash`
  (lub jawnie udokumentowany wyjątek). Kosz jako domyślna ścieżka.
- **Z-401** *(P1 · S)* — **Czyszczenie kosza przy usunięciu konta + retencji** (spójne z Z-051/Z-059);
  szyfrowanie/usuwanie migawek wrażliwych.
- **Z-402** *(P2 · S)* — **„Cofnij” (toast z Undo)** zaraz po usunięciu, nie tylko przez `/trash`.

## Dobre vs złe praktyki

**Dobre:** zunifikowany soft-delete z retencją, odwracalność AI, migawka JSON.
**Złe / do poprawy:** niepewne pełne pokrycie modułów; retencja vs RODO (czyszczenie kosza) do domknięcia.
