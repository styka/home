# Rozdział 37 — Raporty (Reports)

## Kontekst / stan z kodu

- **Rdzeń:** `src/actions/reports.ts` (w tym `createUserReport` — raporty per-user dla sesji AI); model
  `Report` (`storage` = `db|drive`, hydracja transparentna na odczycie).
- **Treść:** markdown renderowany `markdownToHtml`; przechowywana w DB **lub** na Google Drive
  użytkownika (fallback do DB gdy brak Drive).
- **Zakres:** raporty systemowe/użytkownika/zespołu; CRUD admina (`/admin/reports`), widok `/reports`.
- **Ten audyt** to pokrewny wzorzec (markdown w repo), ale **świadomie poza** modułem Reports (w plikach,
  nie w DB).

## Mocne strony

- **Dwa magazyny treści (DB/Drive)** z transparentną hydracją — elastyczność i własność danych usera.
- **Raporty per-user dla AI** (`createUserReport`) — asystent może utrwalić analizę bez uprawnień admina.
- Wspólny, bezpieczny renderer markdown.

## Głos Zespołu A — Strażnicy

**Grzegorz (delivery):** „Brakuje **eksportu PDF** (R3) — wzorzec gotowy (print-to-PDF jak `petExport`).
Raport, którego nie da się wysłać/wydrukować, ma ograniczoną wartość biznesową.”

**Anna (security):** „Raporty na Drive = tokeny OAuth usera; potwierdzić autoryzację odczytu (anty-IDOR)
i obsługę braku/wygaśnięcia tokenu (graceful).”

## Głos Zespołu B — Pionierzy

**Hubert (AI/ML):** „Raporty to **naturalny produkt AI**: asystent generuje raport (mamy `createUserReport`),
user go edytuje/eksportuje/udostępnia. Dołóżmy **szablony** (miesięczne podsumowanie finansów, zdrowia,
projektu) generowane automatycznie.”

## Punkty sporne

- **Reports vs ten audyt (DB vs pliki).** **Konsensus:** dane dynamiczne/per-user → Reports (DB/Drive);
  dokumenty „kodu/projektu” (jak audyt) → pliki w repo. Dwa różne cele, oba zasadne.

## Głos użytkowników

**Tadeusz (60):** „Raport miesięczny do PDF dla księgowej — to bym chciał.”

## Konsensus i zalecenia

- **Z-420** *(P2 · S)* — **Eksport PDF raportów** (R3): print-to-PDF (wzorzec `petExport`/`buildVetCardHtml`).
- **Z-421** *(P1 · S)* — **Autoryzacja + graceful dla raportów na Drive** (anty-IDOR, brak/wygaśnięcie tokenu).
- **Z-422** *(P2 · M)* — **Szablony raportów AI** (miesięczne: finanse/zdrowie/projekt) generowane automatycznie.
- **Z-423** *(P2 · S)* — **Udostępnianie raportu** (link/zespół) z kontrolą dostępu.

## Dobre vs złe praktyki

**Dobre:** dwa magazyny (DB/Drive) z hydracją, raporty AI per-user, bezpieczny renderer.
**Złe / do poprawy:** brak eksportu PDF; autoryzacja Drive do potwierdzenia; brak szablonów automatycznych.
