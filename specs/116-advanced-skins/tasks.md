# Zadania: Advanced Skins — zaawansowane skórki generowane z języka naturalnego

- **Plan:** ./plan.md (116-advanced-skins)
- **Status:** done
- **Data:** 2026-08-29

> Kolejność od najłatwiejszego do najtrudniejszego i zgodna z zależnościami. `[P]` = można
> zrównoleglić. Odhaczamy w trakcie `/implement`.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)

## Faza 0 — Fundament danych
- [x] **T-1** — Migracja `prisma/migrations/0284_advanced_skins/migration.sql`:
  `Skin.kind`/`Skin.definition` + `CREATE TABLE "SkinAsset"` + indeksy + FK (plan §2);
  aktualizacja `schema.prisma` (bez `workspaceId` na `SkinAsset` — precedens `Job`/0245).
  Gotowe, gdy: `npm run check:migrations` i `npx prisma generate` czyste, lokalny
  `prisma migrate deploy` przechodzi.

## Faza 1 — Rdzeń definicji (czyste funkcje, bez UI)
- [x] **T-2** — `src/lib/skins/zaawansowane.ts`: typy `DefinicjaZaawansowana` (schemaVersion 1),
  zamknięte katalogi (komponenty, stany, animacje, cele animacji, warianty nav, sloty assetów),
  `ADVANCED_COMPONENT_CONTROLS` (nowe rodziny `--c-*` w `src/lib/skins.ts` — bez dotykania
  `ALL_CONTROLS`), `walidujDefinicje(raw) → {definicja, odrzucone[]}` (limit 64 kB, walidacja
  pole-po-polu przez `sanitizeTokenValue`-owe reguły), `migrujDefinicje` (v1 = identyczność).
  Gotowe, gdy: kompiluje się i pokrywa przypadki z T-4.
- [x] **T-3** — `src/lib/skins/kompilacja.ts`: `kompilujDefinicje(definicja, assety) →
  {tokens, dataNav, ostrzezenia[]}` — mapowanie komponentów/stanów/animacji/responsive na
  zmienne `--c-*`, `url()` assetów wyłącznie z cuid zweryfikowanego względem przekazanej listy,
  brakujący asset ⇒ slot pominięty + ostrzeżenie; ostrzeżenia kontrastowe przez
  `lib/skins/contrast.ts`. Gotowe, gdy: czysta funkcja bez Prismy (client-safe).
- [x] **T-4** — `src/lib/skins/__tests__/zaawansowane.test.ts`: walidacja poprawnej definicji,
  odrzucanie niebezpiecznych wartości (`url(`, `;`, `{`, `expression`, selektory), nieznane pola
  → `odrzucone` bez unieważnienia reszty, limit rozmiaru, fallback kompilacji, referencja
  nieistniejącego assetu, katalog animacji (spoza listy = odrzucone), eksport wersji.
  Gotowe, gdy: `tsc -p tsconfig.test.json` + `npm run test:unit` (te pliki) zielone. Pokrywa AC-4, AC-9, AC-13, AC-15.

## Faza 2 — Warstwa serwera
- [x] **T-5** — `src/actions/skinAssets.ts`: `uploadSkinAsset` (MIME whitelist png/jpeg/webp,
  500 kB/asset, kwota 20 MB/user, SHA-256 dedup → zwrot istniejącego id), `listSkinAssets`,
  `deleteSkinAsset` (guard: skan definicji — używany ⇒ odmowa z listą skórek),
  `getSkinAssetStats`; wpisy w `src/lib/ai/action-coverage.json`; teksty błędów PL.
  Gotowe, gdy: `npm run check:ai-coverage` zielone. Pokrywa AC-6, AC-7.
- [x] **T-6** — `src/app/api/skins/assets/[id]/route.ts`: sesja, odczyt, `Content-Type`
  z rekordu, `Cache-Control: public, max-age=31536000, immutable`, `ETag`. Gotowe, gdy:
  ręczny odczyt na dev zwraca obraz z nagłówkami.
- [x] **T-7** — `src/actions/skins.ts`: `kind`/`definition` w create/update (walidacja przed
  zapisem), `SkinView.kind`, kompilacja w `readActiveSkin` (`kind === "advanced"` →
  try/catch → fallback do samych tokenów), eksport/import `omniaSkin: 2` (import v1 bez zmian;
  assety raportowane jako brakujące / wiązane po hashu). Gotowe, gdy: istniejące testy skórek
  przechodzą bez zmian. Pokrywa AC-1 (ścieżka simple nietknięta), AC-14, AC-9.

## Faza 3 — Powłoka i warianty układu
- [x] **T-8** — `src/app/globals.css`: reguły konsumujące `--c-*` z fallbackami do istniejących
  tokenów, sekcja `@keyframes omnia-anim-*` (fade, slide-up, scale, glow-pulse, shimmer),
  reguły `html[data-nav="sidebar-prawy"]` (order na `md:+` przez klasy-haki). Gotowe, gdy:
  brak zmian wyglądu bez aktywnej skórki zaawansowanej (fallbacki = dzisiejsze wartości).
- [x] **T-9** — `src/app/layout.tsx` + `AppShell.tsx` + `ModuleSidebar.tsx`: `data-nav` na
  `<html>`, klasy-haki `omnia-nawigacja`/`omnia-tresc`, prop `ukladNawigacji`; nowy
  `src/components/shell/PoziomyPasekModulow.tsx` (wariant `pasek-gorny`, desktop-only,
  z `resolveMenu`); wejście do `/settings` widoczne w każdym wariancie. Gotowe, gdy:
  wszystkie trzy warianty działają na dev, mobile bez zmian. Pokrywa AC-5.

## Faza 4 — AI / generowanie
- [x] **T-10** — Polityka `"ai.skorki"` w `src/platform/rateLimit/polityki.ts` + wpięcie
  limitera w `/api/llm/skins/generate` (oba tryby). Gotowe, gdy: test polityk zielony.
  Pokrywa AC-12.
- [x] **T-11** — `src/platform/ai/generatorObrazow.ts`: interfejs + `resolveGeneratorObrazow()`
  zwracający `null` („brak dostawcy"). Gotowe, gdy: kompiluje się, jest skonsumowany w T-12.
- [x] **T-12** — `skinGenerate.ts` tryb `advanced`: prompt z katalogu generowanego z kodu
  (komponenty/animacje/layout/sloty assetów), wyjście przez `walidujDefinicje`, `odrzucone`
  w odpowiedzi, `assets[].status: "missing"` gdy generatora brak; trasa przekazuje tryb;
  wpisy w `cost-badge-coverage.json`/`content-memory-coverage.json` (sprawdzić istniejący).
  Gotowe, gdy: `check:cost-badge` + `check:content-memory` zielone. Pokrywa AC-2 (część serwerowa).

## Faza 5 — UI
- [x] **T-13** — `SkinAiPanel.tsx`: przełącznik „Prosta / Zaawansowana", tryb zaawansowany
  z podglądem (kompilacja czystą funkcją), listą odrzuconych, ostrzeżeniem kontrastowym
  i zapisem przez `createSkin`; aktywacja osobnym, świadomym krokiem. `SkinPreview` przyjmuje
  skompilowane tokeny. Teksty w `messages/pl.json`. Gotowe, gdy: pełny przepływ opis →
  podgląd → zapis → aktywacja działa na dev. Pokrywa AC-2, AC-3, AC-11, AC-15 (część UI).
- [x] **T-14** `[P]` — `SkinPicker.tsx`: odznaka „zaawansowana", edycja ograniczona do
  nazwy/opisu/udostępnienia + regeneracja. Gotowe, gdy: picker rozróżnia rodzaje, proste
  edytują się jak dotąd (AC-1).
- [x] **T-15** `[P]` — `/admin/skins`: sekcja statystyk (skórki per rodzaj, liczba/rozmiar
  assetów, największe, osierocone) + `SkinAssetsPanel` (tabela, upload systemowego, usuwanie
  z guardem używanych). Gotowe, gdy: AC-8 spełnione ręcznie na dev, AC-7 pokazuje odmowę.

## Faza 6 — Bramki i domknięcie
- [x] **T-16** — Pełna weryfikacja: `npm run check:migrations`, `check:ai-coverage`,
  `check:cost-badge`, `check:content-memory`, `check:i18n`, `check:pagination`,
  `check:client-safe`, `tsc -p tsconfig.test.json`, `next lint`, `next build`
  (lokalny Postgres — C-13, NIGDY prod). Gotowe, gdy: wszystko zielone.
- [x] **T-17** — `docs/skorki/zaawansowane.md`: architektura, format, warstwy, jak dodać
  komponent/właściwość/animację/wariant układu, jak podłączyć generator obrazów, bezpieczeństwo,
  wersjonowanie, użycie przez LLM. Gotowe, gdy: dokument kompletny wg pkt 28 zlecenia.
- [x] **T-18** — Mapowanie AC → wynik (input do `/verify`) + wpis do `doświadczenia.md`,
  jeśli był nieoczywisty problem (C-51).

## Mapowanie AC → zadania
AC-1: T-7, T-14, T-16 · AC-2: T-12, T-13 · AC-3: T-3, T-8, T-13 · AC-4: T-2, T-4 ·
AC-5: T-9 · AC-6: T-5, T-6 · AC-7: T-5, T-15 · AC-8: T-15 · AC-9: T-3, T-4, T-7 ·
AC-10: T-8 (globalna reguła istnieje; test obecności w T-4) · AC-11: T-3, T-13 ·
AC-12: T-10 · AC-13: T-2, T-4 · AC-14: T-7 · AC-15: T-2, T-8, T-13

## Notatki / blokady
- Ścieżka krytyczna: T-1 → T-2 → T-3 → T-7 → T-13. Fazy 3 i 4 zależne tylko od T-2/T-3.
