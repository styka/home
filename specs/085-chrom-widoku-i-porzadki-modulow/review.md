# 085 — Recenzja

> Etap 6. Świeże spojrzenie na diff (66 plików, +2340/−883) przed scaleniem do `develop`.
> Recenzję przeprowadziłem sam, czytając diff wobec `origin/develop` — nie zlecałem jej subagentowi,
> bo sesja ma jawne polecenie właściciela, żeby nie uruchamiać agentów bez jego prośby.

## Ustalenia

### 1. Pusty pasek widoku zostawiał 28 px martwej przestrzeni — **naprawione**
`src/components/ui/view/ModuleView.tsx` · **correctness**

Po rozdzieleniu bloku nagłówka od paska (T-23) opakowanie paska renderowało się **zawsze**, także
wtedy, gdy `ViewBar` zwracał `null` — a zwraca, gdy widok nie ma ani filtrów, ani akcji. Zostawał po
nim pasek o wysokości `12px + var(--view-padding)` z pustym wnętrzem.

**Scenariusz awarii:** wejście na `/services` (albo dowolny z co najmniej dziesięciu widoków bez
filtrów i akcji: Usługi ×6, Warsztaty ×2, Zakupy, Kuchnia) → pod nagłówkiem dziura, którą łatwo
wziąć za odstęp projektowy, a treść zaczyna się niżej niż powinna.

**Pomiar (obie strony):** ze stanem sprzed poprawki `/services` ma **1 pusty element o wysokości
28 px**; po poprawce — **0**. Warunek renderowania opakowania jest teraz DOKŁADNIE tym samym
warunkiem, co w `ViewBar` (`compact || filters || actions`), więc nie da się ich rozjechać. Przy
braku paska zmienna `--view-bar-h` dostaje `0px`, a nie „poprzednią" wartość.

### 2. Wybór układu pokazywał się przy jednym obserwatorze — **naprawione**
`src/modules/weather/ui/WatchersPanel.tsx` · **convention (regresja wobec 082)**

Scalając pasek (T-11) przeniosłem przyciski układu z bloku, który miał warunek `watchers.length > 1`,
do bloku bez tego warunku. Trzy przyciski sortowania przy jednym obserwatorze nie zmieniają niczego.
Warunek przywrócony **tylko dla przycisków układu** — `AiContentMeta` musi się pokazywać zawsze, bo
to on niesie „wygenerowano / nieaktualne".

### 3. Świadome różnice, które NIE są usterkami (zweryfikowane, zostawione)

- **Pasek stanu treści AI nie renderuje się podczas PIERWSZEGO ładowania oceny** (wcześniej stał poza
  gałęzią ładowania). To poprawa, nie regresja: przed pierwszą oceną nie ma czego opisywać, a
  `busy={loading}` działa przy każdym kolejnym przeliczeniu.
- **`STATUS_ORDER` zostaje wyeksportowane bez konsumenta poza `lib/uklad.ts`.** Używają go
  `poStanie` i `wSekcje` wewnątrz pliku; to stała domeny, nie API komponentu współdzielonego —
  reguła z 084 („martwe API w miejscu wspólnym") tu nie zachodzi.
- **`--view-bar-h` czyta tylko moduł Wiadomości.** Jedyny moduł z własnym przyklejonym paskiem;
  zmienna publikowana jest przez ramę dla wszystkich, bo to rama zna swoją wysokość.

## Czego recenzja NIE zmieniła

- **Podwójny `<h1>` na `/kitchen`** (`KitchenLayout.tsx:29`) — dług zastany, plik nietknięty od 061,
  poza zakresem tego przebiegu (C-53). Zgłoszony w `verify.md`.
- **Wyścig o ulubione wspólnego konta** — znany od 084, wymaga zmiany infrastruktury testów.
- **Trzy kryteria Pogody** — testy gotowe, pomijają się bez dostępu do Open-Meteo.

## Zgodność z konstytucją

Bez naruszeń. C-01/C-36 ✅ (`check:boundaries` zielone po przeniesieniu kontekstu do
`platform/admin`), C-10..C-13 ✅ (jedna migracja, numer z narzędzia, wyłącznie lokalna baza),
C-12 ✅ (`Boolean` na fakt dwustanowy, zero enumów), C-20/C-21 ✅, C-23 ✅, C-30..C-33 ✅,
C-51 ✅, C-53 ✅, **C-54 ✅** — konstytucja i `CLAUDE.md` zaktualizowane, bo opisywały
`ViewChromeProvider`, którego ta zmiana nie zostawia.

## Werdykt

**APPROVE Z UWAGAMI.**

Dwa ustalenia znalezione i naprawione w recenzji (jedno z pomiarem w obie strony), trzy ograniczenia
zaraportowane wprost i niezamiecione. Komplet bramek zielony, pełna suita klikacza bez czerwonych.
