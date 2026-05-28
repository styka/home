"use client";

import { useId } from "react";
import { IS_PROD } from "@/lib/appName";
import { BRAND_VARIANTS, brandTileGradient } from "@/lib/brandVariants";

// Znak marki jako kafel gradientowy + biały kształt. Kolor zależny od środowiska
// (prod = indygo→fiolet, dev = szarość), chyba że `prod` wymuszone propsem.
export function BrandLogo({
  variant = 0,
  px = 22,
  prod,
}: {
  variant?: number;
  px?: number;
  prod?: boolean;
}) {
  const rawId = useId();
  const id = `brand-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const isProd = prod ?? IS_PROD;
  const g = brandTileGradient(isProd);
  const inner = BRAND_VARIANTS[((variant % BRAND_VARIANTS.length) + BRAND_VARIANTS.length) % BRAND_VARIANTS.length];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Logo"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={g.from} />
          <stop offset="1" stopColor={g.to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={`url(#${id})`} />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    </svg>
  );
}
