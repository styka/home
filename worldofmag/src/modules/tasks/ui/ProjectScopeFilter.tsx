"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderTree, Check, Bookmark, Loader2 } from "lucide-react";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { createProjectGroup } from "../actions/projectGroups";
import type { TaskProject } from "@/types";

/**
 * 080 (Z3): FILTR PROJEKTÓW — wybór wielu naraz, z możliwością zapisania zestawu.
 *
 * Propozycja właściciela brzmiała: „może wystarczyłby wspólny widok, po prostu w filtrze
 * wybierałoby się projekty, których zadania mają się pojawiać (…) jak zaznaczę 3 projekty z 5,
 * to mogę to zapisać jako filtr predefiniowany i w przyszłości będę mógł go wybrać".
 *
 * Dwie decyzje, które z tego wynikają:
 *
 *  1. **Zaznaczenie zawęża listę PO STRONIE KLIENTA.** Widoki zbiorcze i tak ładują wszystkie
 *     zadania użytkownika, więc nie ma po co pytać serwera. Ważniejsze: utrata parametru z adresu
 *     pokazuje wtedy WSZYSTKIE projekty, a nie żaden. To jest reguła, przez którą powstał cały
 *     ten zestaw zmian — zakres nie może degradować do zera zasobów (patrz TasksRouteView).
 *  2. **Zapisany zestaw to zwykła grupa projektów**, ten sam byt, który istnieje od dawna.
 *     Dokładanie drugiego nośnika „filtrów predefiniowanych" obok grup dałoby dwie listy tego
 *     samego, rozjeżdżające się przy pierwszej edycji.
 */
export function ProjectScopeFilter({
  allProjects,
  selected,
  onChange,
}: {
  allProjects: TaskProject[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("modules.tasks.ProjectScopeFilter");
  const router = useRouter();
  const kotwica = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [nazwa, setNazwa] = useState("");
  const [zapisywanie, startZapis] = useTransition();

  const wybrane = new Set(selected);

  function przelacz(id: string) {
    const next = wybrane.has(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(next);
  }

  function zapiszZestaw() {
    const tytul = nazwa.trim();
    if (!tytul || selected.length === 0) return;
    startZapis(async () => {
      try {
        const grupa = await createProjectGroup({ name: tytul, projectIds: selected });
        setOpen(false);
        setNazwa("");
        router.push(`/tasks/zestaw/${grupa.id}`);
      } catch {
        /* nazwa zajęta albo brak dostępu — zostawiamy panel otwarty, żeby dało się poprawić */
      }
    });
  }

  const etykieta =
    selected.length === 0 ? t("wszystkieProjekty") : t("wybraneProjekty", { ile: selected.length });

  return (
    <>
      <button
        ref={kotwica}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs focus:outline-none"
        style={{
          color: selected.length > 0 ? "var(--accent-blue)" : "var(--text-muted)",
          backgroundColor: selected.length > 0 ? "var(--bg-hover)" : "transparent",
        }}
        title={t("filtrProjektow")}
        aria-label={t("filtrProjektow")}
        aria-expanded={open}
      >
        <FolderTree size={14} />
        <span className="hidden sm:inline">{etykieta}</span>
      </button>

      <AnchoredLayer
        anchorRef={kotwica}
        open={open}
        onClose={() => setOpen(false)}
        side="dol"
        align="start"
        width={280}
        ariaLabel={t("filtrProjektow")}
        style={{ padding: 6 }}
      >
        <div className="max-h-64 overflow-y-auto">
          {allProjects.map((p) => {
            const zaznaczony = wybrane.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => przelacz(p.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-3 text-left text-sm focus:outline-none"
                style={{ color: "var(--text-primary)" }}
                role="menuitemcheckbox"
                aria-checked={zaznaczony}
              >
                <span
                  className="flex shrink-0 items-center justify-center rounded"
                  style={{
                    width: 18,
                    height: 18,
                    border: `2px solid ${zaznaczony ? "var(--accent-blue)" : "var(--border)"}`,
                    backgroundColor: zaznaczony ? "var(--accent-blue)" : "transparent",
                  }}
                >
                  {zaznaczony && <Check size={12} color="var(--on-accent)" />}
                </span>
                <span className="shrink-0">{p.isInbox ? "📥" : p.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-1 border-t border-[var(--border)] pt-2">
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="mb-2 w-full rounded px-2 py-2 text-left text-xs focus:outline-none"
              style={{ color: "var(--text-muted)" }}
            >
              {t("wyczyscWybor")}
            </button>
          )}

          {/* Zapisanie wyboru to ta „predefiniowana" część prośby właściciela. Pole pokazuje się
              dopiero, gdy jest co zapisywać — pusty formularz w rozwijanym filtrze to szum. */}
          {selected.length > 0 && (
            <div className="flex items-center gap-1">
              <input
                value={nazwa}
                onChange={(e) => setNazwa(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") zapiszZestaw(); }}
                placeholder={t("nazwaZestawu")}
                aria-label={t("nazwaZestawu")}
                className="min-w-0 flex-1 rounded border bg-transparent px-2 py-2 text-xs focus:outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={zapiszZestaw}
                disabled={!nazwa.trim() || zapisywanie}
                className="flex shrink-0 items-center gap-1 rounded px-2 py-2 text-xs disabled:opacity-40 focus:outline-none"
                style={{ backgroundColor: "var(--accent-blue)", color: "var(--on-accent)" }}
                title={t("zapiszJakoZestaw")}
              >
                {zapisywanie ? <Loader2 size={13} className="animate-spin" /> : <Bookmark size={13} />}
              </button>
            </div>
          )}
        </div>
      </AnchoredLayer>
    </>
  );
}
