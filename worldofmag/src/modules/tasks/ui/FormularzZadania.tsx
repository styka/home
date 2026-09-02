"use client";

import { useTranslations } from "next-intl";
import { useState, useRef, useTransition, useImperativeHandle, forwardRef } from "react";
import { Plus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { createTask } from "../actions/tasks";
import { llm } from "@/lib/llm-client";
import { useToast } from "@/components/ui/Toast";
import type { Task, TaskPriority, TaskProject } from "@/types";

/**
 * 105 — JEDEN formularz dodawania zadania dla całego modułu.
 *
 * Zgłoszenie właściciela dotyczyło dwóch miejsc naraz: paska w widoku projektu („jednolinijkowy,
 * przy dłuższym tekście nie widać całości") i strony `/tasks`, gdzie dodać zadania nie dało się
 * wcale. Dwie implementacje rozjechałyby się przy pierwszej poprawce reguły generowania tytułu,
 * więc komponent powstaje od razu z DWOMA konsumentami (C-35): oba przez `ModalDodaniaZadania`
 * (wcześniej stały pasek `QuickAddTask` w projekcie i widget `SzybkieDodanieZadania` na stronie
 * modułu) — widok projektu od 118, strona modułu od 121, tam z wyborem projektu docelowego.
 *
 * Trzy rzeczy, które łatwo tu zepsuć, i dlatego są napisane wprost:
 *
 * 1. **`textarea` zamiast `input` odbiera `Enter`.** Domyślnie `Enter` wstawia nową linię, a
 *    dodawanie jednym klawiszem to najczęstszy sposób użycia tego pola. Stąd jawny `onKeyDown`:
 *    `Enter` bez modyfikatora zapisuje, `Shift+Enter` łamie linię.
 * 2. **Rozwinięcie następuje samo**, gdy tekst przekroczy jedną linię — bo to jest moment, w
 *    którym użytkownik zaczął pisać OPIS, a nie tytuł. Czekanie na kliknięcie „Więcej" znaczyłoby,
 *    że najczęstszy przypadek (wklejenie dłuższej treści) dalej pisze się w szczelinie.
 * 3. **Ręcznie wpisany tytuł wyłącza generowanie.** Inaczej model nadpisywałby to, co użytkownik
 *    właśnie sam napisał — a pole tytułu istnieje właśnie po to, żeby dało się go poprawić.
 */

export interface FormularzZadaniaHandle {
  focus: () => void;
}

/** Awaryjny tytuł z treści, gdy LLM jest niedostępny: pierwszy wiersz, przycięty do ~60 znaków. */
function tytulZTresci(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= 60) return firstLine;
  const cut = firstLine.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** Wirtualne widoki nie są projektami — `createTask` i tak je zeruje, ale wybór projektu ich nie pokazuje. */
const WIDOKI_WIRTUALNE = ["today", "upcoming", "overdue", "all"];

const PRIORYTETY: { value: TaskPriority; label: string; color: string }[] = [
  { value: "NONE", label: "—", color: "var(--text-muted)" },
  { value: "LOW", label: "↓", color: "var(--accent-blue)" },
  { value: "MEDIUM", label: "◆", color: "var(--accent-amber)" },
  { value: "HIGH", label: "↑", color: "var(--accent-red)" },
  { value: "URGENT", label: "‼", color: "var(--accent-red)" },
];

interface FormularzZadaniaProps {
  /** Projekt, w którego kontekście dodajemy (albo id widoku wirtualnego). */
  projectId: string;
  /** Strona modułu: pokaż listę projektów do wyboru. W widoku projektu nie ma czego wybierać. */
  pokazWyborProjektu?: boolean;
  projekty?: TaskProject[];
  /** Projekt zaznaczony na starcie, gdy pokazujemy wybór (np. ostatnio używany). */
  domyslnyProjektId?: string | null;
  /** Po utworzeniu — konsument decyduje, co dalej (otwarcie panelu albo przejście do projektu). */
  onCreated?: (task: Task, projektId: string | null) => void;
}

export const FormularzZadania = forwardRef<FormularzZadaniaHandle, FormularzZadaniaProps>(
  function FormularzZadania({ projectId, pokazWyborProjektu = false, projekty = [], domyslnyProjektId = null, onCreated }, ref) {
    const t = useTranslations("modules.tasks.FormularzZadania");
    const { showToast } = useToast();

    const [tresc, setTresc] = useState("");
    const [tytul, setTytul] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("NONE");
    const [termin, setTermin] = useState("");
    const [wybranyProjekt, setWybranyProjekt] = useState<string>(
      domyslnyProjektId ?? (WIDOKI_WIRTUALNE.includes(projectId) ? "" : projectId),
    );
    const [rozwiniety, setRozwiniety] = useState(false);
    const [isPending, startTransition] = useTransition();
    const trescRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => { trescRef.current?.focus(); },
    }));

    /**
     * Dopasowanie wysokości pola do treści — ten sam wzorzec co opis w `TaskDetail`: ref-callback
     * ustawia wysokość SYNCHRONICZNIE po zamontowaniu, więc pole nie mruga jedną linijką.
     * Sufit chroni przed wypchnięciem listy poza ekran; powyżej niego wraca przewijanie w polu.
     */
    function dopasujWysokosc(el: HTMLTextAreaElement | null) {
      if (!el) return;
      el.style.height = "auto";
      const sufit = rozwiniety ? Math.round(window.innerHeight * 0.35) : 160;
      el.style.height = `${Math.min(el.scrollHeight, sufit)}px`;
    }

    function zmienTresc(el: HTMLTextAreaElement) {
      setTresc(el.value);
      dopasujWysokosc(el);
      // Tekst przestał być jednolinijkowy → to już opis, nie tytuł. Rozwijamy sami.
      if (!rozwiniety && (el.value.includes("\n") || el.scrollHeight > el.clientHeight + 4 || el.value.length > 80)) {
        setRozwiniety(true);
      }
    }

    function zapisz(e?: React.FormEvent) {
      e?.preventDefault();
      const text = tresc.trim();
      if (!text || isPending) return;

      startTransition(async () => {
        try {
          // Trzy przypadki, w tej kolejności — kolejność jest tu istotna:
          //
          // 1. Użytkownik wpisał WŁASNY tytuł → tytuł jest jego, a wpisana treść zostaje OPISEM.
          //    Także wtedy, gdy treść jest krótka: gdyby zadziałał punkt 2, tytuł nadpisałby
          //    treść i to, co użytkownik napisał, przepadłoby bez śladu.
          // 2. Krótki, jednowierszowy tekst bez własnego tytułu to po prostu sam tytuł
          //    („kup mleko") — nie dublujemy go w opisie ani nie wołamy modelu.
          // 3. Dłuższy tekst → treść jest opisem, tytuł powstaje z niej (model, a gdy go nie ma —
          //    pierwszy wiersz). Reguła przeniesiona z `QuickAddTask` bez zmian.
          const recznyTytul = tytul.trim();
          const samTytul = !text.includes("\n") && text.length <= 50;

          let finalnyTytul: string;
          let description: string | null = null;

          if (recznyTytul) {
            finalnyTytul = recznyTytul;
            description = text;
          } else if (samTytul) {
            finalnyTytul = text;
          } else {
            description = text;
            finalnyTytul = tytulZTresci(text);
            try {
              const res = await llm.tasks.suggestTitle(text);
              if (res.title?.trim()) finalnyTytul = res.title.trim();
            } catch {
              /* brak LLM / offline — zostaje tytuł lokalny */
            }
          }

          const docelowyProjekt = pokazWyborProjektu ? (wybranyProjekt || null) : projectId;
          const created = await createTask({
            title: finalnyTytul,
            description,
            priority,
            dueDate: termin ? new Date(termin) : null,
            projectId: docelowyProjekt,
          });

          setTresc("");
          setTytul("");
          setPriority("NONE");
          setTermin("");
          setRozwiniety(false);
          onCreated?.(created, created.projectId ?? null);
        } catch (err) {
          showToast(err instanceof Error ? err.message : t("nieUdaloSieDodac"), "error");
        }
      });
    }

    const aktualnyPriorytet = PRIORYTETY.find((p) => p.value === priority)!;

    function nastepnyPriorytet() {
      const opts = PRIORYTETY.map((p) => p.value);
      setPriority(opts[(opts.indexOf(priority) + 1) % opts.length]);
    }

    return (
      <form
        onSubmit={zapisz}
        className="flex-shrink-0 border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="flex items-start gap-2 px-3 py-2">
          <button
            type="button"
            onClick={nastepnyPriorytet}
            className="flex-shrink-0 w-6 h-6 mt-1 flex items-center justify-center rounded focus:outline-none text-sm font-bold"
            style={{ color: aktualnyPriorytet.color }}
            title={t("priorytetKliknijByZmienic")}
            aria-label={t("priorytetKliknijByZmienic")}
          >
            {aktualnyPriorytet.label}
          </button>

          <textarea
            ref={(el) => { trescRef.current = el; dopasujWysokosc(el); }}
            value={tresc}
            rows={1}
            onChange={(e) => zmienTresc(e.currentTarget)}
            onKeyDown={(e) => {
              // `Enter` bez modyfikatora zapisuje — inaczej `textarea` zjadłaby najczęstszy sposób
              // użycia tego pola. `Shift+Enter` łamie linię (i przy okazji rozwija formularz).
              if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                zapisz();
                return;
              }
              // `Esc` zwija formularz, ale NIE kasuje wpisanego tekstu.
              if (e.key === "Escape" && rozwiniety) {
                e.stopPropagation();
                setRozwiniety(false);
              }
            }}
            placeholder={t("dodajZadanie")}
            className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none resize-none"
            style={{ color: "var(--text-primary)", lineHeight: 1.5, overflowY: "auto" }}
          />

          <button
            type="button"
            onClick={() => setRozwiniety((v) => !v)}
            aria-expanded={rozwiniety}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 mt-0.5 rounded focus:outline-none"
            style={{ color: "var(--text-muted)" }}
            title={rozwiniety ? t("zwin") : t("wiecej")}
            aria-label={rozwiniety ? t("zwin") : t("wiecej")}
          >
            {rozwiniety ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            type="submit"
            disabled={!tresc.trim() || isPending}
            className="flex-shrink-0 flex items-center justify-center w-7 h-7 mt-0.5 rounded focus:outline-none disabled:opacity-30"
            style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
            title={t("dodajZadanieAkcja")}
            aria-label={t("dodajZadanieAkcja")}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>

        {rozwiniety && (
          <div className="px-3 pb-3 pt-1 space-y-2">
            <div>
              <input
                value={tytul}
                onChange={(e) => setTytul(e.target.value)}
                placeholder={t("tytulPlaceholder")}
                className="w-full bg-transparent text-sm focus:outline-none border-b pb-1"
                style={{ color: "var(--text-primary)", borderColor: "var(--border)" }}
                aria-label={t("tytulZadania")}
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {tytul.trim() ? t("tytulWlasny") : t("tytulPowstanieZOpisu")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pokazWyborProjektu && (
                <select
                  value={wybranyProjekt}
                  onChange={(e) => setWybranyProjekt(e.target.value)}
                  className="text-xs rounded px-2 py-1.5 focus:outline-none"
                  style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", border: "var(--border-width) var(--border-style) var(--border)" }}
                  aria-label={t("projekt")}
                >
                  <option value="">{t("skrzynka")}</option>
                  {projekty.map((p) => (
                    <option key={p.id} value={p.id}>{p.emoji ? `${p.emoji} ${p.name}` : p.name}</option>
                  ))}
                </select>
              )}

              <input
                type="datetime-local"
                value={termin}
                onChange={(e) => setTermin(e.target.value)}
                className="text-xs rounded px-2 py-1.5 focus:outline-none"
                style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)", border: "var(--border-width) var(--border-style) var(--border)" }}
                aria-label={t("termin")}
              />
            </div>
          </div>
        )}
      </form>
    );
  }
);
