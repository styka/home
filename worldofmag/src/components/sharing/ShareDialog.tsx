"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { getResourceGrants, grantResourceAccess, revokeResourceAccess } from "@/actions/sharing";
import type { NadanieDTO, ZaproszenieDTO } from "@/lib/sharingGrants";

/**
 * 090 (zadanie 14) — OKNO UDOSTĘPNIANIA.
 *
 * Rozdz. 8.7: jedno okno dla WSZYSTKICH typów zasobów. Nie dostaje nazwy modułu ani niczego, co by
 * go z modułem wiązało — tylko `resourceType` (tekst z deklaracji) i `resourceId`. Dzięki temu moduł,
 * który dopisze deklarację zasobu, dostaje udostępnianie bez ani jednej linii własnego interfejsu.
 *
 * **Trzy wyniki nadania są pokazywane osobno**, bo dla użytkownika znaczą trzy różne rzeczy: osoba
 * z kontem ma dostęp od razu, osoba bez konta dostaje zaproszenie i jeszcze nic nie widzi, a link
 * trzeba **skopiować** — inaczej nie dotrze do nikogo. Wspólny komunikat „udostępniono" byłby
 * w dwóch z trzech przypadków nieprawdą.
 */
// Same KODY ról; nazwy i opisy przychodzą ze słownika (C-32) — inaczej lista ról byłaby jedynym
// miejscem w oknie, którego tłumacz nie umiałby ruszyć.
const KODY_ROL = ["viewer", "commenter", "editor", "manager"] as const;
type KodRoli = (typeof KODY_ROL)[number];

export function ShareDialog({
  resourceType,
  resourceId,
  onClose,
}: {
  resourceType: string;
  resourceId: string;
  onClose: () => void;
}) {
  const [nadania, setNadania] = useState<NadanieDTO[]>([]);
  const [zaproszenia, setZaproszenia] = useState<ZaproszenieDTO[]>([]);
  const [etykietaTypu, setEtykietaTypu] = useState("");
  const [email, setEmail] = useState("");
  const [rola, setRola] = useState<KodRoli>("viewer");
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [wczytane, setWczytane] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("sharing");
  const nazwaRoli = (kod: string) => (KODY_ROL as readonly string[]).includes(kod) ? t(`roles.${kod}`) : kod;

  async function odswiez() {
    try {
      const dane = await getResourceGrants(resourceType, resourceId);
      setNadania(dane.nadania);
      setZaproszenia(dane.zaproszenia);
      setEtykietaTypu(dane.etykietaTypu);
      setBlad(null);
    } catch (e) {
      setBlad(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setWczytane(true);
    }
  }

  useEffect(() => {
    void odswiez();
    // Zależności celowo tylko od identyfikacji zasobu — `odswiez` jest stabilne w obrębie otwarcia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceType, resourceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function nadaj(podmiot: Parameters<typeof grantResourceAccess>[2]) {
    setKomunikat(null);
    setBlad(null);
    startTransition(async () => {
      try {
        const wynik = await grantResourceAccess(resourceType, resourceId, podmiot, rola);
        if (wynik.rodzaj === "nadano") setKomunikat(t("granted"));
        else if (wynik.rodzaj === "zaproszono") {
          setKomunikat(t("invited", { email: wynik.email }));
        } else {
          const adres = `${window.location.origin}/udostepnione?token=${wynik.token}`;
          await navigator.clipboard?.writeText(adres).catch(() => {});
          setKomunikat(t("linkCopied"));
        }
        setEmail("");
        await odswiez();
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("grantFailed"));
      }
    });
  }

  function odbierz(grantId: string) {
    setKomunikat(null);
    setBlad(null);
    startTransition(async () => {
      try {
        await revokeResourceAccess(grantId);
        await odswiez();
      } catch (e) {
        setBlad(e instanceof Error ? e.message : t("revokeFailed"));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgba(0,0,0,0.55)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            {etykietaTypu ? t("titleWith", { typ: etykietaTypu }) : t("title")}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <input
            type="email"
            value={email}
            placeholder={t("emailPlaceholder")}
            disabled={isPending}
            onChange={(e) => setEmail(e.target.value)}
            className="py-3"
            style={{
              flex: "1 1 180px", minWidth: 0, padding: "6px 8px", fontSize: 13, borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
            }}
          />
          <select
            value={rola}
            disabled={isPending}
            onChange={(e) => setRola(e.target.value as typeof rola)}
            className="py-3"
            style={{
              padding: "6px 8px", fontSize: 13, borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
            }}
          >
            {KODY_ROL.map((kod) => (
              <option key={kod} value={kod}>{t(`roles.${kod}`)} — {t(`roles.${kod}Hint`)}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !email.trim()}
            onClick={() => nadaj({ rodzaj: "user", email })}
            className="py-3"
            style={{
              padding: "6px 12px", fontSize: 12, borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
              cursor: isPending || !email.trim() ? "default" : "pointer",
              opacity: isPending || !email.trim() ? 0.6 : 1,
            }}
          >
            {t("share")}
          </button>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={() => nadaj({ rodzaj: "link" })}
          className="py-3"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12,
            padding: "6px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer",
            border: "1px dashed var(--border)", background: "none", color: "var(--text-secondary)",
          }}
        >
          <Link2 size={13} /> {t("createLink", { rola: t(`roles.${rola}`) })}
        </button>

        {komunikat && <div style={{ fontSize: 12, color: "var(--accent-green)", marginBottom: 10, lineHeight: 1.5 }}>{komunikat}</div>}
        {blad && <div style={{ fontSize: 12, color: "var(--accent-red)", marginBottom: 10, lineHeight: 1.5 }}>{blad}</div>}

        {!wczytane ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("loading")}</div>
        ) : nadania.length === 0 && zaproszenia.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("nobody")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {nadania.map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <span style={{ flex: 1, minWidth: 0, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {n.subjectType === "link" ? t("link") : (n.subjectLabel ?? n.subjectId)}
                  {n.subjectType === "workspace" && ` ${t("workspaceSuffix")}`}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{nazwaRoli(n.role)}</span>
                {n.inherited ? (
                  // Nadanie z lustra ma źródło poza tym oknem. Kasowanie samego odbicia zniknęłoby
                  // przy najbliższej synchronizacji, a użytkownik zobaczyłby dostęp, który „wrócił sam".
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }} title={t("fromMembershipHint")}>
                    {t("fromMembership")}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => odbierz(n.id)}
                    aria-label={t("revoke")}
                    style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {zaproszenia.map((z) => (
              <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, opacity: 0.75 }}>
                <span style={{ flex: 1, minWidth: 0, color: "var(--text-primary)" }}>{z.email}</span>
                <span style={{ color: "var(--text-muted)" }}>{t("invitationPending")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
