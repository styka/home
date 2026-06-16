# Dodatek A.13 — Status wdrożeń (żywy)

> **Plik aktualizowany per‑zalecenie, PRZED każdym commitem.** Jedno źródło prawdy do wznawiania sesji
> po przerwie (np. brak tokenów) i do końcowego Raportu 1:1.
>
> **Jak wznowić sesję:** otwórz tę tabelę, weź pierwszą pozycję ze statusem 🟡/⬜ w zalecanej kolejności,
> zajrzyj do jej planu (Dodatek A.2–A.12) i rozdziału źródłowego, rób dalej tą samą pętlą.
>
> **Legenda:** ✅ ZROBIONE · 🟡 W TOKU · ⏸️ ODŁOŻONE (powód) · ⬜ TODO

## Postęp ogólny
| Priorytet | Razem | ✅ | 🟡 | ⏸️ | ⬜ |
|---|:---:|:---:|:---:|:---:|:---:|
| P0 | 22 | 0 | 0 | 0 | 22 |
| P1 | 129 | 0 | 0 | 0 | 129 |
| P2 | 95 | 0 | 0 | 0 | 95 |

---

## P0 — w zalecanej kolejności realizacji (rozdz. 47)

### Brama 1 — prawno‑bezpieczeństwowa
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-052 | M | ⬜ | | | Audyt autoryzacji w Server Actions (anty‑IDOR) |
| Z-190 | M | ⬜ | | | Audyt izolacji tenantów (filtr owner/team w każdym list/read) |
| Z-050 | M | ⬜ | | | Eksport danych użytkownika (RODO 15/20) |
| Z-051 | M | ⬜ | | | Twarde usunięcie konta (RODO 17) |
| Z-172 | M | ⬜ | | | Testy izolacji BOLA/IDOR |
| Z-173 | M | ⬜ | | | Testy ścieżki płatności i sporów (Usługi) |
| Z-053 | S | ⬜ | | | Polityka prywatności + regulamin + zgody + rejestr (mechanika; treść prawna ⏸️) |

### Brama 2 — operacyjna
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-030 | S | ⬜ | | | Indeksy @@index(ownerId)/(ownerTeamId) w modelach multi‑tenant |
| Z-341 | S | ⬜ | | | Indeksy + paginacja ruchu/pozycji magazynu |
| Z-070 | M | ⬜ | | | Paginacja keyset dla list ładujących całość |
| Z-111 | S | ⬜ | | | Globalny error.tsx + ErrorBoundary + global-error.tsx |
| Z-090 | S | ⬜ | | | Sentry + uptime + alert 5xx (SDK gated; DSN/uptime ⏸️) |
| Z-171 | S | ⬜ | | | Alias @/ w runnerze testów (prereq dla testów) |
| Z-170 | S | ⬜ | | | Testy w bramce CI (GitHub Actions) |
| Z-430 | S | ⬜ | | | E2E smoke w CI (run przeglądarki ⏸️ w sandboxie) |

### Brama 3 — kosztowa AI
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-130 | M | ⬜ | | | Trwały rate‑limit + budżet tokenów AI per user/plan (tabela AiUsage) |
| Z-511 | M | ⬜ | | | Twarde limity + cache AI dla darmowych |
| Z-510 | S | ⬜ | | | Pomiar ekonomiki jednostkowej (koszt/MAU, ARPU, CAC, LTV) |

### P0 modułowe (poza bramami)
| ID | Nakł. | Status | Data | Pliki / commit | Notatka |
|---|:--:|:--:|---|---|---|
| Z-210 | S | ⬜ | | | Zabezpieczenie agenta AI przed prompt‑injection |
| Z-211 | S | ⬜ | | | Gwarantowane zwolnienie slotu współbieżności AI (finally) |
| Z-270 | M | ⬜ | | | Wzmożona ochrona danych zdrowotnych (szyfrowanie, AI opt‑in; „zero reklam" = polityka) |
| Z-360 | M | ⬜ | | | Testy płatności/wycen/sporów (Marketplace) |

---

## P1 / P2 — wg obszarów (rozwijane przy realizacji danego obszaru)
> Każdy obszar rozwinę do pojedynczych wierszy `Z-NNN`, gdy do niego dojdę (czytając rozdział źródłowy),
> żeby nic nie pominąć. Kolejność wg „Fundament wzrostu" → „Jakość i głębia" (rozdz. 47 pkt 4–5).

| Obszar | Zakres ID | Rozdz. | Plan | Status obszaru |
|---|---|:--:|:--:|---|
| Architektura i kod | Z-010 – Z-015 | 6 | A.2 | ⬜ |
| Dane / Prisma / skala bazy | Z-031 – Z-037 | 7 | A.2 | ⬜ (Z-030 w P0) |
| Bezpieczeństwo / RBAC / RODO | Z-054 – Z-059 | 8 | A.3 | ⬜ (Z-050/051/052/053 w P0) |
| Wydajność / skalowalność | Z-071 – Z-083 | 9 | A.4 | ⬜ (Z-070 w P0) |
| DevOps / CI/CD / koszty | Z-091 – Z-097 | 10 | A.5 | ⬜ (Z-090 w P0) |
| UX / design system / a11y / i18n | Z-110 – Z-118 | 11 | A.6 | ⬜ (Z-111 w P0) |
| AI / LLM | Z-131 – Z-138 | 12 | A.7 | ⬜ (Z-130 w P0) |
| Integracje | Z-150 – Z-158 | 13 | A.8 | ⬜ |
| Testowanie / jakość | Z-174 – Z-188 | 14 | A.9 | ⬜ (Z-170/171/172/173 w P0) |
| Współdzielenie / rodziny | Z-191 – Z-198 | 15 | A.12 | ⬜ (Z-190 w P0) |
| Audyt modułów | Z-210 – Z-419 | 16–41 | wg obszaru | ⬜ (P0: Z-210/211/270/341/360/430) |
| Model biznesowy / monetyzacja | Z-470 – Z-476 | 42 | A.10 | ⬜ |
| Strategia podaplikacji | Z-490 – Z-495 | 43 | A.11 | ⬜ |
| Model ilościowy | Z-512 – Z-515 | 44 | A.10 | ⬜ (Z-510/511 w P0) |
| Marketing | Z-530 – Z-535 | 45 | — | ⬜ |

---

_Ostatnia aktualizacja: 2026-06-16 — inicjalizacja trackera (szkielet wznawialności)._
