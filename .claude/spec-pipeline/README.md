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

Wzorzec metodyczny to **GitHub Spec Kit** (`/specify → /plan → /tasks → /implement`), dostosowany do
Omnii: dokładamy własne bramki jakości **`/verify`** i **`/review`** (odpowiednik walidacji/analizy ze
Spec Kit), a „konstytucję" trzymamy jako stały plik projektu zamiast generować ją komendą. Etap
doprecyzowania wymagań (w Spec Kit osobny `/clarify`) **zwijamy do jednego momentu pytań** wewnątrz
`/specify` — patrz niżej.

## Jak to działa w praktyce — trzy zasady UX
1. **Jeden moment pytań (z wąską furtką).** Pipeline zbiera pytania na starcie (`/specify`) w
   **jednym** ekranie wyboru — rekomendowana odpowiedź jest zawsze **pierwsza** i oznaczona
   `(zalecane)`, więc wybór zajmuje sekundę. Dalsze etapy działają samodzielnie na twoich
   odpowiedziach i rozsądnych domyślnych. **Ale** jeśli później wypłynie decyzja naprawdę istotna,
   nie do przewidzenia na starcie i kosztowna przy złym wyborze — pipeline **dopyta** (znów jedno
   zbiorcze pytanie, rekomendowana pierwsza), zamiast zgadywać. Cel: wołać cię **jak najrzadziej**,
   ale **nigdy nie zgadywać** przy ważnej, niejednoznacznej decyzji (reguła `C-55`).
2. **Automatyczne przejścia + zawracanie.** Nie wpisujesz kolejnych komend. Po `/specify` pipeline
   **sam** przetacza się przez plan → zadania → implementację → weryfikację → recenzję, aż do merge do
   `develop`. Gdy `/verify` albo `/review` znajdzie brak — **sam zawraca do `/implement`** i poprawia.
3. **Artefakty zawsze spójne (`C-54`).** Gdy któryś etap odkryje, że wcześniejszy artefakt jest błędny
   (implementacja pokazuje, że plan się nie broni; plan wykrywa lukę w specu; twoja odpowiedź zmienia
   zakres) — pipeline **wraca i poprawia właściwy plik** (`spec.md`/`plan.md`/`tasks.md`), a potem
   przelicza to, co z niego wynika w dół. Nie zostaje rozjazd „kod robi X, ale spec mówi Y".

## Sześć etapów

| Etap | Komenda | Wejście | Artefakt | Sens |
|------|---------|---------|----------|------|
| 1. Specyfikacja | `/specify <pomysł>` | pomysł | `spec.md` | **CO i DLACZEGO** — problem, historyjki, kryteria akceptacji. Zero „jak". |
| 2. Plan | `/plan <slug>` | `spec.md` | `plan.md` | **JAK** — model danych, migracja, Server Actions, RBAC, UI, AI. Pod istniejący kod. |
| 3. Zadania | `/tasks <slug>` | `plan.md` | `tasks.md` | Uporządkowana lista kroków (łatwe→trudne, wg zależności) z wpiętymi bramkami. |
| 4. Implementacja | `/implement <slug>` | `tasks.md` | kod + commity | Wykonanie zadań po kolei, odhaczanie postępu, commit po każdym. |
| 5. Weryfikacja | `/verify <slug>` | kod | `verify.md` | Sprawdzenie **zachowania** względem kryteriów akceptacji + bramki (lint/build). |
| 6. Recenzja | `/review <slug>` | diff | `review.md` | Świeże oko: poprawność + konwencje Omnia. Werdykt przed merge do `develop`. |

Przepływ jest liniowy, ale **pętli się wstecz**: jeśli `/verify` znajdzie brak → pipeline sam wraca do
`/implement`; jeśli `/plan` wykryje lukę w specu → dopisuje ją do `spec.md` i jedzie z najlepszym
domyślnym. Wszystkie sześć etapów odpala się **jedną komendą** `/specify` — reszta dzieje się sama.

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
Sercem pipeline'u jest `.claude/spec-pipeline/constitution.md`: nienegocjowalne reguły `C-NN`
wyciągnięte z `CLAUDE.md` (migracje bez enumów i z ręcznym plikiem, Server Actions z `revalidatePath`,
model współwłasności `ownerId`/`ownerTeamId`, `AIAction` musi mieć egzekutor, motyw tylko przez zmienne
CSS, wariant mobilny, nigdy build/migrate przeciw prod DB, merge do `develop`). Reguły przebiegu
pipeline'u też tu są: **`C-54`** (spójność artefaktów i zawracanie) oraz **`C-55`** (jeden moment pytań
z wąską furtką). Każdy etap sprawdza zgodność — złamanie którejś to błąd blokujący, nie kwestia gustu.

## Jak używać — szybki start
1. W katalogu głównym repo (tam gdzie `.claude/`) odpal Claude Code.
2. Wpisz **jedną** komendę, np.:
   `/specify dodaj do modułu Portfel eksport wpisów do CSV`.
3. Jeśli coś wymaga decyzji — dostaniesz **jeden** ekran wyboru. Kliknij rekomendowaną opcję
   (oznaczoną `(zalecane)`) albo wybierz inną. To **jedyny** moment, w którym pipeline cię zaczepia.
4. Dalej **nic nie robisz** — pipeline sam: pisze `spec.md`, planuje (`plan.md`), rozbija na zadania
   (`tasks.md`), implementuje z commitami, weryfikuje (`verify.md`), recenzuje (`review.md`) i po
   APPROVE robi merge do `develop` (deploy na środowisko testowe).
5. Efekt oglądasz w `specs/001-portfel-csv-export/` (komplet artefaktów) i na `worldofmag.onrender.com`.

> Możesz też odpalić dowolny etap osobno (`/plan <slug>`, `/verify <slug>` …) — każdy i tak pociągnie
> resztę automatycznie. Zwykle jednak wystarczy samo `/specify`.

Najprościej odpalasz cały pipeline z modułu **Zadania**: przycisk „kopiuj prompt dla Claude Code"
kopiuje gotowy prompt (uruchamiający `/specify` z tytułami i opisami zaznaczonych zadań) — wklejasz go
w Claude Code i pipeline rusza.

## Dobre praktyki
- **Nie przeskakuj etapów.** Pipeline i tak przechodzi je po kolei — to plan łapie 80% problemów zanim
  powstaną. Mały feature = szybkie przejście, nie pominięcie.
- **Spec bez implementacji, plan bez lania wody.** Jak w specu pojawia się nazwa pliku — to znak, że
  to należy do planu.
- **Kryteria akceptacji muszą być testowalne** — inaczej `/verify` nie ma czego sprawdzić.
- **Jeden feature = jeden katalog `specs/NNN-*`.** Za duży pomysł → `/specify` sam zaproponuje podział.
- **Decyzje podejmujesz w jednym momencie** (ekran wyboru na starcie). Reszta jedzie na rekomendowanych
  domyślnych — jeśli chcesz coś ustawić inaczej, zrób to właśnie na tym ekranie.

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
