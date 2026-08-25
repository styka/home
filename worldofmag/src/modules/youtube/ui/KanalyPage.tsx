"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Youtube, Plus, Trash2, Link2, Unlink } from "lucide-react";
import { ModuleView } from "@/components/ui/view";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { dodajKanal, usunKanal, getKanaly, type KanalDTO } from "../actions/kanaly";
import { rozlaczYoutube, importujSubskrypcje } from "../actions/polaczenie";

const przyciskStyl: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 8, background: "var(--bg-elevated)",
  color: "var(--text-secondary)", fontSize: 13, border: "1px solid var(--border)", cursor: "pointer",
};
const przyciskGlowny: React.CSSProperties = {
  ...przyciskStyl, background: "var(--accent-red)", color: "var(--on-accent)", borderColor: "transparent", fontWeight: 600,
};
const sekcjaStyl: React.CSSProperties = {
  padding: 14, borderRadius: 10, background: "var(--bg-surface)",
  border: "1px solid var(--border)", marginBottom: 12,
};

/**
 * 102 — obserwowane kanały.
 *
 * **Moduł działa bez połączenia z kontem Google i nigdzie nie blokuje pracy pytaniem o nie** (AC-2).
 * Połączenie jest wygodą (import subskrypcji jednym kliknięciem), a nie warunkiem wstępnym — dlatego
 * ręczne dodawanie stoi PIERWSZE, a zaproszenie do połączenia niżej, jako propozycja.
 */
export function KanalyPage({ poczatkowe, polaczony }: { poczatkowe: KanalDTO[]; polaczony: boolean }) {
  const t = useTranslations("modules.youtube.KanalyPage");
  const confirmDialog = useConfirm();
  const [kanaly, setKanaly] = useState<KanalDTO[]>(poczatkowe);
  const [adres, setAdres] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function dodaj() {
    const wartosc = adres.trim();
    if (!wartosc) return;
    setBlad(null);
    startTransition(async () => {
      const wynik = await dodajKanal(wartosc);
      if (wynik.ok) {
        setKanaly((k) => [...k, wynik.kanal].sort((a, b) => a.title.localeCompare(b.title)));
        setAdres("");
      } else {
        setBlad(t(`blad.${wynik.powod}`));
      }
    });
  }

  async function usun(kanal: KanalDTO) {
    const zgoda = await confirmDialog({
      title: t("potwierdzUsuniecie", { nazwa: kanal.title }),
      description: t("potwierdzOpis"),
      destructive: true,
    });
    if (!zgoda) return;
    await usunKanal(kanal.id);
    setKanaly((k) => k.filter((x) => x.id !== kanal.id));
  }

  function importuj() {
    setBlad(null);
    startTransition(async () => {
      const wynik = await importujSubskrypcje();
      // Zgoda mogła zostać cofnięta po stronie Google. Milczące połknięcie tego wyniku dawałoby
      // przycisk, który „nic nie robi" — najgorszy możliwy stan, bo nie da się go odróżnić od
      // konta bez nowych subskrypcji.
      if (!wynik.ok) {
        setBlad(t("blad.brak-polaczenia"));
        return;
      }
      setKanaly(await getKanaly());
    });
  }

  async function rozlacz() {
    const zgoda = await confirmDialog({ title: t("potwierdzRozlaczenie"), description: t("rozlaczenieOpis") });
    if (!zgoda) return;
    startTransition(async () => { await rozlaczYoutube(); });
  }

  return (
    <ModuleView
      icon={<Youtube size={18} />}
      iconColor="var(--accent-red)"
      title={t("tytul")}
      breadcrumb={<a href="/youtube" style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("wrocDoListy")}</a>}
      state="ready"
    >
      <section style={sekcjaStyl}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
          {t("dodajTytul")}
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>{t("dodajOpis")}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") dodaj(); }}
            placeholder={t("adresPlaceholder")}
            aria-label={t("adresEtykieta")}
            style={{
              flex: "1 1 240px", background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13,
            }}
          />
          <button type="button" style={przyciskGlowny} onClick={dodaj} disabled={pending}>
            <Plus size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("dodaj")}
          </button>
        </div>
        {blad && <p style={{ fontSize: 12, color: "var(--accent-red)", margin: "8px 0 0" }}>{blad}</p>}
      </section>

      <section style={sekcjaStyl}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
          {t("kontoTytul")}
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
          {polaczony ? t("kontoPolaczoneOpis") : t("kontoOpis")}
        </p>
        {polaczony ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={przyciskGlowny} onClick={importuj} disabled={pending}>
              {t("importuj")}
            </button>
            <button type="button" style={przyciskStyl} onClick={rozlacz} disabled={pending}>
              <Unlink size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
              {t("rozlacz")}
            </button>
          </div>
        ) : (
          <a href="/api/youtube/connect" style={{ ...przyciskGlowny, display: "inline-block", textDecoration: "none" }}>
            <Link2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} aria-hidden />
            {t("polacz")}
          </a>
        )}
      </section>

      <section style={sekcjaStyl}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
          {t("listaTytul", { ile: kanaly.length })}
        </h2>
        {kanaly.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t("brakKanalow")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {kanaly.map((k) => (
              <li
                key={k.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{k.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {k.handle ?? k.channelId} · {t(`zrodlo.${k.zrodlo}`)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => usun(k)}
                  aria-label={t("usunEtykieta", { nazwa: k.title })}
                  style={{ ...przyciskStyl, padding: "10px 12px" }}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ModuleView>
  );
}
