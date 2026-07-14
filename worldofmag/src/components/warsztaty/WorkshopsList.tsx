"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Wrench, Users } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createWorkshop, type WorkshopWithCounts, type WarsztatMode } from "@/actions/warsztat";
import {
  WORKSHOP_TYPES,
  getWorkshopType,
  getSuggestions,
} from "@/lib/warsztat/catalog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Props {
  workshops: WorkshopWithCounts[];
  mode: WarsztatMode;
  teams: Array<{ id: string; name: string }>;
}

export function WorkshopsList({ workshops, mode, teams }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("ogolny");
  const [location, setLocation] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [focused, setFocused] = useState<number>(-1);

  // Z-232: lista nawigacyjna — j/k przesuwa fokus, Enter otwiera warsztat, a/n dodaje.
  const shortcutHandlers = useMemo(
    () => ({
      onNavigateDown: () => { if (!open) setFocused((i) => Math.min(workshops.length - 1, i + 1)); },
      onNavigateUp: () => { if (!open) setFocused((i) => Math.max(0, i - 1)); },
      onEnter: () => { if (!open && focused >= 0 && workshops[focused]) router.push(`/warsztaty/${workshops[focused].id}`); },
      onQuickAdd: () => { if (!open) setOpen(true); },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workshops, focused, open]
  );
  useKeyboardShortcuts(shortcutHandlers);

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      const ws = await createWorkshop({
        name,
        type,
        location: location || null,
        teamId: teamId || null,
      });
      setOpen(false);
      setName("");
      setLocation("");
      setTeamId("");
      router.push(`/warsztaty/${ws.id}`);
    });
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Twoje warsztaty i pracownie — trzymaj wyposażenie pod kontrolą.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium"
          style={{ backgroundColor: "var(--accent-amber)", color: "var(--on-accent)" }}
        >
          <Plus size={16} /> Nowy warsztat
        </button>
      </div>

      {workshops.length === 0 ? (
        <div
          className="rounded-lg border border-dashed p-10 text-center"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <Wrench size={32} className="mx-auto mb-3" style={{ color: "var(--accent-amber)" }} />
          <p className="mb-1" style={{ color: "var(--text-secondary)" }}>
            Nie masz jeszcze żadnego warsztatu.
          </p>
          <p className="text-sm">
            Utwórz pierwszy — wybierzesz profil (stolarski, samochodowy, malarski…), a my podpowiemy, jaki sprzęt warto mieć.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workshops.map((w, i) => {
            const wt = getWorkshopType(w.type);
            const essentials = getSuggestions(w.type).filter((s) => s.tier === "essential").length;
            return (
              <Link
                key={w.id}
                href={`/warsztaty/${w.id}`}
                onMouseEnter={() => setFocused(i)}
                className="rounded-lg border p-4 flex flex-col gap-2 transition-colors"
                style={{ borderColor: focused === i ? "var(--border-focus)" : "var(--border)", backgroundColor: focused === i ? "var(--bg-elevated)" : "var(--bg-surface)" }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl" aria-hidden>{wt.emoji}</span>
                  {w.ownerTeamId ? (
                    <Users size={15} style={{ color: "var(--accent-purple)" }} aria-label="Warsztat zespołowy" />
                  ) : null}
                </div>
                <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {w.name}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {wt.label}
                  {w.location ? ` · ${w.location}` : ""}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  {w._count.items} {w._count.items === 1 ? "pozycja" : "pozycji"} wyposażenia
                  {essentials > 0 ? ` · ${essentials} podstawowych w podpowiedziach` : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nowy warsztat"
        footer={
          <button
            type="button"
            onClick={submit}
            disabled={pending || !name.trim()}
            className="w-full py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-amber)", color: "var(--on-accent)" }}
          >
            Utwórz warsztat
          </button>
        }
      >
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Nazwa</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="np. Garaż, Pracownia malarska"
            className="w-full mb-3 px-3 py-2 rounded text-sm border outline-none"
            style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />

          <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Profil warsztatu</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {WORKSHOP_TYPES.map((t) => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className="text-left px-2.5 py-2 rounded border text-xs flex items-center gap-2"
                  style={{
                    borderColor: active ? "var(--accent-amber)" : "var(--border)",
                    backgroundColor: active ? "var(--bg-elevated)" : "var(--bg-base)",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  <span aria-hidden>{t.emoji}</span>
                  {t.label}
                </button>
              );
            })}
          </div>

          <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Lokalizacja (opcjonalnie)</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="np. garaż, piwnica, pokój 2"
            className="w-full mb-3 px-3 py-2 rounded text-sm border outline-none"
            style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />

          {mode === "pro" && teams.length > 0 ? (
            <>
              <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Właściciel</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm border outline-none"
                style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">Ja (prywatny)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>Zespół: {t.name}</option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
