# Weryfikacja: 122-ux-skorki-zadania-filtr

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-09-02

## Bramki

| Komenda | Wynik |
|---------|-------|
| pełny `npm run build` (lokalny Postgres, C-13) | ✅ EXIT=0 — obejmuje `check:migrations`, `check:actions`, `check:i18n` (zero literałów), `check:ui-contract` (26/26), `check:boundaries`, `check:pagination`, `check:owner-columns` i resztę łańcucha |
| `tsc --noEmit -p tsconfig.test.json` | ✅ czysto |
| `next lint --dir src` | ✅ 0 ostrzeżeń |
| `next build` + `check:perf-budget` | ✅ w pasmie ±5% (najcięższa trasa 1181 kB, suma 74420 kB) |
| e2e (`scripts/e2e-web.sh`, pełna suita, zbudowana aplikacja) | ⚠️ **261 passed, 23 failed, 213 skipped (6.3 min)** — wszystkie porażki to stan zastany bazy, patrz niżej |

### Wynik e2e — dowód „stan zastany, nie regresja"

Porównanie z przebiegiem 116 (verify 116: **262 passed / 22 failed** na ówczesnym develop —
te same obszary: Wiadomości ×8, chrom konta, ulubione, skróty, potwierdzenia, `f0-registry`
z nieaktualnym licznikiem modułów). W tym przebiegu dodatkowo padał `tasks-ux [105-AC5]`
(pole dodawania zadania) — jedyny test z obszaru dotkniętego diffem, więc zweryfikowany
**rozstrzygająco**: uruchomiony na czystym worktree `origin/develop` (bez commitów 121)
pada **identycznie** (`1 failed, 3 passed`). Testy zestawów (`zadania-zestawy.spec.ts` —
080-AC4/AC6, dokładnie obszar tej zmiany) **przechodzą** na branchu 121.
Aktualizacja oczekiwań klikaczy po 111–120 pozostaje osobną robotą (odnotowana już w 116, C-53).

## Kryteria akceptacji

| AC | Werdykt | Dowód |
|----|---------|-------|
| AC-1 (formularz skórki widoczny jako dialog) | ✅ | `SkinPicker.tsx`: `editor.open && <Modal … wide>` z `SkinEditor` w środku; `Modal` = Radix Dialog (Esc, focus-trap, klik w tło, na telefonie arkusz dolny ze stopką nad `safe-area` — 087). Sekcja inline nie istnieje (usunięta) |
| AC-2 (zapis/anuluj zamyka, lista odzwierciedla, nowa skórka aktywna) | ✅ | `SkinEditor` po zapisie woła `onSaved` → `choose(id)` (aktywacja jak dotąd) i sam `onClose()`; anuluj → `onClose` → `setEditor({open:false})` |
| AC-3 (Edytuj / Duplikuj i edytuj → ten sam dialog) | ✅ | `duplicate()` i `setEditor({mode edit})` nietknięte — zmienił się wyłącznie nośnik renderu |
| AC-4 (bez wiersza „Szczegóły zadania"; akcje w wierszu tytułu; Esc działa) | ✅ | `TaskDetail.tsx`: blok nagłówka `h-12` usunięty; spinner + rozwiń/zwiń (`aria-pressed`, `hidden md:flex`) + usuń + zamknij w `sekcjaTytul` (input `min-w-0 flex-1`, akcje `flex-shrink-0`); Esc żyje w `TasksPage` `onEscape` (warstwowo: pełny tryb → panel) — nietknięty |
| AC-5 (mobilne „Wróć" widoczne; cele dotyku ≥ 44 px) | ✅ | „Wróć" pierwszym elementem wiersza (`md:hidden`, `py-3` → 44 px z treścią); usuń `p-3 md:p-1.5` (44 px na telefonie); X tylko desktop (na telefonie wyjściem jest „Wróć" — jedno wyjście zamiast dwóch duplikatów) |
| AC-6 (widok zestawu: bez chips, dropdown pokazuje/edytuje/zapisuje zakres) | ✅ | `TasksPage.tsx`: blok chips + ołówek `?edit=1` usunięte; `viewMode==="multi" && zestaw` renderuje `ProjectScopeFilter zestaw={…}`; tryb zestawu: roboczy stan, „Zapisz zmiany" (`updateProjectGroup`, aktywny tylko przy zmianie i niepustym wyborze), „Jako nowy" (`createProjectGroup` + `router.push`), kotwica z licznikiem „N z M" (lekcja 100) |
| AC-7 (sidebar: linki; rename/usunięcie w jednym mechanizmie) | ✅ | `TasksSideNav.tsx`: edytor grup, `?edit=1`, ołówek/kosz usunięte; grupy = czyste linki `/tasks/zestaw/<id>`; nazwa/emoji/kolor + „Usuń zestaw" (`confirmDialog({destructive:true})` — C-34) w dropdownie widoku zestawu |
| AC-8 (istniejące zestawy działają bez migracji) | ✅ | Zero migracji (302 bez zmian); model `ProjectGroup` i trasa `/tasks/zestaw/[zestawId]` nietknięte; e2e `zadania-zestawy` (stare adresy `/tasks/multi?group=` włącznie) **zielone** |
| AC-9 (filtr ad hoc bez regresu; pusty wybór = wszystkie) | ✅ | Ścieżka bez propa `zestaw` bajt-w-bajt jak dotąd (`selected`/`onChange`, czyszczenie wyboru, zapis nowego zestawu); w trybie zestawu „Zapisz zmiany" zablokowany przy pustym wyborze (zakres nie degraduje do zera — reguła 080) |
| AC-10 (build zielony) | ✅ | Pełny `npm run build` EXIT=0 (tabela wyżej) |

## Zgodność z konstytucją

- **C-01/C-02/C-36** — zmiany tylko w `worldofmag/`; wnętrze modułu Tasks importowane względnie; ✅ `check:boundaries` w buildzie.
- **C-10..C-14** — brak zmian schematu, brak migracji (potwierdzone: 302 migracje, „No pending").
- **C-20/C-21** — bez nowych akcji; istniejące akcje grup już rewalidowały `/tasks` i filtrują po `filtrMoichRekordow` + dostępności projektów.
- **C-30** — wyłącznie tokeny motywu (`var(--accent-*)`, `var(--on-accent)`); zero nowych hexów.
- **C-31** — modal = arkusz dolny z safe-area (prymityw `Modal`); cele dotyku ≥ 44 px na telefonie; Esc bez zmian.
- **C-32** — 13 nowych kluczy w `messages/pl.json`; `check:i18n` zielony (dwie usunięte linie w diffie pl.json to wyłącznie przecinki przy dopisanych kluczach — nic nie zginęło).
- **C-33** — rama `ModuleView` nietknięta.
- **C-34** — „Usuń zestaw" przez `confirmDialog({…, destructive: true})`.
- **C-35/C-53** — zero nowych wspólnych komponentów; netto **ubywa** UI (pasek chips, edytor w sidebarze, wiersz nagłówka, `?edit=1`).

## Regresje

- Konsumenci usuniętych propsów sprawdzeni greppem: `scopeProjects`/`multiGroupId` nie mają już
  żadnego użycia poza lokalnym scalaniem konfiguracji statusów w `TasksRouteView` (zostawione).
- Klucz `szczegolyZadania` zostaje w `pl.json` (używa go `TasksGuide`); klucze osierocone
  (`edytujGrupeNazwaProjekty`, `nowaGrupaProjektow`, …) nieszkodliwe — bramka pilnuje kierunku
  `t()` → klucz, nie odwrotnie.
- e2e obszaru zmiany (zestawy, potwierdzenia w zadaniach, tryb pełny panelu) — zielone;
  23 porażki suity = stan zastany develop (dowód wyżej).

## Runda 2 — weryfikacja poprawek z recenzji (T-10..T-12)

| Sprawdzenie | Wynik |
|-------------|-------|
| Pełny `npm run build` (lokalny Postgres) | ✅ EXIT=0; budżet wydajnościowy w pasmie (suma 74734 kB) |
| `tsc` + `check:i18n` + `next lint` | ✅ czysto / zero literałów / 0 ostrzeżeń |
| e2e obszaru zmiany (`zadania-zestawy.spec.ts`) | ✅ 6/6 passed |
| T-10 (sygnał dla sidebara) | ✅ `ogloszZmianeZestawow()` po **wszystkich czterech** mutacjach (zapis ad hoc, zapisz zmiany, zapisz jako nowy, usuń); nasłuch w `TasksSideNav` z poprawnym sprzątaniem (`removeEventListener` w cleanupie efektu) |
| T-11 (stan po zapisie) | ✅ `zapiszZmiany` przyjmuje rekord zwrócony przez `updateProjectGroup` (znormalizowany serwerowo) — `zmieniony` gaśnie po udanym zapisie |
| T-12 (widoczne błędy) | ✅ `blad` ustawiany w trzech `catch`, czyszczony przy edycji pól/zaznaczeń i po sukcesie; render z `role="alert"`, kolor `var(--accent-red)`; `aria-label` kotwicy w trybie zestawu = „Zakres i ustawienia zestawu" |

## Werdykt końcowy

**GOTOWE Z UWAGAMI** (po rundzie 2 — ustalenia 1-3 recenzji naprawione i zweryfikowane)
1. Suita e2e ma zastany dług oczekiwań po 111–120 (23 czerwone testy, w tym `[105-AC5]` padający
   identycznie na czystym develop) — poza zakresem 121 (C-53), odnotowane już przy 116.
2. Wygląd dialogu skórki i scalonego wiersza tytułu do obejrzenia na `develop` po deploy'u
   (weryfikacja wizualna „na oko" niewykonalna w sandboksie; struktura potwierdzona snapshotem
   drzewa dostępności w testach i przeglądem kodu).
