"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { splaszczDrzewo } from "../lib/obszary";
import type { ObszarDTO } from "../actions/obszary";

/**
 * 117 (AC-2): wybór obszaru dla zadania — natywny `<select>` z wcięciem odzwierciedlającym
 * drzewo (opcje nie znają paddingu, więc głębokość rysują spacje). Zadanie ma DOKŁADNIE jeden
 * obszar albo żaden — „Brak" odpina.
 */
export function WyborObszaru({
  obszary,
  value,
  onChange,
  className,
  style,
}: {
  obszary: ObszarDTO[];
  value: string | null;
  onChange: (areaId: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useTranslations("modules.tasks.WyborObszaru");
  const drzewo = useMemo(() => splaszczDrzewo(obszary), [obszary]);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={className}
      style={style}
      title={t("przypiszObszar")}
      aria-label={t("przypiszObszar")}
    >
      <option value="">{t("brakObszaru")}</option>
      {drzewo.map(({ obszar, glebokosc }) => (
        <option key={obszar.id} value={obszar.id}>
          {" ".repeat(glebokosc * 3)}
          {obszar.name}
        </option>
      ))}
    </select>
  );
}
