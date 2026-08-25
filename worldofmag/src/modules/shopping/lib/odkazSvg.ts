/**
 * 101 (AC-9) — ODKAŻANIE TREŚCI IKONY KATEGORII.
 *
 * **Po co to istnieje.** `saveAndActivateCategoryIcon` przyjmuje treść ikony od dowolnego
 * zalogowanego użytkownika, a `IconDisplay` wstrzykuje ją do drzewa dokumentu. Gdyby na tym się
 * kończyło, byłby to autogol na własnej bramce — ale `getActiveCategoryIconMap` zwraca **także ikony
 * zespołów**, więc treść zapisana przez jedną osobę renderuje się w przeglądarce **drugiej**. To jest
 * granica, na której kończy się „własne dane", a zaczyna cudza sesja.
 *
 * **Dlaczego biała lista, a nie czarna.** Czarna lista wymaga znajomości wszystkich sposobów
 * wykonania kodu w SVG — a tych jest więcej, niż się wydaje: nie tylko `<script>` (który przy
 * wstawianiu przez `innerHTML` i tak się nie wykona), ale `onload` na dowolnym kształcie,
 * `<animate onbegin>`, `<set onbegin>` czy `<image href=x onerror>`. Każdy nowy element SVG
 * w przyszłej przeglądarce dokłada się do tej listy. Biała lista odwraca ciężar dowodu: przechodzi
 * **tylko** to, co wypisaliśmy, a rzeczy nieznane odpadają same.
 *
 * **Czysta funkcja, zero zależności.** Ten plik importuje `IconDisplay` — komponent **kliencki** —
 * więc nie wolno tu niczego z `node:` (wymóg `check:client-safe`). Nie ma tu też `DOMParser`:
 * odkażamy po obu stronach, a na serwerze tej klasy nie ma.
 *
 * **Przynależność (C-36):** konsumentami są wyłącznie `ui/IconDisplay.tsx` i
 * `actions/categoryIcons.ts` — oba w module Shopping, więc plik należy do modułu, nie do platformy.
 */

/** Elementy rysunkowe, które przepuszczamy. Wszystko spoza tego zbioru znika. */
const DOZWOLONE_ELEMENTY = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
]);

/**
 * Elementy usuwane **razem z treścią**, a nie tylko ze znacznikiem. Rozróżnienie jest istotne:
 * samo skasowanie `<script>` i `</script>` zostawiłoby ich zawartość jako tekst, a przy
 * `<animate>` — jako kolejne znaczniki do interpretacji.
 */
const ELEMENTY_USUWANE_Z_TRESCIA = [
  "script",
  "style",
  "foreignObject",
  "animate",
  "animateTransform",
  "animateMotion",
  "set",
  "use",
  "image",
  "a",
  "switch",
  "handler",
  "listener",
  "iframe",
  "object",
  "embed",
];

/**
 * Atrybuty geometryczne i prezentacyjne. Świadomie **nie ma** tu `style`, `id`, `class`, `href`
 * ani `xlink:href`: pierwsze trzy są drogą do cudzych reguł stylu i do celowania w cudze elementy,
 * dwa ostatnie — do zasobu spoza dokumentu.
 */
const DOZWOLONE_ATRYBUTY = new Set([
  // geometria
  "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
  "width", "height", "points", "transform", "viewbox", "preserveaspectratio",
  // prezentacja
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stroke-miterlimit",
  "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke-opacity",
  "color", "vector-effect", "shape-rendering",
]);

/**
 * Wartość atrybutu bezpieczna, gdy nie próbuje wyjść poza samą siebie. `url(` odpada, bo jedyne
 * elementy, które mogłyby być jego celem (gradienty, wzory, maski), i tak nie przechodzą białej
 * listy — więc odwołanie zawsze wskazywałoby coś spoza dokumentu albo nic.
 */
function bezpiecznaWartosc(wartosc: string): boolean {
  const w = wartosc.toLowerCase();
  return !(
    w.includes("javascript:") ||
    w.includes("data:") ||
    w.includes("url(") ||
    w.includes("<") ||
    w.includes("&#")
  );
}

/** Przepisuje atrybuty znacznika, zostawiając wyłącznie dozwolone o bezpiecznej wartości. */
function odkazAtrybuty(surowe: string): string {
  const wynik: string[] = [];
  const re = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(surowe)) !== null) {
    const nazwa = m[1].toLowerCase();
    const wartosc = m[3] ?? m[4] ?? m[5] ?? "";
    // Podwójne zabezpieczenie: biała lista i tak nie zawiera żadnego `on*`, ale gdyby ktoś kiedyś
    // dopisał do niej atrybut przez pomyłkę, ten warunek nadal trzyma.
    if (nazwa.startsWith("on")) continue;
    if (!DOZWOLONE_ATRYBUTY.has(nazwa)) continue;
    if (!bezpiecznaWartosc(wartosc)) continue;
    wynik.push(` ${nazwa}="${wartosc.replace(/"/g, "&quot;")}"`);
  }
  return wynik.join("");
}

/**
 * Zwraca treść ikony pozbawioną wszystkiego, co nie jest rysunkiem.
 *
 * Kierunek błędu jest celowy: przy treści, której nie da się jednoznacznie rozebrać, **odrzucamy**.
 * Zepsuta ikona jest widoczna od razu i da się ją poprawić; przepuszczony ładunek nie jest widoczny
 * wcale.
 */
export function odkazSvg(tresc: string | null | undefined): string {
  if (!tresc) return "";
  let s = tresc;

  // 1. Komentarze, sekcje CDATA, instrukcje przetwarzania i deklaracje typu dokumentu.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  s = s.replace(/<[?!][^>]*>/g, "");

  // 2. Elementy niebezpieczne — razem z treścią, w obu formach zapisu.
  for (const el of ELEMENTY_USUWANE_Z_TRESCIA) {
    s = s.replace(new RegExp(`<\\s*${el}\\b[\\s\\S]*?<\\s*\\/\\s*${el}\\s*>`, "gi"), "");
    s = s.replace(new RegExp(`<\\s*${el}\\b[^>]*?\\/?>`, "gi"), "");
  }

  // 3. Pozostałe znaczniki przepisujemy po nazwie i atrybucie; nieznane znikają.
  s = s.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*?)(\/?)\s*>/g,
    (_dopasowanie, zamykajacy: string, nazwa: string, atrybuty: string, samozamykajacy: string) => {
      const n = nazwa.toLowerCase();
      if (!DOZWOLONE_ELEMENTY.has(n)) return "";
      if (zamykajacy) return `</${n}>`;
      return `<${n}${odkazAtrybuty(atrybuty)}${samozamykajacy ? "/" : ""}>`;
    }
  );

  return s;
}

/**
 * Czy treść wolno wyświetlić jako obrazek `data:`. Rastry są bezpieczne — `data:image/svg+xml`
 * **nie**, bo to ta sama treść co wyżej, tylko innym wejściem.
 */
export function bezpiecznyObrazekData(tresc: string): boolean {
  return /^data:image\/(png|jpe?g|gif|webp|avif);/i.test(tresc.trim());
}
