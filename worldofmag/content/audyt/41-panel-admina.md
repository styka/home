# Rozdział 41 — Panel Admina

## Kontekst / stan z kodu

Bogaty zestaw narzędzi administracyjnych (`src/app/admin/*`, bramka `module.admin`):

- **`/admin`** — konsola (build info, sesja, metryki, linki).
- **`/admin/access`** — RBAC (`PermissionManager`): uprawnienia, grid rola↔uprawnienie, user↔rola;
  **strażnik samo-wykluczenia** (`access.ts` `countAdminAccessHolders`).
- **`/admin/audit`** — dziennik audytu (`AuditLog`, bez FK do User).
- **`/admin/health`** — zdrowie systemu (DB/migracje/LLM/build, liczone na żywo).
- **`/admin/config`** — `Config` (klucze API, **szyfrowane + maskowane**).
- **`/admin/llm`** — `LlmProvider` + `LlmAssignment` (model per typ operacji).
- **`/admin/skins`, `/admin/categories`, `/admin/reports`, `/admin/docs`, `/admin/qa`,
  `/admin/playground`, `/admin/architecture`, `/admin/e2e`** — oraz **`/admin/audyt`** (ten dokument).

## Mocne strony

- **Pełen, dojrzały panel** (RBAC, audyt, config, LLM, health, docs) — poziom dojrzałego produktu.
- **Bezpieczeństwo wbudowane:** szyfrowanie kluczy, maskowanie, strażnik samo-wykluczenia, audyt zmian.
- **Zdrowie systemu na żywo** + dziennik audytu — początek observability (uzupełnić Sentry, Z-090).

## Głos Zespołu A — Strażnicy

**Anna (security):** „Panel admina to **najwyższy poziom uprawnień** — każda akcja admina musi być w
`AuditLog` (jest dla RBAC/config; potwierdzić pokrycie). I **zasada najmniejszego przywileju**: czy
wszystko musi wymagać pełnego `module.admin`, czy część można rozdzielić (np. moderacja vs RBAC)?”

**Piotr (SRE):** „`/admin/health` to dobry start, ale przy skali potrzebujemy **alertów** (nie tylko
podglądu na żądanie) — spiąć z observability (Z-090/Z-096).”

## Głos Zespołu B — Pionierzy

**Wojtek (PO):** „Panel jest mocny — rozwińmy go o **wgląd biznesowy**: metryki MAU/konwersja/koszt AI
(Z-510/Z-135) w jednym miejscu. Admin powinien widzieć »jak idzie biznes«, nie tylko »czy DB żyje«.”

**Kamil (DevOps):** „**Feature flags z panelu** (włączanie funkcji/branż per user/zespół) — to przyspiesza
eksperymenty i etapowe wdrożenia (spójne z presetami nakładek, Z-491).”

## Punkty sporne

- **Granularność uprawnień admina.** **Konsensus:** rozważyć pod-uprawnienia (moderacja, finanse,
  RBAC) zamiast jednego `module.admin` — pod rosnący zespół (obsada cyklu życia, Rozdz. 4).

## Głos użytkowników

— (panel wewnętrzny; „użytkownikiem” jest właściciel/zespół operacyjny.)

## Konsensus i zalecenia

- **Z-460** *(P1 · S)* — **Potwierdzić pełne pokrycie `AuditLog`** dla akcji admina (nie tylko RBAC/config).
- **Z-461** *(P1 · M)* — **Panel metryk biznesowych** (MAU, konwersja, koszt AI — Z-510/Z-135) obok zdrowia DB.
- **Z-462** *(P2 · M)* — **Pod-uprawnienia admina** (moderacja/finanse/RBAC) — najmniejszy przywilej pod zespół.
- **Z-463** *(P2 · M)* — **Feature flags z panelu** (per user/zespół) — etapowe wdrożenia i branże (Z-491).
- **Z-464** *(P1 · S)* — **Alerty z `/admin/health`** (spiąć z Sentry/observability, Z-090).

## Dobre vs złe praktyki

**Dobre:** pełny panel (RBAC/audyt/config/LLM/health), szyfrowanie+maskowanie, strażnik samo-wykluczenia,
audyt zmian.
**Złe / do poprawy:** jeden poziom `module.admin` (brak granularności); health bez alertów; brak metryk
biznesowych w panelu.
