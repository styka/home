# Recenzja: 112 — Asystent, kompletny odczyt, domknięcie tury i uczciwy koszt

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (17/17) · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-28
- **Diff:** `6bc63a2..HEAD` — 22 pliki, +2073 / −96 (z czego ~1000 linii to artefakty pipeline'u i testy)

## Ustalenia

Recenzja świeżym okiem własnego diffu. Dwa ustalenia dotyczą **kodu wprowadzonego w tym przebiegu** —
oba naprawione tutaj, oba pokryte testem sprawdzonym **na czerwono** (mutacja kodu → test pada).

---

### U-1 · correctness · NAPRAWIONE — fałszywy alarm „pobierz kolejne" dla kompletnego wyniku
**Plik:** `src/platform/ai/agentContext.ts`, `ograniczDoBudzetu`

Ścieżka awaryjna budżetu znaków wołała `zRekordami` dla **każdego** narzędzia w iteracji, także
takiego, którego wynik był kompletny — a `zRekordami` bezwarunkowo dokłada znacznik `truncated`.

**Scenariusz awarii:** jedna iteracja woła `list_notes` (200 dużych notatek) i `list_projects`
(2 projekty). Blok przekracza budżet znaków → ścieżka awaryjna → `list_projects` dostaje
`truncated: "pokazano 2 z 2 rekordów. Aby pobrać KOLEJNE, powtórz to samo wywołanie z argumentem
offset: 2"`. Model wykonuje dodatkowy odczyt po dane, których nie ma, dostaje pustą listę i musi
sam wywnioskować, że komunikat kłamał.

**Dlaczego to poważne:** to **ta sama pętla, którą ten przebieg likwiduje**, tylko wywołana z drugiej
strony — i naruszenie AC-3 („zbiór mieszczący się nie dostaje fałszywego alarmu") w ścieżce, której
mój pierwotny test AC-3 nie obejmował.

**Poprawka:** znacznik dokładany wyłącznie przy `data.length > ile`. Test
„wynik KOMPLETNY nie dostaje znacznika, nawet gdy blok przekracza budżet znaków" — sprawdzony na
czerwono: po przywróceniu starego warunku pada.

---

### U-2 · correctness · NAPRAWIONE — `offset` jako tekst dawał cichą pętlę stronicowania
**Plik:** `src/lib/ai/readToolShared.ts`, `offsetOf`

Funkcja przyjmowała wyłącznie `number`; wszystko inne → `0`.

**Scenariusz awarii:** model buduje argumenty jako JSON i regularnie zapisuje liczby w cudzysłowie —
`{"offset": "40"}`. `offsetOf` zwraca **0**, narzędzie oddaje **tę samą pierwszą porcję**, a znacznik
znów mówi „pobierz kolejne od 40". Model posłusznie powtarza, dostaje to samo i kręci się aż do
limitu kroków.

**Dlaczego to poważne:** rezultat jest **nie do odróżnienia od pierwotnej usterki ze zgłoszenia**
(„kolejne próby nie wnosiły nic nowego"), a przy tym trudniejszy do zdiagnozowania — bo tym razem
argumenty w logu wyglądałyby poprawnie.

**Poprawka:** `offsetOf` akceptuje liczbę zapisaną jako tekst (z przycięciem białych znaków);
wartości nieliczbowe i ujemne dalej dają 0. Test pokrywa sześć wariantów wejścia.

---

### U-3 · observation · przyjęte świadomie, nie do naprawy — przebieg dwuwywołaniowy płaci więcej
**Plik:** `src/platform/ai/agentContext.ts`, `czyCachowacKatalog`

Tura `query` → `answer` (dwa wywołania, najczęstszy kształt tury nietrywialnej) płaci za katalog
**2,25× zamiast 2,00×** ceny wejścia, bo zapis do pamięci kosztuje 1,25×, a odczytać go zdąży raz.

Nie zgłaszam tego jako defektu, bo jest to **udokumentowany wybór z policzonym bilansem**: przebiegi
3+ (te drogie) zyskują od −22 % do −56 %, a pamięć dostawcy żyje ~5 minut i jest wspólna dla
kolejnych **tur** tej samej rozmowy, więc nadpłata wraca przy następnej turze. Tabela z rachunkiem
stoi w komentarzu funkcji — czyli tam, gdzie znajdzie ją następna osoba pytająca „czemu nie od
pierwszego wywołania". Alternatywa („znacz od trzeciego") jest gorsza dla **wszystkich** n ≥ 3.

---

### Sprawdzone i CZYSTE

| Obszar | Wynik |
|---|---|
| **Guardy dostępu (C-21/C-17)** | Nietknięte. `offset` wchodzi jako `skip` do **tego samego** `where`, więc zmienia okno, nie zakres — dowiedzione testem na obcym użytkowniku |
| **`AIAction` bez egzekutora (C-23)** | Brak. `check:actions` zielony; bramka złapała 5 nieopisanych parametrów i zostały dopisane |
| **Migracja ↔ `schema.prisma`** | Brak rozjazdu — migracja `0271` nie ma ani jednej instrukcji DDL (zweryfikowane `grep`) |
| **`revalidatePath` (C-20)** | Nie dotyczy — zero nowych Server Actions |
| **Enumy Prisma (C-12)** | Brak nowych kolumn, więc brak ryzyka |
| **Kolory / mobile / teksty (C-30…C-32)** | Zero zmian w UI; `check:i18n` zielony |
| **Bezpieczeństwo (C-41)** | Nowy log `ai.prompt.podzialOdrzucony` niesie wyłącznie **długości** bloków, nigdy treści promptu ani klucza. Raport w migracji nie zawiera sekretów |
| **Martwy kod / duplikacja (C-53)** | `poleProfilu` i `PET_PROFILE_FIELDS` istnieją właśnie po to, żeby `add_pet` i `update_pet` nie rozjechały się w dwóch kopiach. `ISO_DATE_RE` wyeksportowane zamiast skopiowane |
| **Zachowanie ścieżki odwrotu** | `limitReached: true` na nowym kroku `plan` jest spójne z `loopNeedsFallback`: przebieg **nieostateczny** nie woła modelu o dokończenie (oddaje tani komunikat), więc ponowienie na mocniejszym modelu nic nie marnuje |
| **Regresja w zwykłych odczytach** | Bez `includeDescription` wynik `list_tasks` jest identyczny jak przed 112 — pokryte testem |

### Świadomie NIE zgłaszam

- **Instrukcje w prompcie (AC-7, AC-10) nie mają testu automatycznego.** To treść dla modelu, nie
  gałąź kodu — testowalna wyłącznie obserwacją przebiegu. Odnotowane w `verify.md` jako zadanie dla
  właściciela, nie ukryte.
- **Pojedynczy nieodtworzony błąd testów** (1 przebieg na 6, bez nazw; 8 kolejnych przebiegów
  czystych, w tym 4 stresowe na samych nowych testach integracyjnych). Zostawiam jako fakt zapisany
  w `verify.md` zamiast ogłaszać „na pewno flake".

## Bramki po poprawkach recenzji

| Komenda | Wynik |
|---|---|
| `tsc --noEmit -p tsconfig.test.json` | ✅ |
| `npm run test:unit` | ✅ **1349/1349** (2 nowe testy regresyjne) |
| `next lint --dir src` | ✅ 0 błędów |
| `next build` | ✅ Compiled successfully |
| `check:perf` | ✅ w paśmie ±5 % |
| 12 bramek repo | ✅ (pełna tabela w `verify.md`) |

## Werdykt

**APPROVE Z UWAGAMI.**

Dwa realne defekty znalezione w recenzji własnego diffu — oba w kodzie wprowadzonym w tym przebiegu,
oba tej samej natury co pierwotne zgłoszenie (cicha pętla odczytu), oba naprawione i pokryte testami
sprawdzonymi na czerwono. Trzecie ustalenie to udokumentowany kompromis kosztowy, nie usterka.

Uwagi przechodzące dalej — **żadna nie blokuje merge**, obie to potwierdzenie pomiaru na żywym
modelu, którego sandbox wykonać nie mógł:

1. Powtórzyć na `develop` polecenie „przeczytaj obowiązki z projektu Raj i załóż psa" — sprawdzić,
   że tura kończy się **planem** z listą braków w ≤ 3 iteracjach (AC-5, AC-6, AC-7, AC-10).
2. Porównać sumę z `AiCall` z punktem odniesienia **1,36 zł** (AC-16; projekcja: ~0,48 zł).
