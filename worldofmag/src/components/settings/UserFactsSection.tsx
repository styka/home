"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Brain, Check, X, Pencil, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { runJob } from "@/platform/jobs/client";
import { getAssistantPrefs, updateAssistantPrefs } from "@/actions/assistantPrefs";
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
  const t = useTranslations("components.settings.UserFactsSection");
  const { showToast } = useToast();
  const [facts, setFacts] = useState<UserFactDTO[] | null>(null);
  const [editing, setEditing] = useState<UserFactDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [autoFacts, setAutoFacts] = useState(true);
  const [automatBusy, setAutomatBusy] = useState(false);
  const [busy, startBusy] = useTransition();

  const load = useCallback(() => {
    getUserFacts()
      .then(setFacts)
      .catch(() => setFacts([]));
  }, []);

  useEffect(() => {
    load();
    getAssistantPrefs()
      .then((p) => setAutoFacts(p.autoFacts))
      // Brak ustawień to nie błąd — domyślne (automat włączony) już stoi w stanie.
      .catch(() => {});
  }, [load]);

  function zmienAutomat(wlaczony: boolean) {
    // Optymistycznie: przełącznik ma odpowiedzieć od razu, a nie po podróży do serwera.
    setAutoFacts(wlaczony);
    setAutomatBusy(true);
    updateAssistantPrefs({ autoFacts: wlaczony })
      .catch((e) => {
        setAutoFacts(!wlaczony);
        showToast(e?.message ?? "Nie udało się zapisać ustawienia", "error");
      })
      .finally(() => setAutomatBusy(false));
  }

  /**
   * Szukanie hipotez to zadanie w tle — potrafi trwać kilkanaście sekund i woła model.
   *
   * 111: `force` omija odcisk materiału. Przebieg automatyczny kończy się bez wołania modelu, gdy
   * od poprzedniego razu nic nie przybyło — ale kliknięcie JEST wyraźną prośbą, więc ma dać wynik,
   * a nie ciche „nic nowego" wynikające z mechaniki, o której użytkownik nie wie.
   */
  function infer() {
    setInferring(true);
    runJob<{ added: number }>("user.facts", { force: true })
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
          {/* 111: wnioskowanie odpala się TAKŻE samo — na prośbę właściciela, żeby wiedza rosła
              z korzystania z aplikacji, a nie tylko z klikania tutaj. Obawa, która stała za
              poprzednim brzmieniem tego komentarza („lista rośnie bez wiedzy użytkownika"), jest
              adresowana inaczej: każda hipoteza nadal wymaga POTWIERDZENIA, cała lista jest jawna
              na tym ekranie, a automat ma widoczny wyłącznik obok. */}
          <Button variant="ghost" size="sm" onClick={infer} disabled={inferring}>
            {inferring ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {inferring ? "Szukam…" : "Poszukaj hipotez"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> Dodaj
          </Button>
        </div>
      </div>
      <p className="mb-2 text-xs text-[var(--text-muted)]">
        {t("teInformacjeTrafiajaDo")}
      </p>

      {/**
        * 111 (AC-9): WYŁĄCZNIK AUTOMATU stoi przy liście, której dotyczy, a nie w osobnych
        * ustawieniach. Automat, o którym nie wiadomo, że chodzi, jest gorszy od jego braku —
        * a to jedyne miejsce, w którym widać JEGO WYNIK.
        */}
      <label className="mb-3 flex items-start gap-2 text-xs text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={autoFacts}
          onChange={(e) => zmienAutomat(e.target.checked)}
          disabled={automatBusy}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent-blue)]"
        />
        <span>
          <span className="text-[var(--text-primary)]">{t("samSzukajHipotez")}</span>
          <span className="block text-[var(--text-muted)]">{t("samSzukajHipotezOpis")}</span>
        </span>
      </label>

      {facts === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-[var(--text-muted)]" size={18} />
        </div>
      ) : facts.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--text-muted)]">
          {t("nicJeszczeNieWiemy")}
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
                          <Check size={13} /> {t("zgadzaSie")}
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
                        <Trash2 size={13} /> {t("usun")}
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
  const t = useTranslations("components.settings.UserFactsSection");
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
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">{t("tresc")}</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={t("npLubiWycieczkiGorskie")}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
      </div>
    </Modal>
  );
}
