"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ArchiveRestore, Loader2, RotateCcw, Search } from "lucide-react";
import { getAdminTrash, adminRestoreTrashItem, type AdminTrashItemDTO, type AdminTrashPage } from "@/actions/adminTrash";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import type { TrashStatus } from "@/platform/trash/trash";

/**
 * 117 (AC-8): panel przywracania — admin widzi WSZYSTKIE wpisy kosza (także `emptied`/`expired`,
 * których użytkownik już nie zobaczy) i przywraca zasób właścicielowi. Nieusuwalność zasobów:
 * to jest miejsce, dla którego opróżnienie kosza przestało być twardym DELETE.
 */

type FiltrStatusu = TrashStatus | "all";

const STATUSY: FiltrStatusu[] = ["all", "active", "emptied", "expired", "restored"];

export function KoszAdmina({ initial }: { initial: AdminTrashPage }) {
  const t = useTranslations("components.admin.KoszAdmina");
  const confirmDialog = useConfirm();
  const [items, setItems] = useState<AdminTrashItemDTO[]>(initial.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [status, setStatus] = useState<FiltrStatusu>("all");
  const [szukaj, setSzukaj] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function przeladuj(nowyStatus: FiltrStatusu, fraza: string) {
    startTransition(async () => {
      const p = await getAdminTrash({ status: nowyStatus, szukaj: fraza || null });
      setItems(p.items);
      setNextCursor(p.nextCursor);
    });
  }

  function zmienStatus(s: FiltrStatusu) {
    setStatus(s);
    przeladuj(s, szukaj);
  }

  function doladuj() {
    if (!nextCursor) return;
    startTransition(async () => {
      const p = await getAdminTrash({ status, szukaj: szukaj || null, kursor: nextCursor });
      setItems((prev) => [...prev, ...p.items]);
      setNextCursor(p.nextCursor);
    });
  }

  async function przywroc(it: AdminTrashItemDTO) {
    if (!(await confirmDialog({ title: t("przywrocPytanie", { tytul: it.title, email: it.ownerEmail }) }))) return;
    setBusyId(it.id);
    startTransition(async () => {
      try {
        await adminRestoreTrashItem(it.id);
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: "restored" } : x)));
      } finally {
        setBusyId(null);
      }
    });
  }

  const kolorStatusu: Record<string, string> = {
    active: "var(--accent-blue)",
    emptied: "var(--accent-amber)",
    expired: "var(--accent-purple)",
    restored: "var(--accent-green)",
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} /> Admin
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <ArchiveRestore size={20} style={{ color: "var(--accent-green)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{t("tytul")}</h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{t("opis")}</p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUSY.map((s) => (
            <button
              key={s}
              onClick={() => zmienStatus(s)}
              className="px-2.5 py-1 rounded text-xs focus:outline-none"
              style={{
                border: "1px solid var(--border)",
                color: status === s ? "var(--text-primary)" : "var(--text-muted)",
                backgroundColor: status === s ? "var(--bg-hover)" : "transparent",
              }}
            >
              {t(`status_${s}`)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <input
              value={szukaj}
              onChange={(e) => setSzukaj(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") przeladuj(status, szukaj); }}
              placeholder={t("szukajPodpowiedz")}
              className="px-2 py-1 rounded text-xs focus:outline-none"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", width: 220 }}
            />
            <button
              onClick={() => przeladuj(status, szukaj)}
              className="p-1.5 rounded focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              title={t("szukaj")}
              aria-label={t("szukaj")}
            >
              <Search size={14} />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("brakWpisow")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => {
              const busy = busyId === it.id;
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ color: kolorStatusu[it.status] ?? "var(--text-muted)", border: `1px solid ${kolorStatusu[it.status] ?? "var(--border)"}`, flexShrink: 0 }}
                  >
                    {t(`status_${it.status}` as `status_${TrashStatus}`)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.title}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {it.module} · {it.ownerEmail} · {new Date(it.deletedAt).toLocaleString("pl-PL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {it.status !== "restored" && (
                    <button
                      onClick={() => przywroc(it)}
                      disabled={busy || pending}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8, border: "none", background: "var(--accent-green)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} {t("przywroc")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {nextCursor && (
          <button
            onClick={doladuj}
            disabled={pending}
            className="mt-4 px-3 py-1.5 rounded text-xs focus:outline-none disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            {pending ? t("ladowanie") : t("zaladujWiecej")}
          </button>
        )}
      </div>
    </div>
  );
}
