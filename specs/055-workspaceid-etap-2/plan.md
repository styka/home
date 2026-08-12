# Plan techniczny: `workspaceId` utrzymywany dla nowych rekordów — etap 2 z czterech

- **Spec:** ./spec.md (055-workspaceid-etap-2) · **Data:** 2026-08-12
- **Gałąź:** `claude/omnia-architecture-skins-qlv2ew`

## 1. Podejście

Regułę „właściciel → przestrzeń" wypełnia **wyzwalacz `BEFORE INSERT` w bazie**, jeden wspólny dla
wszystkich 45 tabel, a nie kod w ścieżkach zapisu.

**Dlaczego nie rozszerzenie klienta Prismy** (naturalny pierwszy odruch): rozszerzenie widzi tylko
te zapisy, które przechodzą przez **ten konkretny** egzemplarz klienta i tylko na **najwyższym**
poziomie wywołania. Omijają je zapisy zagnieżdżone (`create: { … : { create: … } }`), surowy SQL
(a repo go używa — seedy w migracjach, `lib/privacy/purge.ts`), skrypty i wszystko, co ktoś napisze
w przyszłości importując `PrismaClient` wprost. Dostalibyśmy mechanizm, który **wygląda** na jedno
miejsce, a w praktyce wymaga bramki pilnującej, czy nikt go nie obszedł.

Wyzwalacz obejmuje **każdą** ścieżkę zapisu bez wyjątku — nie da się go pominąć, więc bramka nie
musi ścigać wywołań, tylko pilnować **kompletności samego mechanizmu** (czy każda objęta tabela ma
wyzwalacz). To jest ta sama zamiana, którą Omnia robi wszędzie: zamiast wykrywać pominięcie,
uczynić je niemożliwym. Dodatkowo reguła stoi **obok danych**, czyli tam, gdzie stoi ta z backfillu
054 — a AC-3 wymaga jednego miejsca dla obu.

**Koszt:** jeden `SELECT` po indeksie unikalnym na `INSERT` w objętej tabeli, wykonany w bazie,
bez rundy sieciowej z Node. **Cena przejściowości:** wyzwalacz wywodzi przestrzeń z `ownerId`/
`ownerTeamId`, więc znika w etapie 4 razem z tymi kolumnami — nagłówek migracji musi to powiedzieć
wprost, tak jak nagłówek 0227 mówi o czterech etapach.

## 2. Model danych (Prisma)

**Bez zmian w `schema.prisma`.** Kolumny i indeksy dołożyła migracja 0227; ten przebieg dokłada
wyłącznie zachowanie. `prisma migrate diff` nie widzi wyzwalaczy, więc `check:schema-drift`
pozostaje zielony bez nowych wyjątków — do sprawdzenia jako pierwsza rzecz po napisaniu migracji.

**Migracja (C-10, C-11):** numer z `npm run next:migration` → oczekiwany `0228`, katalog
`prisma/migrations/0228_workspaceid_etap2_trigger/`.

**Jedna funkcja, 45 wyzwalaczy.** Funkcja czyta wiersz przez `to_jsonb(NEW)`, dzięki czemu ta sama
implementacja obsługuje tabele mające **obie** kolumny własności i te mające tylko `ownerId`
(brakujący klucz w JSON-ie to po prostu `NULL`) — bez dynamicznego SQL-a i bez dwóch wariantów:

```sql
CREATE OR REPLACE FUNCTION omnia_fill_workspace() RETURNS trigger AS $$
DECLARE wiersz jsonb; wlasciciel text; zespol text; przestrzen text;
BEGIN
  -- Wartość podana wprost wygrywa: etap 3 i testy muszą móc ustawić przestrzeń same.
  IF NEW."workspaceId" IS NOT NULL THEN RETURN NEW; END IF;
  wiersz := to_jsonb(NEW);
  wlasciciel := wiersz->>'ownerId';
  zespol     := wiersz->>'ownerTeamId';
  IF wlasciciel IS NOT NULL THEN            -- PIERWSZEŃSTWO własności osobistej (AC-3)
    SELECT id INTO przestrzen FROM "Workspace" WHERE "personalUserId" = wlasciciel;
  ELSIF zespol IS NOT NULL THEN
    SELECT id INTO przestrzen FROM "Workspace" WHERE "teamId" = zespol;
  END IF;
  IF przestrzen IS NOT NULL THEN NEW."workspaceId" := przestrzen; END IF;
  RETURN NEW;                                -- brak przestrzeni → NULL, zapis przechodzi (AC-4)
END $$ LANGUAGE plpgsql;
```

Wyzwalacze zakłada pętla `DO` po **jawnej liście tabel** (nie po `information_schema`) — lista
w migracji jest dokumentem tego, co objęte, i musi być czytelna w przeglądzie. Każdy wyzwalacz:
`DROP TRIGGER IF EXISTS … ; CREATE TRIGGER trg_<tabela>_workspace BEFORE INSERT ON "<tabela>"
FOR EACH ROW EXECUTE FUNCTION omnia_fill_workspace();` — idempotentnie (C-14).

**Tylko `BEFORE INSERT`.** Zmiana właściciela istniejącego rekordu ma przenieść zasób między
przestrzeniami, ale to operacja etapu 3 (spec §5, „poza zakresem") — wyzwalacz na `UPDATE`
zmieniałby dziś dane, których nikt nie czyta, i zabrałby etapowi 3 możliwość porównania stanu.

## 3. Warstwa serwera (C-20)

**Zero zmian w Server Actions.** To jest cel, nie oszczędność: AC-1 mówi „bez udziału autora akcji".
Guardy, `revalidatePath`, `ownerId`/`ownerTeamId` (C-21) — nietykane.

## 4. RBAC / rejestr (C-22)

Bez zmian. Kolumna nadal nieczytana, uprawnienia bez zmian, żaden moduł nie dochodzi.

## 5. UI (C-30..C-32)

Bez zmian — zero plików w `src/app/`, `src/components/`, `src/modules/*/ui/`.

## 6. AI / integracje

Bez zmian. Żadnej nowej `AIAction`, żadnego read-toola.

## 7. Bramka kompletności — `check:workspace-fill`

`scripts/check-workspace-fill.js`, wpięta w `build` obok `check:workspace-mirror`. Trzy kontrole,
wszystkie **statyczne** (nie wymagają bazy — lekcja z 054: dowód nie może zależeć od tego, czy
akurat są dane):

1. **Każdy model z `workspaceId String?`** w `schema.prisma` (z uwzględnieniem `@@map` — pułapka
   `ProjectGroup`/`TaskView` z 054) ma `CREATE TRIGGER` w katalogu migracji.
2. **W drugą stronę:** wyzwalacz na tabeli, której nie ma w zbiorze modeli, to błąd — inaczej
   literówka w nazwie tabeli objawiłaby się jako „wszystko zielone, jedna tabela niepokryta".
3. **Manifest wyjątków** `src/platform/workspaces/fill-coverage.json`: wpis wymaga powodu, a wpis
   **martwy** (dotyczący modelu, który już nie istnieje albo już ma wyzwalacz) też wywala bramkę —
   wzorzec z `mirror-coverage.json`. Dziś manifest jest **pusty**; istnieje po to, żeby następny
   wyjątek był świadomy, a nie dopisany po cichu.

Bramka pilnuje **mechanizmu**, nie wywołań — bo wywołań nie da się pominąć.

## 8. Dowód zachowania

`src/platform/workspaces/__tests__/workspaceFill.integration.test.ts` (wzorzec: test lustra z 051 —
własny fixture, `skip` bez `DATABASE_URL`). Cztery przypadki, po jednym na AC 1–4:

| Przypadek | Oczekiwane |
|-----------|------------|
| rekord z `ownerId` osoby mającej przestrzeń | `workspaceId` = jej przestrzeń osobista |
| rekord z `ownerTeamId` | `workspaceId` = przestrzeń zespołu |
| rekord z **obiema** kolumnami | wygrywa **osobista** |
| właściciel **bez** przestrzeni | `workspaceId` = `NULL`, **`create` nie rzuca** |

Piąty, kontrolny: `workspaceId` **podany wprost** nie zostaje nadpisany.

Test tworzy rekordy **przez Prismę** (a nie surowym SQL-em) — bo pytanie brzmi „czy zwykła ścieżka
zapisu aplikacji wypełnia kolumnę", a nie „czy wyzwalacz działa".

## 9. Pliki

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0228_workspaceid_etap2_trigger/migration.sql` | nowy | funkcja + 45 wyzwalaczy |
| `scripts/check-workspace-fill.js` | nowy | bramka kompletności |
| `src/platform/workspaces/fill-coverage.json` | nowy | manifest wyjątków (pusty) |
| `src/platform/workspaces/__tests__/workspaceFill.integration.test.ts` | nowy | dowód zachowania |
| `package.json` | edycja | skrypt `check:workspace-fill` + wpięcie w `build` |
| `CLAUDE.md` | edycja | opis nowej bramki (lista bramek ma być prawdziwa) |
| `content/architektura/15-dziennik.md` | edycja | wpis 055 + co zostaje na etapy 3 i 4 |
| `doświadczenia.md` | edycja | lekcja, jeśli wyjdzie nieoczywisty problem (C-51) |

## 10. Bramki i weryfikacja (C-50)

Lokalny Postgres (C-13). Kolejność: `check:migrations` → zastosowanie migracji → `check:workspace-fill`
→ **`check:schema-drift`** (musi zostać zielony bez nowych wyjątków) → test zachowania →
`test:unit` → `check:test-types` → `npx tsc --noEmit` (lekcja z 054: łańcuch bramek go **nie**
zawiera, a `next build` wywala się na tym samym kilka minut później) → `next lint` → `next build`.

Mapowanie AC: AC-1..AC-4 → test zachowania (po jednym przypadku); AC-5 → bramka + **kontrola
negatywna** (usunąć jeden wyzwalacz z migracji, sprawdzić, że bramka świeci na czerwono);
AC-6 → `git diff` bez plików w `src/app`/`src/components`/`src/actions` + `grep` na odczyty;
AC-7 → tabela bramek; AC-8 → wpis w dzienniku.

## 11. Ryzyka i wycofanie

| Ryzyko | Odpowiedź |
|--------|-----------|
| Wyzwalacz na ścieżce zapisu całej aplikacji | Jedyna operacja to przypisanie kolumny; brak przestrzeni → `NULL`, nigdy wyjątek (AC-4). Test sprawdza to wprost |
| „Niewidzialna magia" — ktoś nie będzie wiedział, skąd wartość | Nagłówek migracji, wpis w dzienniku i komentarz w bramce mówią wprost, że kolumnę wypełnia baza |
| Wyzwalacz zostanie po etapie 4 | Nagłówek migracji nazywa moment usunięcia: razem z `ownerId`/`ownerTeamId` |
| Zapis podający `workspaceId` wprost | Wyzwalacz go **nie nadpisuje** — sprawdzone przypadkiem kontrolnym |

**Wycofanie:** `DROP TRIGGER` × 45 + `DROP FUNCTION omnia_fill_workspace()`. Nic nie zależy od
kolumny, więc wycofanie jest bezobjawowe.

## 12. Checklista konstytucji

C-01 ✓ · C-10 ✓ ręczna migracja · C-11 ✓ numer z `next:migration` · C-12 ✓ brak enumów ·
C-13 ✓ lokalny Postgres · C-14 ✓ `DROP … IF EXISTS` + `CREATE OR REPLACE` = idempotencja ·
C-15 ✓ migracja pisana ręcznie, nie z `migrate diff` · C-20/C-21 ✓ akcje nietykane ·
C-22..C-25 ✓ nie dotyczy · C-30..C-35 ✓ zero UI · C-50 ✓ · C-51 ✓ · C-53 ✓ jeden mechanizm
zamiast 224 poprawek w miejscach wywołań.
