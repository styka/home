# Recenzja: Migawka pulpitu z deklaracji — domknięcie Fazy 1

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-11 · **Branch:** `claude/omnia-architecture-skins-qlv2ew`
- **Diff:** 34 pliki, **+1713 / −397**

Recenzja celuje w to, czego `verify.md` sprawdzić nie mógł. Zrzut runtime dowodzi równoważności
**dla danych z fixture'a** — nie dowodzi jej dla danych, których fixture nie ma. Tam właśnie
znalazło się jedyne realne ustalenie.

---

## Ustalenia

### 1. Okno „ostatnie siedem dni" w Raportach liczone od końca dnia zamiast od teraz — correctness

- **Plik:** `worldofmag/src/modules/reports/dashboard.ts:16` (przed poprawką)
- **Kategoria:** correctness

Trasa przed przebudową liczyła próg jako `now − 7 dni`. Przenosząc blok do modułu wziąłem próg
z `ctx.todayEnd`, czyli **z końca dnia** — a koniec dnia jest do ~24 h późniejszy niż „teraz".

**Scenariusz awarii:** jest wtorek 09:00. Raport powstał w zeszły wtorek o 18:00, czyli
6 dni i 15 godzin temu. Trasa liczyła go („ostatnie 7 dni"); wersja po przenosinach **nie** —
bo próg to `wtorek 23:59:59 minus 7 dni` = zeszły wtorek 23:59, a raport jest wcześniejszy.
Licznik `recentReports` na pulpicie zaniżony, cicho i zależnie od pory dnia.

**Dlaczego nie złapało tego pięć porównań zrzutu:** fixture sadzi raport „teraz", a taki wpada
w oba okna. Zrzut runtime jest mocnym dowodem, ale tylko na tych danych, które w nim są — to
ograniczenie metody, nie jej porażka, i warto je znać przy następnym przebiegu.

**Poprawione w recenzji.** `DashboardContext` dostał jawne pole `now`, a Raporty liczą próg od
niego. Powód siedzi w komentarzu przy polu, żeby następny wkład z oknem „wstecz od teraz" nie
powtórzył tego samego: koniec dnia **nie jest** zamiennikiem chwili bieżącej. Alternatywa —
`new Date()` wewnątrz wkładu — działałaby tak samo, ale wprowadzałaby drugie źródło czasu obok
kontekstu, czyli dokładnie tę niespójność, która ten błąd zrodziła.

### 2. Wkład wskazujący na moduł spoza rejestru był wołany bez sprawdzenia uprawnienia — security

- **Plik:** `worldofmag/src/lib/dashboardSnapshot.ts:28-31` (przed poprawką)
- **Kategoria:** security (obrona w głąb)

Filtr brzmiał `permission === null || permission === undefined || permissions.includes(permission)`,
gdzie `undefined` bierze się **wyłącznie** z `MODULES.find(...)` nietrafiającego w żaden moduł.
Dwa różne stany — „ten moduł świadomie nie ma uprawnienia" (Raporty) i „nie wiem, czyj to wkład" —
dawały tę samą odpowiedź: **wołaj**.

**Scenariusz:** wpis w korzeniu kompozycji z identyfikatorem, którego nie ma w `MODULES` (literówka
przy zmianie nazwy modułu, moduł usunięty z rejestru bez usunięcia wkładu). Wkład wykonuje się dla
**każdego** zalogowanego, bez sprawdzenia uprawnienia, i pokazuje dane na pulpicie.

Bramka rejestru czyni to dziś nieosiągalnym (wpis musi wskazywać istniejący `dashboard.ts`, a każdy
katalog modułu musi być w `MODULES`), więc zgłaszam to jako obronę w głąb, nie jako dziurę. Ale
domyślną odpowiedzią na „nie wiem" w kodzie decydującym o widoczności danych **musi** być odmowa —
inaczej obejście bramki zamienia się w cichy wyciek zamiast w błąd.

**Poprawione w recenzji:** brak modułu w rejestrze → wkład **nie jest** wołany; `permission: null`
nadal wołany zawsze. Oba przypadki rozdzielone i opisane.

### 3. Cztery wkłady importowały nieużywany typ `DashboardContext` — simplification

- **Pliki:** `src/modules/{notes,portfel,reports,shopping}/dashboard.ts:1`
- **Kategoria:** simplification

Import typu, którego plik nie używa (sygnatury polegają na wnioskowaniu z `DashboardContributor`).
Martwy kod — `tsc` i lint go nie zgłaszają, bo import typowy znika przy kompilacji.
**Poprawione w recenzji:** usunięty tam, gdzie nieużywany; został w Zadaniach i Flocie, które
adnotują `ctx` jawnie.

### 4. Wybór korzenia kompozycji zamiast pola w deklaracji — obserwacja

- **Kategoria:** obserwacja (bez poprawki)

To jedyne odstępstwo od wzorca 049 i warto zapisać, że jest **kupione pomiarem, nie wygodą**:
1889 → 2117 modułów przy wpięciu przez `MODULE_SERVER`, 1903 przy własnym korzeniu. Kosztuje
widoczność: patrząc na `module.server.ts` nie widać, że moduł wnosi coś do pulpitu. Ten koszt jest
spłacony bramką dwukierunkową — i to jest właściwa kolejność, bo bramkę widać na czerwono, a
konwencję trzeba pamiętać.

**Konsekwencja, której ten przebieg świadomie nie podjął:** `calendarContributors.ts`,
`lib/ai/catalog.ts` i `lib/jobs/registry.ts` importują ten sam barrel, więc agenda kalendarza ciągnie
egzekutory asystenta. Rozdzielenie ich to ta sama operacja i jest zapisane w trzech miejscach
(dziennik, `dashboardContributors.ts`, `registry.server.ts`), żeby nie zginęło.

### 5. Odporność korzenia na błąd wkładu — celowa — obserwacja

Jeden `try/catch` w korzeniu zastąpił osiem rozsypanych po trasie. Zachowanie identyczne: padnięty
wkład daje puste pola, nie pustą stronę. **Koszt jest ten sam co przy agendzie w 049** — cichy błąd
objawia się brakiem danych, nie komunikatem. Akceptowalne dla widoku agregującego jedenaście źródeł,
ale warte pamiętania; odnotowane też w `verify.md`.

### Czego NIE zgłaszam

Zero zmian schematu i migracji, zero enumów Prisma, zero zaszytych kolorów (przebieg nie dotyka
widoków), teksty PL, zero nowych `AIAction`, zero nowych zależności. Warunki własności
(`ownerId`/`ownerTeamId`, filtr dostępu do raportów) przeniesione **co do znaku** — sprawdzone
przez porównanie z treścią sprzed przenosin, nie na oko. `revalidatePath` nie dotyczy: wszystkie
jedenaście wkładów to odczyt. Trasa diagnostyczna i jej wyjątek w `middleware.ts` faktycznie znikły
(`grep` czysty), więc bramka logowania wróciła do stanu sprzed przebiegu.

---

## Bramki po recenzji

| Komenda | Wynik |
|---|---|
| `npm run build` (pełny potok, lokalny Postgres) | ✅ **exit 0**, „Compiled successfully" |
| `npm run test:unit` | ✅ **657 / 657** |
| `tsc --noEmit` · `tsc -p tsconfig.test.json` | ✅ oba exit 0 |
| `next lint --dir src` | ✅ 0 błędów |
| `check:actions` 160 · `check:ai-coverage` 551 · `check:cost-badge` 35 · `check:content-memory` 35 | ✅ bez spadku |
| `check:module-registry` (8 kontroli) · `check:boundaries` · `check:ui-contract` · `check:schema-drift` | ✅ |
| **Zrzut migawki po poprawkach recenzji** | ✅ 20 pól, **IDENTYCZNE** w obu wariantach |
| Graf kompilacji dev: `/auth/signin` 1771 · `/` 1903 | ✅ |

Zrzut przeliczono **po** naniesieniu poprawek — trasa diagnostyczna została na tę jedną chwilę
odtworzona i skasowana ponownie, żeby dowód dotyczył stanu faktycznie wypuszczanego, a nie stanu
sprzed recenzji.

**Klikacze:** nieuruchamiane — decyzja właściciela z 2026-08-11 („nie poświęcaj dużo czasu na
klikacze"). Dla tej zmiany zrzut pole po polu jest zresztą miarą ostrzejszą niż klikacz sprawdzający,
czy strona się wyrenderowała.

**Obserwacja spoza zakresu:** seed w `migrate.js` wypisuje `⚠ Failed to seed LLM defaults` na
lokalnej bazie e2e. Ostrzeżenie, nie błąd (build `exit 0`), i zastane — diff przebiegu nie dotyka
żadnego pliku LLM.

---

## Werdykt

## **APPROVE Z UWAGAMI**

**Faza 1 przebudowy jest domknięta w całości.** Zniknęła szósta i ostatnia równoległa lista
opisująca moduł; `src/app/page.tsx` schudło z 322 do 87 linii i nie importuje ani jednego kontraktu.
Odpowiedź na pytanie kontrolne z rozdz. 14 — *jeden katalog plus wpięcie w korzeń kompozycji* — nie
ma już przypisu, i nie jest deklaracją: `check:module-registry` ma osiem kontroli, a dwie nowe
sprawdzone testem negatywnym.

Najcenniejsze w tym przebiegu nie jest przeniesienie kodu, tylko **kolejność**: dowód przed
przenosinami. Wymusiła trzy odkrycia, z których każde po przenosinach wyglądałoby jak regresja
przenosin — siedem bloków ignorujących parametr `userId`, Raporty bez bramkowania uprawnieniem
i zrzut ze skryptu dający ciche zera. Czwarte, wydajnościowe, zmieniło projekt: **wspólny rejestr
leniwych loaderów też jest plikiem zbiorczym** — tego nie widać w produkcyjnym bundlu i tylko pomiar
`next dev` to pokazał.

Recenzja znalazła jeden realny defekt (okno siedmiu dni liczone od końca dnia), którego zrzut
runtime złapać nie mógł, bo fixture nie zawiera danych z tego przedziału. To jest granica metody
i warto ją znać: **zrzut dowodzi równoważności dla danych, które w nim są.**

**Uwagi, z którymi to wypuszczamy:**
- **trzy pozostałe korzenie kompozycji płacą ten sam podatek grafu** — rozdzielenie ich to ta sama
  operacja, świadomie odłożona (C-53) i zapisana w trzech miejscach;
- **read-toole asystenta wciąż nie przechodzą przez `requireAccess`** (rozdz. 9.6) — wykonalne
  dopiero po zadaniu 10, a przy zasobach współdzielonych z Fazy 2 przestaje to być teoretyczne;
- **zastany dług klikaczy** — odłożony decyzją właściciela.

**Pierwszy krok Fazy 2:** zadanie 9 — modele `Workspace`, `WorkspaceMember`, `ResourceGrant`,
`ResourceInvitation`.
