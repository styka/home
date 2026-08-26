"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardCopy, Check, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { copyLazy } from "@/lib/omniaClipboard";
import { getPromptDoPokazania, oznaczPromptPokazany, type PromptWznowieniaDTO } from "@/actions/promptWznowienia";

type StanKopiowania = "idle" | "skopiowano" | "blad";

/**
 * 106 — DIALOG WZNOWIENIA PRACY (administrator, nie częściej niż raz dziennie).
 *
 * Dlaczego dialog, a nie powiadomienie: powiadomienie ginie w dzwonku razem z resztą i niesie
 * zdanie, a nie GOTOWY tekst do wklejenia. Tu chodzi o jedno — żeby po kilku dniach przerwy dało
 * się wrócić do przerwanej roboty jednym „skopiuj i wklej", bez odtwarzania kontekstu z pamięci.
 *
 * Treść przychodzi z bazy (`PromptWznowienia`), więc zmienia ją migracja — tą samą drogą, którą
 * dostarczamy raporty. Gdyby siedziała w kodzie, każda aktualizacja stanu prac wymagałaby zmiany
 * komponentu.
 *
 * Pobranie idzie akcją serwerową **po zamontowaniu**, a nie propsem z `layout.tsx`: powłoka renderuje
 * się na każdej stronie, więc prop oznaczałby dodatkowe zapytanie do bazy przy każdym wejściu
 * każdego użytkownika — także tych, których to nie dotyczy. Sama akcja odmawia nie-administratorowi.
 */
export function PromptWznowieniaDialog() {
  const t = useTranslations("components.shell.PromptWznowieniaDialog");
  const [prompt, setPrompt] = useState<PromptWznowieniaDTO | null>(null);
  const [stan, setStan] = useState<StanKopiowania>("idle");

  useEffect(() => {
    let anulowane = false;
    getPromptDoPokazania()
      .then((p) => {
        if (!anulowane) setPrompt(p);
      })
      .catch(() => {
        // Brak promptu to stan normalny; awaria odczytu nie może psuć wejścia do aplikacji.
      });
    return () => {
      anulowane = true;
    };
  }, []);

  if (!prompt) return null;

  async function kopiuj() {
    if (!prompt) return;
    try {
      await copyLazy(async () => prompt.tresc);
      setStan("skopiowano");
    } catch {
      setStan("blad");
    }
    setTimeout(() => setStan("idle"), 3000);
  }

  function zamknij() {
    const klucz = prompt?.klucz;
    setPrompt(null);
    // Zapis „widziane dzisiaj" dopiero przy ZAMKNIĘCIU: gdyby szedł przy pokazaniu, dialog zamknięty
    // przypadkiem (Esc, kliknięcie w tło) przepadłby na cały dzień razem z promptem.
    if (klucz) void oznaczPromptPokazany(klucz).catch(() => {});
  }

  const IkonaKopiowania = stan === "skopiowano" ? Check : stan === "blad" ? AlertCircle : ClipboardCopy;
  const kolorKopiowania =
    stan === "skopiowano" ? "var(--accent-green)" : stan === "blad" ? "var(--accent-red)" : "var(--on-accent)";

  return (
    <Modal
      open
      onClose={zamknij}
      wide
      title={prompt.tytul}
      footer={
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={zamknij}
            className="px-4 py-3 sm:py-2 rounded text-sm"
            style={{
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {t("zamknij")}
          </button>
          <button
            onClick={kopiuj}
            className="px-4 py-3 sm:py-2 rounded text-sm flex items-center justify-center gap-2"
            style={{
              backgroundColor: stan === "blad" ? "var(--bg-elevated)" : "var(--accent-blue)",
              color: kolorKopiowania,
            }}
          >
            <IkonaKopiowania size={15} />
            {stan === "skopiowano" ? t("skopiowano") : stan === "blad" ? t("bladKopiowania") : t("kopiuj")}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {prompt.wstep}
        </p>
        <div>
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            {t("etykietaPromptu")}
          </div>
          <pre
            className="text-xs p-3 rounded overflow-auto whitespace-pre-wrap break-words"
            style={{
              backgroundColor: "var(--bg-base)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              maxHeight: "40vh",
              fontFamily: "var(--font-family-mono, ui-monospace, monospace)",
            }}
          >
            {prompt.tresc}
          </pre>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t("stopka")}
        </p>
      </div>
    </Modal>
  );
}
