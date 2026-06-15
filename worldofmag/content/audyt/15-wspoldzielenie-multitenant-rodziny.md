# Rozdział 15 — Współdzielenie, multi-tenant, zespoły, rodziny

## Kontekst / stan z kodu

- **Własność 3-poziomowa** (`src/lib/ownership.ts`): systemowa (oba null) / użytkownika (`ownerId`) /
  zespołu (`ownerTeamId`). Wzorzec dostępu: `OR: [{ownerId}, {ownerTeamId: {in: teamIds}}]`.
- **Zespoły:** `Team`, `TeamMember`, `TeamInvitation` (`actions/teams.ts`, `invitations.ts`,
  `/settings/team/*`, `/invitations`).
- **Współdzielenie per-encja:** `TaskShare`, `PetShare` (role VIEWER/EDITOR), `TaskProjectMember`
  (członkostwo w projekcie) — warstwa ponad własnością.
- **Zakres team-aware niespójny:** część modułów ma pełne `ownerId`/`ownerTeamId` (Zakupy, Zadania,
  Notatki, Kuchnia, Pets, Zdrowie, Nawyki, Flota, Portfel, Języki), część jest **user-only** (np.
  Stores), niektóre mają dodatkowe sharing per-encja (Tasks, Pets).
- **Brak warstwy „rodzina/gospodarstwo”** jako osobnej koncepcji — dziś rodzinę modeluje się jako
  „zespół”, bez ról rodzic/dziecko, bez wspólnego budżetu domowego jako pierwszej klasy.

## Głos Zespołu A — Strażnicy

**dr inż. Tomasz (architekt):** „Model własności jest elegancki i **spójny tam, gdzie jest** — ale
»gdzie jest« to nie wszędzie. Zanim sprzedamy »współdzielenie rodzinne«, musimy **zaudytować, które
moduły są team-aware**, i domknąć luki. Niespójność (jeden moduł dzieli, sąsiedni nie) jest gorsza niż
brak funkcji — myli użytkownika.”

**Anna (security):** „Multi-tenant to przede wszystkim **izolacja**. Każde zapytanie MUSI filtrować po
`OR(owner, team)`; jedno pominięcie = wyciek danych między rodzinami/firmami (to ten sam problem co IDOR
z Rozdz. 8). Przy skali to **P0** — testy izolacji tenantów obowiązkowe.”

**Marek (DBA):** „Izolacja + indeksy własności (Z-030) to jedno. Drugie: przy 100M userów i zespołach
zapytania `teamId IN (…)` muszą być **indeksowane i ograniczone** — user w 200 zespołach nie może
generować gigazapytań.”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „»Rodzina« to **killer feature i motor wzrostu** (wirusowość: zapraszam żonę, dzieci,
i już mamy 4 konta z jednego). Zbudujmy **»Gospodarstwo domowe«** jako wariant zespołu z rolami
rodzic/dziecko, wspólnym kalendarzem, listą zakupów i **budżetem domowym**. To spina Zakupy + Kalendarz
+ Portfel + Zadania w jedną opowieść »ogarnij rodzinę«.”

**Ola (UX):** „Kluczowe, żeby współdzielenie było **proste**: jeden przycisk »Udostępnij rodzinie«,
jasne kto co widzi. Dziś mamy zespoły + sharing per-encja + członkostwo projektu — to **trzy mechanizmy**,
użytkownik się pogubi. Ujednolićmy język (»udostępnij«, »rodzina«, »zespół«).”

**Magda (delivery):** „Nie budujmy od zera — »rodzina« to **preset zespołu** + role + kilka domyślnych
współdzieleń. Reużywamy istniejący model własności, dokładamy cienką warstwę.”

## Punkty sporne

- **Rodzina = nowy byt vs preset zespołu.** **Konsensus:** **preset zespołu** (`Team.kind = household`)
  z rolami i domyślnymi współdzieleniami — minimalny koszt, maksymalna reużywalność.
- **Ujednolicić mechanizmy współdzielenia?** Strażnicy: tak, spójność. Pionierzy: tak, ale nie psując
  istniejącego. **Konsensus:** wspólny język i jeden punkt wejścia („Udostępnij”), pod spodem istniejące
  mechanizmy.
- **Role rodzic/dziecko (kontrola rodzicielska).** Wartościowe, ale dochodzi **ochrona małoletnich**
  (RODO dzieci, zgoda rodzica) — Strażnicy: ostrożnie, z prawnikiem.

## Głos użytkowników

**Agnieszka (38, rodzina):** „To jest dla mnie **najważniejsze**: wspólna lista zakupów, kalendarz
rodziny, budżet domowy, zadania dla dzieci. Jeśli to zadziała prosto, zostaję na lata i przyprowadzam
całą rodzinę.” → „rodzina” to retencja + wirusowość w jednym.

**Tadeusz (60, gastronomia):** „W firmie potrzebuję **ról**: kto może widzieć finanse, kto tylko grafik.”
→ multi-tenant B2B wymaga granularnych ról w grupie (nie tylko VIEWER/EDITOR).

## Konsensus i zalecenia

- **Z-190** *(P0 · M)* — **Audyt izolacji tenantów:** zweryfikować, że KAŻDE zapytanie filtruje po
  `OR(ownerId, ownerTeamId ∈ teamIds)`; testy izolacji (user A nie widzi danych usera/zespołu B).
  Krytyczne przy skali (spójne z Z-052).
- **Z-191** *(P1 · M)* — **Domknąć team-awareness** w modułach, które jej nie mają, a powinny
  (przegląd + ujednolicenie); jawnie oznaczyć moduły celowo user-only.
- **Z-192** *(P1 · M)* — **Preset „Gospodarstwo domowe” (`Team.kind=household`)** z rolami
  rodzic/dziecko i domyślnymi współdzieleniami (lista zakupów, kalendarz, zadania, budżet domowy).
  Killer feature wzrostu.
- **Z-193** *(P1 · S)* — **Ujednolicić język i wejście do współdzielenia** („Udostępnij” jako jeden
  punkt; spójne nazewnictwo rodzina/zespół/udostępnianie) — redukcja zamętu trzech mechanizmów.
- **Z-194** *(P1 · M)* — **Granularne role w grupie** (np. konfigurowalne uprawnienia per moduł w
  zespole) pod B2B; ponad obecne VIEWER/EDITOR.
- **Z-195** *(P1 · S)* — **Onboarding zespołu/rodziny** (zaproszenie, role, pierwsze współdzielenia w
  kilku krokach) — dziś zaproszenia są, brakuje płynnego wdrożenia.
- **Z-196** *(P2 · M)* — **Wspólny budżet domowy** jako pierwszoklasowy widok Portfela dla gospodarstwa
  (spina Zakupy/Portfel/rodzinę).
- **Z-197** *(P1 · S)* — **Indeksy i limity dla zapytań zespołowych** (`teamId`/członkostwa) pod skalę
  (spójne z Z-031).
- **Z-198** *(P2 · L)* — **Ochrona małoletnich** (role dziecka, zgoda rodzica, ograniczenia AI/treści)
  — z prawnikiem; warunek funkcji rodzicielskich.

## Dobre vs złe praktyki

**Dobre:**
- Elegancki, spójny wzorzec własności 3-poziomowej z helperami i wzorcem `OR(owner, team)`.
- Współdzielenie per-encja (VIEWER/EDITOR) i członkostwo projektu ponad własnością.
- Zaproszenia do zespołów już istnieją (fundament pod rodzinę/grupy).

**Złe / do poprawy:**
- Niespójna team-awareness między modułami (część dzieli, część nie).
- Trzy równoległe mechanizmy współdzielenia bez wspólnego języka/wejścia → zamęt.
- Brak presetu „rodzina/gospodarstwo” i granularnych ról B2B — niewykorzystany motor wzrostu.
- Izolacja tenantów niezweryfikowana testami — ryzyko wycieku przy skali.
