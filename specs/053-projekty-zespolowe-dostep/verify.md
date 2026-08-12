# Weryfikacja: Projekty zespołowe przestają być martwe

- **Data:** 2026-08-12 · **Spec:** ./spec.md

## Bramki
`npm run build` ✅ exit 0 · `test:unit` ✅ **681/681** · `tsc` + `tsc -p tsconfig.test.json` ✅ ·
`next lint` ✅ 0 błędów · liczniki **160 / 551 / 35 / 35** ✅ bez ruchu · `check:module-registry`
(9 kontroli) ✅.

## Kryteria akceptacji

- **AC-1 ✅** Członek zespołu wykonuje operację na zawartości projektu zespołowego — komórka macierzy
  „w zespole, bez czlonkostwa" × „projekt zespolowy" = **dozwolone** (było: odmowa).
- **AC-2 ✅** Stopniowanie wyrażone deklaracją `teamOwnership: { member: "editor", admin: "manager" }`;
  `adminTeamIds` w kontekście wywodzone z ról `OWNER`/`ADMIN` w zespole.
- **AC-3 ✅** Osobna asercja: `czlonek MEMBER`, `czlonek ADMIN` i `obcy` — wszyscy **odmowa**.
- **AC-4 ✅ — sedno.** Porównanie z punktem odniesienia z 052 pokazało **dokładnie jedną** zmienioną
  komórkę; pozostałe 24 bez ruchu. Punkt odniesienia zaktualizowany świadomie, a asercja pilnująca
  dawnego zachowania **zamieniona**, nie usunięta.
- **AC-5 ✅** `accessibleProjectIds` obejmuje projekty zespołu. Bez tego użytkownik miałby prawo
  działać w projekcie, którego nie widzi — najgorszy możliwy rodzaj rozjazdu.
- **AC-6 ✅** Bramki wyżej.

## Ograniczenie odnotowane

Właściciel zespołu **bez wiersza `TeamMember`** nadal nic nie zyskuje — `getUserTeamIds` czyta
członkostwa, a to jest całoaplikacyjne pojęcie „moje zespoły". W praktyce `createTeam` taki wiersz
zakłada. Nie naprawiamy tego tutaj: byłaby to druga zmiana semantyki w jednym przebiegu.

## Werdykt

## **GOTOWE**

Sześć na sześć AC. Najważniejsze: **zmiana rozszerzająca dostęp została pokazana jako dokładnie
jedna komórka macierzy** — i to jest dowód, że nie zmieniło się nic poza tym, co zamierzone.
