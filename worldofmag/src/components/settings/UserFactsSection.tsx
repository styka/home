"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Brain, Check, X, Pencil, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { runJob } from "@/platform/jobs/client";
import {
  getUserFacts,
  confirmUserFact,
  rejectUserFact,
  upsertUserFact,
  deleteUserFact,
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
 * 039: „Co system o mnie wie" — pełna, jawna lista faktów.
 *
 * To jest warunek, na jakim ta wiedza w ogóle może istnieć: każdy fakt jest widoczny, ma podane
 * pochodzenie i pewność, i da się go poprawić, potwierdzić albo odrzucić. Bez tego ekranu byłby to
 * niewidzialny profil sterujący tym, co system podpowiada.
 */
export function UserFactsSection() {
  const { showToast } = useToast();
  const [facts, setFacts] = useState<UserFactDTO[] | null>(null);
  const [editing, setEditing] = useState<UserFactDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [busy, startBusy] = useTransition();

  const load = useCallback(() => {
    getUserFacts()
      .then(setFacts)
      .catch(() => setFacts([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Szukanie hipotez to zadanie w tle — potrafi trwać kilkanaście sekund i woła model. */
  function infer() {
    setInferring(true);
    runJob<{ added: number }>("user.facts", {})
      .then((r) => {
        showToast(
          r?.added ? `Nowych hipotez: ${r.added}` : "Nie znaleziono nic nowego",
          r?.added ? "success" : "info"
        );
        load();
      })
      .catch((e) => showToast(e?.message ?? "Nie udało się poszukać hipotez", "error"))
      .finally(() => setInferring(false));
  }

  function act(fn: () => Promise<void>) {
    startBusy(async () => {
      try {
        await fn();
        load();
      } catch (e: any) {
        showToast(e?.message ?? "Błąd", "error");
      }
    });
  }

  const byCategory = USER_FACT_CATEGORIES.map((c) => ({
    category: c,
    items: (facts ?? []).filter((f) => f.category === c),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <Brain size={16} className="text-[var(--accent-purple)]" /> Co system o Tobie wie
        </span>
        <div className="flex gap-2">
          {/* Wnioskowanie odpala się WYŁĄCZNIE stąd, jawnym kliknięciem. Automatyczne dopisywanie
              hipotez w tle sprawiłoby, że lista rośnie bez wiedzy użytkownika — a cały ten ekran
              jest po to, żeby tak się nie działo. */}
          <Button variant="ghost" size="sm" onClick={infer} disabled={inferring}>
            {inferring ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {inferring ? "Szukam…" : "Poszukaj hipotez"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> Dodaj
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        Te informacje trafiają do podpowiedzi w innych modułach (np. propozycji w Pogodzie).
        Możesz je poprawić, potwierdzić albo odrzucić — odrzucone nie wracają.
      </p>

      {facts === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-[var(--text-muted)]" size={18} />
        </div>
      ) : facts.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--text-muted)]">
          Nic jeszcze nie wiemy. Hipotezy pojawią się, gdy będzie z czego je wyciągnąć — możesz też
          dopisać coś od siebie.
        </p>
      ) : (
        <div className="space-y-4">
          {byCategory.map((g) => (
            <div key={g.category}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {USER_FACT_CATEGORY_LABELS[g.category]}
              </h3>
              <ul className="space-y-2">
                {g.items.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5"
                  >
                    <p className="text-sm text-[var(--text-primary)]">{f.text}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {USER_FACT_CONFIDENCE_LABELS[f.confidence]} ·{" "}
                      {USER_FACT_ORIGIN_LABELS[f.origin]}
                      {f.evidence ? ` · ${f.evidence}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.confidence !== "confirmed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => act(() => confirmUserFact(f.id))}
                        >
                          <Check size={13} /> Zgadza się
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => act(() => rejectUserFact(f.id))}
                      >
                        <X size={13} /> Nie o mnie
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(f)}>
                        <Pencil size={13} /> Popraw
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => act(() => deleteUserFact(f.id))}
                      >
                        <Trash2 size={13} /> Usuń
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <FactModal
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

function FactModal({
  fact,
  onClose,
  onSaved,
}: {
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
        await upsertUserFact({ id: fact?.id, category, text });
        onSaved();
      } catch (e: any) {
        showToast(e?.message ?? "Błąd", "error");
      }
    });
  }

  return (
    <Modal
      onClose={onClose}
      title={fact ? "Popraw informację o sobie" : "Dodaj informację o sobie"}
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
          placeholder="np. Lubi wycieczki górskie, ale nie w upały"
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
    </Modal>
  );
}
