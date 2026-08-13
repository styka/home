# Weryfikacja: udostępnienia Zwierząt jako nadania

Data: 2026-08-13

| Bramka | Wynik |
|--------|-------|
| komplet bramek | ✅ **160 / 551 / 35 / 35** bez spadku |
| `check:migrations` | ✅ następny wolny 0231 |
| `check:grant-mirror` | ✅ 4 pliki mutujące, 1 świadomy wyjątek |
| `check:schema-drift` | ✅ migracja rusza dane, nie kształt |
| `test:unit` | ✅ zielony, 11 asercji lustra (dwie nowe dla Zwierząt) |
| `npm run build` | ✅ **exit 0** |

**AC-1** ✅ migracja 0230, `ON CONFLICT DO NOTHING`; ta sama uwaga co w 059 — lokalna baza nie ma
udostępnień, więc **kompletność na danych mierzy dopiero etap 2**. **AC-2** ✅ (powstanie + `upsert`
obniżający rolę). **AC-3** ✅ asercja cofnięcia. **AC-4** ✅ odczyty nietknięte — tabela prawdy
Zwierząt z 060 bez ruchu. **AC-5** ✅ bramka wskazała `pets.ts` przy pierwszym uruchomieniu.
**AC-6** ✅ · **AC-7** ✅ dziennik.

**Werdykt: GOTOWE Z UWAGAMI** — uwaga ta sama, co w 059 i przekazywana do etapu 2: rozjazd
tabela ↔ nadanie trzeba policzyć **na produkcji** przed przełączeniem odczytów.
