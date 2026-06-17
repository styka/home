# Dodatek A.14 — Decyzje właściciela (do podjęcia)

> **Cel:** jedno miejsce na rzeczy, których NIE da się domknąć kodem — wymagają decyzji
> biznesowej/prawnej, konta zewnętrznego albo konfiguracji infrastruktury. Realizacja audytu
> celowo je pomija (⏸️) i idzie dalej; tu zbieramy je do wspólnego omówienia **na koniec sesji**.
>
> Dla każdej pozycji: **co już gotowe w kodzie** (żeby po decyzji wdrożenie było szybkie) i **czego brakuje**.

Legenda statusu: 🔓 czeka na decyzję · ✅ zdecydowane/wdrożone.

---

## 1. Treść prawna: polityka prywatności + regulamin (Z-053) 🔓
- **Decyzja:** zatwierdzenie treści przez prawnika/DPO (obecnie wersje robocze).
- **Gotowe:** mechanizm zgód (`UserConsent`, wersjonowanie), strony `/legal/*`, baner zgód, rejestr
  podprocesorów (Google/Groq/Neon/Render). Treść = `src/lib/legal/documents.ts` (oznaczona „robocza").
- **Brakuje:** finalna treść + ewentualne dodatkowe dokumenty (umowy powierzenia z podprocesorami).

## 2. Error-tracking + uptime + alerty (Z-090) 🔓
- **Decyzja:** czy włączamy Sentry (lub inny) — potrzebny **DSN**; wybór zewn. **uptime-monitora**
  (np. UptimeRobot/Better Uptime/Render) pingującego `/api/health`; kanał **alertu 5xx** (e-mail/Slack).
- **Gotowe:** seam `reportClient/ServerError`, `instrumentation.ts` (punkt initu), publiczny `/api/health`
  (200/503 + ping DB).
- **Brakuje:** ustawienie `SENTRY_DSN` w env Render + (opcjonalnie) `npm i @sentry/nextjs` i odkomentowanie
  initu; konfiguracja monitora i alertu.

## 3. Płatności + cennik free/premium (Z-473 / Z-470) 🔓
- **Decyzja:** wybór bramki (**Stripe** vs **Przelewy24** — uwaga: Stripe bywał problematyczny na sieci
  właściciela, do potwierdzenia), dane firmy/VAT, oraz **linia podziału funkcji free/premium** i ceny.
- **Gotowe:** model `Subscription` + `src/lib/plans.ts` (limity AI per plan, `hasFeature`/`getActivePlan`),
  budżet AI per plan, sekcja „Twój plan" w Ustawieniach.
- **Brakuje:** integracja bramki + webhooki statusów → `Subscription`, faktury/VAT, mapowanie funkcji premium.

## 4. Ekonomika: ARPU / CAC / LTV (Z-510 część) 🔓
- **Decyzja:** zależne od (3) — dane przychodowe i koszty pozyskania pojawią się po wdrożeniu płatności/marketingu.
- **Gotowe:** `/admin/metrics` liczy realny koszt AI / MAU z `AiUsage` (cena tokenów konfigurowalna).
- **Brakuje:** źródło przychodów (billing) + koszt kampanii (marketing) do policzenia ARPU/CAC/LTV.

## 5. Integracje Gmail / Google Calendar (Z-150 / Z-151) 🔓
- **Decyzja:** czy i które integracje; wymaga **rozszerzenia scope OAuth** Google + weryfikacji ekranu
  zgody (Google review) dla zakresów wrażliwych.
- **Gotowe:** wzorzec per-user OAuth (Drive, scope `drive.file`) — do powielenia.
- **Brakuje:** decyzja o zakresach + przejście weryfikacji Google + implementacja klientów.

## 6. Pierwszy vertical / podaplikacja branżowa (Z-490) 🔓
- **Decyzja:** którą branżę uruchamiamy pierwszą (Hodowca / Gastronomia / Flota B2B / Rolnictwo) i w jakim zakresie.
- **Gotowe:** modularna architektura + RBAC + (po 3) warstwa planów do pakietów branżowych.
- **Brakuje:** wybór + zakres MVP brancowego.

## 7. Dane zdrowotne: szyfrowanie pól + reklamy (Z-270 część) 🔓
- **Decyzja:** czy wdrażać **field-encryption** wrażliwych pól zdrowotnych (ponad szyfrowanie at-rest Neon)
  — wpływa na wyszukiwanie/trendy; oraz potwierdzenie polityki „zero reklam w Zdrowiu/Finansach".
- **Gotowe:** AI opt-in dla danych zdrowotnych (domyślnie OFF), at-rest na poziomie Neon.
- **Brakuje:** decyzja o zakresie field-encryption + zarządzaniu kluczami.

## 8. Zespół przy usuwaniu konta właściciela (Z-051 część) 🔓
- **Decyzja:** co z zasobami zespołu, gdy właściciel kasuje konto — obecnie **blokada** + ręczny
  `transferTeamOwnership`. Czy chcemy auto-transfer (do kogo?) lub auto-usunięcie solo-zespołów?
- **Gotowe:** blokada usunięcia + akcja transferu własności.
- **Brakuje:** reguła automatyczna (jeśli pożądana).

## 9. Bezpieczeństwo konta: 2FA / sesje / sekrety (Z-058 / Z-054) 🔓
- **Decyzja:** czy wdrażać 2FA + zarządzanie sesjami/urządzeniami (po fundamencie); potwierdzenie procedury
  stałego `AUTH_SECRET`/`CONFIG_SECRET` (menedżer sekretów Render, bez rotacji bez re-szyfrowania).
- **Gotowe:** logowanie Google, szyfrowanie kluczy at-rest (`secrets.ts`).
- **Brakuje:** decyzja o 2FA; spisanie procedury sekretów.

## 11. ESLint pełny + sprzątanie (Z-011 / Z-015) 🔓
- **Decyzja:** czy wdrażamy ESLint jako bramkę (wymaga apetytu na cleanup). Pomiar: na obecnym kodzie
  `next lint` daje **74 problemy** — większość kosmetyczna (`react/no-unescaped-entities` — literalny `"`
  w JSX; `react-hooks/exhaustive-deps` — często celowe) + kwestia konfiguracji pluginu `@typescript-eslint`.
- **Gotowe:** typecheck (`tsc --noEmit`) już jest bramką w CI (połowa Z-011/Z-015). Realne błędy znalezione
  przy pomiarze już **naprawione**: hook-w-callbacku (WeatherPage) + 2× `no-assign-module-variable`
  (drive/upload, agent). Zostają głównie kosmetyka + konfiguracja pluginu.
- **Brakuje:** decyzja, czy poświęcić czas na konfigurację reguł + przejście 74 pozycji, zanim ESLint
  stanie się blokujący (inaczej będzie szum). Rekomendacja: włączyć z wyłączoną kosmetyką + naprawić tylko
  realne błędy (rules-of-hooks, no-assign-module-variable), reszta jako warning.

## 12. Zakupy: ręczny DnD pozycji vs. sortowanie po trasie sklepu (Z-221) 🔓
- **Decyzja:** pozycje listy sortują się dziś **alfabetycznie** lub **po trasie sklepu** (kolejność grup
  kategorii z mapy). Ręczne przeciąganie (Z-221, „najczęstsza prośba") wymaga rozstrzygnięcia: czy ręczny
  `Item.order` ma nadpisywać sort po trasie (i jak współgrać z grupowaniem po kategoriach)? Per-kategoria
  czy globalnie? To zmienia UX, nie tylko kod.
- **Gotowe:** `@dnd-kit` już w projekcie (plan posiłków) — wzorzec do powielenia po decyzji.
- **Brakuje:** decyzja o modelu kolejności + migracja `Item.order` + akcja reorder + UI.

## 10. Model reklam (Z-474, P2) 🔓
- **Decyzja:** czy/jak reklamy kontekstowe (bez profilowania), z opcją „wyłącz" — dopiero po freemium/B2B.
- **Brakuje:** decyzja kierunkowa.

---

_Aktualizowane w trakcie realizacji audytu. Pozycje kodowo-gotowe czekają tylko na decyzję/konfigurację._
