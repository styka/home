-- 0203: Odświeżenie raportów admina dla właściciela (stan 2026-07-14).
-- 1) Przewodnik właściciela — aktualizacja treści (T-01 zweryfikowane, T-16/T-17 domknięte,
--    T-18 odłożone; kolejka autonomiczna wyczerpana). Idempotentnie (ON CONFLICT DO UPDATE).
-- 2) Tracker roboczy (Dodatek A.16) jako NOWY raport admina — praca z aktualnym planem z
--    poziomu aplikacji (/reports). Slug globalnie unikalny; DO UPDATE odświeża przy re-seedzie.

INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Przewodnik właściciela — kroki manualne i decyzje',
  'przewodnik-wlasciciela',
  $guide_md$# Przewodnik właściciela — krok po kroku (WorldOfMag / Omnia)

> **Po co ten plik.** To kompletna, „za rączkę" instrukcja wszystkich kroków, które czekają
> **na Twoją akcję** (konta, klucze, konfiguracja, decyzje, weryfikacja wizualna). Gdy je wykonasz
> i odeślesz mi wyniki/decyzje, wracam do autonomicznej realizacji całej reszty.
>
> **Jak korzystać:** idź od góry. Każdy krok ma ☐ do odhaczenia, dokładnie *gdzie kliknąć* i *co mi
> potem napisać*. Nigdzie nie wklejaj sekretów do tego pliku ani do czatu w pełnej postaci, jeśli nie
> chcesz — wystarczy, że napiszesz „ustawione".
>
> **Stan na 2026-07-14.** Źródło prawdy: `worldofmag/content/audyt/64-plan-tracker.md` (A.16).
> Statusy: ✅ zrobione · 🟡 zrobione, czeka na Twoją weryfikację · 🔓 czeka na Twoją akcję/decyzję ·
> ⏸️ świadomie odłożone.
>
> **Co się zmieniło od 2026-06-28:** **T-01 zweryfikowane („T-01 OK", 2026-07-02)** — CZĘŚĆ 0 poniżej
> jest już w większości **historyczna** (zostaje tylko opcjonalna „promocja na master"). Domknąłem też
> autonomicznie **T-16** (wyszukiwanie pełnotekstowe notatek) i **T-17** (kolejka zadań AI w tle +
> panel admina `/admin/jobs` + limit uczciwości per-user). **T-18 (i18n) świadomie odłożone** do
> ~100 użytkowników na produkcji. **Moja autonomiczna kolejka jest wyczerpana** — wszystko poniżej
> (CZĘŚĆ 1 i 2) czeka na **Twoje** konta/klucze/decyzje.

## Spis treści
- [CZĘŚĆ 0 — Deploy testowy i weryfikacja wizualna (NAJPIERW)](#część-0--deploy-testowy-i-weryfikacja-wizualna-najpierw)
- [CZĘŚĆ 1 — Konta i klucze zewnętrzne (ETAP 4)](#część-1--konta-i-klucze-zewnętrzne-etap-4)
  - [T-13 — Monitoring błędów (Sentry) + uptime + alert 5xx](#t-13--monitoring-błędów-sentry--uptime--alert-5xx)
  - [T-14 — Kopie zapasowe Neon (PITR) + release-command Render](#t-14--kopie-zapasowe-neon-pitr--release-command-render)
  - [T-15 — Integracje Google (Kalendarz / Gmail)](#t-15--integracje-google-kalendarz--gmail)
- [CZĘŚĆ 2 — Decyzje biznesowe / prawne (ETAP 6)](#część-2--decyzje-biznesowe--prawne-etap-6)
  - [T-19 — Treść prawna (polityka prywatności + regulamin)](#t-19--treść-prawna-polityka-prywatności--regulamin)
  - [T-20 — Płatności + cennik free/premium](#t-20--płatności--cennik-freepremium)
  - [T-21 — Szyfrowanie danych zdrowotnych + „zero reklam"](#t-21--szyfrowanie-danych-zdrowotnych--zero-reklam)
  - [T-22 — 2FA i zarządzanie sesjami](#t-22--2fa-i-zarządzanie-sesjami)
  - [T-23 — Pierwszy vertical branżowy](#t-23--pierwszy-vertical-branżowy)
  - [T-24 / T-25 — Ekonomika i strategia](#t-24--t-25--ekonomika-i-strategia)
- [CZĘŚĆ 3 — Co zrobię autonomicznie po Twoich akcjach](#część-3--co-zrobię-autonomicznie-po-twoich-akcjach)
- [Jak mi przekazać wyniki (szablon)](#jak-mi-przekazać-wyniki-szablon)

---

## CZĘŚĆ 0 — Deploy testowy i weryfikacja wizualna (NAJPIERW)

> **✅ ZROBIONE (2026-07-02 „T-01 OK").** Tę część już przeszliśmy — kod T-02..T-04, T-09..T-12
> został obejrzany na żywo i statusy przełączone 🟡 → ✅. Zostawiam checklistę poniżej jako
> **referencję** (gdybyś chciał ją powtórzyć po większym deployu). Jedyny wciąż „żywy" krok to
> **opcjonalna promocja `develop` → `master`** (sekcja 0.4). Jeśli nic nie promujesz — **przeskocz od
> razu do CZĘŚCI 1**.

To był **najważniejszy i odblokowujący** krok. Cały kod ostatnich zadań (T-02..T-04, T-09..T-12,
T-10) jest scalony na gałęzi **`develop`**. Twoja weryfikacja zamieniła statusy 🟡 → ✅ i odblokowała
rollouty (T-10 pets, T-11).

### 0.1 — Uruchom / potwierdź deploy testowy
- ☐ Wejdź na **Render → Dashboard** (https://dashboard.render.com), usługa **`worldofmag`**.
- ☐ Sprawdź zakładkę **Events/Deploys** — czy ostatni commit `develop` (`34ca54b…`) się zdeployował
  („Live"). Jeśli auto-deploy nie ruszył: **Manual Deploy → Deploy latest commit**.
- ☐ **Cold start free tier:** pierwsze wejście po bezczynności trwa ~10–15 s. To normalne.
- ☐ **Smoke test:** otwórz `https://worldofmag.onrender.com/api/health` — ma zwrócić **200** i status
  bazy „ok". (To samo wykorzystamy w T-13 do uptime-monitora.)

> Uwaga: deploy `develop` = **środowisko testowe**. **Produkcja to `master`** — tam promujemy
> dopiero, gdy powiesz „**promuj na master**" (patrz koniec CZĘŚCI 0).

### 0.2 — Klikana checklista (T-01). Zaloguj się i sprawdź po kolei:

**Modale i puste stany (Z-114 / Z-112):**
> Uwaga: **dodawanie pozycji do listy zakupów jest _inline_** — to pole „Dodaj produkt…" u góry
> listy (wpisz + Enter), **nie modal**. (Tworzenie nowej listy to na razie systemowy `prompt()` —
> zamiana na modal jest w backlogu.) Do sprawdzenia modali użyj poniższych, które faktycznie
> otwierają okno:
- ☐ Kuchnia → **Import przepisu z URL** — otwiera **modal** (samo okno ma działać; ewentualny błąd
  importu to osobna sprawa — patrz niżej „import przepisu 422").
- ☐ Zakupy → gdy odhaczysz wszystkie pozycje → przycisk **„Zakończ zakupy"** otwiera **modal**
  podsumowania; sprawdź, że jest wyśrodkowany, zamyka się Esc i kliknięciem w tło.
- ☐ Magazynowanie → **inwentaryzacja / edycja pozycji** (arkusz/modal) — nic nie „ucieka" poza ekran,
  działa na telefonie.
- ☐ Wejdź do paru pustych sekcji (np. nowa lista, pusty magazyn) — **EmptyState** wygląda spójnie
  (ikonka + komunikat + podpowiedź).

**Polskie slugi wykonawców (slugify, Z-fix ł→l):**
- ☐ Usługi → profil publiczny wykonawcy z polską nazwą (np. „Łódź", „Wałbrzych") → URL
  `/(...)/providers/...` ma sensowny slug (`lodz`, `walbrzych`), nie „odz"/„wa-brzych".

**`/admin/health` — karta „Diagnostyka zapytań" (T-06):**
- ☐ Wejdź na `/admin/health` → przewiń do **„Diagnostyka zapytań"** → karty renderują się
  (badge `index`/`seq`, szac. koszt, lista indeksów). Na małej bazie `Seq Scan` jest normalny.

**Świeżość kalendarza/Home (cache T-09):**
- ☐ Otwórz Kalendarz/Home, zmień coś w innym module (np. zadanie z datą), wróć — dane odświeżają się
  **w ≤ 60 s** (cache ma 60 s TTL; nie ma znikania ani nieświeżych danych dłużej).

**Kontakty — wirtualizacja (T-11):**
- ☐ `/contacts` z większą liczbą kontaktów → lista **płynnie się przewija**; klawisze **`j`/`k`**
  przesuwają zaznaczenie i **doscrollowują** do wiersza poza ekranem; wejście w **edycję** wiersza nie
  rozjeżdża layoutu.

**Zakupy — ręczny DnD kolejności (T-03):**
- ☐ Na liście zakupów najedź na pozycję → po lewej pojawia się **uchwyt** (kropki) → **przeciągnij**
  pozycję w obrębie kategorii (na telefonie: **przytrzymaj ~0,2 s**, potem przeciągnij).
- ☐ Odśwież stronę → **kolejność się trzyma**. Przełącz sortowanie na „🏪 sklep" → ręczna kolejność
  pozycji w kategorii **nadal obowiązuje** (trasa porządkuje tylko nagłówki kategorii).

**Zespół — granularny „Dostęp" domownika (T-12):**
- ☐ `/settings/team/[twój zespół]` (najlepiej zespół typu „rodzina/household" z co najmniej jednym
  innym członkiem). Przy domowniku (nie-właścicielu) jest przycisk **„Dostęp"** → otwiera checkboxy
  modułów.
- ☐ **Odznacz** np. „Portfel", **Zapisz dostęp**. Zaloguj się jako ten domownik (albo poproś go) →
  **nie widzi** już współdzielonych elementów Portfela zespołu, a **widzi** pozostałe (np. Zakupy).
  Zaznacz wszystko z powrotem = pełny dostęp.

**Zadania — sekcja „Udostępnianie" (T-10):**
- ☐ Otwórz szczegół zadania → sekcja **„Udostępnianie"**: dodaj po **e-mailu** z rolą **Widz/Edytor**,
  usuń udostępnienie. Działa jak wcześniej (teraz z reużywalnego komponentu).

### 0.3 — Co mi napisać
- ☐ Napisz **„T-01 OK"** jeśli wszystko gra → oznaczę 🟡 → ✅ i ruszę rollouty.
- ☐ Jeśli coś jest rozjechane: napisz **co dokładnie** (moduł + co widzisz) — naprawię zanim pójdę dalej.

### 0.4 — (Opcjonalnie) Promocja na produkcję
- ☐ Gdy `develop` działa i jesteś zadowolony — napisz **„promuj na master"**. Wtedy scalę
  `develop → master` (Render zdeployuje produkcję `worldofmag.onrender.com`). **Bez Twojego słowa nie
  ruszam `master`.**

---

## CZĘŚĆ 1 — Konta i klucze zewnętrzne (ETAP 4)

Te trzy zadania wymagają Twoich kont/kluczy. Po Twojej stronie jest **założenie konta i podanie mi
kluczy/decyzji**; **kod po mojej stronie** dorobię, gdy to dostanę.

### T-13 — Monitoring błędów (Sentry) + uptime + alert 5xx
*Cel: dowiadywać się o błędach 500 i o tym, że apka leży — zanim zgłosi to użytkownik.*
Gotowe w kodzie: seam `reportClient/ServerError`, `instrumentation.ts` (punkt initu), publiczny
`/api/health`.

**A. Sentry (monitoring błędów):**
- ☐ Wejdź na **https://sentry.io** → załóż darmowe konto (Developer plan wystarczy).
- ☐ **Create Project** → Platform: **Next.js** → nazwa np. `omnia` → Create.
- ☐ Skopiuj **DSN** (wygląda jak `https://<hash>@o<...>.ingest.sentry.io/<id>`).
- ☐ Render → usługa `worldofmag` → **Environment** → **Add Environment Variable**:
  - klucz: `SENTRY_DSN`
  - wartość: *(wklej DSN)*
  - **Save** (Render zrobi redeploy).
- ☐ Napisz mi: **„SENTRY_DSN ustawiony"** → wtedy ja: `npm i @sentry/nextjs`, odkomentuję init w
  `instrumentation.ts` i podepnę `reportServerError` do Sentry (commit + deploy).

**B. Uptime-monitor (czy apka żyje) — przy okazji utrzymuje free tier „rozgrzany":**
- ☐ Wejdź na **https://uptimerobot.com** → darmowe konto.
- ☐ **Add New Monitor** → typ **HTTP(s)** → URL: `https://worldofmag.onrender.com/api/health`
  → interwał **5 min** → wybierz **Alert Contact** (Twój e-mail) → Create.
- ☐ (To pingowanie co 5 min dodatkowo zapobiega usypianiu free tier — bonus do szybkości.)

**C. Kanał alertu 5xx:**
- ☐ W Sentry → **Alerts → Create Alert** → „Issues" → warunek „a new issue is created" → akcja:
  **e-mail** (lub Slack, jeśli używasz). Zapisz.
- ☐ Napisz mi: **„uptime + alert gotowe"** (nic więcej z mojej strony nie trzeba).

---

### T-14 — Kopie zapasowe Neon (PITR) + release-command Render
*Cel: móc odtworzyć bazę po awarii i odsprzęgnąć migracje od builda.*
Gotowe: runbook DR (`worldofmag/docs/devops/runbook-deploy-rollback.md`).

**A. PITR (Point-In-Time Restore) w Neon:**
- ☐ Wejdź na **https://console.neon.tech** → Twój projekt (baza Omnia, region Frankfurt).
- ☐ **Settings → Storage/History retention** (lub zakładka **Branches**) → sprawdź **okno PITR**
  (retencja historii). Free tier bywa krótki (np. 24 h); płatny daje 7–30 dni.
- ☐ Zanotuj okno (np. „24h" / „7 dni") i napisz mi je → udokumentuję **RPO/RTO** w runbooku.
- ☐ **Decyzja:** czy zostajemy na obecnym oknie, czy upgrade planu Neon dla dłuższego RPO?
  *(Rekomendacja: na razie zostań na obecnym — wystarcza dla 1 użytkownika; upgrade dopiero przy
  realnych danych/płatnościach.)*

**B. Przećwicz restore (5 min, bezpiecznie, bez ruszania produkcji):**
- ☐ Neon → **Branches → Create branch → „From a point in time"** → wybierz timestamp sprzed chwili →
  utwórz gałąź. Otwórz jej SQL editor, sprawdź że dane są. To Twój „backup na żądanie".
- ☐ **Nie** przełączaj `DATABASE_URL` produkcji — to tylko ćwiczenie. Gałąź możesz potem usunąć.
- ☐ Napisz **„PITR przećwiczone, okno = X"**.

**C. (Opcjonalnie, później) Release-command na Render — odsprzęgnięcie migracji:**
- ☐ Dziś `npm run build` robi kompilację **i** migracje razem (wygodne, ale miesza artefakt z migracją).
- ☐ **Decyzja:** chcesz to rozdzielić? Jeśli **tak** — napisz „rozdziel migracje", wtedy ja: zmienię
  `build` tak, by **nie** odpalał `scripts/migrate.js`, a Ty w Render → **Settings → Pre-Deploy Command**
  wpiszesz `node scripts/migrate.js`. *(Rekomendacja: opcjonalne; obecny układ działa. Zrób, gdy
  zaczniesz mieć ryzykowne migracje na realnych danych.)*

---

### T-15 — Integracje Google (Kalendarz / Gmail)
*Cel: dwukierunkowy Kalendarz Google i/lub odczyt Gmaila w Omnia.*
Gotowe: wzorzec per-user OAuth (jak Dysk Google, scope `drive.file`) do powielenia; jednostronny feed
iCal już jest.

> **Ważne — to wymaga weryfikacji Google.** Zakresy Kalendarza i (zwłaszcza) Gmaila to **scope'y
> wrażliwe/restricted**. Google wymaga **weryfikacji ekranu zgody** (a dla Gmaila — ciężkiego audytu
> bezpieczeństwa CASA, drogo i długo). **Rekomendacja:** zacznij od **Kalendarza w trybie tylko-odczyt**
> (`calendar.readonly` — „sensitive", lżejsza weryfikacja), a **Gmail odłóż**.

**Kroki (gdy zdecydujesz się ruszyć):**
- ☐ **Decyzja zakresów:** które? *(rekomendacja: tylko `calendar.readonly` na start.)*
- ☐ **Google Cloud Console** (https://console.cloud.google.com) → ten sam projekt, co OAuth logowania:
  - ☐ **APIs & Services → Library** → włącz **Google Calendar API** (i ewentualnie Gmail API).
  - ☐ **APIs & Services → OAuth consent screen** → dodaj wybrane **scopes** → uzupełnij wymagane
    pola (URL polityki prywatności = `https://worldofmag.onrender.com/legal/...`, domena, ewentualnie
    krótkie demo) → **Submit for verification**.
- ☐ Gdy Google zatwierdzi — napisz **„Kalendarz: scope X zatwierdzony"**. Wtedy ja: dorobię osobny flow
  OAuth (przycisk „Połącz Kalendarz", jak przy Dysku), klienta odczytu Kalendarza i wpięcie do agendy.

> Jeśli weryfikacja Google to dla Ciebie teraz za dużo zachodu — **pomiń T-15**; iCal (jednokierunkowy
> eksport do Google/Apple) już działa i na 1 użytkownika często wystarcza.

---

## CZĘŚĆ 2 — Decyzje biznesowe / prawne (ETAP 6)

Tu **kod fundamentu jest gotowy** — brakuje Twoich **decyzji/treści**. Przy każdym podałem
rekomendację, żebyś mógł odpowiedzieć jednym zdaniem.

### T-19 — Treść prawna (polityka prywatności + regulamin)
Gotowe: mechanizm zgód (`UserConsent`, wersjonowanie), strony `/legal/*`, baner, rejestr
podprocesorów (Google/Groq/Neon/Render). Treść jest **robocza** (`src/lib/legal/documents.ts`).
- ☐ Napisz **„wyeksportuj treść prawną"** → wygeneruję Ci czytelny plik (Markdown) z aktualną treścią
  polityki + regulaminu do wysłania **prawnikowi/DPO**.
- ☐ Prawnik zatwierdza/poprawia → odeślij mi finalny tekst → ja podmienię w `documents.ts`, podbiję
  wersję zgód i zdejmę oznaczenie „robocza".
- ☐ (Jeśli masz podprocesorów do umów powierzenia — Google/Groq/Neon/Render — to po stronie
  prawnej; ja tylko aktualizuję rejestr w treści.)

### T-20 — Płatności + cennik free/premium
Gotowe: model `Subscription`, `src/lib/plans.ts` (limity AI per plan, `hasFeature`/`getActivePlan`),
budżet AI per plan, sekcja „Twój plan" w Ustawieniach. Brakuje **3 decyzji** + danych firmy:
- ☐ **Bramka płatności:** **Stripe** czy **Przelewy24**? *(Uwaga: Stripe bywał problematyczny na Twojej
  sieci — do potwierdzenia. Rekomendacja: jeśli głównie PL i faktury VAT PL → Przelewy24; jeśli
  międzynarodowo i wygoda integracji → Stripe.)*
- ☐ **Dane firmy/VAT** do faktur (nazwa, NIP, adres) — podasz, gdy ruszymy integrację.
- ☐ **Linia podziału free/premium + ceny.** Poniżej **propozycja startowa do edycji** — skreśl/zmień:

  | Funkcja | Free | Premium |
  |---|---|---|
  | Moduły podstawowe (zakupy/zadania/notatki/kalendarz) | ✅ | ✅ |
  | Limit zapytań AI / miesiąc | np. 50 | np. 1000 |
  | Asystent AI (agent, briefing) | podstawowy | pełny |
  | Magazyn/Warsztat tryb **Pro** | — | ✅ |
  | Dysk Google / załączniki | mały limit | większy |
  | Zespoły/rodzina (liczba członków) | np. 2 | np. 10 |
  | Cena | 0 zł | np. **19–29 zł/mies.** |

- ☐ Napisz mi: bramka + zaakceptowany podział + ceny → ja: integracja bramki + webhooki statusów →
  `Subscription`, faktury/VAT, mapowanie funkcji premium na `plans.ts`.

### T-21 — Szyfrowanie danych zdrowotnych + „zero reklam"
Gotowe: AI opt-in dla zdrowia (domyślnie OFF), szyfrowanie at-rest na poziomie Neon.
- ☐ **Decyzja A — field-encryption** wrażliwych pól Zdrowia? *(Plus: większa prywatność. Minus:
  utrudnia wyszukiwanie/trendy po tych polach i wymaga zarządzania kluczem. Rekomendacja: **odłóż**,
  dopóki nie masz realnych danych medycznych wielu użytkowników — at-rest Neona na teraz wystarcza.)*
- ☐ **Decyzja B — polityka „zero reklam w Zdrowiu i Finansach":** potwierdzasz na stałe? *(Rekomendacja:
  **tak** — to dobry, prosty commitment etyczny; zapiszę go w polityce prywatności.)*
- ☐ Napisz: „field-encryption: tak/nie", „zero reklam zdrowie+finanse: tak/nie".

### T-22 — 2FA i zarządzanie sesjami
Gotowe: logowanie Google, szyfrowanie kluczy at-rest.
- ☐ **Decyzja:** czy/kiedy dokładamy **2FA** (TOTP) + ekran „aktywne sesje/urządzenia"? *(Rekomendacja:
  po fundamencie RODO/płatności; logowanie Google już daje 2FA po stronie Google. Niski priorytet dla
  1 użytkownika — ale powiedz, jeśli chcesz mieć to wcześniej.)*
- ☐ Napisz: „2FA: teraz / później / pomiń".

### T-23 — Pierwszy vertical branżowy
Gotowe: modularna architektura + RBAC + warstwa planów pod pakiety branżowe.
- ☐ **Decyzja:** którą branżę uruchamiamy jako pierwszą i w jakim MVP?
  - **Hodowca** (gady/zwierzęta — masz już mocny moduł Pets z genetyką/wylęgami),
  - **Gastronomia** (kuchnia/magazyn/koszty),
  - **Flota B2B** (pojazdy/serwis/trasy TIR),
  - **Rolnictwo**.
  *(Rekomendacja: **Hodowca** — Pety to Twój najbogatszy, najbardziej wyróżniający moduł; najmniejszy
  dystans do gotowego MVP.)*
- ☐ Napisz: „vertical #1 = …, zakres MVP = …" → wtedy zaplanujemy pakiet.

### T-24 / T-25 — Ekonomika i strategia
- ☐ **T-24 (ARPU/CAC/LTV):** zależne od **T-20** (przychody) + kosztu pozyskania (marketing). Gdy
  ustawimy billing i kanały — `/admin/metrics` policzy realne wskaźniki. **Nic do zrobienia teraz**
  poza T-20.
- ☐ **T-25 (strategia + model ilościowy + marketing):** to do **wspólnej rozmowy** (plan verticali,
  pełny model kosztów/przychodów, pozycjonowanie/ICP/kanały). Gdy zechcesz, otwórz temat — przygotuję
  szkielet modelu do uzupełnienia.

---

## CZĘŚĆ 3 — Co zrobię autonomicznie po Twoich akcjach

**Stan na 2026-07-14: cała moja czysto-autonomiczna kolejka jest ZROBIONA.** To, co zostało, wymaga
**Twoich** kluczy/decyzji (CZĘŚĆ 1 i 2). Podsumowanie:

**✅ Zrobione autonomicznie (nie wymaga już nic z Twojej strony):**
- **T-01** zweryfikowane (2026-07-02) — statusy 🟡→✅.
- **T-10** rollout — `ShareControl` wpięty w Zadania i Zwierzęta.
- **T-11** — wirtualizacja Kontaktów (wzorzec do powielenia, gdy inne listy urosną).
- **T-16 (FTS notatek)** — indeksy trigramowe pg_trgm + ranking trafności (świadomy dryf udokumentowany).
- **T-17 (kolejka Job AI)** — worker in-process (lazy-start z tras API), **komplet 10 ciężkich operacji
  AI** przeniesionych w tło (OCR, generowanie przepisu, plan tygodnia, wnioski magazynowe/hodowlane,
  draft zamówień, generator map sklepów), **panel admina `/admin/jobs`** (podgląd/retry/anuluj) i
  **limit uczciwości** aktywnych zadań na użytkownika (ochrona kolejki pod skalę wielu userów).

**⏸️ Świadomie odłożone:**
- **T-18 (i18n)** — apka jest po polsku i służy na razie tylko Tobie. Wracamy do tłumaczeń dopiero przy
  **~100 użytkownikach na produkcji** po oficjalnym wydaniu wersji PL.

**⏳ Czeka na Ciebie (kod dorobię po dostarczeniu kluczy/decyzji):**
- **T-13/T-14/T-15** — Sentry init, release-command Render, klient Kalendarza Google (CZĘŚĆ 1).
- **T-20** i pochodne — integracja bramki płatności po wyborze bramki + linii podziału free/premium (CZĘŚĆ 2).

---

## Jak mi przekazać wyniki (szablon)

Skopiuj i uzupełnij — odpowiem działaniem:

```
T-01: OK / problemy: <opis>
promuj na master: tak / nie
SENTRY_DSN: ustawiony / pomijam
uptime + alert: gotowe / pomijam
PITR: przećwiczone, okno = <np. 24h> / pomijam
release-command (rozdziel migracje): tak / nie
Google Kalendarz: scope <calendar.readonly> zatwierdzony / pomijam / Gmail też
treść prawna: wyeksportuj / mam finalną treść (wkleję)
płatności: bramka = Stripe/Przelewy24; podział free/premium = <zmiany w tabeli>; ceny = <…>
field-encryption zdrowie: tak/nie ; zero reklam (zdrowie+finanse): tak/nie
2FA: teraz/później/pomiń
vertical #1: <Hodowca/Gastronomia/Flota B2B/Rolnictwo>, MVP = <zakres>
```

Cokolwiek zostawisz „pomijam/później" — pominę i pójdę dalej z resztą. **Nie musisz robić wszystkiego
naraz** — odhacz choćby CZĘŚĆ 0, a ja ruszam.
$guide_md$,
  'backlog', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "title"=EXCLUDED."title","content"=EXCLUDED."content","category"=EXCLUDED."category","updatedAt"=CURRENT_TIMESTAMP;

INSERT INTO "Report" ("id","title","slug","content","category","authorId","createdAt","updatedAt")
VALUES (gen_random_uuid()::text,
  'Tracker roboczy — plan realizacji (A.16)',
  'tracker-roboczy',
  $tracker_md$# Dodatek A.16 — Plan realizacji i kolejność (TRACKER ROBOCZY)

> **To jest nasz główny, żywy tracker dalszej pracy.** Zadania ułożone **od najprostszych do
> najtrudniejszych**. Po zrobieniu zadania **zmieniamy jego status** (kolumna/emoji). Rozdział A.13
> zostaje jako szczegółowy dziennik `Z-NNN`; A.15 to migawka „co zrobione / co zostało".
>
> **Tu zebrane jest WSZYSTKO, co dawniej było w rozdziale „Decyzje właściciela" (A.14)** — ten rozdział
> jest już nieaktualizowany; korzystamy z tego planu.

**Legenda statusu:**
- ⬜ **TODO** — nieruszone.
- 🟡 **W TOKU** — ruszone, ale niedokończone (często czeka na Twoją weryfikację po deployu).
- 🔓 **CZEKA NA CIEBIE** — wymaga decyzji właściciela / konta / klucza / konfiguracji.
- ⏸️ **ODŁOŻONE** — świadomie, z podanym powodem.
- ✅ **ZROBIONE** — domknięte i zweryfikowane.

**Kto:** 🧑‍💻 = robię ja (kod) · 👤 = akcja po Twojej stronie · 🤝 = ja robię, Ty weryfikujesz/decydujesz.

---

## ETAP 0 — Domknąć „ruszone" (po najbliższym deployu) — minuty

### T-01 · ✅ · 🤝 · Weryfikacja wizualna po deployu (modale / EmptyState / slugi) — *Z-114, Z-112/113, slugify*
> **Zweryfikowane przez właściciela 2026-07-02 („T-01 OK").** Przy okazji wyłapane i naprawione 2 bugi
> (termin zadania `datetime-local` = Invalid Date; import przepisu maskował „LLM nieskonfigurowany" jako
> 422) oraz sprostowana instrukcja (dodawanie pozycji zakupów jest inline, nie modal).
- **Stan:** kod gotowy i skompilowany (tsc), ale **nie zweryfikowany na żywo** (pracujemy na gałęzi
  roboczej, deploy wstrzymany limitem Render). 22 modale przeniesione na dostępny `ui/Modal`, EmptyState
  ujednolicony, slugify wykonawców naprawiony (ł→l), migracja `0196` (onDelete) gotowa.
- **Twoja akcja (👤):** po deployu na `develop` — kliknąć kilka modali (np. dodawanie do listy zakupów,
  edycja spiżarni, import przepisu), sprawdzić puste stany i polskie slugi (`/providers/…`); potwierdzić,
  że nic nie jest rozjechane. **+ `/admin/health` → nowa karta „Diagnostyka zapytań" (T-06) renderuje się. + Kalendarz/Home ładuje się, dane świeże po ≤60 s (cache T-09). + Kontakty (T-11): lista płynnie się przewija, j/k przeskakuje zaznaczenie i doscrollowuje, edycja wiersza nie rozjeżdża layoutu. + Zakupy (T-03): uchwyt DnD przy najechaniu/dotyku, przeciąganie zmienia kolejność w obrębie kategorii (long-press na telefonie), kolejność trzyma się po odświeżeniu i nie psuje sortu po trasie. + Zespół (T-12): w `/settings/team/[id]` przycisk „Dostęp" przy domowniku otwiera checkboxy modułów; po odznaczeniu modułu i zapisie domownik przestaje widzieć współdzielone zasoby tego modułu (a wciąż widzi dozwolone). + Zadania (T-10): sekcja „Udostępnianie" w szczególe zadania działa jak wcześniej (dodaj po e-mailu z rolą Widz/Edytor, usuń), teraz z reużywalnego `ShareControl`.**
- **Po potwierdzeniu:** status → ✅.

---

## ETAP 1 — Tanie decyzje (1 zdanie z Twojej strony odblokowuje) — 👤

### T-02 · ✅ · 🧑‍💻 · ESLint jako bramka — *Z-011 / Z-015*
- **Decyzja właściciela (2026-06-28):** „włącz wg rekomendacji".
- **Zrobione (2026-06-28):** dodano `eslint@8.57.1` + `eslint-config-next@14.2.29` (devDeps);
  `.eslintrc.json` rozszerza `next/core-web-vitals`, rejestruje plugin `@typescript-eslint` (inaczej
  osierocone dyrektywy `eslint-disable @typescript-eslint/*` rzucały „rule not found" = 9 fałszywych
  errorów), a kosmetykę degraduje do **warning** (`no-unescaped-entities`, `exhaustive-deps`,
  `no-img-element`, `alt-text`); `rules-of-hooks` = **error**. Jawna bramka: krok `next lint --dir src`
  w `build` (przed `next build`) + `eslint.ignoreDuringBuilds:true` w `next.config` (jedno miejsce, bez
  dublowania) + skrypty `lint`/`check:lint`. Stan: **0 errorów, 64 warningi** → bramka zielona; realny
  błąd (np. hook warunkowy) ją wywala (zweryfikowane sondą). tsc czysto.
- **Opcjonalnie (przyszłość):** stopniowo zbijać 64 warningi (głównie polskie cudzysłowy w JSX i deps).

### T-03 · ✅ · 🤝 · Zakupy: ręczny DnD pozycji vs sort po trasie — *Z-221*
- **Zweryfikowane przez właściciela 2026-07-02 (T-01 OK).** Decyzja (2026-06-28): „ręczna kolejność nadpisuje trasę, per-kategoria".
- **Zrobione (2026-06-28):** kolumna `Item.order` (migracja `0198`, default 0 = brak ułożenia →
  fallback na priority/createdAt; **100% wstecznie zgodne**); loader strony sortuje
  `[order ASC, priority DESC, createdAt ASC]`; akcja `reorderItems(listId, category, orderedIds)`
  (zapis `order=index` w obrębie jednej kategorii, walidacja przynależności do listy+kategorii);
  nowe pozycje (interaktywny add) dopisywane na KONIEC kategorii (`nextCategoryOrder`). UI: `@dnd-kit/sortable`
  w `CategoryGroup` — przeciąganie ZA UCHWYT (GripVertical, hover/focus), reszta wiersza dalej
  interaktywna; optymistyczna kolejność (lista ID, resync tylko przy add/del); w trybie edycji DnD off;
  sensory Pointer/Touch(delay 200)/Keyboard (a11y). Ręczna kolejność per-kategoria nadpisuje trasę
  (trasa porządkuje tylko nagłówki kategorii). tsc + lint czysto; test kontraktu sortowania (4 asercje,
  DB) → suite 353/353.
- **Zostaje (po deployu):** wzrokowo sprawdzić DnD na telefonie (long-press) i desktopie; reorder w widoku
  z filtrem dotyczy tylko widocznych pozycji (świadome ograniczenie — pełne ułożenie w widoku „Wszystkie").

### T-04 · ✅ · 🧑‍💻 · Reguła przy usuwaniu konta właściciela zespołu — *Z-051 część*
- **Decyzja właściciela (2026-06-28):** auto-transfer na najstarszego ADMIN-a (fallback najstarszy
  członek); zespół solo kasowany wraz z zasobami.
- **Zrobione (2026-06-28):** zdjęta twarda blokada w `deleteMyAccount`; `purgeUserData` najpierw
  rozwiązuje zespoły usera-właściciela (`resolveOwnedTeams`): są inni członkowie → własność na następcę
  wg czystego `pickTeamSuccessor` (`src/lib/teams/ownership.ts`: najstarszy ADMIN → najstarszy członek),
  następca dostaje rolę OWNER, zasoby zespołu zostają; zespół solo → `team.delete()` (ownerTeam=Cascade
  sprząta zasoby+członkostwa). Respektuje `Team.ownerId` = RESTRICT (transfer/usun PRZED `user.delete`).
  6 testów jednostkowych reguły + 2 DB-gated (transfer zachowuje zasoby/preferuje ADMIN-a; solo kasuje
  kaskadowo). tsc + lint czysto; suite 364/364. UI bez zmian (nie pre-sprawdzała własności).

### T-05 · ⏸️ · 👤 · Model reklam — kierunek — *Z-474 (P2)*
- **Decyzja właściciela (2026-06-28):** reklamy kontekstowe **bez profilowania**, z opcją „wyłącz",
  ale **dopiero po wdrożeniu freemium/B2B** (zależne od T-20). Świadomie ODŁOŻONE — zero kodu teraz;
  wraca jako temat po uruchomieniu płatności i linii podziału free/premium.

---

## ETAP 2 — Łatwe autonomiczne (kod, weryfikowalne lokalnie) — 🧑‍💻

### T-06 · ✅ · 🧑‍💻 · Diagnostyka wolnych zapytań (EXPLAIN) w `/admin/health` — *Z-037 (P2)*
- **Zrobione (2026-06-27):** `src/lib/health/queryDiag.ts` (czysty parser `summarizeExplainPlan` + 4
  reprezentatywne zapytania list) + sekcja `queryDiagnostics` w `src/actions/systemHealth.ts`
  (`EXPLAIN (FORMAT JSON)` **bez ANALYZE** = plan bez wykonania, bezpieczne na prod) + karta „Diagnostyka
  zapytań" w `SystemHealthPage` (badge index/seq + szac. koszt + indeksy). Monitor regresów: Seq Scan na
  DUŻej gorącej liście = sygnał (na małej bazie Seq jest normalny).
- **Weryfikacja:** 7 testów parsera (`queryDiag.test`); 4/4 EXPLAIN poprawne na lokalnym Postgresie; tsc
  czysto; suite **326/326**. **Render karty do obejrzenia po deployu → dopisane do T-01.**

### T-07 · ✅ · 🧑‍💻 · Tańszy model dla `dispatch` — *Z-134*
- **Już spełnione architekturą operationType** (bez zmian kodu, weryfikacja 2026-06-27): `lib/llm/resolver.ts`
  mapuje `dispatch` → `OPERATION_TYPE_META.dispatch.defaultModel` = **`llama-3.1-8b-instant`** (tani/szybki),
  a `reasoning`/`generation` → `llama-3.3-70b-versatile`. Wszystkie trasy klasy dispatch (normalize,
  parse-ingredients, categorize, notes/tags, tasks/parse, import-url, magazyn/*, klasyfikacja agenta…)
  wołają z `op:"dispatch"`. Admin może nadpisać w `/admin/llm`. To dokładnie Z-134.

### T-08 · ✅ · 🧑‍💻 · Drobne P2 modułowe + dalsze testy czystej logiki
- **Zrobione (2026-06-27):** testy spójności katalogu warsztatów (`src/lib/warsztat/catalog.ts`, 6 testów):
  fallbacki `getWorkshopType`/`getSuggestions`, każdy typ ma niepustą listę, **unikalność `key` w obrębie
  typu** (łączy się z `WorkshopItem.suggestionKey`), komplet pól + poprawny kind/tier. Strażnik przed cichym
  błędem przy rozbudowie statycznego katalogu. tsc czysto; suite **332/332**.
- Pozostali kandydaci na przyszłość (gdy wrócimy do P2): Z-034/035, Z-116/117/118 + przegląd modułów per rozdział.

---

## ETAP 3 — Średnie autonomiczne (kod robię ja, zachowanie weryfikujesz po deployu) — 🤝

### T-09 · ✅ · 🤝 · Cache najgorętszych odczytów (agregat kalendarza) — *Z-072*
- **Zrobione (2026-06-27):** `getCalendarEvents` (`src/actions/calendar.ts`) owinięte w `unstable_cache`
  z **kluczem PER-USER + 60 s TTL** (`collectCalendarEvents` jest cookie-free → bezpieczne w cache).
  Świeżość gwarantuje TTL — **bez ręcznej inwalidacji** (świadomie: zero footguna „zapomniany
  revalidateTag" w dziesiątkach mutacji); `user.id` w kluczu = brak przecieku między userami. Gorący
  agregat wielomodułowy (zadania/posiłki/zdrowie/leki/flota/zwierzęta/SRS) — kalendarz, briefing, Home.
- **Weryfikacja:** tsc czysto; suite 332/332. **Zachowanie (cache'owanie, świeżość ≤60 s) — po deployu → T-01.**

### T-10 · ✅ · 🤝 · Ujednolicony „Udostępnij" — *Z-193*
- **Rdzeń (2026-06-27):** `src/lib/sharing/capabilities.ts` — JEDNA mapa „jak każdy moduł się dzieli"
  (`team`/`entity`/`projectMembers`) + helpery + etykiety. 5 testów.
- **Komponent + integracje (2026-06-28…07-02):** reużywalny, prezentacyjny `ShareControl`
  (`src/components/sharing/ShareControl.tsx`, z opcją `hideHeader`) czytający mapę zdolności — lista
  udostępnień + dodawanie po e-mailu („entity") + podpowiedź o pozostałych mechanizmach. Logika dostępu
  w Server Actions (callbacki) — zero zmian semantyki. Wpięty w **Zadania** (`TaskDetail`, zweryfikowane
  T-01) **i Zwierzęta** (`PetSections`, `hideHeader` pod `SectionShell`, zachowany komunikat o
  współdzieleniu zespołowym). tsc+lint czysto.
- **Opcjonalnie (przyszłość, niski priorytet):** ujednolicenie *wyboru właściciela-zespołu* przy
  tworzeniu/edycji zasobów (dziś każdy moduł ma własny selektor) — świadomie NIE forsuję na siłę, bo
  to szeroka zmiana o małej wartości; wzorzec `ShareControl` gotowy, gdy zajdzie potrzeba.

### T-11 · ✅ · 🤝 · Wirtualizacja długich list — *Z-071*
- **Zweryfikowane przez właściciela 2026-07-02 (T-01 OK — Kontakty płynne, j/k doscrollowuje).**
- **Zrobione (2026-06-28):** dodano `@tanstack/react-virtual@3.14.4` i owinięto najdłuższą płaską
  listę (**Kontakty**, `ContactsPage`) w wirtualizer: renderuje tylko widoczne wiersze (+overscan 8),
  dynamiczny pomiar wysokości (`measureElement` — wiersze różnej wysokości: tagi/notatki + tryb edycji),
  `scrollMargin` liczony od kontenera strony (nagłówek+szukajka w tym samym scrollu), a nawigacja
  klawiaturą woła `virtualizer.scrollToIndex` (zamiast `scrollIntoView` po refie — wiersze poza ekranem
  nie istnieją w DOM). **Wzorzec do powielenia** udokumentowany w komentarzu (load-all + client-filter).
  tsc czysto; suite 349/349.
- **Zostaje (po deployu / rollout):** wzrokowa weryfikacja płynności i nawigacji j/k na Kontaktach
  (po deployu → T-01); powielenie wzorca na kolejne długie listy gdy realnie urosną (np. magazyn — ale
  to lista grupowana w sekcjach, wymaga spłaszczenia indeksu jak w Z-232).

### T-12 · ✅ · 🤝 · Role rodzic/dziecko w rodzinie — *Z-194*
- **Rdzeń (2026-06-28):** kolumna `TeamMember.moduleAccess` (TEXT JSON `string[]`|NULL, migr. `0197`)
  + czysty helper `src/lib/teams/memberAccess.ts` (`canMemberAccessModule`, parse/serialize,
  `RESTRICTABLE_MODULES`+etykiety z mapy Z-193). Reguła: rodzice OWNER/ADMIN = pełny dostęp; dziecko
  `null` = pełny (wstecznie zgodne); `[]` = brak; lista = tylko wymienione. 13 testów jednostkowych.
- **Dokończone (2026-06-28):** akcja `setMemberModuleAccess` (ADMIN/OWNER, nie dla OWNER/siebie) +
  UI „Dostęp" per-domownik w `MemberList` (`/settings/team/[id]`: checkboxy modułów, wszystkie
  zaznaczone = `null` = pełny dostęp). **Egzekwowanie:** `getAccessibleTeamIds(userId, moduleId)`
  wpięte w gettery-odczyty 11 modułów team-owned (shopping, notes, kitchen [recipes/cookbooks/
  mealplans/pantry], health [+medications], habits, flota, portfel [+budgets/reports], languages,
  magazynowanie, warsztaty, pets [+husbandry/breeding]) — zamiast `getUserTeamIds` w gałęzi
  `user.id` (gardy-zapisy `userId` nietknięte). **100% wstecznie zgodne** (default null = bez zmian).
  Test DB egzekwowania (dziecko z ograniczeniem nie widzi zespołu dla zablokowanego modułu). tsc+lint;
  suite 369/369.
- **Poza zakresem (inny model współdzielenia):** `tasks` (projectMembers/entity — nie `ownerTeamId`+
  `getUserTeamIds`) i `contacts` (user-only) — egzekwowanie tam wymaga osobnego podejścia (follow-up).

---

## ETAP 4 — Wymaga Twojego konta/klucza/konfiguracji (zewnętrzne) — 🔓 / 🤝

### T-13 · 🔓 · 🤝 · Error-tracking + uptime + alert 5xx — *Z-090*
- **Gotowe:** seam `reportClient/ServerError`, `instrumentation.ts` (punkt initu), publiczny `/api/health`
  (200/503 + ping DB).
- **Brakuje (Ty):** ustawić `SENTRY_DSN` w env Render + (opcjonalnie) `npm i @sentry/nextjs` i odkomentować
  init; wybrać zewn. uptime-monitor (UptimeRobot/Better Uptime) pingujący `/api/health`; kanał alertu 5xx
  (e-mail/Slack).

### T-14 · 🔓 · 🤝 · DR: włączenie PITR na Neon + release-command Render — *Z-093 / Z-092*
- **Gotowe:** runbook DR (`docs/devops/runbook-deploy-rollback.md`) — restore z PITR/branch Neona +
  checklist; build artefaktu jest DB-free.
- **Brakuje (Ty):** włączyć PITR na koncie Neon + przećwiczyć restore (RPO/RTO); skonfigurować
  release-command na Render, by w pełni odsprzęgnąć migrację od build/deploy.

### T-15 · 🔓 · 🤝 · Integracje Gmail / Google Calendar — *Z-150 / Z-151 / Z-156*
- **Gotowe:** wzorzec per-user OAuth (Drive, scope `drive.file`) do powielenia; feed iCal (jednostronny)
  już jest.
- **Brakuje (Ty):** decyzja o zakresach + **rozszerzenie scope OAuth Google + przejście weryfikacji ekranu
  zgody (Google review)** dla zakresów wrażliwych. Potem ja implementuję klientów (odczyt Kalendarza, Gmail).

---

## ETAP 5 — Trudne / architektoniczne (większy nakład) — 🧑‍💻

### T-16 · ✅ · 🧑‍💻 · Wyszukiwanie pełnotekstowe notatek (FTS) — *Z-240*
- **Decyzja właściciela (2026-07-02):** „rób FTS, zgoda na dryf".
- **Zrobione (2026-07-02):** wariant **trigramowy** (najbezpieczniejszy — bez przepisywania logiki
  dostępu na surowy SQL): migracja `0201` = `CREATE EXTENSION pg_trgm` + indeksy GIN `gin_trgm_ops`
  na `Note.title`/`Note.content`. Przyspieszają istniejące `col ILIKE '%q%'` (zero zmian zapytania/
  zachowania/wyników, filtr zostaje w Prisma) — potwierdzone `EXPLAIN`: `Bitmap Index Scan on
  Note_title_trgm_idx`. Do tego **ranking trafności app-level** (`src/lib/notes/searchRank.ts`:
  tytuł waży ~3×, całe pole/prefiks/początek słowa > środek, liczba trafień) wpięty w `getNotes` tylko
  przy `search` (bez `search` kolejność bez zmian). 12 testów (9 rankingu + 3 DB: rozszerzenie/indeksy
  istnieją, filtr poprawny, planer używa indeksu). tsc+lint czysto.
- **ŚWIADOMY DRYF (zaakceptowany):** rozszerzenie + indeksy wyrażeniowe żyją tylko w migracji `0201`
  (nie w `schema.prisma`) → `migrate diff` pokaże dryf. Bezpieczne przy `migrate deploy`; **nie**
  uruchamiać `migrate dev`/auto-fix na prodzie (mógłby usunąć indeksy). Udokumentowane w migracji.

### T-17 · ✅ · 🧑‍💻 · Kolejka Job dla ciężkich operacji AI — *Z-131*
- **Decyzja właściciela (2026-07-02):** Faza 1, worker in-process (prod płatny = nie usypia); projekt
  wieloworkerowy pod przyszłą skalę; awans do osobnego workera Render „gdy ruch zażąda" (bez zmiany kodu).
- **Faza 1 — rdzeń gotowy (2026-07-02):** model `Job` (migr. `0202`; status/attempts/backoff/runAfter/
  lockedAt/ownerId/dedupeKey; brak FK — sprzątany w `purgeUserData`, RODO). Kolejka
  `src/lib/jobs/queue.ts`: `enqueue` (idempotencja dedupeKey), **`claimNext` = `SELECT … FOR UPDATE
  SKIP LOCKED`** (wieloworkerowo bez podwójnego wzięcia), `complete`/`fail`+wykładniczy backoff,
  `failJobPermanent`, odzysk po crashu (visibility timeout), `cleanupOldJobs`. Worker in-process
  (`worker.ts`, singleton, `JOBS_WORKER_DISABLED` do testów) **startowany leniwie z tras API**
  (`startJobWorker()` przy pierwszym enqueue/pollingu) — **NIE** z `instrumentation.ts` (to ciągnęło
  `node:crypto` do edge-bundla i wywalało `next build`; patrz doświadczenia 2026-07-02). API
  `POST /api/jobs` (allowlista typów) + `GET /api/jobs/[id]` (scoped do właściciela). Klient `runJob`
  (enqueue+polling→wynik/rzut — near-drop-in dla UI). **10 testów DB** (m.in. dwa równoległe claimy =
  dokładnie jeden bierze; retry/backoff; odzysk RUNNING; dedupe). tsc+lint; suita 398/398.
- **Wpięte async — KOMPLET 10 operacji (2026-07-02):**
  - **Vision/OCR:** `kitchen.ocrImage` (ImportFromImageDialog), `kitchen.ocrText` (RecipeImagesEditor),
    `magazyn.scan` (StorageScan), `magazyn.document` (DocumentsPage).
  - **Reasoning/generation:** `kitchen.generateRecipe` (ImportFromAIDialog), `kitchen.planWeek`
    (PlanWeekDialog — handler czyta przepisy/spiżarnię po `ownerId`), `magazyn.insights`
    (StorageAnalytics), `magazyn.orderDraft` (PurchaseOrders), `pets.insights` (WelfareSuggestions),
    `stores.generate` (StoreWizard).
  - Każda: handler w `src/lib/jobs/handlers/*`, rejestr + allowlista, stara trasa cienka (deleguje),
    klient woła `runJob` (near-drop-in). „Twarde" ops rzucają `JobError`; „miękkie" (insights/tips/
    order-draft) degradują łagodnie (`unavailable`). Zweryfikowane `next build` (exit 0) + suita 398/398.
  - **Świadomie SYNC:** skan w asystencie AI (`AICommandSheet`, interaktywny czat), briefing, oraz
    szybki dispatch (parse/normalize/categorize/tags/title/search/enrich, notes qa/rewrite).
- **Hardening obserwowalności + skali (2026-07-14):** panel admina **`/admin/jobs`** (liczniki wg
  statusu, aktywne wg typu, top konsumenci per-user, lista ostatnich zadań, ręczny **retry**/anuluj,
  sprzątanie 24h+; `actions/jobs.ts`, admin-only) + **limit uczciwości** aktywnych zadań na użytkownika
  (`MAX_ACTIVE_JOBS_PER_OWNER=20` w `enqueue` → `QuotaError` → HTTP 429, sprawdzany **po** dedupe, by
  idempotentny re-submit nie padał). Nowe helpery `countActiveJobsForOwner`/`requeueJob`/`cancelJob`.
  4 nowe testy (limit + dedupe-bypass + admin retry/cancel). tsc+lint+`next build` (exit 0); suita 400+4.
- **Faza 2 (przyszłość, gdy ruch zażąda):** wynieść workera do osobnej usługi Render (ten sam kod
  kolejki — `SKIP LOCKED` już wieloworkerowy); knobki współbieżności/per-user.

### T-18 · ⏸️ · 🧑‍💻 · Warstwa i18n `t()` (przyrostowo) — *Z-115*
- **Decyzja właściciela (2026-07-14):** świadomie **ODŁOŻONE**. Produkcja służy na razie tylko właścicielowi
  (apka PL). i18n wracamy dopiero **~100 użytkowników na produkcji** po oficjalnym wydaniu wersji PL —
  wtedy dokładamy inne języki. Zero kodu teraz.
- Scaffolding `t()` + ekstrakcja stringów. `formatMoney` już na `Intl.NumberFormat`. Duże, przyrostowe.

---

## ETAP 6 — Biznes / prawo / strategia (głównie Ty; duży ciężar) — 🔓

### T-19 · 🔓 · 👤 · Treść prawna: polityka prywatności + regulamin — *Z-053*
- **Gotowe:** mechanizm zgód (`UserConsent`, wersjonowanie), strony `/legal/*`, baner, rejestr
  podprocesorów (Google/Groq/Neon/Render). Treść = `src/lib/legal/documents.ts` (oznaczona „robocza").
- **Brakuje (Ty):** zatwierdzenie treści przez prawnika/DPO + ewentualne umowy powierzenia z podprocesorami.

### T-20 · 🔓 · 🤝 · Płatności + cennik free/premium — *Z-473 / Z-470*
- **Gotowe:** model `Subscription` + `src/lib/plans.ts` (limity AI per plan, `hasFeature`/`getActivePlan`),
  budżet AI per plan, sekcja „Twój plan" w Ustawieniach.
- **Brakuje (Ty + ja):** wybór bramki (**Stripe** vs **Przelewy24** — Stripe bywał problematyczny na
  Twojej sieci, do potwierdzenia), dane firmy/VAT, **linia podziału funkcji free/premium** + ceny. Potem ja:
  integracja bramki + webhooki statusów → `Subscription`, faktury/VAT, mapowanie funkcji premium.

### T-21 · 🔓 · 🤝 · Dane zdrowotne: field-encryption + „zero reklam" — *Z-270 część*
- **Gotowe:** AI opt-in dla danych zdrowotnych (domyślnie OFF), at-rest na poziomie Neon.
- **Brakuje (decyzja):** czy wdrażać **field-encryption** wrażliwych pól (wpływa na wyszukiwanie/trendy) +
  zarządzanie kluczami; potwierdzenie polityki „zero reklam w Zdrowiu/Finansach".

### T-22 · 🔓 · 🤝 · 2FA + zarządzanie sesjami/urządzeniami — *Z-058*
- **Gotowe:** logowanie Google, szyfrowanie kluczy at-rest (`secrets.ts`); procedura sekretów (Z-054) ✅.
- **Brakuje (decyzja):** czy/kiedy 2FA + zarządzanie sesjami (po fundamencie RODO).

### T-23 · 🔓 · 👤 · Pierwszy vertical / podaplikacja branżowa — *Z-490*
- **Gotowe:** modularna architektura + RBAC + warstwa planów do pakietów branżowych.
- **Brakuje (decyzja):** którą branżę uruchamiamy pierwszą (Hodowca / Gastronomia / Flota B2B /
  Rolnictwo) i w jakim zakresie MVP.

### T-24 · 🔓 · 👤 · Ekonomika ARPU / CAC / LTV — *Z-510 część*
- **Gotowe:** `/admin/metrics` liczy realny koszt AI / MAU z `AiUsage` (cena tokenów konfigurowalna).
- **Brakuje:** źródło przychodów (billing — T-20) + koszt pozyskania (marketing) do policzenia ARPU/CAC/LTV.
  Zależne od T-20.

### T-25 · ⬜ · 👤 · Strategia podaplikacji + model ilościowy + marketing — *Z-490–495 / Z-512–515 / Z-530–535*
- Całe obszary biznesowe (nie kod): plan verticali, pełny model kosztów/przychodów, pozycjonowanie/ICP/kanały.
  Do wspólnego omówienia.

---

_**Postęp ETAP 2 — UKOŃCZONY (2026-06-27):** T-06 ✅ (Z-037 diagnostyka EXPLAIN), T-07 ✅ (Z-134 już
spełnione architekturą operationType), T-08 ✅ (testy spójności katalogu warsztatów). Suite 332/332.
**Następne: ETAP 3 (T-09…T-12) — deploy-zależne, podejmę na „rób dalej"; ETAP 1 (T-02…T-05) czeka na Twoje decyzje.**_
_**Postęp ETAP 3 (2026-06-28):** T-09 ✅, T-10 🟡 (rdzeń), **T-11 🟡** (rdzeń: Kontakty zwirtualizowane
`@tanstack/react-virtual`, wzorzec do powielenia), **T-12 ✅** (rdzeń + egzekwowanie w 11
modułach + UI „Dostęp" domownika). Suite 369/369; tsc+lint czysto. Zostaje wzrokowa weryfikacja po
deployu (→T-01) + wzorzec wirtualizacji na kolejne listy (T-11) + ujednolicony „Udostępnij" (T-10 UI)._
_**Postęp ETAP 1 (2026-06-28, decyzje właściciela „wszystkie wg rekomendacji"):** **T-02 ✅** (ESLint
bramka), **T-03 🟡** (DnD kolejności zakupów, migr. 0198 — zostaje wizualna weryfikacja po deployu),
**T-04 ✅** (auto-transfer/usuń zespół solo przy kasowaniu konta), **T-05 ⏸️** (reklamy odłożone do
freemium). Suite 364/364; tsc + lint czysto. Pozostają decyzje właściciela: ETAP 4 (T-13/14/15 — konta/
klucze zewn.) i ETAP 6 (biznes/prawo)._
_**Postęp 2026-07-02 (weryfikacja właściciela „T-01 OK" + domknięcia):** **T-01 ✅** (wizualna
weryfikacja; przy okazji fix terminu zadania + odmaskowanie importu przepisu), **T-03 ✅**, **T-11 ✅**,
**T-10 ✅** (ShareControl wpięty w Zadania + Zwierzęta). tsc+lint czysto; pełna suita zielona.
**Pozostaje autonomicznie:** T-16 (FTS — czeka na zgodę na świadomy dryf), T-17 (kolejka Job — decyzja
o workerze), T-18 (i18n — niski priorytet). Reszta = ETAP 4/6 (konta/klucze/decyzje właściciela)._
_**Postęp 2026-07-14:** **T-16 ✅** (FTS notatek — pg_trgm + ranking), **T-17 ✅** (kolejka Job: komplet
10 operacji async + hardening: panel `/admin/jobs` + limit uczciwości per-user), **T-18 ⏸️** (i18n
świadomie odłożone do ~100 userów na prod — decyzja właściciela). tsc+lint+`next build` zielone.
**Stan autonomiczny: WYCZERPANY** — wszystkie pozostałe zadania (T-13/14/15 = ETAP 4 konta/klucze;
T-19…T-25 = ETAP 6 biznes/prawo) czekają na akcje/decyzje właściciela (patrz `PRZEWODNIK-WLASCICIELA.md`)._
_Tracker roboczy — aktualizowany po każdym zadaniu (status ⬜/🟡/🔓/⏸️ → ✅). Utworzony 2026-06-27 z
przeniesieniem rozdziału A.14 („Decyzje właściciela") w całości tutaj. Postęp historyczny `Z-NNN`: A.13._
$tracker_md$,
  'backlog', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "title"=EXCLUDED."title","content"=EXCLUDED."content","category"=EXCLUDED."category","updatedAt"=CURRENT_TIMESTAMP;
