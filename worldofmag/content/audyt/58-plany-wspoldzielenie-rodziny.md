# Dodatek A.12 — Plany wdrożenia: współdzielenie i rodziny

Plany realizujące zalecenia z Rozdz. 15.

---

## Plan Z-190 (P0) — Audyt izolacji tenantów

**Cel:** żadne zapytanie nie przecieka danych między userami/zespołami.
**Kroki:**
1. Przejść akcje odczytu/listowania; potwierdzić filtr `OR(ownerId, ownerTeamId ∈ teamIds)` z
   `getUserTeamIds`.
2. Uzupełnić braki; spójne z audytem autoryzacji (Z-052).
3. Testy izolacji (plan Z-172) jako dowód.
**Kryteria:** brak zapytań bez filtra własności; testy cross-tenant zielone.
**Priorytet:** P0 — warunek skali i zaufania (rodzina/firma).

---

## Plan Z-192 (P1) — Preset „Gospodarstwo domowe” (rodzina)

**Cel:** killer feature wzrostu — wspólny dom w jednym miejscu.
**Kroki:**
1. `Team.kind = "household"` (+ migracja); domyślne współdzielenia przy tworzeniu: lista zakupów,
   kalendarz, zadania, budżet domowy.
2. Role rodzic/dziecko (uprawnienia w grupie) — minimalnie na start.
3. UI „Załóż rodzinę” + zaproszenia (reużyć `invitations`); onboarding (Z-195).
**Pliki:** `prisma` (+migracja), `src/actions/teams.ts`, UI ustawień/rodziny.
**Kryteria:** rodzic zakłada „rodzinę”, zaprasza, współdzieli zakupy/kalendarz/zadania/budżet.
**Zależność:** domknięta team-awareness modułów (Z-191).

---

## Plan Z-191 (P1) — Domknąć team-awareness

**Cel:** spójność współdzielenia między modułami.
**Kroki:** przegląd modułów pod kątem `ownerTeamId`; dodać tam, gdzie brak a powinno być; jawnie
oznaczyć moduły celowo user-only. Indeksy zespołowe (Z-197).
**Kryteria:** moduły istotne dla rodziny/zespołu są team-aware lub jawnie oznaczone jako user-only.

---

## Plan Z-193 (P1) — Ujednolicić język i wejście do współdzielenia

**Cel:** koniec zamętu trzech mechanizmów (zespół / sharing per-encja / członkostwo projektu).
**Kroki:** jeden komponent „Udostępnij” (kto, jaka rola); spójne nazewnictwo (rodzina/zespół/
udostępnianie) w UI; pod spodem istniejące mechanizmy.
**Kryteria:** użytkownik udostępnia z jednego miejsca; spójny język.

---

## Pozostałe (skrót)

- **Z-194 (P1)** — granularne role w grupie (uprawnienia per moduł) pod B2B.
- **Z-195 (P1)** — onboarding zespołu/rodziny (zaproszenie → role → pierwsze współdzielenia).
- **Z-196 (P2)** — wspólny budżet domowy jako pierwszoklasowy widok Portfela.
- **Z-197 (P1)** — indeksy/limity zapytań zespołowych (spójne z Z-031).
- **Z-198 (P2·L)** — ochrona małoletnich (role dziecka, zgoda rodzica) — z prawnikiem.

**Kolejność:** Z-190 → Z-191 → Z-192 → Z-193 → Z-195 → reszta.
