# Recenzja: Dolny pasek — inteligentne ikony, gwiazdka, historia, drzewiasty wachlarz

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-26
- **Zakres diffa:** `a2b3e3e..HEAD` — 56 plików, +2955 / −189 (w tym 5 plików artefaktów pipeline'u
  i 3 pliki testów).

## Metoda

Recenzja czytana pod kątem czterech rzeczy, w tej kolejności: poprawność (warunki brzegowe, wyścigi,
guardy), konwencje Omnii, uproszczenia/reuse, bezpieczeństwo. Pominięto to, co `verify.md` już
udowodniło pomiarem — recenzja szuka tego, czego testy z natury nie widzą.

## Ustalenia

### Naprawione w trakcie recenzji (drobne, bezpieczne)

**R-1 · `src/components/shell/useHistoriaNawigacji.ts` · correctness**
Zapis do `sessionStorage` siedział **wewnątrz funkcji aktualizującej stan** (`setHistoria(prev =>
{ …; zapisz(nowa); return nowa; })`). React wolno wywołać updater dwa razy dla jednej zmiany (robi
to tryb ścisły w środowisku deweloperskim, właśnie po to, żeby wykrywać efekty uboczne). *Skutek:*
tutaj podwójny zapis był nieszkodliwy — zapisywał tę samą wartość — ale wzorzec „efekt uboczny
w updaterze" wraca później w miejscu, w którym już szkodzi. *Poprawka:* zapis przeniesiony do
osobnego efektu obserwującego `historia`; updater jest czysty.

**R-2 · `src/lib/modules.tsx` · simplification**
`MAX_TAB_BAR` po wprowadzeniu kotwic nie miał już ani jednego wywołania (został jako wartość
domyślna nieosiągalnego parametru). *Skutek:* stała bez konsumenta w pliku wspólnym ogłasza limit,
którego nikt nie egzekwuje — następna osoba przyjmie ją za obowiązującą i doda szóstą ikonę do
paska, który mieści pięć. *Poprawka:* stała usunięta, `resolveTabBar` przyjmuje `limit` jako
parametr **wymagany** (C-35 czytane w drugą stronę).

**R-3 · `src/components/shell/PasekKciuka.tsx` · convention**
Dwa sąsiadujące bloki komentarza opisywały ten sam fragment. *Poprawka:* scalone w jeden.

### Rozważone i ODRZUCONE jako fałszywe alarmy

**`useSearchParams` bez granicy Suspense.** `useAkcjaZAdresu` woła `useSearchParams` w pięciu
widokach modułów, co w Next 14 wymagałoby granicy Suspense **na trasach prerenderowanych
statycznie**. Sprawdzone, nie założone: wszystkie pięć tras (`/tasks`, `/contacts`, `/habits`,
`/shopping`, `/notes/all`) ma `export const dynamic = "force-dynamic"` i w wyniku builda figuruje
jako `ƒ` (renderowane na żądanie). Build nie zgłasza ani jednego ostrzeżenia o deoptymalizacji.
Hook **nie jest** wołany w powłoce — tam bieżący adres czytany jest z `window.location` w efekcie,
zgodnie z lekcją z 042.

**Gwiazdka nadpisująca stan serwera.** `useUlubioneBiezacego` trzyma stan optymistyczny w `wstepny`.
Sprawdzone, że `wstepny` jest czyszczony efektem na zmianę `zapisanyServer`/`adres`, więc po
`router.refresh()` nie zostaje drugie, nieaktualizowane źródło prawdy o tym samym fakcie.

**Wachlarz gubiący gest przy re-renderze.** Trzy pułapki z run 100 (komponent pozycji na poziomie
modułu, przechwycenie wskaźnika dopiero przy otwarciu, zjadanie kliknięcia po wyborze) są w kodzie
nietknięte; `PozycjaProsta` została dodana **na poziomie modułu**, nie w ciele `PasekKciuka`.

## Zgodność z konwencjami

| Reguła | Ocena |
|---|---|
| C-01 praca w `worldofmag/` | ✅ — jeden plik powstał chwilowo w legacy `src/`, przeniesiony **przed** commitem, w którym się pojawił |
| C-10..C-14 migracje | ✅ — brak zmian schematu; potwierdzone `check:migrations` + `check:schema-drift` **z lokalną bazą**, nie założeniem |
| C-12 zero enumów Prisma | ✅ — nie dochodzi żadna kolumna |
| C-20 akcje + `revalidatePath` | ✅ — nowych akcji nie ma; `updateMenuPrefs` zachowuje `revalidatePath("/", "layout")` |
| C-21/C-22 guardy i RBAC | ✅ — trzy nowe powierzchnie (historia, szybkie cele, ulubione w wachlarzu) idą przez **tę samą** `filterAccessibleFavorites(…, isPathLocked)`; kotwica domu przez `isPathLocked("/")` |
| C-23 `AIAction` | — nie dotyczy (`check:actions` zielony) |
| C-30 zmienne CSS | ✅ — zero hexów, `check:ui-contract` zielony |
| C-31 mobile, 44 px, safe-area | ✅ — mierzone klikaczem przy 360 px, `env(safe-area-inset-bottom)` zachowane |
| C-32 teksty przez `t()` | ✅ — `check:i18n` zielony; etykiety szybkich celów są tekstem DEKLARACJI (jak `label` modułu obok), nie JSX-em |
| C-34 potwierdzenia | ✅ — przełączenie ulubionego bez potwierdzenia, bo odwracalne tym samym gestem; zero `window.confirm` |
| C-35 komponent z konsumentem | ✅ — `szybkieCele` w 22 modułach, `?akcja=` w 5 widokach, martwa stała usunięta |
| C-36 granice modułów | ✅ — `platform/nawigacja` nie zna modułów (etykieta przychodzi parametrem); powłoka nie sięga do wnętrza modułu; `check:boundaries` zielony |
| C-41 klucze API | — nie dotyczy |
| C-53 minimalizm | ✅ — zero nowych zależności; `uchwyty()` rozszerzone **wstecznie zgodnie**, więc nawigacja boczna nie wymagała zmiany |

## Bezpieczeństwo

- **Historia nie jest obejściem RBAC.** Wpisy przechodzą przez ten sam filtr uprawnień co ulubione,
  stosowany **przy renderowaniu** (uprawnienie może wrócić), a nie przy zapisie.
- **Wpis podrobiony w pamięci przeglądarki nie wyprowadzi poza aplikację.** `czyWpis` odrzuca adresy
  nie zaczynające się od `/` oraz `//host` i `/\host` — ta sama reguła, którą `normalizeFavoritePath`
  stosuje do ulubionych. Pokryte testem.
- **Brak nowych powierzchni serwerowych** — feature nie dodaje ani jednej akcji ani trasy API.

## Stan bramek (na commicie recenzowanym)

`check:migrations` ✓ · `check:schema-drift` ✓ · `check:actions` ✓ · `check:module-registry` ✓
(z nową, 9. kontrolą) · `check:boundaries` ✓ · `check:i18n` ✓ · `check:ui-contract` ✓ · `check:logs` ✓
· `check:client-safe` ✓ · `check:owner-columns` ✓ · `check:route-gating` ✓ · `check:e2e-waits` ✓ ·
`check:tailwind` ✓ · `test:unit` **1249/1249** ✓ · `next lint --dir src` **0 błędów** ·
`next build` **exit 0** · `check:perf` ✓ (w paśmie, próg bez zmian).

Klikacze, przebieg kontrolny: **43 zdane, 1 niezdany, 1 pominięty**; jedyny niezdany (`085-AC4`)
pada tak samo na commicie bazowym.

## Uwagi na przyszłość (nie blokujące)

1. **Zastana rywalizacja klikaczy o wspólne konto.** `favorites.spec.ts` i `view-state.spec.ts`
   psują się nawzajem, gdy idą równolegle — udowodnione na commicie bazowym (`2 failed, 21 passed`
   bez żadnej zmiany z tego przebiegu). Część z nich zakłada **globalnie pustą** listę ulubionych,
   co czyni je wrażliwymi na każdy nowy test dotykający ulubionych. Naprawa to osobna, świadoma
   zmiana (C-53), nie „przy okazji".
2. **Dwanaście zastanych niepowodzeń w Wiadomościach i lektorze** wynika z braku sieci w tym
   środowisku (puste kanały RSS). Warte oznaczenia jako zależne od sieci, żeby czerwony wynik
   znowu zaczął znaczyć „regresja".
3. **Łańcuch `if (id === …)` w `MobileModuleSubNav`** został świadomie nietknięty (C-36, ustalenie
   z run 100). Szybkie cele są jego naturalnym następcą — migracja to osobne zadanie.

## Werdykt

**APPROVE** — trzy ustalenia recenzji naniesione w jej trakcie, wszystkie drobne i bezpieczne;
żadnego ustalenia blokującego. 27/27 kryteriów akceptacji spełnionych, wszystkie bramki zielone,
build exit 0, brak zmian w schemacie bazy (a więc i brak ryzyka migracyjnego przy wycofaniu).
