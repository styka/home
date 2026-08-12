#!/usr/bin/env node
/**
 * Bramka REJESTRU MODUŁÓW (046, zadanie 7 z rozdz. 14).
 *
 * Cel przebudowy z rozdz. 9.3 brzmi „8 → 1": dodanie modułu ma wymagać **jednego katalogu
 * i jednej deklaracji**, a nie wpisu w ośmiu równoległych listach. Deklaracja spełnia to jednak
 * tylko wtedy, gdy naprawdę istnieje i naprawdę jest wpięta. Katalog w `src/modules/` bez
 * `module.ts` to moduł, którego nie ma w menu; bez `contract.ts` to moduł bez granicy, do którego
 * wnętrza wolno sięgnąć, bo reguła lintu nie ma czego chronić.
 *
 * Bramka jest **statyczna** (czyta pliki, nie uruchamia aplikacji) — tak samo jak `check:actions`
 * czy `check:ui-contract`. Sprawdza cztery rzeczy:
 *   1. każdy katalog modułu ma `module.ts` i `contract.ts`,
 *   2. deklaracja ma komplet wymaganych pól,
 *   3. identyfikatory modułów są unikalne,
 *   4. każda deklaracja jest **wpięta w korzeń kompozycji** (`src/lib/modules.tsx`) — bez tego
 *      moduł istnieje na dysku i nie istnieje w aplikacji, a build jest zielony,
 *   5. (048) identyfikator z rejestru nie ma kodu w trzech historycznych miejscach modułu,
 *   6. (049) ani wkładu (egzekutor AI, handler zadania) pod ścieżką platformową/kompozycyjną.
 *
 * Punkty 5–6 są **odpowiedzią KODEM na pytanie kontrolne z rozdz. 14** („ile miejsc trzeba dotknąć,
 * żeby dodać moduł?"). Odpowiedź brzmi **jeden katalog + jeden import w korzeniu kompozycji**, i nie
 * jest deklaracją — jest wymuszona: każde inne miejsce, w którym moduł mógłby się rozlać, wywala build.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const modulesDir = path.join(root, "src/modules");
const compositionRoot = path.join(root, "src/lib/modules.tsx");

/** Pola, bez których deklaracja nie opisuje modułu. `permission` może być `null`, ale musi wystąpić. */
const REQUIRED = ["id", "label", "href", "permission", "color", "Icon", "defaultEnabled"];

if (!fs.existsSync(modulesDir)) {
  console.log("✓ Rejestr modułów: brak katalogu src/modules — nic do sprawdzenia.");
  process.exit(0);
}

const errors = [];
const ids = new Map();

const dirs = fs
  .readdirSync(modulesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const composition = fs.existsSync(compositionRoot) ? fs.readFileSync(compositionRoot, "utf8") : "";
// 049: druga strona granicy — wkłady serwerowe mają własny korzeń kompozycji, bo `module.ts`
// trafia do bundla klienta i nie wolno mu ciągnąć egzekutorów ani handlerów.
const serverRootPath = path.join(root, "src/lib/modules.server.ts");
const serverRoot = fs.existsSync(serverRootPath) ? fs.readFileSync(serverRootPath, "utf8") : "";

for (const name of dirs) {
  const dir = path.join(modulesDir, name);
  const modulePath = path.join(dir, "module.ts");
  const contractPath = path.join(dir, "contract.ts");

  if (!fs.existsSync(contractPath)) {
    errors.push(
      `src/modules/${name}: brak contract.ts.\n` +
        "    Moduł bez kontraktu nie ma granicy — reguła lintu nie ma czego chronić, a inne moduły\n" +
        "    nie mają czego importować. Kontrakt może eksportować same typy; nie może nie istnieć.",
    );
  }

  if (!fs.existsSync(modulePath)) {
    errors.push(
      `src/modules/${name}: brak module.ts.\n` +
        "    Bez deklaracji moduł nie trafia do rejestru — nie ma go w menu, w uprawnieniach\n" +
        "    ani w mapowaniu ścieżek, mimo że jego kod istnieje.",
    );
    continue;
  }

  const src = fs.readFileSync(modulePath, "utf8");

  if (!/defineModule\s*\(/.test(src)) {
    errors.push(
      `src/modules/${name}/module.ts: nie wywołuje defineModule().\n` +
        "    Deklaracja pisana ręcznie omija kontrolę typów, która jest tu jedynym zabezpieczeniem.",
    );
    continue;
  }

  for (const field of REQUIRED) {
    if (!new RegExp(`(^|[\\s{,])${field}\\s*:`, "m").test(src)) {
      errors.push(`src/modules/${name}/module.ts: deklaracja nie ma pola „${field}".`);
    }
  }

  const idMatch = src.match(/\bid\s*:\s*["'`]([^"'`]+)["'`]/);
  if (!idMatch) {
    errors.push(`src/modules/${name}/module.ts: pole „id" musi być literałem tekstowym.`);
  } else {
    const id = idMatch[1];
    if (ids.has(id)) {
      errors.push(
        `Zduplikowany identyfikator modułu „${id}" (src/modules/${ids.get(id)} i src/modules/${name}).\n` +
          "    Dwa moduły o tym samym id nadpisałyby sobie preferencje menu użytkownika.",
      );
    }
    ids.set(id, name);
  }

  // 4b. Moduł z wkładem serwerowym musi być wpięty w serwerowy korzeń kompozycji.
  if (fs.existsSync(path.join(dir, "module.server.ts")) && !serverRoot.includes(`@/modules/${name}/module.server`)) {
    errors.push(
      `src/modules/${name}/module.server.ts nie jest zaimportowany w src/lib/modules.server.ts.\n` +
        "    Wkład serwerowy (asystent, zadania w tle, kalendarz) istnieje i nie działa — build zielony.",
    );
  }

  // 4. Wpięcie w korzeń kompozycji. Szukamy importu deklaracji — to jedyne miejsce, w którym
  //    moduł faktycznie wchodzi do aplikacji.
  if (!composition.includes(`@/modules/${name}/module`)) {
    errors.push(
      `src/modules/${name}/module.ts nie jest zaimportowany w src/lib/modules.tsx.\n` +
        "    Moduł istnieje na dysku i NIE istnieje w aplikacji — build przy tym pozostaje zielony,\n" +
        "    więc bez tej kontroli objawiłoby się to dopiero brakiem pozycji w menu.",
    );
  }
}

// ─── 5. Moduł pisany „po staremu" (048, AC-11 / domknięcie AC-6 z 046) ──────────────────
//
// Do tej pory bramka pilnowała tylko katalogów, które JUŻ są w `src/modules/`. Nie mogła
// pilnować czegoś odwrotnego — modułu rozsypanego po `src/actions/` i `src/components/` — bo
// dokładnie tak wyglądała większość aplikacji i reguła zapaliłaby się na całym istniejącym
// kodzie. Po fali 3 lista przejściowa jest pusta, więc kontrola staje się wykonalna.
//
// Zasada: identyfikator obecny w rejestrze nie może mieć kodu poza swoim katalogiem.
// Historycznie moduł mieszkał w TRZECH miejscach — `src/actions/<id>.ts`, `src/components/<id>/`
// **i `src/lib/<id>/`** — więc bramka musi patrzeć na wszystkie trzy. Recenzja 048 znalazła
// dokładnie tę lukę: `src/lib/tasks/` i `src/lib/shopping/` przetrwały falę, a `lib/tasks/access.ts`
// importowało **własny kontrakt modułu Zadania**, czyli obchodziło C-02 okrężną drogą przez alias.
const actionsDir = path.join(root, "src/actions");
const componentsDir = path.join(root, "src/components");
const libDir = path.join(root, "src/lib");

// 049: miejsca, w których wkład modułu NIE MA prawa mieszkać, i wzorzec nazwy, który go zdradza.
// Sprawdzamy nazwę pliku, nie treść: chodzi o wykrycie modułu pisanego „po staremu", a nie
// o audyt zawartości.
const WKLADY_POZA_MODULEM = [
  ["src/platform/ai", (f, id) => f === `${id}Executor.ts` || f === `${id}ReadTools.ts`],
  ["src/platform/jobs/handlers", (f, id) => f.toLowerCase().startsWith(id.toLowerCase()) && f !== "index.ts"],
  ["src/lib/ai", (f, id) => f === `${id}Executor.ts` || f === `${id}ReadTools.ts`],
];

// Świadome wyjątki: katalog nazwany jak moduł, ale z konsumentem SPOZA tego modułu — czyli kod
// realnie współdzielony, którego przeniesienie zamroziłoby przypadkowe sprzężenie (lekcja z 047:
// „plik należy do modułu, w którym umieszczają go jego KONSUMENCI, nie ten, który sugeruje nazwa").
// Każdy wyjątek wymaga powodu — bramka nie zgaduje, tylko żąda decyzji.
const SHARED_LIB_DIRS = {
  news: "rss.ts i webSearch.ts czyta warstwa zadań w tle (lib/jobs/handlers) oraz trasa agenta — obie poza modułem Wiadomości; wydzielenie ich to zadanie fazy „platforma ai/llm/jobs”.",
  health: "queryDiag.ts to diagnostyka zapytań do bazy, używana przez actions/systemHealth.ts (panel admina), nie przez moduł Zdrowie.",
  home: "dashboardSections.ts współdzielą modul Strona główna i przekrojowe actions/dashboardPrefs.ts (preferencje per użytkownik).",
};

for (const [id, dir] of ids) {
  const strays = [];
  const legacyAction = path.join(actionsDir, `${id}.ts`);
  const legacyComponents = path.join(componentsDir, id);
  const legacyLib = path.join(libDir, id);
  if (fs.existsSync(legacyAction)) strays.push(`src/actions/${id}.ts`);
  if (fs.existsSync(legacyComponents)) strays.push(`src/components/${id}/`);
  if (fs.existsSync(legacyLib) && !SHARED_LIB_DIRS[id]) strays.push(`src/lib/${id}/`);

  // 049: moduł opisuje się dziś czterema polami deklaracji (`ai`, `jobs`, `calendar`, `sideNav`).
  // Czwarte miejsce, w którym mógłby wylądować jego kod, to WARSTWY, z których te pola korzystają:
  // egzekutor asystenta, handler zadania czy wkład do kalendarza pod ścieżką platformową albo
  // kompozycyjną obchodzi granicę tak samo, jak obchodziło ją `src/actions/<id>.ts`.
  for (const [dir, wzor] of WKLADY_POZA_MODULEM) {
    const p = path.join(root, dir);
    if (!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p)) {
      if (wzor(f, id)) strays.push(`${dir}/${f}`);
    }
  }

  if (strays.length) {
    errors.push(
      `Moduł „${id}" ma kod POZA swoim katalogiem: ${strays.join(", ")}.\n` +
        `    Moduł mieszka w src/modules/${dir}/ — akcje w actions/, widoki w ui/, logika w lib/.\n` +
        "    Kod w starych miejscach omija granicę: reguła ESLint go nie pilnuje, więc każdy może\n" +
        "    go zaimportować bezpośrednio i sprzężenie znów stanie się niewidoczne.",
    );
  }
}

// ─── 6b. Wkład do pulpitu wpięty w swój korzeń kompozycji — W OBIE STRONY (050) ────────
//
// Wkłady pulpitu mają WŁASNY korzeń (`src/lib/dashboardContributors.ts`), a nie pole w
// `module.server.ts` — bo tamten obiekt jest plikiem zbiorczym leniwych loaderów i import dla
// jednego pola kosztuje grafem za wszystkie cztery (1889 → 2117 modułów na stronie głównej;
// pomiar w nagłówku korzenia). Cena tej decyzji: wpięcia nie widać w deklaracji modułu, więc
// pilnuje go bramka — inaczej `dashboard.ts` istniałby na dysku i nie istniał w aplikacji.
const dashRootPath = path.join(root, "src/lib/dashboardContributors.ts");
const dashRoot = fs.existsSync(dashRootPath) ? fs.readFileSync(dashRootPath, "utf8") : "";
const wpieteWkladyPulpitu = new Set(
  [...dashRoot.matchAll(/import\(["']@\/modules\/([^/"']+)\/dashboard["']\)/g)].map((m) => m[1]),
);

const majaWkladPulpitu = new Set(
  [...ids.keys()].filter((id) => fs.existsSync(path.join(modulesDir, id, "dashboard.ts"))),
);
for (const id of majaWkladPulpitu) {
  if (!wpieteWkladyPulpitu.has(id)) {
    errors.push(
      `src/modules/${id}/dashboard.ts nie jest wpięty w src/lib/dashboardContributors.ts.\n` +
        "    Wkład do migawki pulpitu istnieje na dysku i NIE istnieje w aplikacji — build zielony,\n" +
        "    a na stronie głównej po prostu brakuje danych tego modułu.",
    );
  }
}
for (const id of wpieteWkladyPulpitu) {
  if (!majaWkladPulpitu.has(id)) {
    errors.push(
      `src/lib/dashboardContributors.ts wpina „${id}", ale src/modules/${id}/dashboard.ts nie istnieje.\n` +
        "    Leniwy import wskazujący w próżnię wywala się dopiero przy renderze strony głównej.",
    );
  }
}

// ─── 6c. Deklaracja zasobow wpieta w swoj korzen — W OBIE STRONY (052) ────────────
//
// Jak przy wkladzie pulpitu: deklaracja zasobow ma wlasny korzen kompozycji
// (`src/lib/sharingResources.ts`), bo wspolny obiekt leniwych loaderow jest plikiem zbiorczym.
// Cena tej decyzji — wpiecia nie widac w deklaracji modulu — jest tu splacona bramka.
//
// Stawka jest wyzsza niz przy pulpicie: niewpieta deklaracja zasobow nie objawia sie brakiem
// danych, tylko ODMOWA DOSTEPU, czyli najbardziej mylacym z mozliwych objawow.
const sharingRootPath = path.join(root, "src/lib/sharingResources.ts");
const sharingRoot = fs.existsSync(sharingRootPath) ? fs.readFileSync(sharingRootPath, "utf8") : "";
const wpieteZasoby = new Set(
  [...sharingRoot.matchAll(/import\(["']@\/modules\/([^/"']+)\/sharing["']\)/g)].map((m) => m[1]),
);
const majaZasoby = new Set(
  [...ids.keys()].filter((id) => fs.existsSync(path.join(modulesDir, id, "sharing.ts"))),
);
for (const id of majaZasoby) {
  if (!wpieteZasoby.has(id)) {
    errors.push(
      `src/modules/${id}/sharing.ts nie jest wpiety w src/lib/sharingResources.ts.\n` +
        "    Deklaracja zasobow istnieje na dysku i NIE istnieje w aplikacji \u2014 a objawi sie to\n" +
        "    ODMOWA DOSTEPU do zasobow tego modulu, nie brakiem danych.",
    );
  }
}
for (const id of wpieteZasoby) {
  if (!majaZasoby.has(id)) {
    errors.push(
      `src/lib/sharingResources.ts wpina \u201e${id}", ale src/modules/${id}/sharing.ts nie istnieje.\n` +
        "    Leniwy import wskazujacy w prozanie wywali sie przy pierwszym sprawdzeniu dostepu.",
    );
  }
}

// ─── 7. Trasa pulpitu nie opisuje modułów „po staremu" (050, AC-9) ─────────────────────
//
// Do 050 `src/app/page.tsx` importowało osiem kontraktów modułów i miało dziesięć gałęzi na
// uprawnienia — było to OSTATNIE miejsce w aplikacji, w którym dodanie modułu wymagało edycji
// cudzego pliku. Dziś moduł deklaruje wkład u siebie (`module.server.ts` → `dashboard`), a trasa
// składa go z katalogu.
//
// Bez tej kontroli powrót do starego wzorca jest jedną linijką importu i buduje się na zielono —
// dokładnie tak, jak egzekutor asystenta poza modułem budował się na zielono przed kontrolą 5.
// Widok Strony głównej jest jedynym dozwolonym wyjątkiem: trasa musi coś wyrenderować.
const dashboardRoute = path.join(root, "src/app/page.tsx");
if (fs.existsSync(dashboardRoute)) {
  const zrodlo = fs.readFileSync(dashboardRoute, "utf8");
  const zakazane = [...zrodlo.matchAll(/from\s+["']@\/modules\/([^/"']+)(\/[^"']*)?["']/g)]
    .map((m) => ({ id: m[1], sciezka: `@/modules/${m[1]}${m[2] ?? ""}` }))
    .filter(({ id, sciezka }) => sciezka.endsWith("/contract") || id !== "home");

  if (zakazane.length) {
    errors.push(
      `Trasa pulpitu (src/app/page.tsx) sięga do modułów: ${zakazane.map((z) => z.sciezka).join(", ")}.\n` +
        "    Wkład modułu do migawki pulpitu deklaruje się w src/modules/<id>/dashboard.ts i wpina\n" +
        "    polem `dashboard` w module.server.ts — nie dopisuje się go do trasy.\n" +
        "    Dozwolony jest wyłącznie widok Strony głównej (@/modules/home/ui/...).",
    );
  }
}

if (errors.length) {
  console.error("\n✖ Rejestr modułów — niekompletne moduły w src/modules/:\n");
  console.error(errors.map((e) => `  ✖ ${e}`).join("\n\n"));
  console.error("");
  process.exit(1);
}

console.log(
  `✓ Rejestr modułów: ${dirs.length} modułów w src/modules — każdy z contract.ts, kompletną deklaracją, wpięciem w rejestr i bez kodu poza swoim katalogiem.`,
);
