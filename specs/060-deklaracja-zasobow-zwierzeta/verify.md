# Weryfikacja: deklaracja zasobów Zwierząt — zadanie 13, moduł 2 z 19

Spec: `spec.md` · Data: 2026-08-13

## 1. Bramki

| Komenda | Wynik |
|---------|-------|
| komplet bramek statycznych | ✅ **160 / 551 / 35 / 35** bez spadku |
| `check:module-registry` | ✅ 21 modułów; wpięcie `pets/sharing.ts` widziane **w obie strony** |
| `check:schema-drift` · `check:workspace-*` · `check:ownership-scope` · `check:grant-mirror` | ✅ |
| `check:test-types` · `tsc --noEmit` | ✅ · ✅ |
| `test:unit` | ✅ **719/719** (było 711 — osiem asercji tabeli prawdy) |
| `next lint` · `npm run build` | ✅ · ✅ **exit 0** |

## 2. Kryteria akceptacji

**AC-1 właściciel** ✅ · **AC-3 VIEWER/EDITOR** ✅ · **AC-4 udostępnienie zespołowi** ✅ ·
**AC-5 obcy** ✅ — wszystkie z osobnymi asercjami w tabeli prawdy.

**AC-2 — członek zespołu ma PEŁNY dostęp.** ✅ Osobna asercja. To jest kryterium, dla którego
tabela powstała: odwzorowanie `member: "editor"` przeszłoby kompilację, przeszłoby dzisiejsze
testy funkcjonalne i **zabrałoby uprawnienia**, bo przy dwóch operacjach różnicy nie widać.

**AC-6 — tabela prawdy identyczna poza §3a.** ✅ Punkt odniesienia policzony **przed**
przełączeniem (osobne uruchomienie, plik zapisany przy pustym wzorcu). Po przełączeniu: **22 z 24
komórek bez ruchu**, dwie zmienione — obie w wierszu „właściciel zespołu bez `TeamMember`".

> Spec zakładał „identycznie". Po pomiarze okazało się, że fixture Zwierząt trafia w tę samą
> komórkę, którą 056 nazwało dla Zadań. **Spec został poprawiony (§3a) przed przyjęciem nowego
> wzorca**, nie po — różnica między „udokumentowaną zmianą" a „usprawiedliwieniem po fakcie".

**AC-7 bramki i build** ✅ · **AC-8 dziennik** ✅ (wpis „060", moduł 2 z 19, co odblokowuje).

## 3. Regresje

- **Read-toole i egzekutor AI Zwierząt** wołają `assertPetAccess`, więc objęte tą samą zmianą;
  `test:unit` obejmuje `assistantBypass` i `tenantIsolation` — zielone.
- **Komunikaty błędów** zachowane co do treści, łącznie z rozróżnieniem „zwierzę nie istnieje" od
  „brak dostępu", którego platforma nie robi.
- **Zakresy list Zwierząt** nietknięte — idą przez `ownedWhere` z 057/058, a `PetShare` zostaje
  jawnie (decyzja z 057, potwierdzona tu).

## 4. Werdykt

**GOTOWE.** Osiem z ośmiu kryteriów, build exit 0.
