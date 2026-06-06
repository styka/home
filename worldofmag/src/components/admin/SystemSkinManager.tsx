"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Palette } from "lucide-react";
import { SkinPreview } from "@/components/skins/SkinPreview";
import { SkinEditor } from "@/components/skins/SkinEditor";
import { deleteSkin, type SkinView } from "@/actions/skins";

type EditorState =
  | { open: false }
  | { open: true; initial: SkinView | null; existingId: string | null };

export function SystemSkinManager({ skins }: { skins: SkinView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editor, setEditor] = useState<EditorState>({ open: false });

  function remove(id: string) {
    if (!confirm("Usunąć tę skórkę systemową? Użytkownicy z nią ustawioną wrócą do domyślnej.")) return;
    start(async () => {
      await deleteSkin(id);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          <Palette size={20} style={{ color: "var(--text-secondary)" }} />
          Skórki systemowe
        </h1>
        <button
          type="button"
          onClick={() => setEditor({ open: true, initial: null, existingId: null })}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--accent-blue)", border: "1px solid var(--accent-blue)", borderRadius: 6, color: "var(--on-accent)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          <Plus size={15} /> Nowa skórka
        </button>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
        Skórki systemowe są widoczne i dostępne dla wszystkich użytkowników. Zmiany wpływają na każdego, kto ma daną skórkę ustawioną.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {skins.map((s) => (
          <div key={s.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10, background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: 8 }}>
            <SkinPreview tokens={s.tokens} compact />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{s.name}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>#{s.sortOrder}</span>
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button type="button" title="Edytuj" onClick={() => setEditor({ open: true, initial: s, existingId: s.id })} style={btn()}>
                <Pencil size={13} />
              </button>
              <button type="button" title="Usuń" onClick={() => remove(s.id)} disabled={pending} style={btn(true)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editor.open && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-surface)", padding: 16 }}>
          <h3 style={{ margin: "0 0 14px", color: "var(--text-primary)", fontSize: 15, fontWeight: 600 }}>
            {editor.existingId ? "Edycja skórki systemowej" : "Nowa skórka systemowa"}
          </h3>
          <SkinEditor
            mode="admin"
            system
            initial={editor.initial}
            existingId={editor.existingId}
            onClose={() => setEditor({ open: false })}
          />
        </div>
      )}
    </div>
  );
}

function btn(danger = false): React.CSSProperties {
  return { display: "inline-flex", padding: 6, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 5, color: danger ? "var(--accent-red)" : "var(--text-secondary)", cursor: "pointer" };
}
