# Rozdział 36 — Skórki / Motywy (Skins)

## Kontekst / stan z kodu

- **Rdzeń:** `src/lib/skins.ts` (152 linie), `src/actions/skins.ts`; modele `Skin` (system/user/team,
  `isPublic`), `UserSkinPref`.
- **Mechanizm:** skórka = **częściowa mapa zmiennych CSS** (`Skin.tokens` JSON) aplikowana inline na
  `<html>` w `layout.tsx` (`readActiveSkin` → `tokensToStyle`), bez FOUC; pominięte zmienne dziedziczą
  domyślne (Dark = `{}`). **Walidacja `sanitizeTokenValue`** (whitelist + regex, blokada wstrzyknięć CSS).
- 21 sterowalnych tokenów; 5 skórek systemowych (Dark/Light/Casual/Blue/Pink) seedowanych migracją.

## Mocne strony

- **Bezpieczna personalizacja wyglądu** z twardą walidacją (anty-CSS-injection) — rzadko spotykana dbałość.
- **Tokeny ponad kolory** (`--radius`, `--font-size-base`, `--color-scheme`, `--on-accent`) — gęstość,
  zaokrąglenia, tryb jasny/ciemny natywnych kontrolek.
- **System/user/team + `isPublic`** — współdzielenie motywów.

## Głos Zespołu A — Strażnicy

**Rafał (grafik):** „Świetny system, ale brak **gotowych, dopracowanych motywów** (poza systemowymi) i
**trybu wg OS** (light/system). To, co mamy, to silnik — brakuje »gotowych ubrań«.”

**Anna (security):** „Walidacja jest solidna — utrzymać ją przy każdym rozszerzeniu tokenów; **testy
regresji** sanitizacji (jak dla markdown, Z-179).”

## Głos Zespołu B — Pionierzy

**Kuba (UI):** „Skórki to **atut marketingowy i retencyjny**: »zrób apkę swoją«. Galeria motywów
społeczności (`isPublic`), motywy sezonowe, **edytor wizualny** z podglądem na żywo. To buduje
przywiązanie i viralowość (»zobacz mój motyw«).”

## Punkty sporne

- **Ile motywów na start.** **Konsensus:** dołożyć kilka dopracowanych + tryb system/jasny; galeria
  społeczności później.

## Głos użytkowników

**Marek (29):** „Uwielbiam personalizację — dajcie galerię i edytor na żywo.”
**Zofia (16):** „Motywy = powód, żeby pokazać apkę znajomym.”

## Konsensus i zalecenia

- **Z-410** *(P2 · S)* — **Kilka dopracowanych motywów + tryb jasny/system** (wykorzystać `--color-scheme`).
- **Z-411** *(P1 · S)* — **Testy regresji sanitizacji tokenów** (anty-CSS-injection) — utrzymać bezpieczeństwo.
- **Z-412** *(P2 · M)* — **Galeria motywów społeczności** (`isPublic`) + edytor z podglądem na żywo — atut
  viralowy.

## Dobre vs złe praktyki

**Dobre:** bezpieczna personalizacja (walidacja), tokeny ponad kolory, system/user/team + publiczne.
**Złe / do poprawy:** brak gotowych motywów/trybu OS; niewykorzystany potencjał galerii społeczności.
