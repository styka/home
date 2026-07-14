# Przewodnik właściciela — krok po kroku (WorldOfMag / Omnia)

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
