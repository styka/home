-- Raport implementacyjny: wyniesienie powiadomień i admińskiego zgłaszania błędów
-- z pływającego rogu do chrome nawigacji (róg = tylko asystent AI).
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-08',
  'omnia-implementacja-2026-06-08',
  $omnia_chrome_fabs$# Omnia — Raport implementacji 2026-06-08

Sesja realizuje jedno zgłoszenie UX: w prawym dolnym rogu zebrały się trzy
pływające przyciski — asystent AI („magiczna ikona"), dodany w międzyczasie
dzwonek powiadomień oraz admiński przycisk „zgłoś błąd / sugestię" (tryb
wskazywania). Dzwonek i przycisk admina miały **identyczną pozycję**, więc na
siebie nachodziły. Zadanie: przemyśleć, jak te funkcje powinny być udostępnione.

---

## Trzy pływające przyciski w jednym rogu — układ i ekspozycja funkcji
**Diagnoza:** Róg z magiczną ikoną zaczął pełnić rolę „szuflady na wszystko".
Trzy FAB-y to zła UX (róg powinien mieć jedną główną akcję), a konkretny błąd to
kolizja: dzwonek (`NotificationBell`) i admiński przycisk (`FeedbackInspector`)
renderowały się w tym samym miejscu (`right-5`, `bottom-[132px] md:bottom-[84px]`),
więc dzwonek zasłaniał przycisk admina. Wymagania ze zgłoszenia: powiadomienia i
admiński trigger nie mogą walczyć o róg z asystentem; admiński trigger ma być
dostępny (w tym na mobile), ale nie musi to być stały pływający przycisk.

**Rozwiązanie (decyzja UX — wariant „hybryda"):** Róg ekranu zostaje **wyłącznie
dla asystenta AI** (akcja sygnaturowa). Powiadomienia i admiński trigger to
elementy *chrome* (nawigacja/status), nie akcje główne — więc wychodzą z rogu do
nawigacji, zgodnie z konwencją (powiadomienia bliżej góry, w pasku/menu).

- **Dzwonek powiadomień** stał się komponentem **osadzalnym** (prop `placement`)
  zamiast zaszytego `position: fixed`. Na desktopie renderuje się jako **wiersz w
  stopce sidebara** (panel rozwija się w górę i w prawo, nad rzędem), na mobile —
  jako **kompaktowa ikona w górnym pasku** (panel rozwija się w dół, do prawej
  krawędzi). Dzięki temu licznik nieprzeczytanych jest stale widoczny w naturalnym
  miejscu, a panel nie konkuruje z asystentem. Render w dwóch miejscach naraz jest
  bezpieczny, bo skan terminów `syncReminders` jest **idempotentny** (`upsert` po
  `dedupeKey`) — podwójne wywołanie nie tworzy duplikatów.

- **Admiński „tryb wskazywania"** stracił stały pływający przycisk. Uruchamiają go
  teraz: skrót **Ctrl/Cmd+Shift+B** (już istniał), **wpis w panelu admina**
  („Narzędzia") oraz **admiński przycisk w górnym pasku** (tylko dla admina, mobile
  — by dało się go odpalić bez klawiatury). Wszystkie trzy wejścia używają nowej,
  lekkiej **magistrali zdarzeń** `feedbackBus` (`window` CustomEvent
  `omnia:feedback-start` → listener w `FeedbackInspector`), analogicznie do
  istniejącego `assistantBus` — taniej niż przebudowa na React Context. Sam
  `FeedbackInspector` renderuje już tylko overlay trybu (podświetlenie elementu +
  pasek instrukcji), bez własnego FAB.

**Zmienione pliki:**
- `src/components/shell/NotificationBell.tsx` — osadzalny (prop `placement: "sidebar" | "topbar"`); wrapper `relative` zamiast `fixed`; trigger i kotwica panelu zależne od miejsca (góra→w dół, dół→w górę).
- `src/components/shell/ModuleSidebar.tsx` — dzwonek (`placement="sidebar"`) w stopce, nad „Zaproszenia".
- `src/components/shell/AppShell.tsx` — dzwonek (`placement="topbar"`) i admiński przycisk „zgłoś błąd" w prawej części górnego paska (mobile); usunięty pływający `NotificationBell` z rogu.
- `src/components/shell/FeedbackInspector.tsx` — usunięty stały FAB; nasłuch na `feedbackBus`; pozostał tylko overlay trybu wskazywania.
- `src/lib/ai/feedbackBus.ts` — nowy; `startFeedbackInspector()` (CustomEvent) do uruchomienia trybu z dowolnego miejsca.
- `src/components/admin/FeedbackTriggerButton.tsx` — nowy; wpis w panelu admina uruchamiający tryb.
- `src/app/admin/page.tsx` — osadzenie `FeedbackTriggerButton` na liście „Narzędzia".
- `prisma/migrations/0102_omnia_implementation_report_chrome_fabs/migration.sql` — ten raport.

## Podsumowanie
Jedno zgłoszenie UX domknięte zgodnie z zasadą „jeden róg = jedna akcja":
asystent AI zostaje jedynym pływającym przyciskiem, a powiadomienia i narzędzie
admina trafiły do chrome nawigacji (sidebar/górny pasek), gdzie ich miejsce.
Kluczowe decyzje: uczynienie dzwonka osadzalnym (zamiast `fixed`) z kotwicą panelu
dobieraną do położenia, oraz odpięcie admińskiego trybu od stałego przycisku na
rzecz wyzwalania z wielu miejsc przez magistralę zdarzeń. Pułapka, o której
trzeba było pamiętać: stanowy komponent renderowany w dwóch miejscach naraz —
zadziałało bezpiecznie tylko dlatego, że jego efekt montażu (skan terminów) jest
idempotentny. Weryfikacja: `tsc --noEmit` oraz `next build` przechodzą; krok
`migrate.js` świadomie pominięto lokalnie (pisze do produkcyjnej bazy). Raport
zapisany migracją → pojawia się w `/reports` po deployu.
$omnia_chrome_fabs$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
