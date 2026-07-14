# PROMPT KONTYNUACJI — wklej w nowej sesji (WorldOfMag / Omnia, realizacja audytu)

Przejmujesz kontynuację wdrażania zaleceń audytu projektu **WorldOfMag (Omnia)**. Poniżej masz wszystko, by się odnaleźć i działać dalej dokładnie wg ustalonej kolejności.

## 0. Najpierw przeczytaj (orientacja)
1. `CLAUDE.md` (korzeń repo) — zasady projektu + wskaźniki do trackerów i lekcji.
2. **GŁÓWNY TRACKER:** `worldofmag/content/audyt/64-plan-tracker.md` (Dodatek **A.16 — TRACKER ROBOCZY**) — stąd bierzesz następne zadanie.
3. `worldofmag/content/audyt/63-raport-stanu.md` (A.15) — migawka „zrobione / zostało + akcje właściciela".
4. Ostatnie wpisy `doświadczenia.md` (korzeń, PL) — pułapki, których nie powtarzaj.

## 1. Gdzie jest audyt i trackery
- Audyt: `worldofmag/content/audyt/*.md` + `manifest.json`, renderowany w apce pod `/admin/audyt`.
  - Zalecenia `Z-NNN`: rozdziały `06–15-*.md` (przekrojowe), `16–41-*.md` (moduły); plany wdrożeń `48–58-*.md` (A.2–A.12).
- **Trackery (Dodatek A):**
  - **A.16 `64-plan-tracker.md` = NASZ GŁÓWNY, ŻYWY TRACKER** — zadania `T-01..T-25` od najprostszych do najtrudniejszych, statusy do odhaczania, podział na ETAP-y. Zawiera też WSZYSTKIE decyzje właściciela (przeniesione z dawnego A.14). **Tu aktualizujesz postęp.**
  - A.15 `63-raport-stanu.md` — raport „co zrobione / co zostało".
  - A.13 `60-status-wdrozen.md` — szczegółowy dziennik per `Z-NNN` (historia).
  - A.14 `62-decyzje-wlasciciela.md` — już TYLKO wskaźnik → wszystko w A.16. Nie używaj.
- Lekcje: `doświadczenia.md` (korzeń, PL — dopisuj nowe przy każdym nietrywialnym fixie).

## 2. Legenda statusów (A.16)
⬜ TODO · 🟡 ruszone-niedokończone (często czeka na weryfikację po deployu) · 🔓 czeka na właściciela (decyzja/konto/klucz/konfiguracja) · ⏸️ odłożone · ✅ zrobione.
Kto: 🧑‍💻 = Claude (kod) · 👤 = akcja właściciela · 🤝 = Claude robi, właściciel weryfikuje po deployu.

## 3. Gałąź i tryb pracy
- Gałąź robocza: **`claude/eager-carson-zwryc5`** (utwórz lokalnie z `origin/develop` jeśli trzeba).
- Domyślnie: commituj na gałąź roboczą, **NIE scalaj do `develop`** (scalenie = deploy Render, oszczędzamy minuty pipeline). Scal do `develop` (fast-forward, bez force) TYLKO gdy właściciel powie **„zrób deploy"**.
- **NIGDY na `master`** (prod). Częste, małe commity. Komunikaty po polsku.

## 4. Pętla per zadanie (tak realizujesz każde T-NN z A.16)
1. Weź pierwsze sensowne ⬜/🟡 zadanie wg kolejności ETAP-ów; pomijaj 🔓 (czekają na właściciela) i ✅.
2. **NAJPIERW udowodnij grepem realnego kodu, że NIE jest już zrobione** — kilka zaleceń okazało się spełnionych istniejącą architekturą (lekcja 2026-06-27). Jeśli zrobione → ✅ z notą, zero kodu.
3. Implementuj minimalnie i spójnie z konwencjami: Server Actions + `revalidatePath`; własność `ownerId`/`ownerTeamId`; statusy = `String` + unia TS (NIGDY enum Prisma); zmiana schematu = RĘCZNA migracja (`prisma/migrations/NNNN_nazwa/migration.sql`, numer z `npm run next:migration`).
4. **Weryfikuj LOKALNIE (bez deployu):** `./node_modules/.bin/tsc --noEmit` + `node --import tsx --test "src/**/*.test.ts"` (z lokalnym Postgresem). Czego nie zweryfikujesz lokalnie (UI/zachowanie) — dopisz do checklisty „po deployu" w zadaniu **T-01** w A.16.
5. Zmień status w A.16. Przepiecz książkę: z katalogu `worldofmag` → `node scripts/copy-audyt.js` (regeneruje `src/generated/audyt-book.ts`). Nietrywialny problem → lekcja do `doświadczenia.md`.
6. Commit na gałąź roboczą (tracker + kod + regen razem).

## 5. Środowisko / weryfikacja (z lekcji — ważne)
- Lokalny Postgres: `pg_ctlcluster 16 main start`; rola/baza `omnia/omnia_dev`; `export DATABASE_URL="postgresql://omnia:omnia@127.0.0.1:5432/omnia_dev"` oraz `export DIRECT_URL="$DATABASE_URL"`. Migracje lokalnie: `./node_modules/.bin/prisma migrate deploy`.
- **Prisma: używaj lokalnego `./node_modules/.bin/prisma`** (NIE `npx prisma` — ściąga prisma 7). Strażniki: `npm run check:migrations`, `npm run check:actions`.
- **NIGDY `npm run build` ani `node scripts/migrate.js` lokalnie** — piszą do PROD-Neon. Do typów/komponentów wystarcza `tsc --noEmit`.
- Testy: `node --import tsx --test "src/**/*.test.ts"` (alias `@/` działa przez tsx). DB-gated wymagają `DATABASE_URL`.
- Audyt MD → po edycji ZAWSZE `node scripts/copy-audyt.js` i commituj też `src/generated/audyt-book.ts`.

## 6. STAN — gdzie stanęliśmy (2026-06-27, develop @ e72603d)
- **ETAP 0 — T-01 🟡 (czeka na właściciela PO DEPLOYU):** zweryfikować wizualnie 22 modale (`ui/Modal`), EmptyState, polskie slugi `/providers/…` (fix ł→l), kartę „Diagnostyka zapytań" w `/admin/health`, świeżość cache kalendarza (≤60 s). Po OK → ✅.
- **ETAP 1 — T-02..T-05 🔓 (czekają na decyzje właściciela):** ESLint kierunek (Z-011/015), DnD zakupów (Z-221), reguła zespołu przy usuwaniu konta (Z-051), model reklam (Z-474).
- **ETAP 2 — ✅:** T-06 (diagnostyka EXPLAIN /admin/health, Z-037), T-07 (tańszy dispatch — już spełnione architekturą operationType, Z-134), T-08 (testy katalogu warsztatów).
- **ETAP 3 — w toku:** T-09 ✅ (cache kalendarza `unstable_cache` per-user 60 s, Z-072), T-10 🟡 (rdzeń `src/lib/sharing/capabilities.ts` + testy gotowe; **zostaje UI ujednoliconego „Udostępnij"**, Z-193). **➡️ KONTYNUUJ OD: T-11 ⬜ (wirtualizacja długich list `@tanstack/react-virtual`, Z-071 — wymaga `npm install`) i T-12 ⬜ (granularne role w zespole: model na `TeamMember` + helper `canMemberAccessModule` [testowalny rdzeń] + egzekwowanie + UI, Z-194).**
- **ETAP 4 — T-13/14/15 🔓:** Sentry DSN+uptime (Z-090), PITR Neon + release-command (Z-092/093), OAuth Gmail/Calendar (Z-150/151/156).
- **ETAP 5 — T-16/17/18 ⬜ (trudne):** FTS notatek (Z-240 — uwaga: walczy z driftem Prisma), kolejka Job AI (Z-131), i18n (Z-115).
- **ETAP 6 — T-19..T-25 🔓:** treść prawna (Z-053), płatności+cennik (Z-473/470), field-encryption zdrowia (Z-270), 2FA (Z-058), vertical (Z-490), ARPU/CAC/LTV (Z-510), strategia/marketing.

## 7. Następny ruch
Kontynuuj **ETAP 3**: jeśli `npm install @tanstack/react-virtual` przejdzie przez proxy — zrób **T-11** (owiń najdłuższą listę, np. magazyn/kontakty, w wirtualizer; wzorzec do powielenia). Dowieź też **rdzeń T-12** (`canMemberAccessModule` + testy — weryfikowalny lokalnie). Potem dalej wg A.16. Po skończonej partii zapytaj właściciela o „zrób deploy".

## 8. Jeśli narzędzia Edit/Write padają („Tool permission stream closed")
To glitch środowiska (nie kod). Albo rób zapisy plików przez Bash (heredoc/python), albo — najlepiej — zacznij od nowa świeżą sesję (usterka znika przy nowym kontenerze).

---
START: przeczytaj `CLAUDE.md` + A.16 (`64-plan-tracker.md`) + ostatnie wpisy `doświadczenia.md`, potwierdź krótko gdzie stoimy i kontynuuj wg kolejności. Do dzieła.
