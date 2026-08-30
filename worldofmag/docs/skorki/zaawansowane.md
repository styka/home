# Skórki zaawansowane (Advanced Skins) — dokumentacja developerska

> Feature 116 (`specs/116-advanced-skins/`). Ten dokument opisuje architekturę drugiego
> rodzaju skórek — generowanych przez LLM z opisu w języku naturalnym — oraz to, jak
> system rozszerzać: o komponent, właściwość, animację, wariant układu i generator obrazów.

## 1. Architektura w jednym akapicie

Skórka zaawansowana to wersjonowany JSON (**definicja**), który **kompiluje się do tego
samego mechanizmu, którym działa skórka prosta**: mapy zmiennych CSS aplikowanej inline na
`<html>` w `layout.tsx` — plus atrybuty `data-*` na `<html>`, które **bramkują** statyczne
reguły w `globals.css`. Nie istnieje żadna ścieżka, którą tekst z LLM trafiałby do arkusza
stylów inaczej niż przez sanityzację per rodzaj wartości; nie ma dynamicznego `<style>`,
nie ma selektorów w danych, nie ma dowolnych keyframes.

```
opis użytkownika (PL)
  → /api/llm/skins/generate (tryb: "advanced", limit ai.skorki)
  → skinGenerateHandler → LLM (operacja "generation", prompt z katalogów W KODZIE)
  → walidujDefinicje()  (zamknięte katalogi; złe pole → lista `odrzucone`, reszta żyje)
  → podgląd (kompilujDefinicje po stronie klienta) + ostrzeżenia (kontrast, grafiki)
  → createSkin({definition})  (walidacja RAZ JESZCZE po stronie serwera)
  → readActiveSkin() → kompilujDefinicje() → zmienne CSS + data-* na <html>
```

## 2. Prosta vs zaawansowana

| | Prosta (`kind: "simple"`) | Zaawansowana (`kind: "advanced"`) |
|---|---|---|
| Dane | `Skin.tokens` (mapa ~60 zmiennych) | `Skin.definition` (JSON, `schemaVersion`) + lustro warstwy tokenów w `Skin.tokens` |
| Edycja | ręczny edytor (`SkinEditor`) | tylko generator + zmiana nazwy/opisu; **użytkownik nie edytuje JSON-a** |
| Zasięg | kolory, typografia, gęstość, tło-gradient… | + komponenty ze stanami, warianty układu, animacje per element, grafiki, responsive |
| Ścieżka odczytu | `parseTokens` | `parseDefinicja` → `kompilujDefinicje` (fallback: warstwa tokenów → domyślna ciemna) |

Ścieżka prosta jest **nietknięta** przez 116 — to jest warunek regresji zerowej (AC-1).

## 3. Pliki

| Plik | Rola |
|---|---|
| `src/lib/skins/zaawansowane.ts` | typy definicji, **zamknięte katalogi** (komponenty/stany/animacje/warianty/sloty), `walidujDefinicje`, `migrujDefinicje`, `parseDefinicja` |
| `src/lib/skins/kompilacja.ts` | `kompilujDefinicje(definicja, assety)` → `{tokens, atrybuty, ostrzezenia}`; czysta funkcja (klient i serwer) |
| `src/lib/skins.ts` | `sanitizeValueOfKind` — wspólny rdzeń sanityzacji (jedna maszyneria dla obu rodzajów) |
| `src/app/globals.css` (sekcja 116) | bramkowane reguły `html[data-*]` + `@keyframes omnia-anim-*` |
| `src/actions/skins.ts` | `definition` w CRUD, kompilacja w `readActiveSkin`, eksport/import `omniaSkin: 2` |
| `src/actions/skinAssets.ts` | magazyn grafik: upload/list/delete/statystyki |
| `src/app/api/skins/assets/[id]/route.ts` | serwowanie grafik (immutable cache, ETag) |
| `src/platform/jobs/handlers/skinGenerate.ts` | tryb `advanced` generatora (prompt z katalogów) |
| `src/platform/ai/generatorObrazow.ts` | abstrakcja generatora obrazów (dziś: brak dostawcy) |
| `src/components/skins/SkinAiPanel.tsx` | UI: przełącznik trybu, podgląd, ostrzeżenia, zapis |
| `src/components/admin/SkinAssetsPanel.tsx` | admin: statystyki i sprzątanie magazynu |

## 4. Format definicji (schemat v1)

```jsonc
{
  "schemaVersion": 1,
  "tokens": { "--bg-base": "#050a14", ... },        // istniejąca whitelista ALL_CONTROLS
  "layout": { "nav": "sidebar-lewy" | "sidebar-prawy" | "pasek-gorny" },
  "components": {
    "button":     { "bg", "text", "radius", "shadow", "textTransform",
                    "states": { "hover": {"bg","shadow"}, "disabled": {"opacity"} } },
    "card":       { "bg", "radius", "borderColor", "shadow" },
    "input":      { "radius", "height", "states": { "focus": {"borderColor","ringWidth"} } },
    "modal":      { "bg", "radius", "shadow" },
    "navigation": { "bg", "borderColor", "width", "frame" },
    "badge": { "radius" }, "list": { "spacing" }, "table": { "borderColor" }, "tabs": { "radius" }
  },
  "states": { "error"|"success"|"warning": { "accent", "accentDim" } },
  "animations": {
    "contentEntrance": { "name": "fade|slide-up|scale", "duration": "240ms",
                          "easing": "ease", "intensity": "subtle|normal|strong" },
    "buttonHover": { "name": "scale|glow-pulse" },
    "navGlow": { "name": "glow-pulse" },
    "modalEntrance": { "name": "fade|slide-up|scale" },
    "loader": { "name": "spin", "duration": "800ms" }
  },
  "responsive": { "mobile": { "tokens": { /* tylko MOBILE_TOKENY */ } } },
  "assets": [ { "id": "<cuid>", "slot": "app-background|surface-texture|nav-background",
                "fit": "cover|tile", "status": "ready|missing", "prompt": "opis grafiki" } ]
}
```

Zasady wartości: te same rodzaje i regexy co w skórkach prostych (`sanitizeValueOfKind`);
liczby zawsze jako napisy; czas animacji 60–3000 ms; limit całej definicji 64 kB; max
jeden wpis na slot grafiki.

## 5. Jak to działa w CSS — trzy mechanizmy

1. **Aliasy na istniejące tokeny** (card/input/navigation/badge/list/table/tabs oraz
   `states.*`): właściwość komponentu to semantyczna nazwa dla LLM, kompilacja to zwykły
   wpis do mapy tokenów (`card.bg` → `--bg-surface`). Zero nowego CSS.
2. **Nowe zmienne `--c-*` + reguły bramkowane** (button, modal): reguła w `globals.css`
   działa tylko pod `html[data-c-btn]` itd. Kolory przejmujemy **przepisaniem zmiennych**
   (`--accent-blue: var(--c-btn-bg)`) — wartość zmiennej z arkusza dociera pod inline
   style bez wojny o specyficzność. Kompilator **dopełnia całą rodzinę** wartościami
   bazowymi, więc ustawienie samego `text` nie zmienia tła.
3. **Atrybuty wariantów**: `data-nav` (układ), `data-anim-*` (animacje — statyczne
   `@keyframes omnia-anim-*`, parametry w zmiennych), `data-asset-*` (dopasowanie tła),
   `data-resp-mobile` (nadpisania mobilne przez parę `--d-…`/`--m-…`, bo zmiennej
   inline nie da się nadpisać z arkusza).

## 6. Grafiki (SkinAsset)

- **Magazyn w bazie** (Neon, decyzja właściciela): `SkinAsset { hash, data Bytes, mimeType,
  size, kind, name, ownerId?, ownerTeamId? }`. Bez `workspaceId` (precedens `Job`/0245).
- **Limity**: 500 kB/plik, 20 MB/konto; MIME tylko `image/png|jpeg|webp` — **bez SVG**
  (wektor XSS). Deduplikacja SHA-256 **w obrębie właściciela + systemowych** (globalny
  unique łamałby kaskadę usuwania konta).
- **Serwowanie**: `/api/skins/assets/[id]`, `Cache-Control: immutable` + `ETag` — treść
  rekordu się nie zmienia (podmiana = nowy rekord).
- **`url()` buduje wyłącznie kompilator** z id po weryfikacji względem magazynu. W tokenach
  i definicji `url(` jest zakazane.
- **Usuwanie**: guard skanuje definicje skórek; używanej grafiki nie da się usunąć.

## 7. Generator obrazów — jak podłączyć

`src/platform/ai/generatorObrazow.ts` definiuje `GeneratorObrazow.generuj(zamowienie)`.
Dziś `resolveGeneratorObrazow()` zwraca `null`; LLM zamawia grafiki w `assets[]` jako
`status: "missing"` z polem `prompt`, a kompilator jawnie pomija slot z ostrzeżeniem.

Podłączenie dostawcy:
1. Zaimplementuj interfejs (wzorem adapterów mowy w `lib/tts/adapters.ts`) — provider
   i klucz konfigurowane w `/admin/llm` (C-40) z kluczem szyfrowanym (C-41).
2. W `skinGenerateAdvanced` (miejsce oznaczone komentarzem) zamień zamówienia `missing`
   na rekordy `SkinAsset` (przez tę samą ścieżkę limitów co `uploadSkinAsset`) i podmień
   referencje na `status: "ready"`.
3. Format definicji **nie zmienia się wcale** — to jest cały sens abstrakcji.

## 8. Walidacja i bezpieczeństwo

- LLM to **niezaufany klient**: pełna walidacja przy zapisie (`createSkin`/`importSkin`)
  ORAZ przy odczycie (`parseDefinicja` w `readActiveSkin`).
- Jedno złe pole → wpis na liście `odrzucone` (pokazywanej użytkownikowi), reszta działa.
- Zakazy globalne (`;`, `{}`, `<>`, `url(`, `expression`, `@`, `javascript:` …) +
  reguła per rodzaj wartości — jedna maszyneria dla obu rodzajów skórek.
- Kontrast: `kompilujDefinicje` liczy WCAG dla par, na które definicja wpłynęła —
  ostrzeżenie, nigdy blokada (decyzja użytkownika).
- `prefers-reduced-motion`: globalna reguła w `globals.css` wyłącza każdą animację skórki.
- Fallback: błąd kompilacji → warstwa tokenów; błąd i tam → domyślna ciemna. Wyjście
  z każdej skórki: `/settings` jest osiągalne w każdym wariancie układu.

## 9. Wersjonowanie

`schemaVersion` w definicji (dziś `1`; brak pola = 1). Zmiana formatu = nowa wersja +
funkcja przejścia w `migrujDefinicje` (stare definicje w bazie pozostają odczytywalne).
Wersja nieznana (przyszła) → pusta definicja + `odrzucone: ["schemaVersion"]`, nigdy
wyjątek. Plik eksportu: `omniaSkin: 1` (prosta, bez zmian) / `omniaSkin: 2` (zaawansowana,
z `assetHashes` do ponownego wiązania grafik po treści przy imporcie).

## 10. Jak rozszerzyć system

**Nowa właściwość komponentu**:
1. Dodaj wpis w `KOMPONENTY` (`zaawansowane.ts`) — alias (`typ: "token"`) nie wymaga
   nic więcej; nowa zmienna (`typ: "var"`) wymaga też bramkowanej reguły w `globals.css`
   i (jeśli rodzina wielozmiennych) dopełnienia w `kompilacja.ts`.
2. Prompt generatora zaktualizuje się SAM — katalog jest generowany z tych obiektów.
3. Dopisz przypadek do `zaawansowane.test.ts`.

**Nowy komponent**: nowy klucz w `KOMPONENTY` + (dla `var`) reguły w CSS. Nazwa po
angielsku, semantyczna (LLM ma ją rozumieć), opisy po polsku.

**Nowa animacja**: nazwa w `CELE_ANIMACJI` + `@keyframes omnia-anim-*` + reguła
`html[data-anim-…="nazwa"]` + mapowanie intensywności w `kompilacja.ts`.

**Nowy wariant układu**: wpis w `WARIANTY_NAWIGACJI` + realizacja w powłoce (CSS na
`html[data-nav="…"]` albo — gdy zmienia skład — gałąź w `AppShell`). Mobile ma pozostać
nietknięty (C-31).

**Nowy slot grafiki**: wpis w `SLOTY_ASSETOW` + mapowanie w `kompilacja.ts` + zmienna/
reguła konsumująca w CSS.

## 11. Jak używa tego LLM

Prompt (`systemPromptZaawansowany`) dostaje pełny katalog wygenerowany z kodu: tokeny,
komponenty z opisami i formatami wartości, cele i nazwy animacji, warianty układu, sloty
grafik i zasady jakości (kontrast ≥ 7:1 dla tekstu głównego, umiar, komplet tokenów,
spójność warstw). Model zwraca JEDEN obiekt JSON (metadane + definicja); dostaje jedno
ponowienie z listą własnych odrzuconych pól. Id grafik nigdy nie wymyśla — zamawia je
przez `status: "missing"` + `prompt`.

## 12. Testy

`src/lib/skins/__tests__/zaawansowane.test.ts` — walidacja (w tym wartości
niebezpieczne, limit rozmiaru, nieznana wersja), kompilacja (aliasy, dopełnianie rodzin,
url tylko dla istniejących assetów, atrybuty, para mobilna, kontrast), fallback. Regresję
skórek prostych pokrywają istniejące testy (`skins.test.ts`, `skinContrast.test.ts`,
`mapowanie.test.ts`) — 116 nie zmienił żadnego z nich.
