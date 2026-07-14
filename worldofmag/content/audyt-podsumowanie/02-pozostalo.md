# Co pozostało na przyszłość

> **Jak używać tej strony.** Wracając do prac poaudytowych — **zacznij tutaj**. Poniżej masz wszystko, co
> zostało, pogrupowane wg tego, **kto musi ruszyć pierwszy** (Ty czy ja) i **co jest już gotowe w kodzie**.
> Nie musisz otwierać starego audytu ani innych raportów — ta lista jest samowystarczalna. Głęboki kontekst
> (rekomendacje `Z-NNN`, uzasadnienia) w razie potrzeby: **`/admin/audyt`**.
>
> **Legenda:** 🔓 = czeka na Twoją akcję/decyzję · ⏸️ = świadomie odłożone · 🧩 = opcjonalny dług techniczny
> (mogę zrobić autonomicznie) · ❌ = porzucone.

---

## Najpierw: dwa kroki o najlepszym stosunku wartości do wysiłku

1. **Smoke-test `develop`** (5 min, bez kont/kluczy) — sporo nowego kodu poszło na środowisko testowe
   (kolejka zadań, `/admin/jobs`, FTS notatek). Sprawdź `/api/health` (200), `/admin/jobs` (panel się
   renderuje, zadanie przechodzi `QUEUED → DONE`), wyszukiwarkę notatek. Jak coś nie gra — zgłoś, naprawię.
2. **T-13 (Sentry + UptimeRobot)** — pierwszy „prawdziwy" krok właściciela: dowiadujesz się o błędach 500 i
   o tym, że apka leży, zanim zgłosi to użytkownik. UptimeRobot dodatkowo trzyma free-tier rozgrzany.

---

## 🔓 ETAP 4 — konta / klucze / konfiguracja zewnętrzna

Kod fundamentu jest gotowy; brakuje Twoich kont/kluczy. Po ich dostarczeniu **resztę dorabiam ja**.

### T-13 · Monitoring błędów (Sentry) + uptime + alert 5xx — *Z-090*
- **Gotowe w kodzie:** seam `reportClient/ServerError`, `instrumentation.ts` (punkt initu), publiczny
  `/api/health` (200/503 + ping DB).
- **Twoja akcja:** załóż Sentry → ustaw `SENTRY_DSN` w env Render; dodaj monitor UptimeRobot na `/api/health`
  (interwał 5 min); ustaw kanał alertu (e-mail/Slack).
- **Potem ja:** `npm i @sentry/nextjs`, odkomentowanie initu, podpięcie `reportServerError` do Sentry.

### T-14 · DR: PITR na Neon + release-command Render — *Z-093 / Z-092*
- **Gotowe:** runbook DR (`docs/devops/runbook-deploy-rollback.md`); artefakt buildu jest DB-free.
- **Twoja akcja:** włącz PITR na Neon + przećwicz restore z brancha „from a point in time" (zanotuj okno
  RPO); opcjonalnie skonfiguruj release-command, by odsprzęgnąć migrację od builda.

### T-15 · Integracje Google (Kalendarz / Gmail) — *Z-150 / Z-151 / Z-156*
- **Gotowe:** wzorzec per-user OAuth (jak Dysk Google, scope `drive.file`) do powielenia; jednostronny feed
  iCal już działa.
- **Twoja akcja:** decyzja o zakresach (**rekomendacja: zacznij od `calendar.readonly`**) + przejście
  weryfikacji ekranu zgody Google (Gmail = ciężki audyt CASA — odłóż).
- **Potem ja:** osobny flow OAuth („Połącz Kalendarz"), klient odczytu Kalendarza, wpięcie do agendy.

---

## ⏸️ Świadomie odłożone

### T-18 · Warstwa i18n `t()` — *Z-115*
**Decyzja właściciela (2026-07-14):** produkcja służy na razie tylko właścicielowi (apka PL). i18n wracamy
dopiero przy **~100 użytkownikach na produkcji** po oficjalnym wydaniu wersji PL. Zero kodu teraz.
`formatMoney` już na `Intl.NumberFormat` (fundament gotowy).

### T-05 · Model reklam — kierunek — *Z-474*
Reklamy kontekstowe **bez profilowania**, z opcją „wyłącz", ale **dopiero po wdrożeniu freemium/B2B** (zależne
od T-20). Zero kodu teraz; wraca jako temat po uruchomieniu płatności.

---

## 🔓 ETAP 6 — biznes / prawo / strategia

Fundament w kodzie gotowy — brakuje **Twoich decyzji/treści**. Przy każdym jest rekomendacja na jedno zdanie.

### T-19 · Treść prawna (polityka prywatności + regulamin) — *Z-053*
- **Gotowe:** mechanizm zgód (`UserConsent`, wersjonowanie), strony `/legal/*`, baner, rejestr podprocesorów.
  Treść **robocza** (`lib/legal/documents.ts`).
- **Twoja akcja:** zatwierdzenie treści przez prawnika/DPO (napisz „wyeksportuj treść prawną" → dam gotowy
  Markdown do wysyłki).

### T-20 · Płatności + cennik free/premium — *Z-473 / Z-470*
- **Gotowe:** model `Subscription` + `lib/plans.ts` (limity AI per plan, `hasFeature`/`getActivePlan`), sekcja
  „Twój plan" w Ustawieniach.
- **Twoja akcja (3 decyzje):** bramka (**Stripe** vs **Przelewy24** — Stripe bywał problematyczny na Twojej
  sieci), dane firmy/VAT, **linia podziału free/premium + ceny**.
- **Potem ja:** integracja bramki + webhooki statusów → `Subscription`, faktury/VAT, mapowanie funkcji premium.

### T-21 · Dane zdrowotne: field-encryption + „zero reklam" — *Z-270*
- **Gotowe:** AI opt-in dla zdrowia (domyślnie OFF), szyfrowanie at-rest na poziomie Neon.
- **Twoja decyzja:** czy wdrażać field-encryption wrażliwych pól (utrudnia wyszukiwanie/trendy, wymaga
  zarządzania kluczem — **rekomendacja: odłóż**); potwierdzenie polityki „zero reklam w Zdrowiu/Finansach".

### T-22 · 2FA + zarządzanie sesjami — *Z-058*
- **Gotowe:** logowanie Google (daje 2FA po stronie Google), szyfrowanie kluczy at-rest.
- **Twoja decyzja:** czy/kiedy TOTP + ekran „aktywne sesje". Niski priorytet dla 1 użytkownika.

### T-23 · Pierwszy vertical branżowy — *Z-490*
- **Gotowe:** modularna architektura + RBAC + warstwa planów pod pakiety branżowe.
- **Twoja decyzja:** którą branżę pierwszą (Hodowca / Gastronomia / Flota B2B / Rolnictwo) i w jakim MVP.
  **Rekomendacja: Hodowca** — Pety to najbogatszy, najbardziej wyróżniający moduł.

### T-24 / T-25 · Ekonomika i strategia — *Z-510 / Z-490–495 / Z-530–535*
- **T-24 (ARPU/CAC/LTV):** zależne od T-20 (przychody) + kosztu pozyskania. `/admin/metrics` już liczy realny
  koszt AI / MAU. Nic do zrobienia teraz poza T-20.
- **T-25 (strategia + model ilościowy + marketing):** do wspólnej rozmowy (plan verticali, model
  kosztów/przychodów, pozycjonowanie/ICP/kanały).

---

## 🧩 Opcjonalny dług techniczny (mogę zrobić autonomicznie — niski priorytet)

- **Pozostałe 15 warningów ESLint:** 10 × `react-hooks/exhaustive-deps` (ślepa naprawa ryzykuje pętle
  refetchu — do zrobienia ostrożnie, po jednym z weryfikacją) + 5 × `@next/next/no-img-element` (wymaga
  migracji na `next/image` — ryzyko zachowania/sizingu). Bramka i tak jest zielona.
- **Kolejka — Faza 2:** wynieść workera do osobnej usługi Render, gdy ruch zażąda (ten sam kod — `SKIP LOCKED`
  już wieloworkerowy); knobki współbieżności per-user.
- **T-11 — powielenie wirtualizacji** na kolejne długie listy, gdy realnie urosną (np. magazyn — lista
  grupowana w sekcjach, wymaga spłaszczenia indeksu).
- **T-10 — opcjonalnie** ujednolicić *wybór właściciela-zespołu* przy tworzeniu zasobów (dziś każdy moduł ma
  własny selektor) — szeroka zmiana o małej wartości; wzorzec `ShareControl` gotowy, gdy zajdzie potrzeba.
- **T-12 — follow-up:** `tasks` (projectMembers/entity) i `contacts` (user-only) używają innego modelu
  współdzielenia niż `ownerTeamId` — egzekwowanie ról modułowych tam wymaga osobnego podejścia.
- **Płatny hosting** ($7/mies. Render), jeśli free-tier okaże się niewystarczający wydajnościowo.

---

## ❌ Porzucone

### Moduł Praca / Work
**Decyzja właściciela (2026-07-14):** moduł niepotrzebny. Zaślepka („coming soon" w sidebarze,
`/admin/architecture`, tabela w `CLAUDE.md`) została **usunięta**. Gdyby kiedyś wrócił temat — trzeba go
zaprojektować od zera (schemat + trasy + akcje + uprawnienie `module.work`).

---

## Jak wznowić kolejny etap

1. **Zacznij od tej strony** — wybierz pozycję 🔓 z ETAP 4 (najpierw T-13) albo świadomie odłóż i wskaż inny
   kierunek (np. dług techniczny 🧩, który zrobię autonomicznie).
2. **Rozdział „Co zostało wykonane"** obok pokazuje, co już jest — żeby nie dublować pracy.
3. **Głęboka referencja audytowa** (rekomendacje `Z-NNN`, uzasadnienia) — `/admin/audyt`. Żywy tracker
   (A.16) i przewodnik właściciela są też w `/reports`, ale **do wznowienia prac wystarcza ta strona**.
