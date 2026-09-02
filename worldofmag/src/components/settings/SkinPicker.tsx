"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Pencil, Trash2, Copy } from "lucide-react";
import { SkinPreview } from "@/components/skins/SkinPreview";
import { SkinEditor } from "@/components/skins/SkinEditor";
import { Modal } from "@/components/ui/Modal";
import { setActiveSkin, deleteSkin, updateSkin, type SkinView } from "@/actions/skins";
import { useConfirm } from "@/components/ui/ConfirmProvider";

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
  const t = useTranslations("components.settings.SkinPicker");
  const confirmDialog = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [active, setActive] = useState<string | null>(activeId);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  // 116: skórka zaawansowana nie otwiera edytora tokenów (nie ma tam czego stroić) —
  // edycji podlega tylko nazwa i opis, w miniformularzu na karcie.
  const [rename, setRename] = useState<{ id: string; name: string; description: string } | null>(null);

  function saveRename() {
    if (!rename) return;
    const { id, name, description } = rename;
    setRename(null);
    start(async () => {
      await updateSkin(id, { name, description: description || null });
      router.refresh();
    });
  }

  function choose(id: string | null) {
    setActive(id);
    start(async () => {
      await setActiveSkin(id);
      router.refresh();
    });
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Usunąć tę skórkę? Użytkownicy z nią ustawioną wrócą do domyślnej.", destructive: true }))) return;
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
                {s.kind === "advanced" && <Badge>{t("zaawansowana")}</Badge>}
                {!s.isSystem && s.isOwn && <Badge>moja</Badge>}
                {!s.isSystem && !s.isOwn && <Badge>{t("udostepniona")}</Badge>}
                {s.isPublic && !s.isSystem && <Badge>publiczna</Badge>}
              </div>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                {/* 116: skórka zaawansowana nie ma edytora tokenów — duplikat/edycja
                    otwierałyby formularz, który nie wyraża jej definicji. Edytuje się
                    nazwę/opis; nową wersję robi się nowym opisem w generatorze. */}
                {s.kind !== "advanced" && (
                  <IconBtn title="Duplikuj i edytuj" onClick={() => duplicate(s)}><Copy size={13} /></IconBtn>
                )}
                {s.isOwn && s.kind !== "advanced" && (
                  <IconBtn title="Edytuj" onClick={() => setEditor({ open: true, initial: s, existingId: s.id })}><Pencil size={13} /></IconBtn>
                )}
                {s.isOwn && s.kind === "advanced" && (
                  <IconBtn
                    title={t("zmienNazwe")}
                    onClick={() => setRename({ id: s.id, name: s.name, description: s.description ?? "" })}
                  >
                    <Pencil size={13} />
                  </IconBtn>
                )}
                {s.isOwn && !s.isSystem && (
                  <IconBtn title={t("usun")} onClick={() => remove(s.id)} danger><Trash2 size={13} /></IconBtn>
                )}
              </div>
              {rename?.id === s.id && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <input
                    value={rename.name}
                    maxLength={60}
                    onChange={(e) => setRename({ ...rename, name: e.target.value })}
                    aria-label={t("nazwa")}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", padding: "6px 8px", fontSize: 12 }}
                  />
                  <input
                    value={rename.description}
                    maxLength={200}
                    onChange={(e) => setRename({ ...rename, description: e.target.value })}
                    aria-label={t("opis")}
                    placeholder={t("opis")}
                    style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", padding: "6px 8px", fontSize: 12 }}
                  />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => setRename(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
                      {t("anuluj")}
                    </button>
                    <button
                      type="button"
                      onClick={saveRename}
                      disabled={pending || !rename.name.trim()}
                      style={{ background: "var(--accent-blue)", border: "none", borderRadius: 6, color: "var(--on-accent)", fontSize: 12, fontWeight: 600, padding: "5px 12px", cursor: "pointer" }}
                    >
                      {t("zapisz")}
                    </button>
                  </div>
                </div>
              )}
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
          <Plus size={15} /> {t("utworzWlasnaSkorke")}
        </button>
      </div>

      {/* 121 (AC-1): edytor w modalu, nie inline pod przyciskiem — sekcja wysuwana na dole strony
          była niewidoczna, gdy przycisk stał przy dolnej krawędzi okna. Modal (na telefonie arkusz
          dolny) jest zawsze w kadrze, daje Esc i pułapkę focusu za darmo. */}
      {editor.open && (
        <Modal
          onClose={() => setEditor({ open: false })}
          title={editor.existingId ? t("edycjaSkorki") : t("nowaSkorka")}
          wide
        >
          <SkinEditor
            mode="user"
            initial={editor.initial}
            existingId={editor.existingId}
            teams={teams}
            onClose={() => setEditor({ open: false })}
            onSaved={(id) => choose(id)}
          />
        </Modal>
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
