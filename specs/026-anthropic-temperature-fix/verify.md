# Weryfikacja: Naprawa czatu asystenta AI po wyborze dostawcy Anthropic (`temperature`)

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Tasks:** ./tasks.md
- **Data:** 2026-07-23

## 1. Bramki techniczne
| Komenda | Wynik |
|---------|-------|
| `npm run test:unit` (pełny) | ✅ 347 pass / 0 fail (374 przypadki łącznie z subtestami) |
| `node --test anthropicBody.test.ts` | ✅ 6 pass / 0 fail |
| `npm run check:migrations` | ✅ „Numeracja migracji OK (następny wolny numer: 0209)" |
| `npm run check:actions` | ✅ „159 akcji w katalogu, wszystkie obsługiwane przez executor" |
| `npx next lint --dir src` | ✅ tylko istniejące, kosmetyczne ostrzeżenia (img/apos/exhaustive-deps); **0 błędów**, nic w `chat.ts` |
| `npx tsc --noEmit` | ✅ czysto (0 błędów typów) |
| `npx next build` (lokalny Postgres) | ✅ exit 0 — pełna tabela tras skompilowana |

> Lokalny Postgres 16 (`omnia/omnia_dev`, `127.0.0.1:5432`) + `prisma migrate deploy` — zgodnie z C-13,
> **nie** dotykano prod DB (nie odpalano `migrate.js`/pełnego `npm run build`).

## 2. Kryteria akceptacji
| AC | Werdykt | Dowód |
|----|---------|-------|
| **AC-1** — Anthropic reasoning bez `temperature`, brak 400 | ✅ | `anthropicBody()` (`chat.ts:202+`) nie buduje pola `temperature`; grep potwierdza, że `temperature` w ciele żądania jest tylko w `openAiBody` (`chat.ts:191`). Testy (a)(b): body Anthropic nie zawiera `temperature` mimo `opts.temperature=0.2` / `cfg.temperature=0.7`. `anthropicComplete` (`chat.ts:425`) używa `anthropicBody(cfg, opts, false)`. |
| **AC-2** — czat asystenta odpowiada | ✅ (logika) / ⚠️ (E2E) | Wynika z AC-1: usunięcie nieprzejściowego 400 przywraca łańcuch (`isRetryableLlmStatus(400)=false` przerywał `chatComplete`/`chatStream`). Pełne potwierdzenie end-to-end wymaga dostawcy Anthropic ustawionego w panelu na żywym `develop` — do weryfikacji manualnej po deployu. |
| **AC-3** — streaming bez `temperature` | ✅ | `anthropicStream` (`chat.ts:544`) używa `anthropicBody(cfg, opts, true)`. Test (c): body strumieniowe bez `temperature`, `stream:true`. |
| **AC-4** — Groq/OpenAI bez regresji | ✅ | `openAiBody()` (`chat.ts:191`) zachowuje `temperature: opts.temperature ?? cfg.temperature ?? undefined`; `openAiComplete`/`openAiStream` (`chat.ts:336/518`) go używają. Test (d): body OpenAI zawiera `temperature:0.2`. Test (e): `response_format` tylko dla wariantu jednorazowego, `stream:true` dla strumienia — zachowane. |
| **AC-5** — dispatch/JSON Anthropic OK | ✅ | Wynika z AC-1 (brak parametru = brak 400). Determinizm JSON dla Anthropic jest prompt-based (nie zależy od `temperature`). Regresja test:unit 0 fail. |

## 3. Zgodność z konstytucją
- **C-40 (routing DB-driven):** ✅ warunek zależy od rodzaju dostawcy (osobne funkcje `anthropicBody`/`openAiBody`), nie od hardcode providera/modelu w logice operacji; `resolver.ts` niezmieniony.
- **C-41 (klucze/komunikaty):** ✅ brak logowania/zwracania klucza; komunikaty błędów PL bez zmian.
- **C-53 (minimalizm):** ✅ najmniejsza zmiana — pominięcie jednego pola dla Anthropic + refaktor budowy body w służbie testu; zero nowych zależności (`npm install` bez zmian w `package-lock.json`).
- **C-51 (lekcja):** ✅ wpis dopisany do `doświadczenia.md`.
- **C-01/C-02:** ✅ zmiany tylko w `worldofmag/`; importy przez alias `@/*`.
- **C-10..C-12 (migracje):** ✅ nie dotyczą — bez zmian schematu.

## 4. Regresje
- **Ścieżka OpenAI-compatible (Groq):** nietknięta funkcjonalnie — `openAiComplete`/`openAiStream` zachowują dotychczasowe ciało (test AC-4). Pacing TPM, cache, budżet, `recordAiCall` — bez zmian.
- **Cache key** (`chat.ts:222`) nadal uwzględnia `opts.temperature` — spójne, bez wpływu (klucz cache, nie ciało żądania).
- **Pełny `npm run test:unit`:** 0 fail — brak regresji w sąsiednich modułach (fallback, rateLimit, tpmLimiter, warsztat, itd.).
- **`next build` exit 0** — brak błędów typów/kompilacji w całym drzewie.

## 5. Werdykt końcowy
**GOTOWE.** Wszystkie bramki zielone (do `next build` exit 0), wszystkie AC spełnione — AC-2 potwierdzone
logiką i testami, z jedną świadomą uwagą, że finalne potwierdzenie „na żywo" nastąpi po deployu na
`develop` z dostawcą Anthropic. Brak naruszeń konstytucji, brak regresji. Przechodzę do `/review`.
