"use client";

import type { ReactNode } from "react";
import { ModuleView } from "@/components/ui/view";
import { SpisNarzedziAdmina } from "@/components/admin/SpisNarzedziAdmina";

/**
 * 110: rama widoku dla wyrzutni panelu.
 *
 * `ModuleView` jest komponentem klienckim, a trasa panelu musi być serwerowa (czyta sesję
 * i uprawnienie) — stąd cienka nakładka, ten sam układ co przy przeglądzie i w Ustawieniach po 109.
 */
export function RamaPanelu({
  tytul,
  podtytul,
  ikona,
}: {
  tytul: string;
  podtytul: string;
  ikona: ReactNode;
}) {
  return (
    <ModuleView
      state="ready"
      width="narrow"
      icon={ikona}
      iconColor="var(--accent-purple)"
      title={tytul}
      subtitle={podtytul}
    >
      <SpisNarzedziAdmina />
    </ModuleView>
  );
}
