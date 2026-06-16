-- Raport 1:1 z realizacji zaleceń audytu (Dodatek A) — produkt końcowy sesji.
-- Idempotentny INSERT z dollar-quoting; ON CONFLICT (slug) DO NOTHING (slug globalnie unikalny).
-- Żywy, zawsze aktualny status każdego Z-NNN żyje w /admin/audyt (Dodatek A.13) — ten raport
-- jest migawką kamienia milowego: domknięcie wszystkich P0.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Realizacja audytu 2026-06-16: wszystkie P0 domknięte',
  'omnia-realizacja-audytu-2026-06-16',
  $realizacja_audytu$# Omnia — Realizacja audytu (Dodatek A) — raport 1:1

**Stan na 2026-06-16.** Sesja realizuje zalecenia `Z-NNN` z audytu w zalecanej kolejności (rozdz. 47),
małymi partiami (osobny commit, zielony `tsc`/`next build`, testy), z żywym trackerem statusu w
**`/admin/audyt` → „Status wdrożeń (żywy)" (Dodatek A.13)** — to jedno źródło prawdy 1:1, zawsze aktualne.

## Podsumowanie
- **P0: 22/22 ✅ (100%)** — cała „brama przed publicznym startem" (Bramy 1–3 + zalecenia modułowe) domknięta.
- **P1/P2:** realizowane dalej tą samą pętlą; bieżący licznik w Dodatku A.13.
- Każda zmiana: zielony build + testy; nowe testy izolacji (BOLA/IDOR), płatności i paginacji; CI (GitHub Actions) jako bramka.

## P0 — Brama 1 (prawno-bezpieczeństwowa)
| ID | Zalecenie | Status |
|---|---|---|
| Z-052 | Audyt autoryzacji Server Actions (anty-IDOR) — domknięto lukę zadań bez projektu | ✅ |
| Z-190 | Izolacja tenantów (owner/team) — zweryfikowana | ✅ |
| Z-050 | Eksport danych użytkownika (RODO 15/20) | ✅ |
| Z-051 | Twarde usunięcie konta (RODO 17) | ✅ |
| Z-172 | Testy izolacji BOLA/IDOR | ✅ |
| Z-173 | Testy płatności i sporów (Usługi) | ✅ |
| Z-053 | Mechanika zgód + strony prawne + rejestr podprocesorów (treść prawna ⏸️ — prawnik) | ✅ |

## P0 — Brama 2 (operacyjna)
| ID | Zalecenie | Status |
|---|---|---|
| Z-030 | Indeksy owner/team w modelach multi-tenant | ✅ |
| Z-341 | Indeksy magazynu (zweryfikowane) + helper keyset | ✅ |
| Z-070 | Paginacja keyset (helper + log audytu) | ✅ |
| Z-111 | Granice błędu (error.tsx / global-error.tsx / 404) | ✅ |
| Z-090 | Health endpoint + instrumentacja (Sentry DSN/uptime/alert ⏸️ — właściciel) | ✅ |
| Z-171 | Alias `@/` w runnerze testów | ✅ |
| Z-170 | CI GitHub Actions (typy, testy, strażniki, build) | ✅ |
| Z-430 | E2E smoke w CI (nieblokujący do walidacji na runnerze) | ✅ |

## P0 — Brama 3 (kosztowa AI) + modułowe
| ID | Zalecenie | Status |
|---|---|---|
| Z-130 | Trwały budżet AI per user/plan (`AiUsage`) | ✅ |
| Z-511 | Twarde limity per plan + cache odpowiedzi LLM | ✅ |
| Z-510 | Ekonomika jednostkowa (`/admin/metrics`; ARPU/CAC/LTV ⏸️ — dane billingu) | ✅ |
| Z-210 | Ochrona agenta AI przed prompt-injection | ✅ |
| Z-211 | Gwarantowane zwolnienie slotu współbieżności AI | ✅ |
| Z-270 | Dane zdrowotne: AI opt-in (privacy-by-default); field-encryption ⏸️ | ✅ |

## Świadomie odłożone (⏸️) — wymagają decyzji właściciela / prawnika / infrastruktury
- **Z-053:** treść prawna polityki prywatności i regulaminu (wersja robocza gotowa; wymaga prawnika/DPO).
- **Z-090:** DSN Sentry + zewnętrzny uptime-monitor + alert 5xx (kod gotowy; konfiguracja właściciela).
- **Z-510:** ARPU/CAC/LTV (po wdrożeniu warstwy płatności/marketingu — P1).
- **Z-270:** field-encryption wrażliwych pól zdrowotnych (at-rest na poziomie Neon już jest); „zero reklam" = polityka.

## Główne obszary zmian
- Bezpieczeństwo/RODO: `assertTaskAccess`, `privacy.ts` (eksport+usunięcie), zgody (`UserConsent`), strony `/legal/*`.
- Skala/operacje: indeksy (migracje 0186), keyset (`lib/pagination.ts`), granice błędu, `/api/health`, CI.
- Koszty AI: `AiUsage` (budżet/plany), cache LLM, `/admin/metrics`, ochrona agenta, opt-in zdrowia.

## Jak kontynuować
Otwórz **`/admin/audyt` → Dodatek A.13 (Status wdrożeń)** — weź pierwsze `⬜/🟡` w zalecanej kolejności i
realizuj dalej tą samą pętlą (plan A.2–A.12 → minimalna zmiana → build/testy → commit → status). Ten
raport zostaje migawką domknięcia P0; bieżący, pełny status 1:1 jest w trackerze.
$realizacja_audytu$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
