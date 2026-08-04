"use client";

import type { ReactNode } from "react";
import { ViewEmpty } from "@/components/ui/view/ViewState";

/**
 * 045 — cienka nakładka na `ViewEmpty` z kontraktu widoku.
 *
 * DLACZEGO NAKŁADKA, A NIE DRUGI KOMPONENT
 *
 * Kontrakt widoku przyniósł własny zestaw stanów brzegowych (`ViewState.tsx`), a ten
 * komponent był już używany w 21 widokach. Zostawienie obu byłoby dokładnie tym długiem,
 * który cały ten przebieg spłaca: DWA rozwiązania tego samego problemu, rozjeżdżające
 * się przy pierwszej poprawce UX (AC-6, C-53).
 *
 * Przepisanie 21 wywołań na nowe API też nie było właściwe — stan pusty bywa tu
 * SEKCYJNY (pusta lista wewnątrz jednej z kilku sekcji widoku), a `ModuleView.empty`
 * obsługuje stan CAŁEGO widoku. To dwa różne zastosowania jednego wyglądu.
 *
 * Więc: jedna implementacja (`ViewEmpty`), dwa wejścia. To API zostaje dla stanów
 * sekcyjnych i tłumaczy stare nazwy propsów (`message`/`hint`/`cta`) na nowe.
 */

interface EmptyStateProps {
  icon: ReactNode;
  message: string;
  hint?: string;
  cta?: {
    label: string;
    onClick?: () => void;
    href?: string;
    /** Ignorowane — ton stanu pustego jest wspólny, żeby nie rozjeżdżał się między modułami. */
    color?: string;
  };
}

export function EmptyState({ icon, message, hint, cta }: EmptyStateProps) {
  return (
    <ViewEmpty
      icon={icon}
      title={message}
      description={hint}
      action={cta ? { label: cta.label, onClick: cta.onClick, href: cta.href } : undefined}
    />
  );
}
