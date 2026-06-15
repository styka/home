# Rozdział 6 — Architektura i jakość kodu

## Kontekst / stan z kodu

Fakty z repozytorium (`worldofmag/`):

- **Server Actions:** 57 plików w `src/actions/`, **100%** z dyrektywą `"use server"`, **51/57**
  kończy mutacje `revalidatePath()` (pozostałe to read-only/agregatory lub fire-and-forget jak
  `activity.ts`). Wzorzec mutacji jest więc niemal w pełni jednolity.
- **Rozdział serwer/klient:** konsekwentny duet `*HomePage.tsx` (serwer: pobiera dane, props) +
  `*Page.tsx` (klient: interakcja). Potwierdzony w `tasks/`, `notes/`, `portfel/`.
- **Rejestr modułów scentralizowany:** `src/lib/modules.tsx` (`MODULES`, `resolveMenu`,
  `accessibleModulesInOrder`) — jedno źródło nawigacji.
- **Granice modułów czyste:** brak przypadkowych zależności krzyżowych (0 importów tasks→portfel,
  notes→shopping). Agregatory (`actions/calendar.ts`, Home, `api/llm/home/agent`) są **świadomymi
  hubami**, nie wyciekiem domeny.
- **Strażniki w buildzie:** `check-action-coverage.js` (każda akcja AI ma egzekutor) i
  `check-migrations.js` (unikalna numeracja migracji) — realna, automatyczna ochrona.
- **„Boskie” pliki:** `api/llm/home/execute/route.ts` (1467 linii), `actions/services.ts` (1409),
  `components/home/AICommandSheet.tsx` (1225), `actions/storage.ts` (1011), `TaskDetail.tsx` (875),
  `actions/news.ts` (854).
- **Inline-style:** ~5000 wystąpień `style={{…}}` w ~245 plikach. Kolory **zawsze** przez zmienne CSS
  (0 hardkodów hex w klasach), ale **układ (flex/gap/padding) jest wpisywany inline**, nie przez
  klasy/komponenty. Istnieje `src/components/ui/` (Button, Card, Surface, Badge, EmptyState…), ale
  jest używany **niekonsekwentnie**.
- **Brak lintera/formatera w pipelinie** — brak `.eslintrc`/`.prettierrc`/`biome.json`. Jakość trzyma
  się dyscypliny autora.
- **Znaczniki długu:** ~21 `TODO/FIXME` (głównie `P4:` = świadomy backlog, nie ukryte bugi).

## Głos Zespołu A — Strażnicy

**dr inż. Tomasz (architekt):** „Fundament jest dobry — jeden wzorzec mutacji, czyste granice, hub-y
zaprojektowane świadomie. Ale mamy **trzy realne źródła długu**: (1) pliki-giganty po 1000–1500 linii,
(2) inline-style zamiast design-systemu, (3) **brak lintera w buildzie**. Pierwszy psuje przeglądy
kodu i zwiększa ryzyko regresji; trzeci to brak siatki bezpieczeństwa przy każdym commicie.”

**Michał (senior dev):** „`execute/route.ts` (1467) i `services.ts` (1409) to bomby z opóźnionym
zapłonem. Każda zmiana w nich to ruletka. Łańcuch `if (type === '…')` w egzekutorze AI woła o rozbicie
na rejestr handlerów per akcja — strażnik pokrycia mamy, ale on pilnuje *istnienia*, nie *jakości*.”

**Rafał (grafik/UI):** „5000 inline-style to znaczy, że **nie mamy spójnego systemu odstępów i
typografii** — są zmienne kolorów, ale `gap: 12`, `fontSize: 13`, `padding: '14px 16px'` są wpisywane
ręcznie w setkach miejsc. Każda zmiana gęstości UI to przeszukiwanie całego repo.”

**Ewa (QA):** „Brak ESLint to brak wczesnego łapania błędów typu `no-unused-vars`,
`exhaustive-deps`. Przy 227 komponentach to się **musi** mścić.”

## Głos Zespołu B — Pionierzy

**Sandra (architekt):** „Spokojnie — to nie jest spaghetti, to **dojrzały monolit modularny** zrobiony
przez jedną osobę w imponującym tempie. Pliki-giganty są skupione w 5–6 miejscach, a nie rozlane
wszędzie. Refaktor tak, ale **chirurgiczny**: najpierw `execute/route.ts` (bo dotyka go każda nowa
akcja AI), reszta gdy faktycznie zaboli.”

**Damian (senior dev):** „Inline-style ma zaletę: **lokalność**. Widzisz komponent i od razu wiesz, jak
wygląda — zero skakania po plikach CSS. Nie demonizujmy tego. Wprowadźmy **warstwę pośrednią**: zestaw
gotowych obiektów stylów (`ui/home/styles.ts` już istnieje!) i prymitywów (`Surface`, `Card`), i
*stopniowo* migrujmy najczęstsze wzorce. Bez wielkiego przepisywania.”

**Magda (delivery):** „ESLint dodajmy, ale **nie blokujący od dnia zero** — 245 plików zapali się na
czerwono i sparaliżuje pracę. Najpierw `--max-warnings` luźne, potem dokręcamy.”

## Punkty sporne

- **Refaktor plików-gigantów: teraz vs gdy zaboli.** Strażnicy chcą planu rozbicia teraz; Pionierzy —
  tylko `execute/route.ts` teraz, reszta reaktywnie. **Kompromis:** rozbić *tylko* egzekutor AI (bo
  rośnie z każdą akcją i jest krytyczny), resztę objąć regułą „dotykasz pliku >800 linii → przy okazji
  wydziel jedną sekcję”.
- **ESLint blokujący vs ostrzegawczy.** **Kompromis:** wprowadzić jako ostrzeżenia + naprawić
  krytyczne reguły (hooks, unused), bramkować dopiero gdy baseline = 0 błędów.
- **Inline-style: tępić vs tolerować.** **Kompromis:** nie tępić globalnie; skodyfikować wspólne
  obiekty stylów i prymitywy, migrować przyrostowo, zakazać *nowych* hardkodów odstępów tam, gdzie jest
  gotowy token/komponent.

## Głos użytkowników

**Krzysztof (52, warsztat):** „Mnie nie obchodzi, ile linii ma plik — byle działało i się nie psuło po
aktualizacji.” → przypomnienie, że dług kodu interesuje użytkownika *pośrednio*: przez regresje i tempo
poprawek.

## Konsensus i zalecenia

- **Z-010** *(P1 · M)* — **Rozbić egzekutor AI `api/llm/home/execute/route.ts` na rejestr handlerów
  per typ akcji.** Plik rośnie z każdą `AIAction`; rejestr `Record<type, handler>` upraszcza testy i
  redukuje ryzyko regresji. Strażnik pokrycia zostaje.
- **Z-011** *(P1 · S)* — **Dodać ESLint + Prettier (najpierw ostrzegawczo) do repo i pipeline’u.**
  Reguły hooków i `no-unused-vars` jako pierwsze; bramkowanie buildu, gdy baseline osiągnie zero.
- **Z-012** *(P2 · M)* — **Skodyfikować warstwę stylów:** rozbudować `ui/home/styles.ts` o wspólne
  tokeny odstępów/typografii i promować prymitywy `Surface/Card/Button` jako domyślne; migrować
  najczęstsze wzorce przyrostowo.
- **Z-013** *(P2 · S)* — **Reguła „>800 linii”:** przy każdej edycji pliku przekraczającego próg
  wydzielić co najmniej jedną logiczną sekcję (lekki, ciągły refaktor zamiast wielkiego przepisania).
- **Z-014** *(P2 · S)* — **Udokumentować zasady granic modułów i listę świadomych agregatorów**
  (`calendar`, Home, agent) w `ARCHITECTURE`/raporcie systemowym, by nowe zależności krzyżowe były
  decyzją, nie przypadkiem.
- **Z-015** *(P1 · S)* — **Włączyć `typecheck` (tsc `--noEmit`) jako osobny krok CI**, niezależny od
  `next build`, by łapać błędy typów wcześniej i taniej.

## Dobre vs złe praktyki

**Dobre:**
- Jednolity wzorzec mutacji (Server Actions + `revalidatePath`) i rozdział serwer/klient.
- Czyste granice modułów; agregatory jako świadoma decyzja architektoniczna.
- Strażniki w buildzie (pokrycie akcji AI, numeracja migracji) — rzadko spotykana higiena.
- Centralny rejestr modułów i konsekwentne zmienne CSS (zero hardkodów kolorów).

**Złe / do poprawy:**
- Pliki-giganty (1000–1500 linii) skupiające zbyt wiele odpowiedzialności.
- Inline-style układu bez warstwy tokenów odstępów → trudna globalna zmiana gęstości.
- Brak lintera/formatera i osobnego kroku typecheck w pipelinie.
