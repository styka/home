-- Korekta: poprzedni raport (0095) opisywał błędnie zrozumiane zadanie
-- („data w nagłówku asystenta"). Usuwamy go i seedujemy właściwy raport —
-- czytelna prezentacja parametrów-dat w podglądzie akcji (ActionDrawer).
-- Migracje są append-only (nie usuwamy zastosowanych plików), więc korektę
-- robimy nową migracją: DELETE błędnego wiersza + INSERT właściwego.

DELETE FROM "Report" WHERE "slug" = 'omnia-implementacja-2026-06-06-data-asystent';

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-06-06',
  'omnia-implementacja-2026-06-06-daty-akcji',
  $omnia_action_dates$# Omnia — Raport implementacji 2026-06-06

Sesja realizuje jedno zgłoszenie: **prezentacja daty w Magicznej ikonie**. Pierwotnie
intencję zrozumiano błędnie (pokazanie bieżącej daty w nagłówku asystenta) — po
doprecyzowaniu przez właściciela tamtą zmianę **wycofano** (revert), a zrealizowano
właściwy cel opisany niżej.

---

## Prezentacja daty w podglądzie akcji (Magiczna ikona)

**Diagnoza:** Gdy przez magiczną ikonę (asystent AI) poprosi się o wykonanie akcji,
przed wykonaniem pojawia się **podgląd wykrytych akcji** (`ActionDrawer`) z możliwością
rozwinięcia i podejrzenia/edycji parametrów każdej akcji. Parametry były renderowane
jednolicie jako tekst — wartością wprost ze stanu (`String(v)`), czyli dla **dat** był to
**surowy string ISO przesyłany w JSON-ie** (np. `2026-06-08T00:00:00.000Z`). To format
maszynowy, nieczytelny dla użytkownika i niewygodny do edycji — a nie format, w jakim
użytkownik spodziewa się widzieć datę.

**Rozwiązanie:** W edytorze parametrów `ActionDrawer` wartości będące datami są teraz
**wykrywane** i prezentowane **natywnym pickerem** zamiast surowym tekstem:
- **Wykrywanie po wartości** (a nie po nazwie klucza) — regex na format ISO + walidacja
  `new Date(...)`. Dzięki temu działa niezależnie od tego, jak agent nazwie pole
  (`dueDate`, `date`, `scheduledAt`, `expiresAt`, `startDate`…), bez utrzymywania listy
  nazw.
- **Picker dobrany do treści:** wartość z czasem (innym niż północ) → `datetime-local`;
  sama data lub północ (`…T00:00:00Z`, typowe dla terminów dziennych) → `date`. Natywny
  input renderuje datę w **lokalnym formacie (pl)** i daje kalendarzyk do edycji.
- **Etykieta pomocnicza** obok pickera w pełnym, czytelnym formacie polskim
  („8 czerwca 2026", z godziną gdy istotna) — `toLocaleDateString("pl-PL", …)`.
- **Bez przesunięcia strefy:** dla daty bez czasu `Date` budowany jest z komponentów
  lokalnie (`new Date(y, m-1, d)`), więc dzień się nie „przesuwa".
- **Spójny zapis do executora:** picker oddaje `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` —
  wartości, które backend i tak parsuje przez `new Date(String(params.x))`, więc ścieżka
  wykonania pozostaje bez zmian. Pozostałe (nie-datowe) parametry działają jak dotąd.

**Zmienione pliki:**
- `src/components/home/ActionDrawer.tsx` — helpery `isDateValue`/`hasTime`/`toInputValue`/
  `formatDateLabel` (wykrywanie i formatowanie dat) oraz warunkowy render parametru:
  natywny `date`/`datetime-local` + czytelna etykieta dla dat, zwykły input dla reszty.

---

## Podsumowanie

Zrealizowano **1 zgłoszenie** — czytelna prezentacja parametrów-dat w podglądzie akcji
asystenta AS (`ActionDrawer`). Główny obszar: warstwa prezentacji magicznej ikony. Daty,
dotąd pokazywane jako surowy string ISO z JSON-a, są teraz wyświetlane natywnym pickerem
w formacie lokalnym (pl) wraz z czytelną etykietą, przy zachowaniu poprawnej, edytowalnej
wartości przekazywanej do executora. Po stronie procesu: pierwotnie błędnie zrozumiane
zadanie (data w nagłówku) zostało wycofane (revert), a niniejszy raport zastępuje raport
0095. Bez zmian schematu DB i bez nowych zależności; `next build` przechodzi. Zmiany
scalono do `develop` (auto-deploy środowiska testowego).
$omnia_action_dates$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
