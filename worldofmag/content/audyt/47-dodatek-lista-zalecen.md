# Dodatek A.1 — Lista zaleceń (Z-NNN)

To zbiorczy indeks **wszystkich zaleceń** wypracowanych w debatach. Każde zalecenie ma identyfikator
`Z-NNN`, priorytet (**P0/P1/P2**) i nakład (**S/M/L**). Pełna definicja i uzasadnienie każdego znajduje
się w macierzystym rozdziale; **szczegółowy plan wdrożenia dla Claude Code** — w kolejnych podrozdziałach
Dodatku A (A.2–A.12), pogrupowanych obszarami.

> **Jak czytać:** sekcja „Krytyczne (P0)” to lista „zrób najpierw — bez tego nie ruszamy z publicznym
> startem/marketingiem”. Dalej — indeks wg obszarów z odnośnikami do rozdziału i planu.

## Statystyka

| Priorytet | Liczba | Znaczenie |
|---|:---:|---|
| **P0 — krytyczne** | 16 | bezpieczeństwo, dane, wymogi prawne, blokada skali/rentowności |
| **P1 — ważne** | 70 | jakość, UX, wydajność odczuwalna, fundament wzrostu |
| **P2 — wartościowe** | 39 | usprawnienia, można odłożyć |
| **Razem** | **125** | (rośnie wraz z rozdziałami modułowymi 16–41) |

## Krytyczne (P0) — zrób najpierw

| ID | Nakład | Zalecenie | Rozdz. |
|---|:---:|---|:---:|
| **Z-030** | S | Indeksy `@@index([ownerId])`/`@@index([ownerTeamId])` we wszystkich modelach multi-tenant | 7 |
| **Z-050** | M | Eksport danych użytkownika (RODO art. 15/20) | 8 |
| **Z-051** | M | Twarde usunięcie konta (RODO art. 17) | 8 |
| **Z-052** | M | Audyt pokrycia autoryzacji w Server Actions (ochrona przed IDOR) | 8 |
| **Z-053** | S | Polityka prywatności + regulamin + zgody + rejestr przetwarzania | 8 |
| **Z-070** | M | Paginacja/keyset dla list ładujących całość | 9 |
| **Z-090** | S | Error-tracking (Sentry) + uptime-monitor + alert 5xx | 10 |
| **Z-111** | S | Globalny `error.tsx` + `ErrorBoundary` | 11 |
| **Z-130** | M | Trwały rate-limit i budżet tokenów AI per użytkownik/plan | 12 |
| **Z-170** | S | Wpiąć testy w bramkę CI (GitHub Actions) | 14 |
| **Z-171** | S | Odblokować alias `@/` w runnerze testów | 14 |
| **Z-172** | M | Testy izolacji danych między użytkownikami (BOLA/IDOR) | 14 |
| **Z-173** | M | Testy ścieżki płatności i sporów (Usługi) | 14 |
| **Z-190** | M | Audyt izolacji tenantów (każde zapytanie filtruje po właścicielu/zespole) | 15 |
| **Z-510** | S | Pomiar jednostkowej ekonomiki (koszt/MAU, ARPU, konwersja, CAC, LTV) | 44 |
| **Z-511** | M | Twarde limity i cache AI dla darmowych jako warunek rentowności | 44 |

> **Wspólny mianownik P0:** trzy bloki — **(1) zgodność i bezpieczeństwo danych** (RODO, IDOR, izolacja
> tenantów), **(2) gotowość operacyjna na ruch** (indeksy, paginacja, observability, error boundary,
> CI/testy), **(3) kontrola kosztów AI i pomiar ekonomiki** (warunek modelu „darmowe, ale tanie”). To
> jest „brama” przed marketingiem.

## Indeks zaleceń wg obszarów

| Obszar | Zakres ID | Rozdział (źródło) | Plan wdrożenia |
|---|---|---|---|
| Metodyka audytu | Z-001 – Z-003 | 5 | — |
| Architektura i kod | Z-010 – Z-015 | 6 | A.2 (rozdz. 48) |
| Dane / Prisma / skala bazy | Z-030 – Z-037 | 7 | A.2 (rozdz. 48) |
| Bezpieczeństwo / RBAC / RODO | Z-050 – Z-059 | 8 | A.3 (rozdz. 49) |
| Wydajność / skalowalność | Z-070 – Z-083 | 9 | A.4 (rozdz. 50) |
| DevOps / CI/CD / koszty | Z-090 – Z-097 | 10 | A.5 (rozdz. 51) |
| UX / design system / a11y / i18n | Z-110 – Z-118 | 11 | A.6 (rozdz. 52) |
| AI / LLM | Z-130 – Z-138 | 12 | A.7 (rozdz. 53) |
| Integracje | Z-150 – Z-158 | 13 | A.8 (rozdz. 54) |
| Testowanie / jakość | Z-170 – Z-188 | 14 | A.9 (rozdz. 55) |
| Współdzielenie / rodziny | Z-190 – Z-198 | 15 | A.12 (rozdz. 58) |
| Audyt modułów | Z-210 – Z-419 | 16–41 | wg obszaru |
| Model biznesowy / monetyzacja | Z-470 – Z-476 | 42 | A.10 (rozdz. 56) |
| Strategia podaplikacji | Z-490 – Z-495 | 43 | A.11 (rozdz. 57) |
| Model ilościowy | Z-510 – Z-515 | 44 | A.10 (rozdz. 56) |
| Marketing | Z-530 – Z-535 | 45 | — |

## Rekomendowana kolejność realizacji

1. **Brama prawno-bezpieczeństwowa (P0):** Z-050, Z-051, Z-052, Z-053, Z-190, Z-172, Z-173 — zanim
   wpuścimy publicznych użytkowników/marketing.
2. **Brama operacyjna (P0):** Z-030, Z-070, Z-090, Z-111, Z-170, Z-171 — by aplikacja udźwignęła ruch.
3. **Brama kosztowa AI (P0):** Z-130, Z-510, Z-511 — by skala nie zrujnowała budżetu.
4. **Fundament wzrostu (P1):** monetyzacja (Z-470–476), rodzina (Z-192), integracje (Z-150/151),
   pierwsza branża (Z-490).
5. **Jakość i głębia (P1/P2):** UX/a11y/i18n, testy rozszerzone, kolejne branże, usprawnienia modułowe.

> **Uwaga dla wykonawcy:** ta lista jest **żywa**. Po dopisaniu rozdziałów modułowych (16–41) i planów
> (A.2–A.12) zaktualizuj liczby i zakresy. Identyfikatory `Z-NNN` są stałe — nie przenumerowuj już
> istniejących (tak jak migracji), tylko dodawaj nowe w wolnych zakresach.
