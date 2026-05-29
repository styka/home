"use client";

/**
 * Lekki wykres liniowy (SVG, bez zależności) w ciemnym motywie.
 * Używany w Portfelu (saldo w czasie) i Flocie (zużycie paliwa).
 */

export interface LinePoint {
  x: number; // np. timestamp (ms) lub indeks
  y: number;
  label?: string; // etykieta po najechaniu/osi
}

interface LineChartProps {
  points: LinePoint[];
  height?: number;
  color?: string;
  fill?: boolean;
  formatY?: (y: number) => string;
}

export function LineChart({
  points,
  height = 160,
  color = "var(--accent-blue)",
  fill = true,
  formatY = (y) => String(Math.round(y)),
}: LineChartProps) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs rounded"
        style={{ height, color: "var(--text-muted)", border: "1px dashed var(--border)" }}
      >
        Brak danych do wykresu
      </div>
    );
  }

  const W = 600; // wewnętrzna szerokość viewBox (skaluje się responsywnie)
  const H = height;
  const padX = 8;
  const padY = 14;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const px = (x: number) => padX + ((x - minX) / spanX) * (W - 2 * padX);
  const py = (y: number) => padY + (1 - (y - minY) / spanY) * (H - 2 * padY);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join(" ");
  const area =
    `M ${px(points[0].x).toFixed(1)} ${py(minY < 0 ? 0 : minY).toFixed(1)} ` +
    points.map((p) => `L ${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join(" ") +
    ` L ${px(points[points.length - 1].x).toFixed(1)} ${py(minY < 0 ? 0 : minY).toFixed(1)} Z`;

  const zeroY = py(0);

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img">
        {/* linia zera */}
        {minY < 0 && (
          <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
        )}
        {fill && <path d={area} fill={color} fillOpacity={0.12} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={px(p.x)} cy={py(p.y)} r={2.5} fill={color}>
            {p.label && <title>{`${p.label}: ${formatY(p.y)}`}</title>}
          </circle>
        ))}
      </svg>
      <div className="flex justify-between mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span>{points[0].label ?? formatY(points[0].y)}</span>
        <span>{points[points.length - 1].label ?? formatY(points[points.length - 1].y)}</span>
      </div>
    </div>
  );
}
