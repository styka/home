---
description: Etap 1 SDD — zamień pomysł w specyfikację i uruchom automatycznie cały pipeline (specs/NNN-slug/spec.md)
argument-hint: <opis funkcji/pomysłu>
---

Jesteś na **etapie 1 (SPECIFY)** spec-driven pipeline'u Omnia i jesteś **dyrygentem całego przebiegu**.
Twoim zadaniem jest zamienić poniższy pomysł w **specyfikację produktową** (CO i DLACZEGO, nigdy JAK),
a potem **poprowadzić pipeline automatycznie do końca** — bez czekania, aż użytkownik wpisze kolejne komendy.

## Model interakcji (WAŻNE — przeczytaj najpierw)
Ten pipeline działa **autonomicznie**. Właściciel (Szymon) chce rozmawiać z tobą **tylko w jednym
momencie** — tutaj, na starcie. Dlatego:
1. **Wszystkie pytania do właściciela zadajesz TERAZ, w jednym wywołaniu `AskUserQuestion`.** Później
   (plan, tasks, implement, verify, review) **nie zadajesz już żadnych pytań** — jedziesz na
   zebranych decyzjach i rekomendowanych domyślnych.
2. **Rekomendowaną odpowiedź zawsze umieszczasz jako pierwszą opcję** i dopisujesz do jej etykiety
   `(zalecane)`. Szymon najczęściej wybiera rekomendowaną — ułatw mu to.
3. Po zebraniu odpowiedzi (albo gdy pytań nie ma) **sam przechodzisz przez wszystkie kolejne etapy**
   pipeline'u, jeden po drugim, aż do merge do `develop`.

## Wejście
Pomysł / opis funkcji (lub lista zadań): **$ARGUMENTS**

## Zanim napiszesz spec
1. Przeczytaj reguły projektu: @CLAUDE.md oraz @.claude/spec-pipeline/constitution.md.
2. Wczytaj szablon: @.claude/spec-pipeline/templates/spec-template.md — to jest struktura wyjścia.
3. Rozejrzyj się po kodzie **tylko na tyle, by dobrze nazwać moduł i granice** (np. `src/lib/modules.tsx`,
   sąsiedni moduł). Nie projektuj implementacji.

## Krok A — jedyny moment pytań do właściciela
Zanim zapiszesz spec, **pomyśl o CAŁYM pipeline** (spec → plan → tasks → implement) i wyłap wszystkie
istotne decyzje, które inaczej blokowałyby cię później: zakres/granice funkcji, wybór wariantu UX,
własność danych (user vs user+team), czy wpinać AI/kalendarz/powiadomienia, sposób realizacji przy
kilku sensownych drogach.

- Jeśli są takie decyzje → **jedno** wywołanie `AskUserQuestion` (narzędzie pozwala na 1–4 pytania na
  raz). Reguły:
  - Dla każdego pytania **pierwsza opcja = rekomendowana**, etykieta zakończona ` (zalecane)`, a jej
    `description` krótko uzasadnia, czemu to najlepszy domyślny wybór dla Omnii.
  - Jeśli decyzji jest więcej niż 4 — wybierz najważniejsze; resztę rozstrzygnij samodzielnie
    rekomendowanym domyślnym i **odnotuj** te założenia w sekcji „decyzje właściciela" speca.
- Jeśli pomysł jest jednoznaczny i nic realnie nie wymaga decyzji → **nie pytaj**, przyjmij rozsądne
  domyślne i jedź dalej.

Nie rozbijaj pytań na kilka tur i nie wracaj z pytaniami na późniejszych etapach — to jedyny moment.

## Krok B — napisz spec
Utwórz `specs/NNN-slug/spec.md` ściśle wg szablonu:
1. **Ustal numer i slug.** Zajrzyj do `specs/` i weź kolejny wolny numer `NNN` (001, 002, …). Slug =
   krótki kebab-case (ASCII, bez diakrytyków). Utwórz katalog `specs/NNN-slug/`.
2. Wypełnij **wszystkie** sekcje, wplatając w nie odpowiedzi z Kroku A:
   - Problem/potrzeba, cel + miary sukcesu, historyjki użytkownika.
   - **Kryteria akceptacji** w formacie Given/When/Then — muszą być testowalne (użyje ich `/verify`).
   - Zakres i świadome „poza zakresem".
   - **Wpływ na Omnia**: uprawnienie/RBAC, własność danych, AI, kalendarz, powiadomienia, trash.
   - **Zgodność z konstytucją**: wypisz kluczowe reguły `C-NN`.
   - **Decyzje właściciela** — zapisz odpowiedzi z Kroku A oraz założenia przyjęte domyślnie.
3. **Zero implementacji.** Żadnych nazw plików, tabel, endpointów, bibliotek — to należy do `plan.md`.
4. Jeśli `$ARGUMENTS` to lista wielu niezależnych zadań, które nie tworzą jednej funkcji — potraktuj je
   jako **jeden feature parasolowy** (spójny zakres) albo, jeśli są zupełnie rozłączne, zrób spec dla
   pierwszego spójnego zestawu, a resztę wypisz w „poza zakresem"; nie gub żadnego zadania.

## Krok C — automatyczne przejście dalej
Po zapisaniu `spec.md`:
1. Wypisz krótko: ścieżkę `spec.md`, 2–3 zdania streszczenia, przyjęte decyzje/założenia.
2. **Nie czekaj na użytkownika.** Od razu przejdź do etapu 2, wywołując skill **`plan`** (narzędzie
   Skill) z argumentem `specs/NNN-slug`. Pipeline ma się przetoczyć samoczynnie: plan → tasks →
   implement → verify → review, bez kolejnych komend od właściciela.
