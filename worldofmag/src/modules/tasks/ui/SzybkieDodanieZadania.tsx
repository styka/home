"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FormularzZadania } from "./FormularzZadania";
import type { TaskProject } from "@/types";

/**
 * 105 (AC-1..AC-4) — SZYBKIE DODANIE ZADANIA na stronie modułu.
 *
 * Zgłoszenie właściciela: „wszedłem w Zadania z menu, chciałem dodać zadanie, a tu jest tylko
 * przycisk »Nowy projekt«". Moduł, w którym najczęściej się COŚ DODAJE, nie miał na swojej stronie
 * startowej żadnego sposobu, żeby to zrobić — trzeba było najpierw wejść w projekt.
 *
 * Po zapisie NIE zostajemy tutaj: przechodzimy do projektu zadania z otwartymi szczegółami
 * (`?task=<id>` — istniejące wejście, które `TasksRouteView` już czyta), bo widget zbiera tylko
 * podstawy, a resztę uzupełnia się w pełnym panelu.
 */

interface Props {
  projekty: TaskProject[];
  /** Projekt ostatnio używanego zadania — domyślny cel. Wyliczany na serwerze, nigdzie nie zapisywany. */
  ostatniProjektId: string | null;
}

export function SzybkieDodanieZadania({ projekty, ostatniProjektId }: Props) {
  const t = useTranslations("modules.tasks.SzybkieDodanieZadania");
  const router = useRouter();

  // Projekt sprzed chwili mógł zostać skasowany albo należeć do przestrzeni, której już nie widzimy —
  // wtedy domyślnym jest Skrzynka, a nie martwe id, które select i tak by odrzucił.
  const domyslny = ostatniProjektId && projekty.some((p) => p.id === ostatniProjektId) ? ostatniProjektId : null;

  return (
    <section
      style={{
        border: "var(--border-width) var(--border-style) var(--border)",
        borderRadius: "var(--radius-card, 10px)",
        overflow: "hidden",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <h2
        className="px-3 pt-2 text-xs font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {t("noweZadanie")}
      </h2>
      <FormularzZadania
        projectId="all"
        pokazWyborProjektu
        projekty={projekty}
        domyslnyProjektId={domyslny}
        onCreated={(task, projektId) => {
          router.push(`/tasks/${projektId ?? "all"}?task=${task.id}`);
        }}
      />
    </section>
  );
}
