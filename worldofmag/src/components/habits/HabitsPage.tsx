"use client";

import { useState, useRef, useEffect, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Flame, Plus, Check, Bell, BellOff, Pencil, Trash2, ChevronDown, Archive, CalendarRange } from "lucide-react";
import { PageHeader, StatTile, SectionHeading, EmptyState, pageContainerStyle, pageInnerStyle } from "@/components/ui/home";
import { createHabit, updateHabit, deleteHabit, setHabitArchived, toggleHabitDay } from "@/actions/habits";
import { todayISO, computeStreaks, weekProgress } from "@/lib/habitStats";
import { showLocalNotification, notificationsGranted, requestNotificationPermission } from "@/lib/notifications";
import { HabitFormModal, emptyHabitForm, type HabitFormValue } from "./HabitFormModal";
import { HabitHeatmap } from "./HabitHeatmap";
import type { HabitWithStats } from "@/types";

function streakLabel(n: number): string {
  if (n === 0) return "Zacznij dziś";
  if (n === 1) return "1 dzień";
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && (last2 < 12 || last2 > 14)) return `${n} dni z rzędu`;
  return `${n} dni z rzędu`;
}

/** Mikrokopia motywująca — kontekst: użytkownicy odbudowujący nawyki. */
function encouragement(doneToday: number, scheduledToday: number): string {
  if (scheduledToday === 0) return "Na dziś nic nie zaplanowano — odpocznij spokojnie.";
  if (doneToday === 0) return "Każdy nawyk zaczyna się od jednego małego kroku. Dasz radę.";
  if (doneToday < scheduledToday) return `Dobra robota — jeszcze ${scheduledToday - doneToday} do końca dnia.`;
  return "Wszystko odhaczone! Jesteś dziś niepokonany. 🔥";
}

export function HabitsPage({ habits: initial }: { habits: HabitWithStats[] }) {
  const router = useRouter();
  const [habits, setHabits] = useState<HabitWithStats[]>(initial);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; habit: HabitWithStats } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notifOn, setNotifOn] = useState(false);
  const [focused, setFocused] = useState<number>(-1);
  const [, startTransition] = useTransition();

  // Re-sync z serwera po router.refresh.
  useEffect(() => setHabits(initial), [initial]);

  const today = todayISO();
  const scheduled = useMemo(() => habits.filter((h) => h.scheduledToday), [habits]);
  const others = useMemo(() => habits.filter((h) => !h.scheduledToday), [habits]);
  const doneToday = scheduled.filter((h) => h.completedToday).length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.currentStreak), 0);
  const pct = scheduled.length ? Math.round((doneToday / scheduled.length) * 100) : 0;

  // ── Powiadomienia: ten sam mechanizm co przypomnienia o zadaniach ──────────
  const habitsRef = useRef(habits);
  habitsRef.current = habits;
  const notifiedRef = useRef<Set<string>>(new Set());

  const checkReminders = useCallback((list: HabitWithStats[]) => {
    if (!notificationsGranted()) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const day = todayISO();
    for (const h of list) {
      if (!h.reminderTime || !h.scheduledToday || h.completedToday) continue;
      const m = /^(\d{2}):(\d{2})$/.exec(h.reminderTime);
      if (!m) continue;
      const remMin = Number(m[1]) * 60 + Number(m[2]);
      const diff = nowMin - remMin;
      // Okno: od godziny przypomnienia do 2h po niej.
      if (diff < 0 || diff >= 120) continue;
      const key = `${h.id}:${day}`;
      if (notifiedRef.current.has(key)) continue;
      notifiedRef.current.add(key);
      void showLocalNotification(`${h.icon} Czas na nawyk: ${h.name}`, {
        body: h.currentStreak > 0 ? `Nie przerywaj serii — ${streakLabel(h.currentStreak)}!` : "Mały krok dziś = duża zmiana jutro.",
        icon: "/pwa-icon/192",
        tag: key,
      });
    }
  }, []);

  useEffect(() => {
    setNotifOn(notificationsGranted());
    checkReminders(habits);
  }, [habits, checkReminders]);

  useEffect(() => {
    const id = setInterval(() => checkReminders(habitsRef.current), 30_000);
    return () => clearInterval(id);
  }, [checkReminders]);

  async function enableNotifications() {
    const ok = await requestNotificationPermission();
    setNotifOn(ok);
    if (ok) checkReminders(habitsRef.current);
  }

  // ── Mutacje (optymistyczne) ────────────────────────────────────────────────
  function toggle(id: string) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const has = h.entryDates.includes(today);
        const entryDates = has ? h.entryDates.filter((d) => d !== today) : [...h.entryDates, today].sort();
        const s = computeStreaks(entryDates, h.daysOfWeek);
        const w = weekProgress(entryDates, h.daysOfWeek);
        return { ...h, entryDates, completedToday: !has, currentStreak: s.currentStreak, longestStreak: s.longestStreak, weekDone: w.done, weekTarget: w.target };
      })
    );
    startTransition(async () => {
      try {
        await toggleHabitDay(id);
        router.refresh();
      } catch {
        router.refresh(); // przywróć stan z serwera przy błędzie
      }
    });
  }

  async function handleSave(v: HabitFormValue) {
    if (modal?.mode === "edit") {
      await updateHabit(modal.habit.id, v);
    } else {
      await createHabit(v);
    }
    setModal(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć ten nawyk wraz z całą historią?")) return;
    setHabits((prev) => prev.filter((h) => h.id !== id));
    await deleteHabit(id);
    router.refresh();
  }

  async function handleArchive(id: string) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    await setHabitArchived(id, true);
    router.refresh();
  }

  // ── Klawiatura (vim-style, jak reszta aplikacji) ───────────────────────────
  const ordered = useMemo(() => [...scheduled, ...others], [scheduled, others]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modal) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (e.key === "j") { e.preventDefault(); setFocused((i) => Math.min(ordered.length - 1, i + 1)); }
      else if (e.key === "k") { e.preventDefault(); setFocused((i) => Math.max(0, i - 1)); }
      else if (e.key === "n" || e.key === "a") { e.preventDefault(); setModal({ mode: "create" }); }
      else if ((e.key === " " || e.key === "x") && focused >= 0 && ordered[focused]) { e.preventDefault(); toggle(ordered[focused].id); }
      else if (e.key === "e" && focused >= 0 && ordered[focused]) { e.preventDefault(); setModal({ mode: "edit", habit: ordered[focused] }); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, focused, modal]);

  const renderCard = (h: HabitWithStats, index: number) => (
    <HabitCard
      key={h.id}
      habit={h}
      focused={focused === index}
      expanded={expandedId === h.id}
      onToggle={() => toggle(h.id)}
      onExpand={() => setExpandedId((cur) => (cur === h.id ? null : h.id))}
      onEdit={() => setModal({ mode: "edit", habit: h })}
      onDelete={() => handleDelete(h.id)}
      onArchive={() => handleArchive(h.id)}
      onFocus={() => setFocused(index)}
    />
  );

  return (
    <div style={pageContainerStyle}>
      <div style={pageInnerStyle}>
        <PageHeader
          icon={<Flame size={22} />}
          iconColor="var(--accent-orange)"
          title="Nawyki"
          subtitle={encouragement(doneToday, scheduled.length)}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={enableNotifications}
                title={notifOn ? "Powiadomienia włączone" : "Włącz przypomnienia"}
                className="flex items-center justify-center rounded"
                style={{ width: 38, height: 38, background: "var(--bg-surface)", border: "1px solid var(--border)", color: notifOn ? "var(--accent-orange)" : "var(--text-muted)" }}
              >
                {notifOn ? <Bell size={16} /> : <BellOff size={16} />}
              </button>
              <button onClick={() => setModal({ mode: "create" })} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium" style={{ background: "var(--accent-orange)", color: "#fff", border: "none" }}>
                <Plus size={15} /> Dodaj
              </button>
            </div>
          }
        />

        {habits.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            <StatTile value={`${doneToday}/${scheduled.length}`} label="Na dziś" color="var(--accent-orange)" />
            <StatTile value={bestStreak} label="Najlepsza seria" color="var(--accent-red)" icon={<Flame size={14} />} />
            <StatTile value={`${pct}%`} label="Ukończono dziś" color="var(--accent-green)" />
            <StatTile value={habits.length} label="Aktywne nawyki" color="var(--accent-blue)" />
          </div>
        )}

        {habits.length === 0 ? (
          <EmptyState
            icon={<Flame size={32} />}
            message="Zbuduj swój pierwszy nawyk"
            hint="Zacznij od jednej małej rzeczy dziennie. Konsekwencja pokona każdy zły dzień."
            cta={{ label: "Dodaj nawyk", onClick: () => setModal({ mode: "create" }), color: "var(--accent-orange)" }}
          />
        ) : (
          <>
            {scheduled.length > 0 && (
              <section>
                <SectionHeading>Na dziś</SectionHeading>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {scheduled.map((h, i) => renderCard(h, i))}
                </div>
              </section>
            )}
            {others.length > 0 && (
              <section>
                <SectionHeading>Poza planem na dziś</SectionHeading>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {others.map((h, i) => renderCard(h, scheduled.length + i))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {modal && (
        <HabitFormModal
          title={modal.mode === "edit" ? "Edytuj nawyk" : "Nowy nawyk"}
          initial={
            modal.mode === "edit"
              ? {
                  name: modal.habit.name,
                  description: modal.habit.description ?? "",
                  icon: modal.habit.icon,
                  color: modal.habit.color,
                  daysOfWeek: modal.habit.daysOfWeek,
                  reminderTime: modal.habit.reminderTime,
                }
              : emptyHabitForm()
          }
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function HabitCard({
  habit: h,
  focused,
  expanded,
  onToggle,
  onExpand,
  onEdit,
  onDelete,
  onArchive,
  onFocus,
}: {
  habit: HabitWithStats;
  focused: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onFocus: () => void;
}) {
  const dots = Math.min(7, h.weekTarget);
  return (
    <div
      onMouseEnter={onFocus}
      style={{
        borderRadius: 12,
        border: `1px solid ${focused ? "var(--border-focus)" : "var(--border)"}`,
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        {/* Tap-to-complete */}
        <button
          onClick={onToggle}
          aria-label={h.completedToday ? "Cofnij wykonanie" : "Oznacz jako zrobione"}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            flexShrink: 0,
            background: h.completedToday ? h.color : "transparent",
            border: `2px solid ${h.color}`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.12s",
          }}
        >
          {h.completedToday ? <Check size={20} /> : <span style={{ fontSize: 18, lineHeight: 1 }}>{h.icon}</span>}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {h.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: h.currentStreak > 0 ? "var(--accent-orange)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Flame size={12} /> {streakLabel(h.currentStreak)}
            </span>
            {dots > 0 && (
              <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }} title={`Ten tydzień: ${h.weekDone}/${h.weekTarget}`}>
                {Array.from({ length: dots }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: i < h.weekDone ? h.color : "var(--bg-elevated)",
                      border: i < h.weekDone ? "none" : "1px solid var(--border)",
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        </div>

        <button onClick={onExpand} className="p-1.5 rounded" style={{ background: "none", border: "none", color: "var(--text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} aria-label="Szczegóły">
          <ChevronDown size={18} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "4px 14px 14px", borderTop: "1px solid var(--border)" }}>
          {h.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "10px 0" }}>{h.description}</p>}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "10px 0" }}>
            <MiniStat label="Aktualna seria" value={`${h.currentStreak}`} />
            <MiniStat label="Najdłuższa seria" value={`${h.longestStreak}`} />
            <MiniStat label="Ten tydzień" value={`${h.weekDone}/${h.weekTarget}`} />
          </div>
          <div style={{ margin: "12px 0 8px", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 5 }}>
            <CalendarRange size={12} /> Ostatnie miesiące
          </div>
          <HabitHeatmap entryDates={h.entryDates} color={h.color} daysOfWeek={h.daysOfWeek} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none" }}>
              <Pencil size={13} /> Edytuj
            </button>
            <button onClick={onArchive} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "none" }}>
              <Archive size={13} /> Archiwizuj
            </button>
            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs" style={{ background: "none", color: "var(--accent-red)", border: "1px solid var(--border)" }}>
              <Trash2 size={13} /> Usuń
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
