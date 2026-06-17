# Dodatek A.13 — Status wdrożeń (żywy)

> **Plik aktualizowany per‑zalecenie, PRZED każdym commitem.** Jedno źródło prawdy do wznawiania sesji
> po przerwie (np. brak tokenów) i do końcowego Raportu 1:1.
>
> **Jak wznowić sesję:** otwórz tę tabelę, weź pierwszą pozycję ze statusem 🟡/⬜ w zalecanej kolejności,
> zajrzyj do jej planu (Dodatek A.2–A.12) i rozdziału źródłowego, rób dalej tą samą pętlą.
>
> **Legenda:** ✅ ZROBIONE · 🟡 W TOKU · ⏸️ ODŁOŻONE (powód) · ⬜ TODO
>
> **Polityka weryfikacji partii:** zmiany dotykające `src/app/**` (trasy), komponentów,
> `next.config`/migracji → pełny `./node_modules/.bin/next build`. Zmiany czysto logiczne
> (`src/actions/**`, `src/lib/**`, testy) → `tsc --noEmit` (to krok typów z buildu) + `npm run test:unit`.
> Zawsze: `check:actions` + `check:migrations`. Testy DB‑gated odpalają się z `DATABASE_URL` (lokalnie + CI z Postgresem).

## Postęp ogólny
| Priorytet | Razem | ✅ | 🟡 | ⏸️ | ⬜ |
|---|:---:|:---:|:---:|:---:|:---:|
| P0 | 22 | 22 | 0 | 0 | 0 |
| P1 | 129 | 3 | 1 | 0 | 125 |
| P2 | 95 | 0 | 0 | 0 | 95 |

---

## P0 — w zalecanej kolejności realizacji (rozdz. 47)

### Brama 1 — prawno‑bezpieczeństwowa
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-052 | M | ✅ | 2026-06-16 | `src/actions/tasks.ts` | Audyt 57 plików akcji (skan plik+funkcja). 9/10 podejrzanych = false‑positive (auth+`userId`, `hasPermission(ADMIN)`, `assertCanEditSkin`). Realna luka: zadania `projectId=null` omijały guard → helper `assertTaskAccess` (projekt LUB twórca/przypisany) + naprawiony `reorderTask`. Build‑guard statyczny odrzucony (za dużo FP) — regresję pilnują testy Z‑172. |
| Z-190 | M | ✅ | 2026-06-16 | `src/actions/tasks.ts` | Spot‑check stron odczytu pieniądze/PII/cross‑user (portfel/health/notes/tasks/usługi): izolacja OK (`ownershipFilter`/`ownedByWhere` na liście, `assert*Access(parentId)` na dzieciach). Dziura Tasks (wspólna z Z‑052) domknięta. |
| Z-050 | M | ✅ | 2026-06-16 | `src/actions/privacy.ts`, `src/components/settings/PrivacySettings.tsx`, `src/app/settings/page.tsx` | `exportMyData()` zbiera komplet danych usera ze wszystkich modułów (+ kluczowe dzieci), bez danych zespołów i bez tokenów auth; sekcja „Prywatność i dane" w /settings → pobranie JSON. |
| Z-051 | M | ✅ | 2026-06-16 | `src/lib/privacy/purge.ts`, `src/actions/privacy.ts`, `src/components/settings/PrivacySettings.tsx` | `purgeUserData` (transakcja sterowana realnymi regułami FK: RESTRICT→usuń, SET-NULL→skasuj jawnie po właścicielu, reszta CASCADE) + `deleteMyAccount` (potwierdzenie e-mailem, blokada gdy właściciel zespołu, signOut/JWT). Zweryfikowane lokalnym testem (izolacja zachowana). Decyzja przekazania zespołów = przyszłe P1. |
| Z-172 | M | ✅ | 2026-06-16 | `src/__tests__/isolation.test.ts`, `src/lib/tasks/access.ts` | Testy BOLA/IDOR: guardy `assertListAccess/ProjectAccess/RecipeAccess/PetAccess`, `assertTaskAccess` (w tym osobiste `projectId=null`) i `ownedByWhere` odrzucają obcego właściciela. DB‑gated (skip bez `DATABASE_URL` → `test:unit` zielony bez bazy; CI z Postgresem je odpala). `mock.module` niedostępne, więc test na poziomie guardów (nie mock auth). |
| Z-173 | M | ✅ | 2026-06-16 | `src/__tests__/services-marketplace.test.ts`, `src/lib/services/access.ts`, `src/lib/services/payment.ts` | `loadRequestAccess` (izolacja klient/wykonawca/odrzuć) + `netAmount` wyciągnięte do lib i przetestowane (DB‑gated + pure). Guard, na którym stoją markPaymentPaid/bookClientExpense/sendQuote/respondToQuote/openDispute. Idempotencja PAID i admin‑gate resolveDispute — przegląd kodu. |
| Z-053 | S | ✅ | 2026-06-16 | migracja `0185_user_consent`, `src/lib/legal/documents.ts`, `src/actions/legal.ts`, `src/app/legal/*`, `src/components/legal/ConsentBanner.tsx`, AppShell | Mechanika zgód gotowa: model `UserConsent` (wersjonowane), akcje accept/outstanding, strony `/legal/[key]`, rejestr podprocesorów (faktyczny: Google/Groq/Neon/Render), baner zgód w AppShell, link w Ustawieniach. ⏸️ TREŚĆ PRAWNA polityki/regulaminu = wersja robocza, wymaga prawnika/DPO. |

### Brama 2 — operacyjna
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-030 | S | ✅ | 2026-06-16 | `prisma/schema.prisma`, migracja `0186_owner_indexes` | Dodano brakujące `@@index(ownerId/ownerTeamId)` (Team, ShoppingList, Note, TaskProject, Store, PetSale). Migracja idempotentna (`IF NOT EXISTS`) — naprawiła też dryf schema↔DB (Note miał indeks w bazie bez `@@index`). 9/9 zweryfikowane. Reszta modeli już miała indeksy. |
| Z-341 | S | ✅ | 2026-06-16 | `prisma/schema.prisma`, `src/lib/pagination.ts` | Indeksy magazynu zweryfikowane (StorageItem: owner/team/warehouse/sku/barcode/supplier; StorageMovement: [itemId,createdAt] wspiera keyset). Helper keyset gotowy do wpięcia w listy ruchu/pozycji przy wzroście wolumenu. |
| Z-070 | M | ✅ | 2026-06-16 | `src/lib/pagination.ts` (+test), `src/actions/access.ts`, `src/components/admin/AuditLogPage.tsx` | Reużywalny helper keyset (cursor po id, sort [createdAt desc, id desc], keysetQuery/keysetResult + 6 testów). Wpięty end-to-end w log audytu (zamiast take:200) + przycisk „Załaduj starsze". Rollout na notes/tasks/news = ten sam helper (follow-up z Z-071). |
| Z-111 | S | ✅ | 2026-06-16 | `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`, `src/components/ui/ErrorState.tsx`, `src/lib/observability/report.ts` | Granice błędu: segmentowa (`error.tsx`+reset), globalna (`global-error.tsx` z własnym html/body), spójny `ErrorState`, strona 404. Błędy → `reportClientError` (seam pod Sentry/Z-090). |
| Z-090 | S | ✅ | 2026-06-16 | `src/app/api/health/route.ts`, `src/middleware.ts`, `src/instrumentation.ts`, `next.config.mjs`, `src/lib/observability/report.ts` | Część kodowa: publiczny `/api/health` (200/503 + ping DB, zweryfikowany), `instrumentation.ts` (unhandledRejection→seam, punkt initu Sentry), seam `reportClient/ServerError` Sentry‑ready. ⏸️ DSN Sentry + zewn. uptime-monitor + alert 5xx = konfiguracja właściciela (instrukcja w instrumentation.ts). |
| Z-171 | S | ✅ | 2026-06-16 | `src/__tests__/isolation.test.ts` | Alias `@/` działa w runnerze (tsx ^4.19 czyta tsconfig paths) — zweryfikowane; nowe testy importują przez `@/…`, więc regresja aliasu wywali suite. |
| Z-170 | S | ✅ | 2026-06-16 | `.github/workflows/ci.yml`, `package.json` (skrypt `typecheck`) | Job `verify`: npm ci → migrate deploy (Postgres service) → check:actions → check:migrations → typecheck → test:unit (DB-gated odpalają się) → next build (bez migrate.js). Bramka na PR/push do develop/master. Node 22 (glob `node --test` wymaga ≥22). Run #1 złapał błąd Node 20 → naprawione. |
| Z-430 | S | ✅ | 2026-06-16 | `.github/workflows/ci.yml` | Job `e2e-smoke`: Postgres + seed + `playwright install chromium` + `playwright test e2e/specs/smoke.spec.ts` (auto-start aplikacji przez webServer, E2E_TEST_MODE=1) + artefakt raportu. Run przeglądarki niewykonalny w sandboxie. Job `continue-on-error` (nieblokujący) do pierwszej walidacji smoke na runnerze. |

### Brama 3 — kosztowa AI
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-130 | M | ✅ | 2026-06-16 | migracja `0187_ai_usage`, `src/lib/ai/usage.ts`, `src/app/api/llm/home/agent/route.ts` | Trwały dzienny budżet AI per user w tabeli `AiUsage` (zapytania+tokeny; wspólna baza→działa między instancjami). `checkAiBudget` przed runem (429 z Retry-After do północy UTC), `recordAiUsage(meta.tokens)` w `finally`. In-memory limiter zostaje jako bezpiecznik anty-burst. Budżet wpięty w briefing oraz CENTRALNIE w `chatComplete` (opcjonalne `userId` → check+record; cache-hit darmowy) i włączony w drogie trasy: vision/OCR (ocr-image/text, magazyn scan/document) + generacyjne (generate-recipe, plan-week, order-draft, pets/insights, magazyn/insights). Tanie klasyfikacje (categorize/extract/search/enrich/parse-ingredients) też wpięte. Pozostają tylko trasy bez `session` w zasięgu (np. import-url — helper). |
| Z-511 | M | ✅ | 2026-06-16 | `src/lib/ai/usage.ts` (PLAN_LIMITS), `src/lib/ai/cache.ts`, `src/lib/llm/chat.ts` | Twarde limity per plan (free: 100 req/200k tok dziennie; premium: 10×; plan=ADMIN→premium do czasu billingu). Cache odpowiedzi LLM (in-memory TTL/LRU) wpięty w `chatComplete` (`cache:true`) i WŁĄCZONY dla deterministycznych dispatch-routes (normalize, parse-ingredients, import-url) — identyczne wejście nie płaci ponownie. |
| Z-510 | S | ✅ | 2026-06-16 | `src/actions/metrics.ts`, `src/app/admin/metrics/page.tsx`, `src/app/admin/page.tsx` | `getUnitEconomics` liczy realny koszt AI z `AiUsage` (tokeny × cena z Config `ai_cost_per_1m_tokens`), MAU (proxy: aktywni AI), koszt/MAU, trend dzienny. Widok `/admin/metrics`. ARPU/CAC/LTV = null z adnotacją (wymaga danych billingu/marketingu — P1). |

### P0 modułowe (poza bramami)
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-210 | S | ✅ | 2026-06-16 | `src/app/api/llm/home/agent/route.ts` | Dyrektywa anty-injection w system prompcie (treść modułów + wyniki web = NIEUFNE DANE, nie polecenia; wykonuj tylko polecenia użytkownika) + wyniki narzędzi/web opakowane delimiterem `<<<DANE…DANE>>>`. Dodatkowa warstwa: akcje zmieniające i tak wymagają potwierdzenia w ActionDrawer. |
| Z-211 | S | ✅ | 2026-06-16 | `src/app/api/llm/home/agent/route.ts` | Zweryfikowane: obie ścieżki agenta (SSE i nie-SSE) zwalniają slot współbieżności w `finally` (`release()`), więc błąd/wyjątek nie blokuje kolejnych zapytań. `acquireSlot` z `rateLimit.ts` zwraca idempotentny release. |
| Z-270 | M | ✅ | 2026-06-16 | migracja `0188_health_settings`, `src/actions/health.ts`, `src/lib/ai/agentTools.ts`, `src/components/health/HealthAiOptInToggle.tsx` | AI opt-in dla danych zdrowotnych: model `HealthSettings.aiOptIn` (DOMYŚLNIE false), oba health read-tools agenta (`list_health_events`, `list_medications`) zwracają notę zamiast danych gdy opt-out, toggle w module Zdrowie. ⏸️ Szyfrowanie at-rest = poziom infrastruktury (Neon szyfruje dysk); field-encryption wrażliwych pól = większy follow-up. „Zero reklam" w Zdrowiu = polityka. |
| Z-360 | M | ✅ | 2026-06-16 | `src/__tests__/services-marketplace.test.ts` | Pokryte tą samą partią co Z‑173 (ten sam moduł): izolacja dostępu do zlecenia + księgowanie netto. |

---

## P1 / P2 — wg obszarów (rozwijane przy realizacji danego obszaru)
> Każdy obszar rozwinę do pojedynczych wierszy `Z-NNN`, gdy do niego dojdę (czytając rozdział źródłowy),
> żeby nic nie pominąć. Kolejność wg „Fundament wzrostu" → „Jakość i głębia" (rozdz. 47 pkt 4–5).

| Obszar | Zakres ID | Rozdz. | Plan | Status obszaru |
|---|---|:--:|:--:|---|
| Architektura i kod | Z-010 – Z-015 | 6 | A.2 | 🟡 — typecheck (`tsc`) w CI (Z-011/015 część). Pomiar ESLint: 74 problemy (gł. kosmetyka) → pełne wdrożenie do pliku decyzji #11; naprawiony realny bug `rules-of-hooks` w WeatherPage (mylący prefiks `use`→`requestGeolocation`). |
| Dane / Prisma / skala bazy | Z-031 – Z-037 | 7 | A.2 | ⬜ (Z-030 w P0) |
| Bezpieczeństwo / RBAC / RODO | Z-054 – Z-059 | 8 | A.3 | 🟡 — Z-057 ✅ (testy bezpieczeństwa krytycznego renderera markdown + naprawiony XSS: linki `javascript:`/`data:` zablokowane, allowlista schematów, escape `"` w href). Z-050/051/052/053 w P0. Reszta (retencja Z-059, 2FA Z-058…) = TODO |
| Wydajność / skalowalność | Z-071 – Z-083 | 9 | A.4 | ⬜ (Z-070 w P0) |
| DevOps / CI/CD / koszty | Z-091 – Z-097 | 10 | A.5 | ⬜ (Z-090 w P0) |
| UX / design system / a11y / i18n | Z-110 – Z-118 | 11 | A.6 | ⬜ (Z-111 w P0) |
| AI / LLM | Z-131 – Z-138 | 12 | A.7 | ⬜ (Z-130 w P0) |
| Integracje | Z-150 – Z-158 | 13 | A.8 | ⬜ |
| Testowanie / jakość | Z-174 – Z-188 | 14 | A.9 | 🟡 — testy DB-gated (izolacja/marketplace) + 7 markdown(XSS) + 9 skórek(CSS-inj) + 6 paginacji + 5 userTime(strefa/doba — **wykryły i naprawiły bug ~1 s w `end` doby**); + 6 currency(waluty) + 6 habitStats(serie) + 5 storeRoute(TSP) + 6 recurrence-edges + 4 storeLayout + 6 categorize + 6 ai-budget + 3 purge + 6 autoExpense + 4 keyset-integration + 3 permissions(RBAC) + 6 medicationSchedule + 7 petGenetics + 3 cache + 3 rateLimit + 4 petWelfare(alarmy terrariów); suite 161 testów, CI je odpala. Z-170/171/172/173 w P0. |
| Współdzielenie / rodziny | Z-191 – Z-198 | 15 | A.12 | 🟡 — Z-190 ✅ (P0); Z-191 ✅ (team-awareness zweryfikowane: Shopping/Tasks/Notes/Kitchen/Pets/Health/Habits/Flota/Portfel/Languages/Storage/Workshop/Contacts mają `ownerTeamId`; Store/News/Weather/ProjectGroup celowo user-only); Z-192 🟡 (fundament „household": `Team.kind`, tworzenie rodziny + domyślne wspólne: lista zakupów + projekt zadań + badge; role rodzic/dziecko Z-194, onboarding Z-195, pełne auto-share = follow-up) |
| Audyt modułów | Z-210 – Z-419 | 16–41 | wg obszaru | ⬜ (P0: Z-210/211/270/341/360/430) |
| Model biznesowy / monetyzacja | Z-470 – Z-476 | 42 | A.10 | 🟡 — Z-471 ✅ (`Subscription` + `lib/plans.ts` getActivePlan/hasFeature + sekcja „Twój plan"; AI-budżet czyta plan); Z-472=Z-130 ✅; Z-510 ✅. ⏸️ Z-473 bramka płatności + Z-470 linia free/premium = decyzja właściciela; Z-474 reklamy=P2; Z-476 prowizja marketplace=TODO |
| Strategia podaplikacji | Z-490 – Z-495 | 43 | A.11 | ⬜ |
| Model ilościowy | Z-512 – Z-515 | 44 | A.10 | ⬜ (Z-510/511 w P0) |
| Marketing | Z-530 – Z-535 | 45 | — | ⬜ |

---

_Ostatnia aktualizacja: 2026-06-16 - branch v2 (merge zamiast develop); fix hooka WeatherPage; ESLint zmierzony->decyzje. Suite 161._
