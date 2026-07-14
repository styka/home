# Spec-Driven Pipeline — przewodnik (Omnia)

> **Po co to jest.** Kolejne modyfikacje Omnii mają powstawać **profesjonalnie i powtarzalnie** —
> nie „wrzućmy kod i zobaczmy", tylko: najpierw ustal *co i po co*, potem *jak*, potem rozbij na
> kroki, dopiero wtedy pisz, a na końcu **zweryfikuj i zrecenzuj**. Ten pipeline zamienia luźny
> pomysł w gotową, sprawdzoną zmianę, trzymając się twardych reguł projektu (`constitution.md`).

## Na czym to polega (Spec-Driven Development)
Zamiast zaczynać od kodu, zaczynamy od **specyfikacji**. Każdy etap produkuje **artefakt** (plik
Markdown w `specs/<NNN-slug>/`), który jest wejściem dla następnego. Dzięki temu:
- decyzje *co* są oddzielone od decyzji *jak* (mniej przypadkowych wyborów w locie),
- każda zmiana ma ślad: spec → plan → zadania → weryfikacja → recenzja,
- reguły projektu (migracje, RBAC, motyw, AI) są egzekwowane jako **bramki**, nie zależą od pamięci.

## Sześć etapów

| Etap | Komenda | Wejście | Artefakt | Sens |
|------|---------|---------|----------|------|
| 1. Specyfikacja | `/specify <pomysł>` | pomysł | `spec.md` | **CO i DLACZEGO** — problem, historyjki, kryteria akceptacji. Zero „jak". |
| 2. Plan | `/plan <slug>` | `spec.md` | `plan.md` | **JAK** — model danych, migracja, Server Actions, RBAC, UI, AI. Pod istniejący kod. |
| 3. Zadania | `/tasks <slug>` | `plan.md` | `tasks.md` | Uporządkowana lista kroków (łatwe→trudne, wg zależności) z wpiętymi bramkami. |
| 4. Implementacja | `/implement <slug>` | `tasks.md` | kod + commity | Wykonanie zadań po kolei, odhaczanie postępu, commit po każdym. |
| 5. Weryfikacja | `/verify <slug>` | kod | `verify.md` | Sprawdzenie **zachowania** względem kryteriów akceptacji + bramki (lint/build). |
| 6. Recenzja | `/review <slug>` | diff | `review.md` | Świeże oko: poprawność + konwencje Omnia. Werdykt przed merge do `develop`. |

Przepływ jest liniowy, ale **pętli się wstecz**: jeśli `/verify` znajdzie brak → wracasz do
`/implement`; jeśli `/plan` wykryje lukę w specu → uzupełniasz `spec.md`.

## Artefakty — układ katalogów
```
specs/
└── 001-nazwa-feature/
    ├── spec.md      # etap 1 — co i po co (kryteria akceptacji)
    ├── plan.md      # etap 2 — jak (architektura, migracja, pliki)
    ├── tasks.md     # etap 3 — lista zadań T-1, T-2, … (żywy stan)
    ├── verify.md    # etap 5 — raport weryfikacji (AC → werdykt + dowód)
    └── review.md    # etap 6 — ustalenia recenzji + werdykt
```
Numer `NNN` jest sekwencyjny (001, 002…). To repozytorium wiedzy o tym, **dlaczego** dana zmiana
wygląda jak wygląda — zostaje w repo na stałe.

## Agenty (subagenty Claude Code)
Trzy wyspecjalizowane osobowości, których pipeline może użyć do cięższej, izolowanej pracy:
- **`omnia-planner`** — architekt; projektuje plan osadzony w konwencjach (używany przy `/plan`).
- **`omnia-implementer`** — wykonawca; pisze kod w stylu sąsiedniego modułu (przy `/implement`).
- **`omnia-reviewer`** — recenzent read-only; poluje na realne błędy i naruszenia konwencji (przy `/review`).

Można je wywołać wprost („użyj agenta omnia-reviewer do…") albo pozwolić, by komenda sama zleciła im
zadanie przy złożonym, wielomodułowym feature.

## Konstytucja — twarde reguły
Sercem pipeline'u jest `.claude/spec-pipeline/constitution.md`: ~30 nienegocjowalnych reguł `C-NN`
wyciągniętych z `CLAUDE.md` (migracje bez enumów i z ręcznym plikiem, Server Actions z
`revalidatePath`, model współwłasności `ownerId`/`ownerTeamId`, `AIAction` musi mieć egzekutor, motyw
tylko przez zmienne CSS, wariant mobilny, nigdy build/migrate przeciw prod DB, merge do `develop`).
Każdy etap sprawdza zgodność z tymi regułami — złamanie którejś to błąd blokujący, nie kwestia gustu.

## Jak używać — szybki start
1. W katalogu głównym repo (tam gdzie `.claude/`) odpal Claude Code.
2. `/specify dodaj do modułu Portfel eksport wpisów do CSV` → powstaje `specs/001-portfel-csv-export/spec.md`.
   Przejrzyj spec, odpowiedz na ewentualne pytania w sekcji „decyzje właściciela".
3. `/plan 001-portfel-csv-export` → `plan.md`. Sprawdź decyzje techniczne (migracja? akcje? pliki?).
4. `/tasks 001-portfel-csv-export` → `tasks.md`. Widzisz kroki i ścieżkę krytyczną.
5. `/implement 001-portfel-csv-export` → kod powstaje zadanie po zadaniu, z commitami.
6. `/verify 001-portfel-csv-export` → raport: bramki + kryteria akceptacji. Jak coś nie gra → wróć do `/implement`.
7. `/review 001-portfel-csv-export` → recenzja + werdykt. APPROVE → commit → merge do `develop` → deploy testowy.

## Dobre praktyki
- **Nie przeskakuj etapów.** Kuszące jest pisać od razu kod — ale to plan łapie 80% problemów zanim
  powstaną. Mały feature = szybkie przejście, nie pominięcie.
- **Spec bez implementacji, plan bez lania wody.** Jak w specu pojawia się nazwa pliku — to znak, że
  to należy do planu.
- **Kryteria akceptacji muszą być testowalne** — inaczej `/verify` nie ma czego sprawdzić.
- **Jeden feature = jeden katalog `specs/NNN-*`.** Za duży pomysł → podziel na kilka.
- **Zatrzymaj się i zapytaj** przy niejednoznacznościach zamiast zgadywać — pipeline ma na to miejsce
  (sekcja „decyzje właściciela" w specu, pytania w planie).

## Pliki pipeline'u
```
.claude/
├── commands/          # /specify /plan /tasks /implement /verify /review
├── agents/            # omnia-planner, omnia-implementer, omnia-reviewer
└── spec-pipeline/
    ├── constitution.md   # twarde reguły C-NN (źródło prawdy dla bramek)
    ├── README.md         # ten przewodnik (renderowany też w /admin/spec-pipeline)
    └── templates/        # szablony spec.md / plan.md / tasks.md
```
