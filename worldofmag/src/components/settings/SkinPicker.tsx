"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Pencil, Trash2, Copy } from "lucide-react";
import { SkinPreview } from "@/components/skins/SkinPreview";
import { SkinEditor } from "@/components/skins/SkinEditor";
import { setActiveSkin, deleteSkin, type SkinView } from "@/actions/skins";

type TeamOpt = { id: string; name: string };

type EditorState =
  | { open: false }
  | { open: true; initial: SkinView | null; existingId: string | null };

export function SkinPicker({
  skins,
  activeId,
  teams,
}: {
  skins: SkinView[];
  activeId: string | null;
  teams: TeamOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [active, setActive] = useState<string | null>(activeId);
  const [editor, setEditor] = useState<EditorState>({ open: false });

  function choose(id: string | null) {
    setActive(id);
    start(async () => {
      await setActiveSkin(id);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Usunąć tę skórkę? Użytkownicy z nią ustawioną wrócą do domyślnej.")) return;
    start(async () => {
      await deleteSkin(id);
      if (active === id) setActive(null);
      router.refresh();
    });
  }

  // duplikat: otwórz edytor z tokenami źródła, ale jako nowa skórka (existingId null)
  function duplicate(s: SkinView) {
    setEditor({ open: true, initial: { ...s, name: `${s.name} (kopia)`, isOwn: true, isSystem: false, isPublic: false, ownerId: null, ownerTeamId: null }, existingId: null });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {skins.map((s) => {
          const selected = active === s.id || (active === null && s.id === "skin-system-dark");
          return (
            <div
              key={s.id}
              style={{
                border: `2px solid ${selected ? "var(--accent-blue)" : "var(--border)"}`,
                borderRadius: 12,
                padding: 8,
                background: "var(--bg-surface)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => choose(s.id)}
                disabled={pending}
                style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}
                aria-pressed={selected}
                aria-label={`Wybierz skórkę ${s.name}`}
              >
                <SkinPreview tokens={s.tokens} compact />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {selected && <Check size={14} style={{ color: "var(--accent-blue)" }} />}
                  <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                </div>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {s.isSystem && <Badge>systemowa</Badge>}
                {!s.isSystem && s.isOwn && <Badge>moja</Badge>}
                {!s.isSystem && !s.isOwn && <Badge>udostępniona</Badge>}
                {s.isPublic && !s.isSystem && <Badge>publiczna</Badge>}
              </div>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <IconBtn title="Duplikuj i edytuj" onClick={() => duplicate(s)}><Copy size={13} /></IconBtn>
                {s.isOwn && (
                  <IconBtn title="Edytuj" onClick={() => setEditor({ open: true, initial: s, existingId: s.id })}><Pencil size={13} /></IconBtn>
                )}
                {s.isOwn && !s.isSystem && (
                  <IconBtn title="Usuń" onClick={() => remove(s.id)} danger><Trash2 size={13} /></IconBtn>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setEditor({ open: true, initial: null, existingId: null })}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
        >
          <Plus size={15} /> Utwórz własną skórkę
        </button>
      </div>

      {editor.open && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-surface)", padding: 16 }}>
          <h3 style={{ margin: "0 0 14px", color: "var(--text-primary)", fontSize: 15, fontWeight: 600 }}>
            {editor.existingId ? "Edycja skórki" : "Nowa skórka"}
          </h3>
          <SkinEditor
            mode="user"
            initial={editor.initial}
            existingId={editor.existingId}
            teams={teams}
            onClose={() => setEditor({ open: false })}
            onSaved={(id) => choose(id)}
          />
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {children}
    </span>
  );
}

function IconBtn({ children, title, onClick, danger = false }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{ display: "inline-flex", padding: 5, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 5, color: danger ? "var(--accent-red)" : "var(--text-secondary)", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}
