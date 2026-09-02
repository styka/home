"use client";

// 116 — panel administratora: magazyn grafik skórek zaawansowanych.
//
// Kontrola ZASOBÓW, nie zachowań użytkownika (spec 116, §6): ile skórek którego
// rodzaju, ile grafik i ile ważą, które są największe i które OSIEROCONE (żadna
// skórka ich nie używa — kandydaci do sprzątania). Usunięcie używanej grafiki
// odrzuca serwer (guard w `deleteSkinAsset`) — przycisk tylko relacjonuje odmowę.

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload, ImageOff } from "lucide-react";
import { uploadSkinAsset, deleteSkinAsset, type SkinAssetStats } from "@/actions/skinAssets";
import { useConfirm } from "@/components/ui/ConfirmProvider";

function rozmiar(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} kB`;
  return `${b} B`;
}

export function SkinAssetsPanel({ stats }: { stats: SkinAssetStats }) {
  const t = useTranslations("components.admin.SkinAssetsPanel");
  const confirmDialog = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", "background");
    fd.set("system", "1");
    start(async () => {
      try {
        await uploadSkinAsset(fd);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd wgrywania");
      }
    });
  }

  async function remove(id: string, name: string) {
    if (!(await confirmDialog({ title: t("usunacGrafike", { name }), destructive: true }))) return;
    setError(null);
    start(async () => {
      try {
        await deleteSkinAsset(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Błąd usuwania");
      }
    });
  }

  const osierocone = stats.assety.filter((a) => a.osierocony).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 32 }}>
      <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>{t("naglowek")}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Kafelek etykieta={t("skorkiProste")} wartosc={String(stats.skorekProstych)} />
        <Kafelek etykieta={t("skorkiZaawansowane")} wartosc={String(stats.skorekZaawansowanych)} />
        <Kafelek etykieta={t("liczbaGrafik")} wartosc={String(stats.liczbaAssetow)} />
        <Kafelek etykieta={t("rozmiarLacznie")} wartosc={rozmiar(stats.rozmiarLacznie)} />
        <Kafelek etykieta={t("osierocone")} wartosc={String(osierocone)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}
        >
          <Upload size={14} /> {t("wgrajSystemowa")}
        </button>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("limitWgrywania")}</span>
      </div>

      {error && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</div>}

      {stats.assety.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13, padding: "16px 0" }}>
          <ImageOff size={16} /> {t("brakGrafik")}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", textAlign: "left" }}>
                <th style={{ padding: "6px 8px" }}>{t("kolPodglad")}</th>
                <th style={{ padding: "6px 8px" }}>{t("kolNazwa")}</th>
                <th style={{ padding: "6px 8px" }}>{t("kolTyp")}</th>
                <th style={{ padding: "6px 8px" }}>{t("kolRozmiar")}</th>
                <th style={{ padding: "6px 8px" }}>{t("kolWlasciciel")}</th>
                <th style={{ padding: "6px 8px" }}>{t("kolUzycie")}</th>
                <th style={{ padding: "6px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {stats.assety.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <td style={{ padding: "6px 8px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/skins/assets/${a.id}`} alt="" style={{ width: 40, height: 28, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }} />
                  </td>
                  <td style={{ padding: "6px 8px", color: "var(--text-primary)" }}>{a.name}</td>
                  <td style={{ padding: "6px 8px" }}>{a.mimeType.replace("image/", "")} · {a.kind}</td>
                  <td style={{ padding: "6px 8px" }}>{rozmiar(a.size)}</td>
                  <td style={{ padding: "6px 8px" }}>{a.isSystem ? t("systemowy") : t("uzytkownika")}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {a.osierocony ? (
                      <span style={{ color: "var(--accent-amber)" }}>{t("osierocony")}</span>
                    ) : (
                      a.uzywanaPrzez.map((s) => s.name).join(", ")
                    )}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    <button
                      type="button"
                      title={a.osierocony ? t("usun") : t("usunZablokowane")}
                      disabled={!a.osierocony || pending}
                      onClick={() => remove(a.id, a.name)}
                      style={{ display: "inline-flex", padding: 6, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 5, color: a.osierocony ? "var(--accent-red)" : "var(--text-muted)", opacity: a.osierocony ? 1 : 0.4, cursor: a.osierocony ? "pointer" : "not-allowed" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kafelek({ etykieta, wartosc }: { etykieta: string; wartosc: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{etykieta}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{wartosc}</div>
    </div>
  );
}
