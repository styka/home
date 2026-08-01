"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Brain, Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  getUserFactsForAdmin,
  setUserFactByAdmin,
  deleteUserFactByAdmin,
} from "@/actions/userFacts";
import {
  USER_FACT_CATEGORIES,
  USER_FACT_CATEGORY_LABELS,
  USER_FACT_CONFIDENCE_LABELS,
  USER_FACT_ORIGIN_LABELS,
  type UserFactCategory,
  type UserFactDTO,
} from "@/lib/userFacts";

/**
 * 039: wgląd i korekta wiedzy o użytkowniku po stronie administratora.
 *
 * Fakt zapisany stąd dostaje `origin: "admin"` i nie jest ruszany przez automatyczne wnioskowanie —
 * inaczej korekta żyłaby do najbliższego przebiegu w tle i po cichu znikała.
 */
export function UserFactsPanel({ users }: { users: Array<{ id: string; email: string | null; name: string | null }> }) {
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string>(users[0]?.id ?? "");
  const [facts, setFacts] = useState<UserFactDTO[] | null>(null);
  const [editing, setEditing] = useState<UserFactDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, startBusy] = useTransition();

  const load = useCallback(() => {
    if (!userId) return;
    setFacts(null);
    getUserFactsForAdmin(userId)
      .then(setFacts)
      .catch((e) => {
        showToast(e?.message ?? "Nie udało się wczytać faktów", "error");
        setFacts([]);
      });
  }, [userId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  function remove(f: UserFactDTO) {
    if (!confirm(`Usunąć fakt „${f.text}”?`)) return;
    startBusy(async () => {
      try {
        await deleteUserFactByAdmin(f.id);
        load();
      } catch (e: any) {
        showToast(e?.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <Brain size={16} className="text-[var(--accent-purple)]" /> Wiedza o użytkowniku
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email ?? u.name ?? u.id}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)} disabled={!userId}>
            <Plus size={14} /> Dodaj
          </Button>
        </div>
      </div>

      {facts === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-[var(--text-muted)]" size={18} />
        </div>
      ) : facts.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--text-muted)]">
          Ten użytkownik nie ma jeszcze żadnych faktów.
        </p>
      ) : (
        <ul className="space-y-2">
          {facts.map((f) => (
            <li
              key={f.id}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5"
              style={f.status === "rejected" ? { opacity: 0.6 } : undefined}
            >
              <p className="text-sm text-[var(--text-primary)]">{f.text}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {USER_FACT_CATEGORY_LABELS[f.category]} · {USER_FACT_CONFIDENCE_LABELS[f.confidence]} ·{" "}
                {USER_FACT_ORIGIN_LABELS[f.origin]}
                {f.status === "rejected" ? " · odrzucone przez użytkownika" : ""}
              </p>
              <div className="mt-2 flex gap-1.5">
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(f)}>
                  <Pencil size={13} /> Popraw
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(f)}>
                  <Trash2 size={13} /> Usuń
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <AdminFactModal
          userId={userId}
          fact={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AdminFactModal({
  userId,
  fact,
  onClose,
  onSaved,
}: {
  userId: string;
  fact: UserFactDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [text, setText] = useState(fact?.text ?? "");
  const [category, setCategory] = useState<UserFactCategory>(fact?.category ?? "interests");
  const [, startTransition] = useTransition();

  function save() {
    if (!text.trim()) {
      showToast("Wpisz treść", "error");
      return;
    }
    startTransition(async () => {
      try {
        await setUserFactByAdmin({ userId, id: fact?.id, category, text });
        onSaved();
      } catch (e: any) {
        showToast(e?.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <Modal
      onClose={onClose}
      title={fact ? "Popraw fakt" : "Dodaj fakt"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>
          <Button size="sm" onClick={save}>
            Zapisz
          </Button>
        </>
      }
    >
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">Kategoria</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as UserFactCategory)}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          {USER_FACT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {USER_FACT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">Treść</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
    </Modal>
  );
}
