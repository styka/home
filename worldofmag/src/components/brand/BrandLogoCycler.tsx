"use client";

import { useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { IS_PROD } from "@/lib/appName";
import { BRAND_VARIANT_COUNT } from "@/lib/brandVariants";

// Eksperyment doboru logo (tylko dev): każde kliknięcie przełącza na kolejny wariant,
// po ostatnim wraca do pierwszego. Renderowane w kolorach produkcyjnych, by ocenić
// docelowy, premium wygląd. Na produkcji pokazujemy statyczne, finalne logo.
export function BrandLogoCycler({ px = 22 }: { px?: number }) {
  const [i, setI] = useState(0);

  if (IS_PROD) {
    return <BrandLogo variant={0} px={px} />;
  }

  return (
    <button
      type="button"
      onClick={() => setI((v) => (v + 1) % BRAND_VARIANT_COUNT)}
      title={`Logo ${i + 1}/${BRAND_VARIANT_COUNT} — kliknij, aby zmienić`}
      aria-label="Zmień propozycję logo"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        lineHeight: 0,
        display: "inline-flex",
      }}
    >
      <BrandLogo variant={i} px={px} prod />
    </button>
  );
}
