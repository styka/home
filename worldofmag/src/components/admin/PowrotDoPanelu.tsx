"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * 110: JEDEN ODNOŚNIK POWROTU DO PANELU ADMINISTRATORA.
 *
 * Przed 110 dwanaście stron panelu miało taki odnośnik napisany ręcznie (wszystkie identycznie,
 * `fontSize: 12`), a **jedenaście nie miało go wcale** — z narzędzia wracało się menu bocznym albo
 * przyciskiem wstecz. Zostawienie dwóch wzorców tej samej rzeczy skończyłoby się trzecim przy
 * następnej stronie (C-35), więc komponent jedzie od razu do wszystkich dwudziestu trzech.
 *
 * `odstep` istnieje, bo odnośnik stoi w różnych układach: w jednych jest pierwszym elementem
 * kolumny, w innych siedzi w nagłówku, który sam wnosi margines. Podmiana ma nie przesuwać stron,
 * które ten odnośnik już miały.
 */
export function PowrotDoPanelu({ odstep = 0 }: { odstep?: number }) {
  const t = useTranslations("components.admin.PowrotDoPanelu");
  return (
    <Link
      href="/admin"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: "var(--text-muted)",
        textDecoration: "none",
        marginBottom: odstep,
      }}
    >
      <ChevronLeft size={14} />
      {t("panelAdministratora")}
    </Link>
  );
}
