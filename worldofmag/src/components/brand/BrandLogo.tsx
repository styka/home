"use client";

import { useId } from "react";
import { IS_PROD } from "@/lib/appName";
import { depthRings, brandColors } from "@/lib/brandLogo";

// Znak marki „pierścienie głębi": koncentryczne okręgi cieńsze i gęstsze ku środkowi,
// z malejącą przezroczystością (efekt tunelu). Tło przezroczyste. Kolor zależny od
// środowiska (prod = gradient indygo→fiolet, dev = cyjan), chyba że `prod` wymuszone.
export function BrandLogo({ px = 22, prod }: { px?: number; prod?: boolean }) {
  const rawId = useId();
  const id = `brandGrad-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const isProd = prod ?? IS_PROD;
  const colors = brandColors(isProd);
  const stroke = colors.kind === "gradient" ? `url(#${id})` : colors.color;
  const rings = depthRings();

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Logo"
      style={{ display: "block", flexShrink: 0 }}
    >
      {colors.kind === "gradient" && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colors.from} />
            <stop offset="1" stopColor={colors.to} />
          </linearGradient>
        </defs>
      )}
      <g fill="none" strokeLinecap="round">
        {rings.map((ring, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={ring.r}
            stroke={stroke}
            strokeWidth={ring.sw}
            strokeOpacity={ring.opacity}
          />
        ))}
      </g>
    </svg>
  );
}
