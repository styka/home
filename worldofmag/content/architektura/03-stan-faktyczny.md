# Punkt wyjścia — Omnia dzisiaj

> Liczby **policzone z kodu**, nie odtworzone z pamięci. Bez tej podstawy każda rekomendacja
> architektoniczna jest zgadywaniem.

## 1. Skala kodu

| Wymiar | Wartość | Pomiar |
|--------|---------|--------|
| Modele Prisma | **147** | `grep -c "^model " prisma/schema.prisma` |
| Migracje | **223** | `prisma/migrations/` |
| Akcje serwerowe (mutacje + odczyty) | **545** | bramka `check:ai-coverage` |
| Akcje wystawione asystentowi AI | **160** | bramka `check:actions` |
| Moduły w rejestrze | **21** | `src/lib/modules.tsx` |
| Pliki testów | **90** | `find src -name "*.test.ts"` |
| Modele z `ownerId` | 46, w tym **45 z indeksem** | analiza schematu |
| Pliki wołające model LLM | **34** | bramka `check:cost-badge` |
| Pliki z `revalidatePath` | **68** | `src/actions/` |

To rozmiar, przy którym typowa aplikacja komercyjna ma zespół 5–10 osób i dedykowanego architekta.
Omnię utrzymuje **jedna osoba plus Claude Code** — i ta okoliczność jest kluczowa przy wyborze
architektury (rozdział 6).

## 2. Co jest zrobione dobrze i czego NIE wolno zepsuć

Lista rzeczy, które przy nieostrożnym refaktorze łatwo utracić, a które są warunkiem powodzenia
całej przebudowy.

### 2.1. Kolejka zadań jest bezpieczna przy wielu instancjach

`src/lib/jobs/queue.ts` używa `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` z widocznością
(przejęcie zadań porzuconych po awarii), ponowieniami z wykładniczym odczekaniem i sprzątaniem.
**Kilka instancji nie wykona tego samego zadania dwa razy.**

To zdejmuje największą typową przeszkodę przed skalowaniem poziomym — wiele projektów tego rozmiaru
ma tu `setInterval` bez blokady i odkrywa problem dopiero pod obciążeniem.

### 2.2. Bramki jakości wymuszają kompletność, nie tylko poprawność

**To jest najcenniejszy mechanizm w repozytorium.** Nowa architektura ma go rozszerzyć, nie porzucić.

| Bramka | Co wymusza |
|--------|------------|
| `check:ai-coverage` | każda z 545 akcji ma zadeklarowany zakres dostępu **i realny guard w kodzie** |
| `check:action-coverage` | każda akcja AI ma egzekutor i kontrakt z etykietami PL |
| `check:cost-badge` | każde wywołanie modelu przekazuje zużycie tokenów |
| `check:content-memory` | każda generacja AI jest świadomie sklasyfikowana |
| `check:migrations` | brak kolizji numerów migracji |

Różnica wobec lintu jest zasadnicza: lint pilnuje, żeby napisany kod był poprawny; te bramki pilnują,
żeby **nie dało się zapomnieć o czymś, co trzeba dopisać gdzie indziej**. Przy 545 akcjach to jedyny
mechanizm, który realnie działa.

### 2.3. Pozostałe mocne strony

- **Model własności** `ownerId`/`ownerTeamId` — jednolity w 46 modelach, z testem izolacji.
- **Rate-limiting AI** — 20/min, 250/h, maks. 2 równoległe; z uczciwym komentarzem, że wymaga Redisa
  przy skali.
- **Routing modeli LLM sterowany bazą** (`/admin/llm`) z rozliczaniem kosztów i pamięcią treści.
- **Stan widoku w adresie** (wersja 043) — 17 widoków, jeden wspólny mechanizm.
- **Rejestr skrótów klawiszowych z pierwszeństwem strony** (wersja 043).
- **Kosz z retencją** i **dziennik audytowy** RBAC/konfiguracji.

## 3. Współdzielenie zasobów — stan zastany

To najsłabiej ujednolicony obszar aplikacji i główny powód, dla którego rozdział 8 istnieje.

### 3.1. Pięć mechanizmów, trzy słowniki ról

| Mechanizm | Zakres | Role | Model |
|-----------|--------|------|-------|
| `ownerTeamId` | ~46 modeli | brak (członkostwo w zespole = pełny dostęp) | kolumna |
| `TeamMember` | zespół | `MEMBER` \| `ADMIN` \| `OWNER` + JSON dozwolonych modułów | tabela |
| `TaskProjectMember` | projekt zadań | `MEMBER` \| `ADMIN` \| `OWNER` | tabela |
| `TaskShare` | pojedyncze zadanie | `VIEWER` \| `EDITOR` | tabela |
| `PetShare` | zwierzę | `VIEWER` \| `EDITOR` | tabela |
| `ServiceStaff` | firma w marketplace | `String?` (**nullable**) | tabela |

**Konsekwencje, które już są odczuwalne:**

1. **Tylko 3 z 21 modułów** mają udostępnianie per zasób (Zadania, Zwierzęta, częściowo Usługi).
   Notatki, listy zakupów, przepisy, magazyn, warsztaty — **tylko przez zespół albo wcale**.
2. **Dwa różne słowniki ról** znaczą to samo (`MEMBER`/`EDITOR`, `ADMIN`/`OWNER`) — ale kod traktuje
   je osobno, więc każde sprawdzenie uprawnień jest pisane od nowa.
3. **Brak zaproszeń per zasób** — udostępnić można tylko istniejącemu użytkownikowi.
4. **Brak dziedziczenia** — udostępnienie projektu nie udostępnia jego zadań w sposób jawny;
   każdy moduł rozwiązuje to po swojemu.
5. **Brak wglądu** — użytkownik nie ma jednego miejsca „co udostępniłem i komu" ani „co mi
   udostępniono".

### 3.2. Brak kontroli współbieżności

**Żaden model nie ma kolumny wersji.** Każdy zapis to `UPDATE … SET …` — czyli **ostatni zapis
wygrywa, po cichu**.

Przy dwóch użytkownikach niewidoczne. Przy współdzielonym projekcie zadań i dwóch osobach
pracujących równolegle — **cicha utrata pracy**, bez śladu w interfejsie i bez możliwości odzyskania.

## 4. Gdzie boli sprzężenie modułów

Moduły wołają się bezpośrednio. Pomiar importów `src/actions/* → src/actions/*`:

| Cel importu | Liczba modułów importujących |
|-------------|------------------------------|
| `activity` | 17 |
| `lists` | 6 |
| `pets` | 3 |
| `tasks`, `taskProjects`, `products`, `categoryIcons` | po 2 |

Do tego Kalendarz agreguje **sześć** modułów, a asystent AI sięga do **wszystkich**.

**Dodanie modułu nr 22 wymaga dotknięcia ośmiu miejsc:** rejestr modułów, uprawnienia, nawigacja
desktop, tab bar mobilny, kalendarz, katalog akcji AI, kontrakt akcji, manifest pokrycia, pulpit.
Żadne nie jest wymuszone typami — pilnują tego bramki, ale **dopiero przy buildzie**.

## 5. Dług UI

Aplikacja ma dobry motyw (zmienne CSS, skórki) i jednolitą powłokę, ale **nie ma systemu
komponentów**. Nagłówek strony, stan pusty, potwierdzenie, formularz — pisane od nowa w każdym module.

**Konkretny, udokumentowany przykład:** w wersji 043 właściciel poprosił, żeby przycisk zapisu widoku
był „wyraźnie widoczny w pasku bieżącego widoku". Nie dało się — **w Omnii nie ma wspólnego paska
widoku**. Alternatywą było przebudowanie nagłówków w ~20 modułach, więc przycisk trafił na górę
nawigacji, a odstępstwo odnotowano w recenzji. **Ta przebudowa spłaca ten dług** (rozdział 10.4).
