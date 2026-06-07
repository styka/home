-- Raport implementacyjny: UX pływających przycisków (magiczna ikona vs admin-zgłoszenie)
-- i ich zachowanie przy otwartych modalach/dialogach.
-- Idempotentny INSERT z dollar-quoting (jak pozostałe raporty w projekcie).
-- Slug z dopiskiem tematu, bo "omnia-implementacja-2026-06-07" jest już zajęte (migracja 0098).

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-07 (UX pływających przycisków)',
  'omnia-implementacja-2026-06-07-ux-przyciski',
  $omnia_fab_ux$# Omnia — Raport implementacji 2026-06-07 (UX pływających przycisków)

Sesja realizuje jedno zgłoszenie dotyczące współistnienia dwóch pływających
przycisków (FAB) w prawym dolnym rogu: **magicznej ikony asystenta AI** (akcja
główna) oraz **admińskiego przycisku „zgłoś błąd/sugestię"** (tryb wskazywania).
Zgłoszenie poprosiło wprost o „przegadanie z najlepszym UX designerem" trzech
spraw: nakładania się przycisków, właściwego miejsca przycisku admina oraz ich
zachowania, gdy na ekranie pojawia się modal/dialog.

---

## Pływające przyciski: nakładanie, hierarchia i zachowanie nad modalami
**Diagnoza:** Admiński FAB (robaczek) **nakładał się na magiczną ikonę i ją
zasłaniał** — oba miały `z-40`, a że `FeedbackInspector` jest montowany w `AppShell`
po `AICommandSheet`, w równym z-index wygrywał późniejszy w DOM (admin nad
asystentem). Wymaganie było odwrotne: główna akcja (magiczna ikona) może co
najwyżej lekko zasłonić przycisk admina, nigdy na odwrót. Dodatkowo geometria
powodowała realne nachodzenie na desktopie (magiczna ikona 52 px od dołu 24 px →
sięga 76 px; admin 44 px od dołu 68 px → zaczyna na 68 px, czyli 8 px zakładki).
Druga, ważniejsza część zgłoszenia to zachowanie przy otwartym modalu: przycisk
admina **musi** pozostać widoczny i klikalny (by wskazać błędny element wewnątrz
modalu), natomiast czy magiczna ikona powinna być wtedy dostępna — było otwarte.

**Rozwiązanie (decyzja UX):** Magiczna ikona to akcja-bohater i zawsze wygrywa
o miejsce; przycisk admina to narzędzie pomocnicze, więc siedzi nad nią, ale niżej
w z-index i z odstępem (zero nakładania w spoczynku). Przy **otwartym modalu
treściowym** magiczną ikonę **chowamy** — wyrzucanie kolejnego pływaka, który
otwiera następny pełnoekranowy sheet na wierzchu modalu, rozprasza i łamie zasadę
„bez dialogu na dialogu"; za to przycisk admina **zostaje, wskakuje w zwolnione
główne miejsce na dole i wynosi się nad modal**, bo to dokładnie moment, w którym
admin chce wskazać element w modalu. Gdy otwarty jest **sam asystent**, przycisk
admina chowamy (żeby nie zasłaniał sheetu), a żeby asystent otwarty z trybu
wskazywania renderował się NAD modalem, z którego admin wskazał element, podniesiono
overlay asystenta i `ActionDrawer` ponad warstwę modali (kontekst zgłoszenia i tak
jest już przechwycony jako tekst, więc bazowy modal może zostać pod spodem).

Detekcję „czy jest otwarty modal" oparto na realnym wspólnym wzorcu — modale w tej
aplikacji **nie ustawiają `role="dialog"`**, lecz dzielą `fixed inset-0 z-50+`.
Wspólny hook `useOverlayState` obserwuje `document.body` (`MutationObserver`) i po
selektorze klas wykrywa modale treściowe; nakładki, które modalami treściowymi nie
są (sam asystent, menu mobilne, `ActionDrawer`), oznaczono `data-omnia-overlay`
i wyklucza się je z detekcji — taniej niż znakowanie 30+ modali.

Ustalona, jawna hierarchia `z-index` pływaków i nakładek:
- magiczna ikona (spoczynek): **41** — nad przyciskiem admina (39), z 8 px odstępu;
- przycisk admina (spoczynek): **39** — pod magiczną, stos w prawym dolnym rogu;
- modal treściowy: **50–70** (bez zmian);
- przycisk admina (gdy modal otwarty): **10001** — nad modalem, w głównym miejscu;
- overlay asystenta: **9990**, `ActionDrawer`: **9991** — nad modalami (by asystent
  otwarty z trybu wskazywania był nad bazowym modalem; `ActionDrawer` „jeździ" na
  asystencie, więc podniesiony razem, inaczej zniknąłby pod nim).

**Zmienione pliki:**
- `src/hooks/useOverlayState.ts` — nowy; `MutationObserver` po wzorcu klas `fixed inset-0` zwraca `{ modalOpen, assistantOpen }`; nakładki wykluczane markerem `data-omnia-overlay`.
- `src/components/home/AICommandSheet.tsx` — magiczna ikona chowana przy otwartym modalu treściowym, `z-index 41`; overlay sheetu oznaczony `data-omnia-overlay="assistant"` i podniesiony do `z-index 9990`.
- `src/components/shell/FeedbackInspector.tsx` — admiński FAB: `z-index 39` i odstęp w spoczynku (magiczna może go lekko zasłonić, nie odwrotnie); chowany gdy otwarty asystent; przy otwartym modalu wskakuje w główne miejsce z `z-index 10001`.
- `src/components/home/ActionDrawer.tsx` — oznaczony `data-omnia-overlay="assistant"` (nie liczy się jako modal treściowy) i podniesiony do `z-index 9991`, by pozostał nad overlayem asystenta po jego podniesieniu.
- `src/components/shell/AppShell.tsx` — overlay menu mobilnego oznaczony `data-omnia-overlay="nav"` (wykluczony z detekcji modali).
- `prisma/migrations/0100_omnia_implementation_report_fab_ux/migration.sql` — ten raport.

## Podsumowanie
Jedno zgłoszenie o charakterze UX, domknięte minimalnie i bez równoległych ścieżek:
zamiast znakować dziesiątki modali, dodano jeden wspólny hook detekcji nakładek po
ich faktycznym wzorcu klas i wyjątki oznaczone `data-*`. Sednem była jawna
hierarchia `z-index` (główna akcja > pomocnicza, nigdy odwrotnie) oraz świadoma
decyzja produktowa: przy modalu chowamy magiczną ikonę, ale udostępniamy i wynosimy
nad modal przycisk admina, bo to jedyny moment, w którym wskazywanie elementów
modalu ma sens. Pułapka, którą trzeba było obejść: podnosząc overlay asystenta nad
modale, trzeba było podnieść razem `ActionDrawer` (modal-dziecko jeżdżące na
asystencie), inaczej zniknąłby pod rodzicem. Weryfikacja: `tsc --noEmit` oraz pełny
`next build` przechodzą; krok `migrate.js` z `npm run build` świadomie pominięto
lokalnie (pisze do produkcyjnej bazy). Raport zapisany migracją → pojawia się
w `/reports` po deployu.
$omnia_fab_ux$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
