"use client";

import type { ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { PowrotDoPanelu } from "@/components/admin/PowrotDoPanelu";

/**
 * 110: rama widoku dla „Przeglądu systemu".
 *
 * `ModuleView` jest komponentem klienckim, a trasa przeglądu musi być serwerowa (czyta sesję
 * i liczy rekordy) — stąd cienka nakładka: serwer podaje policzoną treść jako dzieci, klient rysuje
 * ramę. Ten sam układ co w Ustawieniach po 109.
 */
export function RamaPrzegladu({
  tytul,
  podtytul,
  children,
}: {
  tytul: string;
  podtytul: string;
  children: ReactNode;
}) {
  return (
    <ModuleView
      state="ready"
      width="narrow"
      icon={<LayoutGrid size={22} />}
      iconColor="var(--accent-purple)"
      title={tytul}
      subtitle={podtytul}
      breadcrumb={<PowrotDoPanelu />}
    >
      {children}
    </ModuleView>
  );
}
