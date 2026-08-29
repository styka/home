# Plan techniczny: Advanced Skins — zaawansowane skórki generowane z języka naturalnego

- **Spec:** ./spec.md (116-advanced-skins)
- **Status:** draft
- **Data:** 2026-08-29

## 1. Podejście

Wzorcem jest **istniejący system skórek** (045): rozszerzamy go, nie budujemy drugiego.
Kluczowa decyzja architektoniczna: skórka zaawansowana **kompiluje się do tego samego
mechanizmu, którym działa prosta** — mapy zmiennych CSS aplikowanej inline na `<html>` —
plus dwa nowe, wąskie kanały: atrybut `data-nav` (wariant układu, zamknięta lista) i
zmienne-referencje assetów (`url(...)` budowany **wyłącznie serwerowo** z zweryfikowanego
id, nigdy z tekstu wejściowego). **Zero wstrzykiwania `<style>` i zero dowolnych
selektorów**: style per komponent/stan to nowe rodziny zmiennych `--c-*` konsumowane przez
statyczne reguły w `globals.css`, a animacje to zamknięty katalog statycznych `@keyframes`
`omnia-anim-*`, z których definicja wybiera nazwę + parametry. Dzięki temu cała
sanityzacja pozostaje jednym, istniejącym wzorcem (whitelist klucza + reguła per rodzaj),
a globalna reguła `prefers-reduced-motion` w `globals.css` (linia ~125) z definicji wygrywa
z każdą animacją skórki.

## 2. Model danych (Prisma)

- **`Skin`** — nowe kolumny:
  - `kind String @default("simple")` — `"simple" | "advanced"` (union TS, C-12),
  - `definition String?` — JSON definicji zaawansowanej (null dla prostych).
- **`SkinAsset`** (nowy model) — trwały magazyn grafik w DB (decyzja właściciela):
  - `id String @id @default(cuid())`, `hash String` (SHA-256 treści; indeks — deduplikacja
    **w obrębie właściciela i assetów systemowych**, nie globalna: globalny unique łamałby
    kaskadę usuwania konta — asset współdzielony między kontami znikałby z cudzym kontem),
    `data Bytes`, `mimeType String` (whitelist: png/jpeg/webp/svg **bez** svg w v1 — patrz
    ryzyka), `size Int`, `kind String` (`"background" | "texture" | "pattern" | "logo" |
    "decoration"`), `name String`, `ownerId String?`, `ownerTeamId String?` (NULL/NULL =
    asset systemowy — ten sam wzorzec słownikowy co `Skin`), `createdAt DateTime @default(now())`.
    **Bez kolumny `workspaceId`** (precedens `Job` po 0245): własność niesie `ownerId`,
    więc zapadka `workspace-nullable.json` (maks=5) zostaje nietknięta.
  - Indeksy: `@@index([ownerId])`, `@@index([ownerTeamId])`.
  - Relacje do `User`/`Team` z `onDelete: Cascade` (jak `Skin`).
  - „Które skórki używają assetu" — **wyliczane skanem definicji** (tabela skórek jest
    mała, odczyt admin-only); bez tabeli złączeniowej (C-53).
- **Migracja (C-10, C-11):** numer z `npm run next:migration` = **0284** →
  `prisma/migrations/0284_advanced_skins/migration.sql`:
  `ALTER TABLE "Skin" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'simple', ADD COLUMN "definition" TEXT;`
  + `CREATE TABLE "SkinAsset" (…)` + indeksy + FK. Ręczny DDL (bez ślepego `migrate diff`,
  C-15). Bez seedu — nie ma nowych uprawnień ani raportów.

## 3. Format definicji zaawansowanej (kontrakt LLM ↔ aplikacja)

Moduł `src/lib/skins/zaawansowane.ts` (typy + walidacja + katalogi) i
`src/lib/skins/kompilacja.ts` (definicja → `SkinTokens` + `data-nav` + lista ostrzeżeń):

```
type DefinicjaZaawansowana = {
  schemaVersion: 1;                       // wersjonowanie; odczyt starszej wersji przez migrator
  tokens?: SkinTokens;                    // istniejąca warstwa (ta sama whitelista ALL_CONTROLS)
  layout?: { nav?: "sidebar-lewy" | "sidebar-prawy" | "pasek-gorny" };
  components?: {                          // semantyczne komponenty, zamknięta lista v1:
    button? | card? | input? | modal? | navigation? | badge? | list? | table? | tabs?:
      { [prop: whitelist] : wartość } & { states?: { hover?|focus?|active?|disabled?: {…} } }
  };
  animations?: {                          // katalog nazwanych animacji, zamknięta lista:
    [cel: "card-entrance" | "button-hover" | "nav-glow" | "modal-entrance" | "loader"]?: {
      name: "fade" | "slide-up" | "scale" | "glow-pulse" | "shimmer" | "none";
      duration?: ms; easing?: easing; intensity?: "subtle" | "normal" | "strong";
    }
  };
  responsive?: { mobile?: { tokens?: SkinTokens } };   // wąski start: nadpisania tokenów < md
  assets?: { id: string; slot: "app-background" | "surface-texture" | "nav-background";
             fit?: "cover" | "tile"; opacity?: 0..1; status?: "ready" | "missing" }[];
};
```

- Właściwości komponentów mapują się 1:1 na **nowe zmienne** `--c-btn-*`, `--c-card-*`,
  `--c-input-*`, `--c-nav-*`, … (każda z wpisem w rozszerzonym katalogu kontrolek z
  rodzajem i regułą sanityzacji — ta sama maszyneria `sanitizeTokenValue`, nowa lista
  `ADVANCED_COMPONENT_CONTROLS` obok `ALL_CONTROLS`; `ALLOWED_TOKEN_KEYS` skórek prostych
  **bez zmian** — regresja = 0).
- `globals.css` dostaje statyczne reguły konsumujące `--c-*` z fallbackiem do dzisiejszych
  tokenów (np. `--c-card-bg` → domyślnie `var(--bg-surface)`), sekcję `@keyframes
  omnia-anim-*` oraz reguły wariantów układu pod `html[data-nav="…"]`.
- Walidacja: pole po polu; nieznane/niebezpieczne → do listy `odrzucone` (pokazywanej),
  reszta działa (AC-4, AC-9). Limit rozmiaru definicji (64 kB). `assets[].id` musi istnieć
  w `SkinAsset` (weryfikacja przy zapisie i przy kompilacji; brakujący → slot pomijany).
- Migrator wersji: `migrujDefinicje(raw) → DefinicjaZaawansowana` (v1 = identyczność;
  miejsce na przyszłe wersje — AC-13).

## 4. Warstwa serwera (Server Actions — C-20)

- **`src/actions/skins.ts`** (rozszerzenie):
  - `createSkin`/`updateSkin` przyjmują opcjonalne `kind`/`definition` — definicja
    przechodzi `walidujDefinicje` przed zapisem; `SkinView` dostaje `kind` i (dla
    właściciela) `definition`. `readActiveSkin` dla `kind === "advanced"` kompiluje
    definicję do `{tokens, dataNav}` — z `try/catch` i fallbackiem do samych tokenów
    (AC-9). Eksport/import (`SkinFile` v2: `omniaSkin: 2` z polem `definition`; import v1
    działa bez zmian — AC-14; assety binarne nie wchodzą do pliku, referencje raportowane
    jako brakujące, wiązanie po hashu gdy identyczny asset istnieje).
  - Wszystkie mutacje kończą się `revalidatePath("/", "layout")` (jak dziś).
- **`src/actions/skinAssets.ts`** (nowy):
  - `uploadSkinAsset(formData)` — dekodowanie, whitelist MIME (png/jpeg/webp), limit
    500 kB/asset, kwota 20 MB/użytkownika, SHA-256 → istniejący hash ⇒ zwrot istniejącego
    id (AC-6); admin może oznaczyć asset jako systemowy.
  - `listSkinAssets()` (właściciel: swoje + systemowe; admin: wszystkie + statystyki),
    `deleteSkinAsset(id)` — guard: skan definicji skórek; używany ⇒ odmowa z listą skórek
    (AC-7), `getSkinAssetStats()` — liczby/rozmiary/osierocone (AC-8).
  - Guardy: `requireAuth`, własność jak w `assertCanEditSkin` (wzorzec z `actions/skins.ts`);
    operacje systemowe za `hasPermission(ADMIN)`. Wpisy w `action-coverage` manifeście
    (`access: owner`/`admin`).
- **Trasa serwująca:** `src/app/api/skins/assets/[id]/route.ts` — sesja wymagana, odczyt
  `SkinAsset`, `Content-Type` z rekordu, `Cache-Control: public, max-age=31536000,
  immutable` + `ETag: hash` (id jest stabilne, treść niezmienna — AC-6). Wzorzec: trasa
  plików Drive.

## 5. Generowanie LLM + abstrakcja obrazów (C-40)

- **`src/platform/jobs/handlers/skinGenerate.ts`** — rozszerzenie: parametr
  `tryb: "simple" | "advanced"`. Tryb `advanced` buduje prompt z **katalogu generowanego
  z kodu** (rozszerzone kontrolki + zamknięte listy layout/animacji/komponentów — ten sam
  wzorzec co `buildTokenCatalog`, rozjazd niemożliwy), operacja `generation`, wyjście
  przechodzi `walidujDefinicje`; `odrzucone` wraca do UI. Wpisy w
  `content-memory-coverage.json` (jest) i `cost-badge-coverage.json` (sprawdzić/uzupełnić).
- **Rate limit:** nowa polityka `"ai.skorki"` w `src/platform/rateLimit/polityki.ts`
  (np. 5/min, 30/h, 1 równolegle, dzierżawa 120 s, komunikaty PL) — wpięta w trasę
  `/api/llm/skins/generate` (AC-12; dziś trasa nie ma limitu — dopinamy dla obu trybów).
- **Generator obrazów (abstrakcja):** `src/platform/ai/generatorObrazow.ts` — interfejs
  `GeneratorObrazow { generuj(opis, rodzaj): Promise<{data, mimeType} | null> }` +
  `resolveGeneratorObrazow(): GeneratorObrazow | null` (v1: zawsze `null` — „brak
  dostawcy"). Handler skórek: gdy definicja wskazuje potrzebne grafiki, a generatora brak
  ⇒ `assets[].status: "missing"` + komunikat w UI; podłączenie providera = implementacja
  interfejsu + rezolwer po `LlmProvider`, bez zmian formatu.

## 6. UI (C-30, C-31, C-32)

- **`src/app/layout.tsx`** — `readActiveSkin` zwraca dodatkowo `dataNav`; `<html>` dostaje
  `data-nav` obok istniejących atrybutów (`data-reka` — ten sam wzorzec, zero FOUC).
- **Warianty układu (AC-5):**
  - `sidebar-prawy` — czysty CSS: `html[data-nav="sidebar-prawy"]` + klasy-haki
    `omnia-nawigacja` (na kontenerze `ModuleSidebar`, linia ~274: `hidden md:flex`) i
    `omnia-tresc` (wrapper treści w `AppShell`) → `order` na `md:+`. Mobile nietknięty.
  - `pasek-gorny` — `AppShell` dostaje prop `ukladNawigacji` (z layoutu przez
    `AppShellServer`); przy `pasek-gorny` na `md:+` chowa `ModuleSidebar` i renderuje
    nowy, lekki `PoziomyPasekModulow` (`src/components/shell/`) nad treścią: ikony+etykiety
    z `resolveMenu` (żadnej równoległej listy modułów), chrom konta bez zmian. Korzeń
    powłoki przechodzi wtedy na `md:flex-col`.
  - Wejście do `/settings` jest w obu wariantach zawsze widoczne (ryzyko „uwięzienia").
- **`src/components/skins/SkinAiPanel.tsx`** — przełącznik trybu „Prosta / Zaawansowana
  (beta)"; tryb zaawansowany: opis → podgląd (kompilacja po stronie klienta czystą
  funkcją) + lista odrzuconych + **ostrzeżenie kontrastowe** (`lib/skins/contrast.ts`,
  AC-11) → „Zapisz skórkę" (`createSkin` z definicją) → aktywacja świadoma (AC-2).
- **`SkinPreview`** — przyjmuje opcjonalnie skompilowane tokeny zaawansowane (to nadal
  mapa zmiennych — komponent działa bez zmian struktury); miniatura w pickerze dostaje
  odznakę „zaawansowana".
- **`SkinPicker`** — pokazuje `kind`; edycja zaawansowanej ogranicza się do
  nazwy/opisu/udostępnienia + „wygeneruj ponownie" (bez ręcznego edytora — decyzja speca).
- **`/admin/skins`** (`src/app/admin/skins/page.tsx` + komponent) — sekcja statystyk
  (liczby skórek per rodzaj, liczba/rozmiar assetów, największe, osierocone) + tabela
  assetów z usuwaniem (guard używanych) + upload assetu systemowego (AC-7, AC-8).
- Teksty: `messages/pl.json` (namespace'y `components.skins.*`, `components.settings.*`,
  `components.admin.*` wg ścieżek plików) — zero literałów (C-32, `check:i18n`).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` + `prisma/migrations/0284_advanced_skins/migration.sql` | edycja/nowy | `Skin.kind`/`definition`, model `SkinAsset` |
| `src/lib/skins/zaawansowane.ts` | nowy | typy definicji, katalogi (komponenty/animacje/layout), walidacja, migrator wersji |
| `src/lib/skins/kompilacja.ts` | nowy | definicja → tokeny `--c-*` + `data-nav` + url-e assetów + ostrzeżenia |
| `src/lib/skins.ts` | edycja | `ADVANCED_COMPONENT_CONTROLS` (nowe rodziny `--c-*`), bez zmian w `ALL_CONTROLS` |
| `src/app/globals.css` | edycja | reguły `--c-*` z fallbackami, `@keyframes omnia-anim-*`, `html[data-nav=…]` |
| `src/actions/skins.ts` | edycja | kind/definition w CRUD, kompilacja w `readActiveSkin`, eksport/import v2 |
| `src/actions/skinAssets.ts` | nowy | upload/list/delete/stats assetów, dedup, kwoty |
| `src/app/api/skins/assets/[id]/route.ts` | nowy | serwowanie assetów z immutable cache |
| `src/platform/jobs/handlers/skinGenerate.ts` | edycja | tryb `advanced`, katalog z kodu, walidacja wyjścia |
| `src/app/api/llm/skins/generate/route.ts` | edycja | limit `ai.skorki`, przekazanie trybu |
| `src/platform/rateLimit/polityki.ts` | edycja | polityka `ai.skorki` |
| `src/platform/ai/generatorObrazow.ts` | nowy | abstrakcja generatora obrazów (provider „brak") |
| `src/app/layout.tsx` | edycja | `data-nav` na `<html>`, prop układu do powłoki |
| `src/components/shell/AppShell.tsx` + `ModuleSidebar.tsx` | edycja | klasy-haki `omnia-nawigacja`/`omnia-tresc`, prop `ukladNawigacji` |
| `src/components/shell/PoziomyPasekModulow.tsx` | nowy | wariant nawigacji poziomej (desktop) |
| `src/components/skins/SkinAiPanel.tsx`, `SkinPreview.tsx`, `src/components/settings/SkinPicker.tsx` | edycja | tryb zaawansowany, podgląd, odznaka, zapis |
| `src/app/admin/skins/page.tsx` + `src/components/admin/SkinAssetsPanel.tsx` | edycja/nowy | statystyki + zarządzanie assetami |
| `src/lib/ai/{action-coverage,cost-badge-coverage,content-memory-coverage}.json` | edycja | wpisy dla nowych akcji/wywołań LLM (bramki C-50) |
| `messages/pl.json` | edycja | teksty PL |
| `src/lib/skins/__tests__/zaawansowane.test.ts` | nowy | walidacja/kompilacja/fallback/bezpieczeństwo |
| `docs/skorki/zaawansowane.md` | nowy | dokumentacja developerska (pkt 28 zlecenia) |

## 8. Bramki i weryfikacja (C-50)

- Lokalnie: Postgres 16 (`pg_ctlcluster 16 main start`), `.env.local` + eksport zmiennych,
  `npx prisma migrate deploy` (C-13 — nigdy prod DB), `npm run build` do kroku `next build`.
- Bramki krytyczne dla tego feature'a: `check:migrations`, `check:owner-columns`,
  `check:ai-coverage` (nowe akcje), `check:cost-badge`,
  `check:content-memory`, `check:i18n`, `check:pagination` (nowe `findMany` z `take` albo
  komentarzem `paginacja: kompletny`), `check:client-safe`, testy `tsc -p tsconfig.test.json`.
- Mapowanie AC → weryfikacja: AC-1 istniejące testy skórek + ręczny smoke pickera;
  AC-2/3/5/15 ręcznie na dev + test kompilacji; AC-4/9/13 testy jednostkowe
  `zaawansowane.test.ts`; AC-6/7 test akcji dedup/guard + ręcznie; AC-8 ręcznie w
  `/admin/skins`; AC-10 reguła globalna + test obecności; AC-11 test funkcji ostrzeżeń;
  AC-12 polityka w `polityki.ts` (test polityk istnieje); AC-14 test eksport/import v1+v2.

## 9. Ryzyka techniczne i plan wycofania

- **CSS injection przez definicję** → jedyna droga wartości do CSS to `sanitizeTokenValue`
  z regułą per rodzaj; `url()` nigdy z wejścia (budowany z cuid po weryfikacji w DB);
  SVG **poza whitelistą MIME v1** (wektor XSS w `<img>`/CSS — świadomie odpuszczone).
- **Rozrost DB przez `Bytes`** → limity (500 kB/asset, 20 MB/user), dedup po hashu, panel
  osieroconych; rollback migracji = `DROP TABLE "SkinAsset"`, kolumny `Skin` są addytywne.
- **Wariant układu psuje moduł** → zmiany tylko w powłoce; `pasek-gorny` nie dotyka
  mobile; awaryjnie skórka wraca do `sidebar-lewy` (fallback kompilacji).
- **Regresja prostych skórek** → `ALL_CONTROLS`/`ALLOWED_TOKEN_KEYS`/ścieżka `simple`
  nietknięte; testy istniejące muszą przejść bez zmian.
- Rollback kodu: revert commita; migracja addytywna — bez rollbacku DB (runbook devops).

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-15 — ręczna migracja 0284, bez enumów, bez `migrate diff` na ślepo
- [x] C-20..C-25 — Server Actions + revalidatePath, własność wg wzorca `Skin` (tabela
  wyjątkowa z `ownerId`), bez nowej `AIAction` (generator „kliknięciem"), audyt nie dotyczy
  (brak zmian RBAC/konfiguracji), trash poza zakresem (spec §6)
- [x] C-30..C-32 — wszystko przez zmienne CSS, mobile nietknięty/bezpieczny, teksty w pl.json
- [x] C-40/C-41 — generacja przez resolver operacji `generation`; bez nowych kluczy
- [x] C-53 — jeden system skórek, kompilacja do istniejącego mechanizmu, bez nowych zależności
