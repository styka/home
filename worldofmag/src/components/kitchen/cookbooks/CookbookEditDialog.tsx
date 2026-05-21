"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { createCookbook, updateCookbook, deleteCookbook } from "@/actions/cookbooks";
import type { Cookbook } from "@/types/kitchen";

interface CookbookEditDialogProps {
  open: boolean;
  onClose: () => void;
  cookbook?: Cookbook | null;
}

const EMOJI_PRESETS = ["📚", "📖", "🍝", "🥗", "🍰", "🍞", "🧁", "🍲", "🥘", "🍱", "🌮", "🥟"];
const COLOR_PRESETS: Array<{ label: string; value: string | null }> = [
  { label: "—", value: null },
  { label: "Pomarańcz", value: "#ff8a3d" },
  { label: "Zielony", value: "#22c55e" },
  { label: "Niebieski", value: "#3b82f6" },
  { label: "Czerwony", value: "#ef4444" },
  { label: "Fiolet", value: "#a855f7" },
  { label: "Bursztyn", value: "#f59e0b" },
];

export function CookbookEditDialog({ open, onClose, cookbook }: CookbookEditDialogProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(cookbook?.name ?? "");
  const [description, setDescription] = useState(cookbook?.description ?? "");
  const [emoji, setEmoji] = useState(cookbook?.emoji ?? "📚");
  const [color, setColor] = useState<string | null>(cookbook?.color ?? null);

  useEffect(() => {
    if (open) {
      setName(cookbook?.name ?? "");
      setDescription(cookbook?.description ?? "");
      setEmoji(cookbook?.emoji ?? "📚");
      setColor(cookbook?.color ?? null);
    }
  }, [open, cookbook]);

  if (!open) return null;

  function handleSave() {
    if (!name.trim()) {
      showToast("Nazwa jest wymagana", "error");
      return;
    }
    startTransition(async () => {
      try {
        if (cookbook) {
          await updateCookbook(cookbook.id, {
            name: name.trim(),
            description: description.trim() || null,
            emoji,
            color,
          });
          showToast("Książka zapisana", "success");
        } else {
          await createCookbook({
            name: name.trim(),
            description: description.trim() || null,
            emoji,
            color,
          });
          showToast("Książka utworzona", "success");
        }
        onClose();
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd zapisu", "error");
      }
    });
  }

  function handleDelete() {
    if (!cookbook) return;
    if (!confirm(`Usunąć książkę „${cookbook.name}"? Przepisy w niej zostaną, ale stracą przypisanie.`)) return;
    startTransition(async () => {
      try {
        await deleteCookbook(cookbook.id);
        showToast("Książka usunięta", "success");
        onClose();
        router.push("/kitchen/cookbooks");
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Błąd usuwania", "error");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:w-[460px] md:rounded border max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border)",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {cookbook ? "Edycja książki" : "Nowa książka"}
          </h3>
          <button onClick={onClose} aria-label="Zamknij" style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Nazwa</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Włoska klasyka"
              autoFocus
              className="w-full px-3 py-2 rounded border text-sm"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Opis (opcjonalny)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded border text-sm resize-y"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Emoji</span>
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className="w-9 h-9 rounded flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: emoji === e ? "var(--accent-orange)" : "var(--bg-elevated)",
                    border: emoji === e ? "1px solid var(--accent-orange)" : "1px solid var(--border)",
                  }}
                >
                  {e}
                </button>
              ))}
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                className="w-12 h-9 px-1 rounded border text-center text-lg"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                aria-label="Własne emoji"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Kolor</span>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className="w-7 h-7 rounded"
                  title={c.label}
                  style={{
                    backgroundColor: c.value ?? "var(--bg-elevated)",
                    border: color === c.value ? "2px solid var(--text-primary)" : "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          {cookbook ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm disabled:opacity-50"
              style={{ color: "var(--accent-red)" }}
            >
              <Trash2 size={14} /> Usuń
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="px-3 py-1.5 rounded text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-orange)", color: "#0d0d0d" }}
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
