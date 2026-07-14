# Runbook: deploy, migracje, rollback i DR (Z-092 / Z-093)

> Operacyjny runbook dla Omnia (Render + Neon). Cel: deploy bez „ślepych" niespodzianek,
> jasna granica **build ↔ migracja**, oraz przećwiczona procedura cofania zmian.

## 1. Granica build ↔ migracja (Z-092)

**Artefakt buildu jest niezależny od bazy.** Samo `next build` (kompilacja) **nie wymaga
połączenia z DB** — wszystkie strony danymi są `force-dynamic`, więc renderują się dopiero
na żądanie. To, co dotyka bazy, jest **osobnym krokiem**:

| Krok | Komenda | Dotyka DB? |
|---|---|:--:|
| Kompilacja artefaktu | `npx next build` (lub `./node_modules/.bin/next build`) | **nie** |
| Strażniki | `npm run check:actions`, `npm run check:migrations` | nie |
| Migracja schematu | `prisma migrate deploy` (w repo: `scripts/migrate.js` / `npm run db:migrate`) | **tak** |
| Seed | `npm run db:seed` | tak |

> ⚠️ `npm run build` **łączy** kompilację z `scripts/migrate.js` (migracja + seed) w jednym
> poleceniu — wygodne na Render free tier, ale **miesza artefakt z migracją**. Docelowo
> (Z-092) migrację należy przenieść do **release command** Rendera (osobny krok przed startem
> instancji), zostawiając `build` tylko na `next build`. Do tego czasu: **nigdy nie
> uruchamiaj `npm run build` lokalnie z prod-owym `DATABASE_URL`** — uruchomi `migrate deploy`
> + seed na realnej bazie.

**Weryfikacja buildu bez bazy (lokalnie/CI):** w CI (`.github/workflows/ci.yml`) build to
`copy-docs → copy-audyt → prisma generate → npx next build` — bez `migrate.js`. Migracje CI
robi osobnym krokiem na bazie testowej.

## 2. Procedura deployu

1. Scal pracę do gałęzi integracyjnej (`develop` → test env; `v2` → kolejna linia; `master` → prod).
2. CI (`verify`) musi być **zielone**: typy + testy + strażniki + build.
3. Render auto-deployuje z `master` (prod) / `develop` (test). Build odpala migracje (patrz wyżej).
4. Po deployu: **smoke** — sprawdź `/api/health` (200 + ping DB) i kilka kluczowych tras
   (`/`, `/tasks`, `/shopping`). (Z-095 — automatyzacja smoke z alertem = follow-up.)

## 3. Rollback (Z-092)

Rozróżnij **rollback kodu** od **rollback migracji** — to dwie różne osie.

### 3a. Rollback kodu (bez zmian schematu)
- Render: „Rollback to previous deploy" (poprzedni artefakt) **albo** `git revert` problematycznego
  commita → push do `master` (auto-deploy). Preferuj `revert` (zachowuje historię), nie force-push.

### 3b. Rollback migracji (zmiana schematu poszła źle)
Migracje są **forward-only** w `migrate deploy` (Prisma nie ma `down`). Dlatego:
1. **Najpierw napraw „w przód", jeśli się da** — nowa migracja korygująca (np. `DROP INDEX`,
   `ALTER ... `). To bezpieczniejsze niż cofanie na żywej bazie.
2. Jeśli migracja **częściowo się wykonała i wpis jest „failed"** w `_prisma_migrations`:
   `prisma migrate resolve --rolled-back <nazwa_migracji>` (oznacz jako cofniętą), popraw plik
   `migration.sql` (idempotentnie: `IF NOT EXISTS` / `IF EXISTS`), wdroż ponownie. (Patrz
   `doświadczenia.md` — lekcja o migracji `0186` i dryfcie schema↔DB.)
3. **Nigdy nie przenumerowuj** już zaaplikowanej migracji — `migrate deploy` kluczuje po nazwie
   katalogu, więc zmiana nazwy = ponowne uruchomienie (CREATE/ALTER → błąd). Duplikaty prefiksów
   zostawiamy; poprawiamy tylko na przyszłość (`npm run next:migration`).
4. **Destrukcyjna migracja** (DROP/utrata danych) → patrz DR poniżej (PITR przed wdrożeniem).

## 4. Backup / Disaster Recovery (Z-093)

- **Backup:** Neon utrzymuje historię (PITR — point-in-time restore) w oknie retencji planu.
  Zweryfikuj w panelu Neona, że PITR jest **włączony** i jakie jest **okno** (free tier bywa krótkie).
- **Restore (do przećwiczenia):** w Neonie utwórz **branch z punktu w czasie** sprzed incydentu,
  zweryfikuj dane, przełącz `DATABASE_URL`/`DIRECT_URL` na przywróconą gałąź. Branching Neona daje
  szybkie, bezpieczne odtworzenie bez ruszania głównej gałęzi.
- **RPO/RTO (do ustalenia z właścicielem — pozycja decyzyjna):**
  - RPO (akceptowalna utrata danych) — zależne od okna PITR Neona.
  - RTO (czas powrotu) — zależny od ręcznego restartu/przełączenia.
  - ⏸️ **Wymaga decyzji/infrastruktury:** wybór planu Neona z odpowiednim oknem PITR + **jednorazowe
    przećwiczenie restore** i wpisanie zmierzonych RPO/RTO tutaj.

## 4a. Sekrety i szyfrowanie kluczy (Z-054)

Klucze API (Groq, Brave, ORS…) są **szyfrowane w spoczynku** (`src/lib/crypto/secrets.ts`,
AES-256-GCM, prefiks `enc:v1:`). Klucz szyfrujący jest wyprowadzany z env
**`CONFIG_SECRET`** (a gdy brak — z **`AUTH_SECRET`**).

**Zasady:**
- **Sekret musi być STAŁY** i trzymany w **menedżerze sekretów Render** (env), **nigdy w repo**.
- **Rotacja `CONFIG_SECRET`/`AUTH_SECRET` bez re-szyfrowania = utrata wszystkich kluczy** —
  `decryptSecret` zwróci wtedy `""` (zły klucz), więc integracje przestaną działać.
- Bez ustawionego sekretu używany jest **deterministyczny, niebezpieczny fallback**
  (`omnia-insecure-fallback`) — `/admin/health` pokazuje wtedy check
  „Szyfrowanie sekretów" jako **czerwony** (`isSecretConfigured() === false`). Na prod **musi być
  zielony**.

**Procedura rotacji (gdy konieczna):** dopóki sekret jest stały — nie ruszać. Jeśli trzeba zmienić:
1. Skrypt: odczytaj wszystkie sekrety (`Config`, `LlmProvider.apiKey`), `decryptSecret` starym kluczem.
2. Ustaw nowy `CONFIG_SECRET`.
3. `encryptSecret` nowym kluczem i zapisz. Dopiero potem usuń stary.
(Wartości plaintext bez prefiksu `enc:v1:` są wstecznie kompatybilne — zaszyfrują się przy pierwszym zapisie.)

## 5. Checklist przed ryzykownym deployem
- [ ] CI zielone (verify).
- [ ] Migracja idempotentna (`IF [NOT] EXISTS`, dollar-quoting przy seedach SQL).
- [ ] Przy migracji destrukcyjnej: świeży PITR/branch Neona „na wszelki wypadek".
- [ ] Plan rollbacku kodu (revert) i migracji (forward-fix) ustalony **przed** wdrożeniem.
- [ ] Po deployu: `/api/health` 200 + smoke kluczowych tras.
