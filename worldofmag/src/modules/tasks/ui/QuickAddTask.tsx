"use client";

import { forwardRef } from "react";
import { FormularzZadania, type FormularzZadaniaHandle } from "./FormularzZadania";
import type { Task } from "@/types";

/**
 * 105 — CIENKA NAKŁADKA na `FormularzZadania` (wzorzec C-35).
 *
 * Cała treść tego pliku przeniosła się do `FormularzZadania`, bo ten sam formularz jest teraz
 * potrzebny także na stronie modułu (`/tasks`), gdzie dodać zadania nie dało się wcale.
 * Plik zostaje — z nazwą, eksportem i typem uchwytu — żeby `TasksPage` nie zmieniało się ani
 * o linię: podmiana implementacji nie jest powodem, żeby ruszać wywołanie.
 *
 * Sprawdzian poprawności API `FormularzZadania` jest właśnie tutaj: gdyby `TasksPage` musiało się
 * zmienić, żeby ta nakładka zadziałała, to znaczyłoby, że nowy komponent ma złe wejścia.
 */

export interface QuickAddTaskHandle {
  focus: () => void;
}

interface QuickAddTaskProps {
  projectId: string;
  /** Po utworzeniu zadania — otwiera jego szczegóły, by ustawić pozostałe parametry.
   *  Przekazuje cały obiekt, bo w widokach wirtualnych (Dziś/Nadchodzące…) nowe zadanie
   *  trafia do Skrzynki i nie wchodzi do przefiltrowanej listy — panel używa go jako fallback. */
  onCreated?: (task: Task) => void;
}

export const QuickAddTask = forwardRef<QuickAddTaskHandle, QuickAddTaskProps>(
  function QuickAddTask({ projectId, onCreated }, ref) {
    return (
      <FormularzZadania
        ref={ref as React.Ref<FormularzZadaniaHandle>}
        projectId={projectId}
        onCreated={(task) => onCreated?.(task)}
      />
    );
  }
);
