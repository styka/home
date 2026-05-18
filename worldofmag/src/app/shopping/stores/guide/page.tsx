import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";

const C = {
  bgBase: "#0d0d0d",
  bgSurface: "#1a1a1a",
  bgElevated: "#242424",
  border: "#333333",
  textPrimary: "#ffffff",
  textSecondary: "#b0b0b0",
  textMuted: "#808080",
  green: "#16a34a",
  greenDim: "rgba(22,163,74,0.15)",
  greenLight: "#86efac",
  red: "#dc2626",
  yellow: "#ca8a04",
  blue: "#2563eb",
  blueDim: "rgba(37,99,235,0.15)",
  blueLight: "#93c5fd",
  orange: "#d97706",
  purple: "#7c3aed",
  teal: "#0891b2",
  edge: "#555555",
};

export default function StoreSortingGuidePage() {
  return (
    <div className="overflow-y-auto" style={{ backgroundColor: C.bgBase, minHeight: "100%", color: C.textPrimary }}>
      <div className="max-w-3xl mx-auto px-4 py-8 pb-20">

        <Link href="/shopping/stores" className="inline-flex items-center gap-1.5 text-sm mb-8" style={{ color: C.textMuted }}>
          <ArrowLeft size={14} />
          Mapy sklepów
        </Link>

        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-3">
            🗺️ Sortowanie zakupów według trasy w sklepie
          </h1>
          <p className="text-sm leading-7" style={{ color: C.textSecondary }}>
            Narysuj interaktywną mapę swojego sklepu — zaznacz wejście, kasę i działy z produktami,
            połącz je korytarzami podając odległości. Aplikacja wyliczy optymalną kolejność kategorii
            na liście zakupów, minimalizując całą trasę od wejścia do kasy.
          </p>
        </div>

        <div className="mb-12">
          <SectionTitle>Jak to działa?</SectionTitle>
          <OverviewSVG />
        </div>

        <Divider />

        <Step number={1} title="Utwórz mapę sklepu">
          <p className="text-sm leading-6 mb-5" style={{ color: C.textSecondary }}>
            Przejdź do <strong style={{ color: C.textPrimary }}>Mapy sklepów</strong> i wpisz nazwę sklepu,
            następnie kliknij <strong style={{ color: C.textPrimary }}>Dodaj</strong>. Możesz stworzyć osobną
            mapę dla każdego odwiedzanego regularnie sklepu.
          </p>
          <CreateStoreSVG />
        </Step>

        <Step number={2} title="Dodaj węzły na mapie">
          <p className="text-sm leading-6 mb-5" style={{ color: C.textSecondary }}>
            Otwórz edytor mapy i wybierz tryb{" "}
            <kbd style={{ padding: "2px 7px", borderRadius: 4, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, fontSize: 11, color: C.textSecondary }}>
              + Dodaj węzeł
            </kbd>.
            Klikaj na kanwę, aby umieszczać węzły. Każdy sklep potrzebuje jednego węzła
            START (wejście) i STOP (kasy). Resztę przypisz do kategorii produktów.
          </p>
          <NodeTypesSVG />
          <div className="mt-4"><MapEditorSVG /></div>
        </Step>

        <Step number={3} title="Połącz węzły ścieżkami">
          <p className="text-sm leading-6 mb-5" style={{ color: C.textSecondary }}>
            Wybierz tryb{" "}
            <kbd style={{ padding: "2px 7px", borderRadius: 4, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, fontSize: 11, color: C.textSecondary }}>
              ↔ Połącz
            </kbd>.
            Kliknij pierwszy węzeł — obramowanie zmieni się na niebieskie. Kliknij drugi węzeł
            i wpisz wagę krawędzi, czyli odległość między tymi punktami. Możesz używać kroków,
            sekund lub dowolnej spójnej jednostki.
          </p>
          <EdgeWeightSVG />
        </Step>

        <Step number={4} title="Sortuj listę zakupów według sklepu">
          <p className="text-sm leading-6 mb-5" style={{ color: C.textSecondary }}>
            Na liście zakupów kliknij przycisk{" "}
            <span className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: C.bgElevated, color: C.textSecondary, border: `1px solid ${C.border}` }}>
              ⇅ Sortuj
            </span>{" "}
            i wybierz sklep. Kategorie produktów zostaną ułożone w optymalnej kolejności.
            Sortowanie przelicza się automatycznie przy każdej zmianie listy.
          </p>
          <SortingSVG />
        </Step>

        <Divider />

        <div className="mb-10">
          <SectionTitle>Jak działa algorytm optymalizacji?</SectionTitle>
          <p className="text-sm leading-6 mb-5" style={{ color: C.textSecondary }}>
            Wyznaczenie najkrótszej trasy to klasyczny problem optymalizacji. Aplikacja rozwiązuje go w dwóch krokach:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <AlgoCard icon="⚡" title="Floyd-Warshall" desc="Oblicza najkrótsze ścieżki między wszystkimi parami węzłów w grafie korytarzy, uwzględniając tranzyt przez węzły pośrednie." />
            <AlgoCard icon="🧠" title="Held-Karp (wariant TSP)" desc="Wybiera optymalną kolejność odwiedzania wymaganych kategorii od wejścia do kasy, minimalizując łączną przebytą drogę." />
          </div>
          <AlgorithmSVG />
          <div className="mt-4 rounded-lg p-4 text-xs leading-6" style={{ backgroundColor: C.bgSurface, border: `1px solid ${C.border}`, color: C.textMuted }}>
            Kategorii, których nie masz na liście, nie musisz odwiedzać — chyba że przejście przez nie jest
            konieczne do osiągnięcia innego węzła najkrótszą drogą. Algorytm uwzględnia to automatycznie.
          </div>
        </div>

        <div className="mb-10">
          <SectionTitle>Wskazówki</SectionTitle>
          <div className="flex flex-col gap-2">
            {[
              { icon: "📐", tip: "Wagi krawędzi nie muszą być w metrach. Możesz liczyć korytarze: pierwsze przejście = 1, każde kolejne +1." },
              { icon: "🔀", tip: "Możesz dodać wiele węzłów tej samej kategorii, jeśli produkty danego typu leżą w kilku miejscach sklepu." },
              { icon: "🏪", tip: "Każdy sklep ma osobną mapę. Przełączaj się między nimi w menu sortowania na liście zakupów." },
              { icon: "💾", tip: "Każda zmiana na mapie jest zapisywana automatycznie — nie ma przycisku Zapisz." },
              { icon: "📱", tip: "Edytor działa na telefonie. Używaj trybu Zaznacz do przeciągania węzłów palcem." },
              { icon: "↔️", tip: "Krawędź usuniesz w trybie Usuń klikając w nią lub w etykietę z wagą." },
            ].map(({ icon, tip }) => (
              <div key={tip} className="flex gap-3 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: C.bgSurface, border: `1px solid ${C.border}` }}>
                <span className="flex-shrink-0">{icon}</span>
                <span style={{ color: C.textSecondary }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <Link href="/shopping/stores" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: C.green, color: "#fff" }}>
            🗺️ Otwórz Mapy sklepów
          </Link>
        </div>

      </div>
    </div>
  );
}

// ──── Layout helpers ───────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold mb-4" style={{ color: C.textPrimary }}>{children}</h2>;
}

function Divider() {
  return <hr className="mb-10" style={{ borderColor: C.border }} />;
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: C.green, color: "#fff" }}>
          {number}
        </span>
        <h2 className="text-base font-semibold" style={{ color: C.textPrimary }}>{title}</h2>
      </div>
      <div className="pl-10">{children}</div>
    </div>
  );
}

function AlgoCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: C.bgSurface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium" style={{ color: C.textPrimary }}>{title}</span>
      </div>
      <p className="text-xs leading-5" style={{ color: C.textSecondary }}>{desc}</p>
    </div>
  );
}

// ──── SVG Illustrations ────────────────────────────────────────────────────

function OverviewSVG() {
  return (
    <svg viewBox="0 0 760 170" className="w-full rounded-xl" style={{ display: "block" }}>
      <defs>
        <marker id="ov-arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#555" />
        </marker>
      </defs>

      {/* ── Panel 1: shopping list ── */}
      <rect x={0} y={10} width={218} height={150} rx={8} fill="#1a1a1a" stroke="#333" strokeWidth={1} />
      <text x={12} y={30} fontSize={11} fontWeight="bold" fill="#fff">Lista zakupów</text>
      <line x1={8} y1={36} x2={210} y2={36} stroke="#333" strokeWidth={1} />
      {[
        { t: "mleko", c: "#ca8a04" }, { t: "jabłka", c: "#16a34a" },
        { t: "ser żółty", c: "#ca8a04" }, { t: "chleb", c: "#d97706" },
        { t: "chipsy", c: "#c026d3" },
      ].map(({ t, c }, i) => (
        <g key={t}>
          <rect x={12} y={44 + i * 20} width={11} height={11} rx={2} fill="#242424" stroke="#555" strokeWidth={1} />
          <circle cx={17} cy={49 + i * 20} r={3} fill={c} />
          <text x={30} y={55 + i * 20} fontSize={10} fill="#b0b0b0">{t}</text>
        </g>
      ))}

      {/* ── Arrow 1 ── */}
      <line x1={226} y1={85} x2={258} y2={85} stroke="#555" strokeWidth={1.5} markerEnd="url(#ov-arr)" />
      <text x={242} y={79} textAnchor="middle" fontSize={8} fill="#808080">mapa</text>
      <text x={242} y={96} textAnchor="middle" fontSize={8} fill="#808080">sklepu</text>

      {/* ── Panel 2: map ── */}
      <rect x={270} y={10} width={218} height={150} rx={8} fill="#1a1a1a" stroke="#333" strokeWidth={1} />
      <text x={282} y={30} fontSize={11} fontWeight="bold" fill="#fff">Mapa sklepu</text>
      <line x1={278} y1={36} x2={480} y2={36} stroke="#333" strokeWidth={1} />

      {/* edges */}
      {[
        [307, 95, 348, 73], [364, 73, 398, 73], [362, 81, 380, 108],
        [414, 81, 428, 106], [396, 116, 422, 116],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#555" strokeWidth={1.5} />
      ))}

      {/* nodes */}
      <circle cx={297} cy={95} r={17} fill="#16a34a" />
      <text x={297} y={101} textAnchor="middle" fontSize={15}>🚪</text>
      <circle cx={356} cy={73} r={14} fill="#ca8a04" />
      <text x={356} y={78} textAnchor="middle" fontSize={12}>🧀</text>
      <circle cx={406} cy={73} r={14} fill="#d97706" />
      <text x={406} y={78} textAnchor="middle" fontSize={12}>🍞</text>
      <circle cx={380} cy={118} r={14} fill="#2563eb" />
      <text x={380} y={123} textAnchor="middle" fontSize={12}>🍺</text>
      <circle cx={436} cy={116} r={17} fill="#dc2626" />
      <text x={436} y={122} textAnchor="middle" fontSize={15}>🛒</text>

      <text x={282} y={152} fontSize={8} fill="#808080">🚪 wejście  ·  węzły kategorii  ·  🛒 kasy</text>

      {/* ── Arrow 2 ── */}
      <line x1={496} y1={85} x2={528} y2={85} stroke="#555" strokeWidth={1.5} markerEnd="url(#ov-arr)" />
      <text x={512} y={79} textAnchor="middle" fontSize={8} fill="#808080">trasa</text>
      <text x={512} y={96} textAnchor="middle" fontSize={8} fill="#808080">optymalna</text>

      {/* ── Panel 3: sorted ── */}
      <rect x={540} y={10} width={218} height={150} rx={8} fill="#1a1a1a" stroke="#333" strokeWidth={1} />
      <text x={552} y={30} fontSize={11} fontWeight="bold" fill="#fff">Optymalna kolejność</text>
      <line x1={548} y1={36} x2={750} y2={36} stroke="#333" strokeWidth={1} />
      {[
        { n: "1", cat: "Nabiał & Jajka", c: "#ca8a04" },
        { n: "2", cat: "Piekarnia", c: "#d97706" },
        { n: "3", cat: "Napoje", c: "#2563eb" },
        { n: "4", cat: "Przekąski", c: "#c026d3" },
      ].map(({ n, cat, c }, i) => (
        <g key={cat}>
          <rect x={548} y={44 + i * 26} width={204} height={20} rx={4}
            fill={i === 0 ? "rgba(22,163,74,0.12)" : "#242424"}
            stroke={i === 0 ? "#16a34a" : "#333"} strokeWidth={i === 0 ? 1 : 0.5}
          />
          <circle cx={562} cy={54 + i * 26} r={5} fill={c} />
          <text x={574} y={58 + i * 26} fontSize={10} fill={i === 0 ? "#86efac" : "#b0b0b0"}>
            {n}. {cat}
          </text>
        </g>
      ))}
    </svg>
  );
}

function CreateStoreSVG() {
  return (
    <svg viewBox="0 0 680 120" className="w-full rounded-xl" style={{ display: "block" }}>
      <rect x={0} y={0} width={680} height={120} rx={10} fill="#1a1a1a" stroke="#333" strokeWidth={1} />

      {/* header */}
      <text x={16} y={22} fontSize={10} fill="#808080">← Zakupy</text>
      <text x={80} y={22} fontSize={12} fontWeight="bold" fill="#fff">Mapy sklepów</text>
      <line x1={0} y1={28} x2={680} y2={28} stroke="#333" strokeWidth={1} />

      {/* new store form */}
      <rect x={16} y={38} width={500} height={32} rx={6} fill="#242424" stroke="#333" strokeWidth={1} />
      <text x={28} y={59} fontSize={11} fill="#fff">Biedronka</text>
      <rect x={524} y={38} width={68} height={32} rx={6} fill="#16a34a" />
      <text x={558} y={59} textAnchor="middle" fontSize={11} fontWeight="600" fill="#fff">+ Dodaj</text>

      {/* existing store item */}
      <rect x={16} y={80} width={646} height={32} rx={6} fill="#242424" stroke="#333" strokeWidth={1} />
      <text x={28} y={100} fontSize={11} fontWeight="500" fill="#fff">Lidl</text>
      <text x={28} y={110} fontSize={9} fill="#808080">8 węzłów · 9 krawędzi</text>

      {/* edit button */}
      <rect x={536} y={88} width={118} height={20} rx={4} fill="#2f2f2f" stroke="#333" strokeWidth={1} />
      <text x={595} y={102} textAnchor="middle" fontSize={9} fill="#b0b0b0">🗺 Edytuj mapę</text>

      {/* tooltips / annotations */}
      <line x1={460} y1={20} x2={558} y2={32} stroke="#16a34a" strokeWidth={1} strokeDasharray="3 2" />
      <text x={342} y={18} fontSize={9} fill="#16a34a">wpisz nazwę i kliknij Dodaj</text>
    </svg>
  );
}

function NodeTypesSVG() {
  const nodes = [
    { cx: 80,  label: "START", sublabel: "Wejście do sklepu", emoji: "🚪", fill: "#16a34a", desc: "Jeden na sklep. Punkt startowy trasy." },
    { cx: 290, label: "CATEGORY", sublabel: "Kategoria produktów", emoji: "🥕", fill: "#16a34a", desc: "Miejsce na mapie gdzie leżą produkty danej kategorii." },
    { cx: 500, label: "STOP", sublabel: "Kasy", emoji: "🛒", fill: "#dc2626", desc: "Jeden na sklep. Punkt końcowy trasy." },
  ];

  return (
    <svg viewBox="0 0 600 130" className="w-full rounded-xl" style={{ display: "block" }}>
      <rect x={0} y={0} width={600} height={130} rx={10} fill="#1a1a1a" stroke="#333" strokeWidth={1} />

      {nodes.map(({ cx, label, sublabel, emoji, fill, desc }) => (
        <g key={label}>
          <circle cx={cx} cy={42} r={24} fill={fill} fillOpacity={0.9} />
          <text x={cx} y={48} textAnchor="middle" fontSize={20}>{emoji}</text>
          <text x={cx} y={80} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#fff">{label}</text>
          <text x={cx} y={94} textAnchor="middle" fontSize={9} fill="#808080">{sublabel}</text>
          <text x={cx} y={113} textAnchor="middle" fontSize={9} fill="#b0b0b0" style={{ maxWidth: 160 }}>{desc}</text>
        </g>
      ))}

      {/* dividers */}
      <line x1={190} y1={20} x2={190} y2={110} stroke="#333" strokeWidth={1} />
      <line x1={400} y1={20} x2={400} y2={110} stroke="#333" strokeWidth={1} />
    </svg>
  );
}

function MapEditorSVG() {
  // nodes
  const start  = { cx: 100, cy: 210, fill: "#16a34a", emoji: "🚪", label: "Wejście" };
  const dairy  = { cx: 215, cy: 140, fill: "#ca8a04", emoji: "🧀", label: "Nabiał" };
  const bakery = { cx: 360, cy: 105, fill: "#d97706", emoji: "🍞", label: "Piekarnia" };
  const snacks = { cx: 350, cy: 215, fill: "#c026d3", emoji: "🍫", label: "Przekąski" };
  const drinks = { cx: 490, cy: 155, fill: "#2563eb", emoji: "🍺", label: "Napoje" };
  const stop   = { cx: 600, cy: 200, fill: "#dc2626", emoji: "🛒", label: "Kasy" };

  const edges: [number, number, number, number, string][] = [
    [start.cx,  start.cy,  dairy.cx,  dairy.cy,  "3"],
    [start.cx,  start.cy,  snacks.cx, snacks.cy, "5"],
    [dairy.cx,  dairy.cy,  bakery.cx, bakery.cy, "2"],
    [dairy.cx,  dairy.cy,  snacks.cx, snacks.cy, "2"],
    [bakery.cx, bakery.cy, drinks.cx, drinks.cy, "3"],
    [snacks.cx, snacks.cy, drinks.cx, drinks.cy, "2"],
    [drinks.cx, drinks.cy, stop.cx,   stop.cy,   "2"],
    [snacks.cx, snacks.cy, stop.cx,   stop.cy,   "4"],
  ];

  const allNodes = [start, dairy, bakery, snacks, drinks, stop];

  return (
    <svg viewBox="0 0 720 290" className="w-full rounded-xl" style={{ display: "block" }}>
      {/* toolbar */}
      <rect x={0} y={0} width={720} height={42} rx={0} fill="#1a1a1a" />
      <rect x={0} y={41} width={720} height={1} fill="#333" />
      {[
        { x: 8,   w: 88,  label: "⊹ Zaznacz",     active: true },
        { x: 102, w: 108, label: "+ Dodaj węzeł",  active: false },
        { x: 216, w: 76,  label: "⇌ Połącz",       active: false },
        { x: 298, w: 60,  label: "🗑 Usuń",         active: false },
      ].map(({ x, w, label, active }) => (
        <g key={label}>
          <rect x={x} y={6} width={w} height={30} rx={5}
            fill={active ? "#2f2f2f" : "transparent"}
            stroke={active ? "#555" : "transparent"} strokeWidth={1}
          />
          <text x={x + w / 2} y={25} textAnchor="middle" fontSize={10}
            fill={active ? "#fff" : "#808080"}>{label}</text>
        </g>
      ))}
      <text x={450} y={25} fontSize={9} fill="#555">Przeciągnij węzeł, aby go przenieść</text>

      {/* canvas background */}
      <rect x={0} y={42} width={720} height={248} fill="#0d0d0d" />
      <defs>
        <pattern id="me-grid" width="35" height="35" patternUnits="userSpaceOnUse">
          <circle cx="17" cy="17" r="1" fill="#333" opacity="0.5" />
        </pattern>
      </defs>
      <rect x={0} y={42} width={720} height={248} fill="url(#me-grid)" />

      {/* edges */}
      {edges.map(([x1, y1, x2, y2, w], i) => {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#555" strokeWidth={2} />
            <rect x={mx - 10} y={my - 8} width={20} height={16} rx={3} fill="#242424" stroke="#444" strokeWidth={1} />
            <text x={mx} y={my + 5} textAnchor="middle" fontSize={9} fill="#b0b0b0">{w}</text>
          </g>
        );
      })}

      {/* nodes */}
      {allNodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.cx} cy={n.cy} r={22} fill={n.fill} fillOpacity={0.9} />
          <text x={n.cx} y={n.cy + 7} textAnchor="middle" fontSize={17}>{n.emoji}</text>
          <text x={n.cx} y={n.cy + 34} textAnchor="middle" fontSize={10} fill="#b0b0b0">{n.label}</text>
        </g>
      ))}

      {/* legend */}
      <rect x={8} y={50} width={132} height={64} rx={6} fill="#1a1a1a" fillOpacity={0.9} stroke="#333" strokeWidth={1} />
      <circle cx={22} cy={66} r={6} fill="#16a34a" />
      <text x={34} y={70} fontSize={9} fill="#b0b0b0">Wejście (START)</text>
      <circle cx={22} cy={83} r={6} fill="#dc2626" />
      <text x={34} y={87} fontSize={9} fill="#b0b0b0">Kasy (STOP)</text>
      <circle cx={22} cy={100} r={6} fill="#808080" />
      <text x={34} y={104} fontSize={9} fill="#b0b0b0">Kategoria</text>
    </svg>
  );
}

function EdgeWeightSVG() {
  return (
    <svg viewBox="0 0 620 185" className="w-full rounded-xl" style={{ display: "block" }}>
      <rect x={0} y={0} width={620} height={185} rx={10} fill="#0d0d0d" stroke="#333" strokeWidth={1} />
      <defs>
        <pattern id="ew-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="15" cy="15" r="1" fill="#333" opacity="0.4" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={620} height={185} fill="url(#ew-grid)" rx={10} />

      {/* node A - Dairy */}
      <circle cx={160} cy={92} r={24} fill="#ca8a04" fillOpacity={0.9} />
      <text x={160} y={99} textAnchor="middle" fontSize={20}>🧀</text>
      <text x={160} y={128} textAnchor="middle" fontSize={10} fill="#b0b0b0">Nabiał</text>

      {/* node B - Bakery - selected as edge-end */}
      <circle cx={390} cy={92} r={30} fill="none" stroke="#60a5fa" strokeWidth={2} strokeDasharray="5 3" />
      <circle cx={390} cy={92} r={24} fill="#d97706" fillOpacity={0.9} />
      <text x={390} y={99} textAnchor="middle" fontSize={20}>🍞</text>
      <text x={390} y={128} textAnchor="middle" fontSize={10} fill="#b0b0b0">Piekarnia</text>

      {/* dashed connecting line */}
      <line x1={184} y1={92} x2={366} y2={92} stroke="#60a5fa" strokeWidth={2} strokeDasharray="7 5" />

      {/* weight dialog */}
      <rect x={420} y={48} width={175} height={90} rx={8} fill="#242424" stroke="#333" strokeWidth={1}
        style={{ filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.6))" }} />
      <text x={434} y={68} fontSize={11} fontWeight="bold" fill="#fff">Waga krawędzi</text>
      <text x={434} y={82} fontSize={9} fill="#808080">Nabiał → Piekarnia</text>
      <rect x={434} y={90} width={147} height={22} rx={4} fill="#1a1a1a" stroke="#555" strokeWidth={1} />
      <text x={444} y={105} fontSize={11} fill="#fff">3</text>
      <rect x={434} y={120} width={68} height={20} rx={4} fill="#2563eb" />
      <text x={468} y={133} textAnchor="middle" fontSize={10} fontWeight="600" fill="#fff">Połącz</text>
      <rect x={508} y={120} width={68} height={20} rx={4} fill="#2f2f2f" />
      <text x={542} y={133} textAnchor="middle" fontSize={10} fill="#b0b0b0">Anuluj</text>

      {/* annotation arrow */}
      <line x1={415} y1={92} x2={505} y2={92} stroke="#444" strokeWidth={1} strokeDasharray="2 2" />
    </svg>
  );
}

function SortingSVG() {
  const categories = [
    { cat: "Nabiał & Jajka", c: "#ca8a04", n: "1", items: ["mleko", "ser żółty"] },
    { cat: "Piekarnia",       c: "#d97706", n: "2", items: ["chleb"] },
    { cat: "Napoje",          c: "#2563eb", n: "3", items: ["piwo"] },
    { cat: "Przekąski",       c: "#c026d3", n: "4", items: ["chipsy"] },
  ];

  return (
    <svg viewBox="0 0 720 280" className="w-full rounded-xl" style={{ display: "block" }}>
      <rect x={0} y={0} width={720} height={280} rx={10} fill="#1a1a1a" stroke="#333" strokeWidth={1} />

      {/* Header bar */}
      <rect x={0} y={0} width={720} height={40} rx={0} fill="#1a1a1a" />
      <rect x={0} y={39} width={720} height={1} fill="#333" />
      <text x={14} y={25} fontSize={12} fontWeight="bold" fill="#fff">Lista zakupów</text>

      {/* Sort button (closed) */}
      <rect x={560} y={10} width={108} height={22} rx={5} fill="#242424" stroke="#333" strokeWidth={1} />
      <text x={614} y={25} textAnchor="middle" fontSize={10} fill="#b0b0b0">⇅ 🏪 Biedronka</text>

      {/* Dropdown open */}
      <rect x={560} y={34} width={150} height={110} rx={6} fill="#242424" stroke="#444" strokeWidth={1}
        style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.5))" }} />
      {[
        { l: "Kategoria A-Z", active: false },
        { l: "Produkt A-Z",   active: false },
        { l: "───────────",   active: false, sep: true },
        { l: "🏪 Biedronka",  active: true },
        { l: "🏪 Lidl",       active: false },
      ].map(({ l, active, sep }, i) => (
        sep ? (
          <line key={i} x1={568} y1={68 + i * 18} x2={702} y2={68 + i * 18} stroke="#444" strokeWidth={1} />
        ) : (
          <g key={l}>
            {active && <rect x={560} y={57 + i * 18} width={150} height={18} fill="rgba(255,255,255,0.06)" />}
            <text x={572} y={70 + i * 18} fontSize={10}
              fill={active ? "#fff" : "#b0b0b0"}
              fontWeight={active ? "600" : "normal"}>
              {l}
            </text>
            {active && <text x={697} y={70 + i * 18} textAnchor="end" fontSize={9} fill="#16a34a">✓</text>}
          </g>
        )
      ))}

      {/* Sorted list */}
      {categories.map(({ cat, c, n, items }, gi) => (
        <g key={cat}>
          {/* Category header */}
          <rect x={10} y={52 + gi * 56} width={535} height={18} rx={3} fill="#242424" />
          <circle cx={24} cy={61 + gi * 56} r={5} fill={c} />
          <text x={35} y={65 + gi * 56} fontSize={10} fill="#808080">
            {n}. {cat}
          </text>
          <text x={530} y={65 + gi * 56} textAnchor="end" fontSize={9} fill="#555">
            {items.length}/{items.length}
          </text>
          {/* Items */}
          {items.map((item, ii) => (
            <g key={item}>
              <rect x={10} y={72 + gi * 56 + ii * 20} width={535} height={18} rx={0}
                fill={ii % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)"} />
              <rect x={22} y={76 + gi * 56 + ii * 20} width={13} height={13} rx={2} fill="#2f2f2f" stroke="#555" strokeWidth={1} />
              <text x={42} y={87 + gi * 56 + ii * 20} fontSize={10} fill="#b0b0b0">{item}</text>
            </g>
          ))}
        </g>
      ))}

      {/* Annotation */}
      <text x={614} y={155} textAnchor="middle" fontSize={9} fill="#16a34a">sortowanie</text>
      <text x={614} y={167} textAnchor="middle" fontSize={9} fill="#16a34a">aktywne ✓</text>
    </svg>
  );
}

function AlgorithmSVG() {
  // A small graph showing optimal path highlighted
  // Nodes: S(start), A, B, C, D, E(stop)
  const S = { cx: 60,  cy: 110, fill: "#16a34a", emoji: "🚪" };
  const A = { cx: 180, cy: 60,  fill: "#ca8a04", emoji: "🧀" };
  const B = { cx: 300, cy: 40,  fill: "#d97706", emoji: "🍞" };
  const C_ = { cx: 280, cy: 145, fill: "#2563eb", emoji: "🍺" };
  const D = { cx: 430, cy: 90,  fill: "#c026d3", emoji: "🍫" };
  const E = { cx: 560, cy: 110, fill: "#dc2626", emoji: "🛒" };

  const allEdges: [number, number, number, number, number, boolean][] = [
    [S.cx, S.cy, A.cx, A.cy, 2, true],
    [S.cx, S.cy, C_.cx, C_.cy, 5, false],
    [A.cx, A.cy, B.cx, B.cy, 2, true],
    [A.cx, A.cy, C_.cx, C_.cy, 3, false],
    [B.cx, B.cy, D.cx, D.cy, 2, true],
    [B.cx, B.cy, C_.cx, C_.cy, 4, false],
    [C_.cx, C_.cy, D.cx, D.cy, 3, false],
    [D.cx, D.cy, E.cx, E.cy, 2, true],
    [C_.cx, C_.cy, E.cx, E.cy, 5, false],
  ];

  const allNodes = [S, A, B, C_, D, E];
  const emojis = ["🚪", "🧀", "🍞", "🍺", "🍫", "🛒"];
  const labels = ["START", "Nabiał", "Piekarnia", "Napoje", "Przekąski", "STOP"];
  const optLabels = ["", "1", "2", "", "3", ""];

  return (
    <svg viewBox="0 0 640 220" className="w-full rounded-xl" style={{ display: "block" }}>
      <rect x={0} y={0} width={640} height={220} rx={10} fill="#0d0d0d" stroke="#333" strokeWidth={1} />

      {/* gray non-optimal edges first */}
      {allEdges.filter(e => !e[5]).map(([x1, y1, x2, y2], i) => (
        <line key={`gray-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a2a2a" strokeWidth={1.5} />
      ))}

      {/* blue optimal edges */}
      {allEdges.filter(e => e[5]).map(([x1, y1, x2, y2, w], i) => {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={`opt-${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2563eb" strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 0 3px #2563eb)" }} />
            <rect x={mx - 9} y={my - 7} width={18} height={14} rx={3} fill="#1a2a4a" stroke="#3b82f6" strokeWidth={1} />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={9} fill="#93c5fd">{w}</text>
          </g>
        );
      })}

      {/* gray edge weights */}
      {allEdges.filter(e => !e[5]).map(([x1, y1, x2, y2, w], i) => {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={`gw-${i}`}>
            <rect x={mx - 8} y={my - 6} width={16} height={12} rx={2} fill="#1a1a1a" />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={9} fill="#555">{w}</text>
          </g>
        );
      })}

      {/* nodes */}
      {allNodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.cx} cy={n.cy} r={22} fill={n.fill} fillOpacity={0.9} />
          <text x={n.cx} y={n.cy + 7} textAnchor="middle" fontSize={17}>{emojis[i]}</text>
          {optLabels[i] && (
            <circle cx={n.cx + 18} cy={n.cy - 18} r={9} fill="#16a34a" />
          )}
          {optLabels[i] && (
            <text x={n.cx + 18} y={n.cy - 14} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#fff">
              {optLabels[i]}
            </text>
          )}
          <text x={n.cx} y={n.cy + 36} textAnchor="middle" fontSize={9} fill="#808080">{labels[i]}</text>
        </g>
      ))}

      {/* legend */}
      <line x1={430} y1={170} x2={470} y2={170} stroke="#2563eb" strokeWidth={2.5} />
      <text x={478} y={174} fontSize={9} fill="#93c5fd">optymalna trasa (łącznie: 8)</text>
      <line x1={430} y1={187} x2={470} y2={187} stroke="#2a2a2a" strokeWidth={1.5} />
      <text x={478} y={191} fontSize={9} fill="#555">inne ścieżki</text>
      <text x={430} y={208} fontSize={8} fill="#808080">Held-Karp wybiera najkrótszą permutację węzłów</text>
    </svg>
  );
}
