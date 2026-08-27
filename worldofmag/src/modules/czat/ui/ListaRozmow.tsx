"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquarePlus, Users } from "lucide-react";
import type { RozmowaDTO, RozmowcaDTO } from "../actions/rozmowy";

/**
 * Lista rozmów: kanały zespołów i rozmowy prywatne, świeże na górze, z licznikiem nieprzeczytanych.
 *
 * „Nowa rozmowa” pokazuje **wyłącznie osoby, z którymi coś mnie łączy** — wspólny zespół albo
 * udostępniony zasób. Serwer i tak to sprawdza; ta lista ma nie obiecywać rozmowy, która i tak
 * zostanie odrzucona.
 */
export function ListaRozmow({
  rozmowy,
  rozmowcy,
  wybranaId,
  onWybierz,
  onNapiszDo,
}: {
  rozmowy: RozmowaDTO[];
  rozmowcy: RozmowcaDTO[];
  wybranaId: string | null;
  onWybierz: (id: string) => void;
  onNapiszDo: (userId: string) => void;
}) {
  const t = useTranslations("modules.czat.ListaRozmow");
  const [nowa, setNowa] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-surface)" }}>
      <div className="flex flex-shrink-0 items-center justify-between" style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{t("rozmowy")}</span>
        <button
          onClick={() => setNowa((v) => !v)}
          aria-pressed={nowa}
          aria-label={t("nowaRozmowa")}
          title={t("nowaRozmowa")}
          className="flex items-center justify-center rounded"
          style={{ width: 44, height: 44, color: nowa ? "var(--accent-green)" : "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <MessageSquarePlus size={17} />
        </button>
      </div>

      {nowa && (
        <div className="flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", maxHeight: 220, overflowY: "auto" }}>
          {rozmowcy.length === 0 ? (
            <p style={{ padding: "12px 10px", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              {t("brakRozmowcow")}
            </p>
          ) : (
            rozmowcy.map((o) => (
              <button
                key={o.userId}
                onClick={() => { setNowa(false); onNapiszDo(o.userId); }}
                className="flex w-full items-center gap-2 text-left"
                style={{ padding: "10px", fontSize: 12.5, color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}
              >
                <Users size={13} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nazwa}</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rozmowy.length === 0 ? (
          <p style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
            {t("brakRozmow")}
          </p>
        ) : (
          rozmowy.map((r) => {
            const aktywna = r.id === wybranaId;
            return (
              <button
                key={r.id}
                onClick={() => onWybierz(r.id)}
                aria-current={aktywna ? "true" : undefined}
                className="flex w-full items-start gap-2 text-left"
                style={{
                  padding: "10px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                  background: aktywna ? "var(--bg-hover)" : "transparent", border: "none",
                  borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--border)",
                }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: r.nieprzeczytane > 0 ? 700 : 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.rodzaj === "zespol" ? `# ${r.etykieta}` : r.etykieta}
                  </span>
                  {r.ostatniaWiadomosc && (
                    <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.ostatniaWiadomosc}
                    </span>
                  )}
                </span>
                {r.nieprzeczytane > 0 && (
                  <span style={{ flexShrink: 0, background: "var(--accent-green)", color: "var(--on-accent, #fff)", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>
                    {r.nieprzeczytane > 99 ? "99+" : r.nieprzeczytane}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
