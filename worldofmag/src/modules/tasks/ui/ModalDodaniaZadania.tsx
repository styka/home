"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { FormularzZadania, type FormularzZadaniaHandle } from "./FormularzZadania";
import type { Task, TaskProject } from "@/types";

/**
 * 118 (zgł. 2) — dodawanie zadania w MODALU zamiast stałego formularza nad listą.
 *
 * Decyzja właściciela: formularz wpięty na stałe w widok listy zabierał przestrzeń liście zadań
 * na każdej stronie projektu — także wtedy, gdy nikt niczego nie dodawał. Modal pojawia się
 * wyłącznie na żądanie (przycisk albo skróty `a`/`n`) i leży NAD treścią, więc lista dostaje
 * całą wysokość obszaru roboczego z powrotem.
 *
 * Sam formularz się nie zmienia — to ten sam `FormularzZadania` (105). 121 (zgł. 2): drugim
 * konsumentem jest strona modułu (`TasksHomePage`), która zamiast dawnego stałego widgetu
 * `SzybkieDodanieZadania` otwiera ten modal z wyborem projektu docelowego — stąd opcjonalne
 * propsy wyboru projektu, przekazywane wprost do formularza. Po utworzeniu zadania modal
 * się zamyka, a konsument otwiera panel szczegółów — dokładnie jak przy starym formularzu.
 */
export function ModalDodaniaZadania({
  projectId,
  pokazWyborProjektu = false,
  projekty = [],
  domyslnyProjektId = null,
  onClose,
  onCreated,
}: {
  projectId: string;
  /** Strona modułu: pokaż listę projektów do wyboru. W widoku projektu nie ma czego wybierać. */
  pokazWyborProjektu?: boolean;
  projekty?: TaskProject[];
  /** Projekt zaznaczony na starcie, gdy pokazujemy wybór (np. ostatnio używany). */
  domyslnyProjektId?: string | null;
  onClose: () => void;
  /** Po utworzeniu — konsument otwiera szczegóły; modal zamyka się sam. */
  onCreated: (task: Task, projektId: string | null) => void;
}) {
  const t = useTranslations("modules.tasks.ModalDodaniaZadania");
  const formularzRef = useRef<FormularzZadaniaHandle>(null);

  // Radix ustawia focus na PIERWSZYM fokusowalnym elemencie (przycisk priorytetu) — a pisanie
  // zaczyna się w polu treści. Przejmujemy focus po zamontowaniu, po turze auto-focusu Radixa.
  useEffect(() => {
    const id = window.setTimeout(() => formularzRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Modal title={t("tytul")} onClose={onClose}>
      <FormularzZadania
        ref={formularzRef}
        projectId={projectId}
        pokazWyborProjektu={pokazWyborProjektu}
        projekty={projekty}
        domyslnyProjektId={domyslnyProjektId}
        onCreated={(task, projektId) => {
          onCreated(task, projektId);
          onClose();
        }}
      />
    </Modal>
  );
}
