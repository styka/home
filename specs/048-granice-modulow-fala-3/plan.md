# Plan techniczny: Granice modułów — Faza 1, fala 3 (domknięcie zadania 5)

- **Spec:** ./spec.md (048-granice-modulow-fala-3)
- **Status:** draft
- **Data:** 2026-08-05

> **Zasada planu:** to jest **JAK**. Wzorcem są przebiegi **046** i **047** — powtarzamy sprawdzone
> (C-53). Nowe jest tylko to, czego fala wymaga.

---

## 1. Podejście

Ten sam wzorzec co dwa razy wcześniej: `git mv` + skrypt przepisujący importy, `tsc` jako dowód,
`contract.ts` z tym, czego realnie używają konsumenci, `module.ts` z `defineModule`, usunięcie
z listy przejściowej i z `PERMISSIONS`, **jeden commit na moduł**, rytuał bramek po każdym.

**Rekonesans dał trzy rzeczy, które przesądzają o kształcie tej fali.**

### 1.1. Sprzężenia międzymodułowe są **maleńkie** — po jednej funkcji

| Konsument | Dostawca | Co dokładnie |
|-----------|----------|--------------|
| Kuchnia (`recipes`) | Zakupy | `assertListAccess` |
| Magazynowanie *(już moduł)* | Zakupy | `assertListAccess` |
| Pogoda | Zadania | `createTask` |
| Nawyki *(już moduł)* | Zadania | `createTask` |
| Usługi (`services/payments`) | Portfel | `addEntry` |

To najlepsza wiadomość rekonesansu: kontrakty Zadań, Zakupów i Portfela **nie spuchną** — każdy
dokłada jedną pozycję dla sąsiada. Ryzyko ze speca („kontrakty spuchną") się nie zmaterializuje.

### 1.2. Słowniki: założenie speca było **błędne** (korekta C-54, spec poprawiony)

`categories`, `units`, `products`, `categoryIcons` mają **wyłącznie** konsumentów zakupowych
(`components/shopping`, `app/shopping`, `actions/items`, `actions/shoppingSync`; `categoryIcons`
dodatkowo panel admina). Kuchnia sięga tylko po **tagi**.

**Wniosek:** słowniki zakupowe **jadą z Zakupami**. W `src/actions` zostają **tagi** — jedyny
faktycznie współdzielony słownik (Notatki + Kuchnia). To ta sama zasada co w 047: *przynależność
ustala lista konsumentów, nie nazwa*.

### 1.3. Strona główna to **dwie różne rzeczy** w jednym katalogu

`src/components/home/` (17 plików) miesza pulpit z **globalnym asystentem**. Spoza katalogu używane
są tylko trzy:

- `HomePage` ← `app/page.tsx` (własna trasa modułu),
- `AICommandSheet` ← **`AppShell`** — asystent jest globalnym elementem powłoki, obecnym na każdej
  stronie; to **nie jest** pulpit,
- `ActivityFeed` ← `app/settings/page.tsx` — należy do ustawień, nie do pulpitu.

Dlatego moduł Strona główna dostaje **tylko kafelki pulpitu**, a klaster asystenta
(`AICommandSheet`, `ActionDrawer`, `AssistantLevelSettings`) przenosi się do
`src/components/assistant/` — **osobnym commitem, czystą przenosiną**. Bez tego rozdzielenia
powłoka musiałaby importować wnętrze modułu i AC-6 byłoby niewykonalne.

---

## 2. Model danych (Prisma)

**Bez zmian w schemacie. Bez migracji.** Potwierdzi `npm run check:schema-drift`.

---

## 3. Kolejność przenoszenia i granice każdego modułu

| # | Moduł | Akcje | Konsumenci z zewnątrz |
|---|-------|-------|------------------------|
| 1 | **Wiadomości** | `news.ts` | `newsExecutor`, `agentTools` |
| 2 | **Pogoda** | `weather.ts` | `weatherExecutor`, `agentTools`; sama woła Zadania |
| 3 | **Usługi** | `services.ts`, `actions/services/*` | `RequestThread`; sama woła Portfel |
| 4 | **Kuchnia** | `recipes`, `cookbooks`, `mealPlans`, `pantry` | brak; sama woła Zakupy |
| 5 | **Zwierzęta** | `pets`, `petCare`, `petHusbandry`, `petBreeding` | `petExecutor`, `agentTools`, powłoka (nav) |
| 6 | **Portfel** | `portfel`, `portfelBudgets`, `portfelReports`, `portfelCurrency`, `portfelAuto` | `portfelExecutor`, `agentTools`, pulpit, **Usługi** |
| 7 | **Zakupy** | `lists`, `items`, `stores`, `shoppingSync`, `categories`, `units`, `products`, `categoryIcons` | paleta poleceń, **Kuchnia**, **Magazynowanie** |
| 8 | **Zadania** | `tasks`, `taskProjects`, `taskTags`, `projectGroups` | `tasksExecutor`, **Pogoda**, **Nawyki** |
| 9 | **Kalendarz** | `calendar.ts` + `lib/calendar/` | `agentTools`, briefing, trasa iCal, `NotificationBell`, `actions/notifications` |
| 10 | **Strona główna** | — (same widoki) | `app/page.tsx` |

**Kolejność nie jest przypadkowa:** dostawca idzie **przed** konsumentem tam, gdzie to możliwe
(Portfel przed… nie — Usługi są wcześniej, więc ich import Portfela przechodzi przez kontrakt
dopiero przy kroku 6; to jest w porządku, bo do tego czasu `@/actions/portfel` nadal istnieje).
Kalendarz i pulpit **na końcu** — zastaną gotowe kontrakty zamiast tymczasowych.

### 3.1. Co ZOSTAJE poza modułami (i dlaczego)

| Plik | Decyzja | Powód |
|------|---------|-------|
| `actions/tags.ts` | **ZOSTAJE** | jedyny realnie współdzielony słownik (Notatki + Kuchnia) |
| `lib/calendar/index.ts` (typy, `isoDay`, `MODULE_META`) | **do modułu**, ale kontrakt je wystawia | używa ich `NotificationBell` (powłoka) i `actions/notifications` — oba **spoza** `src/platform`, więc import kontraktu jest legalny |
| `lib/medicationSchedule.ts`, `lib/habitStats.ts` | **ZOSTAJĄ** (decyzja z 047) | wspólne helpery dat |
| `components/home/{AICommandSheet,ActionDrawer,AssistantLevelSettings}` | → `components/assistant/` | globalny asystent to powłoka, nie pulpit |
| `components/home/ActivityFeed` | → `components/settings/` | jedyny konsument to strona ustawień |

---

## 4. Nawigacja boczna z deklaracji (AC-5, AC-6) — osobny commit

Dziś `ModuleSidebar` importuje sześć komponentów `*SideNav` wprost z wnętrz modułów. Po tej fali
**wszystkie sześć** byłoby wnętrzami — recenzja 047 nazwała to warunkiem, nie życzeniem.

**Rozwiązanie wg rozdz. 9.3:** `ModuleDeclaration` dostaje opcjonalne pole

```ts
sideNav?: () => Promise<{ default: ComponentType }>
```

ładowane **leniwie** (`next/dynamic`), tak jak dokument opisuje kafelek pulpitu. Powód leniwości nie
jest kosmetyczny: `module.ts` jest importowany przez `lib/modules.tsx`, a ten przez **kod serwerowy**;
statyczny import komponentu klienckiego wciągnąłby go do każdego takiego grafu.

`ModuleSidebar` zamienia `switch` po `id` modułu na odczyt `sideNav` z rejestru. To **zmiana
zachowania** (import dynamiczny zamiast statycznego), więc **osobny commit**, po nim klikacz.

**Ryzyko:** `next/dynamic` z `ssr:false` zmieniłby moment renderu nawigacji. Mitygacja: zachowujemy
domyślny SSR i sprawdzamy klikaczem, że nawigacja boczna jest widoczna od pierwszej klatki.

---

## 5. Warstwa serwera i RBAC (C-20, C-21, C-22)

**Bez zmian w treści akcji** — `git mv`, wnętrze bit w bit. Po fali `PERMISSIONS` ma zawierać
**wyłącznie** slugi spoza rejestru modułów: `SETTINGS`, `ADMIN`, `INVITATIONS` + pięć podupranień
Kuchni (`KITCHEN_*`). To jest **sprawdzalny dowód**, że „8 → 1" zadziałało.

> **Uwaga o `KITCHEN_*`:** podupranienia (`kitchen.recipe.create` itd.) **nie są** uprawnieniem
> modułu, tylko uprawnieniami operacji w jego wnętrzu. Zostają w `PERMISSIONS` — deklaracja niesie
> jedno uprawnienie modułu, a nie cały ich zbiór. Gdyby je przenieść, `defineModule` musiałby urosnąć
> o pole, którego potrzebuje **jeden** moduł.

Strażniki tras czytają uprawnienie z deklaracji (`hasPermission(session, xModule.permission)`).

---

## 6. AI / integracje (C-23)

Zero nowych `AIAction`, zero nowych read-tooli — zmienia się **wyłącznie ścieżka importu**
w `src/lib/ai/executors/*` i `agentTools.ts`. `check:actions` ma dalej raportować **160**,
`check:ai-coverage` **nie mniej niż 551**.

---

## 7. Dług testowy (AC-8) — osobny commit

Osiem zastanych porażek. Dla każdej: odtworzyć, ustalić przyczynę, rozstrzygnąć czy to **błąd testu**
(naprawiamy) czy **brak funkcji w aplikacji** (backlog produktowy — opisujemy, nie dorabiamy funkcji
w fali refaktorującej). Wstępna hipoteza z logów:

- `scenario-create-list-*`, `switch-lists-sidebar`, `add-item-enter` — test czeka na przycisk
  „Utwórz", którego selektor prawdopodobnie się rozjechał → **błąd testu**;
- `settings-profile-display` — element istnieje, ale jest `hidden` → **błąd testu** (zły selektor);
- `qa-tester-access`, `reports-*`, `notes-group-create` — do ustalenia.

---

## 8. Domknięcie fazy (AC-11) — tylko przy pustej liście

Gdy `LEGACY` dojdzie do zera:
- `check-module-registry.js` dostaje **czwartą kontrolę**: żaden katalog modułu nie może mieszkać
  poza `src/modules/` — konkretnie `src/actions/<x>.ts` i `src/components/<x>/` dla identyfikatora
  obecnego w rejestrze = błąd;
- `LEGACY` i `legacyPermissionForPath` znikają jako martwy kod, a `pathPermissions.ts` upraszcza się
  do samych deklaracji **plus** mapowania powierzchni spoza rejestru (`/settings`, `/admin`,
  `/invitations`).

**Jeśli lista nie dojdzie do zera — bramki NIE zaostrzamy** i mówimy to wprost. Zaostrzona bramka
przy niepustej liście blokowałaby pracę, a wtedy pierwszym odruchem byłoby jej wyłączenie.

---

## 9. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/modules/{news,weather,services,kitchen,pets,portfel,shopping,tasks,calendar,home}/contract.ts` | nowy | granice |
| `src/modules/…/module.ts` | nowy | deklaracje |
| `src/modules/…/{actions,ui,lib}/**` | `git mv` | kod modułów |
| `src/components/assistant/**` | `git mv` z `components/home` | globalny asystent ≠ pulpit |
| `src/components/settings/ActivityFeed.tsx` | `git mv` | konsument to ustawienia |
| `src/platform/registry.ts` | edycja | pole `sideNav` w deklaracji |
| `src/components/shell/ModuleSidebar.tsx` | edycja | nawigacja z rejestru zamiast `switch` |
| `src/lib/modules.tsx` | edycja ×10 | `DECLARED` rośnie, `LEGACY` znika |
| `src/platform/auth/permissions.ts` | edycja ×10 | usunięcie slugów modułowych |
| `src/lib/pathPermissions.ts` | edycja | uproszczenie po opróżnieniu listy |
| `src/lib/ai/{agentTools,executors/*}.ts` | edycja | importy przez kontrakty |
| `src/lib/ui/view-contract.json` | edycja | nowe ścieżki widoków |
| `scripts/check-module-registry.js` | edycja | czwarta kontrola (AC-11) |
| `e2e/specs/*.spec.ts` | edycja | naprawa błędów testów (AC-8) |
| `content/architektura/15-dziennik.md`, `CLAUDE.md`, `doświadczenia.md` | edycja | domknięcie |

---

## 10. Bramki i weryfikacja (C-50)

**Lokalnie (C-13):** lokalny Postgres, `export` osobnymi instrukcjami. **Nigdy `next build`
równolegle z klikaczami** — walczą o `.next` (lekcja z 047).

**Rytuał po każdym module:** `tsc --noEmit` · `check:ai-coverage` (bez spadku) · `next lint --dir src`
(nie sam `check:boundaries` — on sprawdza sondy, nie repo; lekcja z 047) · `check:module-registry` ·
`check:ui-contract` · commit.

| AC | Jak sprawdzamy |
|----|----------------|
| AC-1 | Lista katalogów `src/modules/` = 21, `LEGACY` puste (albo jawna lista z powodami) |
| AC-2 | `grep` po `src/lib/ai`, `src/app`, `src/components`: brak importów wnętrz |
| AC-3 | `grep` po `modules.tsx` i `permissions.ts` |
| AC-4 | Rozmiary kontraktów Zadań/Zakupów/Portfela — raportowane liczbowo |
| AC-5, AC-6 | `grep` po `src/components/shell/`: zero `@/modules/*/ui`; klikacz po zmianie nawigacji |
| AC-7 | Lista konsumentów każdego słownika + zapisana decyzja |
| AC-8 | Ponowny przebieg pełnego zestawu; każda pozostała czerwona ma wpis z przyczyną |
| AC-9 | `modules-happy-path.spec.ts` — 22/22 |
| AC-10 | Komplet bramek; `check:actions` = 160, `check:ai-coverage` ≥ 551 |
| AC-11 | Test negatywny zaostrzonej bramki (podłożony `src/actions/<moduł>.ts`) |
| AC-12 | `git show --stat` commitów przenoszących |
| AC-13 | Rozdz. 15 po przebiegu |

---

## 11. Ryzyka i rollback

| Ryzyko | Mitygacja |
|--------|-----------|
| Fala jest bardzo duża (10 modułów + 3 zmiany zachowania) | commit na moduł; przy utracie kontroli **zatrzymujemy się z częścią przeniesioną** i raportujemy jawnie (spec dopuszcza) |
| Kalendarz zwróci inne wydarzenia | przenoszony jako ostatni z modułów danych; agregat porównany przed/po na tej samej bazie |
| Nawigacja z deklaracji zmienia moment renderu | zachowujemy SSR; klikacz po commicie |
| Rozdzielenie asystenta od pulpitu dotyka powłoki | czysta przenosina, osobny commit, klikacz |
| Zaostrzona bramka blokuje pracę | włączana **tylko** przy pustej liście |
| `next build` równolegle z klikaczami | nigdy — lekcja z 047 |

**Rollback:** brak migracji, więc wyłącznie kod. Commit na moduł ⇒ `git revert` pojedynczego modułu
bez dotykania reszty.

---

## 12. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — bez zmian schematu; potwierdza `check:schema-drift`
- [x] **C-20, C-21** — treść akcji nietknięta; guardy i `revalidatePath` jadą z kodem
- [x] **C-22** — slugi w bazie bez zmian; po fali `PERMISSIONS` = tylko powierzchnie spoza rejestru
- [x] **C-23** — zero nowych `AIAction`; `check:actions` = 160
- [x] **C-30..C-33** — komponenty bez zmian; kontrakt widoku i kontrola kolorów obejmują `src/modules`
- [x] **C-36** — po fali obowiązuje bez wyjątków; egzekwowane dwiema bramkami + lintem
- [x] **C-53** — powtórzony wzorzec; nowe tylko to, czego fala wymaga (pole `sideNav`, czwarta
      kontrola bramki, rozdzielenie asystenta od pulpitu)
- [x] **C-54** — błędne założenie speca o słownikach poprawione **w specu**, przed kodem
